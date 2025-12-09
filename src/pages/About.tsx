import { useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const About = () => {
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    sectionsRef.current.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero Section */}
        <section 
          ref={(el) => (sectionsRef.current[0] = el)}
          className="fade-section px-6 md:px-12 lg:px-24 py-16 md:py-24"
        >
          <div className="max-w-3xl mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-8">
              About Ancora
            </h1>
          </div>
        </section>

        {/* First Body Section */}
        <section 
          ref={(el) => (sectionsRef.current[1] = el)}
          className="fade-section px-6 md:px-12 lg:px-24 py-12 md:py-16"
        >
          <div className="max-w-3xl mx-auto">
            <p className="text-foreground/90 text-lg md:text-xl leading-relaxed">
              Ancora exists for the everyday style seekers and the hardcore fashion hunters — for anyone who believes that great style isn't bought, it's found.
            </p>
          </div>
        </section>

        {/* Second Body Section */}
        <section 
          ref={(el) => (sectionsRef.current[2] = el)}
          className="fade-section px-6 md:px-12 lg:px-24 py-12 md:py-16"
        >
          <div className="max-w-3xl mx-auto">
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed">
              We created the shopping experience we always longed for: a modern, intuitive way to discover pre-loved fashion. Explore curated edits, get guided recommendations, or dive straight into the hunt for those pieces you can't stop thinking about.
            </p>
          </div>
        </section>

        {/* Philosophy Section */}
        <section 
          ref={(el) => (sectionsRef.current[3] = el)}
          className="fade-section px-6 md:px-12 lg:px-24 py-16 md:py-24 bg-primary/[0.03]"
        >
          <div className="max-w-3xl mx-auto">
            <p className="text-foreground/90 text-lg md:text-xl leading-relaxed italic">
              Because style isn't something you manufacture. And good style has nothing to do with producing more.
            </p>
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed mt-8">
              Everything you could ever want already exists — humanity has made more clothes than we could wear in generations. The future of fashion is about uncovering what's already here.
            </p>
          </div>
        </section>

        {/* Origin Section */}
        <section 
          ref={(el) => (sectionsRef.current[4] = el)}
          className="fade-section px-6 md:px-12 lg:px-24 py-16 md:py-24"
        >
          <div className="max-w-3xl mx-auto">
            <div className="h-px w-16 bg-primary/30 mb-12" />
            <p className="text-foreground/80 text-base md:text-lg leading-relaxed">
              Ancora started in 2025 in Stockholm, founded by three friends with a shared love for fashion, culture, technology, and circularity. We're here to reshape how we shop, wear, and value fashion — one discovered piece at a time.
            </p>
          </div>
        </section>

        {/* Spacer */}
        <div className="h-16 md:h-24" />
      </main>

      <Footer />
    </div>
  );
};

export default About;
