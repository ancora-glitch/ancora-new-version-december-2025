import { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Track a page view
export const trackPageView = async (pagePath: string) => {
  try {
    const { error } = await supabase.from("site_analytics").insert([{
      event_type: "page_view",
      page_path: pagePath,
    }]);
    if (error) {
      console.error("Analytics page view error:", error);
    }
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.error("Analytics error:", error);
  }
};

// Track a click event (product clicks, buy now clicks, etc.)
export const trackClick = async (eventType: string, pagePath: string, metadata?: Json) => {
  try {
    // Don't track clicks on admin pages
    if (window.location.pathname.startsWith("/admin")) {
      return;
    }
    
    const { error } = await supabase.from("site_analytics").insert([{
      event_type: eventType,
      page_path: pagePath,
      metadata: metadata || {},
    }]);
    
    if (error) {
      console.error("Analytics click error:", error);
    }
  } catch (error) {
    console.error("Analytics error:", error);
  }
};

// Convenience function for tracking product card clicks
export const trackProductClick = async (productId: string, productName: string, brand: string) => {
  return trackClick("product_click", "/products", {
    product_id: productId,
    product_name: productName,
    brand: brand,
    type: "product_card"
  });
};

// Convenience function for tracking Buy Now button clicks
export const trackBuyNowClick = async (
  productId: string, 
  productName: string, 
  brand: string, 
  price: string,
  destination: string
) => {
  return trackClick("buy_now_click", "/buy-now", {
    product_id: productId,
    product_name: productName,
    brand: brand,
    price: price,
    destination: destination,
    type: "buy_now_click"
  });
};

// Hook to automatically track page views on route changes
export const usePageViewTracking = () => {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const trackIfNotAdmin = async () => {
      // Don't track admin pages
      if (location.pathname.startsWith("/admin")) {
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (cancelled) return;

        if (user) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
          });
          
          if (cancelled) return;
          
          // Only track if not admin
          if (!isAdmin) {
            trackPageView(location.pathname);
          }
        } else {
          // No user logged in, track the page view
          trackPageView(location.pathname);
        }
      } catch (error) {
        // On error, still track the page view
        if (!cancelled) {
          trackPageView(location.pathname);
        }
      }
    };

    trackIfNotAdmin();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);
};

// Hook to get a click tracker function
export const useClickTracker = () => {
  const trackProjectClickFn = useCallback((projectName: string) => {
    trackClick("click", "/projects", { project_name: projectName, type: "project_card" });
  }, []);

  const trackProductClickFn = useCallback((productName: string, productId: string, brand: string) => {
    trackProductClick(productId, productName, brand);
  }, []);

  return { trackProjectClick: trackProjectClickFn, trackProductClick: trackProductClickFn };
};
