import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Check, ExternalLink } from "lucide-react";

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

const TraderaSearch = () => {
  const [keywords, setKeywords] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TraderaItem[]>([]);
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const handleSearch = async () => {
    if (!keywords.trim() && !brand.trim()) {
      toast.error("Please enter keywords or a brand name");
      return;
    }

    setIsSearching(true);
    setResults([]);

    try {
      // Combine keywords and brand for search
      const searchTerms = [keywords, brand].filter(Boolean).join(" ");
      
      const { data, error } = await supabase.functions.invoke("tradera-search", {
        body: { 
          keywords: searchTerms,
          categoryId: category ? parseInt(category) : undefined,
        },
      });

      if (error) {
        console.error("Search error:", error);
        toast.error("Failed to search Tradera: " + error.message);
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setResults(data.items || []);
      
      if (data.items?.length === 0) {
        toast.info("No results found");
      } else {
        toast.success(`Found ${data.items.length} items`);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search Tradera");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchItemDetails = async (itemId: number): Promise<TraderaItemDetail | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("tradera-item", {
        body: { itemId },
      });

      if (error || data.error) {
        console.error("Failed to fetch item details:", error || data.error);
        return null;
      }

      return data.item;
    } catch (e) {
      console.error("Error fetching item details:", e);
      return null;
    }
  };

  const mapCondition = (traderaCondition?: string): string => {
    if (!traderaCondition) return "Good";
    
    const condition = traderaCondition.toLowerCase();
    if (condition.includes("nytt") || condition.includes("new") || condition.includes("oanvänd")) {
      return "New";
    } else if (condition.includes("nyskick") || condition.includes("utmärkt") || condition.includes("excellent")) {
      return "Excellent";
    } else if (condition.includes("mycket bra") || condition.includes("very good")) {
      return "Very Good";
    } else if (condition.includes("bra") || condition.includes("good")) {
      return "Good";
    } else if (condition.includes("acceptabel") || condition.includes("fair")) {
      return "Fair";
    }
    return "Good";
  };

  const createSlug = (brand: string, name: string): string => {
    const combined = `${brand}-${name}`;
    return combined
      .toLowerCase()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100);
  };

  const handleImport = async (item: TraderaItem) => {
    if (importingIds.has(item.id) || importedIds.has(item.id)) return;

    setImportingIds((prev) => new Set(prev).add(item.id));

    try {
      // Fetch full item details
      const details = await fetchItemDetails(item.id);
      
      // Use details if available, otherwise fall back to search result data
      const brand = details?.brand || item.brandName || "Unknown";
      const name = details?.shortDescription || item.shortDescription;
      const price = `${Math.round(details?.price || item.price)} SEK`;
      const mainImage = details?.imageLinks?.[0] || item.thumbnailLink || "";
      const additionalImages = details?.imageLinks?.slice(1) || item.imageLinks?.slice(1) || [];
      const description = details?.longDescription || item.longDescription || "";
      const condition = mapCondition(details?.condition || item.condition);
      const material = details?.material || "";
      const size = details?.size || "";
      const affiliateUrl = details?.itemLink || item.itemLink;
      const slug = createSlug(brand, name);

      // Insert into products table
      const { error } = await supabase.from("products").insert({
        brand,
        name,
        price,
        image: mainImage,
        additional_images: additionalImages,
        description,
        condition,
        material: material || null,
        size: size || null,
        affiliate_url: affiliateUrl,
        status: "active",
        marketplace: "Tradera",
        slug,
      });

      if (error) {
        console.error("Import error:", error);
        toast.error(`Failed to import: ${error.message}`);
        setImportingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
        return;
      }

      toast.success("Product Added!");
      setImportedIds((prev) => new Set(prev).add(item.id));
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import product");
    } finally {
      setImportingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Search Form */}
      <div className="p-6 border border-border rounded-sm bg-card space-y-5">
        <h2 className="font-display text-lg text-primary">Search Tradera</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. vintage dress"
              className="bg-background border-border"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Chanel"
              className="bg-background border-border"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category ID (optional)</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. 344002"
              className="bg-background border-border"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
        </div>

        <Button 
          onClick={handleSearch} 
          disabled={isSearching}
          className="w-full md:w-auto"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Search Tradera
            </>
          )}
        </Button>
      </div>

      {/* Results Grid */}
      {results.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-primary mb-4">
            Results ({results.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((item) => (
              <div
                key={item.id}
                className="border border-border rounded-sm bg-card overflow-hidden group"
              >
                {/* Image */}
                <div className="aspect-square relative bg-muted">
                  {item.thumbnailLink ? (
                    <img
                      src={item.thumbnailLink}
                      alt={item.shortDescription}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                  {/* External link overlay */}
                  <a
                    href={item.itemLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-2 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    {item.brandName && (
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {item.brandName}
                      </p>
                    )}
                    <h3 className="font-medium text-primary line-clamp-2 text-sm">
                      {item.shortDescription}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg">
                      {Math.round(item.price)} SEK
                    </span>
                    {item.bids !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {item.bids} bud
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={() => handleImport(item)}
                    disabled={importingIds.has(item.id) || importedIds.has(item.id)}
                    variant={importedIds.has(item.id) ? "secondary" : "default"}
                    className="w-full"
                    size="sm"
                  >
                    {importingIds.has(item.id) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : importedIds.has(item.id) ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Added
                      </>
                    ) : (
                      "Import to Ancora"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isSearching && results.length === 0 && (
        <div className="text-center py-12 border border-border rounded-sm">
          <p className="text-muted-foreground">
            Search for products on Tradera to import them to Ancora Edit.
          </p>
        </div>
      )}
    </div>
  );
};

export default TraderaSearch;
