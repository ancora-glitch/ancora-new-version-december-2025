import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cleanProductName,
  isStockholmMondayEight,
  matchedBrand,
  materialFromAttributes,
  matchesColor,
  matchesConfiguredValue,
  matchesMaterial,
  ssmShopUrl,
  ssmShopUrlCandidates,
} from "./rules.ts";

Deno.test("scheduled import runs at 08:00 Stockholm in winter and summer", () => {
  assertEquals(isStockholmMondayEight(new Date("2026-11-23T07:00:00Z")), true);
  assertEquals(isStockholmMondayEight(new Date("2026-11-23T06:00:00Z")), false);
  assertEquals(isStockholmMondayEight(new Date("2026-07-06T06:00:00Z")), true);
  assertEquals(isStockholmMondayEight(new Date("2026-07-06T07:00:00Z")), false);
  assertEquals(isStockholmMondayEight(new Date("2026-11-24T07:00:00Z")), false);
});

Deno.test("shop aliases handle stop words, Nordic letters and duplicate titles", () => {
  assertEquals(
    ssmShopUrl("Tiger of Sweden blus med veckad front"),
    "https://www.stadsmissionen.se/shop/produkt/tiger-sweden-blus-med-veckad-front",
  );
  assertEquals(
    ssmShopUrl("Samsøe Samsøe svart klänning"),
    "https://www.stadsmissionen.se/shop/produkt/samsoe-samsoe-svart-klanning",
  );
  assertEquals(ssmShopUrlCandidates("Prada - Stövlar - Stl 39").length, 4);
  assertEquals(ssmShopUrlCandidates("Prada - Stövlar - Stl 39")[1].endsWith("-0"), true);
});

Deno.test("brand and attribute filters are case and diacritic insensitive", () => {
  assertEquals(matchedBrand("TOTEME blå högmidjade jeans", "Toteme", ["TOTEME"]), "TOTEME");
  assertEquals(matchedBrand("Okänd tröja", "Okänt märke", ["Ganni"]), null);
  assertEquals(matchesMaterial("100% Merinoull", ["ull"]), true);
  assertEquals(matchesMaterial("100% Siden", ["silke"]), true);
  assertEquals(matchesConfiguredValue("Mörkbrun", ["brun"]), true);
  assertEquals(matchesColor("Vinröd", ["burgundy"]), true);
  assertEquals(matchesConfiguredValue("Svart", []), true);
  assertEquals(matchesMaterial("Bomull", ["silke", "ull"]), false);
});

Deno.test("product names exclude the configured brand", () => {
  assertEquals(cleanProductName("Filippa K svart grov stickad tröja", "Filippa K"), "svart grov stickad tröja");
});

Deno.test("ull matches English wool variants but never bomull or cotton", () => {
  for (const term of ["100% Virgin wool", "Merino wool", "Lambswool", "Recycled wool"]) {
    assertEquals(matchesMaterial(term, ["ull"]), true);
  }
  assertEquals(matchesMaterial("100% bomull", ["ull"]), false);
  assertEquals(matchesMaterial("100% cotton", ["ull"]), false);
  assertEquals(matchesMaterial(null, ["ull"]), false);
});

Deno.test("kashmir matches cashmere in either language", () => {
  assertEquals(matchesMaterial("100% Cashmere", ["kashmir"]), true);
  assertEquals(matchesMaterial("Kashmir", ["cashmere"]), true);
  assertEquals(matchesMaterial("Viscose", ["kashmir"]), false);
});

Deno.test("silke matches silk and siden", () => {
  assertEquals(matchesMaterial("100% Silk", ["silke"]), true);
  assertEquals(matchesMaterial("Siden", ["silk"]), true);
  assertEquals(matchesMaterial("Polyester", ["silke"]), false);
});

Deno.test("bomull matches cotton without adding viscose", () => {
  assertEquals(matchesMaterial("100% Cotton", ["bomull"]), true);
  assertEquals(matchesMaterial("Bomull", ["cotton"]), true);
  assertEquals(matchesMaterial("Viskos", ["bomull"]), false);
});

Deno.test("approved colors match Swedish and English aliases", () => {
  const colors = ["svart", "beige", "brun", "burgundy", "naturvit", "gräddvit", "vit", "grå", "marinblå"];
  for (const term of ["Svart", "Black", "Beige", "Brown", "Mörkbrun", "Vinröd", "Burgundy", "Naturvit", "Off-white", "Gräddvit", "Cream", "White", "Vit", "Grå", "Gray", "Grey", "Marinblå", "Navy"]) {
    assertEquals(matchesColor(term, colors), true);
  }
  assertEquals(matchesColor("Aprikos", colors), false);
  assertEquals(matchesColor("Gammelrosa", colors), false);
  assertEquals(matchesColor("Blue", colors), false);
});

Deno.test("material tags remain usable alongside text, without inferring missing materials", () => {
  const material = materialFromAttributes({ material_text: "Dry clean", material: ["Virgin wool", "Cotton"] });
  assertEquals(material, "Dry clean, Virgin wool, Cotton");
  assertEquals(matchesMaterial(material, ["ull"]), true);
  assertEquals(materialFromAttributes({ material_text: "", material: [] }), null);
});
