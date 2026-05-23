import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";

const useCases = [
  {
    label: "New wardrobe",
    title: "A completely new circular wardrobe",
    description:
      "Built from scratch, edited to your taste and lifestyle.",
  },
  {
    label: "Special occasion",
    title: "The right piece for a wedding, a dinner, a moment that matters",
    description: "Found, not settled for.",
  },
  {
    label: "The one that got away",
    title: "That piece from that collection, that season, that show",
    description: "We know where to look.",
  },
];

const steps = [
  "Tell us what you're looking for",
  "We search — private sellers, archives, auctions, international platforms",
  "We come back with options",
];

const Sourcing = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(35_20%_92%)]">
      <Header />

      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero */}
        <section className="px-6 md:px-12 lg:px-24 md:py-24 py-[43px]">
          <div className="max-w-[700px] mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-8">
              We'll find it for you.
            </h1>
            <p className="text-base md:text-lg leading-relaxed text-foreground/80 max-w-[600px]">
              For people who don't want to compromise. Tell us what you're looking for, and we'll do the hunting.
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto">
            <div className="flex flex-col md:flex-row gap-12 md:gap-10">
              {useCases.map((useCase) => (
                <div key={useCase.label} className="flex-1">
                  <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
                    {useCase.label}
                  </span>
                  <div className="h-px w-8 bg-border mt-3 mb-6" />
                  <h3 className="text-lg font-sans font-medium text-foreground leading-snug mb-3">
                    {useCase.title}
                  </h3>
                  <p className="text-base leading-relaxed text-foreground/70">
                    {useCase.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto">
            <div className="h-px w-full bg-border mb-12" />
            <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
              How it works
            </span>
            <ol className="mt-8 space-y-6">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="text-sm font-medium text-muted-foreground font-sans tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-base leading-relaxed text-foreground/80">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto text-center">
            <div className="h-px w-full bg-border mb-12" />
            <p className="text-xl md:text-2xl font-serif text-primary leading-snug mb-8 max-w-[520px] mx-auto">
              Tell us what you're dreaming of. We'll take it from there.
            </p>
            <a
              href="mailto:hello@ancoraedit.com?subject=Sourcing%20Brief"
              className="inline-block text-sm font-medium uppercase tracking-[0.12em] text-primary border border-primary px-8 py-3.5 hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
            >
              Send a sourcing brief
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Sourcing;
