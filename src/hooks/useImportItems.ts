import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AisSourceType = "tradera" | "ebay" | "manual" | "csv" | "other";
export type AisCondition = "new" | "excellent" | "good" | "fair" | "unknown";
export type AisStatus = "draft" | "reviewed" | "promoted" | "discarded";

export interface AisSignals {
  keywords: string[];
  colors: string[];
  era: string | null;
  material: string[] | null;
  vibe: string[] | null;
}

export interface ImportItem {
  id: string;
  source_type: AisSourceType;
  source_ref: string;
  source_url: string | null;
  title: string;
  description: string | null;
  images: string[];
  price: number | null;
  currency: string | null;
  condition: AisCondition | null;
  provenance: string | null;
  signals: AisSignals;
  status: AisStatus;
  product_id: string | null;
  raw_payload: any | null;
  created_at: string;
  reviewed_at: string | null;
  promoted_at: string | null;
}

export interface ImportItemInsert {
  source_type: AisSourceType;
  source_ref: string;
  source_url?: string | null;
  title: string;
  description?: string | null;
  images?: string[];
  price?: number | null;
  currency?: string | null;
  condition?: AisCondition | null;
  provenance?: string | null;
  signals?: AisSignals;
  status?: AisStatus;
  raw_payload?: any | null;
}

export interface ImportItemUpdate {
  title?: string;
  description?: string | null;
  images?: string[];
  price?: number | null;
  currency?: string | null;
  condition?: AisCondition | null;
  provenance?: string | null;
  signals?: AisSignals;
  status?: AisStatus;
  product_id?: string | null;
  reviewed_at?: string | null;
  promoted_at?: string | null;
}

// Fetch all import items
export function useImportItems(filters?: {
  status?: AisStatus;
  source_type?: AisSourceType;
}) {
  return useQuery({
    queryKey: ["import-items", filters],
    queryFn: async () => {
      let query = supabase
        .from("ancora_import_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.source_type) {
        query = query.eq("source_type", filters.source_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Parse signals from jsonb and cast to ImportItem
      return (data || []).map((item) => {
        const rawSignals = item.signals as Record<string, unknown> | null;
        return {
          ...item,
          signals: {
            keywords: (rawSignals?.keywords as string[]) || [],
            colors: (rawSignals?.colors as string[]) || [],
            era: (rawSignals?.era as string | null) || null,
            material: (rawSignals?.material as string[] | null) || null,
            vibe: (rawSignals?.vibe as string[] | null) || null,
          },
        } as ImportItem;
      });
    },
  });
}

// Fetch single import item
export function useImportItem(id: string | null) {
  return useQuery({
    queryKey: ["import-item", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("ancora_import_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const rawSignals = data.signals as Record<string, unknown> | null;
      return {
        ...data,
        signals: {
          keywords: (rawSignals?.keywords as string[]) || [],
          colors: (rawSignals?.colors as string[]) || [],
          era: (rawSignals?.era as string | null) || null,
          material: (rawSignals?.material as string[] | null) || null,
          vibe: (rawSignals?.vibe as string[] | null) || null,
        },
      } as ImportItem;
    },
    enabled: !!id,
  });
}

// Update import item
export function useUpdateImportItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ImportItemUpdate }) => {
      // Prepare data for Supabase - handle signals separately
      const { signals, ...rest } = data;
      const updatePayload: Record<string, unknown> = { ...rest };
      if (signals !== undefined) {
        updatePayload.signals = signals;
      }
      
      const { error } = await supabase
        .from("ancora_import_items")
        .update(updatePayload as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
      queryClient.invalidateQueries({ queryKey: ["import-item"] });
    },
  });
}

// Mark as reviewed
export function useMarkReviewed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ancora_import_items")
        .update({
          status: "reviewed",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
      queryClient.invalidateQueries({ queryKey: ["import-item"] });
    },
  });
}

// Discard item
export function useDiscardItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ancora_import_items")
        .update({ status: "discarded" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
      queryClient.invalidateQueries({ queryKey: ["import-item"] });
    },
  });
}

// Revert to draft (undo reviewed/discarded)
export function useRevertToDraft() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ancora_import_items")
        .update({ 
          status: "draft",
          reviewed_at: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
      queryClient.invalidateQueries({ queryKey: ["import-item"] });
    },
  });
}

// Promote to product
export function usePromoteToProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: ImportItem) => {
      // Create a new product from the import item
      const mainImage = item.images[0] || "";
      const additionalImages = item.images.slice(1);
      const slug = item.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      const productData = {
        brand: "Unknown", // Will need to be edited in product view
        name: item.title,
        price: item.price ? `${item.price} ${item.currency || "SEK"}` : "0",
        image: mainImage,
        additional_images: additionalImages,
        description: item.description || null,
        condition: item.condition || null,
        material: item.signals.material?.join(", ") || null,
        color: item.signals.colors?.join(", ") || null,
        status: "draft" as const,
        slug,
        ancora_select_source: item.source_type === "tradera" ? "tradera" as const : null,
      };

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert([productData])
        .select("id")
        .single();

      if (productError) throw productError;

      // Update the import item with product_id and promoted status
      const { error: updateError } = await supabase
        .from("ancora_import_items")
        .update({
          status: "promoted",
          product_id: product.id,
          promoted_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      return product.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
      queryClient.invalidateQueries({ queryKey: ["import-item"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
    },
  });
}

// Create new import item (manual)
export function useCreateImportItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ImportItemInsert) => {
      const { signals, ...rest } = data;
      const insertPayload: Record<string, unknown> = { ...rest };
      if (signals !== undefined) {
        insertPayload.signals = signals;
      }
      
      const { data: created, error } = await supabase
        .from("ancora_import_items")
        .insert([insertPayload as any])
        .select("id")
        .single();
      
      if (error) throw error;
      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
    },
  });
}
