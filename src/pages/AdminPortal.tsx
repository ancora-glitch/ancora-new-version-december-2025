import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/useProjects";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const AdminPortal = () => {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: products, isLoading: productsLoading } = useProducts();
  const queryClient = useQueryClient();

  // Project form state
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectImageUrl, setProjectImageUrl] = useState("");
  const [projectVideoUrl, setProjectVideoUrl] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Product form state
  const [productBrand, setProductBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productImage, setProductImage] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productAffiliateUrl, setProductAffiliateUrl] = useState("");
  const [productMarketplace, setProductMarketplace] = useState("");
  const [productCondition, setProductCondition] = useState("");
  const [productMaterial, setProductMaterial] = useState("");
  const [productStatus, setProductStatus] = useState<"active" | "sold">("active");
  const [savingProduct, setSavingProduct] = useState(false);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) {
      toast.error("Project title is required");
      return;
    }
    setSavingProject(true);
    const { error } = await supabase.from("projects").insert({
      title: projectTitle.trim(),
      description: projectDescription.trim() || null,
      image_url: projectImageUrl.trim() || null,
      video_link: projectVideoUrl.trim() || null,
    });
    if (error) {
      toast.error("Failed to save project: " + error.message);
    } else {
      toast.success("Project saved");
      setProjectTitle("");
      setProjectDescription("");
      setProjectImageUrl("");
      setProjectVideoUrl("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
    setSavingProject(false);
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productBrand.trim() || !productName.trim() || !productPrice) {
      toast.error("Brand, name and price are required");
      return;
    }
    setSavingProduct(true);
    
    const slug = `${productBrand}-${productName}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    
    const { error } = await supabase.from("products").insert([{
      brand: productBrand.trim(),
      name: productName.trim(),
      price: parseFloat(productPrice),
      image: productImage.trim(),
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
      setProductImage("");
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
              <TabsTrigger value="projects">Projects</TabsTrigger>
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
                    <Input id="productPrice" type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="250" className="bg-background border-border" />
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
                  <Label htmlFor="productImage">Image URL *</Label>
                  <Input id="productImage" value={productImage} onChange={(e) => setProductImage(e.target.value)} placeholder="https://..." className="bg-background border-border" />
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

            {/* PROJECTS TAB */}
            <TabsContent value="projects" className="space-y-10">
              <form onSubmit={handleSaveProject} className="space-y-5 p-6 border border-border rounded-sm bg-card">
                <h2 className="font-display text-lg text-primary mb-4">Add New Project</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="projectTitle">Project Title *</Label>
                  <Input id="projectTitle" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="Enter project title" className="bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectDescription">Description</Label>
                  <Textarea id="projectDescription" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Enter project description" className="bg-background border-border min-h-[100px]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectImageUrl">Image URL</Label>
                  <Input id="projectImageUrl" value={projectImageUrl} onChange={(e) => setProjectImageUrl(e.target.value)} placeholder="https://..." className="bg-background border-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectVideoUrl">Video URL</Label>
                  <Input id="projectVideoUrl" value={projectVideoUrl} onChange={(e) => setProjectVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className="bg-background border-border" />
                </div>

                <Button type="submit" disabled={savingProject} className="w-full">
                  {savingProject ? "Saving..." : "Save Project"}
                </Button>
              </form>

              {/* Projects List */}
              <div>
                <h2 className="font-display text-lg text-primary mb-6">Existing Projects ({projects?.length || 0})</h2>
                {projectsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />)}</div>
                ) : projects && projects.length > 0 ? (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-4 border border-border rounded-sm bg-card">
                        <div className="flex items-center gap-4 min-w-0">
                          {project.image_url && (
                            <img src={project.image_url} alt={project.title} className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h3 className="font-medium text-primary truncate">{project.title}</h3>
                            {project.description && <p className="text-muted-foreground text-sm truncate">{project.description}</p>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id, project.title)} className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">No projects yet.</p>
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
