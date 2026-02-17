import { useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/hooks/useProducts";
import { deduplicateImages } from "@/lib/imageUtils";
import { trackBuyNowClickBeacon } from "@/hooks/useAnalytics";
import { markProductViewed } from "@/lib/sessionAnalytics";
import { useState } from "react";

// Track product page view (excludes admins) and marks product as viewed in session
const trackProductPageView = async (productId: string, productName: string, brand: string) => {
  try {
    // Mark product as viewed in session (enables Buy Now tracking)
    markProductViewed(productId);
    
    // Check if user is admin - if so, don't track to database
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      
      if (isAdmin) {
        return; // Don't track admin views
      }
    }
    
    // Insert product click event
    await supabase.from("site_analytics").insert([{
      event_type: "product_click",
      page_path: `/product/${productId}`,
      metadata: {
        product_id: productId,
        product_name: productName,
        brand: brand,
        type: "product_page_view"
      }
    }]);
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.error("Product click tracking error:", error);
  }
};

// Clean and validate URL - ensure https:// prefix
const cleanUrl = (url: string | undefined): string => {
  if (!url) return "https://www.instagram.com/ancora_edit/";
  let cleaned = url.trim();
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned;
  }
  if (cleaned.startsWith("http://")) {
    cleaned = cleaned.replace("http://", "https://");
  }
  return cleaned;
};

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const analyticsTrackedRef = useRef(false);
  const hasTrackedPageView = useRef(false);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
       .select("id, name, name_en, name_original, brand, price, image, additional_images, description, description_en, description_original, size, color, condition, material, affiliate_url, marketplace, slug, status, ancora_select_source, updated_at, category_id, language, translated_at")
        .eq("slug", slug)
        // Include sold products to preserve editorial value and SEO
        .in("status", ["active", "published", "sold"])
        .maybeSingle();

      if (error) throw error;
      
      // DEBUG: Log ancora_select_source field
      console.log("[ProductDetail] Product payload:", {
        id: data?.id,
        name: data?.name,
        status: data?.status,
        ancora_select_source: data?.ancora_select_source,
        marketplace: data?.marketplace,
      });
      
      return data;
    },
    enabled: !!slug,
  });

  // Determine if product is sold/unavailable (non-purchasable state)
  const isSoldOrUnavailable = product?.status === "sold";
  
  // Determine provenance source for sold items
  const provenanceSource = useMemo(() => {
    if (!isSoldOrUnavailable || !product) return null;
    const source = product.marketplace?.toLowerCase();
    if (source === "tradera") return "Tradera";
    if (source === "ebay") return "eBay";
    return null;
  }, [isSoldOrUnavailable, product]);

  // INVARIANT:
  // Tradera imports must always use GetItem images (/images/) and render multi-image carousel.
  // If this fails, the import pipeline is broken.
  // Tradera carousels must behave identically to eBay carousels.
  
  // Deduplicate and prioritize high-quality images - must be before early returns
  const allImages = useMemo(() => {
    if (!product) return [];
    
    // Robust parsing of additional_images (handles JSONB as string, array, or null)
    let additionalImages: string[] = [];
    if (product.additional_images) {
      if (Array.isArray(product.additional_images)) {
        additionalImages = product.additional_images as string[];
      } else if (typeof product.additional_images === "string") {
        try {
          const parsed = JSON.parse(product.additional_images);
          additionalImages = Array.isArray(parsed) ? parsed : [];
        } catch {
          console.warn("[ProductDetail] Failed to parse additional_images:", product.additional_images);
          additionalImages = [];
        }
      }
    }
    
    const dedupedImages = deduplicateImages(product.image, additionalImages);
    
    // === INVARIANT CHECK: Tradera products must have multi-image carousel ===
    // Tradera almost always has 4-10 images. <3 means the import pipeline is broken.
    const isTraderaProduct = product.marketplace?.toLowerCase() === "tradera";
    const isPublished = product.status === "active" || product.status === "published";
    
    if (isTraderaProduct && isPublished) {
      if (dedupedImages.length < 3) {
        console.error("[ProductDetail] INVARIANT VIOLATION: Published Tradera product has < 3 images", {
          product_id: product.id,
          product_name: product.name,
          image_count: dedupedImages.length,
          main_image: product.image,
          additional_images_raw: product.additional_images,
          note: "Tradera imports should use GetItem API for full image gallery"
        });
      }
      
      // Check for non-HD images (must contain /images/ path for Tradera)
      const nonHdImages = dedupedImages.filter(url => 
        url.includes("tradera.net") && !url.includes("/images/")
      );
      if (nonHdImages.length > 0) {
        console.error("[ProductDetail] INVARIANT VIOLATION: Tradera product has non-HD images", {
          product_id: product.id,
          non_hd_urls: nonHdImages,
          note: "Images must use /images/ path segment for high resolution"
        });
      }
    }
    
    console.debug("[ProductDetail] Image carousel loaded:", {
      product_id: product.id,
      image_count: dedupedImages.length,
      marketplace: product.marketplace,
    });
    
    return dedupedImages;
  }, [product]);

  // Track product page view when product loads (excludes admins)
  // Use hasTrackedPageView ref to ensure we only track once per page load
  useEffect(() => {
    if (product && !hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackProductPageView(product.id, product.name, product.brand);
    }
  }, [product?.id]);

  // Track Buy Now click for analytics (called on link click)
  const handleBuyNowClick = () => {
    if (!product) return;
    
    if (!analyticsTrackedRef.current) {
      const tracked = trackBuyNowClickBeacon(
        product.id,
        product.name,
        product.brand,
        product.price,
        product.marketplace || "Instagram"
      );
      if (tracked) {
        analyticsTrackedRef.current = true;
      }
    }
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 px-4 md:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <p className="text-muted-foreground text-center py-20">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 px-4 md:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto text-center py-20">
            <h1 className="text-2xl md:text-3xl mb-4 font-serif text-primary">Product not found</h1>
            <p className="text-muted-foreground mb-8">This item may no longer be available.</p>
            <Link 
              to="/home" 
              className="inline-flex items-center gap-2 text-primary hover:underline underline-offset-4"
            >
              <ArrowLeft size={18} />
              Back to home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20 md:pt-24 pb-16 md:pb-24">
        {/* Back Link */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-6 md:mb-8">
          <Link 
            to="/edits" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Back to edit
          </Link>
        </div>

        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            
            {/* Image Gallery - Left Side */}
            <div className="space-y-4">
              {/* Main Image with Carousel */}
              <div className="relative aspect-[4/5] bg-muted rounded-sm overflow-hidden">
                <img
                  src={allImages[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  loading="lazy"
                  width={800}
                  height={1000}
                  className="w-full h-full object-cover"
                />

                {/* Navigation Arrows */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={20} className="text-foreground" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-background/90 backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
                      aria-label="Next image"
                    >
                      <ChevronRight size={20} className="text-foreground" />
                    </button>
                  </>
                )}

                {/* Dot Indicators */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {allImages.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentImageIndex
                            ? "bg-primary"
                            : "bg-background/60"
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnail Strip - Desktop Only */}
              {allImages.length > 1 && (
                <div className="hidden md:flex gap-3 overflow-x-auto pb-2">
                  {allImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-20 h-24 rounded-sm overflow-hidden border-2 transition-colors ${
                        index === currentImageIndex
                          ? "border-primary"
                          : "border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} thumbnail ${index + 1}`}
                        loading="lazy"
                        width={80}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Information - Right Side */}
            <div className="lg:pt-4">
              <div className="lg:sticky lg:top-28 space-y-6">
                {/* Brand */}
                <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {product.brand}
                </p>

                {/* Product Name */}
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif text-primary leading-tight">
                  {product.name}
                </h1>

                {/* Price */}
                <div className="flex items-center gap-3">
                  <p className="text-2xl md:text-3xl font-semibold text-foreground">
                    {formatPrice(product.price)}
                  </p>
                  {/* Show "Updated" badge if price was updated in the last hour */}
                  {product.updated_at && 
                    new Date(product.updated_at).getTime() > Date.now() - 60 * 60 * 1000 && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-primary bg-primary/10 rounded-full animate-pulse">
                      Updated
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Product Metadata - Always displayed in consistent order */}
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="text-sm text-muted-foreground uppercase tracking-wide flex-shrink-0">Size</span>
                    <span className="text-foreground text-right">{product.size || "—"}</span>
                  </div>
                  
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="text-sm text-muted-foreground uppercase tracking-wide flex-shrink-0">Condition</span>
                    <span className="text-foreground text-right">{product.condition || "—"}</span>
                  </div>
                  
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="text-sm text-muted-foreground uppercase tracking-wide flex-shrink-0">Material</span>
                   <span className="text-foreground text-right">{product.material || "—"}</span>
                 </div>
                 
                 <div className="flex justify-between items-baseline gap-4">
                   <span className="text-sm text-muted-foreground uppercase tracking-wide flex-shrink-0">Color</span>
                   <span className="text-foreground text-right">{(product as any).color || "—"}</span>
                 </div>
                </div>

                {/* Description */}
                {((product as any).description_en || product.description) && (
                  <p className="text-muted-foreground leading-relaxed">
                    {(product as any).description_en || product.description}
                  </p>
                )}

                {/* Sold/Unavailable Provenance Notice - SEO indexable */}
                {isSoldOrUnavailable && provenanceSource && (
                  <div className="p-4 bg-muted/50 border border-border rounded-sm">
                    <p className="text-sm text-muted-foreground italic">
                      Originally found on {provenanceSource}
                    </p>
                  </div>
                )}

                {/* Source Badge - eBay, Tradera, and future partners (only for active products) */}
                {!isSoldOrUnavailable && (() => {
                  const source = product.ancora_select_source || product.marketplace?.toLowerCase();
                  
                  if (source === "tradera") {
                    return (
                      <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-foreground bg-accent border border-border rounded-full">
                        Ancora selects from Tradera
                      </span>
                    );
                  }
                  
                  if (source === "ebay") {
                    return (
                      <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-foreground bg-accent border border-border rounded-full">
                        Ancora selects from eBay
                      </span>
                    );
                  }
                  
                  return null;
                })()}

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Purchase CTA - Disabled for sold/unavailable products */}
                {isSoldOrUnavailable ? (
                  <div className="space-y-3">
                    <span className="inline-flex items-center justify-center px-8 py-3 min-h-[44px] bg-muted text-muted-foreground font-medium rounded-sm cursor-not-allowed select-none">
                      No longer available
                    </span>
                    <p className="text-xs text-muted-foreground">
                      This item has been sold or is no longer listed.
                    </p>
                  </div>
                ) : (
                  <a
                    href={cleanUrl(product.affiliate_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleBuyNowClick}
                    className="inline-flex items-center justify-center px-8 py-3 min-h-[44px] min-w-[44px] bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors touch-manipulation select-none"
                  >
                    Buy now
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
