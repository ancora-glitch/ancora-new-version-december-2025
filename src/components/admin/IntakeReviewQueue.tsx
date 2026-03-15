import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const stateStyles: Record<string, string> = {
  normalized: "bg-blue-100 text-blue-800",
  rules_rejected: "bg-red-100 text-red-800",
  scored_review: "bg-amber-100 text-amber-800",
  scored_draft_approved: "bg-emerald-100 text-emerald-800",
  test_approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-muted text-muted-foreground",
  raw_imported: "bg-blue-50 text-blue-700",
  enriched: "bg-indigo-100 text-indigo-800",
};

const flagStyle = (type: "hard" | "soft") =>
  type === "hard"
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

interface IntakeReviewQueueProps {
  refreshKey: number;
}

export const IntakeReviewQueue = ({ refreshKey }: IntakeReviewQueueProps) => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["intake-review-queue", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_normalized_products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const productIds = products?.map((p) => p.id) ?? [];

  const { data: evaluations } = useQuery({
    queryKey: ["intake-evaluations", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_evaluations")
        .select("*")
        .in("normalized_product_id", productIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const evalMap = new Map(
    (evaluations ?? []).map((e) => [e.normalized_product_id, e])
  );

  const getFirstImage = (urls: unknown): string | null => {
    if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
    return null;
  };

  const renderFlags = (flags: unknown, type: "hard" | "soft") => {
    if (!flags || !Array.isArray(flags) || flags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {(flags as string[]).map((f, i) => (
          <span
            key={i}
            className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${flagStyle(type)}`}
          >
            {type === "hard" ? "✕" : "⚠"} {String(f)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h3 className="text-lg font-heading font-semibold text-foreground mb-3">
        Review queue
      </h3>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      ) : !products || products.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-border rounded-md p-6 text-center">
          No products in queue yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const img = getFirstImage(p.image_urls);
            const ev = evalMap.get(p.id);
            const state = p.current_queue_state ?? "unknown";

            return (
              <Card key={p.id} className="overflow-hidden">
                {img && (
                  <AspectRatio ratio={4 / 5}>
                    <img
                      src={img}
                      alt={p.title_raw ?? ""}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </AspectRatio>
                )}
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-sm font-medium leading-tight line-clamp-2">
                    {p.title_raw || "Untitled"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase tracking-wide">{p.source}</span>
                    {p.price != null && (
                      <span className="tabular-nums">
                        {p.price} {p.currency ?? "SEK"}
                      </span>
                    )}
                  </div>
                  {(p.category || p.subcategory) && (
                    <p className="text-xs text-muted-foreground">
                      {[p.category, p.subcategory].filter(Boolean).join(" / ")}
                    </p>
                  )}
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${stateStyles[state] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {state.replace(/_/g, " ")}
                  </Badge>

                  {ev && (
                    <div className="space-y-1 pt-1">
                      {renderFlags(ev.hard_flags, "hard")}
                      {renderFlags(ev.soft_flags, "soft")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
