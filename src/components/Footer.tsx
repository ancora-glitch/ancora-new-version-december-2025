import { Instagram, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-16 md:py-24">
        <div className="flex flex-col md:flex-row justify-between gap-14 md:gap-8">
          {/* Left Column - Editorial Copy */}
          <div className="space-y-6">
            <p className="text-base md:text-lg font-serif leading-relaxed md:whitespace-nowrap">
              Curated secondhand. Considered stories.
            </p>
            <p className="text-sm md:text-base text-primary-foreground/80 leading-relaxed md:whitespace-nowrap">
              Ancora edits what's worth keeping.
            </p>
            <div className="flex gap-4 pt-2">
              <a 
                href="https://www.instagram.com/ancora_edit/" 
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram" 
                className="p-2.5 rounded-full border border-primary-foreground/30 hover:bg-primary-foreground/10 transition-colors duration-200"
              >
                <Instagram className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a 
                href="https://ancoraedit.substack.com/" 
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Substack" 
                className="p-2.5 rounded-full border border-primary-foreground/30 hover:bg-primary-foreground/10 transition-colors duration-200"
              >
                <Bookmark className="w-5 h-5" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Right Column */}
          <nav className="flex flex-col gap-4">
            <Link to="/about" className="text-sm tracking-wide hover:opacity-70 transition-opacity duration-200">
              About Ancora
            </Link>
            <Link to="/contact" className="text-sm tracking-wide hover:opacity-70 transition-opacity duration-200">
              Contact
            </Link>
            <Link to="/admin-portal" className="text-xs tracking-wide text-primary-foreground/40 hover:text-primary-foreground/60 transition-opacity duration-200">
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};