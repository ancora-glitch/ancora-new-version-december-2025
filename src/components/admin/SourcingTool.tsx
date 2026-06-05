import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ExternalLink, Copy, Search } from "lucide-react";
import { TIER_BRANDS, type BrandTier } from "@/constants/brands";

type TierSelection = BrandTier | "ALL";

interface Source {
  id: string;
  name: string;
  description: string;
  group: "se" | "intl";
  build: (q: string) => string;
}

const SOURCES: Source[] = [
  { id: "tradera", name: "Tradera", description: "Svensk second hand", group: "se",
    build: (q) => `https://www.tradera.com/search?q=${q}` },
  { id: "sellpy", name: "Sellpy", description: "Svensk second hand", group: "se",
    build: (q) => `https://www.sellpy.se/search?query=${q}` },
  { id: "vinted", name: "Vinted SE", description: "Svensk second hand", group: "se",
    build: (q) => `https://www.vinted.se/catalog?search_text=${q}` },
  { id: "plick", name: "Plick", description: "Svensk second hand", group: "se",
    build: (q) => `https://www.plick.se/s?query=${q}` },
  { id: "mai", name: "Mai.se", description: "Svensk second hand", group: "se",
    build: (q) => `https://mai.se/search?q=${q}` },
  { id: "ebay", name: "eBay UK", description: "Used items, £10+", group: "intl",
    build: (q) => `https://www.ebay.co.uk/sch/i.html?_nkw=${q}&LH_ItemCondition=3000&_udlo=10` },
  { id: "vestiaire", name: "Vestiaire Collective", description: "Internationell pre-loved", group: "intl",
    build: (q) => `https://www.vestiairecollective.com/search/?q=${q}` },
  { id: "depop", name: "Depop", description: "Internationell second hand", group: "intl",
    build: (q) => `https://www.depop.com/search/?q=${q}` },
  { id: "vintagesphere", name: "VintageSphere", description: "Svensk vintage", group: "intl",
    build: (q) => `https://vintagesphere.se/search?type=product&q=${q}` },
  { id: "redesignedby", name: "ReDesignedBy", description: "Svensk pre-loved", group: "intl",
    build: (q) => `https://redesignedby.se/search?type=product&q=${q}` },
  { id: "beyondretro", name: "Beyond Retro", description: "Internationell vintage", group: "intl",
    build: (q) => `https://www.beyondretro.com/search?type=product&q=${q}` },
];

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

function getBrands(tier: TierSelection): string[] {
  if (tier === "ALL") {
    return [...TIER_BRANDS.A, ...TIER_BRANDS.B, ...TIER_BRANDS.C];
  }
  return [...TIER_BRANDS[tier]];
}

interface GeneratedLink {
  source: Source;
  url: string;
}

interface SearchResult {
  links: GeneratedLink[];
  brands: string[];
  keywords: string[];
}

export const SourcingTool = () => {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<TierSelection>("ALL");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const tiers: { value: TierSelection; label: string }[] = [
    { value: "A", label: "Tier A" },
    { value: "B", label: "Tier B" },
    { value: "C", label: "Tier C" },
    { value: "ALL", label: "Alla" },
  ];

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Skriv något att söka efter");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const keywords = extractKeywords(query);
      const brandList = getBrands(tier).slice(0, 5);
      const keywordPart = keywords.join(" ");
      const brandPart = brandList.join(" OR ");
      const q = encodeURIComponent([keywordPart, brandPart].filter(Boolean).join(" "));
      const links: GeneratedLink[] = SOURCES.map((s) => ({ source: s, url: s.build(q) }));
      setResult({ links, brands: brandList, keywords });
      setLoading(false);
    }, 300);
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Länk kopierad");
    } catch {
      toast.error("Kunde inte kopiera");
    }
  };

  const seLinks = result?.links.filter((l) => l.source.group === "se") ?? [];
  const intlLinks = result?.links.filter((l) => l.source.group === "intl") ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-serif text-primary mb-2">Sourcing Tool</h2>
        <p className="text-muted-foreground text-sm">
          Generera söklänkar till second hand-källor utifrån fritext och utvald märkes-tier.
        </p>
      </div>

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

          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <Button
                key={t.value}
                variant={tier === t.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTier(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sök
          </Button>
        </CardContent>
      </Card>

      {!result && (
        <div className="border border-dashed border-border rounded-md p-12 text-center text-muted-foreground">
          Välj tier och skriv vad du letar efter
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{result.links.length} länkar genererade</span>
            {result.keywords.length > 0 && (
              <>
                <span>·</span>
                <span>Nyckelord:</span>
                {result.keywords.map((k) => (
                  <Badge key={k} variant="secondary">{k}</Badge>
                ))}
              </>
            )}
            {result.brands.length > 0 && (
              <>
                <span>·</span>
                <span>Märken:</span>
                {result.brands.map((b) => (
                  <Badge key={b} variant="outline">{b}</Badge>
                ))}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Svenska källor
              </h3>
              {seLinks.map((l) => (
                <SourceCard key={l.source.id} link={l} onCopy={handleCopy} />
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Internationella källor
              </h3>
              {intlLinks.map((l) => (
                <SourceCard key={l.source.id} link={l} onCopy={handleCopy} />
              ))}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

const SourceCard = ({
  link,
  onCopy,
}: {
  link: GeneratedLink;
  onCopy: (url: string) => void;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{link.source.name}</CardTitle>
      <CardDescription>{link.source.description}</CardDescription>
    </CardHeader>
    <CardContent className="flex items-center gap-2">
      <Button asChild size="sm">
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-4 h-4" />
          Öppna
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => onCopy(link.url)}>
        <Copy className="w-4 h-4" />
        Kopiera
      </Button>
    </CardContent>
  </Card>
);
