import { useState, useEffect, useRef } from 'react';
import smartcrop from 'smartcrop';

interface SmartCropImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackPosition?: string;
  loading?: 'lazy' | 'eager';
  width?: number;
  height?: number;
}

// Global cache for crop positions
const cropPositionCache = new Map<string, string>();

export function SmartCropImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  fallbackPosition = '50% 25%',
  loading = 'lazy',
  width,
  height,
}: SmartCropImageProps) {
  const [objectPosition, setObjectPosition] = useState(fallbackPosition);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) return;

    // Check cache first
    const cached = cropPositionCache.get(src);
    if (cached) {
      setObjectPosition(cached);
      return;
    }

    const analyzeImage = async () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load'));
          img.src = src;
        });

        // Get container dimensions for optimal crop calculation
        const containerWidth = containerRef.current?.offsetWidth || 400;
        const containerHeight = containerRef.current?.offsetHeight || 500;

        const result = await smartcrop.crop(img, {
          width: containerWidth,
          height: containerHeight,
          ruleOfThirds: true,
        });

        if (result?.topCrop) {
          const { x, y, width: cropWidth, height: cropHeight } = result.topCrop;
          
          // Calculate center of the crop area
          const centerX = x + cropWidth / 2;
          const centerY = y + cropHeight / 2;
          
          // Convert to percentage
          const xPercent = Math.round((centerX / img.naturalWidth) * 100);
          const yPercent = Math.round((centerY / img.naturalHeight) * 100);
          
          // Clamp to safe range
          const clampedX = Math.max(20, Math.min(80, xPercent));
          const clampedY = Math.max(10, Math.min(90, yPercent));
          
          const position = `${clampedX}% ${clampedY}%`;
          cropPositionCache.set(src, position);
          setObjectPosition(position);
        } else {
          cropPositionCache.set(src, fallbackPosition);
          setObjectPosition(fallbackPosition);
        }
      } catch (error) {
        // Silently fall back to default
        cropPositionCache.set(src, fallbackPosition);
        setObjectPosition(fallbackPosition);
      }
    };

    analyzeImage();
  }, [src, fallbackPosition]);

  return (
    <div ref={containerRef} className={containerClassName}>
      {hasError ? (
        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          width={width}
          height={height}
          className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectPosition }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
