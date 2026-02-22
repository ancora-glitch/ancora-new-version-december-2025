import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Partners = () => {
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("animate-in");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    sectionsRef.current.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero */}
        <section
          ref={(el) => sectionsRef.current[0] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-16 py-[32px]">

          <div className="max-w-[700px] mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-6">
              Partner with Ancora
            </h1>
          </div>
        </section>

        <section
          ref={(el) => sectionsRef.current[1] = el}
          className="fade-section md:px-12 lg:px-24 md:py-4 px-[60px] py-[8px]">

          <div className="max-w-[700px] mx-auto">
            <p className="article-intro">
              <em>Be part of a new curated destination for modern resale.</em>
            </p>
          </div>
        </section>

        <section
          ref={(el) => sectionsRef.current[2] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-6 py-0">

          <div className="max-w-[700px] mx-auto article-body partners-compact">
            <p>
              We're building a highly curated edit of pre-loved fashion — and
              we're looking for partners who want to grow with us from day one.
            </p>
            <div className="pt-4 pb-1 flex flex-col items-start gap-2">
              <a
                href="mailto:ancoraedit@gmail.com"
                className="inline-block bg-primary text-primary-foreground px-8 py-3 text-xs font-medium uppercase tracking-[0.16em] hover:bg-primary/90 transition-colors duration-200">

                Become a partner
              </a>
              







            </div>
          </div>
        </section>

        {/* What is Ancora? */}
        <section
          ref={(el) => sectionsRef.current[3] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-[16px]">

          <div className="max-w-[700px] mx-auto article-body partners-compact">
            <h2 className="article-subheader">What is Ancora?</h2>
            <p>
              Ancora is a curated edit of second hand fashion from selected
              resale platforms and sellers.
            </p>
            <p>
              We act as a digital storefront — highlighting exceptional pieces
              and directing buyers straight to our partners.
            </p>
            <p className="pt-1">
              We don't compete. We curate. And we drive traffic where it belongs — to you.
            </p>
          </div>
        </section>

        {/* Why partner with Ancora? */}
        <section
          ref={(el) => sectionsRef.current[4] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-8 py-[4px]">

          <div className="max-w-[700px] mx-auto article-body partners-compact">
            <h2 className="article-subheader">Why partner with Ancora?</h2>

            <h3 className="article-subheader !text-lg !mt-4 !mb-1">
            </h3>
            <p>
              Ancora works as a curated storefront. When someone finds a piece
              through us, they complete the purchase with you. We are not a
              marketplace. We are a traffic driver.
            </p>

            <h3 className="article-subheader !text-lg !mt-4 !mb-1">
            </h3>
            <p>Your pieces aren't just listed — they're placed in a styled, curated context. 
Featured in:

            </p>
            <ul className="list-disc pl-6 space-y-0.5 text-muted-foreground">
              <li>Weekly edits</li>
              <li>Seasonal drops</li>
              <li>Style guides</li>
              <li>Themed curation</li>
            </ul>

            <h3 className="article-subheader !text-lg !mt-4 !mb-1">
            </h3>
            <p>
              Selected partners and products are highlighted across:
            </p>
            <ul className="list-disc pl-6 space-y-0.5 text-muted-foreground">
              <li>Instagram</li>
              <li>Substack</li>
            </ul>

            <h3 className="article-subheader !text-lg !mt-4 !mb-1">
            </h3>
            <p>As we grow, we'll share insights on:</p>
            <ul className="list-disc pl-6 space-y-0.5 text-muted-foreground">
              <li>What categories perform best</li>
              <li>Click-through trends</li>
              <li>Audience preferences</li>
            </ul>
          </div>
        </section>

        {/* Why join now? */}
        <section
          ref={(el) => sectionsRef.current[5] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-[16px]">

          <div className="max-w-[700px] mx-auto article-body partners-compact">
            <h2 className="article-subheader">Why join now?</h2>
            <p>
              We're in our early stage — and that's an opportunity.
            </p>
            <p>Founding partners will:</p>
            <ul className="list-disc pl-6 space-y-0.5 text-muted-foreground">
              <li>Help shape the format</li>
              <li>Get priority placement</li>
              <li>Build visibility alongside us</li>
              <li>Grow with the platform from the start</li>
            </ul>
            


          </div>
        </section>

        {/* Who we're looking for */}
        <section
          ref={(el) => sectionsRef.current[6] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-8 py-[4px]">

          <div className="max-w-[700px] mx-auto article-body partners-compact">
            <h2 className="article-subheader">Who we're looking for</h2>
            <p>We partner with:</p>
            <ul className="list-disc pl-6 space-y-0.5 text-muted-foreground">
              <li>Curated resale platforms</li>
              <li>Independent vintage sellers</li>
              <li>High-quality second hand retailers</li>
              <li>Selected premium sellers on marketplaces</li>
            </ul>
            <p className="pt-1">
              If you believe in circular fashion and strong curation — we should
              talk.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section
          ref={(el) => sectionsRef.current[7] = el}
          className="fade-section px-6 md:px-12 lg:px-24 md:py-12 py-[16px]">

          <div className="max-w-[700px] mx-auto article-body partners-compact">
            <h2 className="article-subheader">How it works</h2>
            <ol className="list-decimal pl-6 space-y-1 text-muted-foreground">
              <li>We align on scope and format</li>
              <li>We select and curate pieces</li>
              <li>We link directly to your listing</li>
              <li>You handle the transaction</li>
            </ol>
            <p className="pt-2">
              Simple. Transparent. Win–win.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section
          ref={(el) => sectionsRef.current[8] = el}
          className="fade-section px-6 md:px-12 lg:px-24 py-16 md:py-20">

          <div className="max-w-[700px] mx-auto text-center">
            <h2 className="font-serif text-primary text-2xl md:text-3xl leading-tight mb-6">
              Want to be part of Ancora from the beginning?
            </h2>
            <div className="flex flex-col items-center gap-2">
              <a
                href="mailto:ancoraedit@gmail.com"
                className="inline-block bg-primary text-primary-foreground px-8 py-3 text-xs font-medium uppercase tracking-[0.16em] hover:bg-primary/90 transition-colors duration-200">

                Email us
              </a>
              <a
                href="https://substack.com/@theancoraedit"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-200 underline underline-offset-4">

                Follow our journey on Substack
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>);

};

export default Partners;