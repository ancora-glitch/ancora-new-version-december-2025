import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useImportToProduct, checkProductDuplicate } from "@/hooks/useImportToProduct";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Package,
  AlertCircle,
  Store,
  Check,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { parseListingFields } from "@/lib/listingParser";
import { translateImport } from "@/lib/translateImport";

interface VintageSphereItem {
  external_id: string;
  handle: string;
  title: string;
  price: number | null;
  currency: string;
  primaryImage: string | null;
  imageCount: number;
  vendor: string;
  productType: string;
  size: string | null;
  color: string | null;
  material: string | null;
  available: boolean;
  productUrl: string;
  tags: string[];
}

interface VintageSphereItemDetail {
  external_id: string;
  shopify_id: number;
  title: string;
  handle: string;
  description: string | null;
  descriptionHtml: string | null;
  price: number | null;
  currency: string;
  vendor: string;
  productType: string;
  tags: string[];
  size: string | null;
  color: string | null;
  material: string | null;
  condition: string | null;
  era: string | null;
  available: boolean;
  images: string[];
  productUrl: string;
  updatedAt: string | null;
}

interface VintageSphereSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const MAX_IMPORT_PER_RUN = 10;

export function VintageSphereSearchDrawer({
  open,
  onOpenChange,
  onImported,
}: VintageSphereSearchDrawerProps) {
  const importMutation = useImportToProduct();

  const [keywords, setKeywords] = useState("");
  const [includeUnavailable, setIncludeUnavailable] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VintageSphereItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<{
    total: number;
    pagesScanned: number;
    durationMs: number;
  } | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());
  const [runLimitReached, setRunLimitReached] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchError(null);
      setRunLimitReached(false);
    }
  }, [open]);

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchError(null);
    setSelectedItems(new Set());
    setSearchMeta(null);

    try {
      // Check existing VintageSphere products
      const { data: existingProducts } = await supabase
        .from("products")
        .select("slug, affiliate_url")
        .eq("marketplace", "vintagesphere");

      const existingSet = new Set<string>();
      for (const p of existingProducts || []) {
        // Use slug as handle match
        if (p.slug) existingSet.add(p.slug);
        // Also extract handle from affiliate_url
        const match = p.affiliate_url?.match(/\/products\/([^?#]+)/);
        if (match) existingSet.add(match[1]);
      }
      setExistingRefs(existingSet);

      const { data, error } = await supabase.functions.invoke(
        "vintagesphere-search",
        {
          body: {
            keywords: keywords.trim(),
            includeUnavailable,
          },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSearchResults(data.items || []);
      setHasSearched(true);
      setSearchMeta({
        total: data.total,
        pagesScanned: data.pagesScanned,
        durationMs: data.durationMs,
      });

      // Failure alert: zero results
      if (!data.items || data.items.length === 0) {
        console.warn("[VintageSphereImportWarning]", JSON.stringify({
          event: "VintageSphereImportWarning",
          endpoint_status: "ok",
          pages_fetched: data.pagesScanned ?? 0,
          products_returned: 0,
          error_count: 0,
          duration_ms: data.durationMs ?? 0,
        }));
        toast.info("No items found");
      }
    } catch (error: any) {
      // Failure alert: endpoint error
      console.warn("[VintageSphereImportWarning]", JSON.stringify({
        event: "VintageSphereImportWarning",
        endpoint_status: "error",
        pages_fetched: 0,
        products_returned: 0,
        error_count: 1,
        duration_ms: 0,
      }));
      console.error("VintageSphere search error:", error);
      setSearchError(error.message || "Search failed");
      toast.error("Search failed: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleItem = (handle: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(handle)) {
      newSelected.delete(handle);
    } else {
      newSelected.add(handle);
    }
    setSelectedItems(newSelected);
  };

  const fetchItemDetails = async (
    handle: string
  ): Promise<VintageSphereItemDetail | null> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "vintagesphere-item",
        { body: { handle } }
      );
      if (error) {
        console.error("vintagesphere-item error:", error);
        return null;
      }
      return data?.item || null;
    } catch (err) {
      console.error("vintagesphere-item exception:", err);
      return null;
    }
  };

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      toast.error("Select items to import");
      return;
    }

    const itemsToImport = Array.from(selectedItems).filter(
      (handle) => !existingRefs.has(handle)
    );

    setIsImporting(true);
    setRunLimitReached(false);
    const runStartTime = Date.now();
    const effectiveTotal = Math.min(itemsToImport.length, MAX_IMPORT_PER_RUN);
    setImportProgress({ current: 0, total: effectiveTotal });
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let soldOut = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < itemsToImport.length; i++) {
        // Run limit guard
        if (imported >= MAX_IMPORT_PER_RUN) {
          setRunLimitReached(true);
          console.info(
            `[VintageSphere Import] Run limit reached (${MAX_IMPORT_PER_RUN}). Stopping.`
          );
          toast.warning(
            `Run limit reached (${MAX_IMPORT_PER_RUN} imports). Start a new run to continue.`
          );
          break;
        }

        const handle = itemsToImport[i];
        setImportProgress({ current: Math.min(i + 1, effectiveTotal), total: effectiveTotal });

        const searchItem = searchResults.find((r) => r.handle === handle);
        if (!searchItem) continue;

        // Dedupe check
        const isDupe = await checkProductDuplicate(
          "vintagesphere",
          handle,
          searchItem.productUrl
        );
        if (isDupe) {
          skipped++;
          continue;
        }

        // Fetch full details
        const detail = await fetchItemDetails(handle);
        if (!detail) {
          console.warn(
            `[VintageSphere Import] Could not fetch details for ${handle} — skipping`
          );
          failed++;
          errorCount++;
          continue;
        }

        const images = detail.images;
        const parsed = parseListingFields({
          title: detail.title,
          description: detail.description || "",
          apiBrand: detail.vendor !== "Vintage Sphere" ? detail.vendor : undefined,
          apiSize: detail.size || undefined,
          apiColor: detail.color || undefined,
          apiMaterial: detail.material || undefined,
          conditionEnum: undefined,
          images,
        });

        // Build description from structured content
        const description =
          detail.description ||
          `${detail.title}. ${detail.vendor}${detail.size ? `, Size: ${detail.size}` : ""}${detail.material ? `, Material: ${detail.material}` : ""}${detail.condition ? `, Condition: ${detail.condition}` : ""}`;

        const tx = await translateImport({
          title: detail.title,
          description,
          condition: detail.condition || parsed.condition_text || undefined,
          material: detail.material || parsed.material_text || undefined,
          size: detail.size || parsed.size_text || undefined,
          brand: detail.vendor !== "Vintage Sphere" ? detail.vendor : undefined,
          sourceRef: handle,
        });

        const importInput = {
          marketplace: "vintagesphere",
          source_ref: handle,
          source_url: detail.productUrl,
          affiliate_url: detail.productUrl,
          title: detail.title,
          title_original: detail.title,
          title_en: tx.title_en,
          description,
          description_original: description,
          description_en: tx.description_en,
          language: tx.language,
          translated_at: tx.translated_at,
          brand: parsed.brand_text || (detail.vendor !== "Vintage Sphere" ? detail.vendor : "Unknown"),
          size: detail.size || parsed.size_text || null,
          color: detail.color || parsed.color_text || null,
          material: detail.material || parsed.material_text || null,
          condition: detail.condition || parsed.condition_text || null,
          price: detail.price,
          currency: detail.currency,
          primary_image: images[0] || null,
          images,
          category_id: null,
          provenance: detail.vendor,
          condition_enum: null,
          signals: {
            keywords: detail.tags,
            colors: detail.color ? [detail.color] : [],
            era: detail.era,
            material: detail.material,
            vibe: null,
            productType: detail.productType,
          },
        };

        try {
          await importMutation.mutateAsync(importInput);
          imported++;
        } catch (importErr: any) {
          console.error(`[VintageSphere Import] Failed to import ${handle}:`, importErr);
          failed++;
          errorCount++;
          continue;
        }

        // If sold out, immediately mark as unavailable
        if (!detail.available) {
          soldOut++;
          console.info(
            `[VintageSphere Import] ${handle} is sold out — created as draft with note`
          );
        }

        // Polite delay between imports
        if (i < itemsToImport.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // Health log
      const durationMs = Date.now() - runStartTime;
      console.info("[VintageSphere Import Run]", JSON.stringify({
        importer_name: "vintagesphere",
        endpoint_status: "ok",
        pages_fetched: searchMeta?.pagesScanned ?? 0,
        products_returned: searchResults.length,
        products_imported: imported,
        products_skipped: skipped,
        products_sold_out: soldOut,
        duration_ms: durationMs,
        error_count: errorCount,
        run_limit: MAX_IMPORT_PER_RUN,
        run_limit_reached: imported >= MAX_IMPORT_PER_RUN,
      }));

      const parts: string[] = [];
      if (imported > 0)
        parts.push(
          `Created ${imported} draft product${imported > 1 ? "s" : ""}`
        );
      if (skipped > 0) parts.push(`${skipped} already imported`);
      if (failed > 0) parts.push(`${failed} failed`);
      if (soldOut > 0) parts.push(`${soldOut} sold out`);

      if (imported > 0) {
        toast.success(parts.join(", "), {
          action: {
            label: "Go to Drafts",
            onClick: () => {
              const tabTrigger = document.querySelector(
                '[data-value="products"]'
              ) as HTMLElement;
              tabTrigger?.click();
            },
          },
        });
      } else {
        toast.info(parts.join(", "));
      }

      setSearchResults([]);
      setSelectedItems(new Set());
      setHasSearched(false);
      setKeywords("");
      onOpenChange(false);
      onImported?.();
    } catch (error: any) {
      const durationMs = Date.now() - runStartTime;
      console.warn("[VintageSphereImportWarning]", JSON.stringify({
        event: "VintageSphereImportWarning",
        endpoint_status: "error",
        pages_fetched: searchMeta?.pagesScanned ?? 0,
        products_returned: searchResults.length,
        error_count: errorCount + 1,
        duration_ms: durationMs,
      }));
      console.error("[VintageSphere Import Run] Fatal error:", JSON.stringify({
        importer_name: "vintagesphere",
        endpoint_status: "error",
        products_imported: imported,
        duration_ms: durationMs,
        error_count: errorCount + 1,
        error_message: error.message,
      }));
      toast.error("Import failed: " + error.message);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const selectableResults = searchResults.filter(
    (item) => !existingRefs.has(item.handle)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Store className="w-5 h-5" />
            Search VintageSphere
          </SheetTitle>
          <SheetDescription>
            Browse VintageSphere catalog and import items as draft products.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 mt-6 overflow-hidden">
          {/* Search Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vs-keywords">
                Keywords{" "}
                <span className="text-muted-foreground text-xs">
                  (optional — leave empty to browse all)
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="vs-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="silk dress, wool coat..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="vs-unavailable"
                checked={includeUnavailable}
                onCheckedChange={setIncludeUnavailable}
              />
              <Label htmlFor="vs-unavailable" className="text-sm">
                Include sold-out items
              </Label>
            </div>
          </div>

          {/* Search meta */}
          {searchMeta && (
            <div className="text-xs text-muted-foreground">
              Scanned {searchMeta.pagesScanned} page
              {searchMeta.pagesScanned > 1 ? "s" : ""} in{" "}
              {(searchMeta.durationMs / 1000).toFixed(1)}s — {searchMeta.total}{" "}
              products found
            </div>
          )}

          {/* Error */}
          {searchError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{searchError}</span>
            </div>
          )}

          {/* Empty state */}
          {hasSearched && searchResults.length === 0 && !searchError && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p>No items found</p>
              <p className="text-sm">Try different keywords</p>
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {searchResults.length} results ({selectableResults.length}{" "}
                  new)
                </span>
                {selectableResults.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedItems.size === selectableResults.length) {
                        setSelectedItems(new Set());
                      } else {
                        setSelectedItems(
                          new Set(selectableResults.map((i) => i.handle))
                        );
                      }
                    }}
                  >
                    {selectedItems.size === selectableResults.length
                      ? "Deselect all"
                      : "Select all new"}
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {searchResults.map((item) => {
                    const isExisting = existingRefs.has(item.handle);
                    const isSelected = selectedItems.has(item.handle);

                    return (
                      <div
                        key={item.handle}
                        className={`flex gap-3 p-3 border rounded-md transition-colors ${
                          isExisting
                            ? "opacity-50 bg-muted"
                            : isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            !isExisting && toggleItem(item.handle)
                          }
                          disabled={isExisting}
                        />

                        {item.primaryImage ? (
                          <img
                            src={item.primaryImage}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium text-foreground">
                              {item.price
                                ? `${item.currency} ${item.price}`
                                : "No price"}
                            </span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>{item.size}</span>
                              </>
                            )}
                            {item.material && (
                              <>
                                <span>•</span>
                                <span>{item.material}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{item.imageCount} imgs</span>
                            {!item.available && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1"
                              >
                                Sold out
                              </Badge>
                            )}
                            {isExisting && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1"
                              >
                                Already imported
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Import progress */}
          {importProgress && (
            <div className="space-y-2">
              <Progress
                value={
                  (importProgress.current / importProgress.total) * 100
                }
              />
              <p className="text-xs text-muted-foreground text-center">
                Importing {importProgress.current}/{importProgress.total}...
              </p>
            </div>
          )}

          {/* Run limit warning */}
          {runLimitReached && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">
                Run limit reached ({MAX_IMPORT_PER_RUN} imports per run). Close and re-open to start a new run.
              </span>
            </div>
          )}

          {/* Import button */}
          {selectedItems.size > 0 && (
            <div className="space-y-2">
              {selectedItems.size > MAX_IMPORT_PER_RUN && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Only the first {MAX_IMPORT_PER_RUN} items will be imported in this run.
                </p>
              )}
              <Button
                onClick={handleImport}
                disabled={isImporting || runLimitReached}
                className="w-full"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Package className="w-4 h-4 mr-2" />
                )}
                Import {Math.min(selectedItems.size, MAX_IMPORT_PER_RUN)} item
                {Math.min(selectedItems.size, MAX_IMPORT_PER_RUN) > 1 ? "s" : ""} as Draft
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
