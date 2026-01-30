import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useProducts, formatPrice } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

const Edits = () => {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = selectedCategory
    ? products?.filter((p) => p.category_id === selectedCategory)
    : products;

  const isLoading = productsLoading || categoriesLoading;

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
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-4">
            The edit
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            A carefully curated selection of pre-loved pieces, chosen for their quality, timelessness, and story.
          </p>
        </div>

        {/* Category Filter Chips */}
        {categories && categories.length > 0 && (
          <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-8 md:mb-12">
            <div className="flex flex-wrap justify-center gap-2 md:gap-3">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-4 py-2 text-xs md:text-sm font-medium uppercase tracking-wider border transition-colors duration-200 min-h-[44px]",
                  selectedCategory === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                )}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "px-4 py-2 text-xs md:text-sm font-medium uppercase tracking-wider border transition-colors duration-200 min-h-[44px]",
                    selectedCategory === category.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-20">Loading products...</p>
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
              <p className="text-muted-foreground mb-4">No products available at the moment.</p>
              <p className="text-sm text-muted-foreground">Check back soon for our next edit.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Edits;
