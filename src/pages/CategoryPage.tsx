import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import { PUBLIC_VISIBLE_PRODUCT_STATUSES } from "@/hooks/useProducts";
import { useEffect } from "react";

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
        .single();

      if (error) throw error;
      return data as Category;
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
  const { data: category, isLoading: categoryLoading, error: categoryError } = useCategoryBySlug(slug);
  const { data: products, isLoading: productsLoading } = useCategoryProducts(category?.id);

  // Update document metadata when category data is available
  useEffect(() => {
    if (category) {
      document.title = category.seo_title || `${category.name} | ANCORA`;
      
      // Update meta description
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
      // Reset title on unmount
      document.title = "ANCORA";
    };
  }, [category]);

  // Show loading state
  if (categoryLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-16">
          <div className="container mx-auto px-5 md:px-8">
            <Skeleton className="h-10 w-64 mb-4" />
            <Skeleton className="h-6 w-full max-w-2xl mb-12" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
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
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-5 md:px-8">
          {/* Category Header */}
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-serif font-medium text-foreground mb-4">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-muted-foreground max-w-2xl text-base md:text-lg leading-relaxed">
                {category.description}
              </p>
            )}
          </div>

          {/* Products Grid */}
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  brand={product.brand}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  slug={product.slug || product.id}
                  additionalImages={(product.additional_images as string[]) || []}
                  affiliateUrl={product.affiliate_url || undefined}
                  marketplace={product.marketplace || undefined}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">
                No products at the moment
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryPage;
