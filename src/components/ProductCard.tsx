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
    <div className="group bg-ancora-cream rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={image}
          alt={`${brand} - ${name}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Wishlist Heart Icon */}
        <button
          onClick={handleWishlistClick}
          className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors duration-200"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={`w-5 h-5 transition-colors duration-200 ${
              isWishlisted
                ? "fill-ancora-burgundy text-ancora-burgundy"
                : "text-foreground hover:text-ancora-burgundy"
            }`}
          />
        </button>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-2">
        {/* Brand */}
        <p className="font-sans text-xs font-bold uppercase tracking-wider text-foreground">
          {brand}
        </p>
        
        {/* Product Name */}
        <p className="font-sans text-sm text-muted-foreground line-clamp-2">
          {name}
        </p>
        
        {/* Price */}
        <p className="font-sans text-base font-bold text-foreground">
          {price}
        </p>
        
        {/* Explore Link */}
        <button
          onClick={onExplore}
          className="font-sans text-xs text-muted-foreground hover:text-ancora-burgundy transition-colors duration-200 mt-2"
        >
          Explore →
        </button>
      </div>
    </div>
  );
};
