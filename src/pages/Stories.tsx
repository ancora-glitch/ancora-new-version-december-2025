import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStyleGuides } from "@/hooks/useStyleGuides";

const Stories = () => {
  const { data: styleGuides, isLoading } = useStyleGuides();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="bg-primary py-20 md:py-28">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-primary-foreground">
              Stories
            </h1>
          </div>
        </section>

        {/* Articles Grid */}
        <section className="px-4 md:px-8 lg:px-12 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 max-w-5xl mx-auto">
            {isLoading ? (
              <p className="col-span-full text-center text-muted-foreground">Loading stories...</p>
            ) : styleGuides && styleGuides.length > 0 ? (
              styleGuides.map((guide) => (
                <article key={guide.id} className="group">
                  <Link to={`/style-guides/${guide.slug}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden mb-5">
                      <img 
                        src={guide.image} 
                        alt={guide.title} 
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/15 transition-colors duration-300" />
                    </div>
                  </Link>
                  <h2 className="font-serif text-xl md:text-2xl text-foreground mb-3 leading-snug">
                    <Link to={`/style-guides/${guide.slug}`} className="hover:text-primary transition-colors">
                      {guide.title}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base mb-5 line-clamp-2">
                    {guide.intro_text}
                  </p>
                  <Link 
                    to={`/style-guides/${guide.slug}`}
                    className="inline-block py-3 px-6 bg-primary text-primary-foreground text-xs tracking-widest uppercase hover:bg-primary/90 transition-colors duration-200"
                  >
                    Read story
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
