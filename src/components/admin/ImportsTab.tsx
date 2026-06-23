import { useState, useEffect, useRef } from "react";
import { ImportItemsList } from "./ImportItemsList";
import { ImportItemDetail } from "./ImportItemDetail";
import { NewImportDialog } from "./NewImportDialog";
import { EbaySearchDrawer } from "./EbaySearchDrawer";
import { TraderaSearchDrawer } from "./TraderaSearchDrawer";
import { VintageSphereSearchDrawer } from "./VintageSphereSearchDrawer";
import { WornVintageSearchDrawer } from "./WornVintageSearchDrawer";
import { SellpySearchDrawer } from "./SellpySearchDrawer";
import { PureEffectSearchDrawer } from "./PureEffectSearchDrawer";
import { ReDesignedBySearchDrawer } from "./ReDesignedBySearchDrawer";
import { RetryJobsPanel } from "./RetryJobsPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Zap, RotateCcw, RefreshCw, CheckCircle2, XCircle, Clock, Languages, Loader2, Wand2, X, Settings } from "lucide-react";
import { useTraderaUsage } from "@/hooks/useTraderaUsage";
import { usePendingRetryCount } from "@/hooks/useRetryJobs";
import { Progress } from "@/components/ui/progress";
import { useAdminHealth, CronStatus, TraderaSyncCoverage } from "@/hooks/useAdminHealth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function cronStatusLabel(run: CronStatus): { label: string; color: string; icon: 'ok' | 'warn' | 'error' } {
  if (!run.lastRun) return { label: 'Never', color: 'text-amber-500', icon: 'warn' };
  if (run.status === 'error') return { label: 'Action needed', color: 'text-destructive', icon: 'error' };
  const minutesAgo = (Date.now() - new Date(run.lastRun).getTime()) / 60000;
  if (minutesAgo > 150) return { label: 'Stale', color: 'text-amber-500', icon: 'warn' };
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
  const [showVintageSphereDrawer, setShowVintageSphereDrawer] = useState(false);
  const [showWornVintageDrawer, setShowWornVintageDrawer] = useState(false);
  const [showSellpyDrawer, setShowSellpyDrawer] = useState(false);
  const [showPureEffectDrawer, setShowPureEffectDrawer] = useState(false);
  const [showReDesignedByDrawer, setShowReDesignedByDrawer] = useState(false);
  
  const { data: usage, isLoading: usageLoading } = useTraderaUsage();
  const { data: pendingCount } = usePendingRetryCount();
  const { data: health, isLoading: healthLoading, error: healthError, check: runHealthCheck } = useAdminHealth();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isBackfillingFields, setIsBackfillingFields] = useState(false);
  const [isBackfillingCondMat, setIsBackfillingCondMat] = useState(false);
  const [isSyncingTradera, setIsSyncingTradera] = useState(false);
  const [isSettingUpCron, setIsSettingUpCron] = useState(false);

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

  const handleBackfillConditionMaterial = async (forceFresh = false) => {
    setIsBackfillingCondMat(true);
    try {
      const { data, error } = await supabase.functions.invoke('tradera-backfill-condition-material', { body: { forceFresh } });
      if (error) {
        toast.error('Tradera field backfill failed: ' + error.message);
      } else {
        console.info("[BackfillTraderaFields]", data);
        toast.success(
          `Backfill complete:\nProcessed: ${data.processed ?? 0}\nCondition: ${data.updated_condition ?? 0}\nMaterial: ${data.updated_material ?? 0}\nColor: ${data.updated_color ?? 0}\nBrand: ${data.updated_brand ?? 0}\nSkipped: ${data.skipped_already_set ?? 0}\nRate limited: ${data.rate_limited ?? 0}`
        );
      }
    } catch (e: any) {
      toast.error('Backfill error: ' + e.message);
    } finally {
      setIsBackfillingCondMat(false);
    }
  };

  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<number>(0);

  const handleSelectItem = (id: string | null) => {
    if (id) {
      // Save list scroll position before opening detail
      listScrollRef.current = window.scrollY;
      setSelectedItemId(id);
      // Auto-scroll to detail view
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      setSelectedItemId(null);
      // Restore list scroll position
      setTimeout(() => {
        window.scrollTo({ top: listScrollRef.current, behavior: "smooth" });
      }, 50);
    }
  };

  const handleCreated = (id: string) => {
    handleSelectItem(id);
  };
  const isLowQuota = usage && usage.remaining <= 15;
  const isCriticalQuota = usage && usage.remaining <= 5;
  const usagePercent = usage ? (usage.current_count / usage.daily_limit) * 100 : 0;

  const hasAnyError = health?.cron && Object.values(health.cron).some(r => r.status === 'error');

  return (
    <div className="space-y-6">
      {/* Header with action */}
      <div className="p-6 border border-border rounded-sm bg-card">
        <div className="mb-4 space-y-3">
          <h2 className="font-display text-lg text-primary">Ancora Import Spec</h2>
          {!!pendingCount && pendingCount > 0 && (
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Tradera retries: {pendingCount} pending
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-normal break-words">
            Search and import items from Tradera/eBay/VintageSphere/Pure Effect — they become draft Products directly.
            This log tracks import provenance and deduplication.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowTraderaDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Tradera
            </Button>
            <Button variant="outline" onClick={() => setShowEbayDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search eBay
            </Button>
            <Button variant="outline" onClick={() => setShowVintageSphereDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search VintageSphere
            </Button>
            <Button variant="outline" onClick={() => setShowWornVintageDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Worn Vintage
            </Button>
            <Button variant="outline" onClick={() => setShowSellpyDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Sellpy
            </Button>
            <Button variant="outline" onClick={() => setShowPureEffectDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search Pure Effect
            </Button>
            <Button variant="outline" onClick={() => setShowReDesignedByDrawer(true)}>
              <Search className="w-4 h-4 mr-2" />
              Search ReDesignedBy
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
            <Button
              variant="outline"
              onClick={() => handleBackfillConditionMaterial()}
              disabled={isBackfillingCondMat}
            >
              {isBackfillingCondMat ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              Backfill Tradera fields (cached)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBackfillConditionMaterial(true)}
              disabled={isBackfillingCondMat}
            >
              {isBackfillingCondMat ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Backfill Tradera fields (fresh)
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
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Batching ON (25/run · 2h)</Badge>
              {hasAnyError && (
                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Action needed</Badge>
              )}
              {!!pendingCount && pendingCount > 0 && (
                <span className={`font-medium ${retryCountColor(pendingCount)}`}>
                  Retry pending: {pendingCount}
                </span>
              )}
              {/* Cron registration status */}
              {health.cron_registered && Object.values(health.cron_registered).some(v => !v) && (
                <span className="text-destructive font-medium">❌ Cron not registered</span>
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
                if (run.batch_size) {
                  tooltipLines.push(`Batch: ${run.checked_count ?? 0}/${run.items_processed ?? 0} (max ${run.batch_size})`);
                  tooltipLines.push(`Cursor: ${run.cursor_before ?? '?'} → ${run.cursor_after ?? '?'}`);
                } else {
                  tooltipLines.push(`Items: ${run.items_processed ?? 0}`);
                }
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
              {/* Setup cron button - shown when all cron runs are "never" */}
              {health.cron && Object.values(health.cron).every(r => !r.lastRun) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 ml-auto text-xs"
                  onClick={async () => {
                    setIsSettingUpCron(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('cron-setup');
                      if (error) {
                        toast.error('Cron setup failed: ' + error.message);
                      } else {
                        toast.success('Cron jobs re-registered with vault auth. Next scheduled run should succeed.');
                        runHealthCheck();
                      }
                    } catch (e: any) {
                      toast.error('Cron setup error: ' + e.message);
                    } finally {
                      setIsSettingUpCron(false);
                    }
                  }}
                  disabled={isSettingUpCron}
                >
                  {isSettingUpCron ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Settings className="w-3 h-3 mr-1" />
                  )}
                  Fix cron auth
                </Button>
              )}
            </div>
          </TooltipProvider>
        )}

        {/* Tradera Sync Coverage */}
        {health?.tradera_sync_coverage && (() => {
          const cov = health.tradera_sync_coverage;
          const syncRun = health.cron?.tradera_sync;
          const lastRunDate = cov.last_finished_at ? new Date(cov.last_finished_at) : null;
          const minutesSinceRun = lastRunDate ? (Date.now() - lastRunDate.getTime()) / 60000 : Infinity;
          const isStale = minutesSinceRun > 180;
          const isZeroCoverage = cov.last_checked_count === 0 && cov.active_tradera_count > 0;
          const isError = syncRun?.status === 'error';
          const hasWarning = isStale || isZeroCoverage || isError;

          const handleRunSync = async () => {
            setIsSyncingTradera(true);
            try {
              const { data, error } = await supabase.functions.invoke('tradera-sync');
              if (error) {
                toast.error('Sync failed: ' + error.message);
              } else {
                const s = data?.summary;
                toast.success(
                  `Sync complete: ${s?.checked ?? 0} checked, ${s?.ended ?? 0} ended, ${s?.updated ?? 0} updated, ${s?.errors ?? 0} errors`
                );
                runHealthCheck();
              }
            } catch (e: any) {
              toast.error('Sync error: ' + e.message);
            } finally {
              setIsSyncingTradera(false);
            }
          };

          return (
            <div className={`flex items-center gap-3 p-2.5 rounded-sm border text-xs mt-2 flex-wrap ${
              hasWarning ? 'border-amber-400 bg-amber-50/50' : 'border-border bg-muted/20'
            }`}>
              <span className="text-muted-foreground font-medium">Tradera sync:</span>
              <span className="tabular-nums">
                {cov.active_tradera_count} active products
              </span>
              {cov.coverage_estimate_hours !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tabular-nums cursor-default">
                      Full cycle: ~{cov.coverage_estimate_hours}h
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{Math.ceil(cov.active_tradera_count / cov.batch_size)} batches × 2h schedule</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {lastRunDate && (
                <span className={`tabular-nums ${isStale ? 'text-amber-600 font-medium' : ''}`}>
                  Last: {Math.round(minutesSinceRun)}min ago
                  {isStale && ' ⚠ stale'}
                </span>
              )}
              {isZeroCoverage && (
                <span className="text-destructive font-medium">
                  ⚠ Zero coverage
                </span>
              )}
              {isError && syncRun?.error_message && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-destructive font-medium cursor-default">⚠ Error</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>{syncRun.error_message}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 ml-auto text-xs"
                onClick={handleRunSync}
                disabled={isSyncingTradera}
              >
                {isSyncingTradera ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Run sync now (25)
              </Button>
            </div>
          );
        })()}

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

      {/* Detail view above list when item selected */}
      {selectedItemId && (
        <div ref={detailRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-primary">Detail View</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectItem(null)}
            >
              <X className="w-4 h-4 mr-1" />
              Close detail
            </Button>
          </div>
          <ImportItemDetail
            itemId={selectedItemId}
            onClose={() => handleSelectItem(null)}
          />
        </div>
      )}

      {/* Candidates list */}
      <div ref={listRef}>
        <h3 className="font-medium text-primary mb-4">Import log</h3>
        <ImportItemsList
          onSelectItem={handleSelectItem}
          selectedItemId={selectedItemId}
        />
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
      <VintageSphereSearchDrawer
        open={showVintageSphereDrawer}
        onOpenChange={setShowVintageSphereDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <WornVintageSearchDrawer
        open={showWornVintageDrawer}
        onOpenChange={setShowWornVintageDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <SellpySearchDrawer
        open={showSellpyDrawer}
        onOpenChange={setShowSellpyDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <PureEffectSearchDrawer
        open={showPureEffectDrawer}
        onOpenChange={setShowPureEffectDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <ReDesignedBySearchDrawer
        open={showReDesignedByDrawer}
        onOpenChange={setShowReDesignedByDrawer}
        onImported={() => setSelectedItemId(null)}
      />
      <RetryJobsPanel />
    </div>
  );
}
