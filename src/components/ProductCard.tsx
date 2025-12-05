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
  return <div className="group">
      {/* Image Container */}
      

      {/* Card Content */}
      
    </div>;
};