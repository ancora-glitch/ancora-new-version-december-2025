/**
 * Hero Image Selector
 * 
 * Automatically selects the best hero image from a set of imported images.
 * Uses resolution scoring and heuristics to exclude detail shots.
 */

interface ImageAnalysis {
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
  resolution: number; // width * height
  isLikelyDetailShot: boolean;
  score: number;
}

/**
 * Filename patterns that indicate detail/close-up shots
 */
const DETAIL_SHOT_PATTERNS = [
  /detail/i,
  /close[-_]?up/i,
  /zoom/i,
  /macro/i,
  /tag/i,
  /label/i,
  /brand[-_]?tag/i,
  /care[-_]?label/i,
  /size[-_]?tag/i,
  /fabric/i,
  /texture/i,
  /stitch/i,
  /button/i,
  /zipper/i,
  /pocket/i,
  /collar/i,
  /seam/i,
  /lining/i,
  /inside/i,
  /interior/i,
];

/**
 * Checks if URL/filename suggests a detail shot
 */
function isFilenameDetailShot(url: string): boolean {
  const filename = url.split('/').pop()?.toLowerCase() || '';
  return DETAIL_SHOT_PATTERNS.some(pattern => pattern.test(filename));
}

/**
 * Checks if aspect ratio suggests a detail/crop shot
 * Extreme ratios (very tall or very wide) often indicate cropped details
 */
function isExtremeAspectRatio(aspectRatio: number): boolean {
  // Normal fashion photos are typically between 0.6 (portrait) and 1.5 (landscape)
  // Extreme crops are < 0.4 or > 2.5
  return aspectRatio < 0.4 || aspectRatio > 2.5;
}

/**
 * Checks if image is too small to be a hero (likely a thumbnail that slipped through)
 */
function isTooSmall(width: number, height: number): boolean {
  // Hero images should be at least 400px on the smaller dimension
  return Math.min(width, height) < 400;
}

/**
 * Fetches image dimensions using the Image API
 * Returns null if the image fails to load
 */
async function getImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      resolve(null);
    }, 5000); // 5 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    
    img.src = url;
  });
}

/**
 * Analyzes a single image and returns scoring data
 */
async function analyzeImage(url: string, index: number): Promise<ImageAnalysis | null> {
  const dimensions = await getImageDimensions(url);
  
  if (!dimensions) {
    console.warn(`[HeroSelector] Could not load image: ${url}`);
    return null;
  }
  
  const { width, height } = dimensions;
  const aspectRatio = width / height;
  const resolution = width * height;
  
  // Determine if this is likely a detail shot
  const filenameDetail = isFilenameDetailShot(url);
  const extremeAspect = isExtremeAspectRatio(aspectRatio);
  const tooSmall = isTooSmall(width, height);
  const isLikelyDetailShot = filenameDetail || extremeAspect || tooSmall;
  
  // Calculate score (higher is better)
  let score = 0;
  
  // Resolution score (normalized to 0-100 scale, capped at 4K equivalent)
  const maxResolution = 3840 * 2160; // 4K
  score += Math.min(resolution / maxResolution, 1) * 50;
  
  // Aspect ratio preference (favor standard fashion photo ratios around 0.67-1.0)
  const idealAspect = 0.75; // 3:4 portrait
  const aspectDeviation = Math.abs(aspectRatio - idealAspect);
  score += Math.max(0, 25 - (aspectDeviation * 15));
  
  // Position bonus (earlier images often better composed)
  score += Math.max(0, 15 - (index * 2));
  
  // Heavy penalty for likely detail shots
  if (isLikelyDetailShot) {
    score -= 50;
  }
  
  // Penalty for small images
  if (tooSmall) {
    score -= 30;
  }
  
  return {
    url,
    width,
    height,
    aspectRatio,
    resolution,
    isLikelyDetailShot,
    score,
  };
}

/**
 * Selects the best hero image from an array of image URLs.
 * Returns a reordered array with the best hero first.
 * 
 * @param imageUrls - Array of image URLs to analyze
 * @returns Reordered array with best hero image first
 */
export async function selectHeroImage(imageUrls: string[]): Promise<string[]> {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }
  
  if (imageUrls.length === 1) {
    return imageUrls;
  }
  
  console.info(`[HeroSelector] Analyzing ${imageUrls.length} images for hero selection`);
  
  // Analyze all images in parallel
  const analysisPromises = imageUrls.map((url, index) => analyzeImage(url, index));
  const results = await Promise.all(analysisPromises);
  
  // Filter out failed analyses
  const validResults = results.filter((r): r is ImageAnalysis => r !== null);
  
  if (validResults.length === 0) {
    console.warn('[HeroSelector] No images could be analyzed, keeping original order');
    return imageUrls;
  }
  
  // Sort by score (highest first)
  validResults.sort((a, b) => b.score - a.score);
  
  // Log the winner
  const winner = validResults[0];
  console.info(`[HeroSelector] Selected hero image:`, {
    url: winner.url.substring(0, 80) + '...',
    resolution: `${winner.width}x${winner.height}`,
    aspectRatio: winner.aspectRatio.toFixed(2),
    score: winner.score.toFixed(1),
    isDetailShot: winner.isLikelyDetailShot,
  });
  
  // Log any excluded detail shots
  const detailShots = validResults.filter(r => r.isLikelyDetailShot);
  if (detailShots.length > 0) {
    console.info(`[HeroSelector] Deprioritized ${detailShots.length} likely detail shots`);
  }
  
  // Build reordered array: analyzed images by score, then any that failed analysis
  const reorderedUrls = validResults.map(r => r.url);
  const failedUrls = imageUrls.filter(url => !validResults.some(r => r.url === url));
  
  return [...reorderedUrls, ...failedUrls];
}

/**
 * Quick sync version for cases where we can't wait for image loading.
 * Uses heuristics only (no resolution check).
 */
export function selectHeroImageSync(imageUrls: string[]): string[] {
  if (!imageUrls || imageUrls.length <= 1) {
    return imageUrls;
  }
  
  // Score images using filename heuristics only
  const scored = imageUrls.map((url, index) => ({
    url,
    isDetailShot: isFilenameDetailShot(url),
    index,
  }));
  
  // Sort: non-detail shots first, then by original index
  scored.sort((a, b) => {
    if (a.isDetailShot !== b.isDetailShot) {
      return a.isDetailShot ? 1 : -1;
    }
    return a.index - b.index;
  });
  
  return scored.map(s => s.url);
}
