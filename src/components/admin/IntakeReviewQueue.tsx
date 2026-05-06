import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CheckCircle2, XCircle, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const stateStyles: Record<string, string> = {
  scored_draft_approved: "bg-emerald-100 text-emerald-800",
  scored_review: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  enriched: "bg-blue-100 text-blue-800",
  normalized: "bg-gray-100 text-gray-700",
  test_approved: "bg-emerald-100 text-emerald-800",
  raw_imported: "bg-gray-100 text-gray-600",
  rules_rejected: "bg-red-100 text-red-800",
};

const tierStyles: Record<string, string> = {
  a: "bg-emerald-100 text-emerald-800",
  b: "bg-blue-100 text-blue-800",
  c: "bg-amber-100 text-amber-800",
  reject: "bg-red-100 text-red-800",
  unknown: "bg-gray-100 text-gray-600",
};

const tierLabel: Record<string, string> = {
  a: "Tier A", b: "Tier B", c: "Tier C", reject: "Reject", unknown: "Unknown",
};

const scoreColor = (score: number): string => {
  if (score >= 75) return "bg-emerald-100 text-emerald-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
};

const flagStyle = (type: "hard" | "soft") =>
  type === "hard"
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

type FilterState = "all" | "scored_draft_approved" | "scored_review" | "rejected" | "test_approved";
type DateFilter = "all" | "today" | "7d";

const FILTERS: { label: string; value: FilterState }[] = [
  { label: "All", value: "all" },
  { label: "Draft approved", value: "scored_draft_approved" },
  { label: "Review", value: "scored_review" },
  { label: "Rejected", value: "rejected" },
  { label: "Test approved", value: "test_approved" },
];

const DATE_FILTERS: { label: string; value: DateFilter }[] = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
];

