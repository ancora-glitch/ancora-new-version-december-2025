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
import { supabase } from "@/integrations/supabase/client";
import {
  useImportToProduct,
  checkProductDuplicate,
} from "@/hooks/useImportToProduct";
import { searchRDBY, fetchRDBYItem } from "@/lib/rdby";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Package,
  AlertCircle,
  Store,
  AlertTriangle,
  RotateCcw,
  Check,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ReDesignedByItem {
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
  affiliateUrl: string;
  tags: string[];
}

interface ReDesignedByItemDetail {
  external_id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  price: number;
  currency: string;
  condition: string | null;
  era: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  available: boolean;
  descriptionHtml: string;
  descriptionText: string;
  images: { src: string; alt: string | null; position: number }[];
  productUrl: string;
  affiliateUrl: string;
  tags: string[];
  sku: string;
  marketplace: "redesignedby";
  status: "draft";
}

interface ReDesignedBySearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const MAX_RESULTS = 10;
const MARKETPLACE = "redesignedby";

export function ReDesignedBySearchDrawer({
  open,
  onOpenChange,
  onImported,
}: ReDesignedBySearchDrawerProps) {
  const importMutation = useImportToProduct();

  const [keywords, setKeywords] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ReDesignedByItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Per-card import state
  const [importingHandle, setImportingHandle] = useState<string | null>(null);
  const [importedHandles, setImportedHandles] = useState<Set<string>>(new Set());
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchError(null);
      setWarnings([]);
      setImportingHandle(null);
    }
  }, [open]);

  const runSearch = async () => {
    setIsSearching(true);
    setSearchError(null);
    setWarnings([]);

    try {
      // Check existing redesignedby products to mark them as already imported
      const { data: existingProducts } = await supabase
        .from("products")
        .select("slug, affiliate_url")
        .eq("marketplace", MARKETPLACE);

      const existingSet = new Set<string>();
      for (const p of existingProducts || []) {
        if (p.slug) existingSet.add(p.slug);
        const match = p.affiliate_url?.match(/\/products\/([^?#]+)/);
        if (match) existingSet.add(match[1]);
      }
      setExistingRefs(existingSet);

      const data = await searchRDBY({
        keywords: keywords.trim() || undefined,
        limit: MAX_RESULTS,
      });

      if (data?.error) throw new Error(data.error);

      setSearchResults(data?.products || []);
      setWarnings(data?.warnings || []);
      setHasSearched(true);
    } catch (err: any) {
      console.error("ReDesignedBy search error:", err);
      setSearchError(err.message || "Search failed");
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchItemDetails = async (
    handle: string
  ): Promise<ReDesignedByItemDetail | null> => {
    const data = await fetchRDBYItem(handle);
    if (data?.error) throw new Error(data.error);
    return (data as ReDesignedByItemDetail) || null;
  };

  const handleImportOne = async (item: ReDesignedByItem) => {
    setImportingHandle(item.handle);
    try {
      // Dedupe check
      const isDupe = await checkProductDuplicate(
        MARKETPLACE,
        item.handle,
        item.affiliateUrl
      );
      if (isDupe) {
        toast.info("Already imported");
        setImportedHandles((s) => new Set(s).add(item.handle));
        return;
      }

      const detail = await fetchItemDetails(item.handle);
      if (!detail) {
        toast.error("Could not fetch product details");
        return;
      }

      const images = detail.images.map((i) => i.src);
      const description = detail.descriptionText || detail.title;

      await importMutation.mutateAsync({
        marketplace: MARKETPLACE, // invariant
        source_ref: detail.handle,
        source_url: detail.productUrl,
        affiliate_url: detail.affiliateUrl, // stored only, never shown in UI
        title: detail.title,
        title_en: detail.title,
        title_original: detail.title,
        description,
        description_en: description,
        description_original: description,
        language: "sv",
        brand: detail.vendor || "Unknown",
        size: detail.size,
        color: detail.color,
        material: detail.material,
        condition: detail.condition,
        price: detail.price,
        currency: detail.currency || "SEK",
        primary_image: images[0] || null,
        images,
        category_id: null,
        provenance: detail.vendor || "ReDesignedBy",
        condition_enum: detail.condition,
        signals: {
          keywords: detail.tags,
          colors: detail.color ? [detail.color] : [],
          era: detail.era,
          material: detail.material,
          vibe: null,
          productType: detail.productType,
        },
      });

      setImportedHandles((s) => new Set(s).add(item.handle));
      toast.success("Created draft product", {
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
      onImported?.();
    } catch (err: any) {
      console.error(`[ReDesignedBy] Import failed for ${item.handle}:`, err);
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImportingHandle(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Store className="w-5 h-5" />
            Search ReDesignedBy
          </SheetTitle>
          <SheetDescription>
            Browse ReDesignedBy catalog and import items as draft products.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 mt-6 overflow-hidden">
          {/* Search Form */}
          <div className="space-y-2">
            <Label htmlFor="rdb-keywords">
              Keywords{" "}
              <span className="text-muted-foreground text-xs">
                (optional — leave empty to browse all)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="rdb-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="silk dress, wool coat..."
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && !isSearching && runSearch()}
                disabled={isSearching}
              />
              <Button onClick={runSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Max {MAX_RESULTS} resultat per sökning. Importer skapas alltid som draft.
            </p>
          </div>

          {/* Warnings (yellow info box) */}
          {warnings.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-md">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                {warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Fetch error with retry */}
          {searchError && (
            <div className="flex items-start justify-between gap-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{searchError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runSearch}
                disabled={isSearching}
                className="flex-shrink-0"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {hasSearched && searchResults.length === 0 && !searchError && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p>Inga produkter hittades</p>
              {keywords && (
                <p className="text-sm">Försök med andra sökord</p>
              )}
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                {searchResults.length} resultat
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {searchResults.map((item) => {
                    const isExisting =
                      existingRefs.has(item.handle) ||
                      importedHandles.has(item.handle);
                    const isImportingThis = importingHandle === item.handle;
                    const isAnyImporting = importingHandle !== null;

                    return (
                      <div
                        key={item.handle}
                        className={`flex gap-3 p-3 border rounded-md transition-colors ${
                          isExisting
                            ? "opacity-60 bg-muted border-border"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {item.primaryImage ? (
                          <img
                            src={item.primaryImage}
                            alt={item.title}
                            className="w-20 h-20 object-cover rounded flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col">
                          <p className="font-medium text-sm line-clamp-2">
                            {item.title}
                          </p>
                          {item.vendor && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.vendor}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium text-foreground">
                              {item.price != null
                                ? `${item.price} SEK`
                                : "No price"}
                            </span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>{item.size}</span>
                              </>
                            )}
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

                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant={isExisting ? "outline" : "default"}
                              disabled={
                                isExisting || isImportingThis || isAnyImporting
                              }
                              onClick={() => handleImportOne(item)}
                            >
                              {isImportingThis ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Importerar...
                                </>
                              ) : isExisting ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Importerad
                                </>
                              ) : (
                                <>
                                  <Package className="w-3 h-3 mr-1" />
                                  Importera
                                </>
                              )}
                            </Button>
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
      </SheetContent>
    </Sheet>
  );
}
