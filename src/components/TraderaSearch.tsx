import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Check, ExternalLink } from "lucide-react";
import { determineBrand } from "@/lib/brandExtractor";
import { deduplicateImages } from "@/lib/imageUtils";

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

interface TranslationResult {
  name: string;
  description: string;
  condition: string;
  material: string;
  size: string;
  original: {
    name: string;
    description: string;
    condition: string;
    material: string;
    size: string;
  };
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

      // If rate-limited, return null - import will fail and user can retry
      if (data.rateLimited) {
        console.warn("Tradera API rate limited - try again later");
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

  const translateContent = async (
    name: string,
    description: string,
    condition: string,
    material: string,
    size: string,
    brand: string
  ): Promise<TranslationResult> => {
    try {
      console.log('Translating Swedish content...');
      const { data, error } = await supabase.functions.invoke("translate-swedish", {
        body: { name, description, condition, material, size, brand },
      });

      if (error) {
        // Log silently - translation failure is non-blocking
        console.warn("Translation warning (non-blocking):", error.message);
        return {
          name,
          description,
          condition,
          material,
          size,
          original: { name, description, condition, material, size },
        };
      }

      // Check if response contains an error field (edge function returned error JSON)
      if (data?.error) {
        console.warn("Translation warning (non-blocking):", data.error);
        return {
          name,
          description,
          condition,
          material,
          size,
          original: { name, description, condition, material, size },
        };
      }

      console.log('Translation successful');
      return data as TranslationResult;
    } catch (e) {
      // Log silently - translation failure is non-blocking
      console.warn("Translation warning (non-blocking):", e);
      return {
        name,
        description,
        condition,
        material,
        size,
        original: { name, description, condition, material, size },
      };
    }
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

  /**
   * STRICT: Only extracts images from the full GetItem payload.
   * NEVER uses search-result images as they are incomplete.
   * Returns null if details are not available.
   */
  const extractImagesFromFullPayload = (
    details: TraderaItemDetail
  ): string[] => {
    const allImages: string[] = [];

    // Helper to safely extract URLs from any value (handles nested objects, arrays, strings)
    const extractUrls = (value: unknown): void => {
      if (!value) return;
      
      if (typeof value === 'string' && value.startsWith('http')) {
        allImages.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          extractUrls(item);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Handle objects with url/Url/URL properties
        const obj = value as Record<string, unknown>;
        if (obj.url) extractUrls(obj.url);
        if (obj.Url) extractUrls(obj.Url);
        if (obj.URL) extractUrls(obj.URL);
        // Recursively check all properties for nested image objects
        for (const key of Object.keys(obj)) {
          if (key.toLowerCase().includes('image') || key.toLowerCase().includes('url')) {
            extractUrls(obj[key]);
          }
        }
      }
    };

    // ONLY extract from full item details - never from search results
    extractUrls(details.imageLinks);

    // Normalize all URLs to HTTPS
    const normalizedImages = allImages.map(url => 
      url.replace(/^http:\/\//i, 'https://')
    );

    // Use the shared deduplication utility
    if (normalizedImages.length === 0) return [];
    
    // deduplicateImages expects (mainImage, additionalImages)
    return deduplicateImages(normalizedImages[0], normalizedImages.slice(1));
  };

  /**
   * Uploads images to Supabase storage via the edge function.
   * Returns an array of storage URLs (may be shorter than input if some fail).
   */
  const uploadImagesToStorage = async (
    imageUrls: string[],
    traderaItemId: string
  ): Promise<string[]> => {
    try {
      console.log(`Uploading ${imageUrls.length} images to storage for Tradera item ${traderaItemId}...`);
      
      const { data, error } = await supabase.functions.invoke("tradera-upload-images", {
        body: { imageUrls, traderaItemId },
      });

      if (error) {
        console.error("Failed to upload images:", error);
        return [];
      }

      if (!data.success || !data.storageUrls || data.storageUrls.length === 0) {
        console.error("No images were uploaded successfully:", data);
        return [];
      }

      console.log(`Successfully uploaded ${data.storageUrls.length} of ${imageUrls.length} images`);
      return data.storageUrls;
    } catch (e) {
      console.error("Error uploading images to storage:", e);
      return [];
    }
  };

  /**
   * Creates a pending import record so the product is visible immediately.
   * Image uploads are handled asynchronously by tradera-retry-import.
   */
  const createPendingImport = async (
    item: TraderaItem,
    details: TraderaItemDetail,
    extractedBrand: string,
    cleanedName: string
  ): Promise<{ id: string } | null> => {
    const traderaItemId = String(item.id);
    const price = `${Math.round(details.price)} SEK`;
    const slug = createSlug(extractedBrand, cleanedName);

    // Check if product already exists
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, status")
      .eq("tradera_item_id", traderaItemId)
      .maybeSingle();

    if (existingProduct) {
      // Reset existing product to pending_import for re-import
      const { error } = await supabase
        .from("products")
        .update({
          status: "pending_import",
          import_retry_count: 0,
          import_queued_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", existingProduct.id);

      if (error) {
        console.error("Failed to reset product for re-import:", error);
        return null;
      }
      return { id: existingProduct.id };
    }

    // Create new pending product with minimal data
    const { data, error } = await supabase
      .from("products")
      .insert({
        brand: extractedBrand,
        name: cleanedName,
        name_sv: cleanedName, // Will be updated by retry function
        price,
        image: details.imageLinks?.[0]?.replace(/^http:\/\//i, 'https://') || "pending",
        status: "pending_import",
        marketplace: "Tradera",
        slug,
        tradera_item_id: traderaItemId,
        affiliate_url: details.itemLink,
        import_queued_at: new Date().toISOString(),
        import_retry_count: 0,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create pending import:", error);
      return null;
    }

    return data;
  };

  /**
   * Attempts a full synchronous import with images.
   * If successful, returns true. If it fails, returns false.
   */
  const attemptFullImport = async (
    item: TraderaItem,
    details: TraderaItemDetail,
    extractedBrand: string,
    cleanedName: string
  ): Promise<boolean> => {
    const traderaItemId = String(item.id);
    const price = `${Math.round(details.price)} SEK`;
    
    // Extract images from full payload
    const allUniqueImages = extractImagesFromFullPayload(details);
    console.log(`Extracted ${allUniqueImages.length} unique images from full payload for item ${item.id}`);
    
    if (allUniqueImages.length === 0) {
      console.warn("No images found in Tradera listing");
      return false;
    }
    
    // Try to upload images
    toast.info(`Uploading ${allUniqueImages.length} images...`, { duration: 2000 });
    const storageUrls = await uploadImagesToStorage(allUniqueImages, traderaItemId);
    
    if (storageUrls.length === 0) {
      console.warn("Failed to upload images - will retry later");
      return false;
    }
    
    const mainImage = storageUrls[0];
    const additionalImages = storageUrls.slice(1);
    
    const originalDescription = details.longDescription || "";
    const originalCondition = details.condition || "";
    const originalMaterial = details.material || "";
    const originalSize = details.size || "";
    const affiliateUrl = details.itemLink;

    // Translate content (non-blocking - falls back to Swedish on failure)
    const translated = await translateContent(
      cleanedName,
      originalDescription,
      originalCondition,
      originalMaterial,
      originalSize,
      extractedBrand
    );

    const mappedCondition = mapCondition(translated.condition);
    const slug = createSlug(extractedBrand, translated.name);

    // Check for existing product
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("tradera_item_id", traderaItemId)
      .maybeSingle();

    const productData = {
      brand: extractedBrand,
      name: translated.name,
      name_sv: translated.original.name,
      price,
      image: mainImage,
      additional_images: additionalImages,
      description: translated.description,
      description_sv: translated.original.description,
      condition: mappedCondition,
      condition_sv: translated.original.condition,
      material: translated.material || null,
      material_sv: translated.original.material || null,
      size: translated.size || null,
      size_sv: translated.original.size || null,
      affiliate_url: affiliateUrl,
      status: "draft",
      marketplace: "Tradera",
      slug,
      import_retry_count: 0,
      import_queued_at: null,
    } as any;

    let error;
    if (existingProduct) {
      const { error: updateError } = await supabase
        .from("products")
        .update(productData)
        .eq("id", existingProduct.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("products")
        .insert({
          ...productData,
          tradera_item_id: traderaItemId,
        });
      error = insertError;
    }

    if (error) {
      console.error("Failed to save product:", error);
      return false;
    }

    return true;
  };

  const handleImport = async (item: TraderaItem) => {
    if (importingIds.has(item.id) || importedIds.has(item.id)) return;

    setImportingIds((prev) => new Set(prev).add(item.id));

    try {
      // Step 1: Fetch full item details
      const details = await fetchItemDetails(item.id);
      
      if (!details) {
        toast.error("Could not fetch item details from Tradera. The API may be rate-limited - please try again later.");
        return;
      }
      
      // Extract brand from title
      const rawTitle = details.shortDescription;
      const apiBrand = details.brand;
      const { brand: extractedBrand, cleanedName } = determineBrand(apiBrand, rawTitle);
      const brandName = extractedBrand || "";
      const originalName = cleanedName || rawTitle;

      // Step 2: Try full synchronous import first
      const fullImportSuccess = await attemptFullImport(item, details, brandName, originalName);
      
      if (fullImportSuccess) {
        toast.success(`Product imported successfully. Go to Products tab to review.`, { duration: 5000 });
        setImportedIds((prev) => new Set(prev).add(item.id));
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["products-all"] });
        return;
      }

      // Step 3: If full import failed, create pending record for async retry
      console.log("Full import failed, creating pending record for async processing...");
      const pendingProduct = await createPendingImport(item, details, brandName, originalName);
      
      if (!pendingProduct) {
        toast.error("Failed to create product record. Please try again.");
        return;
      }

      toast.warning(
        "Product queued for import. Images will be processed shortly. Check the Products tab.",
        { duration: 6000 }
      );
      setImportedIds((prev) => new Set(prev).add(item.id));
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });

    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import product. Please try again.");
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {results.map((item) => {
              // Use thumbnailLink which now contains the best available image
              const imageUrl = item.thumbnailLink;
              
              // Debug log
              console.log(`Tradera item ${item.id}:`, { 
                thumbnailLink: item.thumbnailLink, 
                imageLinks: item.imageLinks 
              });
              
              return (
                <div
                  key={item.id}
                  className="border border-border rounded-sm bg-card overflow-hidden group"
                >
                  {/* Image - Fixed square with 1:1 aspect ratio */}
                  <div className="relative bg-muted overflow-hidden aspect-square">
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt={item.shortDescription}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            console.error(`Image failed to load: ${imageUrl}`);
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.querySelector('.error-placeholder')?.classList.remove('hidden');
                          }}
                        />
                        <div className="error-placeholder hidden w-full h-full flex items-center justify-center text-muted-foreground text-xs absolute inset-0 bg-muted">
                          Image missing
                        </div>
                        <div className="absolute inset-0 bg-black/5" />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}
                    {/* External link overlay */}
                    <a
                      href={item.itemLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-1 right-1 p-1.5 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Content - Compact */}
                  <div className="p-2 space-y-1.5">
                    <div>
                      {item.brandName && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                          {item.brandName}
                        </p>
                      )}
                      <h3 className="font-medium text-primary line-clamp-1 text-xs">
                        {item.shortDescription}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm">
                        {Math.round(item.price)} SEK
                      </span>
                      {item.bids !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          {item.bids} bud
                        </span>
                      )}
                    </div>

                    <Button
                      onClick={() => handleImport(item)}
                      disabled={importingIds.has(item.id) || importedIds.has(item.id)}
                      variant={importedIds.has(item.id) ? "secondary" : "default"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {importingIds.has(item.id) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : importedIds.has(item.id) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
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
