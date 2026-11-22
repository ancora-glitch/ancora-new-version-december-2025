// Drupal Pathauto removes these English stop words from Stadsmissionen's aliases.
const PATHAUTO_STOP_WORDS = new Set([
  "a", "an", "as", "at", "before", "but", "by", "for", "from", "is", "in",
  "into", "like", "of", "off", "on", "onto", "per", "since", "than", "the",
  "this", "that", "to", "up", "via", "with",
]);

/**
 * Build a partner shop alias. Decimal points in sizes are removed (37.5 → 375).
 * Pass duplicateSuffix 0, 1, … for Pathauto's -0, -1, … collision variants.
 */
export function ssmShopUrl(title: string, duplicateSuffix?: number): string {
  const normalized = title
    .toLowerCase()
    .replace(/(\d)\.(?=\d)/g, "$1")
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = normalized
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !PATHAUTO_STOP_WORDS.has(word))
    .join("-");
  const suffix = duplicateSuffix === undefined ? "" : `-${Math.max(0, Math.floor(duplicateSuffix))}`;
  return `https://www.stadsmissionen.se/shop/produkt/${slug}${suffix}`;
}

/** Candidates must be verified against the live shop before importing. */
export function ssmShopUrlCandidates(title: string, duplicateVariants = 3): string[] {
  return [
    ssmShopUrl(title),
    ...Array.from({ length: duplicateVariants }, (_, index) => ssmShopUrl(title, index)),
  ];
}