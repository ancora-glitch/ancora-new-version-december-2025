import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Mail, ExternalLink } from "lucide-react";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-primary py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary-foreground text-center">
            Contact
          </h1>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16 md:py-24">
        <div className="max-w-2xl mx-auto px-6 md:px-8">
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

          {/* Footer Note */}
          <p className="text-center text-muted-foreground italic mt-16 font-serif">
            We'd love to hear from you.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
