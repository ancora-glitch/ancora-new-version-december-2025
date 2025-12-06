import { Instagram, Bookmark } from "lucide-react";
export const Footer = () => {
  return <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 md:py-20">
        <div className="flex flex-col md:flex-row justify-between gap-12 md:gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <p className="text-xl font-mono md:text-base">Join the community</p>
            <div className="flex gap-4">
              <a href="#" aria-label="Follow us on Instagram" className="p-2 rounded-full border border-white/30 hover:bg-white/10 transition-colors duration-200">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Bookmark" className="p-2 rounded-full border border-white/30 hover:bg-white/10 transition-colors duration-200">
                <Bookmark className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Right Column */}
          <nav className="flex flex-col gap-4">
            <a href="#" className="font-sans text-sm hover:opacity-80 transition-opacity duration-200">
              About ANCORA
            </a>
            <a href="#" className="font-sans text-sm hover:opacity-80 transition-opacity duration-200">
              FAQ
            </a>
            <a href="#" className="font-sans text-sm hover:opacity-80 transition-opacity duration-200">
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>;
};