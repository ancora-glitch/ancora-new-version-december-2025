import { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Track a page view
export const trackPageView = async (pagePath: string) => {
  try {
    await supabase.from("site_analytics").insert([{
      event_type: "page_view",
      page_path: pagePath,
    }]);
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.error("Analytics error:", error);
  }
};

// Track a click event
export const trackClick = async (pagePath: string, metadata?: Json) => {
  try {
    await supabase.from("site_analytics").insert([{
      event_type: "click",
      page_path: pagePath,
      metadata: metadata || {},
    }]);
  } catch (error) {
    console.error("Analytics error:", error);
  }
};

// Hook to automatically track page views on route changes
export const usePageViewTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Don't track admin portal views
    if (!location.pathname.startsWith("/admin")) {
      trackPageView(location.pathname);
    }
  }, [location.pathname]);
};

// Hook to get a click tracker function
export const useClickTracker = () => {
  const trackProjectClick = useCallback((projectName: string) => {
    trackClick("/projects", { project_name: projectName, type: "project_card" });
  }, []);

  const trackProductClick = useCallback((productName: string, productId: string) => {
    trackClick("/products", { product_name: productName, product_id: productId, type: "product_card" });
  }, []);

  return { trackProjectClick, trackProductClick };
};
