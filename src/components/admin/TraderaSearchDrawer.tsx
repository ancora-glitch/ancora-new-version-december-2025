import { useState } from "react";
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
import { useCreateImportItem, type AisCondition, type AisSignals } from "@/hooks/useImportItems";
import { toast } from "sonner";
import { Loader2, Search, Package, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TraderaItem {
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

export function TraderaSearchDrawer({ open, onOpenChange, onImported }: TraderaSearchDrawerProps) {
  const createMutation = useCreateImportItem();
  
  // Search form state
  const [keywords, setKeywords] = useState("");
  
  // Search results state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TraderaItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!keywords.trim()) {
      toast.error("Ange sökord");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSelectedItems(new Set());

    try {
      // Check which Tradera items already exist in AIS
      const { data: existingItems } = await supabase
        .from("ancora_import_items")
        .select("source_ref")
        .eq("source_type", "tradera");
      
      const existingSet = new Set((existingItems || []).map(item => item.source_ref));
      setExistingRefs(existingSet);

      // Call the existing tradera-search edge function
      const { data, error } = await supabase.functions.invoke("tradera-search", {
        body: {
          keywords: keywords.trim(),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSearchResults(data.items || []);
      setHasSearched(true);

      if (data.items?.length === 0) {
        toast.info("Inga objekt hittades");
      }
    } catch (error: any) {
      console.error("Tradera search error:", error);
      setSearchError(error.message || "Sökning misslyckades");
      toast.error("Sökning misslyckades: " + error.message);
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

  const handleImport = async () => {
    if (selectedItems.size === 0) {
      toast.error("Välj objekt att importera");
      return;
    }

    setIsImporting(true);
    let imported = 0;
    let skipped = 0;

    try {
      for (const itemId of selectedItems) {
        const item = searchResults.find(r => r.id === itemId);
        if (!item) continue;

        const sourceRef = String(item.id);

        // Check if already exists (dedupe)
        if (existingRefs.has(sourceRef)) {
          skipped++;
          continue;
        }

        // Use deduplicated high-res images from imageLinks, fall back to thumbnail
        const images = item.imageLinks && item.imageLinks.length > 0
          ? item.imageLinks
          : item.thumbnailLink
          ? [item.thumbnailLink]
          : [];

        // Create AIS record
        const signals: AisSignals = {
          keywords: extractKeywords(item.shortDescription),
          colors: [],
          era: null,
          material: null,
          vibe: null,
        };

        await createMutation.mutateAsync({
          source_type: "tradera",
          source_ref: sourceRef,
          source_url: item.itemLink,
          affiliate_url: item.itemLink, // Tradera doesn't have affiliate URLs
          title: item.shortDescription,
          description: item.longDescription || null,
          images,
          price: item.buyItNowPrice || item.price || null,
          currency: "SEK",
          condition: mapCondition(item.condition),
          provenance: item.sellerAlias || "Tradera",
          signals,
          status: "draft",
        });

        imported++;
      }

      if (imported > 0) {
        toast.success(`Importerade ${imported} objekt som utkast`);
      }
      if (skipped > 0) {
        toast.info(`Hoppade över ${skipped} redan importerade objekt`);
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
    }
  };

  const selectableResults = searchResults.filter(item => !existingRefs.has(String(item.id)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Sök på Tradera</SheetTitle>
          <SheetDescription>
            Hitta objekt på Tradera och importera dem som AIS-utkast för granskning.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 mt-6 overflow-hidden">
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
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {searchError && (
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
            <div className="border-t pt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedItems.size} objekt valda
              </span>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Importera valda
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
