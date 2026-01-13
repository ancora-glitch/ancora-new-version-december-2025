import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStyleGuides } from "@/hooks/useStyleGuides";
import { useAllProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Pencil, X, GripVertical } from "lucide-react";
import { StorageImagePicker } from "@/components/StorageImagePicker";
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

interface Product {
  id: string;
  brand: string;
  name: string;
  price: string;
  image: string;
  additional_images?: string[];
  description?: string | null;
  affiliate_url?: string | null;
  marketplace?: string | null;
  condition?: string | null;
  material?: string | null;
  size?: string | null;
  status: "active" | "sold";
  slug?: string | null;
  sort_order?: number | null;
}

// Sortable Product Item Component
interface SortableProductItemProps {
  product: Product;
  editingProductId: string | null;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
}

const SortableProductItem = ({ product, editingProductId, onEdit, onDelete }: SortableProductItemProps) => {
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
        <div className="min-w-0">
          <h3 className="font-medium text-primary truncate">{product.brand} - {product.name}</h3>
          <p className="text-muted-foreground text-sm">
            {product.price} · {product.status}
            {product.size && ` · Size: ${product.size}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
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
  const { data: stories, isLoading: storiesLoading } = useStyleGuides();
  const { data: products, isLoading: productsLoading } = useAllProducts();
  const queryClient = useQueryClient();

  // Story form state
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyImage, setStoryImage] = useState<string[]>([]);
  const [storyIntroText, setStoryIntroText] = useState("");
  const [storyBody, setStoryBody] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [savingStory, setSavingStory] = useState(false);

  // Product form state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productBrand, setProductBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productSize, setProductSize] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productDescription, setProductDescription] = useState("");
  const [productAffiliateUrl, setProductAffiliateUrl] = useState("");
  const [productMarketplace, setProductMarketplace] = useState("");
  const [productCondition, setProductCondition] = useState("");
  const [productMaterial, setProductMaterial] = useState("");
  const [productStatus, setProductStatus] = useState<"active" | "sold">("active");
  const [savingProduct, setSavingProduct] = useState(false);

  // Auto-generate slug from title (only when creating new story)
  const handleStoryTitleChange = (value: string) => {
    setStoryTitle(value);
    if (!editingStoryId) {
      const slug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      setStorySlug(slug);
    }
  };

  const resetStoryForm = () => {
    setEditingStoryId(null);
    setStoryTitle("");
    setStoryImage([]);
    setStoryIntroText("");
    setStoryBody("");
    setStorySlug("");
  };

  const handleEditStory = (story: { id: string; title: string; image: string; intro_text: string; body: string; slug: string }) => {
    setEditingStoryId(story.id);
    setStoryTitle(story.title);
    setStoryImage([story.image]);
    setStoryIntroText(story.intro_text);
    setStoryBody(story.body);
    setStorySlug(story.slug);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductBrand("");
    setProductName("");
    setProductPrice("");
    setProductSize("");
    setProductImages([]);
    setProductDescription("");
    setProductAffiliateUrl("");
    setProductMarketplace("");
    setProductCondition("");
    setProductMaterial("");
    setProductStatus("active");
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductBrand(product.brand);
    setProductName(product.name);
    setProductPrice(product.price);
    setProductSize(product.size || "");
    const allImages = [product.image, ...(product.additional_images || [])];
    setProductImages(allImages);
    setProductDescription(product.description || "");
    setProductAffiliateUrl(product.affiliate_url || "");
    setProductMarketplace(product.marketplace || "");
    setProductCondition(product.condition || "");
    setProductMaterial(product.material || "");
    setProductStatus(product.status);
    
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
    }
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
    
    const productData = {
      brand: productBrand.trim(),
      name: productName.trim(),
      price: productPrice.trim(),
      size: productSize.trim() || null,
      image: mainImage,
      additional_images: additionalImages,
      description: productDescription.trim() || null,
      affiliate_url: productAffiliateUrl.trim() || null,
      marketplace: productMarketplace.trim() || null,
      condition: productCondition.trim() || null,
      material: productMaterial.trim() || null,
      status: productStatus,
      slug,
    };

    let error;
    
    if (editingProductId) {
      // Update existing product
      const result = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProductId);
      error = result.error;
    } else {
      // Insert new product
      const result = await supabase.from("products").insert([productData]);
      error = result.error;
    }
    
    if (error) {
      toast.error(`Failed to ${editingProductId ? 'update' : 'save'} product: ` + error.message);
    } else {
      toast.success(editingProductId ? "Product updated" : "Product saved");
      resetProductForm();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
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
    }
  };

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

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="stories">Stories</TabsTrigger>
            </TabsList>

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
                    <Select value={productStatus} onValueChange={(v) => setProductStatus(v as "active" | "sold")}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
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

                <Button type="submit" disabled={savingProduct} className="w-full">
                  {savingProduct ? "Saving..." : editingProductId ? "Update Product" : "Save Product"}
                </Button>
              </form>

              {/* Products List */}
              <div>
                <h2 className="font-display text-lg text-primary mb-2">Existing Products ({products?.length || 0})</h2>
                <p className="text-muted-foreground text-sm mb-6">Drag products to reorder. Order is saved automatically.</p>
                {productsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : products && products.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={products.map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {products.map((product) => (
                          <SortableProductItem
                            key={product.id}
                            product={product as Product}
                            editingProductId={editingProductId}
                            onEdit={handleEditProduct}
                            onDelete={handleDeleteProduct}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">No products yet.</p>
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
                  <Label htmlFor="storyIntroText">Intro Text *</Label>
                  <Textarea id="storyIntroText" value={storyIntroText} onChange={(e) => setStoryIntroText(e.target.value)} placeholder="A short introduction to the story..." className="bg-background border-border min-h-[80px]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storyBody">Body *</Label>
                  <Textarea id="storyBody" value={storyBody} onChange={(e) => setStoryBody(e.target.value)} placeholder="The full story content..." className="bg-background border-border min-h-[200px]" />
                </div>

                <Button type="submit" disabled={savingStory} className="w-full">
                  {savingStory ? "Saving..." : editingStoryId ? "Update Story" : "Save Story"}
                </Button>
              </form>

              {/* Stories List */}
              <div>
                <h2 className="font-display text-lg text-primary mb-6">Existing Stories ({stories?.length || 0})</h2>
                {storiesLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : stories && stories.length > 0 ? (
                  <div className="space-y-3">
                    {stories.map((story) => (
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
                            <h3 className="font-medium text-primary truncate">{story.title}</h3>
                            <p className="text-muted-foreground text-sm truncate">{story.intro_text}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                  <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">No stories yet.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminPortal;