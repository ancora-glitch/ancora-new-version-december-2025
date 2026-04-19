import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE") + " " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
};

export const EditorialBriefSection = () => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number>(0);

  const { data: brief, isLoading } = useQuery({
    queryKey: ["intake-editorial-brief", savedAt],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_editorial_briefs" as any)
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (brief?.brief_text !== undefined) setDraft(brief?.brief_text ?? "");
  }, [brief]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Deactivate any existing active rows
      const { error: deactErr } = await supabase
        .from("intake_editorial_briefs" as any)
        .update({ is_active: false })
        .eq("is_active", true);
      if (deactErr) {
        setError(deactErr.message);
        return;
      }

      const { error: insErr } = await supabase
        .from("intake_editorial_briefs" as any)
        .insert({ brief_text: draft.trim(), is_active: true } as any);
      if (insErr) {
        setError(insErr.message);
        return;
      }

      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["intake-editorial-brief"] });
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-heading font-semibold text-foreground">Editorial brief</h3>
        {brief?.updated_at && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Last updated {fmtDate(brief.updated_at)}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-2">
        This brief is sent to the scoring AI on every "Run scoring" call. Items aligned with the brief score higher on editorial distinctiveness.
      </p>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. höst, oversized, camel, ullkappa, lager-på-lager"
        rows={4}
        disabled={isLoading || isSaving}
        className="mb-2"
      />

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-800 text-sm p-2 mb-2">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || isLoading || draft === (brief?.brief_text ?? "")}
          className="gap-1.5"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save brief
        </Button>
      </div>
    </div>
  );
};
