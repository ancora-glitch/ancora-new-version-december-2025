import { useState } from "react";
import { Menu, X, ChevronRight, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  label: string;
  subItems?: string[];
}

const menuItems: MenuItem[] = [
  { label: "Clothing", subItems: ["Dresses", "Tops", "Bottoms", "Outerwear"] },
  { label: "Bags", subItems: ["Totes", "Crossbody", "Clutches", "Backpacks"] },
  { label: "Shoes", subItems: ["Heels", "Flats", "Sandals", "Boots"] },
  { label: "Guest Edits" },
  { label: "About Ancora" },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setExpandedItem(null);
    }
  };

  const toggleSubmenu = (label: string) => {
    setExpandedItem(expandedItem === label ? null : label);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background">
      {/* Header Bar */}
      <div className="flex items-center justify-between h-16 px-4">
        {/* Hamburger Button */}
        <button
          onClick={toggleMenu}
          className="p-2 -ml-2 text-foreground hover:text-primary transition-colors"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Logo */}
        <h1 className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl tracking-[0.2em] text-primary">
          ANCORA
        </h1>

        {/* Search Icon */}
        <button
          className="p-2 -mr-2 text-foreground hover:text-primary transition-colors"
          aria-label="Search"
        >
          <Search size={22} />
        </button>
      </div>

      {/* Dropdown Menu */}
      <nav
        className={cn(
          "absolute left-0 right-0 bg-card shadow-lg rounded-b-lg mx-4 overflow-hidden transition-all duration-300",
          isOpen
            ? "opacity-100 animate-slide-down"
            : "opacity-0 pointer-events-none -translate-y-2"
        )}
      >
        <ul className="py-4">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.subItems ? (
                <>
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className="w-full flex items-center justify-between px-6 py-3 font-sans font-medium text-foreground hover:text-primary hover:bg-accent/50 transition-colors"
                  >
                    <span>{item.label}</span>
                    {expandedItem === item.label ? (
                      <ChevronDown size={18} className="text-muted-foreground" />
                    ) : (
                      <ChevronRight size={18} className="text-muted-foreground" />
                    )}
                  </button>

                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200",
                      expandedItem === item.label ? "max-h-64" : "max-h-0"
                    )}
                  >
                    <ul className="bg-accent/30 py-2">
                      {item.subItems.map((subItem) => (
                        <li key={subItem}>
                          <button className="w-full text-left px-10 py-2.5 font-sans text-sm text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors">
                            {subItem}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <button className="w-full text-left px-6 py-3 font-sans font-medium text-foreground hover:text-primary hover:bg-accent/50 transition-colors">
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/10 -z-10"
          onClick={toggleMenu}
        />
      )}
    </header>
  );
}
