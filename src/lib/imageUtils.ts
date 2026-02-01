/**
 * Utility functions for image handling and deduplication
 */

/**
 * Checks if a URL is from our Supabase storage bucket
 */
const isStorageUrl = (url: string): boolean => {
  return url.includes('supabase.co/storage') || url.includes('/storage/v1/object/');
};

/**
 * Extracts the base image identifier from a Tradera or similar URL
 * to detect duplicates (thumbnails vs full-res versions).
 * For storage URLs, uses the exact filename as identifier since they're already unique.
 */
const extractImageIdentifier = (url: string): string => {
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // For our storage URLs, use the exact path as identifier (already unique)
    // This prevents false-positive deduplication of different images
    if (isStorageUrl(url)) {
      return pathname.toLowerCase();
    }
    
    // Common patterns for Tradera/marketplace image URLs:
    // - /images/123456_large.jpg vs /images/123456_thumb.jpg
    // - /img/123456/large vs /img/123456/small
    // - Query params like ?size=large vs ?size=small
    
    // Remove common size suffixes and thumbnails patterns
    const cleanPath = pathname
      .replace(/[_-](thumb|thumbnail|small|medium|large|xl|xxl|original|hires|lowres|preview)\b/gi, "")
      .replace(/\/\d+x\d+\//g, "/")  // Remove dimension paths like /400x300/
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");  // Remove extension for comparison
    
    return cleanPath.toLowerCase();
  } catch {
    // If URL parsing fails, just return the original
    return url.toLowerCase();
  }
};

/**
 * Determines if a URL is likely a high-resolution version
 */
const isHighResVersion = (url: string): boolean => {
  const lowResPatterns = [
    /thumb/i,
    /thumbnail/i,
    /small/i,
    /preview/i,
    /lowres/i,
    /_s\./i,
    /_t\./i,
    /\/\d{2,3}x\d{2,3}\//,  // Small dimensions like /100x100/
  ];
  
  const highResPatterns = [
    /large/i,
    /original/i,
    /hires/i,
    /full/i,
    /_l\./i,
    /_xl\./i,
  ];
  
  const url_lower = url.toLowerCase();
  
  // If it has low-res patterns, it's not high-res
  if (lowResPatterns.some(pattern => pattern.test(url_lower))) {
    return false;
  }
  
  // If it has high-res patterns, it's high-res
  if (highResPatterns.some(pattern => pattern.test(url_lower))) {
    return true;
  }
  
  // Default: assume it's okay quality
  return true;
};

/**
 * Deduplicates an array of image URLs, keeping only unique high-quality versions.
 * For storage URLs, uses exact URL matching. For external URLs, uses pattern-based deduplication.
 * @param mainImage - The primary/main image URL
 * @param additionalImages - Array of additional image URLs
 * @returns Deduplicated array of unique image URLs, with main image first
 */
export const deduplicateImages = (
  mainImage: string,
  additionalImages: string[] = []
): string[] => {
  if (!mainImage) return [];
  
  // Combine all images and filter out empty/null values
  const allImages = [mainImage, ...additionalImages].filter(Boolean);
  
  // For storage URLs, use exact URL matching (no pattern deduplication needed)
  // This prevents false-positive deduplication of legitimately different images
  if (isStorageUrl(mainImage)) {
    const seen = new Set<string>();
    const uniqueImages: string[] = [];
    
    for (const url of allImages) {
      const normalized = url.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueImages.push(url); // Keep original casing
      }
    }
    
    return uniqueImages;
  }
  
  // For external URLs (Tradera, etc.), use pattern-based deduplication
  // to handle thumbnail vs full-res versions of the same image
  const imageGroups = new Map<string, string[]>();
  
  for (const url of allImages) {
    const identifier = extractImageIdentifier(url);
    const existing = imageGroups.get(identifier) || [];
    existing.push(url);
    imageGroups.set(identifier, existing);
  }
  
  // For each group, select the highest quality version
  const uniqueImages: string[] = [];
  const seenIdentifiers = new Set<string>();
  
  // Process main image first to ensure it's included
  const mainIdentifier = extractImageIdentifier(mainImage);
  const mainGroup = imageGroups.get(mainIdentifier) || [mainImage];
  const bestMain = selectBestQuality(mainGroup);
  uniqueImages.push(bestMain);
  seenIdentifiers.add(mainIdentifier);
  
  // Process remaining images
  for (const [identifier, urls] of imageGroups) {
    if (seenIdentifiers.has(identifier)) continue;
    
    const bestUrl = selectBestQuality(urls);
    uniqueImages.push(bestUrl);
    seenIdentifiers.add(identifier);
  }
  
  return uniqueImages;
};

/**
 * Selects the best quality URL from a group of similar images
 */
const selectBestQuality = (urls: string[]): string => {
  if (urls.length === 1) return urls[0];
  
  // Sort by quality indicators (high-res patterns first)
  const sorted = [...urls].sort((a, b) => {
    const aIsHigh = isHighResVersion(a);
    const bIsHigh = isHighResVersion(b);
    
    if (aIsHigh && !bIsHigh) return -1;
    if (!aIsHigh && bIsHigh) return 1;
    
    // If both are high-res or both are not, prefer longer URLs (often more specific)
    return b.length - a.length;
  });
  
  return sorted[0];
};

/**
 * Simple filter to remove exact duplicates and filter out main image from additional
 * @param mainImage - The main product image
 * @param additionalImages - Array of additional images
 * @returns Filtered array without duplicates
 */
export const getUniqueAdditionalImages = (
  mainImage: string,
  additionalImages: string[] = []
): string[] => {
  if (!additionalImages || additionalImages.length === 0) return [];
  
  const mainNormalized = mainImage?.toLowerCase().trim() || "";
  const seen = new Set<string>([mainNormalized]);
  const unique: string[] = [];
  
  for (const url of additionalImages) {
    if (!url) continue;
    const normalized = url.toLowerCase().trim();
    
    // Skip if it's the same as main image or already seen
    if (seen.has(normalized)) continue;
    
    // Also check for URL variations (with/without query params)
    const baseUrl = normalized.split("?")[0];
    const mainBase = mainNormalized.split("?")[0];
    if (baseUrl === mainBase) continue;
    
    seen.add(normalized);
    unique.push(url); // Keep original casing
  }
  
  return unique;
};
