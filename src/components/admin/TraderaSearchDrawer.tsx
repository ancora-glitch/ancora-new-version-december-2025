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
import { supabase } from "@/integrations/supabase/client";
import { useImportToProduct, checkProductDuplicate } from "@/hooks/useImportToProduct";
import type { AisCondition } from "@/hooks/useImportItems";
import { useTraderaUsage } from "@/hooks/useTraderaUsage";
import { toast } from "sonner";
import { Loader2, Search, Package, AlertCircle, AlertTriangle, Clock, Zap, ImageIcon, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { selectHeroImage } from "@/lib/heroImageSelector";
import { parseListingFields } from "@/lib/listingParser";

interface TraderaSearchItem {
  id: number;
  shortDescription: string;
  longDescription?: string;
  price: number;
  buyItNowPrice?: number;
  thumbnailLink?: string;
  imageLinks?: string[];
  itemLink: string;
  categoryId: number;
  sellerId: number;
  sellerAlias?: string;
  endDate?: string;
  bids?: number;
  condition?: string;
  brandName?: string;
}

interface TraderaItemDetail {
  id: number;
  shortDescription: string;
  longDescription?: string;
  price: number;
  buyItNowPrice?: number;
  imageLinks: string[];
  itemLink: string;
  sellerId: number;
  sellerAlias?: string;
  endDate?: string;
  condition?: string;
  brand?: string;
  size?: string;
  material?: string;
  attributes: Record<string, string>;
}

interface TraderaSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

// Map Tradera condition strings to AIS condition enum
function mapCondition(traderaCondition?: string): AisCondition {
  if (!traderaCondition) return "unknown";
  const lower = traderaCondition.toLowerCase();
  if (lower.includes("new") || lower.includes("ny")) return "new";
  if (lower.includes("excellent") || lower.includes("utmärkt")) return "excellent";
  if (lower.includes("good") || lower.includes("god") || lower.includes("bra")) return "good";
  if (lower.includes("fair") || lower.includes("hyfsad") || lower.includes("ok")) return "fair";
  return "unknown";
}

// Extract keywords from title
function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    "och", "i", "på", "med", "för", "av", "till", "en", "ett", "den", "det",
    "som", "är", "från", "the", "and", "or", "a", "an", "of", "to", "in",
  ]);
  
  return title
    .toLowerCase()
    .replace(/[^\wåäöÅÄÖ\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word))
    .slice(0, 10);
}

// Simple heuristic: is text likely already English?
function isLikelyEnglish(text: string): boolean {
  if (!text) return false;
  const hasSwedishChars = /[åäöÅÄÖ]/.test(text);
  if (hasSwedishChars) return false;
  const swedishStopwords = ["och", "för", "med", "som", "det", "den", "ett", "att", "har", "kan", "inte", "från", "ska", "till"];
  const lowerText = text.toLowerCase();
  const matches = swedishStopwords.filter(w => new RegExp(`\\b${w}\\b`).test(lowerText));
  return matches.length < 2;
}

