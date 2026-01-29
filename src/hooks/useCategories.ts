import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;

export type CategoryStatus = "draft" | "published";

// Public hook - only fetches published categories
export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("status", "published")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
  });
};

// Admin hook - fetches all categories regardless of status
export const useAllCategories = () => {
  return useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
  });
};
