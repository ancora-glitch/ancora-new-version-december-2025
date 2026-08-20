import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption = "newest" | "popularity" | "price_asc" | "price_desc";

interface ProductToolbarProps {
  filtersOpen: boolean;
  onToggleFilters: () => void;
  sortValue: SortOption | null;
  onSortChange: (value: SortOption) => void;
  activeFilterCount: number;
}

export const ProductToolbar = ({
  filtersOpen,
  onToggleFilters,
  sortValue,
  onSortChange,
  activeFilterCount,
}: ProductToolbarProps) => (
  <div className="flex items-center justify-between gap-4 mb-6">
    <button
      type="button"
      onClick={onToggleFilters}
      className="inline-flex items-center gap-2 text-sm text-foreground hover:text-foreground/80 transition-colors"
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span>{filtersOpen ? "Hide filters" : "Show filters"}</span>
      {activeFilterCount > 0 && (
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground text-background text-xs px-1.5">
          {activeFilterCount}
        </span>
      )}
    </button>

      <Select value={sortValue ?? undefined} onValueChange={(v) => onSortChange(v as SortOption)}>
      <SelectTrigger className="w-[200px] h-9 text-sm">
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest arrivals</SelectItem>
        <SelectItem value="popularity">Most popular</SelectItem>
        <SelectItem value="price_asc">Price, low to high</SelectItem>
        <SelectItem value="price_desc">Price, high to low</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
