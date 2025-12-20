import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const AdminPortal = () => {
  const { data: projects, isLoading } = useProjects();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setSaving(true);
    
    const { error } = await supabase.from("projects").insert({
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      video_link: videoUrl.trim() || null,
    });

    if (error) {
      toast.error("Failed to save project: " + error.message);
    } else {
      toast.success("Project saved successfully");
      setTitle("");
      setDescription("");
      setImageUrl("");
      setVideoUrl("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
    
    setSaving(false);
  };

  const handleDelete = async (id: string, projectTitle: string) => {
    const confirmed = window.confirm(`Delete "${projectTitle}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("projects").delete().eq("id", id);
    
    if (error) {
      toast.error("Failed to delete project: " + error.message);
    } else {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16 px-5 md:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-light text-primary mb-2">
            Admin Portal
          </h1>
          <p className="text-muted-foreground font-body text-sm mb-10">
            Manage your projects
          </p>

          {/* Add Project Form */}
          <form onSubmit={handleSave} className="space-y-5 mb-16 p-6 border border-border rounded-sm bg-card">
            <h2 className="font-display text-lg text-primary mb-4">Add New Project</h2>
            
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Project Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter project title"
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description"
                className="bg-background border-border min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="text-foreground">Image URL</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoUrl" className="text-foreground">Video URL</Label>
              <Input
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="bg-background border-border"
              />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Project"}
            </Button>
          </form>

          {/* Projects List */}
          <div>
            <h2 className="font-display text-lg text-primary mb-6">Existing Projects</h2>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 border border-border rounded-sm bg-card"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {project.image_url && (
                        <img
                          src={project.image_url}
                          alt={project.title}
                          className="w-12 h-12 object-cover rounded-sm flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-medium text-primary truncate">{project.title}</h3>
                        {project.description && (
                          <p className="text-muted-foreground text-sm truncate">{project.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project.id, project.title)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8 border border-border rounded-sm">
                No projects yet. Add your first one above.
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminPortal;