const formatDate = (value: unknown): string | null => {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

interface IntakeReviewQueueProps {
  refreshKey: number;
}

export const IntakeReviewQueue = ({ refreshKey }: IntakeReviewQueueProps) => {
  const [filter, setFilter] = useState<FilterState>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleConfirmPromote = async (productId: string) => {
    setActionLoading((prev) => ({ ...prev, [productId]: "approve" }));
    try {
      const { data, error } = await supabase.functions.invoke("intake-promote-product", {
        body: { normalized_product_id: productId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Promotion failed");
      toast.success("Draft created in Products");
      queryClient.invalidateQueries({ queryKey: ["intake-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["intake-evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["intake-queue-counts"] });
    } catch (e: any) {
      toast.error(e?.message || "Promotion failed");
    } finally {
      setActionLoading((prev) => {
        const n = { ...prev };
        delete n[productId];
        return n;
      });
      setConfirmPromoteId(null);
    }
  };

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

  const { data: brandTiers } = useQuery({
    queryKey: ["intake-brand-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_brand_tiers")
        .select("brand_name, tier");
      if (error) throw error;
      return data ?? [];
    },
  });

  const evalMap = new Map(
    (evaluations ?? []).map((e) => [e.normalized_product_id, e])
  );

  const tierMap = new Map(
    (brandTiers ?? []).map((bt) => [bt.brand_name.toLowerCase(), bt.tier])
  );

  const getFirstImage = (urls: unknown): string | null => {
    if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
    return null;
  };

  const getEditorialReason = (ev: any): string | null => {
    if (!ev?.reasons || !Array.isArray(ev.reasons)) return null;
    const reason = ev.reasons[0];
    return typeof reason === "string" && reason.length > 0 ? reason : null;
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

  // Sort products by score descending
  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    const scoreA = evalMap.get(a.id)?.score_total ?? -1;
    const scoreB = evalMap.get(b.id)?.score_total ?? -1;
    return scoreB - scoreA;
  });

  const stateFiltered = filter === "all"
    ? sortedProducts
    : sortedProducts.filter((p) => p.current_queue_state === filter);

  const now = Date.now();
  const dateThreshold =
    dateFilter === "today" ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    : dateFilter === "7d" ? now - 7 * 24 * 60 * 60 * 1000
    : null;

  const filteredProducts = dateThreshold == null
    ? stateFiltered
    : stateFiltered.filter((p) => {
        if (!p.created_at) return false;
        const t = new Date(p.created_at).getTime();
        return !isNaN(t) && t >= dateThreshold;
      });

  const handleAction = async (
    productId: string,
    action: "approve" | "reject" | "feature"
  ) => {
    setActionLoading((prev) => ({ ...prev, [productId]: action }));
    try {
      const newState = action === "reject" ? "rejected" : "test_approved";

      const { error: updateErr } = await supabase
        .from("intake_normalized_products")
        .update({
          current_queue_state: newState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updateErr) throw updateErr;

      if (action === "feature") {
        const ev = evalMap.get(productId);
        if (ev) {
          const existingSoftFlags = Array.isArray(ev.soft_flags) ? ev.soft_flags : [];
          if (!existingSoftFlags.includes("feature_candidate")) {
            const { error: evalErr } = await supabase
              .from("intake_evaluations")
              .update({
                soft_flags: [...existingSoftFlags, "feature_candidate"],
              })
              .eq("id", ev.id);
            if (evalErr) throw evalErr;
          }
        }
      }

      toast.success(
        action === "approve" ? "Approved" :
        action === "reject" ? "Rejected" : "Featured"
      );

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["intake-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["intake-evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["intake-queue-counts"] });
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  };

  return (
    <div>
      <h3 className="text-lg font-heading font-semibold text-foreground mb-3">
        Review queue
      </h3>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-border rounded-md p-6 text-center">
          {filter === "all" ? "No products in queue yet." : `No products with state "${filter.replace(/_/g, " ")}".`}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const img = getFirstImage(p.image_urls);
            const ev = evalMap.get(p.id);
            const state = p.current_queue_state ?? "unknown";
            const brandLower = (p.brand ?? "").toLowerCase();
            const tier = tierMap.get(brandLower) ?? "unknown";
            const editorialReason = getEditorialReason(ev);
            const loading = actionLoading[p.id];

            return (
              <Card key={p.id} className="overflow-hidden flex flex-col">
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
                <CardContent className="p-3 space-y-1.5 flex-1 flex flex-col">
                  <p className="text-sm font-medium leading-tight line-clamp-2">
                    {p.title_clean || p.title_raw || "Untitled"}
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

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${stateStyles[state] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {state.replace(/_/g, " ")}
                    </Badge>
                    {ev?.score_total != null && (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${scoreColor(ev.score_total)}`}
                      >
                        Score: {ev.score_total}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${tierStyles[tier]}`}
                    >
                      {tierLabel[tier] ?? "Unknown"}
                    </Badge>
                  </div>

                  {/* Flags */}
                  {ev && (
                    <div className="space-y-1">
                      {renderFlags(ev.hard_flags, "hard")}
                      {renderFlags(ev.soft_flags, "soft")}
                    </div>
                  )}

                  {/* Editorial reason */}
                  {editorialReason && (
                    <p className="text-[11px] italic text-muted-foreground leading-snug">
                      {editorialReason}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-1.5 pt-2 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      disabled={!!loading}
                      onClick={() => setConfirmPromoteId(p.id)}
                    >
                      {loading === "approve" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1 text-red-700 border-red-300 hover:bg-red-50"
                      disabled={!!loading}
                      onClick={() => handleAction(p.id, "reject")}
                    >
                      {loading === "reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                      disabled={!!loading}
                      onClick={() => handleAction(p.id, "feature")}
                    >
                      {loading === "feature" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                      Feature
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!confirmPromoteId}
        onOpenChange={(open) => {
          if (!open && !(confirmPromoteId && actionLoading[confirmPromoteId] === "approve")) {
            setConfirmPromoteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to draft product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a draft product in the live products table. You can review and publish it from the Products tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={!!(confirmPromoteId && actionLoading[confirmPromoteId] === "approve")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!(confirmPromoteId && actionLoading[confirmPromoteId] === "approve")}
              onClick={(e) => {
                e.preventDefault();
                if (confirmPromoteId) handleConfirmPromote(confirmPromoteId);
              }}
            >
              {confirmPromoteId && actionLoading[confirmPromoteId] === "approve" ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Promoting…</>
              ) : (
                "Approve & promote"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
