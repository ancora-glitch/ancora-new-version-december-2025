import { useState } from "react";
import { Heart } from "lucide-react";
import { ProductModal } from "./ProductModal";
import { RedirectModal } from "./RedirectModal";

interface ProductCardProps {
  image: string;
  brand: string;
  name: string;
  price: string;
  additionalImages?: string[];
  affiliateUrl?: string;
  marketplace?: string;
  onWishlistToggle?: (isWishlisted: boolean) => void;
  onExplore?: () => void;
}

export const ProductCard = ({
  image,
  brand,
  name,
  price,
  additionalImages = [],
  affiliateUrl,
  marketplace,
  onWishlistToggle,
  onExplore
}: ProductCardProps) => {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState(false);

  const handleWishlistClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newState = !isWishlisted;
    setIsWishlisted(newState);
    onWishlistToggle?.(newState);
  };

  const handleExploreClick = () => {
    setIsModalOpen(true);
    onExplore?.();
  };

  return (
    <>
      <div className="group bg-card overflow-hidden border border-border/20">
        {/* Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-2">
          {/* Brand + Heart */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
              {brand}
            </span>
            <button
              onClick={(e) => handleWishlistClick(e)}
              className="p-1 transition-colors duration-200 hover:text-primary"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart
                size={16}
                strokeWidth={1.5}
                className={isWishlisted ? "fill-primary text-primary" : "text-muted-foreground"}
              />
            </button>
          </div>

          {/* Product Name */}
          <p className="text-sm text-muted-foreground leading-relaxed">{name}</p>

          {/* Price + Explore */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-base font-semibold text-foreground">{price}</span>
            <button
              onClick={handleExploreClick}
              className="text-xs tracking-wide text-foreground underline underline-offset-4 hover:text-primary transition-colors duration-200"
            >
              Explore →
            </button>
          </div>
        </div>
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        images={[image, ...additionalImages]}
        brand={brand}
        name={name}
        price={price}
        isWishlisted={isWishlisted}
        onWishlistToggle={() => handleWishlistClick()}
        onBuyNow={() => {
          setIsModalOpen(false);
          setIsRedirectModalOpen(true);
        }}
      />

      <RedirectModal
        isOpen={isRedirectModalOpen}
        onClose={() => setIsRedirectModalOpen(false)}
        redirectUrl={affiliateUrl || "https://example-marketplace.com"}
        marketplaceName={marketplace || "Partner Store"}
      />
    </>
  );
};