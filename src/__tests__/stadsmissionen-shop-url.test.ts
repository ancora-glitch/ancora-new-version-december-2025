import { describe, expect, it } from "vitest";
import { ssmShopUrl } from "../lib/stadsmissionenShopUrl";

describe("Stadsmissionen purchase URLs", () => {
  it("matches the verified Prada decimal-size shop alias", () => {
    expect(ssmShopUrl("Prada - Stövlar - Brun - Mocka - Stl 37.5 - Premium Vintage"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/prada-stovlar-brun-mocka-stl-375-premium-vintage");
  });

  it("preserves the existing nondecimal Prada alias", () => {
    expect(ssmShopUrl("Prada - Kängor - Svarta - Premium Vintage"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/prada-kangor-svarta-premium-vintage");
  });
});