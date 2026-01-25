import { useState, useEffect } from 'react';
import smartcrop from 'smartcrop';

interface CropPosition {
  x: string;
  y: string;
}

const DEFAULT_POSITION: CropPosition = { x: '50%', y: '25%' };

// Cache to avoid re-analyzing the same images
const cropCache = new Map<string, CropPosition>();

export function useSmartCrop(
  imageUrl: string | undefined,
  containerWidth: number = 400,
  containerHeight: number = 500
): { position: CropPosition; isAnalyzing: boolean } {
  const [position, setPosition] = useState<CropPosition>(DEFAULT_POSITION);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setPosition(DEFAULT_POSITION);
      return;
    }

    // Check cache first
    const cached = cropCache.get(imageUrl);
    if (cached) {
      setPosition(cached);
      return;
    }

    const analyzeImage = async () => {
      setIsAnalyzing(true);
      
      try {
        // Create an image element to analyze
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = imageUrl;
        });

        // Use smartcrop to find the best crop area (focuses on faces and points of interest)
        const result = await smartcrop.crop(img, {
          width: containerWidth,
          height: containerHeight,
          // Boost face detection
          boost: [],
          ruleOfThirds: true,
        });

        if (result && result.topCrop) {
          const { x, y, width, height } = result.topCrop;
          
          // Calculate the center point of the detected area
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          
          // Convert to percentage of original image
          const xPercent = Math.round((centerX / img.naturalWidth) * 100);
          const yPercent = Math.round((centerY / img.naturalHeight) * 100);
          
          // Clamp values to reasonable range
          const clampedX = Math.max(20, Math.min(80, xPercent));
          const clampedY = Math.max(15, Math.min(85, yPercent));
          
          const newPosition = { x: `${clampedX}%`, y: `${clampedY}%` };
          
          // Cache the result
          cropCache.set(imageUrl, newPosition);
          setPosition(newPosition);
        } else {
          cropCache.set(imageUrl, DEFAULT_POSITION);
          setPosition(DEFAULT_POSITION);
        }
      } catch (error) {
        // On error, use default position
        console.warn('Smart crop analysis failed, using default position:', error);
        cropCache.set(imageUrl, DEFAULT_POSITION);
        setPosition(DEFAULT_POSITION);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeImage();
  }, [imageUrl, containerWidth, containerHeight]);

  return { position, isAnalyzing };
}

// Component wrapper for stories that need smart cropping
export function getObjectPosition(position: CropPosition): string {
  return `${position.x} ${position.y}`;
}
