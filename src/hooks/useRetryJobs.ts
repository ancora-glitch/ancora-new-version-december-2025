import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RetryJob {
  id: string;
  source_ref: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  retry_after: string;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useRetryJobs() {
  return useQuery({
    queryKey: ["retry-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tradera_retry_jobs")
        .select("id, source_ref, status, attempt_count, max_attempts, retry_after, last_error, created_at, completed_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as RetryJob[];
    },
  });
}

export function usePendingRetryCount() {
  return useQuery({
    queryKey: ["retry-jobs-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tradera_retry_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "retrying"]);

      if (error) throw error;
      return count || 0;
    },
  });
}
