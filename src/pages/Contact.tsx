import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Mail, ExternalLink } from "lucide-react";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        {/* Page Header */}
        <div className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-4">
            Contact
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            We'd love to hear from you.
          </p>
        </div>

        {/* Contact Information */}
        <section className="max-w-2xl mx-auto px-6 md:px-8">
          <div className="space-y-12">
            {/* Email */}
            <div className="border-b border-primary/10 pb-8">
              <h2 className="font-serif text-lg text-primary mb-3">Email</h2>
              <a 
                href="mailto:ancoraedit@gmail.com"
                className="text-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2"
              >
                <Mail className="w-4 h-4" strokeWidth={1.5} />
                ancoraedit@gmail.com
              </a>
            </div>

            {/* Substack */}
            <div className="border-b border-primary/10 pb-8">
              <h2 className="font-serif text-lg text-primary mb-3">Substack</h2>
              <a 
                href="https://ancoraedit.substack.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                ancoraedit.substack.com
              </a>
            </div>

            {/* Instagram */}
            <div className="border-b border-primary/10 pb-8">
              <h2 className="font-serif text-lg text-primary mb-3">Instagram</h2>
              <a 
                href="https://www.instagram.com/ancora_edit/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary transition-colors duration-200 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                @ancora_edit
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