export function TraderaSearchDrawer({ open, onOpenChange, onImported }: TraderaSearchDrawerProps) {
  const importMutation = useImportToProduct();
  const { data: usage, refetch: refetchUsage } = useTraderaUsage();
  
  // Search form state
  const [keywords, setKeywords] = useState("");
  
  // Search results state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TraderaSearchItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());

  // Reset stale rate-limit state and refetch usage when drawer opens
  useEffect(() => {
    if (open) {
      setIsRateLimited(false);
      setSearchError(null);
      refetchUsage();
    }
  }, [open, refetchUsage]);

  // Sync local rate-limit flag with server state: if server says quota is available, clear local flag
  useEffect(() => {
    if (usage && !usage.limit_reached && isRateLimited) {
      setIsRateLimited(false);
      setSearchError(null);
    }
  }, [usage, isRateLimited]);

  const handleSearch = async () => {
    if (!keywords.trim()) {
      toast.error("Ange sökord");
      return;
    }

    // Check if rate limited before even trying
    if (usage?.limit_reached) {
      setIsRateLimited(true);
      setSearchError("Tradera API-kvoten har nåtts för idag. Försök igen imorgon.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setIsRateLimited(false);
    setFromCache(false);
    setSelectedItems(new Set());

    try {
      // Check which Tradera items already exist as Products
      const { data: existingProducts } = await supabase
        .from("products")
        .select("tradera_item_id")
        .eq("marketplace", "tradera")
        .not("tradera_item_id", "is", null);
      
      const existingSet = new Set((existingProducts || []).map(p => p.tradera_item_id!));
      setExistingRefs(existingSet);

      // Call the tradera-search edge function
      const { data, error } = await supabase.functions.invoke("tradera-search", {
        body: {
          keywords: keywords.trim(),
        },
      });

      // Handle rate limit error
      if (error?.message?.includes("429") || data?.error === "rate_limit_exceeded") {
        setIsRateLimited(true);
        setSearchError(data?.message || "Tradera API-kvoten har nåtts för idag. Försök igen imorgon.");
        refetchUsage();
        return;
      }

      if (error) throw error;
      if (data.error && data.error !== "rate_limit_exceeded") {
        throw new Error(data.error);
      }

      setSearchResults(data.items || []);
      setHasSearched(true);
      setFromCache(data.fromCache || false);

      // Update usage from response
      if (data.usage) {
        refetchUsage();
      }

      if (data.items?.length === 0) {
        toast.info("Inga objekt hittades");
      } else if (data.fromCache) {
        toast.info("Resultat från cache (sparar API-anrop)");
      }
    } catch (error: any) {
      console.error("Tradera search error:", error);
      
      // Check for rate limit in error
      if (error.message?.includes("rate_limit") || error.message?.includes("quota")) {
        setIsRateLimited(true);
        setSearchError("Tradera API-kvoten har nåtts för idag. Försök igen imorgon.");
      } else {
        setSearchError(error.message || "Sökning misslyckades");
        toast.error("Sökning misslyckades: " + error.message);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const toggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  /**
   * Fetch full item details with all high-resolution images.
   * Returns { item, rateLimited } so callers can distinguish rate-limit from real errors.
   * INVARIANT: A rate-limited response must never reduce image count on an existing product.
   */
  const fetchItemDetails = async (itemId: number): Promise<{ item: TraderaItemDetail | null; rateLimited: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke("tradera-item", {
        body: { itemId },
      });

      if (error) {
        console.error("Failed to fetch item details:", error);
        return { item: null, rateLimited: false };
      }

      if (data.rateLimited) {
        console.warn(`[AIS Import] Tradera rate limited for item ${itemId} — skipping image update`);
        return { item: null, rateLimited: true };
      }

      if (data.error) {
        console.error("Item fetch error:", data.error);
        return { item: null, rateLimited: false };
      }

      return { item: data.item as TraderaItemDetail, rateLimited: false };
    } catch (err) {
      console.error("Error fetching item details:", err);
      return { item: null, rateLimited: false };
    }
  };

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      toast.error("Välj objekt att importera");
      return;
    }

    // Check API quota - each import costs 1 API call for GetItem
    const itemsToImport = Array.from(selectedItems).filter(
      id => !existingRefs.has(String(id))
    );

    if (usage && itemsToImport.length > usage.remaining) {
      toast.error(`Inte tillräckligt med API-kvot. Du har ${usage.remaining} anrop kvar men försöker importera ${itemsToImport.length} objekt.`);
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: itemsToImport.length });
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (let i = 0; i < itemsToImport.length; i++) {
        const itemId = itemsToImport[i];
        setImportProgress({ current: i + 1, total: itemsToImport.length });

        const searchItem = searchResults.find(r => r.id === itemId);
        if (!searchItem) continue;

        const sourceRef = String(itemId);

        // Check if already exists (dedupe)
        if (existingRefs.has(sourceRef)) {
          skipped++;
          continue;
        }

        try {
          // Fetch full item details with all high-res images
          const { item: itemDetails, rateLimited } = await fetchItemDetails(itemId);

          // INVARIANT: A rate-limited Tradera response must never reduce image count.
          // If rate limited, queue a background retry job instead of failing silently.
          if (rateLimited) {
            console.warn(`[AIS Import] Tradera rate limited — queuing retry for item ${itemId}`);
            
            // Persist retry job so background cron can re-attempt later
            try {
              const { data: retryData, error: retryError } = await supabase.from("tradera_retry_jobs").upsert({
                source_ref: sourceRef,
                source_type: "tradera",
                status: "pending",
                retry_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1 hour
                item_payload: {
                  shortDescription: searchItem.shortDescription,
                  longDescription: searchItem.longDescription,
                  price: searchItem.price,
                  buyItNowPrice: searchItem.buyItNowPrice,
                  itemLink: searchItem.itemLink,
                  sellerAlias: searchItem.sellerAlias,
                  condition: searchItem.condition,
                  brandName: searchItem.brandName,
                  thumbnailLink: searchItem.thumbnailLink,
                },
              }, { onConflict: "source_ref,source_type" }).select();
              
              if (retryError || !retryData?.[0]?.id) {
                console.error(`[AIS Import] Retry job insert FAILED for ${sourceRef}:`, retryError?.message, retryError?.details, retryError?.code);
                toast.error("Misslyckades att köa objekt för retry. Försök igen.");
              } else {
                console.info(`[AIS Import] Retry job created: source_ref=${sourceRef}, id=${retryData[0].id}`);
                toast.error("API-kvoten nåddes. Objekt köade för automatisk retry.");
              }
            } catch (retryErr) {
              console.error(`[AIS Import] Failed to queue retry job (exception):`, retryErr);
              toast.error("Misslyckades att köa objekt för retry. Försök igen.");
            }

            setIsRateLimited(true);
            break;
          }

          if (!itemDetails) {
            console.warn(`[AIS Import] Could not fetch details for item ${itemId}, skipping (not falling back to thumbnails)`);
            failed++;
            continue;
          } else {
            // INVARIANT:
            // Tradera imports must always use GetItem images (/images/) and render multi-image carousel.
            // If this fails, the import pipeline is broken.
            
            // Use full item details with ALL high-res images
            const rawImages = itemDetails.imageLinks;
            
            // === INTERNAL MONITORING: Image Import Assertions ===
            // These assertions detect API regressions or quality issues. Do NOT remove.
            console.info(`[AIS Import] Item ${sourceRef}: ${rawImages.length} images imported`);
            
            // Assertion 1: All image URLs must use high-res /images/ path
            const nonHighResImages = rawImages.filter(url => !url.includes('/images/'));
            if (nonHighResImages.length > 0) {
              console.error(`[AIS Import] INVARIANT VIOLATION: Non-high-res images detected`, {
                source_ref: sourceRef,
                non_highres_urls: nonHighResImages,
                note: "All URLs must contain /images/ path segment for HD quality"
              });
            }
            
            // Assertion 2: Tradera should always have 3+ images (they typically have 4-10)
            if (rawImages.length < 3) {
              console.error(`[AIS Import] INVARIANT VIOLATION: Tradera import has < 3 images`, {
                source_ref: sourceRef,
                image_count: rawImages.length,
                image_urls: rawImages,
                note: "Tradera listings typically have 4-10 images. <3 indicates API issue."
              });
            }
            // === END MONITORING ===

            // === AUTOMATIC HERO IMAGE SELECTION ===
            // Analyze images and reorder with best hero first
            let images = rawImages;
            try {
              images = await selectHeroImage(rawImages);
              if (images[0] !== rawImages[0]) {
                console.info(`[AIS Import] Hero image auto-selected:`, {
                  source_ref: sourceRef,
                  original_first: rawImages[0]?.substring(0, 60) + '...',
                  selected_hero: images[0]?.substring(0, 60) + '...',
                });
              }
            } catch (heroError) {
              console.warn(`[AIS Import] Hero selection failed, using original order:`, heroError);
              images = rawImages;
            }
            // === END HERO SELECTION ===

            const signals = {
              keywords: extractKeywords(itemDetails.shortDescription),
              colors: [],
              era: null,
              material: itemDetails.material ? [itemDetails.material] : null,
              vibe: null,
            };

            // ── PRIORITY INVARIANT ──
            // Partner/API-provided values ALWAYS win over parser output.
            // Parser is only used as fallback when partner field is missing/empty.
            // ── END PRIORITY INVARIANT ──
            const parsed = parseListingFields({
              title: itemDetails.shortDescription,
              description: itemDetails.longDescription || "",
              apiBrand: itemDetails.brand,
              apiSize: itemDetails.size,
              apiMaterial: itemDetails.material,
              conditionEnum: mapCondition(itemDetails.condition),
              images,
            });

            // ── TRANSLATION ──
            // Call translate-swedish unless text is likely already English
            const originalTitle = itemDetails.shortDescription;
            const originalDesc = itemDetails.longDescription || "";
            let titleEn: string | null = null;
            let descriptionEn: string | null = null;
            let translatedAt: string | null = null;
            let language = "sv";

            const textToCheck = `${originalTitle} ${originalDesc}`;
            if (isLikelyEnglish(textToCheck)) {
              // Already English — skip translation
              titleEn = originalTitle;
              descriptionEn = originalDesc || null;
              language = "en";
              translatedAt = new Date().toISOString();
              console.info(`[Tradera Import] Skipping translation (already English): ${sourceRef}`);
            } else {
              try {
                const { data: txData, error: txError } = await supabase.functions.invoke("translate-swedish", {
                  body: {
                    name: originalTitle,
                    description: originalDesc,
                    condition: parsed.condition_text || "",
                    material: parsed.material_text || "",
                    size: parsed.size_text || "",
                    brand: parsed.brand_text || "",
                  },
                });
                if (!txError && txData && txData.name) {
                  titleEn = txData.name;
                  descriptionEn = txData.description || null;
                  translatedAt = new Date().toISOString();
                  console.info(`[Tradera Import] Translated: ${sourceRef}`);
                } else {
                  console.warn(`[Tradera Import] Translation failed (non-blocking): ${sourceRef}`, txError);
                }
              } catch (txErr) {
                console.warn(`[Tradera Import] Translation exception (non-blocking): ${sourceRef}`, txErr);
              }
            }

            // Create Product draft directly (+ AIS log in background)
            await importMutation.mutateAsync({
              marketplace: "tradera",
              source_ref: sourceRef,
              source_url: itemDetails.itemLink,
              affiliate_url: itemDetails.itemLink,
              title: originalTitle,
              title_original: originalTitle,
              title_en: titleEn,
              description: originalDesc || null,
              description_original: originalDesc || null,
              description_en: descriptionEn,
              language,
              translated_at: translatedAt,
              brand: parsed.brand_text || "Unknown",
              size: parsed.size_text || null,
              color: parsed.color_text || null,
              material: parsed.material_text || null,
              condition: parsed.condition_text || mapCondition(itemDetails.condition),
              price: itemDetails.buyItNowPrice || itemDetails.price || null,
              currency: "SEK",
              primary_image: parsed.primary_image || null,
              images,
              category_id: null,
              provenance: itemDetails.sellerAlias || "Tradera",
              condition_enum: mapCondition(itemDetails.condition),
              signals,
            });
          }

          imported++;
        } catch (itemError: any) {
          console.error(`Failed to import item ${itemId}:`, itemError);
          failed++;
        }

        // Refresh usage after each import
        refetchUsage();
      }

      if (imported > 0) {
        toast.success(`Created ${imported} draft product${imported > 1 ? "s" : ""}`, {
          action: {
            label: "Go to Drafts",
            onClick: () => {
              // Navigate to products tab with draft filter
              const tabTrigger = document.querySelector('[data-value="products"]') as HTMLElement;
              tabTrigger?.click();
            },
          },
        });
      }
      if (skipped > 0) {
        toast.info(`Skipped ${skipped} already imported item${skipped > 1 ? "s" : ""}`);
      }
      if (failed > 0) {
        toast.warning(`${failed} item${failed > 1 ? "s" : ""} could not be imported`);
      }

      // Reset and close
      setSearchResults([]);
      setSelectedItems(new Set());
      setHasSearched(false);
      setKeywords("");
      onOpenChange(false);
      onImported?.();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Import misslyckades: " + error.message);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const selectableResults = searchResults.filter(item => !existingRefs.has(String(item.id)));

  const usagePercent = usage ? (usage.current_count / usage.daily_limit) * 100 : 0;
  const isNearLimit = usage && usage.remaining <= 10;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Sök på Tradera</SheetTitle>
          <SheetDescription>
            Find items on Tradera and import them as draft products with HD images.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 mt-6 overflow-hidden">
          {/* API Usage Indicator */}
          {usage && (
            <div className={`p-3 rounded-md border ${
              usage.limit_reached 
                ? "bg-destructive/10 border-destructive/30" 
                : isNearLimit 
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-muted/50 border-border"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {usage.limit_reached ? (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  ) : isNearLimit ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Zap className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    API-kvot: {usage.current_count} / {usage.daily_limit}
                  </span>
                </div>
                <span className={`text-xs ${
                  usage.limit_reached 
                    ? "text-destructive" 
                    : isNearLimit 
                      ? "text-amber-600"
                      : "text-muted-foreground"
                }`}>
                  {usage.limit_reached 
                    ? "Kvot nådd" 
                    : `${usage.remaining} kvar`
                  }
                </span>
              </div>
              <Progress 
                value={usagePercent} 
                className={`h-1.5 ${
                  usage.limit_reached 
                    ? "[&>div]:bg-destructive" 
                    : isNearLimit 
                      ? "[&>div]:bg-amber-500"
                      : ""
                }`}
              />
              {fromCache && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Senaste sökningen hämtades från cache</span>
                </div>
              )}
            </div>
          )}

          {/* Rate Limit Warning */}
          {(isRateLimited || usage?.limit_reached) && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/30">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Tradera API-kvoten har nåtts för idag</p>
                <p className="text-sm mt-1 opacity-80">
                  Kvoten återställs vid midnatt (UTC). Försök igen imorgon eller använd cachade sökresultat.
                </p>
              </div>
            </div>
          )}

          {/* Search Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tradera-keywords">
                Sökord <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tradera-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="vintage ullkappa"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={usage?.limit_reached}
                />
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || usage?.limit_reached}
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {searchError && !isRateLimited && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md mb-4">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{searchError}</span>
              </div>
            )}

            {hasSearched && searchResults.length === 0 && !searchError && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Package className="w-12 h-12 mb-3 opacity-50" />
                <p>Inga objekt hittades</p>
                <p className="text-sm">Prova andra sökord</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {searchResults.length} resultat ({selectableResults.length} nya)
                    {fromCache && " • från cache"}
                  </span>
                  {selectableResults.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedItems.size === selectableResults.length) {
                          setSelectedItems(new Set());
                        } else {
                          setSelectedItems(new Set(selectableResults.map(i => i.id)));
                        }
                      }}
                    >
                      {selectedItems.size === selectableResults.length ? "Avmarkera alla" : "Välj alla nya"}
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-4">
                    {searchResults.map((item) => {
                      const isExisting = existingRefs.has(String(item.id));
                      const isSelected = selectedItems.has(item.id);
                      const thumbnail = item.imageLinks?.[0] || item.thumbnailLink;
                      const imageCount = item.imageLinks?.length || (item.thumbnailLink ? 1 : 0);

                      return (
                        <div
                          key={item.id}
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
                            onCheckedChange={() => !isExisting && toggleItem(item.id)}
                            disabled={isExisting}
                          />
                          
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={item.shortDescription}
                              className="w-16 h-16 object-cover rounded"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">{item.shortDescription}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {item.buyItNowPrice || item.price
                                  ? `${item.buyItNowPrice || item.price} SEK`
                                  : "Inget pris"}
                              </span>
                              {item.condition && (
                                <>
                                  <span>•</span>
                                  <span className="capitalize">{item.condition}</span>
                                </>
                              )}
                              {imageCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5">
                                    <ImageIcon className="w-3 h-3" />
                                    {imageCount}
                                  </span>
                                </>
                              )}
                              {item.bids !== undefined && item.bids > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{item.bids} bud</span>
                                </>
                              )}
                              {isExisting && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600">Redan importerad</span>
                                </>
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
          </div>

          {/* Import Action */}
          {selectedItems.size > 0 && (
            <div className="border-t pt-4 space-y-3">
              {importProgress && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Hämtar högupplösta bilder...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <Progress value={(importProgress.current / importProgress.total) * 100} className="h-1.5" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <span>{selectedItems.size} objekt valda</span>
                  {usage && selectedItems.size > 0 && (
                    <span className="ml-2 text-xs">
                      (kostar {selectedItems.size} API-anrop)
                    </span>
                  )}
                </div>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Importera med HD-bilder
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
