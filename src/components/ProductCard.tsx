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
  onExplore
}: ProductCardProps) => {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const handleWishlistClick = () => {
    const newState = !isWishlisted;
    setIsWishlisted(newState);
    onWishlistToggle?.(newState);
  };

  return (
    <div className="group bg-ancora-cream/50 rounded-lg overflow-hidden">
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-ancora-cream">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-1">
        {/* Brand + Heart */}
        <div className="flex items-center justify-between">
          <span className="font-sans text-sm font-bold uppercase tracking-wide text-foreground">
            {brand}
          </span>
          <button
            onClick={handleWishlistClick}
            className="p-1 transition-colors hover:text-ancora-burgundy"
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={18}
              className={isWishlisted ? "fill-ancora-burgundy text-ancora-burgundy" : "text-foreground"}
            />
          </button>
        </div>

        {/* Product Name */}
        <p className="font-sans text-sm text-muted-foreground">{name}</p>

        {/* Price + Explore */}
        <div className="flex items-center justify-between pt-2">
          <span className="font-sans text-base font-bold text-foreground">{price}</span>
          <button
            onClick={onExplore}
            className="font-sans text-sm text-foreground underline underline-offset-2 hover:text-ancora-burgundy transition-colors"
          >
            Explore →
          </button>
        </div>
      </div>
    </div>
  );
};
