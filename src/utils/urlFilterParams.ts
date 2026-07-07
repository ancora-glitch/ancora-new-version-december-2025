// Delade helpers för att serialisera/parsa filter-state till/från
// URLSearchParams. Ren presentationslogik, ingen DB-koppling.

export const parseListParam = (
  searchParams: URLSearchParams,
  key: string
): string[] => {
  const raw = searchParams.get(key);
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
};

export const serializeListParam = (values: string[]): string | null => {
  return values.length > 0 ? values.join(",") : null;
};

// Bygger nya URLSearchParams utifrån ett objekt av key → värde (string,
// string[], eller null). null/tom array/tom sträng = ta bort param helt.
export const buildSearchParams = (
  current: URLSearchParams,
  updates: Record<string, string | string[] | null>
): URLSearchParams => {
  const next = new URLSearchParams(current);
  Object.entries(updates).forEach(([key, value]) => {
    if (
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      next.delete(key);
    } else if (Array.isArray(value)) {
      next.set(key, value.join(","));
    } else {
      next.set(key, value);
    }
  });
  return next;
};
