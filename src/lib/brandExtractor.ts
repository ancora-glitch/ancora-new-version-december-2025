// Known fashion brands for automatic extraction from product titles
const KNOWN_BRANDS = [
  // Swedish/Scandinavian brands
  "Filippa K",
  "Acne Studios",
  "Acne",
  "Totême",
  "Toteme",
  "COS",
  "Arket",
  "By Malene Birger",
  "Malene Birger",
  "Tiger of Sweden",
  "J.Lindeberg",
  "J Lindeberg",
  "Rodebjer",
  "Hope Stockholm",
  "Hope",
  "Whyred",
  "Our Legacy",
  "Eytys",
  "Stutterheim",
  "Sandqvist",
  "Nudie Jeans",
  "Nudie",
  "Weekday",
  "Monki",
  "& Other Stories",
  "Other Stories",
  "Ganni",
  "Stine Goya",
  "Samsøe Samsøe",
  "Samsoe Samsoe",
  "Holzweiler",
  "Wood Wood",
  "Norse Projects",
  "Filippa K Soft Sport",
  "House of Dagmar",
  "Dagmar",
  "Carin Wester",
  "Stylein",
  "Dagny",
  "ATP Atelier",
  "Aje",
  
  // Luxury brands
  "Chanel",
  "Louis Vuitton",
  "LV",
  "Gucci",
  "Prada",
  "Hermès",
  "Hermes",
  "Dior",
  "Christian Dior",
  "Céline",
  "Celine",
  "Saint Laurent",
  "Yves Saint Laurent",
  "YSL",
  "Bottega Veneta",
  "Loewe",
  "Balenciaga",
  "Valentino",
  "Fendi",
  "Burberry",
  "Givenchy",
  "Alexander McQueen",
  "McQueen",
  "Versace",
  "Dolce & Gabbana",
  "D&G",
  "Miu Miu",
  "Salvatore Ferragamo",
  "Ferragamo",
  "Tom Ford",
  "Stella McCartney",
  "The Row",
  "Khaite",
  "Jacquemus",
  "Zimmermann",
  "Isabel Marant",
  "Marni",
  "Jil Sander",
  "Loro Piana",
  "Brunello Cucinelli",
  "Max Mara",
  "Missoni",
  "Etro",
  "Emilio Pucci",
  "Pucci",
  "Moschino",
  "Roberto Cavalli",
  "Lanvin",
  "Balmain",
  "Off-White",
  "Maison Margiela",
  "MM6",
  "Rick Owens",
  "Ann Demeulemeester",
  "Dries Van Noten",
  "Lemaire",
  "Nanushka",
  "Ulla Johnson",
  "Simone Rocha",
  "Erdem",
  "Self-Portrait",
  "Zimmerman",
  
  // Contemporary/Premium brands
  "Sandro",
  "Maje",
  "Claudie Pierlot",
  "Zadig & Voltaire",
  "Zadig",
  "Ba&sh",
  "Bash",
  "Iro",
  "IRO Paris",
  "Theory",
  "Vince",
  "Equipment",
  "Frame",
  "Rag & Bone",
  "AllSaints",
  "All Saints",
  "Reiss",
  "Ted Baker",
  "Karen Millen",
  "Whistles",
  "Joseph",
  "Jigsaw",
  "Massimo Dutti",
  "Uterqüe",
  "Uterque",
  "Sézane",
  "Sezane",
  "Rouje",
  "Reformation",
  "Realisation Par",
  "Réalisation Par",
  "AGOLDE",
  "Anine Bing",
  "A.P.C.",
  "APC",
  "A.P.C",
  "Vanessa Bruno",
  "Vanessa Seward",
  "Closed",
  "Drykorn",
  "Marc O'Polo",
  "Marc O Polo",
  "Hugo Boss",
  "Boss",
  "Calvin Klein",
  "CK",
  "Tommy Hilfiger",
  "Tommy",
  "Ralph Lauren",
  "Polo Ralph Lauren",
  "Polo",
  "Michael Kors",
  "Tory Burch",
  "Kate Spade",
  "Coach",
  "Furla",
  "Longchamp",
  "Mulberry",
  "Aspinal",
  "Smythson",
  "Anya Hindmarch",
  
  // Denim brands
  "Levi's",
  "Levis",
  "Levi",
  "Wrangler",
  "Lee",
  "Diesel",
  "G-Star",
  "G-Star Raw",
  "Citizens of Humanity",
  "7 For All Mankind",
  "True Religion",
  "J Brand",
  "Mother",
  "Paige",
  "DL1961",
  "Hudson",
  "AG Jeans",
  "AG",
  
  // Shoe brands
  "Jimmy Choo",
  "Manolo Blahnik",
  "Christian Louboutin",
  "Louboutin",
  "Gianvito Rossi",
  "Aquazzura",
  "Stuart Weitzman",
  "Sam Edelman",
  "Steve Madden",
  "Clarks",
  "Dr. Martens",
  "Doc Martens",
  "Birkenstock",
  "Superga",
  "Veja",
  "Golden Goose",
  "Common Projects",
  "Axel Arigato",
  "Filling Pieces",
  
  // Sportswear/Athleisure
  "Nike",
  "Adidas",
  "Puma",
  "Reebok",
  "New Balance",
  "Asics",
  "Converse",
  "Vans",
  "Lululemon",
  "Sweaty Betty",
  "Alo Yoga",
  "Outdoor Voices",
  
  // Fast fashion (for completeness)
  "Zara",
  "H&M",
  "Mango",
  "Uniqlo",
  "& Other Stories",
  "Pull & Bear",
  "Bershka",
  "Stradivarius",
  "Reserved",
  "Asos",
  "Topshop",
  "River Island",
  "French Connection",
  "FCUK",
  
  // Additional Swedish/Nordic
  "Elvine",
  "Lexington",
  "Morris",
  "Oscar Jacobson",
  "Eton",
  "Stenströms",
  "Stenstroms",
  "Fjällräven",
  "Fjallraven",
  "Peak Performance",
  "Haglöfs",
  "Haglofs",
  "Sail Racing",
  "Henri Lloyd",
  "Gant",
  "Hestra",
  "Sandqvist",
  "Rains",
  "Vagabond",
  "Swedish Hasbeens",
];

