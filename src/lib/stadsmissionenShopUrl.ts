/** Partner shop aliases remove decimal points in sizes (37.5 → 375). */
export function ssmShopUrl(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/(\d)\.(?=\d)/g, "$1")
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://www.stadsmissionen.se/shop/produkt/${slug}`;
}