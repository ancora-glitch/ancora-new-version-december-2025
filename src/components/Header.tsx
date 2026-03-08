import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const clothingSubcategories = [
  { label: "Outerwear", href: "/category/clothing?sub=outerwear" },
  { label: "Tops", href: "/category/clothing?sub=tops" },
  { label: "Knitwear", href: "/category/clothing?sub=knitwear" },
  { label: "Shirts", href: "/category/clothing?sub=shirts" },
  { label: "Blazers", href: "/category/clothing?sub=blazers" },
  { label: "Dresses", href: "/category/clothing?sub=dresses" },
  { label: "Skirts", href: "/category/clothing?sub=skirts" },
  { label: "Jeans", href: "/category/clothing?sub=jeans" },
  { label: "Trousers", href: "/category/clothing?sub=trousers" },
  { label: "Shorts", href: "/category/clothing?sub=shorts" },
];

const shopCategories = [
  { label: "Clothing", href: "/category/clothing", subcategories: clothingSubcategories },
  { label: "Bags", href: "/category/bags" },
  { label: "Shoes", href: "/category/shoes" },
  { label: "Accessories", href: "/category/accessories" },
];

const navItems = [
  { label: "This Week's Edit", href: "/this-weeks-edit" },
  { label: "Stories", href: "/stories" },
  { label: "About", href: "/about" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopExpanded, setShopExpanded] = useState(false);
  const [desktopShopOpen, setDesktopShopOpen] = useState(false);
  const isMobile = useIsMobile();
  const shopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change (handled by onClick on links)
  const closeMobile = () => {
    setMobileOpen(false);
    setShopExpanded(false);
  };

  // Desktop hover handlers with small delay for smooth UX
  const openDesktopShop = () => {
    if (shopTimeoutRef.current) clearTimeout(shopTimeoutRef.current);
    setDesktopShopOpen(true);
  };

  const closeDesktopShop = () => {
    shopTimeoutRef.current = setTimeout(() => {
      setDesktopShopOpen(false);
    }, 150);
  };

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (!desktopShopOpen) return;
    const handler = (e: MouseEvent) => {
      if (shopRef.current && !shopRef.current.contains(e.target as Node)) {
        setDesktopShopOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [desktopShopOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/50">
      {/* Main bar */}
      <div className="flex items-center justify-between h-16 px-5 md:px-8">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 -ml-2 text-foreground hover:text-primary transition-colors duration-200 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
        </button>

        {/* Desktop nav — left aligned */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Shop with dropdown */}
          <div
            ref={shopRef}
            className="relative"
            onMouseEnter={openDesktopShop}
            onMouseLeave={closeDesktopShop}
          >
            <button
              onClick={() => setDesktopShopOpen(!desktopShopOpen)}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/80 hover:text-primary transition-colors duration-200",
                desktopShopOpen && "text-primary"
              )}
            >
              Shop
              <ChevronDown
                size={13}
                strokeWidth={1.5}
                className={cn(
                  "transition-transform duration-200",
                  desktopShopOpen && "rotate-180"
                )}
              />
            </button>

            {/* Desktop dropdown */}
            <div
              className={cn(
                "absolute top-full left-0 mt-0 bg-background border border-border/30 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] min-w-[200px] transition-all duration-300 ease-out z-50",
                desktopShopOpen
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 -translate-y-2 pointer-events-none"
              )}
            >
              <div className="py-5 px-1">
                {shopCategories.map((cat) => (
                  <div key={cat.href}>
                    <Link
                      to={cat.href}
                      onClick={() => setDesktopShopOpen(false)}
                      className="block px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/60 hover:text-primary transition-colors duration-300"
                    >
                      {cat.label}
                    </Link>
                    {cat.subcategories && cat.subcategories.map((sub) => (
                      <Link
                        key={sub.href}
                        to={sub.href}
                        onClick={() => setDesktopShopOpen(false)}
                        className="block pl-10 pr-5 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/40 hover:text-primary transition-colors duration-300"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <div className="border-t border-border/40 mx-5 mt-3 pt-3">
                  <Link
                    to="/shop"
                    onClick={() => setDesktopShopOpen(false)}
                    className="block px-5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70 hover:text-primary transition-colors duration-300"
                  >
                    Shop all
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Other nav items */}
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/80 hover:text-primary transition-colors duration-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Logo — centered */}
        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 z-10"
        >
          <h1 className="tracking-[0.16em] text-primary/95 font-bold font-logo text-2xl md:text-3xl uppercase">
            ANCORA
          </h1>
        </Link>

        {/* Spacer for balance */}
        <div className="w-[38px] md:w-0" />
      </div>

      {/* ====== Mobile menu ====== */}
      {isMobile && (
        <>
          {/* Overlay */}
          <div
            className={cn(
              "fixed inset-0 bg-foreground/10 backdrop-blur-[2px] z-40 transition-opacity duration-300",
              mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={closeMobile}
          />

          {/* Slide-in panel */}
          <div
            className={cn(
              "fixed top-0 left-0 bottom-0 w-[85%] max-w-[340px] bg-background z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* Mobile header */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-border/30">
              <span className="tracking-[0.16em] text-primary/95 font-bold font-logo text-xl uppercase">
                ANCORA
              </span>
              <button
                onClick={closeMobile}
                className="p-2 -mr-2 text-foreground hover:text-primary transition-colors"
                aria-label="Close menu"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Mobile nav links */}
            <nav className="flex-1 overflow-y-auto py-6 px-5">
              {/* Shop — expandable */}
              <div className="mb-1">
                <button
                  onClick={() => setShopExpanded(!shopExpanded)}
                  className="flex items-center justify-between w-full py-3.5 text-sm font-medium uppercase tracking-[0.14em] text-foreground hover:text-primary transition-colors"
                >
                  Shop
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200",
                      shopExpanded && "rotate-180"
                    )}
                  />
                </button>

                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    shopExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="pl-4 pb-2 space-y-0.5">
                    {shopCategories.map((cat) => (
                      <div key={cat.href}>
                        <Link
                          to={cat.href}
                          onClick={closeMobile}
                          className="block py-3 text-[13px] tracking-[0.1em] text-muted-foreground hover:text-primary transition-colors"
                        >
                          {cat.label}
                        </Link>
                        {cat.subcategories && cat.subcategories.map((sub) => (
                          <Link
                            key={sub.href}
                            to={sub.href}
                            onClick={closeMobile}
                            className="block pl-5 py-2 text-[12px] tracking-[0.08em] text-muted-foreground/70 hover:text-primary transition-colors"
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                    <div className="border-t border-border/30 mt-2 pt-2">
                      <Link
                        to="/shop"
                        onClick={closeMobile}
                        className="block py-3 text-[13px] tracking-[0.1em] text-muted-foreground/80 hover:text-primary transition-colors"
                      >
                        Shop all
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border/20 my-1" />

              {/* Other items */}
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={closeMobile}
                  className="block py-3.5 text-sm font-medium uppercase tracking-[0.14em] text-foreground hover:text-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
