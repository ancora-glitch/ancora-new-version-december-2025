import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ── env helpers (VITE_ prefix required for client access) ── */
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

export const IntakeTab = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── pipeline flags ── */
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
        <h2 className="text-xl font-heading font-semibold text-foreground mb-3">Intake pipeline v1</h2>
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
    </div>
  );
};