// Sort brands by length (longest first) to match "Filippa K Soft Sport" before "Filippa K"
const SORTED_BRANDS = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);

interface BrandExtractionResult {
  brand: string;
  cleanedName: string;
}

/**
 * Extracts a known fashion brand from a product title.
 * Returns the brand and a cleaned name with the brand removed.
 */
export function extractBrandFromTitle(title: string): BrandExtractionResult {
  if (!title) {
    return { brand: "", cleanedName: "" };
  }

  const normalizedTitle = title.trim();
  const lowerTitle = normalizedTitle.toLowerCase();

  for (const brand of SORTED_BRANDS) {
    const lowerBrand = brand.toLowerCase();
    const brandIndex = lowerTitle.indexOf(lowerBrand);

    if (brandIndex !== -1) {
      // Found a match - extract and clean
      const beforeBrand = normalizedTitle.substring(0, brandIndex);
      const afterBrand = normalizedTitle.substring(brandIndex + brand.length);

      // Reconstruct the name without the brand
      let cleanedName = (beforeBrand + afterBrand)
        .replace(/^[\s\-–—,.:]+/, "") // Remove leading separators
        .replace(/[\s\-–—,.:]+$/, "") // Remove trailing separators
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      // Capitalize first letter of cleaned name
      if (cleanedName.length > 0) {
        cleanedName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
      }

      // Normalize the brand name to use the canonical version from our list
      const canonicalBrand = KNOWN_BRANDS.find(
        (b) => b.toLowerCase() === lowerBrand
      ) || brand;

      return {
        brand: canonicalBrand,
        cleanedName,
      };
    }
  }

  // No known brand found - return empty brand (not "Unknown")
  return {
    brand: "",
    cleanedName: normalizedTitle,
  };
}

/**
 * Determines the final brand to use for a product.
 * Priority: API-provided brand > extracted from title > empty string
 */
export function determineBrand(
  apiBrand: string | undefined,
  title: string
): BrandExtractionResult {
  // If API provides a real brand (not Unknown), use it
  if (apiBrand && apiBrand !== "Unknown" && apiBrand.trim() !== "") {
    // Still try to clean the title even if we have a brand from API
    const { cleanedName } = extractBrandFromTitle(title);
    return {
      brand: apiBrand,
      cleanedName: cleanedName || title,
    };
  }

  // Try to extract from title
  const extracted = extractBrandFromTitle(title);
  
  // If we found a brand, use it
  if (extracted.brand) {
    return extracted;
  }

  // No brand found anywhere - return empty (not "Unknown")
  return {
    brand: "",
    cleanedName: title,
  };
}
