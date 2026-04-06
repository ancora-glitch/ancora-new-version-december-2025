import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BrandTier = {
  id: string;
  brand_name: string;
  tier: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const TIERS = ["a", "b", "c", "reject"] as const;

const tierLabel: Record<string, string> = { a: "Tier A", b: "Tier B", c: "Tier C", reject: "Reject" };
const tierColor: Record<string, string> = {
  a: "text-emerald-700",
  b: "text-blue-700",
  c: "text-amber-700",
  reject: "text-red-700",
};
const tierHeadingBg: Record<string, string> = {
  a: "bg-emerald-50 text-emerald-800",
  b: "bg-blue-50 text-blue-800",
  c: "bg-amber-50 text-amber-800",
  reject: "bg-red-50 text-red-800",
};

export const BrandTiersSection = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrandTier | null>(null);
  const [form, setForm] = useState({ brand_name: "", tier: "a", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: brands, isLoading } = useQuery({
    queryKey: ["intake-brand-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intake_brand_tiers")
        .select("*")
        .order("tier")
        .order("brand_name");
      if (error) throw error;
      return (data ?? []) as BrandTier[];
    },
  });

  const grouped = TIERS.reduce((acc, t) => {
    acc[t] = (brands ?? []).filter((b) => b.tier === t);
    return acc;
  }, {} as Record<string, BrandTier[]>);

  const openAdd = () => {
    setEditing(null);
    setForm({ brand_name: "", tier: "a", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (b: BrandTier) => {
    setEditing(b);
    setForm({ brand_name: b.brand_name, tier: b.tier, notes: b.notes ?? "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.brand_name.trim()) { toast.error("Brand name is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("intake_brand_tiers")
          .update({ brand_name: form.brand_name.trim(), tier: form.tier, notes: form.notes.trim() || null, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Brand updated");
      } else {
        const { error } = await supabase
          .from("intake_brand_tiers")
          .insert({ brand_name: form.brand_name.trim(), tier: form.tier, notes: form.notes.trim() || null });
        if (error) throw error;
        toast.success("Brand added");
      }
      queryClient.invalidateQueries({ queryKey: ["intake-brand-tiers"] });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: BrandTier) => {
    if (!confirm(`Delete "${b.brand_name}"?`)) return;
    const { error } = await supabase.from("intake_brand_tiers").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Brand deleted");
    queryClient.invalidateQueries({ queryKey: ["intake-brand-tiers"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-heading font-semibold text-foreground">Brand tiers</h3>
        <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add brand
        </Button>
      </div>

      {isLoading ? (
        <div className="h-20 bg-muted rounded-sm animate-pulse" />
      ) : !brands || brands.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-border rounded-md p-6 text-center">
          No brands configured yet.
        </p>
      ) : (
        <div className="space-y-4">
          {TIERS.map((tier) => {
            const items = grouped[tier];
            if (items.length === 0) return null;
            return (
              <div key={tier}>
                <div className={`px-3 py-1.5 rounded-t-md text-xs font-semibold uppercase tracking-wide ${tierHeadingBg[tier]}`}>
                  {tierLabel[tier]} · {items.length} brands
                </div>
                <div className="overflow-x-auto border border-t-0 border-border rounded-b-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium text-muted-foreground">Brand</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Tier</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground">Notes</th>
                        <th className="px-3 py-2 font-medium text-muted-foreground w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((b) => (
                        <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{b.brand_name}</td>
                          <td className={`px-3 py-2 font-semibold ${tierColor[b.tier]}`}>{tierLabel[b.tier] ?? b.tier}</td>
                          <td className="px-3 py-2 text-muted-foreground">{b.notes || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => handleDelete(b)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !saving && setDialogOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit brand" : "Add brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Brand name</label>
              <Input className="mt-1" value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tier</label>
              <Select value={form.tier} onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => <SelectItem key={t} value={t}>{tierLabel[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Notes (optional)</label>
              <Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {editing ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
