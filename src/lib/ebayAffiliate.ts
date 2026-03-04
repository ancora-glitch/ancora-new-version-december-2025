/**
 * eBay EPN (eBay Partner Network) affiliate URL configuration and helpers.
 *
 * Campaign and tool IDs are centralised here so they can be updated in one place.
 * The primary marketplace is ebay.co.uk.
 */

// ── EPN Configuration ──────────────────────────────────────────────
export const EBAY_EPN_CAMP_ID = "5339143507";
export const EBAY_EPN_TOOL_ID = "10001";
export const EBAY_EPN_ROVER_BASE = "https://rover.ebay.com/rover/1/711-53200-19255-0/1";
export const EBAY_DESTINATION_BASE = "https://www.ebay.co.uk/itm";

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
  // Decode percent-encoded pipes so v1%7C…%7C0 becomes v1|…|0
  const s = urlOrId.trim().replace(/%7C/gi, "|");

  // Browse API pipe-separated format anywhere in string: "v1|123456789|0"
  const pipeMatch = s.match(/v\d+\|(\d+)\|/);
  if (pipeMatch) return pipeMatch[1];

  // URL with /itm/…/123456789 or /itm/123456789
  const urlMatch = s.match(/\/itm\/(?:[^/]*\/)?(\d+)/);
  if (urlMatch) return urlMatch[1];

  // Plain numeric
  if (/^\d{8,15}$/.test(s)) return s;

  return null;
}

/**
 * Build an EPN rover affiliate URL for a given eBay item ID.
 * Uses the rover redirect format required for proper EPN click tracking.
 */
export function buildEbayAffiliateUrl(itemId: string, customId?: string): string {
  const numericId = extractEbayItemId(itemId) || itemId;
  const destinationUrl = `${EBAY_DESTINATION_BASE}/${numericId}`;
  let qs = `campid=${EBAY_EPN_CAMP_ID}&toolid=${EBAY_EPN_TOOL_ID}&mpre=${destinationUrl}`;
  if (customId) qs += `&customid=${encodeURIComponent(customId)}`;
  return `${EBAY_EPN_ROVER_BASE}?${qs}`;
}

/**
 * Given any eBay-related URL/ID, return a properly formatted EPN rover affiliate URL.
 * Always uses rover.ebay.com redirect format for correct click tracking.
 * Returns null if no eBay item ID is found.
 */
export function toEbayAffiliateUrl(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;

  // Already a proper rover affiliate link — return as-is
  if (isEbayAffiliateUrl(urlOrId)) return urlOrId;

  const s = urlOrId.trim();

  const itemId = extractEbayItemId(s);
  if (!itemId) return null;

  console.log("[ebay-affiliate] clean_item_id:", itemId);

  // Build rover URL — always wraps destination in mpre param
  return buildEbayAffiliateUrl(itemId);
}

/**
 * Check whether a URL is already a properly formatted EPN rover affiliate link.
 */
export function isEbayAffiliateUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("rover.ebay.com/rover") &&
    url.includes(`campid=${EBAY_EPN_CAMP_ID}`) &&
    url.includes(`toolid=${EBAY_EPN_TOOL_ID}`);
}
