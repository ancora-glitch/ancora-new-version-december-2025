import { useMemo, useEffect, useState, useRef } from "react";
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
import { RedirectModal } from "@/components/RedirectModal";

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
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);
  const analyticsTrackedRef = useRef(false);
  const hasTrackedPageView = useRef(false);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        // Support both legacy `published` and canonical `active` visible statuses
        .in("status", ["active", "published"])
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Deduplicate and prioritize high-quality images - must be before early returns
  const allImages = useMemo(() => {
    if (!product) return [];
    const additionalImages = Array.isArray(product.additional_images) 
      ? (product.additional_images as string[]) 
      : [];
    return deduplicateImages(product.image, additionalImages);
  }, [product]);

  // Track product page view when product loads (excludes admins)
  // Use hasTrackedPageView ref to ensure we only track once per page load
  useEffect(() => {
    if (product && !hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackProductPageView(product.id, product.name, product.brand);
    }
  }, [product?.id]);

  // Handle Buy Now click - open modal instead of direct navigation
  const handleBuyNowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!product) return;
    
    // Track analytics
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
    
    // Open the redirect modal
    setIsRedirectModalOpen(true);
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

                {/* Product Details */}
                <div className="space-y-4">
                  {product.condition && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground uppercase tracking-wide">Condition</span>
                      <span className="text-foreground">{product.condition}</span>
                    </div>
                  )}
                  
                  {product.material && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground uppercase tracking-wide">Material</span>
                      <span className="text-foreground">{product.material}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-muted-foreground leading-relaxed">
                    {product.description}
                  </p>
                )}

                {/* Marketplace */}
                {product.marketplace && (
                  <span className="inline-flex items-center px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground bg-muted rounded-full">
                    {product.marketplace}
                  </span>
                )}

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Purchase CTA - Button triggers modal, not direct navigation */}
                <button
                  onClick={handleBuyNowClick}
                  className="relative z-50 pointer-events-auto inline-flex items-center justify-center px-8 py-3 min-h-[44px] min-w-[44px] bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors touch-manipulation select-none"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  Buy now
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Redirect confirmation modal */}
      <RedirectModal
        isOpen={isRedirectModalOpen}
        onClose={() => setIsRedirectModalOpen(false)}
        redirectUrl={cleanUrl(product.affiliate_url)}
        partnerName={product.marketplace || "our partner"}
      />
    </div>
  );
};

export default ProductDetail;
