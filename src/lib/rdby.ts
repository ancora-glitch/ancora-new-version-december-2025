/**
 * src/lib/rdby.ts
 *
 * Thin client for ReDesignedBy's hosted endpoints.
 * We call them directly — no proxy, no auth header, no UTM mutation,
 * no price math. Pure pass-through.
 *
 * Invariants:
 *   - affiliateUrl from the API is used as-is (never modified)
 *   - prices are displayed/stored exactly as returned
 */

const BASE_URL = "https://wiuiatrnvqyclntzwirz.supabase.co/functions/v1";

export async function searchRDBY(
  opts: {
    keywords?: string;
    cursor?: string;
    limit?: number;
  } = {}
) {
  const res = await fetch(`${BASE_URL}/redesignedby-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function fetchRDBYItem(handle: string) {
  const res = await fetch(`${BASE_URL}/redesignedby-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  if (res.status === 404) throw new Error("Product not found");
  if (!res.ok) throw new Error(`Item fetch failed: ${res.status}`);
  return res.json();
}
