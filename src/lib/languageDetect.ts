// Simple heuristic: is text likely already English?
// Extracted from TraderaSearchDrawer so all import flows share the same check.
export function isLikelyEnglish(text: string): boolean {
  if (!text) return false;
  const hasSwedishChars = /[åäöÅÄÖ]/.test(text);
  if (hasSwedishChars) return false;
  const swedishStopwords = [
    "och", "för", "med", "som", "det", "den", "ett", "att",
    "har", "kan", "inte", "från", "ska", "till",
  ];
  const lowerText = text.toLowerCase();
  const matches = swedishStopwords.filter((w) =>
    new RegExp(`\\b${w}\\b`).test(lowerText)
  );
  return matches.length < 2;
}
