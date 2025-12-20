import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useProducts, formatPrice } from "@/hooks/useProducts";

const Edits = () => {
  const { data: products, isLoading } = useProducts();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        {/* Page Header */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-4">
            The Edit
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            A carefully curated selection of pre-loved pieces, chosen for their quality, timelessness, and story.
          </p>
        </div>

        {/* Products Grid */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-20">Loading products...</p>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
              {products.map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.slug || product.id}`}
                  className="group block bg-card overflow-hidden border border-border/20 hover:border-border/40 transition-colors"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
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
