import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const StyleGuarantee = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero Section */}
        <section className="px-6 md:px-12 lg:px-24 md:py-24 py-[43px]">
          <div className="max-w-[700px] mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-8">
              Timeless or Trending — always intentional.
            </h1>
            <p className="text-base md:text-lg leading-relaxed text-foreground/80 max-w-[600px]">
              Everything on Ancora is handpicked by us, using the same editorial eye for quality, cut, and longevity.
            </p>
          </div>
        </section>

        {/* Two-Column Split Section */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto">
            <div className="flex flex-col md:flex-row gap-12 md:gap-16">
              {/* Left Column — Timeless */}
              <div className="flex-1">
                <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
                  Timeless
                </span>
                <div className="h-px w-8 bg-border mt-3 mb-6" />
                <p className="text-base leading-relaxed text-foreground/80">
                  Classic silhouettes, exceptional craft, built to last decades.
                </p>
              </div>

              {/* Right Column — Trending */}
              <div className="flex-1">
                <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
                  Trending
                </span>
                <div className="h-px w-8 bg-border mt-3 mb-6" />
                <p className="text-base leading-relaxed text-foreground/80">
                  Trend-right pieces chosen with care. Nothing throwaway, still relevant next season.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Closing Statement */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto text-center">
            <div className="h-px w-full bg-border mb-12" />
            <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
              Our promise
            </span>
            <p className="text-base leading-relaxed text-foreground/80 mt-6 max-w-[540px] mx-auto">
              Whether you&apos;re building a wardrobe to last or chasing something for right now — everything on Ancora is worth finding.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default StyleGuarantee;
