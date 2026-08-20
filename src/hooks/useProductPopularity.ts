import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProductPopularity = (rollingDays: number = 30) => {
  return useQuery({
    queryKey: ["product-popularity", rollingDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_popularity", {
        rolling_days: rollingDays,
      });
      if (error) throw error;

      const map = new Map<string, number>();
      (data ?? []).forEach((row: { product_id: string; click_count: number }) => {
        map.set(row.product_id, Number(row.click_count) || 0);
      });
      return map;
    },
    staleTime: 5 * 60 * 1000, // 5 min — klickpopularitet behöver inte vara sekundfärsk
  });
};
