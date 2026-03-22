const SWEDISH_MAP: Record<string, string> = {
  å: "a", ä: "a", ö: "o",
  Å: "a", Ä: "a", Ö: "o",
};

export function slugify(input: string): string {
  return input
    .replace(/[åäöÅÄÖ]/g, (c) => SWEDISH_MAP[c])
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateUniqueSlug(base: string, existingSlugs: string[]): string {
  const baseSlug = slugify(base);
  if (!existingSlugs.includes(baseSlug)) return baseSlug;
  let i = 2;
  while (existingSlugs.includes(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}
