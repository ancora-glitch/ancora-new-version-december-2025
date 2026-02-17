import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type WeeklyEdit = Tables<"weekly_edits">;
export type WeeklyEditProduct = Tables<"weekly_edit_products">;
export type WeeklyEditStatus = "draft" | "scheduled" | "published";

export interface ThreeWayToWear {
  title: string;
  description: string;
}

// Admin: fetch all weekly edits
export const useAllWeeklyEdits = () => {
  return useQuery({
    queryKey: ["weekly-edits-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_edits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WeeklyEdit[];
    },
  });
};

// Admin: fetch products for a specific weekly edit
export const useWeeklyEditProductIds = (weeklyEditId: string | null) => {
  return useQuery({
    queryKey: ["weekly-edit-products", weeklyEditId],
    enabled: !!weeklyEditId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_edit_products")
        .select("*, products(*)")
        .eq("weekly_edit_id", weeklyEditId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

// Public: fetch the active published weekly edit with its products
export const useActiveWeeklyEdit = () => {
  return useQuery({
    queryKey: ["weekly-edit-active"],
    queryFn: async () => {
      // Get the most recent published edit
      const { data: edit, error: editError } = await supabase
        .from("weekly_edits")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (editError) throw editError;
      if (!edit) return null;

      // Get its products
      const { data: editProducts, error: prodError } = await supabase
        .from("weekly_edit_products")
        .select("sort_order, products(*)")
        .eq("weekly_edit_id", edit.id)
        .order("sort_order", { ascending: true });

      if (prodError) throw prodError;

      const products = editProducts
        ?.map((ep: any) => ep.products)
        .filter(Boolean)
        // Only show publicly visible products
        .filter((p: any) => p.status === "active" || p.status === "published");

      return { ...edit, products };
    },
  });
};

// Save (create or update) a weekly edit
export const useSaveWeeklyEdit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      productIds,
    }: {
      id?: string;
      data: Omit<TablesInsert<"weekly_edits">, "id">;
      productIds: string[];
    }) => {
      let editId = id;

      if (editId) {
        const { error } = await supabase
          .from("weekly_edits")
          .update(data as TablesUpdate<"weekly_edits">)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("weekly_edits")
          .insert([data as TablesInsert<"weekly_edits">])
          .select()
          .single();
        if (error) throw error;
        editId = inserted.id;
      }

      // Replace all product associations
      await supabase
        .from("weekly_edit_products")
        .delete()
        .eq("weekly_edit_id", editId!);

      if (productIds.length > 0) {
        const rows = productIds.map((pid, i) => ({
          weekly_edit_id: editId!,
          product_id: pid,
          sort_order: i,
        }));
        const { error: insertError } = await supabase
          .from("weekly_edit_products")
          .insert(rows);
        if (insertError) throw insertError;
      }

      return editId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-edits-all"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-active"] });
    },
  });
};

export const useDeleteWeeklyEdit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete junction rows first
      await supabase.from("weekly_edit_products").delete().eq("weekly_edit_id", id);
      const { error } = await supabase.from("weekly_edits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-edits-all"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-active"] });
    },
  });
};
