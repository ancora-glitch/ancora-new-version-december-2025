import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type RequireAdminProps = {
  children: React.ReactNode;
};

const RequireAdmin = ({ children }: RequireAdminProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const userId = useMemo(() => session?.user?.id ?? null, [session]);

  useEffect(() => {
    // Listener first
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Then session check
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .finally(() => {
        setCheckingSession(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checkingSession) return;

    if (!session) {
      navigate("/auth", {
        replace: true,
        state: { from: location.pathname },
      });
    }
  }, [checkingSession, session, navigate, location.pathname]);

  useEffect(() => {
    if (checkingSession) return;
    if (!userId) return;

    let cancelled = false;

    const checkAdmin = async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (cancelled) return;

      if (error) {
        setIsAdmin(false);
        toast.error("Kunde inte verifiera admin-behörighet");
        return;
      }

      setIsAdmin(Boolean(data));
    };

    setIsAdmin(null);
    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [checkingSession, userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Du är utloggad");
    navigate("/auth", { replace: true });
  };

  if (checkingSession || (session && isAdmin === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-md border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Kontrollerar behörighet…</p>
          <div className="mt-4 h-2 w-full rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-md border border-border bg-card p-6 space-y-4">
          <h1 className="font-display text-2xl tracking-tight text-foreground">Ingen åtkomst</h1>
          <p className="text-sm text-muted-foreground">
            Du är inloggad, men har inte admin-behörighet för att använda admin-portalen.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" onClick={() => navigate("/home", { replace: true })}>
              Gå till startsidan
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logga ut
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAdmin;
