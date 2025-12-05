import { useState } from "react";
import { Heart } from "lucide-react";

interface ProductCardProps {
  image: string;
  brand: string;
  name: string;
  price: string;
  onWishlistToggle?: (isWishlisted: boolean) => void;
  onExplore?: () => void;
}

export const ProductCard = ({
  image,
  brand,
  name,
  price,
  onWishlistToggle,
  onExplore,
}: ProductCardProps) => {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const handleWishlistClick = () => {
    const newState = !isWishlisted;
    setIsWishlisted(newState);
    onWishlistToggle?.(newState);
  };

  return (
    <div className="group">
      {/* Image Container */}
      <div className="aspect-[4/5] overflow-hidden bg-[#f5f5f5] mb-3">
        <img
          src={image}
          alt={`${brand} - ${name}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Card Content */}
      <div className="space-y-1">
        {/* Brand and Heart Row */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-sans text-sm font-bold uppercase tracking-wide text-foreground">
            {brand}
          </p>
          <button
            onClick={handleWishlistClick}
            className="flex-shrink-0 mt-0.5"
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`w-5 h-5 transition-colors duration-200 ${
                isWishlisted
                  ? "fill-ancora-burgundy text-ancora-burgundy"
                  : "text-foreground/60 hover:text-ancora-burgundy"
              }`}
            />
          </button>
        </div>
        
        {/* Product Name */}
        <p className="font-sans text-sm text-muted-foreground line-clamp-1">
          {name}
        </p>
        
        {/* Price and Explore Row */}
        <div className="flex items-center justify-between pt-2">
          <p className="font-sans text-sm font-bold text-foreground">
            {price}
          </p>
          <button
            onClick={onExplore}
            className="font-sans text-sm text-foreground hover:text-ancora-burgundy transition-colors duration-200 underline underline-offset-2"
          >
            Explore →
          </button>
        </div>
      </div>
    </div>
  );
};
