import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/ImageUploader";
import { useCreateImportItem, type AisCondition, type AisSignals } from "@/hooks/useImportItems";
import { toast } from "sonner";
import { Loader2, X, Plus } from "lucide-react";

interface NewImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

// Tag input component
function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const tag = input.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder={placeholder}
        className="bg-background"
      />
    </div>
  );
}

export function NewImportDialog({ open, onOpenChange, onCreated }: NewImportDialogProps) {
  const createMutation = useCreateImportItem();

  // Generate default source_ref with date
  const today = new Date().toISOString().split("T")[0];
  const defaultSourceRef = `AN-${today}`;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [condition, setCondition] = useState<AisCondition | "">("");
  const [provenance, setProvenance] = useState("");
  const [sourceRef, setSourceRef] = useState(defaultSourceRef);
  const [signals, setSignals] = useState<AisSignals>({
    keywords: [],
    colors: [],
    era: null,
    material: null,
    vibe: null,
  });

  // Validation
  const isValid = title.trim() && images.length > 0 && price.trim();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImages([]);
    setPrice("");
    setCurrency("SEK");
    setCondition("");
    setProvenance("");
    setSourceRef(`AN-${new Date().toISOString().split("T")[0]}`);
    setSignals({
      keywords: [],
      colors: [],
      era: null,
      material: null,
      vibe: null,
    });
  };

  const handleCreate = async () => {
    if (!isValid) {
      toast.error("Please fill in required fields: title, at least 1 image, and price");
      return;
    }

    try {
      const id = await createMutation.mutateAsync({
        source_type: "manual",
        source_ref: sourceRef.trim() || defaultSourceRef,
        title: title.trim(),
        description: description.trim() || null,
        images,
        price: parseFloat(price) || null,
        currency: currency || "SEK",
        condition: condition || null,
        provenance: provenance.trim() || null,
        signals,
        status: "draft",
      });

      toast.success("Import created as draft");
      resetForm();
      onOpenChange(false);
      onCreated?.(id);
    } catch (error: any) {
      toast.error("Failed to create: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">New Manual Import</DialogTitle>
          <DialogDescription>
            Create a curator-sourced item. This will be saved as a draft for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Source info */}
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Source Reference</Label>
              <Input
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="AN-YYYY-MM-DD or curator initials"
                className="bg-background"
              />
            </div>
            <Badge variant="secondary" className="mb-2">
              Source: Manual / Ancora
            </Badge>
          </div>

          {/* Title (required) */}
          <div className="space-y-2">
            <Label>
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item title"
              className="bg-background"
            />
          </div>

          {/* Images (required) */}
          <div className="space-y-2">
            <Label>
              Images <span className="text-destructive">*</span>
              <span className="text-muted-foreground text-xs ml-2">
                (at least 1 required)
              </span>
            </Label>
            <ImageUploader
              images={images}
              onImagesChange={setImages}
              bucket="products"
              folder="imports"
              maxImages={10}
              showStoragePicker={true}
            />
          </div>

          {/* Price (required) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Price <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Estimated price"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="SEK"
                className="bg-background"
              />
            </div>
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Item description"
              className="bg-background min-h-[80px]"
            />
          </div>

          {/* Condition (optional) */}
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as AisCondition)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Provenance (optional) */}
          <div className="space-y-2">
            <Label>Provenance</Label>
            <Input
              value={provenance}
              onChange={(e) => setProvenance(e.target.value)}
              placeholder="Origin or history"
              className="bg-background"
            />
          </div>

          {/* Signals (all optional) */}
          <div className="pt-4 border-t border-border space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Signals (optional)
            </h3>

            <div className="space-y-2">
              <Label>Keywords</Label>
              <TagInput
                value={signals.keywords}
                onChange={(keywords) => setSignals({ ...signals, keywords })}
                placeholder="Add keyword and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label>Colors</Label>
              <TagInput
                value={signals.colors}
                onChange={(colors) => setSignals({ ...signals, colors })}
                placeholder="Add color and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label>Era</Label>
              <Input
                value={signals.era || ""}
                onChange={(e) =>
                  setSignals({ ...signals, era: e.target.value || null })
                }
                placeholder="e.g. 1970s, Mid-century"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>Material</Label>
              <TagInput
                value={signals.material || []}
                onChange={(material) => setSignals({ ...signals, material })}
                placeholder="Add material and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label>Vibe</Label>
              <TagInput
                value={signals.vibe || []}
                onChange={(vibe) => setSignals({ ...signals, vibe })}
                placeholder="Add vibe and press Enter"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Draft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
