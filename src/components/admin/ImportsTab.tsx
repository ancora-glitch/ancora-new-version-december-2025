import { useState, useEffect } from "react";
import { ImportItemsList } from "./ImportItemsList";
import { ImportItemDetail } from "./ImportItemDetail";
import { NewImportDialog } from "./NewImportDialog";
import { EbaySearchDrawer } from "./EbaySearchDrawer";
import { TraderaSearchDrawer } from "./TraderaSearchDrawer";
import { RetryJobsPanel } from "./RetryJobsPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Zap, RotateCcw, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useTraderaUsage } from "@/hooks/useTraderaUsage";
import { usePendingRetryCount } from "@/hooks/useRetryJobs";
import { Progress } from "@/components/ui/progress";
import { useAdminHealth } from "@/hooks/useAdminHealth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ImportsTab() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEbayDrawer, setShowEbayDrawer] = useState(false);
  const [showTraderaDrawer, setShowTraderaDrawer] = useState(false);
  
  const { data: usage, isLoading: usageLoading } = useTraderaUsage();
  const { data: pendingCount } = usePendingRetryCount();
  const { data: health, isLoading: healthLoading, error: healthError, check: runHealthCheck } = useAdminHealth();

  useEffect(() => { runHealthCheck(); }, [runHealthCheck]);

  const handleCreated = (id: string) => {
    setSelectedItemId(id);
  };

  // Quota thresholds
  const isLowQuota = usage && usage.remaining <= 15;
  const isCriticalQuota = usage && usage.remaining <= 5;
  const usagePercent = usage ? (usage.current_count / usage.daily_limit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="p-6 border border-border rounded-sm bg-card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-lg text-primary mb-1">Ancora Import Spec</h2>
            {!!pendingCount && pendingCount > 0 && (
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Tradera retries: {pendingCount} pending
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Review and curate import candidates before promoting them to products. 
              This is an internal, editorial layer — nothing is auto-published.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTraderaDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Tradera
            </Button>
            <Button variant="outline" onClick={() => setShowEbayDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search eBay
            </Button>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Import
            </Button>
          </div>
        </div>

        {/* Edge Health Status */}
        <TooltipProvider>
          <div className="flex items-center gap-3 p-2.5 rounded-sm border border-border bg-muted/20 text-xs">
            <span className="text-muted-foreground font-medium">Edge status:</span>
            {healthLoading ? (
              <span className="text-muted-foreground">Checking…</span>
            ) : healthError ? (
              <span className="text-destructive">Check failed</span>
            ) : health ? (
              <>
                {(["db", "secrets", "retryQueue"] as const).map((key) => {
                  const label = key === "db" ? "DB" : key === "secrets" ? "Secrets" : "Retry Queue";
                  const ok = health.checks[key];
                  const errMsg = health.errors?.[key];
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-default">
                          {label}
                          {ok ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          )}
                        </span>
                      </TooltipTrigger>
                      {errMsg && (
                        <TooltipContent side="bottom">
                          <p>{errMsg}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
                {health.version && (
                  <span className="text-muted-foreground/60 ml-1 tabular-nums">
                    v {new Date(health.version).toLocaleString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 ml-auto text-xs"
              onClick={runHealthCheck}
              disabled={healthLoading}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${healthLoading ? "animate-spin" : ""}`} />
              Re-check
            </Button>
          </div>
        </TooltipProvider>

        {/* Cron Status */}
        {health?.cron && (() => {
          const hasError = Object.values(health.cron!).some(r => r.status === "error");
          return (
            <TooltipProvider>
              <div className="flex items-center gap-3 p-2.5 rounded-sm border border-border bg-muted/20 text-xs mt-2 flex-wrap">
                <span className="text-muted-foreground font-medium">Cron status:</span>
                {hasError && (
                  <span className="text-destructive font-medium">Action needed</span>
                )}
                {!!pendingCount && pendingCount > 0 && (
                  <span className="text-amber-600 font-medium">Retry pending: {pendingCount}</span>
                )}
                {([
                  { key: "tradera_sync", label: "Tradera sync" },
                  { key: "tradera_retry_import", label: "Retry import" },
                  { key: "ebay_availability", label: "eBay availability" },
                ] as const).map(({ key, label }) => {
                  const run = health.cron![key];
                  if (!run) return null;
                  const lastRun = run.lastRun ? new Date(run.lastRun) : null;
                  const minutesAgo = lastRun ? (Date.now() - lastRun.getTime()) / 60000 : Infinity;
                  const isStale = minutesAgo > 45;
                  const isError = run.status === "error";
                  const isNever = !lastRun;
                  const timeStr = lastRun
                    ? lastRun.toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                    : "never";

                  const tooltipLines = [
                    isError ? "Last run failed" : isNever ? "No runs recorded yet" : isStale ? `Last run ${Math.round(minutesAgo)}min ago (>45min)` : `Last run ${Math.round(minutesAgo)}min ago`,
                    run.duration_ms != null ? `Duration: ${run.duration_ms}ms` : null,
                    run.items_processed != null ? `Items: ${run.items_processed}` : null,
                    run.sold_marked != null && run.sold_marked > 0 ? `Sold/completed: ${run.sold_marked}` : null,
                  ].filter(Boolean).join(" · ");

                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-default">
                          {label}: <span className="tabular-nums">{timeStr}</span>
                          {isError ? (
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          ) : isNever || isStale ? (
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{tooltipLines}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          );
        })()}


        {!usageLoading && usage && (
          <div className={`flex items-center gap-4 p-3 rounded-sm border ${
            isCriticalQuota 
              ? "bg-destructive/10 border-destructive/30" 
              : isLowQuota 
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-muted/30 border-border"
          }`}>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isCriticalQuota ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : isLowQuota ? (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              ) : (
                <Zap className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={`text-sm font-medium ${
                isCriticalQuota 
                  ? "text-destructive" 
                  : isLowQuota 
                    ? "text-amber-600"
                    : "text-foreground"
              }`}>
                Tradera quota: {usage.remaining} / {usage.daily_limit} remaining
              </span>
            </div>
            
            <div className="flex-1 max-w-[200px]">
              <Progress 
                value={usagePercent} 
                className={`h-1.5 ${
                  isCriticalQuota 
                    ? "[&>div]:bg-destructive" 
                    : isLowQuota 
                      ? "[&>div]:bg-amber-500"
                      : ""
                }`}
              />
            </div>

            {isLowQuota && (
              <span className={`text-xs ${
                isCriticalQuota ? "text-destructive" : "text-amber-600"
              }`}>
                {isCriticalQuota 
                  ? "Critical — prioritize high-quality imports" 
                  : "Low quota — import selectively"
                }
              </span>
            )}
          </div>
        )}
      </div>

      {/* Two-column layout on larger screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* List */}
        <div>
          <h3 className="font-medium text-primary mb-4">Candidates</h3>
          <ImportItemsList
            onSelectItem={setSelectedItemId}
            selectedItemId={selectedItemId}
          />
        </div>

        {/* Detail */}
        <div>
          <h3 className="font-medium text-primary mb-4">
            {selectedItemId ? "Detail View" : "Select an Item"}
          </h3>
          <ImportItemDetail
            itemId={selectedItemId}
            onClose={() => setSelectedItemId(null)}
          />
        </div>
      </div>

      {/* New Import Dialog */}
      <NewImportDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleCreated}
      />

      {/* eBay Search Drawer */}
      <EbaySearchDrawer
        open={showEbayDrawer}
        onOpenChange={setShowEbayDrawer}
        onImported={() => setSelectedItemId(null)}
      />

      {/* Tradera Search Drawer */}
      <TraderaSearchDrawer
        open={showTraderaDrawer}
        onOpenChange={setShowTraderaDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      {/* Tradera Retry Queue (read-only) */}
      <RetryJobsPanel />
    </div>
  );
}
