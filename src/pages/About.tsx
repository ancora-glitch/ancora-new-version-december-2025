import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PullQuote } from "@/components/PullQuote";
import teamAncoraImage from "@/assets/team-ancora.jpg";

const SubstackIcon = ({ className, strokeWidth = 1.5 }: {className?: string;strokeWidth?: number;}) =>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 4h16" />
    <path d="M4 8h16" />
    <path d="M4 12l8 6 8-6" />
  </svg>;

const About = () => {
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-in");
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    });
    sectionsRef.current.forEach((section) => {
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero Section */}
        <section ref={(el) => sectionsRef.current[0] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-16 py-[32px]">
          <div className="max-w-[700px] mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-8">
              About Ancora
            </h1>
          </div>
        </section>

        {/* Intro/Ingress Section */}
        <section ref={(el) => sectionsRef.current[1] = el} className="fade-section md:px-12 lg:px-24 md:py-4 px-[60px] py-[8px]">
          <div className="max-w-[700px] mx-auto">
            <p className="article-intro">Ancora exists for the everyday style seekers and the hardcore fashion hunters – for anyone who wants to create a stunning circular wardrobe.</p>
          </div>
        </section>

        {/* Our Story Section */}
        <section ref={(el) => sectionsRef.current[2] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-6 py-0">
          <div className="max-w-[700px] mx-auto article-body">
            <h2 className="article-subheader">Our Story</h2>
            <p className="drop-cap">
              We created the shopping experience we always longed for: a modern, intuitive way to discover pre-loved fashion. Explore curated edits, get guided recommendations, or dive straight into the hunt for those pieces you can't stop thinking about.
            </p>
          </div>
        </section>

        {/* Pull Quote */}
        





      

        {/* Philosophy Section */}
        <section ref={(el) => sectionsRef.current[4] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-8 py-[4px]">
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
        <section ref={(el) => sectionsRef.current[5] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-[16px]">
          <div className="max-w-[700px] mx-auto article-body">
            <h2 className="article-subheader">Where We Started</h2>
            <p>
              Ancora started in 2025 in Stockholm, founded by three friends with a shared love for fashion, culture, technology, and circularity. We're here to reshape how we shop, wear, and value fashion — one discovered piece at a time.
            </p>
          </div>
        </section>

        {/* Team Image */}
        <section ref={(el) => sectionsRef.current[6] = el} className="fade-section px-6 md:px-12 lg:px-24 py-12">
          <div className="max-w-[700px] mx-auto">
            <img src={teamAncoraImage} alt="Team Ancora" className="w-full h-auto" loading="lazy" />
          </div>
        </section>

        {/* Follow Ancora */}
        <section ref={(el) => sectionsRef.current[7] = el} className="fade-section px-6 md:px-12 lg:px-24 md:py-8 py-[4px]">
          <div className="max-w-[700px] mx-auto article-body">
            <h2 className="article-subheader">Follow Ancora</h2>
            <div className="flex flex-col gap-4 pt-2">
              <a
              href="https://www.instagram.com/ancora_edit/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-foreground hover:text-primary transition-colors duration-200 group">
              
                <span className="p-2.5 rounded-full border border-border group-hover:border-primary transition-colors duration-200">
                  <Instagram className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <span className="text-base underline underline-offset-4 decoration-border group-hover:decoration-primary transition-colors duration-200">
                  Instagram
                </span>
              </a>
              <a
              href="https://substack.com/@theancoraedit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-foreground hover:text-primary transition-colors duration-200 group">
              
                <span className="p-2.5 rounded-full border border-border group-hover:border-primary transition-colors duration-200">
                  <SubstackIcon className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <span className="text-base underline underline-offset-4 decoration-border group-hover:decoration-primary transition-colors duration-200">
                  Substack
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* Partner link */}
        <section ref={(el) => sectionsRef.current[8] = el} className="fade-section px-6 md:px-12 lg:px-24 pb-24 pt-0">
          <div className="max-w-[700px] mx-auto">
            <p className="text-sm text-muted-foreground">
              Interested in partnering with us?{" "}
              <Link to="/partners" className="text-primary hover:opacity-70 transition-opacity duration-200 underline underline-offset-4">
                Partners
              </Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default About;