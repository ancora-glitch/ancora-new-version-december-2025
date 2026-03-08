import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStyleGuides } from "@/hooks/useStyleGuides";


const Stories = () => {
  const { data: styleGuides, isLoading } = useStyleGuides();

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
            Stories
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            Considered stories on style, sustainability, and the art of dressing well.
          </p>
        </div>

        {/* Articles Grid */}
        <section className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto">
            {isLoading ? (
              <p className="col-span-full text-center text-muted-foreground">Loading stories...</p>
            ) : styleGuides && styleGuides.length > 0 ? (
              styleGuides.map((guide) => (
                <article key={guide.id} className="group">
                  <Link 
                    to={`/style-guides/${guide.slug}`} 
                    className="block"
                    aria-label={`Read: ${guide.title}`}
                  >
                    <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden mb-5">
                      <img
                        src={guide.image}
                        alt={guide.title}
                        loading="lazy"
                        width={600}
                        height={800}
                        style={{ objectPosition: guide.focal_point || '50% 25%' }}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/15 transition-colors duration-300 pointer-events-none" />
                    </div>
                    <h2 className="font-serif text-base md:text-xl text-foreground mb-2 leading-snug group-hover:text-primary transition-colors">
                      {guide.title}
                    </h2>
                    {guide.author && (
                      <p className="text-[10px] md:text-xs tracking-[0.1em] uppercase text-muted-foreground/80">
                        By {guide.author}
                        {guide.published_at && (
                          <> · {new Date(guide.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>
                        )}
                      </p>
                    )}
                    <span 
                      className="inline-block mt-3 py-2 px-4 md:py-3 md:px-6 bg-primary text-primary-foreground text-[10px] md:text-xs tracking-widest uppercase group-hover:bg-primary/90 transition-colors duration-200"
                    >
                      Read story
                    </span>
                  </Link>
                </article>
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground">No stories available yet</p>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Stories;
