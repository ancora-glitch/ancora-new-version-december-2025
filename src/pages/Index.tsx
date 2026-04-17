import { useNavigate, Link, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { GuideCard } from "@/components/GuideCard";
import { useActiveWeeklyEdit } from "@/hooks/useWeeklyEdits";
import { formatPrice } from "@/hooks/useProducts";
import { useStyleGuides } from "@/hooks/useStyleGuides";
import heroImage from "@/assets/hero-fashion-new.jpg";

const Index = () => {
  const navigate = useNavigate();
  const {
    data: activeEdit,
    isLoading
  } = useActiveWeeklyEdit();
  const {
    data: styleGuides,
    isLoading: guidesLoading
  } = useStyleGuides();
  return <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative w-full h-[40vh] min-h-[300px]">
          <img alt="Woman in vintage blazer and jeans on sunlit street" fetchPriority="high" width={1920} height={1080} className="absolute inset-0 w-full h-full object-cover [object-position:center_35%]" src={heroImage} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent" />
          <div className="absolute inset-0 flex items-end md:items-center justify-center px-4 md:px-8 pb-2 md:pb-0">
            <div className="bg-[hsl(35_30%_35%)]/15 md:bg-[hsl(35_30%_30%)]/25 backdrop-blur-sm rounded-lg px-3 md:px-4 max-w-md text-center py-[14px] mx-auto pb-[10px] pt-[5px]">
              <h1 className="text-3xl md:text-4xl lg:text-5xl mb-2 md:mb-3 leading-tight text-white font-serif text-center whitespace-nowrap">
                Collected & Curated
              </h1>
              <p className="text-sm md:text-lg lg:text-xl mb-3 md:mb-5 leading-relaxed text-white/90 text-center">A new way to shop second hand.</p>
              <div className="flex flex-row gap-2 sm:gap-4 justify-center">
                <Button className="font-medium text-xs md:text-sm tracking-wide px-4 md:px-8 py-2 md:py-4 h-auto" onClick={() => navigate('/shop')}>
                  New Arrivals
                </Button>
                <Button className="font-medium text-xs md:text-sm tracking-wide px-4 md:px-8 py-2 md:py-4 h-auto" onClick={() => navigate('/stories')}>
                  Guides & Stories
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* This Week's Edit Section */}
        <section className="px-4 md:px-8 lg:px-12 md:py-28 bg-secondary/40 py-[60px] lg:py-[6px] pt-[80px]">
          <Link to="/this-weeks-edit" className="block text-center mb-4 hover:opacity-80 transition-opacity">
            <span className="block text-sm md:text-base font-serif text-primary/70 mb-2">This Week's Edit</span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-normal">
              {activeEdit?.title || "This week's edit"}
            </h2>
          </Link>
          <p className="text-center text-muted-foreground mb-14 md:mb-16 text-base md:text-lg">
            {activeEdit?.short_intro || "Curated second hand pieces, selected exclusively."}
          </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 lg:gap-8 max-w-7xl mx-auto">
            {isLoading ? <p className="col-span-full text-center text-muted-foreground">Loading products...</p> : activeEdit?.products && activeEdit.products.length > 0 ? activeEdit.products.slice(0, 4).map((product: any) => <Link key={product.id} to={`/product/${product.slug || product.id}`} state={{ from: "/" }} className="group block bg-card overflow-hidden border border-border/20 hover:border-border/40 hover:bg-secondary/10 transition-all duration-300 min-h-[44px]" aria-label={`View ${product.brand} ${product.name}`}>
                  <div className="relative aspect-[4/5] overflow-hidden bg-secondary/30">
                    <img src={product.image} alt={product.name} loading="lazy" width={400} height={500} className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
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
                </Link>) : <p className="col-span-full text-center text-muted-foreground">No products available</p>}
          </div>
          <div className="text-center mt-12">
            <Button variant="outline" className="px-10 py-4 h-auto uppercase tracking-wide" onClick={() => navigate('/this-weeks-edit')}>
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
            {guidesLoading ? <p className="col-span-full text-center text-primary-foreground/70">Loading guides...</p> : styleGuides && styleGuides.length > 0 ? styleGuides.slice(0, 6).map(guide => <GuideCard key={guide.id} image={guide.image} title={guide.title} href={`/style-guides/${guide.slug}`} focalPoint={guide.focal_point} />) : <p className="col-span-full text-center text-primary-foreground/70">No style guides available</p>}
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default Index;