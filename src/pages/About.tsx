import { useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PullQuote } from "@/components/PullQuote";
import teamAncoraImage from "@/assets/team-ancora.png";
const About = () => {
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-in");
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    });
    sectionsRef.current.forEach(section => {
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero Section */}
        <section ref={el => sectionsRef.current[0] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-24 py-[43px]">
          <div className="max-w-[700px] mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-8">
              About Ancora
            </h1>
          </div>
        </section>

        {/* Intro/Ingress Section */}
        <section ref={el => sectionsRef.current[1] = el} className="fade-section md:px-12 lg:px-24 md:py-12 px-[60px] py-[19px]">
          <div className="max-w-[700px] mx-auto">
            <p className="article-intro">
              <em>Ancora exists for the everyday style seekers and the hardcore fashion hunters</em> — for anyone who believes that great style isn't bought, it's found.
            </p>
          </div>
        </section>

        {/* Our Story Section */}
        <section ref={el => sectionsRef.current[2] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-0">
          <div className="max-w-[700px] mx-auto article-body">
            <h2 className="article-subheader">Our Story</h2>
            <p className="drop-cap">
              We created the shopping experience we always longed for: a modern, intuitive way to discover pre-loved fashion. Explore curated edits, get guided recommendations, or dive straight into the hunt for those pieces you can't stop thinking about.
            </p>
          </div>
        </section>

        {/* Pull Quote */}
        <section ref={el => sectionsRef.current[3] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-0">
          <div className="max-w-[700px] mx-auto">
            <PullQuote>
              Style isn't something you manufacture. And good style has nothing to do with producing more.
            </PullQuote>
          </div>
        </section>

        {/* Philosophy Section */}
        <section ref={el => sectionsRef.current[4] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-[5px]">
          <div className="max-w-[700px] mx-auto article-body">
            <h2 className="article-subheader">Our Philosophy</h2>
            <p>
              Everything you could ever want already exists — humanity has made more clothes than we could wear in generations. The future of fashion is about uncovering what's already here.
            </p>
            <p>
              We believe in the thrill of discovery, the joy of finding that perfect piece that feels like it was made for you. Every item has a story, and we're here to help you write the next chapter.
            </p>
          </div>
        </section>

        {/* Origin Section */}
        <section ref={el => sectionsRef.current[5] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-24 py-[22px]">
          <div className="max-w-[700px] mx-auto article-body">
            <h2 className="article-subheader">Where We Started</h2>
            <p>
              Ancora started in 2025 in Stockholm, founded by three friends with a shared love for fashion, culture, technology, and circularity. We're here to reshape how we shop, wear, and value fashion — one discovered piece at a time.
            </p>
          </div>
        </section>

        {/* Team Image */}
        <section ref={el => sectionsRef.current[6] = el} className="fade-section px-6 md:px-12 lg:px-24 py-12">
          <div className="max-w-[700px] mx-auto">
            <img src={teamAncoraImage} alt="Team Ancora" className="w-full h-auto" loading="lazy" />
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default About;