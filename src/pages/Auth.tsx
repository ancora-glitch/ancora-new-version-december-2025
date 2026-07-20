import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) navigate("/admin-portal");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/admin-portal");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not sign in with Google");
        setLoading(false);
        return;
      }
      // If redirected, the browser is leaving; otherwise session is set and effect will navigate.
    } catch (err) {
      toast.error("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-display tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in with your authorized Google account.
          </p>
        </div>

        <Button onClick={handleGoogle} className="w-full" disabled={loading}>
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Only pre-approved admin accounts can access the portal.
        </p>
      </div>
    </div>
  );
};

export default Auth;
