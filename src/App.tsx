import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import StyleGuide from "./pages/StyleGuide";
import Stories from "./pages/Stories";

import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import ProductDetail from "./pages/ProductDetail";
import Edits from "./pages/Edits";
import AdminPortal from "./pages/AdminPortal";
import Auth from "./pages/Auth";
import RequireAdmin from "./components/RequireAdmin";
import ScrollToTop from "./components/ScrollToTop";
import { PageViewTracker } from "./components/PageViewTracker";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <PageViewTracker>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/style-guides/:slug" element={<StyleGuide />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/edits" element={<Edits />} />
            <Route
              path="/admin-portal"
              element={
                <RequireAdmin>
                  <AdminPortal />
                </RequireAdmin>
              }
            />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageViewTracker>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
