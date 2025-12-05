import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-fashion.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Main content with padding for fixed header */}
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative w-full h-[85vh] min-h-[500px]">
          {/* Background Image */}
          <img
            src={heroImage}
            alt="Fashion editorial featuring elegant clothing"
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* Overlay Box */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="bg-ancora-cream/90 rounded-lg p-8 md:p-12 max-w-xl">
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-ancora-burgundy mb-4">
                Wear it now
              </h1>
              <p className="font-sans text-muted-foreground text-base md:text-lg mb-8">
                Time to bring out your most dazzling pieces
              </p>
              <Button className="bg-ancora-burgundy hover:bg-ancora-burgundy/90 text-white font-sans font-medium px-8 py-3 h-auto rounded-md">
                Explore styles
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
