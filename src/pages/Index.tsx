import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { GuideCard } from "@/components/GuideCard";
import heroImage from "@/assets/hero-fashion.jpg";
import productBlazer from "@/assets/product-blazer.jpg";
import productBag from "@/assets/product-bag.jpg";
import productBlouse from "@/assets/product-blouse.jpg";
import productHeels from "@/assets/product-heels.jpg";
import guideLayering from "@/assets/guide-layering.jpg";
import guideParty from "@/assets/guide-party.jpg";
import guideKnitwear from "@/assets/guide-knitwear.jpg";
import guideCapsule from "@/assets/guide-capsule.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative w-full h-[80vh] min-h-[600px]">
          <img 
            src={heroImage} 
            alt="Fashion editorial featuring elegant clothing" 
            className="absolute inset-0 w-full h-full object-cover" 
          />
          <div className="absolute bottom-8 left-4 right-4 md:bottom-12 md:left-8 md:right-8">
            <div className="bg-[#F8F4EF]/85 backdrop-blur-sm p-8 md:p-12 lg:p-14 max-w-lg shadow-lg">
              <h1 className="text-4xl md:text-5xl lg:text-6xl mb-5 leading-tight text-primary">
                Wear it now
              </h1>
              <p className="text-base md:text-lg mb-10 text-foreground/70 leading-relaxed">
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
          <h2 className="text-2xl md:text-3xl lg:text-4xl mb-14 md:mb-16 text-center italic font-normal">
            Seasonal Essentials
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7 lg:gap-8 max-w-7xl mx-auto">
            <ProductCard image={productBlouse} brand="ANCORA" name="Relaxed Silk Shirt" price="$195" />
            <ProductCard image={productHeels} brand="LENA ROSE" name="Minimalist Heel Sandal" price="$285" />
            <ProductCard image={productBag} brand="MAISON CLAIRE" name="Structured Mini Bag" price="$345" />
            <ProductCard image={productBlazer} brand="VERA STUDIO" name="Oversized Wool Blazer" price="$420" />
            <ProductCard image={productHeels} brand="ANCORA" name="Classic Block Heel" price="$265" />
            <ProductCard image={productBlouse} brand="LENA ROSE" name="Draped Satin Top" price="$175" />
            <ProductCard image={productBlazer} brand="ANCORA" name="Tailored Cotton Jacket" price="$310" />
            <ProductCard image={productBag} brand="VERA STUDIO" name="Soft Leather Clutch" price="$225" />
          </div>
        </section>

        {/* Winter Style Guides Section */}
        <section className="px-4 md:px-8 lg:px-12 py-20 md:py-28 lg:py-32 bg-primary">
          <h2 className="text-2xl md:text-3xl lg:text-4xl mb-14 md:mb-16 text-center text-primary-foreground font-normal italic">
            Winter Style Guides
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7 lg:gap-8 max-w-7xl mx-auto">
            <GuideCard image={guideLayering} title="The Art of Layering" />
            <GuideCard image={guideParty} title="Holiday Party Looks" />
            <GuideCard image={guideKnitwear} title="Cozy Knitwear Edit" />
            <GuideCard image={guideCapsule} title="Winter Capsule Wardrobe" />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;