import { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { 
  markProductViewed, 
  shouldTrackBuyNowClick, 
  markBuyNowClicked,
  getVisitorId 
} from "@/lib/sessionAnalytics";

// Track a page view
export const trackPageView = async (pagePath: string) => {
  try {
    const visitor_id = getVisitorId();
    const { error } = await supabase.from("site_analytics").insert([{
      event_type: "page_view",
      page_path: pagePath,
      visitor_id,
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
    
    const visitor_id = getVisitorId();
    const { error } = await supabase.from("site_analytics").insert([{
      event_type: eventType,
      page_path: pagePath,
      metadata: metadata || {},
      visitor_id,
    }]);
    
    if (error) {
      console.error("Analytics click error:", error);
    }
  } catch (error) {
    console.error("Analytics error:", error);
  }
};

// Convenience function for tracking product card clicks
// Also marks the product as viewed in the session
export const trackProductClick = async (productId: string, productName: string, brand: string) => {
  // Mark product as viewed in session (enables Buy Now tracking)
  markProductViewed(productId);
  
  return trackClick("product_click", "/products", {
    product_id: productId,
    product_name: productName,
    brand: brand,
    type: "product_card"
  });
};

// Convenience function for tracking Buy Now button clicks (async version)
// Only tracks if product was viewed first and hasn't been clicked this session
export const trackBuyNowClick = async (
  productId: string, 
  productName: string, 
  brand: string, 
  price: string,
  destination: string
) => {
  // Check session rules before tracking
  if (!shouldTrackBuyNowClick(productId)) {
    console.log(`[Analytics] Skipping Buy Now tracking for ${productId} (already tracked or not viewed)`);
    return;
  }
  
  // Mark as clicked to prevent duplicates
  markBuyNowClicked(productId);
  
  return trackClick("buy_now_click", "/buy-now", {
    product_id: productId,
    product_name: productName,
    brand: brand,
    price: price,
    destination: destination,
    type: "buy_now_click"
  });
};

// Fire-and-forget analytics using sendBeacon (reliable on mobile/navigation)
// Only tracks if session rules are satisfied (product viewed, not already clicked)
export const trackBuyNowClickBeacon = (
  productId: string, 
  productName: string, 
  brand: string, 
  price: string,
  destination: string
): boolean => {
  try {
    // Don't track on admin pages
    if (window.location.pathname.startsWith("/admin")) {
      return false;
    }
    
    // Check session rules before tracking
    if (!shouldTrackBuyNowClick(productId)) {
      console.log(`[Analytics] Skipping Buy Now beacon for ${productId} (already tracked or not viewed)`);
      return false;
    }
    
    // Mark as clicked to prevent duplicates
    markBuyNowClicked(productId);
    
    const visitor_id = getVisitorId();
    const payload = {
      event_type: "buy_now_click",
      page_path: "/buy-now",
      visitor_id,
      metadata: {
        product_id: productId,
        product_name: productName,
        brand: brand,
        price: price,
        destination: destination,
        type: "buy_now_click"
      }
    };
    
    // Use sendBeacon to our backend function so we don't depend on custom headers.
    const backendBaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${backendBaseUrl}/functions/v1/analytics-beacon`;
    const body = JSON.stringify(payload);

    // Prefer text/plain to avoid CORS preflight in more mobile browsers.
    const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });

    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return true;
    }

    // Fallback: keepalive fetch (still non-blocking; don't await)
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
    return true;
  } catch (error) {
    // Silently fail - analytics should never break navigation
    console.error("Analytics beacon error:", error);
    return false;
  }
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
