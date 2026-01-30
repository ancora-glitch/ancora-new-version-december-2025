import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";

interface MenuItem {
  label: string;
  href: string;
}

const staticMenuItems: MenuItem[] = [
  { label: "Home", href: "/home" },
  { label: "Edits", href: "/edits" },
  { label: "Stories", href: "/stories" },
  { label: "About", href: "/about" }
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: categories, isLoading, error } = useCategories();

  // Debug logging
  console.log('Categories found:', categories);
  console.log('Categories loading:', isLoading);
  console.log('Categories error:', error);

  // Build dynamic menu items: static items + published categories
  const menuItems: MenuItem[] = [
    ...staticMenuItems.slice(0, 2), // Home, Edits
    // Insert categories after Edits
    ...(categories?.map(cat => ({
      label: cat.name,
      href: `/category/${cat.slug}`
    })) || []),
    ...staticMenuItems.slice(2) // Stories, About
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/50">
      {/* Header Bar */}
      <div className="flex items-center justify-between h-16 px-5 md:px-8">
        {/* Hamburger Button */}
        <button 
          onClick={toggleMenu} 
          className="p-2 -ml-2 text-foreground hover:text-primary transition-colors duration-200" 
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
        </button>

        {/* Logo */}
        <Link to="/home" className="absolute left-1/2 -translate-x-1/2">
          <h1 className="tracking-[0.16em] text-primary/95 font-bold font-logo text-2xl md:text-3xl uppercase">
            ANCORA
          </h1>
        </Link>

        {/* Spacer for balance */}
        <div className="w-[38px]" />
      </div>

      {/* Dropdown Menu */}
      <nav className={cn(
        "absolute left-0 right-0 bg-card shadow-lg mx-4 md:mx-8 overflow-hidden transition-all duration-300 border border-border/30",
        isOpen ? "opacity-100 animate-slide-down" : "opacity-0 pointer-events-none -translate-y-2"
      )}>
        <ul className="py-3">
          {menuItems.map(item => (
            <li key={item.label}>
              <Link 
                to={item.href}
                onClick={toggleMenu}
                className="block w-full text-left px-6 py-3.5 text-sm font-medium tracking-wide text-foreground hover:text-primary hover:bg-accent/40 transition-colors duration-200"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/8 backdrop-blur-[1px] -z-10" 
          onClick={toggleMenu} 
        />
      )}
    </header>
  );
}