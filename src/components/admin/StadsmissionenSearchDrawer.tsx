import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useImportToProduct, checkProductDuplicate } from "@/hooks/useImportToProduct";
import { translateImport } from "@/lib/translateImport";
import { toast } from "sonner";
import { Loader2, Search, Package, AlertCircle, Store } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface SsmCategory { id: string; name: string; parent: string | null; level: number }
interface SsmListItem { id: string; sku: string | null; title: string }
interface SsmProduct {
  id: string;
  sku: string | null;
  type: string;
  title: string;
  shop_url: string | null;
  price: { amount: string; currency: string } | null;
  category: { id: string; name: string }[];
  condition: string | null;
  description: string | null;
  details: string | null;
  attributes: Record<string, any>;
  images: { url: string; alt: string | null }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const MARKETPLACE = "stadsmissionen";
const PAGE_LIMIT = 20;
const MAX_IMPORT_PER_RUN = 10;
const ALL = "__all__";

async function callSsm(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("stadsmissionen-search", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = await (error as any).context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function StadsmissionenSearchDrawer({ open, onOpenChange, onImported }: Props) {
  const importMutation = useImportToProduct();
  const [categories, setCategories] = useState<SsmCategory[]>([]);
  const [category, setCategory] = useState<string>(ALL);
  const [keywords, setKeywords] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SsmListItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [details, setDetails] = useState<Record<string, SsmProduct>>({});

  useEffect(() => {
    if (!open) {
      setSearchError(null);
      setSelected(new Set());
      setProgress(null);
      setIsImporting(false);
      return;
    }
    if (categories.length === 0) {
      callSsm({ action: "categories" })
        .then((d) => setCategories(d?.data || []))
        .catch((e) => setSearchError(e.message));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectable = useMemo(() => results.filter((r) => !existing.has(r.id)), [results, existing]);

  const runSearch = async (targetPage = 1) => {
    setIsSearching(true);
    setSearchError(null);
    setSelected(new Set());
    try {
      const { data: prods } = await supabase.from("products").select("slug, affiliate_url").eq("marketplace", MARKETPLACE);
      const set = new Set<string>();
      for (const p of prods || []) {
        const m = p.affiliate_url?.match(/\/product\/([0-9a-f-]{36})/i);
        if (m) set.add(m[1]);
      }
      setExisting(set);

      const d = await callSsm({
        action: "search",
        search: keywords.trim() || undefined,
        category: category === ALL ? undefined : category,
        page: targetPage,
        limit: PAGE_LIMIT,
      });
      const list: SsmListItem[] = d?.data || [];
      setResults(list);
      // Fetch previews (image + price) for the visible page in parallel
      list.forEach((it) => {
        callSsm({ action: "item", id: it.id })
          .then((r) => r?.data && setDetails((prev) => ({ ...prev, [it.id]: r.data as SsmProduct })))
          .catch(() => { /* preview is optional */ });
      });
      setPage(d?.meta?.page || targetPage);
      setTotalPages(d?.meta?.pages || 0);
      setTotal(d?.meta?.total || 0);
      setHasSearched(true);
    } catch (e: any) {
      setSearchError(e.message || "Search failed");
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const importOne = async (item: SsmListItem): Promise<"ok" | "dupe" | "fail"> => {
    const p = details[item.id] ?? ((await callSsm({ action: "item", id: item.id }))?.data as SsmProduct | undefined);
    if (!p) return "fail";
    if (await checkProductDuplicate(MARKETPLACE, p.id, p.shop_url)) return "dupe";

    const a = p.attributes || {};
    const brandRaw: string | null = a.brand ?? null;
    const brand = brandRaw && brandRaw !== "Okänt märke" ? brandRaw : "Unknown";
    const size = Array.isArray(a.size) && a.size.length ? a.size.join(", ") : null;
    const material = a.material_text || (Array.isArray(a.material) && a.material.length ? a.material.join(", ") : null);
    const color = a.color ?? null;
    const images = (p.images || []).map((i) => i.url);
    const description = [p.description, p.details].filter(Boolean).join("\n\n") || p.title;
    const price = p.price ? parseFloat(p.price.amount) : null;

    const tx = await translateImport({
      title: p.title,
      description,
      condition: p.condition ?? undefined,
      material: material ?? undefined,
      size: size ?? undefined,
      brand: brand !== "Unknown" ? brand : undefined,
      sourceRef: p.id,
    });

    await importMutation.mutateAsync({
      marketplace: MARKETPLACE,
      source_ref: p.id,
      source_url: p.shop_url,
      affiliate_url: p.shop_url,
      title: p.title,
      title_original: p.title,
      title_en: tx.title_en,
      description,
      description_original: description,
      description_en: tx.description_en,
      language: tx.language,
      translated_at: tx.translated_at,
      brand,
      brand_original: brandRaw,
      size,
      color,
      color_original: color,
      material,
      material_original: material,
      condition: p.condition,
      condition_original: p.condition,
      price: price != null && !isNaN(price) ? price : null,
      currency: p.price?.currency || "SEK",
      primary_image: images[0] || null,
      images,
      category_id: null,
      provenance: "Stockholms Stadsmission",
      condition_enum: p.condition,
      signals: {
        sku: p.sku,
        type: p.type,
        categories: p.category.map((c) => c.name),
        pattern: a.pattern ?? null,
        colors: color ? [color] : [],
      },
    });
    return "ok";
  };

  const handleImport = async () => {
    const ids = Array.from(selected).filter((id) => !existing.has(id)).slice(0, MAX_IMPORT_PER_RUN);
    if (!ids.length) return toast.error("Select items to import");
    setIsImporting(true);
    setProgress({ current: 0, total: ids.length });
    let ok = 0, dupe = 0, fail = 0;
    const nextExisting = new Set(existing);
    for (let i = 0; i < ids.length; i++) {
      setProgress({ current: i + 1, total: ids.length });
      const item = results.find((r) => r.id === ids[i]);
      if (!item) { fail++; continue; }
      try {
        const r = await importOne(item);
        if (r === "ok") { ok++; nextExisting.add(item.id); }
        else if (r === "dupe") { dupe++; nextExisting.add(item.id); }
        else fail++;
      } catch (e) {
        console.error("[Stadsmissionen] import failed", e);
        fail++;
      }
    }
    setExisting(nextExisting);
    setSelected(new Set());
    setIsImporting(false);
    setProgress(null);
    const parts = [ok && `${ok} imported`, dupe && `${dupe} already existed`, fail && `${fail} failed`].filter(Boolean).join(", ");
    if (ok) { toast.success(parts); onImported?.(); }
    else if (fail) toast.error(parts || "Import failed");
    else toast.info(parts);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Store className="w-5 h-5" />
            Search Stadsmissionen
          </SheetTitle>
          <SheetDescription>Browse Stockholms Stadsmission and import items as draft products.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-4 mt-6 overflow-hidden">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isSearching}>
              <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {"\u00A0\u00A0".repeat(c.level - 1)}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ssm-keywords">Keywords <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <div className="flex gap-2">
              <Input
                id="ssm-keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="ullkappa, sidenklänning..."
                onKeyDown={(e) => e.key === "Enter" && !isSearching && runSearch(1)}
                disabled={isSearching}
              />
              <Button onClick={() => runSearch(1)} disabled={isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Importer skapas alltid som draft. Max {MAX_IMPORT_PER_RUN} per körning.</p>
          </div>

          {searchError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{searchError}</span>
            </div>
          )}

          {hasSearched && results.length === 0 && !searchError && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p>Inga produkter hittades</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{total} träffar · sida {page}/{totalPages}</span>
                {selectable.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() =>
                    setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((i) => i.id)))
                  }>
                    {selected.size === selectable.length ? "Avmarkera alla" : "Välj alla nya"}
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {results.map((item) => {
                    const isExisting = existing.has(item.id);
                    const isSelected = selected.has(item.id);
                    return (
                      <div key={item.id} className={`flex gap-3 p-3 border rounded-md transition-colors ${
                        isExisting ? "opacity-50 bg-muted" : isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}>
                        <Checkbox checked={isSelected} onCheckedChange={() => !isExisting && toggle(item.id)} disabled={isExisting || isImporting} />
                        {details[item.id]?.images?.[0]?.url ? (
                          <img
                            src={details[item.id].images[0].url}
                            alt={details[item.id].images[0].alt || item.title}
                            className="w-16 h-16 object-cover rounded flex-shrink-0"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            {details[item.id] ? <Package className="w-6 h-6 text-muted-foreground" /> : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {details[item.id]?.price && <span>{parseFloat(details[item.id].price!.amount).toFixed(0)} {details[item.id].price!.currency}</span>}
                            {item.sku && <span>{item.sku}</span>}
                            {isExisting && <Badge variant="outline" className="text-[10px] h-4 px-1">Already imported</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex justify-between">
                <Button variant="outline" size="sm" disabled={page <= 1 || isSearching} onClick={() => runSearch(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages || isSearching} onClick={() => runSearch(page + 1)}>Next</Button>
              </div>
            </>
          )}

          {progress && (
            <div className="space-y-2">
              <Progress value={(progress.current / progress.total) * 100} />
              <p className="text-xs text-muted-foreground text-center">Importing {progress.current}/{progress.total}...</p>
            </div>
          )}

          {selected.size > 0 && (
            <Button onClick={handleImport} disabled={isImporting} className="w-full">
              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Package className="w-4 h-4 mr-2" />}
              Importera {Math.min(selected.size, MAX_IMPORT_PER_RUN)} plagg som draft
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
