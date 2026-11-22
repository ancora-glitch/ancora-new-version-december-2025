import { describe, expect, it } from "vitest";
import { ssmShopUrl, ssmShopUrlCandidates } from "../lib/stadsmissionenShopUrl";

describe("Stadsmissionen purchase URLs", () => {
  it("matches the verified Prada decimal-size shop alias", () => {
    expect(ssmShopUrl("Prada - Stövlar - Brun - Mocka - Stl 37.5 - Premium Vintage"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/prada-stovlar-brun-mocka-stl-375-premium-vintage");
  });

  it("preserves the existing nondecimal Prada alias", () => {
    expect(ssmShopUrl("Prada - Kängor - Svarta - Premium Vintage"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/prada-kangor-svarta-premium-vintage");
  });

  it("removes Pathauto stop words from brand names", () => {
    expect(ssmShopUrl("Tiger of Sweden blus med veckad front"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/tiger-sweden-blus-med-veckad-front");
    expect(ssmShopUrl("A Lamberg - Dubbelknäppt Svart Kappa"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/lamberg-dubbelknappt-svart-kappa");
    expect(ssmShopUrl("By Malene Birger - Draperad kjol med glans"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/malene-birger-draperad-kjol-med-glans");
  });

  it("matches the verified Samsøe Samsøe transliteration", () => {
    expect(ssmShopUrl("Samsøe Samsøe  svart klänning med pärlknappar"))
      .toBe("https://www.stadsmissionen.se/shop/produkt/samsoe-samsoe-svart-klanning-med-parlknappar");
  });

  it("builds the verified collision variant for duplicate product titles", () => {
    expect(ssmShopUrl("Prada - Stövlar - Svarta - Stl 39 - Premium Vintage", 0))
      .toBe("https://www.stadsmissionen.se/shop/produkt/prada-stovlar-svarta-stl-39-premium-vintage-0");
  });

  it("offers the plain alias before numbered collision variants", () => {
    expect(ssmShopUrlCandidates("Prada - Stövlar - Svarta - Stl 39 - Premium Vintage", 2)).toEqual([
      "https://www.stadsmissionen.se/shop/produkt/prada-stovlar-svarta-stl-39-premium-vintage",
      "https://www.stadsmissionen.se/shop/produkt/prada-stovlar-svarta-stl-39-premium-vintage-0",
      "https://www.stadsmissionen.se/shop/produkt/prada-stovlar-svarta-stl-39-premium-vintage-1",
    ]);
  });
});