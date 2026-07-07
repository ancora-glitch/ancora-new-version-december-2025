import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface ActiveProductFilters {
  colors: string[];
  sizes: string[];
  brands: string[];
}

export const EMPTY_FILTERS: ActiveProductFilters = { colors: [], sizes: [], brands: [] };

interface FilterGroupProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

const FilterGroup = ({ title, options, selected, onToggle }: FilterGroupProps) => {
  const [open, setOpen] = useState(true);
  if (options.length === 0) return null;

  return (
    <div className="border-b border-border/40 py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm text-foreground"
      >
        <span className="font-medium">{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
          {options.map((opt) => (
            <li key={opt}>
              <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="h-4 w-4 rounded border-border accent-foreground"
                />
                <span>{opt}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface ProductFiltersProps {
  colorOptions: string[];
  sizeOptions: string[];
  brandOptions: string[];
  active: ActiveProductFilters;
  onChange: (next: ActiveProductFilters) => void;
}

export const ProductFilters = ({
  colorOptions,
  sizeOptions,
  brandOptions,
  active,
  onChange,
}: ProductFiltersProps) => {
  const toggle = (key: keyof ActiveProductFilters, value: string) => {
    const current = active[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...active, [key]: next });
  };

  return (
    <aside className="w-full md:w-56 shrink-0">
      <FilterGroup
        title="Färg"
        options={colorOptions}
        selected={active.colors}
        onToggle={(v) => toggle("colors", v)}
      />
      <FilterGroup
        title="Storlek"
        options={sizeOptions}
        selected={active.sizes}
        onToggle={(v) => toggle("sizes", v)}
      />
      <FilterGroup
        title="Varumärke"
        options={brandOptions}
        selected={active.brands}
        onToggle={(v) => toggle("brands", v)}
      />
    </aside>
  );
};
