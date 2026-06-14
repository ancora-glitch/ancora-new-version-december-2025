import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 pt-24 md:pt-32">
        {/* Hero Section */}
        <section className="px-6 md:px-12 lg:px-24 md:py-24 py-[43px]">
          <div className="max-w-[700px] mx-auto">
            <h1 className="font-serif text-primary text-4xl md:text-5xl lg:text-6xl leading-tight mb-8">
              Terms & Conditions
            </h1>
          </div>
        </section>

        {/* Content */}
        <section className="px-6 md:px-12 lg:px-24 pb-24">
          <div className="max-w-[700px] mx-auto article-body">
            <p className="text-sm text-muted-foreground mb-8">
              Last updated: February 1, 2026
            </p>

            <p className="mb-8">
              Welcome to Ancora. By accessing or using our website, you agree to the terms outlined below. If you do not agree, please do not use the service.
            </p>

            <h2 className="article-subheader">1. What Ancora Is (and Is Not)</h2>
            <p>
              Ancora is a discovery and curation platform for fashion and accessories listed by third-party sellers and marketplaces.
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>We do not sell products ourselves.</li>
              <li>We do not act as a marketplace.</li>
              <li>We do not facilitate transactions.</li>
              <li>Items cannot be bought or sold directly through Ancora.</li>
            </ul>
            <p>All purchases are completed on third-party websites that we link to.</p>

            <h2 className="article-subheader">2. Third-Party Listings & Content</h2>
            <p>
              Product information, prices, availability, images, and descriptions are provided by third-party sellers and marketplaces.
            </p>
            <p>
              Product images are provided by third-party sellers and marketplaces and are displayed for discovery purposes only.
            </p>
            <p>We do not guarantee that listings are accurate, complete, or up to date.</p>

            <h2 className="article-subheader">3. Prices & Availability</h2>
            <p>
              All prices are set by third-party sellers and may change at any time. Ancora has no control over pricing.

              With some partners, prices shown via Ancora may differ slightly from the prices shown on the partner’s own site. This reflects standard affiliate pricing practices and is determined entirely by the partner, not by Ancora.
            </p>
            <p>
              Please direct all pricing or availability questions to the seller or marketplace where the item is listed.
            </p>

            <h2 className="article-subheader">4. Shipping, Delivery & Logistics</h2>
            <p>Ancora does not handle shipping, delivery, returns, refunds, or logistics.</p>
            <p>All shipping and delivery matters are the responsibility of the seller or marketplace.</p>

            <h2 className="article-subheader">5. Customs, VAT & Import Duties</h2>
            <p>Ancora is not responsible for customs fees, VAT, import duties, or additional charges.</p>
            <p>
              Buyers are responsible for checking the seller's location and understanding any applicable import rules or costs.
            </p>

            <h2 className="article-subheader">6. No Seller Relationship</h2>
            <p>Ancora does not offer seller accounts and does not accept items for sale.</p>
            <p>
              Listings shown on Ancora are sourced from third-party marketplaces and displayed for discovery only.
            </p>

            <h2 className="article-subheader">7. External Links</h2>
            <p>
              Ancora links to third-party websites. Once you leave Ancora, you are subject to the terms and policies of those sites.
            </p>
            <p>Ancora is not responsible for external website content, policies, or transactions.</p>

            <h2 className="article-subheader">8. Intellectual Property</h2>
            <p>
              All trademarks, product images, and brand names belong to their respective owners. Ancora does not claim ownership of third-party content displayed on the platform.
            </p>

            <h2 className="article-subheader">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Ancora is not liable for losses or issues arising from third-party purchases, incorrect listing information, shipping problems, customs charges, or disputes between buyers and sellers.
            </p>

            <h2 className="article-subheader">10. Changes to These Terms</h2>
            <p>
              We may update these Terms & Conditions at any time. Continued use of the site constitutes acceptance of the updated terms.
            </p>

            <h2 className="article-subheader">11. Contact</h2>
            <p>
              For questions regarding these Terms, please contact:{" "}
              <a 
                href="mailto:hello@ancoraedit.com" 
                className="text-primary hover:opacity-70 transition-opacity"
              >
                hello@ancoraedit.com
              </a>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
