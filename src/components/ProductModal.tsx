import { useState } from "react";
import { X, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  brand: string;
  name: string;
  price: string;
  isWishlisted?: boolean;
  onWishlistToggle?: () => void;
  onBuyNow?: () => void;
}

export const ProductModal = ({
  isOpen,
  onClose,
  images,
  brand,
  name,
  price,
  isWishlisted = false,
  onWishlistToggle,
  onBuyNow,
}: ProductModalProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!isOpen) return null;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 max-w-md w-[95vw] bg-gradient-to-b from-secondary to-background rounded-lg overflow-hidden animate-fade-up shadow-xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
          aria-label="Close modal"
        >
          <X size={20} className="text-foreground" />
        </button>

        {/* Image Carousel */}
        <div className="relative w-full aspect-[4/5] bg-muted">
          <img
            src={images[currentImageIndex]}
            alt={`${name} - Image ${currentImageIndex + 1}`}
            className="w-full h-full object-cover"
          />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} className="text-foreground" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                aria-label="Next image"
              >
                <ChevronRight size={20} className="text-foreground" />
              </button>
            </>
          )}

          {/* Dot Indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
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

        {/* Product Details */}
        <div className="p-6 space-y-4">
          {/* Brand + Heart */}
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-bold uppercase tracking-wider text-foreground">
              {brand}
            </span>
            <button
              onClick={onWishlistToggle}
              className="p-1.5 transition-colors hover:text-primary"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart
                size={22}
                className={isWishlisted ? "fill-primary text-primary" : "text-foreground"}
              />
            </button>
          </div>

          {/* Product Name */}
          <p className="font-sans text-base text-muted-foreground">{name}</p>

          {/* Price */}
          <p className="font-sans text-2xl font-bold text-foreground">{price}</p>

          {/* Buy now Button */}
          <Button
            onClick={onBuyNow}
            className="w-full h-14 text-base font-semibold uppercase tracking-wide"
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
};