import { useState } from "react";
import { Heart } from "lucide-react";
import { ProductModal } from "./ProductModal";
import { trackClick } from "@/hooks/useAnalytics";

interface ProductCardProps {
  id: string;
  slug?: string;
  image: string;
  brand: string;
  name: string;
  price: string;
  additionalImages?: string[];
  affiliateUrl?: string;
  marketplace?: string;
  onWishlistToggle?: (isWishlisted: boolean) => void;
}

export const ProductCard = ({
  id,
  slug,
  image,
  brand,
  name,
  price,
  additionalImages = [],
  affiliateUrl,
  marketplace,
  onWishlistToggle,
}: ProductCardProps) => {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !isWishlisted;
    setIsWishlisted(newState);
    onWishlistToggle?.(newState);
  };

  const handleCardClick = () => {
    // Track the product click
    trackClick("/products", { 
      product_id: id, 
      product_name: name, 
      brand: brand,
      type: "product_card" 
    });
    setIsModalOpen(true);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group block bg-card overflow-hidden border border-border/20 hover:border-border/40 hover:bg-secondary/10 transition-all duration-300 cursor-pointer"
      >
        {/* Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
          <img
            src={image}
            alt={name}
            loading="lazy"
            width={400}
            height={500}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300" />
        </div>

        {/* Card Content */}
        <div className="p-4 space-y-2">
          {/* Brand + Heart */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
              {brand}
            </span>
            <button
              onClick={handleWishlistClick}
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

          {/* Price */}
          <div className="pt-2">
            <span className="text-base font-semibold text-foreground">{price}</span>
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
        productId={id}
        affiliateUrl={affiliateUrl}
        marketplace={marketplace}
        isWishlisted={isWishlisted}
        onWishlistToggle={() => {
          const newState = !isWishlisted;
          setIsWishlisted(newState);
          onWishlistToggle?.(newState);
        }}
      />
    </>
  );
};