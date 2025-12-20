import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useProjects } from "@/hooks/useProjects";
import { Play } from "lucide-react";

const Projects = () => {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16 px-5 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl font-light text-primary mb-4">
            Projects
          </h1>
          <p className="text-muted-foreground font-body text-base mb-12 max-w-2xl">
            A curated collection of our creative projects and collaborations.
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-muted rounded-sm mb-4" />
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project) => (
                <article key={project.id} className="group">
                  {project.image_url ? (
                    <div className="relative aspect-[4/3] mb-4 overflow-hidden rounded-sm">
                      <img
                        src={project.image_url}
                        alt={project.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {project.video_link && (
                        <a
                          href={project.video_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        >
                          <div className="w-14 h-14 rounded-full bg-background/90 flex items-center justify-center">
                            <Play className="w-6 h-6 text-primary ml-1" />
                          </div>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-muted rounded-sm mb-4 flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">No image</span>
                    </div>
                  )}
                  
                  <h2 className="font-display text-lg font-medium text-primary mb-2 group-hover:text-primary/80 transition-colors">
                    {project.title}
                  </h2>
                  
                  {project.description && (
                    <p className="text-muted-foreground font-body text-sm line-clamp-3">
                      {project.description}
                    </p>
                  )}
                  
                  {project.video_link && !project.image_url && (
                    <a
                      href={project.video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mt-3"
                    >
                      <Play className="w-4 h-4" />
                      Watch video
                    </a>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              No projects available yet.
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Projects;
