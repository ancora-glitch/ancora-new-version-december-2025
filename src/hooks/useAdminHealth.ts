import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CronStatus {
  lastRun: string | null;
  status: string;
  duration_ms: number;
  items_processed: number;
  checked_count: number;
  sold_marked: number;
  error_message?: string | null;
  lastSuccess?: string | null;
  batch_size?: number | null;
  cursor_before?: number | null;
  cursor_after?: number | null;
}

export interface TranslationBudget {
  items_used: number;
  items_max: number;
  chars_used: number;
  chars_max: number;
  limit_reached: boolean;
}

export interface TranslationStatus {
  enabled: boolean;
  last_error: string | null;
  untranslated_count: number;
  failure_count_24h: number;
  budget: TranslationBudget;
}

export interface TraderaSyncCoverage {
  active_tradera_count: number;
  last_checked_count: number;
  last_finished_at: string | null;
  batch_size: number;
  coverage_estimate_hours: number | null;
}

export interface HealthResult {
  ok: boolean;
  checks: {
    db: boolean;
    secrets: boolean;
    retryQueue: boolean;
  };
  version?: string;
  cron?: Record<string, CronStatus>;
  translation?: TranslationStatus;
  tradera_sync_coverage?: TraderaSyncCoverage;
  errors?: Record<string, string>;
}

export function useAdminHealth() {
  const [data, setData] = useState<HealthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("admin-health");
      if (fnError) {
        setError(fnError.message || "Health check failed");
        setData(null);
      } else {
        setData(result as HealthResult);
      }
    } catch (e: any) {
      setError(e.message || "Network error");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, check };
}
