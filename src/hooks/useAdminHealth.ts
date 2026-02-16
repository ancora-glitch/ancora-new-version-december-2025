import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CronStatus {
  lastRun: string | null;
  status: string;
  duration_ms?: number;
  items_processed?: number;
  checked_count?: number;
  sold_marked?: number;
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
