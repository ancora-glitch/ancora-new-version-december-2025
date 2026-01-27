import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;

// NOTE: Historically, "active" is the public/visible status in the database.
// We also temporarily support legacy "published" values to avoid breaking older rows.
export type ProductStatus = "draft" | "active" | "sold" | "published";

export const PUBLIC_VISIBLE_PRODUCT_STATUSES: Array<ProductStatus> = ["active", "published"];

// Public hook - only fetches products visible on the public site
export const useProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("status", PUBLIC_VISIBLE_PRODUCT_STATUSES)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Product[];
    },
  });
};

// Hook for admin - fetches all products regardless of status
export const useAllProducts = () => {
  return useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Product[];
    },
  });
};

export const formatPrice = (price: string | number): string => {
  // Price is now stored as text, return as-is
  return String(price);
};
