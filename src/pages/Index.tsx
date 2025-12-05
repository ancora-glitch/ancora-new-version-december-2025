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
  return <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative w-full h-[85vh] min-h-[500px]">
          <img src={heroImage} alt="Fashion editorial featuring elegant clothing" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="bg-ancora-cream/90 rounded-lg p-8 md:p-12 max-w-xl">
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-ancora-burgundy mb-4 text-secondary">
                Wear it now
              </h1>
              <p className="font-sans text-base md:text-lg mb-8 text-secondary">
                Time to bring out your most dazzling pieces
              </p>
              <Button className="bg-ancora-burgundy hover:bg-ancora-burgundy/90 font-sans font-medium px-8 py-3 h-auto rounded-md bg-secondary-foreground text-secondary">
                Explore styles
              </Button>
            </div>
          </div>
        </section>

        {/* New Arrivals Section */}
        

        {/* Seasonal Essentials Section */}
        <section className="px-4 md:px-8 py-20 md:py-28 bg-ancora-cream/30">
          <h2 className="font-sans text-2xl md:text-3xl text-ancora-burgundy mb-12 text-center font-medium text-primary">
            Seasonal Essentials
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl mx-auto">
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
        <section className="px-4 md:px-8 py-16 md:py-24 bg-ancora-burgundy">
          <h2 className="text-2xl mb-10 text-center text-primary font-sans md:text-2xl">
            Fall/Winter Style Guides
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-7xl mx-auto">
            <GuideCard image={guideLayering} title="The Art of Layering" />
            <GuideCard image={guideParty} title="Holiday Party Looks" />
            <GuideCard image={guideKnitwear} title="Cozy Knitwear Edit" />
            <GuideCard image={guideCapsule} title="Winter Capsule Wardrobe" />
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default Index;