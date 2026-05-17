import { supabase } from "@/integrations/supabase/client";
import { isLikelyEnglish } from "@/lib/languageDetect";

export interface TranslateImportInput {
  title: string;
  description?: string;
  condition?: string;
  material?: string;
  size?: string;
  brand?: string;
  sourceRef: string;
}

export interface TranslateImportResult {
  title_en: string | null;
  description_en: string | null;
  condition_en: string | null;
  material_en: string | null;
  size_en: string | null;
  brand_en: string | null;
  language: "sv" | "en" | "it" | "other";
  translated_at: string | null;
}

export async function translateImport(
  opts: TranslateImportInput
): Promise<TranslateImportResult> {
  const { title, description, condition, material, size, brand, sourceRef } = opts;
  const desc = description ?? "";
  const textToCheck = `${title} ${desc}`.trim();

  if (isLikelyEnglish(textToCheck)) {
    console.info(`[translateImport] Skipping translation (already English): ${sourceRef}`);
    return {
      title_en: title,
      description_en: desc ? desc : null,
      condition_en: condition || null,
      material_en: material || null,
      size_en: size || null,
      brand_en: brand || null,
      language: "en",
      translated_at: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("translate-swedish", {
      body: {
        name: title,
        description: desc,
        condition: condition || "",
        material: material || "",
        size: size || "",
        brand: brand || "",
      },
    });
    if (!error && data && data.name) {
      console.info(`[translateImport] Translated: ${sourceRef}`);
      return {
        title_en: data.name,
        description_en: data.description || null,
        condition_en: data.condition || null,
        material_en: data.material || null,
        size_en: data.size || null,
        brand_en: data.brand || null,
        language: "other",
        translated_at: new Date().toISOString(),
      };
    }
    console.warn(`[translateImport] Translation failed (non-blocking): ${sourceRef}`, error);
  } catch (err) {
    console.warn(`[translateImport] Translation exception (non-blocking): ${sourceRef}`, err);
  }

  return {
    title_en: null,
    description_en: null,
    condition_en: null,
    material_en: null,
    size_en: null,
    brand_en: null,
    language: "other",
    translated_at: null,
  };
}
