import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Play, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const DEFAULTS = {
  brands: "Filippa K\nTOTEME\nGanni\nBy Malene Birger\nRodebjer",
  materials: "ull\nkashmir\nsilke",
  colors: "svart\nbeige\nbrun\nburgundy",
};

const toLines = (values: string[] | null | undefined) => values?.join("\n") || "";
const fromLines = (value: string) => [...new Set(value.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))];

export function StadsmissionenAutoImport() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [brands, setBrands] = useState(DEFAULTS.brands);
  const [materials, setMaterials] = useState(DEFAULTS.materials);
  const [colors, setColors] = useState(DEFAULTS.colors);
  const [targetCount, setTargetCount] = useState(30);
  const [active, setActive] = useState(false);
  const [lastRun, setLastRun] = useState<{ status: string | null; summary: any } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("stadsmissionen_auto_import_configs")
        .select("brands, materials, colors, target_count, active, last_run_status, last_run_summary")
        .eq("config_key", "default")
        .maybeSingle();
      if (error) toast.error("Kunde inte läsa autoimportens inställningar");
      if (data) {
        setBrands(toLines(data.brands));
        setMaterials(toLines(data.materials));
        setColors(toLines(data.colors));
        setTargetCount(data.target_count);
        setActive(data.active);
        setLastRun({ status: data.last_run_status, summary: data.last_run_summary });
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    const brandList = fromLines(brands);
    if (!brandList.length) throw new Error("Lägg till minst ett märke");
    const payload = {
      config_key: "default",
      brands: brandList,
      materials: fromLines(materials),
      colors: fromLines(colors),
      target_count: Math.min(50, Math.max(1, Math.round(targetCount))),
      active,
    };
    const { error } = await supabase
      .from("stadsmissionen_auto_import_configs")
      .upsert(payload, { onConflict: "config_key" });
    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save();
      toast.success("Autoimportens inställningar sparade");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara inställningarna");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setRunning(true);
    try {
      await save();
      const { data, error } = await supabase.functions.invoke("stadsmissionen-auto-import", {
        body: { trigger: "manual" },
      });
      if (error) {
        let message = error.message;
        try {
          const context = await (error as any).context?.json?.();
          if (context?.error) message = context.error;
        } catch { /* Keep the original invocation error. */ }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      const result = data?.data || {};
      setLastRun({ status: result.status || "success", summary: result });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Test klar: ${result.imported || 0} utkast skapade, ${result.duplicates || 0} dubbletter, ${result.failed || 0} fel`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Testkörningen misslyckades");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="p-6 border border-border rounded-sm bg-card space-y-5">
      <div className="flex items-start gap-3">
        <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <h2 className="font-display text-lg text-primary">Auto-import Stadsmissionen</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Hämtar Dam- och Herr-plagg per märke och sparar dem som drafts i Products. Inget publiceras automatiskt.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="auto-ssm-brands">Märken</Label>
          <Textarea id="auto-ssm-brands" value={brands} onChange={(event) => setBrands(event.target.value)} rows={6} disabled={loading || running} />
          <p className="text-xs text-muted-foreground">Ett märke per rad.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="auto-ssm-materials">Material</Label>
          <Textarea id="auto-ssm-materials" value={materials} onChange={(event) => setMaterials(event.target.value)} rows={6} disabled={loading || running} />
          <p className="text-xs text-muted-foreground">Tomt fält = alla material.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="auto-ssm-colors">Färger</Label>
          <Textarea id="auto-ssm-colors" value={colors} onChange={(event) => setColors(event.target.value)} rows={6} disabled={loading || running} />
          <p className="text-xs text-muted-foreground">Tomt fält = alla färger.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-end">
        <div className="space-y-2">
          <Label htmlFor="auto-ssm-target">Max plagg per vecka</Label>
          <Input id="auto-ssm-target" type="number" min={1} max={50} value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} disabled={loading || running} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-sm border border-border p-3">
          <div>
            <Label htmlFor="auto-ssm-active" className="font-medium">Måndagar kl. 08:00</Label>
            <p className="text-xs text-muted-foreground">Svensk tid, även vid sommartid.</p>
          </div>
          <Switch id="auto-ssm-active" checked={active} onCheckedChange={setActive} disabled={loading || running} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={handleSave} disabled={loading || saving || running}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Spara inställningar
        </Button>
        <Button onClick={handleTest} disabled={loading || saving || running || !fromLines(brands).length}>
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {running ? "Testkör…" : "Testkör nu"}
        </Button>
        {lastRun?.status && (
          <span className="text-xs text-muted-foreground">
            Senast: {lastRun.status} · {lastRun.summary?.imported || 0} skapade
          </span>
        )}
      </div>
    </section>
  );
}
