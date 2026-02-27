/**
 * eBay EPN (eBay Partner Network) affiliate URL configuration and helpers.
 *
 * Campaign and tool IDs are centralised here so they can be updated in one place.
 * The primary marketplace is ebay.co.uk.
 */

// ── EPN Configuration ──────────────────────────────────────────────
export const EBAY_EPN_CAMP_ID = "5339143507";
export const EBAY_EPN_TOOL_ID = "10001";
export const EBAY_EPN_BASE_URL = "https://www.ebay.co.uk/itm";

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract the eBay numeric item ID from any eBay URL or raw ID string.
 * Handles formats like:
 *   - "v1|123456789|0"  (Browse API legacy IDs)
 *   - "https://www.ebay.co.uk/itm/123456789?..."
 *   - "https://www.ebay.com/itm/Some-Title/123456789"
 *   - plain numeric "123456789"
 */
export function extractEbayItemId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const s = urlOrId.trim();

  // Browse API pipe-separated format: "v1|123456789|0"
  const pipeMatch = s.match(/^v\d+\|(\d+)\|/);
  if (pipeMatch) return pipeMatch[1];

  // URL with /itm/…/123456789 or /itm/123456789
  const urlMatch = s.match(/\/itm\/(?:[^/]*\/)?(\d+)/);
  if (urlMatch) return urlMatch[1];

  // Plain numeric
  if (/^\d{8,15}$/.test(s)) return s;

  return null;
}

/**
 * Build an EPN affiliate URL for a given eBay item ID.
 */
export function buildEbayAffiliateUrl(itemId: string): string {
  return `${EBAY_EPN_BASE_URL}/${itemId}?campid=${EBAY_EPN_CAMP_ID}&toolid=${EBAY_EPN_TOOL_ID}`;
}

/**
 * Given any eBay-related URL/ID, return a properly formatted EPN affiliate URL.
 * Returns null if the input doesn't contain a recognisable eBay item ID.
 */
export function toEbayAffiliateUrl(urlOrId: string | null | undefined): string | null {
  const itemId = extractEbayItemId(urlOrId);
  if (!itemId) return null;
  return buildEbayAffiliateUrl(itemId);
}

/**
 * Check whether a URL is already a properly formatted EPN affiliate link.
 */
export function isEbayAffiliateUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(`campid=${EBAY_EPN_CAMP_ID}`) && url.includes(`toolid=${EBAY_EPN_TOOL_ID}`);
}
