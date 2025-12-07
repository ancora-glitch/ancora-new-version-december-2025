import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { GuideCard } from "@/components/GuideCard";
import { useProducts, formatPrice } from "@/hooks/useProducts";
import heroImage from "@/assets/hero-fashion.jpg";
import guideLayering from "@/assets/guide-office-party.jpg";
import guideParty from "@/assets/guide-party.jpg";
import guideKnitwear from "@/assets/guide-knitwear-new.jpg";
import guideCapsule from "@/assets/guide-capsule.jpg";
const Index = () => {
  const {
    data: products,
    isLoading
  } = useProducts();
  return <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative w-full h-[80vh] min-h-[600px]">
          <img src={heroImage} alt="Fashion editorial featuring elegant clothing" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-8 left-4 right-4 md:bottom-12 md:left-8 md:right-8">
            <div className="bg-[#F8F4EF]/85 backdrop-blur-sm p-8 md:p-12 lg:p-14 max-w-lg shadow-lg">
              <h1 className="text-4xl md:text-5xl lg:text-6xl mb-5 leading-tight text-primary">
                Wear it now
              </h1>
              <p className="text-base md:text-lg mb-10 leading-relaxed text-primary">
                Time to bring out your most dazzling pieces
              </p>
              <Button className="w-full md:w-auto font-medium text-sm tracking-wide px-10 py-4 h-auto uppercase">
                Explore styles
              </Button>
            </div>
          </div>
        </section>

        {/* Seasonal Essentials Section */}
        <section className="px-4 md:px-8 lg:px-12 py-20 md:py-28 lg:py-32 bg-secondary/40">
          <h2 className="text-2xl md:text-3xl lg:text-4xl mb-14 md:mb-16 text-center font-normal">
            Seasonal Essentials
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7 lg:gap-8 max-w-7xl mx-auto">
            {isLoading ? <p className="col-span-full text-center text-muted-foreground">Loading products...</p> : products && products.length > 0 ? products.map(product => <ProductCard key={product.id} image={product.image} brand={product.brand} name={product.name} price={formatPrice(product.price)} additionalImages={product.additional_images || []} affiliateUrl={product.affiliate_url || undefined} marketplace={product.marketplace || undefined} />) : <p className="col-span-full text-center text-muted-foreground">No products available</p>}
          </div>
        </section>

        {/* Winter Style Guides Section */}
        <section className="px-4 md:px-8 lg:px-12 py-20 md:py-28 lg:py-32 bg-primary">
          <h2 className="text-2xl md:text-3xl lg:text-4xl mb-14 md:mb-16 text-center text-primary-foreground font-normal">
            Winter Style Guides
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7 lg:gap-8 max-w-7xl mx-auto">
            <GuideCard image={guideLayering} title="Tis the season for office parties – curated edit of our favorite looks" />
            <GuideCard image={guideParty} title="Stay warm and chic with these tried and tested winter-approved styling tricks." />
            <GuideCard image={guideKnitwear} title="Care Guide: Show your loafers some love" />
            <GuideCard image={guideCapsule} title="Winter Capsule Wardrobe" />
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default Index;