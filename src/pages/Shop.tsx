import { useState, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useProducts, formatPrice, parsePriceValue } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { CLOTHING_SUBCATEGORIES } from "@/constants/subcategories";
import { CategoryScrollMenu } from "@/components/CategoryScrollMenu";
import { ProductToolbar, SortOption } from "@/components/ProductToolbar";
import { ProductFilters, ActiveProductFilters, EMPTY_FILTERS } from "@/components/ProductFilters";
import { brandGroupKey, canonicalBrandDisplay } from "@/utils/normalizeBrand";

const Shop = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [isHoveringClothing, setIsHoveringClothing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortValue, setSortValue] = useState<SortOption | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveProductFilters>(EMPTY_FILTERS);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const isMobile = useIsMobile();

  const selectedCatSlug = categories?.find((c) => c.id === selectedCategory)?.slug;
  const isClothingSelected = selectedCatSlug === "clothing";
  const clothingCategory = categories?.find((c) => c.slug === "clothing");

  // Show subcategory row if clothing is selected OR hovered (desktop only)
  const showSubcategories = isClothingSelected || (!isMobile && isHoveringClothing);

  const handleClothingMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHoveringClothing(true);
  }, [isMobile]);

  const handleClothingMouseLeave = useCallback(() => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoveringClothing(false);
    }, 150);
  }, [isMobile]);

  const handleSubcategoryRowEnter = useCallback(() => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, [isMobile]);

  const handleSubcategoryRowLeave = useCallback(() => {
    if (isMobile) return;
    if (!isClothingSelected) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHoveringClothing(false);
      }, 150);
    }
  }, [isMobile, isClothingSelected]);

  const categoryFilteredProducts = useMemo(() => {
    return products?.filter((product) => {
      if (selectedCategory && product.category_id !== selectedCategory) return false;
      if (isClothingSelected && selectedSubcategory && (product as any).subcategory !== selectedSubcategory) return false;
      return true;
    }) ?? [];
  }, [products, selectedCategory, selectedSubcategory, isClothingSelected]);

  const colorOptions = useMemo(
    () => Array.from(new Set(categoryFilteredProducts.map((p) => p.color).filter(Boolean))) as string[],
    [categoryFilteredProducts]
  );
  const sizeOptions = useMemo(
    () => Array.from(new Set(categoryFilteredProducts.map((p) => p.size).filter(Boolean))) as string[],
    [categoryFilteredProducts]
  );
  const brandOptions = useMemo(() => {
    const groups = new Map<string, string>(); // groupKey -> canonical display
    categoryFilteredProducts.forEach((p) => {
      if (!p.brand) return;
      const key = brandGroupKey(p.brand);
      if (!groups.has(key)) {
        groups.set(key, canonicalBrandDisplay(p.brand));
      }
    });
    return Array.from(groups.values()).sort();
  }, [categoryFilteredProducts]);

  const filteredProducts = useMemo(() => {
    let result = categoryFilteredProducts.filter((p) => {
      if (activeFilters.colors.length && !activeFilters.colors.includes(p.color ?? "")) return false;
      if (activeFilters.sizes.length && !activeFilters.sizes.includes(p.size ?? "")) return false;
      if (
        activeFilters.brands.length &&
        !activeFilters.brands.some((selectedDisplay) => {
          const productKey = p.brand ? brandGroupKey(p.brand) : "";
          const selectedKey = brandGroupKey(selectedDisplay);
          return productKey === selectedKey;
        })
      ) return false;
      return true;
    });

    if (sortValue === "price_asc") {
      result = [...result].sort((a, b) => parsePriceValue(a.price) - parsePriceValue(b.price));
    } else if (sortValue === "price_desc") {
      result = [...result].sort((a, b) => parsePriceValue(b.price) - parsePriceValue(a.price));
    } else if (sortValue === "newest") {
      result = [...result].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    // Ingen sortval vald = behåll ursprunglig ordning (created_at desc från useProducts)

    return result;
  }, [categoryFilteredProducts, activeFilters, sortValue]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        {/* Back Navigation */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </Link>
        </div>

        {/* Page Header */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-4">
            Shop
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            Explore our full collection of curated second-hand pieces.
          </p>
        </div>

        {/* Category Filters */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-4">
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSubcategory(null);
                setIsHoveringClothing(false);
              }}
              className="px-6 py-2 h-auto text-sm tracking-wide"
            >
              All
            </Button>
            {categories?.map((category) => {
              const isClothingBtn = category.slug === "clothing";
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSelectedSubcategory(null);
                  }}
                  onMouseEnter={isClothingBtn ? handleClothingMouseEnter : undefined}
                  onMouseLeave={isClothingBtn ? handleClothingMouseLeave : undefined}
                  className="px-6 py-2 h-auto text-sm tracking-wide"
                >
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Subcategory Filters (Clothing only) — shared scroll menu */}
        <div
          className="relative px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-8 md:mb-12"
          onMouseEnter={handleSubcategoryRowEnter}
          onMouseLeave={handleSubcategoryRowLeave}
        >
          {showSubcategories && (
            <div className="pt-1">
              <CategoryScrollMenu
                options={CLOTHING_SUBCATEGORIES}
                selected={selectedSubcategory}
                onSelect={(sub) => {
                  if (sub !== null && !isClothingSelected && clothingCategory) {
                    setSelectedCategory(clothingCategory.id);
                  }
                  setSelectedSubcategory(sub);
                }}
              />
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
          <ProductToolbar
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((o) => !o)}
            sortValue={sortValue}
            onSortChange={setSortValue}
            activeFilterCount={activeFilters.colors.length + activeFilters.sizes.length + activeFilters.brands.length}
          />
        </div>

        {/* Products Grid */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8">
            {filtersOpen && (
              <ProductFilters
                colorOptions={colorOptions}
                sizeOptions={sizeOptions}
                brandOptions={brandOptions}
                active={activeFilters}
                onChange={setActiveFilters}
              />
            )}
            <div className="flex-1">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-20">
                  Loading products...
                </p>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
                  {filteredProducts.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.slug || product.id}`}
                      state={{ from: "/shop" }}
                      className="group block bg-card overflow-hidden border border-border/20 hover:border-border/40 hover:bg-secondary/10 transition-all duration-300 min-h-[44px]"
                      aria-label={`View ${product.brand} ${product.name}`}
                    >
                      {/* Image Container */}
                      <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          width={400}
                          height={500}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300" />
                      </div>

                      {/* Card Content */}
                      <div className="p-4 space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-widest text-foreground">
                          {product.brand}
                        </span>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {product.name}{product.size && <>, size: {product.size}</>}
                        </p>
                        <p className="text-base font-semibold text-foreground pt-1">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-muted-foreground mb-4">
                    All gone. Check back in another day — we're out looking for great stuff for you.
                  </p>
                  {selectedCategory && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedCategory(null);
                        setSelectedSubcategory(null);
                      }}
                      className="mt-2"
                    >
                      View all products
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
