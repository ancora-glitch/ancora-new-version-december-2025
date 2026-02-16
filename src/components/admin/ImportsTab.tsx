import { useState, useEffect } from "react";
import { ImportItemsList } from "./ImportItemsList";
import { ImportItemDetail } from "./ImportItemDetail";
import { NewImportDialog } from "./NewImportDialog";
import { EbaySearchDrawer } from "./EbaySearchDrawer";
import { TraderaSearchDrawer } from "./TraderaSearchDrawer";
import { RetryJobsPanel } from "./RetryJobsPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Zap, RotateCcw, RefreshCw, CheckCircle2, XCircle, Clock, Languages, Loader2, Wand2 } from "lucide-react";
import { useTraderaUsage } from "@/hooks/useTraderaUsage";
import { usePendingRetryCount } from "@/hooks/useRetryJobs";
import { Progress } from "@/components/ui/progress";
import { useAdminHealth, CronStatus } from "@/hooks/useAdminHealth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function cronStatusLabel(run: CronStatus): { label: string; color: string; icon: 'ok' | 'warn' | 'error' } {
  if (!run.lastRun) return { label: 'Never', color: 'text-amber-500', icon: 'warn' };
  if (run.status === 'error') return { label: 'Action needed', color: 'text-destructive', icon: 'error' };
  const minutesAgo = (Date.now() - new Date(run.lastRun).getTime()) / 60000;
  if (minutesAgo > 45) return { label: 'Stale', color: 'text-amber-500', icon: 'warn' };
  return { label: 'Healthy', color: 'text-green-600', icon: 'ok' };
}

function retryCountColor(count: number): string {
  if (count > 25) return 'text-destructive';
  if (count > 10) return 'text-amber-600';
  return 'text-muted-foreground';
}

