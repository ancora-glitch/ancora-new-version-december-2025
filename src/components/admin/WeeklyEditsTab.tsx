import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil, X, Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  useAllWeeklyEdits,
  useWeeklyEditProductIds,
  useSaveWeeklyEdit,
  useDeleteWeeklyEdit,
  type WeeklyEdit,
  type WeeklyEditStatus,
  type ThreeWayToWear,
} from "@/hooks/useWeeklyEdits";
import { useAllProducts } from "@/hooks/useProducts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusBadge = (status: WeeklyEditStatus) => {
  if (status === "published") return <Badge>Published</Badge>;
  if (status === "scheduled") return <Badge variant="outline">Scheduled</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
};

export const WeeklyEditsTab = () => {
  const { data: edits, isLoading } = useAllWeeklyEdits();
  const { data: allProducts } = useAllProducts();
  const saveMutation = useSaveWeeklyEdit();
  const deleteMutation = useDeleteWeeklyEdit();

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [weekLabel, setWeekLabel] = useState("");
  const [status, setStatus] = useState<WeeklyEditStatus>("draft");
  const [shortIntro, setShortIntro] = useState("");
  const [longIntro, setLongIntro] = useState("");
  const [threeWays, setThreeWays] = useState<ThreeWayToWear[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Load products for editing
  const { data: editProducts } = useWeeklyEditProductIds(editingId);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSlug("");
    setWeekLabel("");
    setStatus("draft");
    setShortIntro("");
    setLongIntro("");
    setThreeWays([]);
    setSelectedProductIds([]);
  };

  const handleEdit = (edit: WeeklyEdit) => {
    setEditingId(edit.id);
    setTitle(edit.title);
    setSlug(edit.slug);
    setWeekLabel(edit.week_label || "");
    setStatus(edit.status as WeeklyEditStatus);
    setShortIntro(edit.short_intro || "");
    setLongIntro(edit.long_intro || "");
    setThreeWays(
      Array.isArray(edit.three_ways_to_wear)
        ? (edit.three_ways_to_wear as unknown as ThreeWayToWear[])
        : []
    );
    // Products will load via useWeeklyEditProductIds — we set them when data arrives
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sync selected products when editProducts loads
  const loadedProductIds = editProducts?.map((ep: any) => ep.product_id) || [];
  if (
    editingId &&
    editProducts &&
    selectedProductIds.length === 0 &&
    loadedProductIds.length > 0 &&
    selectedProductIds.join(",") !== loadedProductIds.join(",")
  ) {
    // Only set once when switching to edit mode
    setTimeout(() => setSelectedProductIds(loadedProductIds), 0);
  }

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!editingId) {
      setSlug(
        value
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        id: editingId || undefined,
        data: {
          title: title.trim(),
          slug: slug.trim(),
          week_label: weekLabel.trim() || null,
          status,
          short_intro: shortIntro.trim() || null,
          long_intro: longIntro.trim() || null,
          three_ways_to_wear: JSON.parse(JSON.stringify(threeWays)),
        },
        productIds: selectedProductIds,
      });
      toast.success(editingId ? "Weekly edit updated" : "Weekly edit created");
      resetForm();
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    }
  };

  const handleDelete = async (id: string, editTitle: string) => {
    if (!window.confirm(`Delete "${editTitle}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Deleted");
      if (editingId === id) resetForm();
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    }
  };

  const addWay = () =>
    setThreeWays([...threeWays, { title: "", description: "" }]);
  const removeWay = (i: number) =>
    setThreeWays(threeWays.filter((_, idx) => idx !== i));
  const updateWay = (i: number, field: keyof ThreeWayToWear, value: string) =>
    setThreeWays(
      threeWays.map((w, idx) => (idx === i ? { ...w, [field]: value } : w))
    );

  const removeProduct = (pid: string) =>
    setSelectedProductIds(selectedProductIds.filter((id) => id !== pid));

  const availableProducts = allProducts?.filter(
    (p) => !selectedProductIds.includes(p.id)
  );

  const selectedProductObjects = selectedProductIds
    .map((id) => allProducts?.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div className="space-y-10">
      {/* Form */}
      <form
        onSubmit={handleSave}
        className="space-y-5 p-6 border border-border rounded-sm bg-card"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-primary">
            {editingId ? "Edit Weekly Edit" : "Create Weekly Edit"}
          </h2>
          {editingId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="text-muted-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. The Winter Capsule"
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug *</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="the-winter-capsule"
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Week Label</Label>
            <Input
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              placeholder="e.g. Week 7, 2026"
              className="bg-background border-border"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as WeeklyEditStatus)}
          >
            <SelectTrigger className="bg-background border-border w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Short Intro (homepage)</Label>
          <Textarea
            value={shortIntro}
            onChange={(e) => setShortIntro(e.target.value)}
            placeholder="One-line intro shown on homepage..."
            className="bg-background border-border min-h-[60px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Long Intro (edit page)</Label>
          <Textarea
            value={longIntro}
            onChange={(e) => setLongIntro(e.target.value)}
            placeholder="Rich editorial intro for the full edit page..."
            className="bg-background border-border min-h-[120px]"
          />
        </div>

        {/* Three Ways to Wear */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Three Ways to Wear</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addWay}
              disabled={threeWays.length >= 3}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          {threeWays.map((way, i) => (
            <div
              key={i}
              className="flex gap-3 items-start p-3 border border-border rounded-sm bg-secondary/20"
            >
              <div className="flex-1 space-y-2">
                <Input
                  value={way.title}
                  onChange={(e) => updateWay(i, "title", e.target.value)}
                  placeholder="e.g. Office Ready"
                  className="bg-background border-border"
                />
                <Textarea
                  value={way.description}
                  onChange={(e) => updateWay(i, "description", e.target.value)}
                  placeholder="How to style it..."
                  className="bg-background border-border min-h-[60px]"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeWay(i)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Product Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Products ({selectedProductIds.length})</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowProductPicker(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Products
            </Button>
          </div>
          {selectedProductObjects.length > 0 ? (
            <div className="space-y-2">
              {selectedProductObjects.map((product: any, i: number) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-2 border border-border rounded-sm bg-secondary/10"
                >
                  <span className="text-xs text-muted-foreground w-5 text-center">
                    {i + 1}
                  </span>
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-8 h-8 object-cover rounded-sm"
                    />
                  )}
                  <span className="text-sm flex-1 truncate">
                    {product.brand} – {product.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeProduct(product.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-sm p-4 text-center">
              No products selected yet.
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending
            ? "Saving..."
            : editingId
            ? "Update Weekly Edit"
            : "Create Weekly Edit"}
        </Button>
      </form>

      {/* Product Picker Dialog */}
      <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {availableProducts && availableProducts.length > 0 ? (
              availableProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-2 border border-border rounded-sm hover:bg-secondary/20 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedProductIds([...selectedProductIds, product.id]);
                  }}
                >
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-8 h-8 object-cover rounded-sm"
                    />
                  )}
                  <span className="text-sm flex-1 truncate">
                    {product.brand} – {product.name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {product.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                All products already added.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* List */}
      <div>
        <h2 className="font-display text-lg text-primary mb-6">
          Weekly Edits ({edits?.length || 0})
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />
            ))}
          </div>
        ) : edits && edits.length > 0 ? (
          <div className="space-y-3">
            {edits.map((edit) => (
              <div
                key={edit.id}
                className={`flex items-center justify-between p-4 border rounded-sm bg-card cursor-pointer transition-colors ${
                  editingId === edit.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => handleEdit(edit)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-medium text-primary truncate">
                      {edit.title}
                    </h3>
                    {statusBadge(edit.status as WeeklyEditStatus)}
                    {edit.week_label && (
                      <span className="text-xs text-muted-foreground">
                        {edit.week_label}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm truncate">
                    {edit.short_intro || "No intro"}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(edit);
                    }}
                    className="text-primary hover:bg-primary/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(edit.id, edit.title);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">
            No weekly edits yet.
          </p>
        )}
      </div>
    </div>
  );
};
