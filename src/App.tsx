import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import StyleGuide from "./pages/StyleGuide";
import Stories from "./pages/Stories";
import ComingSoon from "./pages/ComingSoon";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import ProductDetail from "./pages/ProductDetail";
import Edits from "./pages/Edits";
import Projects from "./pages/Projects";
import AdminPortal from "./pages/AdminPortal";
import Auth from "./pages/Auth";
import RequireAdmin from "./components/RequireAdmin";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/coming-soon" replace />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/home" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/style-guides/:slug" element={<StyleGuide />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/edits" element={<Edits />} />
          <Route path="/projects" element={<Projects />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
