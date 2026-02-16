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
  affiliate_url: string | null;
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
  // Structured product-like fields
  brand_text: string | null;
  size_text: string | null;
  color_text: string | null;
  material_text: string | null;
  condition_text: string | null;
  primary_image: string | null;
  marketplace: string | null;
  category_id: string | null;
}

export interface ImportItemInsert {
  source_type: AisSourceType;
  source_ref: string;
  source_url?: string | null;
  affiliate_url?: string | null;
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
  // Structured product-like fields
  brand_text?: string | null;
  size_text?: string | null;
  color_text?: string | null;
  material_text?: string | null;
  condition_text?: string | null;
  primary_image?: string | null;
  marketplace?: string | null;
  category_id?: string | null;
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
  // Structured product-like fields
  brand_text?: string | null;
  size_text?: string | null;
  color_text?: string | null;
  material_text?: string | null;
  condition_text?: string | null;
  primary_image?: string | null;
  marketplace?: string | null;
  category_id?: string | null;
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

// INVARIANT:
// Tradera imports must always use GetItem images (/images/) and render multi-image carousel.
// If this fails, the import pipeline is broken.
// Tradera carousels must behave identically to eBay carousels.

// Promote to product
export function usePromoteToProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: ImportItem) => {
      // === PRE-PROMOTION ASSERTIONS ===
      // These assertions ensure import quality. Do NOT remove or weaken them.
      const isTradera = item.source_type === "tradera";
      
      // Assertion 1: No images = broken import → abort with user-facing error
      if (item.images.length === 0) {
        console.error("[AIS Promote] ASSERTION FAILED: No images on item", {
          source_ref: item.source_ref,
          source_type: item.source_type,
        });
        throw new Error("Cannot promote: item has no images. Add images before promoting.");
      }

      // Assertion 2: primary_image must be in images[] (or null)
      if (item.primary_image && !item.images.includes(item.primary_image)) {
        console.error("[AIS Promote] ASSERTION FAILED: primary_image not in images[]", {
          source_ref: item.source_ref,
          primary_image: item.primary_image,
          images: item.images,
        });
        throw new Error("Cannot promote: primary image is not in the images list. Fix the hero image before promoting.");
      }
      
      // Assertion 3: Tradera should always have 3+ images (they typically have 4-10)
      if (isTradera && item.images.length < 3) {
        console.error("[AIS Promote] INVARIANT VIOLATION: Tradera item has < 3 images", {
          source_ref: item.source_ref,
          image_count: item.images.length,
          image_urls: item.images,
          note: "Tradera imports should use GetItem API for full image gallery"
        });
      }
      
      // Assertion 4: All Tradera images must be HD (/images/ path)
      if (isTradera) {
        const nonHdImages = item.images.filter(url => 
          url.includes("tradera.net") && !url.includes("/images/")
        );
        if (nonHdImages.length > 0) {
          console.error("[AIS Promote] INVARIANT VIOLATION: Non-HD images detected", {
            source_ref: item.source_ref,
            non_hd_urls: nonHdImages,
            note: "Images must use /images/ path segment for high resolution"
          });
        }
      }
      // === END ASSERTIONS ===
      
      // Create a new product from the import item
      const mainImage = item.primary_image || item.images[0] || "";
      const additionalImages = item.images.filter(img => img !== mainImage);
      
      // Use cleaned name (brand removed) or English title
      const displayName = (item as any).title_en || item.title;
      const cleanedName = item.brand_text
        ? displayName // brand is separate, name should already be clean
        : displayName;
      const slug = cleanedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const productData = {
        brand: item.brand_text || "Unknown",
        name: cleanedName,
        name_original: (item as any).title_original || item.title,
        name_en: (item as any).title_en || null,
        price: item.price ? `${item.price} ${item.currency || "SEK"}` : "0",
        image: mainImage,
        additional_images: additionalImages,
        description: (item as any).description_en || item.description || null,
        description_original: (item as any).description_original || item.description || null,
        description_en: (item as any).description_en || null,
        language: (item as any).language || 'sv',
        translated_at: (item as any).translated_at || null,
        condition: item.condition_text || (item.condition ? item.condition : null),
        material: item.material_text || (item.signals.material?.join(", ") || null),
        color: item.color_text || (item.signals.colors?.join(", ") || null),
        size: item.size_text || null,
        status: "draft" as const,
        slug,
        marketplace: item.marketplace || item.source_type,
        category_id: item.category_id || null,
        ancora_select_source: null,
        affiliate_url: item.affiliate_url || item.source_url || null,
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

      console.log("[AIS Promote] Successfully promoted item to product:", {
        product_id: product.id,
        source_ref: item.source_ref,
        images_transferred: item.images.length,
      });

      return product.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
      queryClient.invalidateQueries({ queryKey: ["import-item"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products-weekly-edit"] });
      queryClient.invalidateQueries({ queryKey: ["category-products"] });
    },
  });
}

// ── Language heuristic (mirrors edge function logic) ──
const SWEDISH_STOPWORDS = ['och', 'det', 'som', 'är', 'en', 'ett', 'att', 'för', 'med', 'har', 'den', 'av', 'inte', 'var', 'kan', 'till', 'på', 'om'];

function isLikelyEnglish(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  if (/[åäöÅÄÖ]/.test(combined)) return false;
  const letters = combined.replace(/[^a-zà-ÿ]/gi, '');
  if (letters.length === 0) return false;
  const azLetters = combined.replace(/[^a-z]/gi, '');
  const ratio = azLetters.length / letters.length;
  if (ratio <= 0.8) return false;
  const words = combined.split(/\s+/);
  let swCount = 0;
  for (const w of words) {
    if (SWEDISH_STOPWORDS.includes(w)) swCount++;
  }
  if (swCount >= 2) return false;
  return true;
}

// Create new import item (manual) — triggers translation for Tradera items
export function useCreateImportItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ImportItemInsert) => {
      const { signals, ...rest } = data;
      const insertPayload: Record<string, unknown> = { ...rest };
      if (signals !== undefined) {
        insertPayload.signals = signals;
      }
      
      // Store originals
      insertPayload.title_original = data.title;
      insertPayload.description_original = data.description || null;
      insertPayload.language = 'sv';

      // Skip translation if text is already English
      if (data.source_type === 'tradera' && isLikelyEnglish(data.title, data.description || '')) {
        console.log('[Translation] Skipped (already EN): manual import');
        insertPayload.title_en = data.title;
        insertPayload.description_en = data.description || null;
        insertPayload.translated_at = new Date().toISOString();
        insertPayload.language = 'en';
      } else if (data.source_type === 'tradera') {
        // Attempt translation (non-blocking for insert)
        try {
          const { data: translated, error: translateError } = await supabase.functions.invoke('translate-swedish', {
            body: {
              name: data.title,
              description: data.description || '',
              condition: '',
            },
          });

          if (!translateError && translated) {
            insertPayload.title_en = translated.name || null;
            insertPayload.description_en = translated.description || null;
            insertPayload.translated_at = new Date().toISOString();
            // Use English text as the primary title/description
            if (translated.name) insertPayload.title = translated.name;
            if (translated.description) insertPayload.description = translated.description;
          }
        } catch (_) {
          // Translation failure should not block import
        }
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
