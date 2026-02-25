import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImportToProductInput {
  // Source info
  marketplace: "tradera" | "ebay" | string;
  source_ref: string;
  source_url: string | null;
  affiliate_url: string | null;

  // Core fields
  title: string;
  title_original?: string | null;
  title_en?: string | null;
  description: string | null;
  description_original?: string | null;
  description_en?: string | null;
  language?: string | null;
  translated_at?: string | null;

  // Structured fields
  brand: string;
  size: string | null;
  color: string | null;
  material: string | null;
  condition: string | null;

  // Price
  price: number | null;
  currency: string | null;

  // Images
  primary_image: string | null;
  images: string[];

  // Category
  category_id: string | null;

  // Provenance (for AIS log)
  provenance?: string | null;
  condition_enum?: string | null;
  signals?: Record<string, unknown> | null;
}

/**
 * Creates a Product (draft) directly from marketplace import data.
 * Optionally writes an AIS log entry with the product_id linked.
 */
export function useImportToProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportToProductInput) => {
      const mainImage = input.primary_image || input.images[0] || "";
      const additionalImages = input.images.filter((img) => img !== mainImage);

      // Use English title if available, otherwise original
      const displayName = input.title_en || input.title;
      const slug = displayName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const priceStr = input.price
        ? `${input.price} ${input.currency || "SEK"}`
        : "0";

      const productData = {
        brand: input.brand || "Unknown",
        name: displayName,
        name_original: input.title_original || input.title,
        name_en: input.title_en || null,
        price: priceStr,
        image: mainImage,
        additional_images: additionalImages,
        description: input.description_en || input.description || null,
        description_original: input.description_original || input.description || null,
        description_en: input.description_en || null,
        language: input.language || "sv",
        translated_at: input.translated_at || null,
        condition: input.condition || null,
        material: input.material || null,
        color: input.color || null,
        size: input.size || null,
        status: "draft" as const,
        slug,
        marketplace: input.marketplace,
        category_id: input.category_id || null,
        ancora_select_source: null,
        affiliate_url: input.affiliate_url || input.source_url || null,
        tradera_item_id:
          input.marketplace === "tradera" ? input.source_ref : null,
      };

      // Create Product
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert([productData])
        .select("id")
        .single();

      if (productError) throw productError;

      // AIS invisible log — non-blocking
      try {
        const aisPayload: Record<string, unknown> = {
          source_type: input.marketplace,
          source_ref: input.source_ref,
          source_url: input.source_url,
          affiliate_url: input.affiliate_url,
          title: input.title,
          title_original: input.title_original || input.title,
          title_en: input.title_en || null,
          description: input.description,
          description_original: input.description_original || input.description,
          description_en: input.description_en || null,
          language: input.language || "sv",
          translated_at: input.translated_at || null,
          images: input.images,
          price: input.price,
          currency: input.currency,
          condition: input.condition_enum || null,
          provenance: input.provenance || null,
          signals: input.signals || {
            keywords: [],
            colors: [],
            era: null,
            material: null,
            vibe: null,
          },
          status: "promoted",
          product_id: product.id,
          promoted_at: new Date().toISOString(),
          brand_text: input.brand || null,
          size_text: input.size || null,
          color_text: input.color || null,
          material_text: input.material || null,
          condition_text: input.condition || null,
          primary_image: input.primary_image || null,
          marketplace: input.marketplace,
          category_id: input.category_id || null,
        };

        await supabase
          .from("ancora_import_items")
          .insert([aisPayload as any]);
      } catch (aisErr) {
        // AIS log failure must NOT block the product creation
        console.warn("[Import] AIS log failed (non-blocking):", aisErr);
      }

      return product.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["import-items"] });
    },
  });
}

/**
 * Check if a product already exists for a given marketplace + source_ref.
 * Returns true if duplicate found.
 */
export async function checkProductDuplicate(
  marketplace: string,
  sourceRef: string,
  affiliateUrl?: string | null
): Promise<boolean> {
  // Check tradera_item_id for Tradera
  if (marketplace === "tradera") {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("tradera_item_id", sourceRef)
      .limit(1);
    if (data && data.length > 0) return true;
  }

  // Check affiliate_url for all marketplaces
  if (affiliateUrl) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("affiliate_url", affiliateUrl)
      .limit(1);
    if (data && data.length > 0) return true;
  }

  return false;
}