export function ImportsTab() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEbayDrawer, setShowEbayDrawer] = useState(false);
  const [showTraderaDrawer, setShowTraderaDrawer] = useState(false);
  
  const { data: usage, isLoading: usageLoading } = useTraderaUsage();
  const { data: pendingCount } = usePendingRetryCount();
  const { data: health, isLoading: healthLoading, error: healthError, check: runHealthCheck } = useAdminHealth();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isBackfillingFields, setIsBackfillingFields] = useState(false);

  useEffect(() => { runHealthCheck(); }, [runHealthCheck]);

  const handleBackfillTranslations = async () => {
    setIsBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-backfill');
      if (error) {
        toast.error('Backfill failed: ' + error.message);
      } else {
        const parts = [`Translated ${data.translated}`];
        if (data.skipped_already_english > 0) parts.push(`${data.skipped_already_english} already EN`);
        if (data.skipped_budget > 0) parts.push(`${data.skipped_budget} budget-skipped`);
        if (data.failed > 0) parts.push(`${data.failed} failed`);
        toast.success(parts.join(', '));
        runHealthCheck(); // Refresh counts
      }
    } catch (e: any) {
      toast.error('Backfill error: ' + e.message);
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleBackfillFields = async () => {
    setIsBackfillingFields(true);
    try {
      const { data, error } = await supabase.functions.invoke('ais-backfill-parsed-fields');
      if (error) {
        toast.error('Field backfill failed: ' + error.message);
      } else {
        const parts = [`Updated ${data.updated}/${data.processed}`];
        if (data.skipped_no_text > 0) parts.push(`${data.skipped_no_text} no text`);
        if (data.errors > 0) parts.push(`${data.errors} errors`);
        toast.success('Field backfill: ' + parts.join(', '));
      }
    } catch (e: any) {
      toast.error('Backfill error: ' + e.message);
    } finally {
      setIsBackfillingFields(false);
    }
  };

  const handleCreated = (id: string) => {
    setSelectedItemId(id);
  };

  const isLowQuota = usage && usage.remaining <= 15;
  const isCriticalQuota = usage && usage.remaining <= 5;
  const usagePercent = usage ? (usage.current_count / usage.daily_limit) * 100 : 0;

  const hasAnyError = health?.cron && Object.values(health.cron).some(r => r.status === 'error');

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
            <Button
              variant="outline"
              onClick={handleBackfillFields}
              disabled={isBackfillingFields}
            >
              {isBackfillingFields ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              Backfill fields (200)
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
        {health?.cron && (
          <TooltipProvider>
            <div className="flex items-center gap-3 p-2.5 rounded-sm border border-border bg-muted/20 text-xs mt-2 flex-wrap">
              <span className="text-muted-foreground font-medium">Cron status:</span>
              {hasAnyError && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Action needed</Badge>
              )}
              {!!pendingCount && pendingCount > 0 && (
                <span className={`font-medium ${retryCountColor(pendingCount)}`}>
                  Retry pending: {pendingCount}
                </span>
              )}
              {([
                { key: "tradera_sync", label: "Tradera sync" },
                { key: "tradera_retry_import", label: "Retry import" },
                { key: "ebay_availability", label: "eBay availability" },
              ] as const).map(({ key, label }) => {
                const run = health.cron![key];
                if (!run) return null;
                const st = cronStatusLabel(run);
                const lastRun = run.lastRun ? new Date(run.lastRun) : null;
                const timeStr = lastRun
                  ? lastRun.toLocaleString("sv-SE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "never";

                const tooltipLines: string[] = [];
                tooltipLines.push(`Status: ${st.label}`);
                if (lastRun) {
                  const minutesAgo = Math.round((Date.now() - lastRun.getTime()) / 60000);
                  tooltipLines.push(`Last run: ${lastRun.toLocaleString("sv-SE")} (${minutesAgo}min ago)`);
                }
                tooltipLines.push(`Duration: ${run.duration_ms ?? 0}ms`);
                tooltipLines.push(`Items: ${run.items_processed ?? 0}`);
                if ((run.sold_marked ?? 0) > 0) tooltipLines.push(`Sold/completed: ${run.sold_marked}`);
                if (run.error_message) tooltipLines.push(`Error: ${run.error_message}`);
                if (run.lastSuccess) {
                  tooltipLines.push(`Last success: ${new Date(run.lastSuccess).toLocaleString("sv-SE")}`);
                }

                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-default">
                        {label}: <span className="tabular-nums">{timeStr}</span>
                        {st.icon === 'error' ? (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        ) : st.icon === 'warn' ? (
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        )}
                        <span className={`text-[10px] ${st.color}`}>{st.label}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-0.5 text-xs">
                        {tooltipLines.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Translation Status */}
        {health?.translation && (
          <TooltipProvider>
            <div className="flex items-center gap-3 p-2.5 rounded-sm border border-border bg-muted/20 text-xs mt-2 flex-wrap">
              <span className="text-muted-foreground font-medium">Translation:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-default">
                    {health.translation.enabled ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                    {health.translation.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-0.5 text-xs">
                    <p>Status: {health.translation.enabled ? 'Active' : 'Disabled'}</p>
                    {health.translation.last_error && <p>Error: {health.translation.last_error}</p>}
                    <p>Untranslated Tradera products: {health.translation.untranslated_count}</p>
                    {health.translation.failure_count_24h > 0 && (
                      <p className="text-destructive">Missing translations (sv): {health.translation.failure_count_24h}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
              {health.translation.untranslated_count > 0 && (
                <span className="text-amber-600 font-medium">
                  {health.translation.untranslated_count} untranslated
                </span>
              )}
              {/* Budget display */}
              {health.translation.budget && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`inline-flex items-center gap-1 cursor-default font-medium ${
                      health.translation.budget.limit_reached
                        ? 'text-destructive'
                        : health.translation.budget.items_used / health.translation.budget.items_max > 0.8
                          ? 'text-amber-600'
                          : 'text-muted-foreground'
                    }`}>
                      Budget: {health.translation.budget.items_used}/{health.translation.budget.items_max}
                      {health.translation.budget.limit_reached && (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-0.5 text-xs">
                      <p>Items today: {health.translation.budget.items_used} / {health.translation.budget.items_max}</p>
                      <p>Chars today: {Math.round(health.translation.budget.chars_used / 1000)}k / {Math.round(health.translation.budget.chars_max / 1000)}k</p>
                      {health.translation.budget.limit_reached && <p className="text-destructive font-medium">Daily limit reached — translations use fallback</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 ml-auto text-xs"
                onClick={handleBackfillTranslations}
                disabled={isBackfilling || health.translation.untranslated_count === 0}
              >
                {isBackfilling ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Languages className="w-3 h-3 mr-1" />
                )}
                Translate batch (20)
              </Button>
            </div>
          </TooltipProvider>
        )}
        {!usageLoading && usage && (
          <div className={`flex items-center gap-4 p-3 rounded-sm border mt-2 ${
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
        <div>
          <h3 className="font-medium text-primary mb-4">Candidates</h3>
          <ImportItemsList
            onSelectItem={setSelectedItemId}
            selectedItemId={selectedItemId}
          />
        </div>
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

      <NewImportDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleCreated}
      />
      <EbaySearchDrawer
        open={showEbayDrawer}
        onOpenChange={setShowEbayDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <TraderaSearchDrawer
        open={showTraderaDrawer}
        onOpenChange={setShowTraderaDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <RetryJobsPanel />
    </div>
  );
}
