import { useState, useEffect, useMemo } from "react";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  useImportToProduct,
  checkProductDuplicate,
} from "@/hooks/useImportToProduct";
import { searchRDBY, fetchRDBYItem } from "@/lib/rdby";
import { translateImport } from "@/lib/translateImport";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Package,
  AlertCircle,
  Store,
  AlertTriangle,
  RotateCcw,
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
const MAX_IMPORT_PER_RUN = 10;
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

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchError(null);
      setWarnings([]);
      setSelectedItems(new Set());
      setImportProgress(null);
      setIsImporting(false);
    }
  }, [open]);

  const selectableResults = useMemo(
    () => searchResults.filter((r) => !existingRefs.has(r.handle)),
    [searchResults, existingRefs]
  );

  const runSearch = async () => {
    setIsSearching(true);
    setSearchError(null);
    setWarnings([]);
    setSelectedItems(new Set());

    try {
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

  const toggleItem = (handle: string) => {
    const next = new Set(selectedItems);
    if (next.has(handle)) next.delete(handle);
    else next.add(handle);
    setSelectedItems(next);
  };

  const importOne = async (item: ReDesignedByItem): Promise<"ok" | "dupe" | "fail"> => {
    const isDupe = await checkProductDuplicate(MARKETPLACE, item.handle, item.affiliateUrl);
    if (isDupe) return "dupe";

    const data = await fetchRDBYItem(item.handle);
    if (data?.error) throw new Error(data.error);
    const detail = data as ReDesignedByItemDetail | null;
    if (!detail) return "fail";

    const images = detail.images.map((i) => i.src);
    const description = detail.descriptionText || detail.title;

    const tx = await translateImport({
      title: detail.title,
      description,
      condition: detail.condition ?? undefined,
      material: detail.material ?? undefined,
      size: detail.size ?? undefined,
      brand: detail.vendor || undefined,
      sourceRef: detail.handle,
    });

    await importMutation.mutateAsync({
      marketplace: MARKETPLACE,
      source_ref: detail.handle,
      source_url: detail.productUrl,
      affiliate_url: detail.affiliateUrl,
      title: detail.title,
      title_original: detail.title,
      title_en: tx.title_en,
      description,
      description_original: description,
      description_en: tx.description_en,
      language: tx.language,
      translated_at: tx.translated_at,
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
    return "ok";
  };

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      toast.error("Select items to import");
      return;
    }
    const handles = Array.from(selectedItems).filter((h) => !existingRefs.has(h));
    const sliced = handles.slice(0, MAX_IMPORT_PER_RUN);
    setIsImporting(true);
    setImportProgress({ current: 0, total: sliced.length });

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const newExisting = new Set(existingRefs);

    for (let i = 0; i < sliced.length; i++) {
      const handle = sliced[i];
      const item = searchResults.find((r) => r.handle === handle);
      setImportProgress({ current: i + 1, total: sliced.length });
      if (!item) {
        failed++;
        continue;
      }
      try {
        const res = await importOne(item);
        if (res === "ok") {
          imported++;
          newExisting.add(handle);
        } else if (res === "dupe") {
          skipped++;
          newExisting.add(handle);
        } else {
          failed++;
        }
      } catch (err: any) {
        console.error(`[ReDesignedBy] Import failed for ${handle}:`, err);
        failed++;
      }
    }

    setExistingRefs(newExisting);
    setSelectedItems(new Set());
    setIsImporting(false);
    setImportProgress(null);

    const parts: string[] = [];
    if (imported) parts.push(`${imported} imported`);
    if (skipped) parts.push(`${skipped} already existed`);
    if (failed) parts.push(`${failed} failed`);
    if (imported > 0) {
      toast.success(parts.join(", "));
      onImported?.();
    } else if (failed > 0) {
      toast.error(parts.join(", ") || "Import failed");
    } else {
      toast.info(parts.join(", "));
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

          {hasSearched && searchResults.length === 0 && !searchError && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p>Inga produkter hittades</p>
              {keywords && <p className="text-sm">Försök med andra sökord</p>}
            </div>
          )}

          {searchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {searchResults.length} resultat ({selectableResults.length} nya)
                </span>
                {selectableResults.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedItems.size === selectableResults.length) {
                        setSelectedItems(new Set());
                      } else {
                        setSelectedItems(new Set(selectableResults.map((i) => i.handle)));
                      }
                    }}
                  >
                    {selectedItems.size === selectableResults.length
                      ? "Avmarkera alla"
                      : "Välj alla nya"}
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
                          onCheckedChange={() => !isExisting && toggleItem(item.handle)}
                          disabled={isExisting || isImporting}
                        />

                        {item.primaryImage ? (
                          <img
                            src={item.primaryImage}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                          {item.vendor && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.vendor}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium text-foreground">
                              {item.price != null ? `${item.price} SEK` : "No price"}
                            </span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>{item.size}</span>
                              </>
                            )}
                            {!item.available && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                Sold out
                              </Badge>
                            )}
                            {isExisting && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
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

          {importProgress && (
            <div className="space-y-2">
              <Progress value={(importProgress.current / importProgress.total) * 100} />
              <p className="text-xs text-muted-foreground text-center">
                Importing {importProgress.current}/{importProgress.total}...
              </p>
            </div>
          )}

          {selectedItems.size > 0 && (
            <div className="space-y-2">
              {selectedItems.size > MAX_IMPORT_PER_RUN && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Only the first {MAX_IMPORT_PER_RUN} items will be imported in this run.
                </p>
              )}
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Package className="w-4 h-4 mr-2" />
                )}
                Importera {Math.min(selectedItems.size, MAX_IMPORT_PER_RUN)} plagg som draft
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
