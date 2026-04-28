import { supabase } from "@/integrations/supabase/client";
import { isLikelyEnglish } from "@/lib/languageDetect";

export interface TranslateImportInput {
  title: string;
  description?: string;
  condition?: string;
  material?: string;
  size?: string;
  brand?: string;
  /** Identifier for log lines (e.g. handle, item id). */
  sourceRef: string;
}

export interface TranslateImportResult {
  title_en: string | null;
  description_en: string | null;
  language: "sv" | "en";
  translated_at: string | null;
}

/**
 * Shared translation helper for all import flows.
 * - Heuristic-first: skips AI call when source already looks English.
 * - Non-blocking: any failure logs a warning and returns nulls so the
 *   import still succeeds; the translate-backfill cron will fill it in.
 */
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
        language: "sv",
        translated_at: new Date().toISOString(),
      };
    }
    console.warn(
      `[translateImport] Translation failed (non-blocking): ${sourceRef}`,
      error
    );
  } catch (err) {
    console.warn(
      `[translateImport] Translation exception (non-blocking): ${sourceRef}`,
      err
    );
  }

  return {
    title_en: null,
    description_en: null,
    language: "sv",
    translated_at: null,
  };
}
