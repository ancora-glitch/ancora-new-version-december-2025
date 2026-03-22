import { useState, useEffect } from "react";
import { useParams, Navigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import { PUBLIC_VISIBLE_PRODUCT_STATUSES, formatPrice } from "@/hooks/useProducts";

type Category = Tables<"categories">;
type Product = Tables<"products">;

const CLOTHING_SUBCATEGORIES = [
  { value: "outerwear", label: "Outerwear" },
  { value: "tops", label: "Tops" },
  { value: "knitwear", label: "Knitwear" },
  { value: "shirts", label: "Shirts" },
  { value: "blazers", label: "Blazers" },
  { value: "dresses", label: "Dresses" },
  { value: "skirts", label: "Skirts" },
  { value: "jeans", label: "Jeans" },
  { value: "trousers", label: "Trousers" },
  { value: "shorts", label: "Shorts" },
];

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

  // Filter by subcategory if clothing
  const filteredProducts = isClothing && selectedSubcategory
    ? products?.filter((p) => (p as any).subcategory === selectedSubcategory)
    : products;

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
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={selectedSubcategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => handleSubcategoryChange(null)}
                className="px-5 py-1.5 h-auto text-xs tracking-wide"
              >
                All
              </Button>
              {CLOTHING_SUBCATEGORIES.map((sub) => (
                <Button
                  key={sub.value}
                  variant={selectedSubcategory === sub.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSubcategoryChange(sub.value)}
                  className="px-5 py-1.5 h-auto text-xs tracking-wide"
                >
                  {sub.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
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
                    <p className="text-sm text-muted-foreground leading-relaxed flex items-baseline min-w-0">
                      <span className="truncate">{product.name}</span>
                      {product.size && <span className="text-xs text-muted-foreground/70 shrink-0"> · {product.size}</span>}
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
      </main>

      <Footer />
    </div>
  );
};

export default CategoryPage;
