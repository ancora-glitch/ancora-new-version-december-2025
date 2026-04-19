import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IntakeReviewQueue } from "./IntakeReviewQueue";
import { BrandTiersSection } from "./BrandTiersSection";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw, Play, Loader2, FlaskConical, Zap, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── env helpers ── */
const envFlag = (key: string): boolean | null => {
  const v = import.meta.env[key];
  if (v === undefined || v === "") return null;
  return v === "true" || v === "1";
};
const envStr = (key: string): string => (import.meta.env[key] as string) ?? "";

/* ── status card ── */
interface StatusCardProps {
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "muted";
}
const StatusCard = ({ label, value, color }: StatusCardProps) => {
  const colorMap = {
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-md border border-border bg-card p-4 flex-1 min-w-[140px]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${colorMap[color]}`}>{value}</p>
    </div>
  );
};

/* ── run status styling ── */
const runStatusStyle = (status: string | null) => {
  if (!status) return "bg-muted text-muted-foreground";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "failed") return "bg-red-100 text-red-800";
  if (status.startsWith("aborted")) return "bg-amber-100 text-amber-800";
  if (status === "started") return "bg-blue-100 text-blue-800";
  return "bg-muted text-muted-foreground";
};

/* ── queue state badge colors ── */
const queueColor = (state: string) => {
  const map: Record<string, string> = {
    raw_imported: "bg-blue-100 text-blue-800",
    rules_rejected: "bg-red-100 text-red-800",
    normalized: "bg-cyan-100 text-cyan-800",
    enriched: "bg-indigo-100 text-indigo-800",
    scored_review: "bg-amber-100 text-amber-800",
    scored_draft_approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    test_approved: "bg-emerald-100 text-emerald-800",
  };
  return map[state] ?? "bg-muted text-muted-foreground";
};

const QUEUE_STATES = [
  "raw_imported",
  "rules_rejected",
  "normalized",
  "enriched",
  "scored_review",
  "scored_draft_approved",
  "rejected",
  "test_approved",
] as const;

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE") + " " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
};

/* ── Result summary type ── */
interface RunResult {
  items_fetched: number;
  items_processed: number;
  rules_rejected: number;
  review: number;
  draft_approved: number;
  errors: number;
  dry_run: boolean;
}

interface EnrichResult {
  enriched: number;
  errors: number;
}

interface ScoreResult {
  scored: number;
  draft_approved: number;
  review: number;
  rejected: number;
  errors: number;
}

export const IntakeTab = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"dry" | "live" | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [enrichDialogOpen, setEnrichDialogOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  /* ── pipeline flags (display only, guards are server-side) ── */
  const pipelineEnabled = envFlag("VITE_INTAKE_V1_ENABLED");
  const killSwitch = envFlag("VITE_INTAKE_KILL_SWITCH");
  const allowedSources = envStr("VITE_INTAKE_ALLOWED_SOURCES");
  const batchLimit = envStr("VITE_INTAKE_MAX_ITEMS_PER_RUN");

  /* ── run logs ── */
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["intake-run-logs", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_run_logs" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  /* ── queue counts ── */
  const { data: queueCounts, isLoading: queueLoading } = useQuery({
    queryKey: ["intake-queue-counts", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_normalized_products" as any)
        .select("current_queue_state");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as any[]) {
        const s = row.current_queue_state ?? "unknown";
        counts[s] = (counts[s] || 0) + 1;
      }
      return counts;
    },
  });

  const handleRefresh = () => setRefreshKey((k) => k + 1);
  const totalQueue = queueCounts ? Object.values(queueCounts).reduce((a, b) => a + b, 0) : 0;

  /* ── Trigger run ── */
  const handleTrigger = () => {
    setRunResult(null);
    setRunError(null);
    setConfirmMode(null);
    setDialogOpen(true);
  };

  const handleSelectMode = (mode: "dry" | "live") => {
    setConfirmMode(mode);
  };

  const handleConfirmRun = async () => {
    if (!confirmMode) return;
    setIsRunning(true);
    setRunError(null);
    setRunResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("intake-fetch-test", {
        body: { source: "ebay", dry_run: confirmMode === "dry" },
      });

      if (error) {
        setRunError(error.message || "Unknown error calling intake-fetch-test");
        return;
      }

      if (data?.error) {
        setRunError(data.error);
        return;
      }

      setRunResult({
        items_fetched: data.items_fetched ?? 0,
        items_processed: data.items_processed ?? 0,
        rules_rejected: data.rules_rejected ?? 0,
        review: data.review ?? 0,
        draft_approved: data.draft_approved ?? 0,
        errors: data.errors ?? 0,
        dry_run: data.dry_run ?? false,
      });

      // Auto-refresh tables
      handleRefresh();
    } catch (e: any) {
      setRunError(e.message || "Unexpected error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCloseDialog = () => {
    if (!isRunning) {
      setDialogOpen(false);
      setConfirmMode(null);
      setRunResult(null);
      setRunError(null);
    }
  };

  /* ── Enrich handlers ── */
  const handleEnrichOpen = () => {
    setEnrichResult(null);
    setEnrichError(null);
    setEnrichDialogOpen(true);
  };

  const handleConfirmEnrich = async () => {
    setIsEnriching(true);
    setEnrichError(null);
    setEnrichResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("intake-enrich-test");
      if (error) {
        setEnrichError(error.message || "Unknown error calling intake-enrich-test");
        return;
      }
      if (data?.error) {
        setEnrichError(data.error);
        return;
      }
      setEnrichResult({
        enriched: data.items_processed ?? 0,
        errors: data.error_count ?? 0,
      });
      handleRefresh();
    } catch (e: any) {
      setEnrichError(e.message || "Unexpected error");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleCloseEnrichDialog = () => {
    if (!isEnriching) {
      setEnrichDialogOpen(false);
      setEnrichResult(null);
      setEnrichError(null);
    }
  };

  /* ── Score handlers ── */
  const handleScoreOpen = () => {
    setScoreResult(null);
    setScoreError(null);
    setScoreDialogOpen(true);
  };

  const handleConfirmScore = async () => {
    setIsScoring(true);
    setScoreError(null);
    setScoreResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("intake-score-test");
      if (error) {
        setScoreError(error.message || "Unknown error calling intake-score-test");
        return;
      }
      if (data?.error) {
        setScoreError(data.error);
        return;
      }
      setScoreResult({
        scored: data.items_processed ?? 0,
        draft_approved: data.draft_approved_count ?? 0,
        review: data.review_count ?? 0,
        rejected: data.rules_rejected_count ?? 0,
        errors: data.error_count ?? 0,
      });
      handleRefresh();
    } catch (e: any) {
      setScoreError(e.message || "Unexpected error");
    } finally {
      setIsScoring(false);
    }
  };

  const handleCloseScoreDialog = () => {
    if (!isScoring) {
      setScoreDialogOpen(false);
      setScoreResult(null);
      setScoreError(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Permanent warning banner */}
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 w-full">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-900">Test environment — does not affect the live site</p>
          <p className="text-sm text-amber-800 mt-0.5">
            This intake pipeline runs in isolation. No data here is published, unpublished, or written to the products table. All results are stored in intake_* tables only.
          </p>
        </div>
      </div>

      {/* SECTION 1: Pipeline status row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-heading font-semibold text-foreground">Intake pipeline v1</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTrigger}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Trigger test run
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrichOpen}
              className="gap-1.5"
            >
              {isEnriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Run enrichment
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScoreOpen}
              className="gap-1.5"
            >
              {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Run scoring
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusCard
            label="Pipeline"
            value={pipelineEnabled === null ? "Not set" : pipelineEnabled ? "Enabled" : "Disabled"}
            color={pipelineEnabled ? "green" : "amber"}
          />
          <StatusCard
            label="Kill switch"
            value={killSwitch === null ? "Not set" : killSwitch ? "Active" : "Off"}
            color={killSwitch ? "red" : "green"}
          />
          <StatusCard
            label="Sources"
            value={allowedSources || "None"}
            color={allowedSources ? "green" : "muted"}
          />
          <StatusCard
            label="Batch limit"
            value={batchLimit || "—"}
            color={batchLimit ? "green" : "muted"}
          />
        </div>
      </div>

      {/* SECTION 2: Run log table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-heading font-semibold text-foreground">Recent runs</h3>
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {runsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded-sm animate-pulse" />
            ))}
          </div>
        ) : !runs || runs.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-md p-6 text-center">
            No runs yet. Pipeline has not been triggered.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Started</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Source</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Fetched</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Processed</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Rejected</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Review</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Approved</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Errors</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r: any) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.started_at)}</td>
                    <td className="px-3 py-2">{r.source ?? "—"}</td>
                    <td className="px-3 py-2">{r.run_type ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${runStatusStyle(r.status)}`}>
                        {r.status ?? "unknown"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.items_fetched ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.items_processed ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.rules_rejected_count ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.review_count ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.draft_approved_count ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.error_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Queue summary */}
      <div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-3">Queue summary</h3>
        {queueLoading ? (
          <div className="h-8 w-64 bg-muted rounded-sm animate-pulse" />
        ) : totalQueue === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-md p-4 text-center">
            Queue is empty.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {QUEUE_STATES.map((state) => {
              const count = queueCounts?.[state] ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={state}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${queueColor(state)}`}
                >
                  {state.replace(/_/g, " ")}
                  <span className="font-bold">{count}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4: Review queue */}
      <IntakeReviewQueue refreshKey={refreshKey} />

      {/* SECTION 5: Brand tiers */}
      <BrandTiersSection />

      {/* ── Trigger test run dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trigger test run</DialogTitle>
            <DialogDescription>
              Fetch items from eBay into the isolated test pipeline.
            </DialogDescription>
          </DialogHeader>

          {/* Loading state */}
          {isRunning && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Running {confirmMode === "dry" ? "dry" : "live"} fetch…
              </p>
            </div>
          )}

          {/* Result state */}
          {!isRunning && runResult && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold text-sm">
                  {runResult.dry_run ? "Dry run completed" : "Live run completed"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Items fetched</p>
                  <p className="font-semibold tabular-nums">{runResult.items_fetched}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Passed rules</p>
                  <p className="font-semibold tabular-nums text-emerald-700">
                    {runResult.items_processed - runResult.rules_rejected}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Rejected</p>
                  <p className="font-semibold tabular-nums text-red-700">{runResult.rules_rejected}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Soft flags</p>
                  <p className="font-semibold tabular-nums text-amber-700">{runResult.review}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseDialog}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Error state */}
          {!isRunning && runError && (
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-2 text-red-700">
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Run failed</p>
                  <p className="text-sm mt-1">{runError}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseDialog}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Selection / confirmation state */}
          {!isRunning && !runResult && !runError && (
            <>
              {confirmMode === null ? (
                <div className="space-y-2 py-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3 px-4"
                    onClick={() => handleSelectMode("dry")}
                  >
                    <FlaskConical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Dry run (no writes)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fetch and evaluate items without saving to database
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3 px-4"
                    onClick={() => handleSelectMode("live")}
                  >
                    <Zap className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Live run (writes to intake tables)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fetch, evaluate, and store results in intake_* tables
                      </p>
                    </div>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm text-amber-900">
                      This will fetch up to {batchLimit || "10"} items from eBay into the test pipeline. No live data will be affected.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Mode: <span className="font-medium text-foreground">
                      {confirmMode === "dry" ? "Dry run (no writes)" : "Live run (writes to intake tables)"}
                    </span>
                  </p>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmMode(null)}>
                      Back
                    </Button>
                    <Button size="sm" onClick={handleConfirmRun}>
                      Confirm & run
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Enrich dialog ── */}
      <Dialog open={enrichDialogOpen} onOpenChange={handleCloseEnrichDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run AI enrichment</DialogTitle>
            <DialogDescription>
              This will enrich all normalized products in the queue using Claude. Results are stored in intake_* tables only. No live data will be affected.
            </DialogDescription>
          </DialogHeader>

          {isEnriching && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Running enrichment…</p>
            </div>
          )}

          {!isEnriching && enrichResult && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold text-sm">Enrichment completed</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Enriched</p>
                  <p className="font-semibold tabular-nums">{enrichResult.enriched}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Errors</p>
                  <p className="font-semibold tabular-nums text-red-700">{enrichResult.errors}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseEnrichDialog}>Close</Button>
              </DialogFooter>
            </div>
          )}

          {!isEnriching && enrichError && (
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-2 text-red-700">
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Enrichment failed</p>
                  <p className="text-sm mt-1">{enrichError}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseEnrichDialog}>Close</Button>
              </DialogFooter>
            </div>
          )}

          {!isEnriching && !enrichResult && !enrichError && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" size="sm" onClick={handleCloseEnrichDialog}>Cancel</Button>
              <Button size="sm" onClick={handleConfirmEnrich}>Run enrichment</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Score dialog ── */}
      <Dialog open={scoreDialogOpen} onOpenChange={handleCloseScoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run scoring</DialogTitle>
            <DialogDescription>
              This will score all enriched products in the queue using Claude. Results are stored in intake_* tables only. No live data will be affected.
            </DialogDescription>
          </DialogHeader>

          {isScoring && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Scoring enriched products…</p>
            </div>
          )}

          {!isScoring && scoreResult && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold text-sm">Scoring completed</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Scored</p>
                  <p className="font-semibold tabular-nums">{scoreResult.scored}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Draft approved</p>
                  <p className="font-semibold tabular-nums text-emerald-700">{scoreResult.draft_approved}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Review</p>
                  <p className="font-semibold tabular-nums text-amber-700">{scoreResult.review}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Rejected</p>
                  <p className="font-semibold tabular-nums text-red-700">{scoreResult.rejected}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Errors</p>
                  <p className="font-semibold tabular-nums text-red-700">{scoreResult.errors}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseScoreDialog}>Close</Button>
              </DialogFooter>
            </div>
          )}

          {!isScoring && scoreError && (
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-2 text-red-700">
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Scoring failed</p>
                  <p className="text-sm mt-1">{scoreError}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseScoreDialog}>Close</Button>
              </DialogFooter>
            </div>
          )}

          {!isScoring && !scoreResult && !scoreError && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" size="sm" onClick={handleCloseScoreDialog}>Cancel</Button>
              <Button size="sm" onClick={handleConfirmScore}>Run scoring</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
