import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllStyleGuides, type StoryStatus } from "@/hooks/useStyleGuides";
import { useAllProducts, useSoldProducts, type ProductStatus } from "@/hooks/useProducts";
import { useAllCategories, type Category, type CategoryStatus } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Pencil, X, GripVertical, Bold, Italic, RefreshCw, Loader2, Image as ImageIcon, Eye, EyeOff, Star, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StorageImagePicker } from "@/components/StorageImagePicker";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
// Legacy TraderaSearch removed from admin tabs
import { Badge } from "@/components/ui/badge";
import { ImportsTab } from "@/components/admin/ImportsTab";
import { WeeklyEditsTab } from "@/components/admin/WeeklyEditsTab";
import { IntakeTab } from "@/components/admin/IntakeTab";
import { slugify } from "@/utils/slugify";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type AncoraSelectSource = "tradera" | null;

const CLOTHING_SUBCATEGORIES = [
  { value: "outerwear", label: "Outerwear" },
  { value: "tops", label: "Tops" },
  { value: "knitwear", label: "Knitwear" },
  { value: "shirts", label: "Shirts" },
  { value: "blazers", label: "Blazers" },
  { value: "dresses", label: "Dresses" },
  { value: "skirts", label: "Skirts" },
  { value: "jeans", label: "Jeans" },
  { value: "trousers", label: "Trousers" },
  { value: "shorts", label: "Shorts" },
];

interface Product {
  id: string;
  brand: string;
  name: string;
  name_en?: string | null;
  name_original?: string | null;
  price: string;
  image: string;
  additional_images?: string[];
  description?: string | null;
  description_en?: string | null;
  description_original?: string | null;
  affiliate_url?: string | null;
  marketplace?: string | null;
  condition?: string | null;
  material?: string | null;
  size?: string | null;
  color?: string | null;
  status: ProductStatus;
  slug?: string | null;
  sort_order?: number | null;
  category_id?: string | null;
  subcategory?: string | null;
  ancora_select_source?: AncoraSelectSource;
  in_weekly_edit?: boolean;
  affiliate_status?: string | null;
  affiliate_auto_handling?: boolean;
  affiliate_last_checked_at?: string | null;
  unpublished_reason?: string | null;
}

const isPublishedStatus = (status: ProductStatus) => status === "active" || status === "published";

// Category status badge helper
const getCategoryStatusBadge = (status: CategoryStatus) => {
  if (status === "published") return <Badge>Published</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
};

