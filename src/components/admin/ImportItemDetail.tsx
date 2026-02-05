import { useState, useEffect } from "react";
import {
  useImportItem,
  useUpdateImportItem,
  useMarkReviewed,
  useDiscardItem,
  useRevertToDraft,
  usePromoteToProduct,
  type AisCondition,
  type AisSignals,
} from "@/hooks/useImportItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Check,
  X,
  ArrowUpRight,
  RotateCcw,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react";

interface ImportItemDetailProps {
  itemId: string | null;
  onClose: () => void;
}

// Simple tag input component
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

export function ImportItemDetail({ itemId, onClose }: ImportItemDetailProps) {
  const { data: item, isLoading } = useImportItem(itemId);
  const updateMutation = useUpdateImportItem();
  const markReviewedMutation = useMarkReviewed();
  const discardMutation = useDiscardItem();
  const revertMutation = useRevertToDraft();
  const promoteMutation = usePromoteToProduct();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [condition, setCondition] = useState<AisCondition | "">("");
  const [provenance, setProvenance] = useState("");
  const [signals, setSignals] = useState<AisSignals>({
    keywords: [],
    colors: [],
    era: null,
    material: null,
    vibe: null,
  });
  const [selectedImage, setSelectedImage] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  // Load item data into form
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      setPrice(item.price?.toString() || "");
      setCurrency(item.currency || "SEK");
      setCondition(item.condition || "");
      setProvenance(item.provenance || "");
      setSignals(item.signals);
      setSelectedImage(0);
      setHasChanges(false);
    }
  }, [item]);

  if (!itemId) {
    return (
      <div className="flex items-center justify-center h-96 border border-border rounded-sm bg-card">
        <p className="text-muted-foreground">Select an item to view details</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 border border-border rounded-sm bg-card">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex items-center justify-center h-96 border border-border rounded-sm bg-card">
        <p className="text-muted-foreground">Item not found</p>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: {
          title,
          description: description || null,
          price: price ? parseFloat(price) : null,
          currency: currency || null,
          condition: condition || null,
          provenance: provenance || null,
          signals,
        },
      });
      toast.success("Changes saved");
      setHasChanges(false);
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    }
  };

  const handleMarkReviewed = async () => {
    try {
      await markReviewedMutation.mutateAsync(item.id);
      toast.success("Marked as reviewed");
    } catch (error: any) {
      toast.error("Failed: " + error.message);
    }
  };

  const handleDiscard = async () => {
    try {
      await discardMutation.mutateAsync(item.id);
      toast.success("Item discarded");
    } catch (error: any) {
      toast.error("Failed: " + error.message);
    }
  };

  const handleRevert = async () => {
    try {
      await revertMutation.mutateAsync(item.id);
      toast.success("Reverted to draft");
    } catch (error: any) {
      toast.error("Failed: " + error.message);
    }
  };

  const handlePromote = async () => {
    if (!window.confirm("Promote this item to a new Product? This action cannot be undone.")) return;
    try {
      const productId = await promoteMutation.mutateAsync(item);
      toast.success("Item promoted to product");
    } catch (error: any) {
      toast.error("Failed to promote: " + error.message);
    }
  };

  const isActionable = item.status === "draft" || item.status === "reviewed";
  const canRevert = item.status === "reviewed" || item.status === "discarded";

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      {/* Header with actions */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              item.status === "promoted"
                ? "default"
                : item.status === "discarded"
                ? "outline"
                : "secondary"
            }
            className={
              item.status === "promoted"
                ? "bg-green-600"
                : item.status === "reviewed"
                ? "bg-blue-500"
                : ""
            }
          >
            {item.status}
          </Badge>
          {item.source_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(item.source_url!, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Source
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          )}
          
          {canRevert && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevert}
              disabled={revertMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Revert
            </Button>
          )}

          {isActionable && (
            <>
              {item.status === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkReviewed}
                  disabled={markReviewedMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Mark Reviewed
                </Button>
              )}
              
              <Button
                variant="default"
                size="sm"
                onClick={handlePromote}
                disabled={promoteMutation.isPending}
              >
                {promoteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                )}
                Promote
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                disabled={discardMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4 mr-1" />
                Discard
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Left: Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-muted rounded-sm overflow-hidden">
            {item.images[selectedImage] ? (
              <img
                src={item.images[selectedImage]}
                alt={item.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No images
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {item.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {item.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-16 h-16 flex-shrink-0 rounded-sm overflow-hidden border-2 transition-colors ${
                    selectedImage === idx
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Editable fields */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setHasChanges(true);
              }}
              className="bg-background min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setHasChanges(true);
                }}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="SEK"
                className="bg-background"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select
              value={condition}
              onValueChange={(v) => {
                setCondition(v as AisCondition);
                setHasChanges(true);
              }}
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

          <div className="space-y-2">
            <Label>Provenance</Label>
            <Input
              value={provenance}
              onChange={(e) => {
                setProvenance(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Origin or history of the item"
              className="bg-background"
            />
          </div>

          {/* Signals section */}
          <div className="pt-4 border-t border-border space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Signals
            </h3>

            <div className="space-y-2">
              <Label>Keywords</Label>
              <TagInput
                value={signals.keywords}
                onChange={(keywords) => {
                  setSignals({ ...signals, keywords });
                  setHasChanges(true);
                }}
                placeholder="Add keyword and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label>Colors</Label>
              <TagInput
                value={signals.colors}
                onChange={(colors) => {
                  setSignals({ ...signals, colors });
                  setHasChanges(true);
                }}
                placeholder="Add color and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label>Era</Label>
              <Input
                value={signals.era || ""}
                onChange={(e) => {
                  setSignals({ ...signals, era: e.target.value || null });
                  setHasChanges(true);
                }}
                placeholder="e.g. 1970s, Mid-century"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>Material</Label>
              <TagInput
                value={signals.material || []}
                onChange={(material) => {
                  setSignals({ ...signals, material });
                  setHasChanges(true);
                }}
                placeholder="Add material and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label>Vibe</Label>
              <TagInput
                value={signals.vibe || []}
                onChange={(vibe) => {
                  setSignals({ ...signals, vibe });
                  setHasChanges(true);
                }}
                placeholder="Add vibe and press Enter"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
