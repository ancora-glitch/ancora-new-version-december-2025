import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ExternalLink, Search, ChevronDown, ChevronUp, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VINTED_BRAND_IDS } from "@/constants/brands";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface BuildArgs {
  brand: string;
  keywords: string;
}

interface Source {
  id: string;
  name: string;
  description: string;
  group: "se" | "intl";
  build: (args: BuildArgs) => string;
}

const enc = encodeURIComponent;
const joinBK = (brand: string, keywords: string) =>
  enc([brand, keywords].filter((p) => p && p.trim().length > 0).join(" "));

const SOURCES: Source[] = [
  { id: "tradera", name: "Tradera", description: "Svensk second hand", group: "se",
    build: ({ brand }) => `https://www.tradera.com/search?q=${enc(brand)}` },
  { id: "sellpy", name: "Sellpy", description: "Svensk second hand", group: "se",
    build: ({ brand, keywords }) => `https://www.sellpy.se/search?query=${joinBK(brand, keywords)}` },
  { id: "vinted", name: "Vinted SE", description: "Svensk second hand", group: "se",
    build: ({ brand, keywords }) => {
      const id = VINTED_BRAND_IDS[brand];
      if (id) {
        return `https://www.vinted.se/catalog?search_text=${enc(keywords)}&brand_ids[]=${id}`;
      }
      return `https://www.vinted.se/catalog?search_text=${joinBK(brand, keywords)}`;
    } },
  { id: "mai", name: "Mai.se", description: "Svensk second hand", group: "se",
    build: ({ brand }) => `https://mairesale.com/search?q=${enc(brand)}` },
  { id: "ebay", name: "eBay UK", description: "Used items", group: "intl",
    build: ({ brand }) => `https://www.ebay.co.uk/sch/i.html?_nkw=${enc(brand)}&LH_ItemCondition=3000` },
  { id: "ebay-it", name: "eBay Italia", description: "Usato", group: "intl",
    build: ({ brand }) => `https://www.ebay.it/sch/i.html?_nkw=${enc(brand)}&LH_ItemCondition=3000` },
  { id: "vestiaire", name: "Vestiaire Collective", description: "Internationell pre-loved", group: "intl",
    build: ({ brand }) => `https://www.vestiairecollective.com/search/?q=${enc(brand)}` },
  { id: "vintagesphere", name: "VintageSphere", description: "Svensk vintage", group: "intl",
    build: ({ brand, keywords }) => `https://vintagesphere.se/search?type=product&q=${joinBK(brand, keywords)}` },
  { id: "redesignedby", name: "ReDesignedBy", description: "Svensk pre-loved", group: "intl",
    build: ({ brand, keywords }) => `https://redesignedby.se/search?type=product&q=${joinBK(brand, keywords)}` },
  { id: "beyondretro", name: "Beyond Retro", description: "Internationell vintage", group: "intl",
    build: ({ brand, keywords }) => `https://www.beyondretro.com/search?type=product&q=${joinBK(brand, keywords)}` },
];

const TIER_A_BRANDS = [
  "Toteme","Acne Studios","Filippa K","Tiger of Sweden","Stine Goya","Ganni","By Malene Birger","Rodebjer",
  "Hope Stockholm","Our Legacy","3.1 Phillip Lim","Alaia","Alexander McQueen","ATP Atelier","APC","Balenciaga",
  "Baserange","Baum und Pferdgarten","Bottega Veneta","Burberry","Carhartt","Carhartt WIP","Celine","Chanel",
  "Chloe","COS","Dagmar","Dior","Dr Martens","Eytys","Flattered","House of Dagmar","Gant","Gucci","Patagonia",
  "Isabel Marant","Jacquemus","Jil Sander","Levi's","Loewe","Louis Vuitton","Ralph Lauren","Maison Margiela",
  "Marni","Miu Miu","Moncler","Mulberry","Prada","Saint Laurent","Sandqvist","Self Portrait","Skall Studio",
  "Stella McCartney","The Row","Stand Studio","Valentino","Veja","Versace","Wood Wood","Vivienne Westwood",
  "Diesel","Barbour","Helmut Lang","Calvin Klein","Axel Arigato","Rotate","Brunello Cucinelli","Loro Piana",
  "Max Mara","Giorgio Armani","Emporio Armani","Fendi","Ferragamo",
];

