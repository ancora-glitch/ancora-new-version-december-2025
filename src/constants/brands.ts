export const TIER_BRANDS = {
  A: ["Toteme","Acne Studios","Filippa K","Tiger of Sweden","Stine Goya","Ganni","By Malene Birger","Rodebjer","Hope Stockholm","Our Legacy","3.1 Phillip Lim","Alaia","Alexander McQueen","ATP Atelier","APC","Balenciaga","Baserange","Baum und Pferdgarten","Bottega Veneta","Burberry","Carhartt","Carhartt WIP","Celine","Chanel","Chloe","COS","Dagmar","Dior","Dr Martens","Eytys","Flattered","House of Dagmar","Gant","Gucci","Patagonia","Isabel Marant","Jacquemus","Jil Sander","Levi's","Loewe","Louis Vuitton","Ralph Lauren","Maison Margiela","Marni","Miu Miu","Moncler","Mulberry","Prada","Saint Laurent","Sandqvist","Self Portrait","Skall Studio","Stella McCartney","The Row","Stand Studio","Valentino","Veja","Versace","Wood Wood","Vivienne Westwood","Diesel","Barbour","Helmut Lang","Calvin Klein","Axel Arigato","Rotate","Brunello Cucinelli","Loro Piana","Max Mara","Giorgio Armani","Emporio Armani","Fendi","Ferragamo"],
  B: ["Samsøe Samsøe","ADOORE","American Vintage","Asics","Blankens","Hunter","Lemaire","Munthe","New Balance","Nike","Nudie Jeans","Pernille Corydon","Resume","Saucony","REISS","Karen Millen","Rohe","Soeur","Madewell","Kings of Indigo"],
  C: ["M&S Autograph","Sosandar"],
} as const;

export type BrandTier = keyof typeof TIER_BRANDS;
