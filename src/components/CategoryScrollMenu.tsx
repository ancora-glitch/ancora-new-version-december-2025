import { SubcategoryOption } from "@/constants/subcategories";

interface CategoryScrollMenuProps {
  options: SubcategoryOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  allLabel?: string;
  className?: string;
}

export const CategoryScrollMenu = ({
  options,
  selected,
  onSelect,
  allLabel = "All",
  className = "",
}: CategoryScrollMenuProps) => {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div className="flex items-center gap-6 min-w-max px-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`text-sm shrink-0 transition-colors pb-1 ${
            selected === null
              ? "text-foreground font-medium border-b border-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {allLabel}
        </button>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`text-sm shrink-0 transition-colors pb-1 ${
              selected === opt.value
                ? "text-foreground font-medium border-b border-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
