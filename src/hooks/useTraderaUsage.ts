import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TraderaUsage {
  current_count: number;
  daily_limit: number;
  remaining: number;
  limit_reached: boolean;
}

export function useTraderaUsage() {
  return useQuery({
    queryKey: ["tradera-usage"],
    queryFn: async (): Promise<TraderaUsage> => {
      const { data, error } = await supabase.functions.invoke("tradera-search", {
        body: { checkUsageOnly: true },
      });

      if (error) {
        console.error("Failed to check Tradera usage:", error);
        // Return safe defaults on error
        return {
          current_count: 0,
          daily_limit: 75,
          remaining: 75,
          limit_reached: false,
        };
      }

      return data.usage as TraderaUsage;
    },
    staleTime: 30_000, // Cache for 30 seconds
    refetchInterval: 60_000, // Refetch every minute
  });
}