// Status badge helper
const getStatusBadge = (status: ProductStatus) => {
  if (isPublishedStatus(status)) return <Badge>Published</Badge>;
  if (status === "draft") return <Badge variant="secondary">Draft</Badge>;
  if (status === "sold") return <Badge variant="outline">Sold</Badge>;
  if (status === "review_required") return <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-50">Review</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

// Sortable Product Item Component
interface SortableProductItemProps {
  product: Product;
  editingProductId: string | null;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
  onTogglePublish: (product: Product) => void;
  onToggleWeeklyEdit: (product: Product) => void;
  onRecheck: (product: Product) => void;
  isRechecking: boolean;
}

const SortableProductItem = ({ product, editingProductId, onEdit, onDelete, onTogglePublish, onToggleWeeklyEdit, onRecheck, isRechecking }: SortableProductItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 border rounded-sm bg-card cursor-pointer transition-colors ${
        editingProductId === product.id
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
      onClick={() => onEdit(product)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-primary touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-5 h-5" />
        </div>
        {product.image && (
          <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-primary truncate">{product.brand} - {product.name}</h3>
            {getStatusBadge(product.status)}
            {product.in_weekly_edit && (
              <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50">
                <Star className="w-3 h-3 mr-1 fill-amber-500" />
                Edit
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {product.price}
            {product.size && ` · Size: ${product.size}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {product.status !== "sold" && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWeeklyEdit(product);
              }}
              className={product.in_weekly_edit ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-50"}
              title={product.in_weekly_edit ? "Remove from This Week's Edit" : "Add to This Week's Edit"}
            >
              <Star className={`w-4 h-4 ${product.in_weekly_edit ? 'fill-amber-500' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublish(product);
              }}
              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
              title={isPublishedStatus(product.status) ? "Unpublish (move to draft)" : "Publish"}
            >
              {isPublishedStatus(product.status) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </>
        )}
        {product.affiliate_url && (
          <Button
            variant="ghost"
            size="icon"
            disabled={isRechecking}
            onClick={(e) => {
              e.stopPropagation();
              onRecheck(product);
            }}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="Recheck availability"
          >
            {isRechecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(product);
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
            onDelete(product.id, product.name);
          }}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const AdminPortal = () => {
  const { data: stories, isLoading: storiesLoading } = useAllStyleGuides();
  const { data: products, isLoading: productsLoading } = useAllProducts();
  const { data: soldProducts, isLoading: soldProductsLoading } = useSoldProducts();
  const { data: categories, isLoading: categoriesLoading } = useAllCategories();
  const queryClient = useQueryClient();
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [isRecheckingProduct, setIsRecheckingProduct] = useState(false);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [recheckingProductId, setRecheckingProductId] = useState<string | null>(null);

  // Story form state
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyImage, setStoryImage] = useState<string[]>([]);
  const [storyIntroText, setStoryIntroText] = useState("");
  const [storyBody, setStoryBody] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [storyAuthor, setStoryAuthor] = useState<string>("");
  const [savingStory, setSavingStory] = useState(false);
  const [storySlugManuallyEdited, setStorySlugManuallyEdited] = useState(false);
  const [storyStatusFilter, setStoryStatusFilter] = useState<"all" | StoryStatus>("draft");
  const [showInlineImagePicker, setShowInlineImagePicker] = useState(false);
  const [inlineImageCaption, setInlineImageCaption] = useState("");
  const [selectedInlineImage, setSelectedInlineImage] = useState<string[]>([]);

  // Product form state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productBrand, setProductBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productSize, setProductSize] = useState("");
 const [productColor, setProductColor] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productDescription, setProductDescription] = useState("");
  const [productAffiliateUrl, setProductAffiliateUrl] = useState("");
  const [productMarketplace, setProductMarketplace] = useState("");
  const [productCondition, setProductCondition] = useState("");
  const [productMaterial, setProductMaterial] = useState("");
  const [productStatus, setProductStatus] = useState<ProductStatus>("draft");
  const [productCategoryId, setProductCategoryId] = useState<string | null>(null);
  const [productAncoraSelectSource, setProductAncoraSelectSource] = useState<AncoraSelectSource>(null);
  const [productSubcategory, setProductSubcategory] = useState<string | null>(null);
  const [productInWeeklyEdit, setProductInWeeklyEdit] = useState(false);
  const [productAffiliateAutoHandling, setProductAffiliateAutoHandling] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSlug, setProductSlug] = useState("");
  const [productSlugManuallyEdited, setProductSlugManuallyEdited] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "sold" | "review_required">("all");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productSortBy, setProductSortBy] = useState<"default" | "newest" | "oldest" | "brand" | "price">("default");

  // Category form state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categoryStatus, setCategoryStatus] = useState<CategoryStatus>("draft");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categorySeoTitle, setCategorySeoTitle] = useState("");
  const [categorySeoDescription, setCategorySeoDescription] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [categorySlugManuallyEdited, setCategorySlugManuallyEdited] = useState(false);

  // Auto-generate slug from title (only when creating new story)
  const handleStoryTitleChange = (value: string) => {
    setStoryTitle(value);
    if (!editingStoryId && !storySlugManuallyEdited) {
      setStorySlug(slugify(value));
    }
  };

  const resetStoryForm = () => {
    setEditingStoryId(null);
    setStoryTitle("");
    setStoryImage([]);
    setStoryIntroText("");
    setStoryBody("");
    setStorySlug("");
    setStoryAuthor("");
    setStorySlugManuallyEdited(false);
  };

  const handleEditStory = (story: { id: string; title: string; image: string; intro_text: string; body: string; slug: string; author?: string | null; status?: string }) => {
    setEditingStoryId(story.id);
    setStoryTitle(story.title);
    setStoryImage([story.image]);
    setStoryIntroText(story.intro_text);
    setStoryBody(story.body);
    setStorySlug(story.slug);
    setStoryAuthor(story.author || "");
    setStorySlugManuallyEdited(true);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductBrand("");
    setProductName("");
    setProductPrice("");
    setProductSize("");
   setProductColor("");
    setProductImages([]);
    setProductDescription("");
    setProductAffiliateUrl("");
    setProductMarketplace("");
    setProductCondition("");
    setProductMaterial("");
    setProductStatus("draft");
    setProductCategoryId(null);
    setProductSubcategory(null);
    setProductAncoraSelectSource(null);
    setProductInWeeklyEdit(false);
    setProductAffiliateAutoHandling(true);
    setProductSlug("");
    setProductSlugManuallyEdited(false);
  };

  // Category form helpers
  const handleCategoryNameChange = (value: string) => {
    setCategoryName(value);
    if (!editingCategoryId && !categorySlugManuallyEdited) {
      setCategorySlug(slugify(value));
    }
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategorySlug("");
    setCategoryStatus("draft");
    setCategoryDescription("");
    setCategorySeoTitle("");
    setCategorySeoDescription("");
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setCategorySlug(category.slug);
    setCategoryStatus(category.status);
    setCategoryDescription(category.description || "");
    setCategorySeoTitle(category.seo_title || "");
    setCategorySeoDescription(category.seo_description || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || !categorySlug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSavingCategory(true);
    
    const categoryData = {
      name: categoryName.trim(),
      slug: categorySlug.trim(),
      status: categoryStatus,
      description: categoryDescription.trim() || null,
      seo_title: categorySeoTitle.trim() || null,
      seo_description: categorySeoDescription.trim() || null,
    };

    let error;

    if (editingCategoryId) {
      const result = await supabase
        .from("categories")
        .update(categoryData)
        .eq("id", editingCategoryId);
      error = result.error;
    } else {
      const result = await supabase.from("categories").insert([categoryData]);
      error = result.error;
    }
    
    if (error) {
      toast.error(`Failed to ${editingCategoryId ? 'update' : 'save'} category: ` + error.message);
    } else {
      toast.success(editingCategoryId ? "Category updated" : "Category saved");
      resetCategoryForm();
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
    }
    setSavingCategory(false);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Products in this category will be unassigned.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Category deleted");
      if (editingCategoryId === id) {
        resetCategoryForm();
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
    }
  };

  const handleToggleCategoryPublish = async (category: Category) => {
    const newStatus: CategoryStatus = category.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("categories")
      .update({ status: newStatus })
      .eq("id", category.id);

    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success(newStatus === "published" ? "Category published" : "Category moved to drafts");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductBrand(product.brand);
    // Prefer name_en for editing; fall back to name
    setProductName(product.name_en || product.name);
    setProductPrice(product.price);
    setProductSize(product.size || "");
   setProductColor((product as any).color || "");
    const allImages = [product.image, ...(product.additional_images || [])];
    setProductImages(allImages);
    // Prefer description_en for editing; fall back to description
    setProductDescription(product.description_en || product.description || "");
    setProductAffiliateUrl(product.affiliate_url || "");
    setProductMarketplace(product.marketplace || "");
    setProductCondition(product.condition || "");
    setProductMaterial(product.material || "");
    // Normalize legacy 'published' to 'active' for the UI
    setProductStatus(product.status === "published" ? "active" : product.status);
    setProductCategoryId(product.category_id || null);
    setProductSubcategory((product as any).subcategory || null);
    setProductAncoraSelectSource(product.ancora_select_source || null);
    setProductInWeeklyEdit(product.in_weekly_edit || false);
    setProductAffiliateAutoHandling(product.affiliate_auto_handling !== false);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyTitle.trim() || storyImage.length === 0 || !storyIntroText.trim() || !storyBody.trim()) {
      toast.error("Title, image, intro text and body are required");
      return;
    }
    setSavingStory(true);
    
    const storyData = {
      title: storyTitle.trim(),
      image: storyImage[0],
      intro_text: storyIntroText.trim(),
      body: storyBody.trim(),
      slug: storySlug.trim() || storyTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      author: storyAuthor.trim() || null,
    };

    let error;

    if (editingStoryId) {
      // Update existing story
      const result = await supabase
        .from("style_guides")
        .update(storyData)
        .eq("id", editingStoryId);
      error = result.error;
    } else {
      // Insert new story
      const result = await supabase.from("style_guides").insert([storyData]);
      error = result.error;
    }
    
    if (error) {
      toast.error(`Failed to ${editingStoryId ? 'update' : 'save'} story: ` + error.message);
    } else {
      toast.success(editingStoryId ? "Story updated" : "Story saved");
      resetStoryForm();
      queryClient.invalidateQueries({ queryKey: ["style-guides"] });
      queryClient.invalidateQueries({ queryKey: ["style-guides-all"] });
    }
    setSavingStory(false);
  };

  const handleDeleteStory = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("style_guides").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Story deleted");
      if (editingStoryId === id) {
        resetStoryForm();
      }
      queryClient.invalidateQueries({ queryKey: ["style-guides"] });
      queryClient.invalidateQueries({ queryKey: ["style-guides-all"] });
    }
  };

  const handlePublishStory = async (story: { id: string; title: string; image: string; body: string }) => {
    // Guardrails
    if (!story.title?.trim()) { toast.error("Cannot publish: title is empty"); return; }
    if (!story.image) { toast.error("Cannot publish: hero image is missing"); return; }
    if (!story.body?.trim()) { toast.error("Cannot publish: body is empty"); return; }

    const { error } = await supabase
      .from("style_guides")
      .update({ status: "published" as any, published_at: new Date().toISOString() })
      .eq("id", story.id);

    if (error) {
      toast.error("Failed to publish: " + error.message);
    } else {
      toast.success("Story published");
      queryClient.invalidateQueries({ queryKey: ["style-guides"] });
      queryClient.invalidateQueries({ queryKey: ["style-guides-all"] });
    }
  };

  const handleUnpublishStory = async (id: string) => {
    const { error } = await supabase
      .from("style_guides")
      .update({ status: "draft" as any, unpublished_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to unpublish: " + error.message);
    } else {
      toast.success("Story moved to drafts");
      queryClient.invalidateQueries({ queryKey: ["style-guides"] });
      queryClient.invalidateQueries({ queryKey: ["style-guides-all"] });
    }
  };

  const handleArchiveStory = async (id: string) => {
    const { error } = await supabase
      .from("style_guides")
      .update({ status: "archived" as any })
      .eq("id", id);

    if (error) {
      toast.error("Failed to archive: " + error.message);
    } else {
      toast.success("Story archived");
      queryClient.invalidateQueries({ queryKey: ["style-guides"] });
      queryClient.invalidateQueries({ queryKey: ["style-guides-all"] });
    }
  };

  // Filter stories based on status
  const filteredStories = stories?.filter((s: any) => {
    if (storyStatusFilter === "all") return true;
    return s.status === storyStatusFilter;
  });

  const syncPublishedWeeklyEditMembership = async (productId: string, includeInWeeklyEdit: boolean) => {
    const { data: publishedEdit, error: publishedEditError } = await supabase
      .from("weekly_edits")
      .select("id")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (publishedEditError || !publishedEdit) return;

    if (includeInWeeklyEdit) {
      const { data: existingRow, error: existingRowError } = await supabase
        .from("weekly_edit_products")
        .select("id")
        .eq("weekly_edit_id", publishedEdit.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (existingRowError || existingRow) return;

      const { data: lastRow } = await supabase
        .from("weekly_edit_products")
        .select("sort_order")
        .eq("weekly_edit_id", publishedEdit.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from("weekly_edit_products").insert({
        weekly_edit_id: publishedEdit.id,
        product_id: productId,
        sort_order: (lastRow?.sort_order ?? -1) + 1,
      });
      return;
    }

    await supabase
      .from("weekly_edit_products")
      .delete()
      .eq("product_id", productId)
      .eq("weekly_edit_id", publishedEdit.id);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productBrand.trim() || !productName.trim() || !productPrice || productImages.length === 0) {
      toast.error("Brand, name, price and at least one image are required");
      return;
    }
    setSavingProduct(true);
    
    const slug = `${productBrand}-${productName}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const mainImage = productImages[0];
    const additionalImages = productImages.slice(1);
    
    const trimmedName = productName.trim();
    const trimmedDesc = productDescription.trim() || null;
 
    const productData = {
      brand: productBrand.trim(),
      name: trimmedName,
      name_en: trimmedName,
      description: trimmedDesc,
      description_en: trimmedDesc,
      price: productPrice.trim(),
      size: productSize.trim() || null,
      color: productColor.trim() || null,
      image: mainImage,
      additional_images: additionalImages,
      affiliate_url: productAffiliateUrl.trim() || null,
      marketplace: productMarketplace.trim() || null,
      condition: productCondition.trim() || null,
      material: productMaterial.trim() || null,
      status: productStatus,
      slug,
      category_id: productCategoryId || null,
      subcategory: productSubcategory || null,
      ancora_select_source: productAncoraSelectSource,
      in_weekly_edit: productInWeeklyEdit,
      affiliate_auto_handling: productAffiliateAutoHandling,
    };
 
    let error;
    let savedProductId = editingProductId;
    
    if (editingProductId) {
      const result = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProductId);
      error = result.error;
    } else {
      const result = await supabase.from("products").insert([productData]).select("id").single();
      error = result.error;
      savedProductId = result.data?.id;
    }
    
    if (error) {
      toast.error(`Failed to ${editingProductId ? 'update' : 'save'} product: ` + error.message);
    } else {
      if (savedProductId) {
        await syncPublishedWeeklyEditMembership(savedProductId, productInWeeklyEdit);
      }
      toast.success(editingProductId ? "Product updated" : "Product saved");
      resetProductForm();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products-weekly-edit"] });
      queryClient.invalidateQueries({ queryKey: ["category-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-active"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edits-all"] });
    }
    setSavingProduct(false);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Product deleted");
      if (editingProductId === id) {
        resetProductForm();
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products-weekly-edit"] });
      queryClient.invalidateQueries({ queryKey: ["category-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-active"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-products"] });
    }
  };

  const handleTogglePublish = async (product: Product) => {
    const newStatus: ProductStatus = isPublishedStatus(product.status) ? "draft" : "active";
    const { error } = await supabase
      .from("products")
      .update({ status: newStatus })
      .eq("id", product.id);
 
    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success(newStatus === "active" ? "Product published" : "Product moved to drafts");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products-weekly-edit"] });
      queryClient.invalidateQueries({ queryKey: ["category-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-active"] });
    }
  };

  const handleToggleWeeklyEdit = async (product: Product) => {
    const newValue = !product.in_weekly_edit;
    const { error } = await supabase
      .from("products")
      .update({ in_weekly_edit: newValue })
      .eq("id", product.id);
 
    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      await syncPublishedWeeklyEditMembership(product.id, newValue);
      toast.success(newValue ? "Added to This Week's Edit" : "Removed from This Week's Edit");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
      queryClient.invalidateQueries({ queryKey: ["products-weekly-edit"] });
      queryClient.invalidateQueries({ queryKey: ["category-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-active"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edit-products"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-edits-all"] });
    }
  };

   // Filter products based on status, search, brand, category
  const filteredProducts = products?.filter((p) => {
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "active" ? !isPublishedStatus(p.status) : p.status !== statusFilter) return false;
    }
    // Brand filter
    if (brandFilter !== "all" && p.brand !== brandFilter) return false;
    // Category filter
    if (categoryFilter !== "all") {
      if (categoryFilter === "none" ? p.category_id != null : p.category_id !== categoryFilter) return false;
    }
    // Search query
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase();
      const searchable = `${p.brand} ${p.name} ${p.name_en || ""}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  })?.sort((a, b) => {
    switch (productSortBy) {
      case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "brand": return a.brand.localeCompare(b.brand);
      case "price": {
        const pa = parseFloat(String(a.price).replace(/[^0-9.]/g, "")) || 0;
        const pb = parseFloat(String(b.price).replace(/[^0-9.]/g, "")) || 0;
        return pa - pb;
      }
      default: return 0; // keep existing sort_order from useAllProducts
    }
  });

  // Unique brands for filter dropdown
  const uniqueBrands = Array.from(new Set(products?.map((p) => p.brand) || [])).sort();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !products) return;

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update the UI
    const reorderedProducts = arrayMove(products, oldIndex, newIndex);
    queryClient.setQueryData(["products-all"], reorderedProducts);

    // Update sort_order for all affected products
    const updates = reorderedProducts.map((product, index) => ({
      id: product.id,
      sort_order: index,
    }));

    // Batch update in database
    for (const update of updates) {
      const { error } = await supabase
        .from("products")
        .update({ sort_order: update.sort_order })
        .eq("id", update.id);

      if (error) {
        toast.error("Failed to save order: " + error.message);
        queryClient.invalidateQueries({ queryKey: ["products-all"] });
        return;
      }
    }

    // Also invalidate the active products query
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["category-products"] });
    toast.success("Order saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16 px-5 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-light text-primary mb-2">
            Admin Portal
          </h1>
          <p className="text-muted-foreground font-body text-sm mb-10">
            Manage your content
          </p>

          <Tabs defaultValue="statistics" className="w-full">
             <TabsList className="grid w-full grid-cols-7 mb-8">
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
              <TabsTrigger value="imports">Imports</TabsTrigger>
              <TabsTrigger value="weekly-edits">Edits</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="stories">Stories</TabsTrigger>
              <TabsTrigger value="intake-test">Intake (test)</TabsTrigger>
            </TabsList>

            {/* STATISTICS TAB */}
            <TabsContent value="statistics">
              <AnalyticsDashboard />
            </TabsContent>

            {/* IMPORTS TAB (AIS) */}
            <TabsContent value="imports">
              <ImportsTab />
            </TabsContent>

            {/* WEEKLY EDITS TAB */}
            <TabsContent value="weekly-edits">
              <WeeklyEditsTab />
            </TabsContent>

            {/* CATEGORIES TAB */}
            <TabsContent value="categories" className="space-y-10">
              <form onSubmit={handleSaveCategory} className="space-y-5 p-6 border border-border rounded-sm bg-card">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-primary">
                    {editingCategoryId ? "Edit Category" : "Add New Category"}
                  </h2>
                  {editingCategoryId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetCategoryForm}
                      className="text-muted-foreground"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryName">Name *</Label>
                    <Input 
                      id="categoryName" 
                      value={categoryName} 
                      onChange={(e) => handleCategoryNameChange(e.target.value)} 
                      placeholder="e.g. Coats & Jackets" 
                      className="bg-background border-border" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categorySlug">Slug *</Label>
                    <Input 
                      id="categorySlug" 
                      value={categorySlug} 
                      onChange={(e) => setCategorySlug(e.target.value)} 
                      placeholder="coats-jackets" 
                      className="bg-background border-border" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryStatus">Status</Label>
                  <Select value={categoryStatus} onValueChange={(v) => setCategoryStatus(v as CategoryStatus)}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryDescription">Description</Label>
                  <Textarea 
                    id="categoryDescription" 
                    value={categoryDescription} 
                    onChange={(e) => setCategoryDescription(e.target.value)} 
                    placeholder="Category description..." 
                    className="bg-background border-border min-h-[80px]" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categorySeoTitle">SEO Title (optional)</Label>
                    <Input 
                      id="categorySeoTitle" 
                      value={categorySeoTitle} 
                      onChange={(e) => setCategorySeoTitle(e.target.value)} 
                      placeholder="Custom page title for search engines" 
                      className="bg-background border-border" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categorySeoDescription">SEO Description (optional)</Label>
                    <Input 
                      id="categorySeoDescription" 
                      value={categorySeoDescription} 
                      onChange={(e) => setCategorySeoDescription(e.target.value)} 
                      placeholder="Meta description for search engines" 
                      className="bg-background border-border" 
                    />
                  </div>
                </div>

                <Button type="submit" disabled={savingCategory} className="w-full">
                  {savingCategory ? "Saving..." : editingCategoryId ? "Update Category" : "Save Category"}
                </Button>
              </form>

              {/* Categories List */}
              <div>
                <h2 className="font-display text-lg text-primary mb-6">Existing Categories ({categories?.length || 0})</h2>
                {categoriesLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : categories && categories.length > 0 ? (
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div 
                        key={category.id} 
                        className={`flex items-center justify-between p-4 border rounded-sm bg-card cursor-pointer transition-colors ${
                          editingCategoryId === category.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleEditCategory(category)}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-medium text-primary truncate">{category.name}</h3>
                              {getCategoryStatusBadge(category.status)}
                            </div>
                            <p className="text-muted-foreground text-sm truncate">/{category.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCategoryPublish(category);
                            }}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title={category.status === "published" ? "Unpublish (move to draft)" : "Publish"}
                          >
                            {category.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCategory(category);
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
                              handleDeleteCategory(category.id, category.name);
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
                  <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">No categories yet.</p>
                )}
              </div>
            </TabsContent>

            {/* TRADERA TAB — deprecated, hidden from nav */}

            {/* PRODUCTS TAB */}
            <TabsContent value="products" className="space-y-10">
              <form onSubmit={handleSaveProduct} className="space-y-5 p-6 border border-border rounded-sm bg-card">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-primary">
                    {editingProductId ? "Edit Product" : "Add New Product"}
                  </h2>
                  {editingProductId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetProductForm}
                      className="text-muted-foreground"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productBrand">Brand *</Label>
                    <Input id="productBrand" value={productBrand} onChange={(e) => setProductBrand(e.target.value)} placeholder="e.g. See by Chloé" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productName">Name *</Label>
                    <Input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Trenchcoat" className="bg-background border-border" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productPrice">Price *</Label>
                    <Input id="productPrice" type="text" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="250 SEK" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productSize">Size</Label>
                    <Input id="productSize" type="text" value={productSize} onChange={(e) => setProductSize(e.target.value)} placeholder="e.g. M, 38, One size" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productStatus">Status</Label>
                    <Select value={productStatus} onValueChange={(v) => setProductStatus(v as ProductStatus)}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Published</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Images *</Label>
                  <StorageImagePicker images={productImages} onImagesChange={setProductImages} bucket="products" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productDescription">Description</Label>
                  <Textarea id="productDescription" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Product description..." className="bg-background border-border min-h-[80px]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productCondition">Condition</Label>
                    <Input id="productCondition" value={productCondition} onChange={(e) => setProductCondition(e.target.value)} placeholder="e.g. Good, Excellent" className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productMaterial">Material</Label>
                    <Input id="productMaterial" value={productMaterial} onChange={(e) => setProductMaterial(e.target.value)} placeholder="e.g. Cotton, Leather" className="bg-background border-border" />
                  </div>
                 <div className="space-y-2">
                   <Label htmlFor="productColor">Color</Label>
                   <Input id="productColor" value={productColor} onChange={(e) => setProductColor(e.target.value)} placeholder="e.g. Black, Beige, Navy" className="bg-background border-border" />
                 </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productAffiliateUrl">Affiliate URL</Label>
                    <Input id="productAffiliateUrl" value={productAffiliateUrl} onChange={(e) => setProductAffiliateUrl(e.target.value)} placeholder="https://..." className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productMarketplace">Marketplace</Label>
                    <Input id="productMarketplace" value={productMarketplace} onChange={(e) => setProductMarketplace(e.target.value)} placeholder="e.g. Vestiaire, Sellpy" className="bg-background border-border" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productCategory">Category</Label>
                    <Select 
                      value={productCategoryId || "none"} 
                      onValueChange={(v) => {
                        const newCatId = v === "none" ? null : v;
                        setProductCategoryId(newCatId);
                        // Reset subcategory when category changes away from Clothing
                        const selectedCat = categories?.find(c => c.id === newCatId);
                        if (!selectedCat || selectedCat.slug !== "clothing") {
                          setProductSubcategory(null);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name} {cat.status === "draft" && "(Draft)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {categories?.find(c => c.id === productCategoryId)?.slug === "clothing" ? (
                    <div className="space-y-2" key="subcategory-field">
                      <Label htmlFor="productSubcategory">Subcategory *</Label>
                      <Select
                        key={`subcat-${productSubcategory}`}
                        value={productSubcategory || "none"}
                        onValueChange={(v) => setProductSubcategory(v === "none" ? null : v)}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No subcategory</SelectItem>
                          {CLOTHING_SUBCATEGORIES.map((sub) => (
                            <SelectItem key={sub.value} value={sub.value}>
                              {sub.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2" key="ancora-source-field">
                      <Label htmlFor="productAncoraSelectSource">Ancora selects from</Label>
                      <Select 
                        value={productAncoraSelectSource || "none"} 
                        onValueChange={(v) => setProductAncoraSelectSource(v === "none" ? null : v as AncoraSelectSource)}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="tradera">Tradera</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* This Week's Edit Toggle */}
                <div className="flex items-center justify-between p-4 border border-border rounded-sm bg-secondary/20">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Include in This Week's Edit
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Products in the edit appear on the homepage
                    </p>
                  </div>
                  <Switch
                    id="productInWeeklyEdit"
                    checked={productInWeeklyEdit}
                    onCheckedChange={(checked) => setProductInWeeklyEdit(checked)}
                  />
                </div>

                {/* Affiliate Auto-Handling Toggle */}
                {productAffiliateUrl && (
                  <div className="flex items-center justify-between p-4 border border-border rounded-sm bg-secondary/20">
                    <div className="space-y-0.5">
                      <Label htmlFor="productAffiliateAutoHandling" className="text-base font-medium">
                        Auto-unpublish when sold
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically mark as sold when affiliate link becomes unavailable
                      </p>
                    </div>
                    <Switch
                      id="productAffiliateAutoHandling"
                      checked={productAffiliateAutoHandling}
                      onCheckedChange={setProductAffiliateAutoHandling}
                    />
                </div>
                )}

                {/* Recheck Availability Button */}
                {editingProductId && productAffiliateUrl && (
                  <div className="flex items-center justify-between p-4 border border-border rounded-sm bg-secondary/20">
                    <div className="space-y-0.5">
                      <p className="text-base font-medium">Check Availability</p>
                      <p className="text-sm text-muted-foreground">
                        Verify if this listing is still active on the source marketplace
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isRecheckingProduct}
                      onClick={async () => {
                        setIsRecheckingProduct(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('recheck-product', {
                            body: { product_id: editingProductId },
                          });
                          if (error) {
                            toast.error('Recheck failed: ' + error.message);
                            return;
                          }
                          if (data.error) {
                            toast.error(data.error);
                            return;
                          }
                          if (data.auto_unpublished) {
                            toast.success(`Marked sold — ${data.reason}`);
                            setProductStatus("sold");
                          } else if (data.auto_review_flagged) {
                            toast.info(`Flagged for review — ${data.reason}`);
                            setProductStatus("review_required");
                          } else {
                            toast.info(`Still ${data.affiliate_status} — ${data.reason}`);
                          }
                          queryClient.invalidateQueries({ queryKey: ["products"] });
                          queryClient.invalidateQueries({ queryKey: ["products-all"] });
                        } catch (e: any) {
                          toast.error('Recheck failed');
                        } finally {
                          setIsRecheckingProduct(false);
                        }
                      }}
                    >
                      {isRecheckingProduct ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking…</>
                      ) : (
                        <><Search className="w-4 h-4 mr-2" />Recheck Now</>
                      )}
                    </Button>
                  </div>
                )}

                <Button type="submit" disabled={savingProduct} className="w-full">
                  {savingProduct ? "Saving..." : editingProductId ? "Update Product" : "Save Product"}
                </Button>
              </form>

              {/* Products List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-lg text-primary">
                    Existing Products ({filteredProducts?.length || 0}{statusFilter !== "all" ? ` ${statusFilter}` : ""})
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRunningScan}
                    onClick={async () => {
                      setIsRunningScan(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('recheck-product', {
                          body: { scan_all: true },
                        });
                        if (error) { toast.error('Scan failed: ' + error.message); return; }
                        if (data.error) { toast.error(data.error); return; }
                        toast.success(`Scan complete: ${data.total_checked} checked, ${data.sold_marked} marked sold, ${data.review_flagged} flagged for review`);
                        queryClient.invalidateQueries({ queryKey: ["products"] });
                        queryClient.invalidateQueries({ queryKey: ["products-all"] });
                        queryClient.invalidateQueries({ queryKey: ["products-sold"] });
                      } catch { toast.error('Scan failed'); } finally { setIsRunningScan(false); }
                    }}
                  >
                    {isRunningScan ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Scanning…</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" />Scan All</>
                    )}
                  </Button>
                </div>

                {/* Search & Filters Bar */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search brand or title…"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="pl-8 bg-background border-border"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-[140px] bg-background border-border">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="draft">Drafts</SelectItem>
                      <SelectItem value="active">Published</SelectItem>
                      <SelectItem value="review_required">Review</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="w-[160px] bg-background border-border">
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All brands</SelectItem>
                      {uniqueBrands.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px] bg-background border-border">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={productSortBy} onValueChange={(v) => setProductSortBy(v as any)}>
                    <SelectTrigger className="w-[130px] bg-background border-border">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="brand">Brand A–Z</SelectItem>
                      <SelectItem value="price">Price ↑</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-sm mb-6">Drag products to reorder. Order is saved automatically.</p>
                {productsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : filteredProducts && filteredProducts.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={filteredProducts.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {filteredProducts.map((product) => (
                          <SortableProductItem
                            key={product.id}
                            product={product as Product}
                            editingProductId={editingProductId}
                            onEdit={handleEditProduct}
                            onDelete={handleDeleteProduct}
                            onTogglePublish={handleTogglePublish}
                            onToggleWeeklyEdit={handleToggleWeeklyEdit}
                            isRechecking={recheckingProductId === product.id}
                            onRecheck={async (p) => {
                              setRecheckingProductId(p.id);
                              try {
                                const { data, error } = await supabase.functions.invoke('recheck-product', {
                                  body: { product_id: p.id },
                                });
                                if (error) { toast.error('Recheck failed'); return; }
                                if (data.error) { toast.error(data.error); return; }
                                if (data.auto_unpublished) {
                                  toast.success(`${p.brand} - ${p.name}: marked sold — ${data.reason}`);
                                } else if (data.auto_review_flagged) {
                                  toast.info(`${p.brand} - ${p.name}: flagged for review — ${data.reason}`);
                                } else {
                                  toast.info(`${p.brand} - ${p.name}: ${data.affiliate_status}`);
                                }
                                queryClient.invalidateQueries({ queryKey: ["products-all"] });
                                queryClient.invalidateQueries({ queryKey: ["products"] });
                              } catch { toast.error('Recheck failed'); } finally { setRecheckingProductId(null); }
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">
                    {productSearchQuery || brandFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all"
                      ? "No products match your search."
                      : "No products yet."}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* SOLD ARCHIVE TAB */}
            <TabsContent value="sold" className="space-y-6">
              <div className="p-4 border border-border rounded-sm bg-card">
                <h2 className="font-display text-lg text-primary mb-2">Sold Archive</h2>
                <p className="text-muted-foreground text-sm">
                  Historical record of sold products for reference and affiliate analysis.
                </p>
              </div>

              <div>
                <h2 className="font-display text-lg text-primary mb-6">
                  Sold Products ({soldProducts?.length || 0})
                </h2>
                {soldProductsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-muted rounded-sm animate-pulse" />
                    ))}
                  </div>
                ) : soldProducts && soldProducts.length > 0 ? (
                  <div className="space-y-3">
                    {soldProducts.map((product) => (
                      <div
                        key={product.id}
                        className={`flex items-center justify-between p-4 border rounded-sm bg-card cursor-pointer transition-colors ${
                          editingProductId === product.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleEditProduct(product as Product)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {product.image && (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-sm flex-shrink-0 opacity-75"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-medium text-primary truncate">
                                {product.brand} - {product.name}
                              </h3>
                              <Badge variant="outline">Sold</Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {product.price}
                              {product.size && ` · Size: ${product.size}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProduct(product as Product);
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
                              handleDeleteProduct(product.id, product.name);
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
                    No sold products yet.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* STORIES TAB */}
            <TabsContent value="stories" className="space-y-10">
              <form onSubmit={handleSaveStory} className="space-y-5 p-6 border border-border rounded-sm bg-card">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-primary">
                    {editingStoryId ? "Edit Story" : "Add New Story"}
                  </h2>
                  {editingStoryId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetStoryForm}
                      className="text-muted-foreground"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="storyTitle">Title *</Label>
                  <Input id="storyTitle" value={storyTitle} onChange={(e) => handleStoryTitleChange(e.target.value)} placeholder="e.g. Care Guide: Show Your Loafers Some Love" className="bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storySlug">Slug</Label>
                  <Input id="storySlug" value={storySlug} onChange={(e) => setStorySlug(e.target.value)} placeholder="auto-generated-from-title" className="bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label>Image *</Label>
                  <StorageImagePicker 
                    images={storyImage} 
                    onImagesChange={setStoryImage} 
                    bucket="guide-images" 
                    singleImage={true}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storyAuthor">Byline (optional)</Label>
                  <Select value={storyAuthor} onValueChange={setStoryAuthor}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select author (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No byline</SelectItem>
                      <SelectItem value="Carin Roeraade">Carin Roeraade</SelectItem>
                      <SelectItem value="Sophie Gill">Sophie Gill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storyIntroText">Intro Text *</Label>
                  <Textarea id="storyIntroText" value={storyIntroText} onChange={(e) => setStoryIntroText(e.target.value)} placeholder="A short introduction to the story..." className="bg-background border-border min-h-[80px]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storyBody">Body *</Label>
                  <div className="flex gap-1 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const textarea = document.getElementById("storyBody") as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = storyBody;
                          const selectedText = text.substring(start, end);
                          const newText = text.substring(0, start) + "**" + selectedText + "**" + text.substring(end);
                          setStoryBody(newText);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + 2, end + 2);
                          }, 0);
                        }
                      }}
                      className="gap-1"
                    >
                      <Bold className="w-4 h-4" />
                      Bold
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const textarea = document.getElementById("storyBody") as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = storyBody;
                          const selectedText = text.substring(start, end);
                          const newText = text.substring(0, start) + "*" + selectedText + "*" + text.substring(end);
                          setStoryBody(newText);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + 1, end + 1);
                          }, 0);
                        }
                      }}
                      className="gap-1"
                    >
                      <Italic className="w-4 h-4" />
                      Italic
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowInlineImagePicker(true);
                      }}
                      className="gap-1"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Insert Image
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Use **text** for bold, *text* for italic, and ![caption](url) for images
                  </p>
                  <Textarea id="storyBody" value={storyBody} onChange={(e) => setStoryBody(e.target.value)} placeholder="The full story content..." className="bg-background border-border min-h-[200px] font-mono text-sm" />
                </div>

                <div className="flex gap-3">
                  {editingStoryId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(`/stories/preview/${editingStoryId}`, '_blank')}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                  )}
                  <Button type="submit" disabled={savingStory} className="flex-1">
                    {savingStory ? "Saving..." : editingStoryId ? "Update Story" : "Save Story"}
                  </Button>
                </div>
              </form>

              {/* Inline Image Picker Dialog */}
              <Dialog open={showInlineImagePicker} onOpenChange={setShowInlineImagePicker}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Insert Image in Article</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Image</Label>
                      <StorageImagePicker 
                        images={selectedInlineImage} 
                        onImagesChange={setSelectedInlineImage} 
                        bucket="guide-images" 
                        singleImage={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inlineCaption">Caption (optional)</Label>
                      <Input 
                        id="inlineCaption" 
                        value={inlineImageCaption} 
                        onChange={(e) => setInlineImageCaption(e.target.value)} 
                        placeholder="Describe the image..."
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowInlineImagePicker(false);
                          setSelectedInlineImage([]);
                          setInlineImageCaption("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="button" 
                        disabled={selectedInlineImage.length === 0}
                        onClick={() => {
                          if (selectedInlineImage.length > 0) {
                            const textarea = document.getElementById("storyBody") as HTMLTextAreaElement;
                            const imageMarkdown = `![${inlineImageCaption}](${selectedInlineImage[0]})`;
                            
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const text = storyBody;
                              // Insert on a new line for better formatting
                              const before = text.substring(0, start);
                              const after = text.substring(start);
                              const needsNewlineBefore = before.length > 0 && !before.endsWith('\n');
                              const needsNewlineAfter = after.length > 0 && !after.startsWith('\n');
                              const newText = before + (needsNewlineBefore ? '\n\n' : '') + imageMarkdown + (needsNewlineAfter ? '\n\n' : '') + after;
                              setStoryBody(newText);
                            } else {
                              // Fallback: append to end
                              setStoryBody(storyBody + '\n\n' + imageMarkdown + '\n\n');
                            }
                            
                            setShowInlineImagePicker(false);
                            setSelectedInlineImage([]);
                            setInlineImageCaption("");
                            toast.success("Image inserted");
                          }
                        }}
                      >
                        Insert Image
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Stories List */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-lg text-primary">Stories ({filteredStories?.length || 0})</h2>
                  <div className="flex gap-2">
                    {(["draft", "published", "archived", "all"] as const).map((f) => (
                      <Button
                        key={f}
                        variant={storyStatusFilter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStoryStatusFilter(f)}
                        className="capitalize"
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
                {storiesLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : filteredStories && filteredStories.length > 0 ? (
                  <div className="space-y-3">
                    {filteredStories.map((story: any) => (
                      <div 
                        key={story.id} 
                        className={`flex items-center justify-between p-4 border rounded-sm bg-card cursor-pointer transition-colors ${
                          editingStoryId === story.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => handleEditStory(story)}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {story.image && (
                            <img src={story.image} alt={story.title} className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-medium text-primary truncate">{story.title}</h3>
                              {story.status === "published" && <Badge>Published</Badge>}
                              {story.status === "draft" && <Badge variant="secondary">Draft</Badge>}
                              {story.status === "archived" && <Badge variant="outline">Archived</Badge>}
                            </div>
                            <p className="text-muted-foreground text-sm truncate">{story.intro_text}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {story.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublishStory(story);
                              }}
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Publish"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {story.status === "published" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnpublishStory(story.id);
                              }}
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Unpublish"
                            >
                              <EyeOff className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditStory(story);
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
                              handleDeleteStory(story.id, story.title);
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
                    {storyStatusFilter === "all" ? "No stories yet." : `No ${storyStatusFilter} stories.`}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="intake-test">
              <IntakeTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminPortal;