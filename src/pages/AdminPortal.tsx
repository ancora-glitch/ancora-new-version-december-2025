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
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";

const AdminPortal = () => {
  const { data: stories, isLoading: storiesLoading } = useStyleGuides();
  const { data: products, isLoading: productsLoading } = useProducts();
  const queryClient = useQueryClient();

  // Story form state
  const [storyTitle, setStoryTitle] = useState("");
  const [storyImage, setStoryImage] = useState("");
  const [storyIntroText, setStoryIntroText] = useState("");
  const [storyBody, setStoryBody] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [savingStory, setSavingStory] = useState(false);

  // Product form state
  const [productBrand, setProductBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productDescription, setProductDescription] = useState("");
  const [productAffiliateUrl, setProductAffiliateUrl] = useState("");
  const [productMarketplace, setProductMarketplace] = useState("");
  const [productCondition, setProductCondition] = useState("");
  const [productMaterial, setProductMaterial] = useState("");
  const [productStatus, setProductStatus] = useState<"active" | "sold">("active");
  const [savingProduct, setSavingProduct] = useState(false);

  // Auto-generate slug from title
  const handleStoryTitleChange = (value: string) => {
    setStoryTitle(value);
    const slug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setStorySlug(slug);
  };

  const handleSaveStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyTitle.trim() || !storyImage.trim() || !storyIntroText.trim() || !storyBody.trim()) {
      toast.error("Title, image, intro text and body are required");
      return;
    }
    setSavingStory(true);
    
    const { error } = await supabase.from("style_guides").insert([{
      title: storyTitle.trim(),
      image: storyImage.trim(),
      intro_text: storyIntroText.trim(),
      body: storyBody.trim(),
      slug: storySlug.trim() || storyTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    }]);
    
    if (error) {
      toast.error("Failed to save story: " + error.message);
    } else {
      toast.success("Story saved");
      setStoryTitle("");
      setStoryImage("");
      setStoryIntroText("");
      setStoryBody("");
      setStorySlug("");
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
    
    const { error } = await supabase.from("products").insert([{
      brand: productBrand.trim(),
      name: productName.trim(),
      price: productPrice.trim(),
      image: mainImage,
      additional_images: additionalImages,
      description: productDescription.trim() || null,
      affiliate_url: productAffiliateUrl.trim() || null,
      marketplace: productMarketplace.trim() || null,
      condition: productCondition.trim() || null,
      material: productMaterial.trim() || null,
      status: productStatus,
      slug,
    }]);
    
    if (error) {
      toast.error("Failed to save product: " + error.message);
    } else {
      toast.success("Product saved");
      setProductBrand("");
      setProductName("");
      setProductPrice("");
      setProductImages([]);
      setProductDescription("");
      setProductAffiliateUrl("");
      setProductMarketplace("");
      setProductCondition("");
      setProductMaterial("");
      setProductStatus("active");
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
      queryClient.invalidateQueries({ queryKey: ["products"] });
    }
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
                <h2 className="font-display text-lg text-primary mb-4">Add New Product</h2>
                
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productPrice">Price *</Label>
                    <Input id="productPrice" type="text" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="250 SEK" className="bg-background border-border" />
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
                  <ImageUploader images={productImages} onImagesChange={setProductImages} bucket="products" />
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
                  {savingProduct ? "Saving..." : "Save Product"}
                </Button>
              </form>

              {/* Products List */}
              <div>
                <h2 className="font-display text-lg text-primary mb-6">Existing Products ({products?.length || 0})</h2>
                {productsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : products && products.length > 0 ? (
                  <div className="space-y-3">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-4 border border-border rounded-sm bg-card">
                        <div className="flex items-center gap-4 min-w-0">
                          {product.image && (
                            <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h3 className="font-medium text-primary truncate">{product.brand} - {product.name}</h3>
                            <p className="text-muted-foreground text-sm">{product.price} SEK · {product.status}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id, product.name)} className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">No products yet.</p>
                )}
              </div>
            </TabsContent>

            {/* STORIES TAB */}
            <TabsContent value="stories" className="space-y-10">
              <form onSubmit={handleSaveStory} className="space-y-5 p-6 border border-border rounded-sm bg-card">
                <h2 className="font-display text-lg text-primary mb-4">Add New Story</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="storyTitle">Title *</Label>
                  <Input id="storyTitle" value={storyTitle} onChange={(e) => handleStoryTitleChange(e.target.value)} placeholder="e.g. Care Guide: Show Your Loafers Some Love" className="bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storySlug">Slug</Label>
                  <Input id="storySlug" value={storySlug} onChange={(e) => setStorySlug(e.target.value)} placeholder="auto-generated-from-title" className="bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storyImage">Image URL *</Label>
                  <Input id="storyImage" value={storyImage} onChange={(e) => setStoryImage(e.target.value)} placeholder="https://..." className="bg-background border-border" />
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
                  {savingStory ? "Saving..." : "Save Story"}
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
                      <div key={story.id} className="flex items-center justify-between p-4 border border-border rounded-sm bg-card">
                        <div className="flex items-center gap-4 min-w-0">
                          {story.image && (
                            <img src={story.image} alt={story.title} className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h3 className="font-medium text-primary truncate">{story.title}</h3>
                            <p className="text-muted-foreground text-sm truncate">{story.intro_text}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteStory(story.id, story.title)} className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
