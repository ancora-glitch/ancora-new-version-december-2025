import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;

// NOTE: Historically, "active" is the public/visible status in the database.
// We also temporarily support legacy "published" values to avoid breaking older rows.
export type ProductStatus = "draft" | "active" | "sold" | "published" | "pending_import" | "review_required";

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
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });
};

// Public hook - fetches products marked for "This Week's Edit" (homepage display)
export const useWeeklyEditProducts = () => {
  return useQuery({
    queryKey: ["products-weekly-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("status", PUBLIC_VISIBLE_PRODUCT_STATUSES)
        .eq("in_weekly_edit", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Product[];
    },
  });
};

// Hook for admin - fetches all products EXCEPT sold (which have their own archive)
// Sorts pending_import first, then drafts, then by sort_order
export const useAllProducts = () => {
  return useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .not("status", "in", '("sold")')
        .order("sort_order", { ascending: true });

      if (error) throw error;
      
      // Sort pending_import first, then drafts, then by sort_order
      const products = data as Product[];
      return products.sort((a, b) => {
        // Pending imports come first (need attention)
        if (a.status === "pending_import" && b.status !== "pending_import") return -1;
        if (a.status !== "pending_import" && b.status === "pending_import") return 1;
        // Then drafts
        if (a.status === "draft" && b.status !== "draft") return -1;
        if (a.status !== "draft" && b.status === "draft") return 1;
        // Then by sort_order for everything else
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    },
  });
};

// Hook for admin - fetches only sold products for the archive view
export const useSoldProducts = () => {
  return useQuery({
    queryKey: ["products-sold"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("status", "sold")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });
};

export const formatPrice = (price: string | number): string => {
  // Price is now stored as text, return as-is
  return String(price);
};
