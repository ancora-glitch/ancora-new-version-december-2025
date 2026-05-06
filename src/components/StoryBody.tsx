import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PRODUCT_TOKEN_RE = /\[\[product:([a-z0-9-]+)\]\]/gi;

const convertInlineImages = (text: string): string =>
  text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, caption, url) => {
    const captionHtml = caption ? `<figcaption class="article-image-caption">${caption}</figcaption>` : "";
    return `</p><figure class="article-inline-image"><img src="${url}" alt="${caption || "Article image"}" loading="lazy" />${captionHtml}</figure><p>`;
  });

const convertMarkdownFormatting = (text: string): string => {
  let result = convertInlineImages(text);
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return result;
};

const formatBodyContent = (body: string): string => {
  if (/<(p|div|h[1-6]|ul|ol|li|blockquote)[^>]*>/i.test(body)) {
    return convertMarkdownFormatting(body);
  }
  const lines = body.split(/\n/);
  const result: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) {
      result.push(`<p>${convertMarkdownFormatting(current.join("<br>"))}</p>`);
      current = [];
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    if (/^\d+\.\s/.test(trimmed)) {
      flush();
      result.push(`<p>${convertMarkdownFormatting(trimmed)}</p>`);
      continue;
    }
    current.push(trimmed);
  }
  flush();
  return result.join("\n");
};

type InlineProduct = {
  slug: string;
  brand: string;
  name: string;
  price: string;
  image: string;
};

const ProductInlineCard = ({ product }: { product: InlineProduct }) => (
  <Link
    to={`/product/${product.slug}`}
    className="not-prose my-10 flex items-center gap-4 p-3 border border-border rounded-sm bg-card hover:bg-secondary/30 transition-colors group no-underline"
  >
    <img
      src={product.image}
      alt={product.name}
      loading="lazy"
      width={96}
      height={120}
      className="w-20 h-24 md:w-24 md:h-28 object-cover rounded-sm flex-shrink-0"
    />
    <div className="min-w-0 flex-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-sans mb-1">
        {product.brand}
      </div>
      <div className="font-serif text-base md:text-lg text-primary leading-snug truncate">
        {product.name}
      </div>
      <div className="text-sm text-foreground/80 font-sans mt-1">{product.price}</div>
    </div>
    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
  </Link>
);

const SANITIZE_OPTS = {
  ADD_TAGS: ["figure", "figcaption"],
  ADD_ATTR: ["loading", "class", "src", "alt"],
};

export const StoryBody = ({ body, className }: { body: string; className?: string }) => {
  // Extract slugs referenced in body
  const slugs = Array.from(new Set(
    Array.from(body.matchAll(PRODUCT_TOKEN_RE)).map((m) => m[1].toLowerCase())
  ));

  const [products, setProducts] = useState<Record<string, InlineProduct>>({});

  useEffect(() => {
    if (slugs.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("slug,brand,name,price,image")
        .in("slug", slugs);
      if (cancelled || !data) return;
      const map: Record<string, InlineProduct> = {};
      for (const p of data as any[]) {
        if (p.slug) map[p.slug.toLowerCase()] = p as InlineProduct;
      }
      setProducts(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join(",")]);

  // Split body by tokens, preserving them
  const SPLIT_RE = /(\[\[product:[a-z0-9-]+\]\])/gi;
  const segments = body.split(SPLIT_RE);

  return (
    <div className={className}>
      {segments.map((seg, i) => {
        const tokenMatch = seg.match(/^\[\[product:([a-z0-9-]+)\]\]$/i);
        if (tokenMatch) {
          const slug = tokenMatch[1].toLowerCase();
          const product = products[slug];
          if (!product) return null; // silently drop missing/loading
          return <ProductInlineCard key={`p-${i}`} product={product} />;
        }
        if (!seg.trim()) return null;
        const html = DOMPurify.sanitize(formatBodyContent(seg), SANITIZE_OPTS);
        return <div key={`h-${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
};
