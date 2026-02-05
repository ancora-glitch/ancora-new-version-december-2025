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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCreateImportItem, type AisCondition, type AisSignals } from "@/hooks/useImportItems";
import { toast } from "sonner";
import { Loader2, Search, Package, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EbayItem {
  itemId: string;
  title: string;
  images: string[];
  price: number | null;
  currency: string;
  condition: AisCondition;
  conditionText: string | null;
  seller: string | null;
  itemUrl: string | null;
  keywords: string[];
}

interface EbaySearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function EbaySearchDrawer({ open, onOpenChange, onImported }: EbaySearchDrawerProps) {
  const createMutation = useCreateImportItem();
  
  // Search form state
  const [keywords, setKeywords] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState<string>("");
  
  // Search results state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EbayItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!keywords.trim()) {
      toast.error("Please enter search keywords");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSelectedItems(new Set());

    try {
      // First, check which eBay items already exist in AIS
      const { data: existingItems } = await supabase
        .from("ancora_import_items")
        .select("source_ref")
        .eq("source_type", "ebay");
      
      const existingSet = new Set((existingItems || []).map(item => item.source_ref));
      setExistingRefs(existingSet);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke("ebay-search", {
        body: {
          keywords: keywords.trim(),
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          condition: condition || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSearchResults(data.items || []);
      setHasSearched(true);

      if (data.items?.length === 0) {
        toast.info("No items found for your search");
      }
    } catch (error: any) {
      console.error("eBay search error:", error);
      setSearchError(error.message || "Search failed");
      toast.error("Search failed: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleItem = (itemId: string) => {
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
      toast.error("Please select items to import");
      return;
    }

    setIsImporting(true);
    let imported = 0;
    let skipped = 0;

    try {
      for (const itemId of selectedItems) {
        const item = searchResults.find(r => r.itemId === itemId);
        if (!item) continue;

        // Check if already exists (dedupe)
        if (existingRefs.has(item.itemId)) {
          skipped++;
          continue;
        }

        // Create AIS record
        const signals: AisSignals = {
          keywords: item.keywords,
          colors: [],
          era: null,
          material: null,
          vibe: null,
        };

        await createMutation.mutateAsync({
          source_type: "ebay",
          source_ref: item.itemId,
          source_url: item.itemUrl,
          title: item.title,
          description: null, // Empty for v1
          images: item.images,
          price: item.price,
          currency: item.currency,
          condition: item.condition,
          provenance: item.seller,
          signals,
          status: "draft",
        });

        imported++;
      }

      if (imported > 0) {
        toast.success(`Imported ${imported} item${imported > 1 ? "s" : ""} as drafts`);
      }
      if (skipped > 0) {
        toast.info(`Skipped ${skipped} already imported item${skipped > 1 ? "s" : ""}`);
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
      toast.error("Import failed: " + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const selectableResults = searchResults.filter(item => !existingRefs.has(item.itemId));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Search eBay</SheetTitle>
          <SheetDescription>
            Find items on eBay and import them as AIS drafts for review.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 mt-6 overflow-hidden">
          {/* Search Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keywords">
                Keywords <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="vintage wool coat"
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

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="minPrice">Min Price</Label>
                <Input
                  id="minPrice"
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice">Max Price</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="1000">New</SelectItem>
                    <SelectItem value="3000">Used</SelectItem>
                  </SelectContent>
                </Select>
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
                <p>No items found</p>
                <p className="text-sm">Try different keywords</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {searchResults.length} results ({selectableResults.length} new)
                  </span>
                  {selectableResults.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedItems.size === selectableResults.length) {
                          setSelectedItems(new Set());
                        } else {
                          setSelectedItems(new Set(selectableResults.map(i => i.itemId)));
                        }
                      }}
                    >
                      {selectedItems.size === selectableResults.length ? "Deselect all" : "Select all new"}
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-4">
                    {searchResults.map((item) => {
                      const isExisting = existingRefs.has(item.itemId);
                      const isSelected = selectedItems.has(item.itemId);

                      return (
                        <div
                          key={item.itemId}
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
                            onCheckedChange={() => !isExisting && toggleItem(item.itemId)}
                            disabled={isExisting}
                          />
                          
                          {item.images[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.title}
                              className="w-16 h-16 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {item.price ? `${item.currency} ${item.price}` : "No price"}
                              </span>
                              <span>•</span>
                              <span className="capitalize">{item.condition}</span>
                              {isExisting && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600">Already imported</span>
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
                {selectedItems.size} item{selectedItems.size > 1 ? "s" : ""} selected
              </span>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Import Selected
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
