import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const pricingTiers = {
  single: [
    "Purchase price up to 2,000 SEK — 25% of purchase price (minimum 300 SEK)",
    "2,000–8,000 SEK — 20% of purchase price",
    "8,000 SEK and above — 15% of purchase price",
  ],
  multiple:
    "A flat fee of 600 SEK is charged upfront to start the search, plus a percentage of the total purchase value using the same scale above. The upfront fee is deducted from your final invoice.",
};

const faqs = [
  {
    q: "How does the sourcing process work?",
    a: "You tell us what you're looking for — either with a moodboard/vision or the item, brand, size, condition, and any other details that matter to you. We search across our network of vintage markets, resellers, and platforms and come back to you with options. If we find something you want to buy, we handle the purchase and shipping on your behalf.",
  },
  {
    q: "How long does it take?",
    a: "It depends on the item. Common pieces can turn up within a few days. Rarer or more specific items may take longer. We'll always give you a realistic timeframe when you submit your request.",
  },
  {
    q: "What if you don't find anything?",
    a: "If we can't find the item, you pay nothing. For multiple-item searches, the upfront fee of 600 SEK is non-refundable as it covers our time regardless of outcome.",
  },
  {
    q: "How do I pay the sourcing fee?",
    a: "The fee is invoiced once the item is found and you've confirmed you want to proceed. For multiple-item searches, the upfront fee is charged at the start and deducted from your final invoice.",
  },
  {
    q: "Do you authenticate items?",
    a: "We do basic condition and authenticity checks as part of our sourcing process. For high-value items we recommend independent authentication.",
  },
  {
    q: "What platforms and markets do you search?",
    a: "We search across a wide range of Swedish and international secondhand platforms, vintage dealers, and private sellers. We don't limit ourselves to one source.",
  },
  {
    q: "Can I change my mind after you've found something?",
    a: "Yes. You're never obligated to buy. If you decide not to proceed after we've found an item, no sourcing fee is charged.",
  },
];

const useCases = [
  {
    label: "New wardrobe",
    title: "A completely new circular wardrobe",
    description:
      "Built from scratch – edited to your taste and lifestyle.",
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
                    {i + 1}.
                  </span>
                  <p className="text-base leading-relaxed text-foreground/80">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto">
            <div className="h-px w-full bg-border mb-12" />
            <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
              Pricing
            </span>
            <h2 className="font-serif text-primary text-3xl md:text-4xl leading-tight mt-4 mb-6">
              How our pricing works
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-foreground/80 mb-12">
              We charge a sourcing fee based on the value of the item or items you're looking for.
            </p>

            <div className="space-y-12">
              <div>
                <h3 className="text-lg font-sans font-medium text-foreground leading-snug mb-4">
                  Single item
                </h3>
                <ul className="space-y-3">
                  {pricingTiers.single.map((tier, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="text-sm font-medium text-muted-foreground font-sans tabular-nums mt-0.5">
                        {i + 1}.
                      </span>
                      <p className="text-base leading-relaxed text-foreground/80">
                        {tier}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-sans font-medium text-foreground leading-snug mb-4">
                  Multiple items
                </h3>
                <p className="text-base leading-relaxed text-foreground/80">
                  {pricingTiers.multiple}
                </p>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border space-y-4">
              <p className="text-sm leading-relaxed text-foreground/70">
                All fees are based on the actual purchase price of the item. Shipping and handling costs from the seller are not included.
              </p>
              <p className="text-sm leading-relaxed text-foreground/70">
                If we're unable to find the item you're looking for, no sourcing fee is charged. For multiple-item searches, the upfront fee of 600 SEK covers our time and is non-refundable.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto">
            <div className="h-px w-full bg-border mb-12" />
            <span className="text-xs tracking-widest uppercase text-muted-foreground font-sans">
              FAQ
            </span>
            <h2 className="font-serif text-primary text-3xl md:text-4xl leading-tight mt-4 mb-10">
              Frequently asked questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-base font-sans font-medium text-foreground hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-foreground/80">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
              href="mailto:carin@ancoraedit.com?subject=Sourcing%20Brief"
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
