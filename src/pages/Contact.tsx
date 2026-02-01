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
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary text-center mb-6">
            Contact
          </h1>
          <p className="text-center text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Ancora is a small team based in Stockholm — Carin Roeraade, Sophie Gill, and Anna Dieden. We're always happy to hear from you. For any questions, please reach out via email.
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
