import { useState } from "react";
import { useImportItems, type AisStatus, type AisSourceType } from "@/hooks/useImportItems";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface ImportItemsListProps {
  onSelectItem: (id: string) => void;
  selectedItemId: string | null;
}

const statusBadge = (status: AisStatus) => {
  switch (status) {
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    case "reviewed":
      return <Badge className="bg-accent text-accent-foreground">Reviewed</Badge>;
    case "promoted":
      return <Badge className="bg-primary text-primary-foreground">Promoted</Badge>;
    case "discarded":
      return <Badge variant="outline" className="text-muted-foreground">Discarded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const sourceBadge = (source: AisSourceType) => {
  const colors: Record<AisSourceType, string> = {
    tradera: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    ebay: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    manual: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    csv: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };
  return (
    <Badge variant="outline" className={colors[source]}>
      {source}
    </Badge>
  );
};

export function ImportItemsList({ onSelectItem, selectedItemId }: ImportItemsListProps) {
  const [statusFilter, setStatusFilter] = useState<AisStatus | "all">("draft");
  const [sourceFilter, setSourceFilter] = useState<AisSourceType | "all">("all");

  const { data: items, isLoading } = useImportItems({
    status: statusFilter === "all" ? undefined : statusFilter,
    source_type: sourceFilter === "all" ? undefined : sourceFilter,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-sm animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 items-center p-4 border border-border rounded-sm bg-card">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AisStatus | "all")}>
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="promoted">Promoted</SelectItem>
            <SelectItem value="discarded">Discarded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as AisSourceType | "all")}>
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="tradera">Tradera</SelectItem>
            <SelectItem value="ebay">eBay</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {items?.length || 0} items
        </span>
      </div>

      {/* List */}
      {items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 border rounded-sm bg-card cursor-pointer transition-colors ${
                selectedItemId === item.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => onSelectItem(item.id)}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 bg-muted rounded-sm overflow-hidden flex-shrink-0">
                {item.images[0] ? (
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No image
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-primary truncate">{item.title}</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {sourceBadge(item.source_type)}
                  {statusBadge(item.status)}
                  {item.price && (
                    <span className="text-sm text-muted-foreground">
                      {item.price} {item.currency || "SEK"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(item.created_at), "MMM d, yyyy")}
                </p>
              </div>

              {/* Source link */}
              {item.source_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(item.source_url!, "_blank");
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-border rounded-sm bg-card">
          <p className="text-muted-foreground">No import items found.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Import candidates will appear here for editorial review.
          </p>
        </div>
      )}
    </div>
  );
}
