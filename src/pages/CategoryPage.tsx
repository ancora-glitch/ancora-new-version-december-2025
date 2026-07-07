import { useState, useEffect, useMemo } from "react";
import { useParams, Navigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import { PUBLIC_VISIBLE_PRODUCT_STATUSES, formatPrice, parsePriceValue } from "@/hooks/useProducts";
import { CLOTHING_SUBCATEGORIES } from "@/constants/subcategories";
import { CategoryScrollMenu } from "@/components/CategoryScrollMenu";
import { ProductToolbar, SortOption } from "@/components/ProductToolbar";
import { ProductFilters, ActiveProductFilters, EMPTY_FILTERS } from "@/components/ProductFilters";
import { brandGroupKey, canonicalBrandDisplay } from "@/utils/normalizeBrand";

type Category = Tables<"categories">;
type Product = Tables<"products">;

const useCategoryBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data as Category | null;
    },
    enabled: !!slug,
  });
};

const useCategoryProducts = (categoryId: string | undefined) => {
  return useQuery({
    queryKey: ["category-products", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryId)
        .in("status", PUBLIC_VISIBLE_PRODUCT_STATUSES)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!categoryId,
  });
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const subFromUrl = searchParams.get("sub");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(subFromUrl);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortValue, setSortValue] = useState<SortOption | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveProductFilters>(EMPTY_FILTERS);

  const { data: category, isLoading: categoryLoading, error: categoryError } = useCategoryBySlug(slug);
  const { data: products, isLoading: productsLoading } = useCategoryProducts(category?.id);

  const isClothing = slug === "clothing";

  // Sync URL param to state
  useEffect(() => {
    setSelectedSubcategory(subFromUrl);
  }, [subFromUrl]);

  const handleSubcategoryChange = (sub: string | null) => {
    setSelectedSubcategory(sub);
    if (sub) {
      setSearchParams({ sub });
    } else {
      setSearchParams({});
    }
  };

  const subcategoryFilteredProducts = useMemo(() => {
    return isClothing && selectedSubcategory
      ? products?.filter((p) => (p as any).subcategory === selectedSubcategory) ?? []
      : products ?? [];
  }, [products, isClothing, selectedSubcategory]);

  const colorOptions = useMemo(
    () => Array.from(new Set(subcategoryFilteredProducts.map((p) => p.color).filter(Boolean))) as string[],
    [subcategoryFilteredProducts]
  );
  const sizeOptions = useMemo(
    () => Array.from(new Set(subcategoryFilteredProducts.map((p) => p.size).filter(Boolean))) as string[],
    [subcategoryFilteredProducts]
  );
  const brandOptions = useMemo(() => {
    const groups = new Map<string, string>(); // groupKey -> canonical display
    subcategoryFilteredProducts.forEach((p) => {
      if (!p.brand) return;
      const key = brandGroupKey(p.brand);
      if (!groups.has(key)) {
        groups.set(key, canonicalBrandDisplay(p.brand));
      }
    });
    return Array.from(groups.values()).sort();
  }, [subcategoryFilteredProducts]);

  const filteredProducts = useMemo(() => {
    let result = subcategoryFilteredProducts.filter((p) => {
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
    // sortValue === null → behåller ursprunglig sort_order-ordning

    return result;
  }, [subcategoryFilteredProducts, activeFilters, sortValue]);

  // Update document metadata when category data is available
  useEffect(() => {
    if (category) {
      document.title = category.seo_title || `${category.name} | ANCORA`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      const descriptionContent = category.seo_description || category.description || `Shop ${category.name} at ANCORA`;
      
      if (metaDescription) {
        metaDescription.setAttribute("content", descriptionContent);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = descriptionContent;
        document.head.appendChild(meta);
      }
    }
    
    return () => {
      document.title = "ANCORA";
    };
  }, [category]);

  // Show loading state
  if (categoryLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 md:pt-28 pb-16 md:pb-24">
          <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-6">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-12 md:mb-16">
            <Skeleton className="h-10 md:h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-5 w-full max-w-2xl mx-auto" />
          </div>
          <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/5] w-full" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If category not found or is draft, show 404
  if (categoryError || !category || category.status === "draft") {
    return <Navigate to="/404" replace />;
  }

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
            {category.name}
          </h1>
          {category.description && (
            <p className="text-center text-muted-foreground max-w-2xl mx-auto">
              {category.description}
            </p>
          )}
        </div>

        {/* Subcategory Filters (Clothing only) */}
        {isClothing && (
          <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-10 md:mb-14">
            <CategoryScrollMenu
              options={CLOTHING_SUBCATEGORIES}
              selected={selectedSubcategory}
              onSelect={handleSubcategoryChange}
            />
          </div>
        )}

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
              {productsLoading ? (
                <p className="text-center text-muted-foreground py-20">Loading products...</p>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
                  {filteredProducts.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.slug || product.id}`}
                      state={{ from: location.pathname + location.search }}
                      className="group block bg-card overflow-hidden border border-border/20 hover:border-border/40 hover:bg-secondary/10 transition-all duration-300 min-h-[44px]"
                      aria-label={`View ${product.brand} ${product.name}`}
                    >
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
                  <p className="text-muted-foreground mb-4">All gone. Check back in another day — we're out looking for great stuff for you.</p>
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

export default CategoryPage;
