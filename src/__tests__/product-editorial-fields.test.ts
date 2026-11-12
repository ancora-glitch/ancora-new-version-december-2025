import { describe, expect, it } from "vitest";
import { cleanProductName, cleanProductSize, englishCondition, englishMaterial, englishColor } from "../lib/productEditorialFields";

describe("Product editorial fields", () => {
  it("translates Condition to English", () => {
    expect(englishCondition("Gott skick")).toBe("Very good");
    expect(englishCondition("Mycket gott skick")).toBe("Excellent");
    expect(englishCondition("Nytt skick")).toBe("New");
    expect(englishCondition("Använt skick")).toBe("Used");
    expect(englishCondition("Excellent")).toBe("Excellent");
  });
  it("translates material while retaining composition percentages", () => {
    expect(englishMaterial("100% Merinoull")).toBe("100% merino wool");
    expect(englishMaterial("58% Viskos, 39% Ull, 3% Elastan")).toBe("58% viscose, 39% wool, 3% elastane");
    expect(englishMaterial("Mocka")).toBe("Suede");
    expect(englishMaterial("48% virgin ull. Fickfoder: 100% bomull.")).toBe("48% virgin wool. pocket lining: 100% cotton.");
  });
  it("translates color to English", () => {
    expect(englishColor("Blå")).toBe("Blue");
    expect(englishColor("Olivgrön")).toBe("Olive green");
    expect(englishColor("Svart och Vit")).toBe("Black and white");
    expect(englishColor("Burgundy")).toBe("Burgundy");
  });
  it("removes brand and explicit size from Name without removing model text", () => {
    expect(cleanProductName("Filippa K V-neck Merino Wool Sweater", "Filippa K")).toBe("V-neck Merino Wool Sweater");
    expect(cleanProductName("Prada - Brown Suede Boots - Size 37.5 - Premium Vintage", "Prada")).toBe("Brown Suede Boots - Premium Vintage");
    expect(cleanProductName("See by Chloé – Trenchcoat", "See by Chloé")).toBe("Trenchcoat");
    expect(cleanProductName("GANNI", "GANNI")).toBe("");
    expect(cleanProductName("V-neck Merino Wool Sweater", "Filippa K")).toBe("V-neck Merino Wool Sweater");
  });
  it("keeps only size values without parenthetical equivalents", () => {
    expect(cleanProductSize("S (34-36)")).toBe("S");
    expect(cleanProductSize("S (46)")).toBe("S");
    expect(cleanProductSize("L (42-44)")).toBe("L");
    expect(cleanProductSize("37 1/2")).toBe("37 1/2");
    expect(cleanProductSize("XS (32-34), M (38-40)")).toBe("XS , M");
  });
});