const LETTER_SIZES = ["XS","S","M","L","XL","XXL"];
const NUMERIC_SIZES = ["32","34","36","38","40","42","44","46","48"];

const STOPWORDS = new Set([
  "och","eller","att","en","ett","den","det","som","på","i","är","för","av","med","till","jag","du","vi",
  "letar","efter","något","gärna","kanske","ha","ska","skulle","vill","behöver","mig","min","mitt",
  "the","a","an","and","or","for","with","to","of","in","on","is","am","looking","want","need","my","i",
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
    if (out.length >= 3) break;
  }
  return out;
}

interface SearchResult {
  brands: string[];
  sizes: string[];
  keywords: string[];
}

const DEFAULT_VISIBLE = 5;

export const SourcingTool = () => {
  const [query, setQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [styleNotes, setStyleNotes] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Endast jpg, png eller webp");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Bilden är för stor, max 5MB");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setStyleNotes(null);
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: { image: base64, mimeType: file.type, userText: query || undefined },
      });
      if (error) throw error;
      if (!data || !Array.isArray(data.keywords)) throw new Error("Bad response");
      setQuery(data.keywords.join(" "));
      setStyleNotes(typeof data.style_notes === "string" ? data.style_notes : null);
    } catch (err) {
      console.error("analyze-garment failed", err);
      toast.error("Kunde inte analysera bilden — skriv sökord manuellt");
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setStyleNotes(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  };

  const selectAllBrands = () => setSelectedBrands(new Set(TIER_A_BRANDS));
  const clearAllBrands = () => setSelectedBrands(new Set());

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Skriv något att söka efter");
      return;
    }
    if (selectedBrands.size === 0) {
      toast.error("Välj minst ett märke");
      return;
    }
    setLoading(true);
    setExpandedSources(new Set());
    setTimeout(() => {
      const keywords = extractKeywords(query);
      const brandList = TIER_A_BRANDS.filter((b) => selectedBrands.has(b));
      const sizeList = [...LETTER_SIZES, ...NUMERIC_SIZES].filter((s) => selectedSizes.has(s));
      setResult({ keywords, brands: brandList, sizes: sizeList });
      setLoading(false);
    }, 300);
  };

  const toggleExpanded = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  const seSources = SOURCES.filter((s) => s.group === "se");
  const intlSources = SOURCES.filter((s) => s.group === "intl");
  const keywordsStr = result ? result.keywords.join(" ") : "";
  const sizesStr = result ? result.sizes.join(" ") : "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-serif text-primary mb-2">Sourcing Tool</h2>
        <p className="text-muted-foreground text-sm">
          Generera söklänkar till second hand-källor utifrån fritext, valda märken och storlekar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brands */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Märken (Tier A)</h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllBrands} className="h-7 px-2 text-xs">
                  Välj alla
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllBrands} className="h-7 px-2 text-xs">
                  Rensa alla
                </Button>
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-input p-3">
              <div className="flex flex-wrap gap-2">
                {TIER_A_BRANDS.map((brand) => {
                  const active = selectedBrands.has(brand);
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => toggleBrand(brand)}
                      className={
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                        (active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground")
                      }
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{selectedBrands.size} valda</p>
          </div>

          {/* Sizes */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Storlek</h4>
            <div className="flex flex-wrap gap-2">
              {LETTER_SIZES.map((s) => {
                const active = selectedSizes.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground")
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {NUMERIC_SIZES.map((s) => {
                const active = selectedSizes.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground")
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Visuell sökning</CardTitle>
          <CardDescription>Ladda upp ett plagg så fyller Claude i sökorden åt dig.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageFile(f);
            }}
          />
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleImageFile(f);
              }}
              className="flex flex-col items-center justify-center gap-2 border border-dashed border-input rounded-md p-8 text-center cursor-pointer hover:bg-accent/40 transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Ladda upp plagg för visuell sökning</p>
              <p className="text-xs text-muted-foreground">jpg, png eller webp · max 5MB</p>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <img
                src={imagePreview}
                alt="Uppladdat plagg"
                className="w-24 h-24 object-cover rounded-md border border-input"
              />
              <div className="flex-1 space-y-2">
                {analyzing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyserar plagget...
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Bilden är analyserad — redigera nyckelord nedan om du vill.</p>
                )}
                <Button variant="ghost" size="sm" onClick={clearImage} className="h-7 px-2 text-xs">
                  <X className="w-3 h-3 mr-1" /> Ta bort bild
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sök</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Skriv sökord eller beskriv vad du letar efter..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Tips: skriv på engelska för bättre träffar på eBay och Vestiaire
          </p>
          {styleNotes && (
            <p className="text-xs italic text-muted-foreground">Claude ser: {styleNotes}</p>
          )}
          <Button onClick={handleSearch} disabled={loading || analyzing}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sök
          </Button>
        </CardContent>
      </Card>


      {!result && (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground">
          Välj märken och skriv vad du letar efter
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{result.brands.length * SOURCES.length} länkar genererade</span>
            {result.keywords.length > 0 && (
              <>
                <span>·</span>
                <span>Nyckelord:</span>
                {result.keywords.map((k) => (
                  <Badge key={k} variant="secondary">{k}</Badge>
                ))}
              </>
            )}
            {result.sizes.length > 0 && (
              <>
                <span>·</span>
                <span>Storlek:</span>
                {result.sizes.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </>
            )}
            {result.brands.length > 0 && (
              <>
                <span>·</span>
                <span>Märken:</span>
                {result.brands.slice(0, 5).map((b) => (
                  <Badge key={b} variant="outline">{b}</Badge>
                ))}
                {result.brands.length > 5 && (
                  <Badge variant="outline">+{result.brands.length - 5}</Badge>
                )}
              </>
            )}
          </div>

          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Svenska källor
              </h3>
              {seSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  brands={result.brands}
                  keywordsStr={keywordsStr}
                  sizesStr={sizesStr}
                  expanded={expandedSources.has(source.id)}
                  onToggle={() => toggleExpanded(source.id)}
                />
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Internationella källor
              </h3>
              {intlSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  brands={result.brands}
                  keywordsStr={keywordsStr}
                  sizesStr={sizesStr}
                  expanded={expandedSources.has(source.id)}
                  onToggle={() => toggleExpanded(source.id)}
                />
              ))}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

const SourceCard = ({
  source,
  brands,
  keywordsStr,
  sizesStr,
  expanded,
  onToggle,
}: {
  source: Source;
  brands: string[];
  keywordsStr: string;
  sizesStr: string;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const visibleBrands = expanded ? brands : brands.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = brands.length - DEFAULT_VISIBLE;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{source.name}</CardTitle>
        <CardDescription>{source.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {visibleBrands.map((brand) => {
            const url = source.build({ brand, keywords: keywordsStr });
            const vintedId = source.id === "vinted" ? VINTED_BRAND_IDS[brand] ?? "(fallback search_text)" : undefined;
            console.log(`[SourcingTool] ${source.name} · ${brand}${vintedId !== undefined ? ` · vinted brand_id=${vintedId}` : ""} → ${url}`);
            return (
              <a
                key={brand}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {brand}
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            );
          })}
        </div>

        {hiddenCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 px-2 text-xs">
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Visa färre
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Visa alla ({hiddenCount})
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
