import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { GuideCard } from "@/components/GuideCard";
import { useProducts, formatPrice } from "@/hooks/useProducts";
import { useStyleGuides } from "@/hooks/useStyleGuides";
import heroImage from "@/assets/hero-fashion.jpg";
const Index = () => {
  const navigate = useNavigate();
  const {
    data: products,
    isLoading
  } = useProducts();
  const {
    data: styleGuides,
    isLoading: guidesLoading
  } = useStyleGuides();
  return <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative w-full h-[80vh] min-h-[600px]">
          <img alt="Fashion editorial featuring elegant clothing" fetchPriority="high" width={1920} height={1080} className="absolute inset-0 w-full h-full object-cover object-[center_top] md:object-[50%_25%]" src="/lovable-uploads/f5d5719e-ed29-45f3-b4c6-f3849a6e259f.jpg" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent" />
          <div className="absolute inset-0 flex items-end md:items-center justify-center px-4 md:px-8 pb-12 md:pb-0">
            <div className="bg-black/15 md:bg-black/25 backdrop-blur-sm rounded-lg p-6 md:p-10 lg:p-12 max-w-2xl text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl mb-4 md:mb-6 leading-tight text-white font-serif">
                Collected & Curated  
              </h1>
              <p className="text-base md:text-lg lg:text-xl mb-8 md:mb-10 leading-relaxed text-white/90">A new way to shop second hand.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="font-medium text-sm tracking-wide px-8 py-4 h-auto" onClick={() => navigate('/edits')}>
                  Explore the edit
                </Button>
                <Button className="font-medium text-sm tracking-wide px-8 py-4 h-auto" onClick={() => navigate('/stories')}>
                  Read the stories
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* This Week's Edit Section */}
        <section className="px-4 md:px-8 lg:px-12 py-20 md:py-28 lg:py-32 bg-secondary/40">
          <Link to="/edits" className="block text-center mb-4 hover:opacity-80 transition-opacity">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-normal">
              Latest edit
            </h2>
          </Link>
          <p className="text-center text-muted-foreground mb-14 md:mb-16 text-base md:text-lg">Curated second hand pieces, selected exclusively.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8 max-w-7xl mx-auto">
            {isLoading ? <p className="col-span-full text-center text-muted-foreground">Loading products...</p> : products && products.length > 0 ? products.slice(0, 8).map(product => <Link key={product.id} to={`/product/${product.slug || product.id}`} className="group block bg-card overflow-hidden border border-border/20 hover:border-border/40 hover:bg-secondary/10 transition-all duration-300 min-h-[44px]" aria-label={`View ${product.brand} ${product.name}`}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
                    <img src={product.image} alt={product.name} loading="lazy" width={400} height={500} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
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
                </Link>) : <p className="col-span-full text-center text-muted-foreground">No products available</p>}
          </div>
          <div className="text-center mt-12">
            <Button variant="outline" className="px-10 py-4 h-auto uppercase tracking-wide" onClick={() => navigate('/edits')}>
              View all
            </Button>
          </div>
        </section>

        {/* Stories Section */}
        <section className="px-4 md:px-8 lg:px-12 py-20 md:py-28 lg:py-32 bg-primary">
          <Link to="/stories" className="block text-center mb-14 md:mb-16 hover:opacity-80 transition-opacity">
            <h2 className="text-2xl md:text-3xl lg:text-4xl text-primary-foreground font-normal">Stories</h2>
          </Link>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7 lg:gap-8 max-w-7xl mx-auto">
            {guidesLoading ? (
              <p className="col-span-full text-center text-primary-foreground/70">Loading guides...</p>
            ) : styleGuides && styleGuides.length > 0 ? (
              styleGuides.slice(0, 6).map(guide => (
                <GuideCard 
                  key={guide.id} 
                  image={guide.image} 
                  title={guide.title} 
                  href={`/style-guides/${guide.slug}`} 
                />
              ))
            ) : (
              <p className="col-span-full text-center text-primary-foreground/70">No style guides available</p>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default Index;