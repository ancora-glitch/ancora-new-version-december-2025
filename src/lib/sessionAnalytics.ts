/**
 * Session-based analytics tracking utilities.
 * Ensures Buy Now clicks are only counted once per product per session,
 * and only after a product has been viewed.
 */

import { getVisitorId } from "./visitorId";

const SESSION_STORAGE_KEY = "ancora_analytics_session";

// Re-export getVisitorId for convenience
export { getVisitorId };

interface AnalyticsSession {
  viewedProducts: Set<string>;
  buyNowClicked: Set<string>;
}

// In-memory session state (survives page navigations within SPA)
let sessionState: AnalyticsSession = {
  viewedProducts: new Set(),
  buyNowClicked: new Set(),
};

// Initialize from sessionStorage if available
const initializeSession = () => {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      sessionState = {
        viewedProducts: new Set(parsed.viewedProducts || []),
        buyNowClicked: new Set(parsed.buyNowClicked || []),
      };
    }
  } catch {
    // sessionStorage not available or parse error - use fresh session
  }
};

// Persist to sessionStorage
const persistSession = () => {
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        viewedProducts: Array.from(sessionState.viewedProducts),
        buyNowClicked: Array.from(sessionState.buyNowClicked),
      })
    );
  } catch {
    // sessionStorage not available - continue with in-memory only
  }
};

// Initialize on module load
initializeSession();

/**
 * Mark a product as viewed in this session.
 * This enables Buy Now tracking for this product.
 */
export const markProductViewed = (productId: string): void => {
  if (!productId) return;
  sessionState.viewedProducts.add(productId);
  persistSession();
};

/**
 * Check if a product has been viewed in this session.
 */
export const hasProductBeenViewed = (productId: string): boolean => {
  return sessionState.viewedProducts.has(productId);
};

/**
 * Check if Buy Now has already been clicked for this product in this session.
 */
export const hasBuyNowBeenClicked = (productId: string): boolean => {
  return sessionState.buyNowClicked.has(productId);
};

/**
 * Mark Buy Now as clicked for this product.
 * Returns true if this is the first click (should be tracked),
 * Returns false if already clicked (should not be tracked again).
 */
export const markBuyNowClicked = (productId: string): boolean => {
  if (!productId) return false;
  
  // Check if already clicked this session
  if (sessionState.buyNowClicked.has(productId)) {
    return false; // Already tracked, don't track again
  }
  
  // CRITICAL: Product MUST be viewed first - reject if not
  if (!sessionState.viewedProducts.has(productId)) {
    console.warn(`[Analytics] Buy Now rejected: product ${productId} was not viewed first`);
    return false; // Do NOT track - prevents intent > clicks
  }
  
  sessionState.buyNowClicked.add(productId);
  persistSession();
  return true; // First click, should be tracked
};

/**
 * Check if Buy Now click should be tracked for this product.
 * Returns true only if:
 * 1. Product has been viewed in this session
 * 2. Buy Now hasn't been clicked for this product yet in this session
 */
export const shouldTrackBuyNowClick = (productId: string): boolean => {
  if (!productId) return false;
  
  // Must have viewed the product first
  if (!hasProductBeenViewed(productId)) {
    return false;
  }
  
  // Must not have already clicked Buy Now
  if (hasBuyNowBeenClicked(productId)) {
    return false;
  }
  
  return true;
};

/**
 * Reset the session (useful for testing)
 */
export const resetAnalyticsSession = (): void => {
  sessionState = {
    viewedProducts: new Set(),
    buyNowClicked: new Set(),
  };
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
};
