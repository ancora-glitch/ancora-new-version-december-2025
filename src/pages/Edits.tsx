import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useActiveWeeklyEdit } from "@/hooks/useWeeklyEdits";
import { formatPrice } from "@/hooks/useProducts";
import type { ThreeWayToWear } from "@/hooks/useWeeklyEdits";

const Edits = () => {
  const { data: activeEdit, isLoading } = useActiveWeeklyEdit();

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

        {isLoading ? (
          <p className="text-center text-muted-foreground py-20">Loading...</p>
        ) : activeEdit ? (
          <>
            {/* Page Header */}
            <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-12 md:mb-16">
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-sans mb-3 text-center">
                This Week's Edit
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-4">
                {activeEdit.title}
              </h1>
              {activeEdit.week_label && (
                <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-3">
                  {activeEdit.week_label}
                </p>
              )}
              {activeEdit.short_intro && (
                <p className="text-center text-muted-foreground max-w-2xl mx-auto">
                  {activeEdit.short_intro}
                </p>
              )}
            </div>

            {/* Long Intro */}
            {activeEdit.long_intro && (
              <div className="px-4 md:px-8 lg:px-12 max-w-3xl mx-auto mb-14 md:mb-20">
                <div className="article-intro text-center">
                  {activeEdit.long_intro}
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
              {activeEdit.products && activeEdit.products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
                  {activeEdit.products.map((product: any) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.slug || product.id}`}
                      state={{ from: "/this-weeks-edit" }}
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
                    No products in this edit yet.
                  </p>
                </div>
              )}
            </div>

            {/* Three Ways to Wear */}
            {Array.isArray(activeEdit.three_ways_to_wear) &&
              (activeEdit.three_ways_to_wear as unknown as ThreeWayToWear[])
                .length > 0 && (
                <section className="px-4 md:px-8 lg:px-12 max-w-3xl mx-auto mt-20 md:mt-28">
                  <h2 className="text-2xl md:text-3xl font-serif text-primary text-center mb-10">
                    Three ways to wear it
                  </h2>
                  <div className="space-y-8">
                    {(
                      activeEdit.three_ways_to_wear as unknown as ThreeWayToWear[]
                    ).map((way, i) => (
                      <div key={i} className="text-center">
                        <h3 className="text-lg font-serif text-primary mb-2">
                          {way.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {way.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
          </>
        ) : (
          <div className="text-center py-20">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-4">
              This week's edit
            </h1>
            <p className="text-muted-foreground mb-4">
              No active edit at the moment.
            </p>
            <p className="text-sm text-muted-foreground">
              Check back soon for our next edit.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Edits;
