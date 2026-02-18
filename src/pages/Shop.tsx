import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useProducts, formatPrice } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";

const CLOTHING_SUBCATEGORIES = [
  { value: "outerwear", label: "Outerwear" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "dresses", label: "Dresses" },
];

const Shop = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();

  const selectedCatSlug = categories?.find((c) => c.id === selectedCategory)?.slug;
  const isClothingSelected = selectedCatSlug === "clothing";

  // Filter products by selected category and subcategory
  const filteredProducts = products?.filter((product) => {
    if (selectedCategory && product.category_id !== selectedCategory) return false;
    if (isClothingSelected && selectedSubcategory && (product as any).subcategory !== selectedSubcategory) return false;
    return true;
  });

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
              }}
              className="px-6 py-2 h-auto text-sm tracking-wide"
            >
              All
            </Button>
            {categories?.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedSubcategory(null);
                }}
                className="px-6 py-2 h-auto text-sm tracking-wide"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Subcategory Filters (Clothing only) */}
        {isClothingSelected && (
          <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-10 md:mb-14">
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={selectedSubcategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSubcategory(null)}
                className="px-5 py-1.5 h-auto text-xs tracking-wide"
              >
                All
              </Button>
              {CLOTHING_SUBCATEGORIES.map((sub) => (
                <Button
                  key={sub.value}
                  variant={selectedSubcategory === sub.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSubcategory(sub.value)}
                  className="px-5 py-1.5 h-auto text-xs tracking-wide"
                >
                  {sub.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Spacer when no subcategory row */}
        {!isClothingSelected && <div className="mb-6 md:mb-10" />}

        {/* Products Grid */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
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
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-1">
                      {product.name}
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
                {selectedCategory
                  ? "No products found in this category."
                  : "No products available at the moment."}
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
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
