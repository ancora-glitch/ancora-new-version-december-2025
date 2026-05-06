import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStyleGuidePreview } from "@/hooks/useStyleGuides";
import { ArrowLeft } from "lucide-react";
import { StoryBody } from "@/components/StoryBody";
import { SmartCropImage } from "@/components/SmartCropImage";
import { Badge } from "@/components/ui/badge";

const StoryPreview = () => {
  const { id } = useParams<{ id: string }>();
  const { data: guide, isLoading, error } = useStyleGuidePreview(id || "");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="max-w-[700px] mx-auto px-6">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="aspect-[16/9] bg-muted rounded" />
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="max-w-[700px] mx-auto px-6 text-center">
            <h1 className="font-serif text-3xl md:text-4xl text-primary mb-4">Story not found</h1>
            <p className="text-muted-foreground mb-8">This story doesn't exist or you don't have access.</p>
            <Link to="/admin-portal" className="inline-flex items-center gap-2 text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* noindex for previews */}
      <meta name="robots" content="noindex, nofollow" />
      <Header />

      {/* Preview banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-center py-1.5 text-sm font-medium tracking-wide">
        Preview Mode — {guide.status === "draft" ? "Draft" : guide.status === "archived" ? "Archived" : "Published"}
        <Link to="/admin-portal" className="ml-4 underline hover:no-underline">
          ← Back to Admin
        </Link>
      </div>

      <main className="pt-20 md:pt-24 mt-8">
        {/* Mobile/Tablet hero */}
        <div className="lg:hidden relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          <SmartCropImage
            src={guide.image}
            alt={guide.title}
            loading="lazy"
            width={1920}
            height={823}
            containerClassName="w-full h-full"
            className="w-full h-full object-cover"
            fallbackPosition="50% 25%"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Two-column layout */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="lg:grid lg:grid-cols-[minmax(0,680px)_1fr] lg:gap-16 xl:gap-20">
            <article className="py-12 md:py-16 lg:py-20">
              <Link
                to="/admin-portal"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 text-sm tracking-wider uppercase font-sans"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin
              </Link>

              <h1 className="font-serif text-3xl md:text-5xl lg:text-[3.25rem] xl:text-[3.5rem] text-primary leading-tight mb-4">
                {guide.title}
              </h1>

              {guide.author && (
                <p className="text-muted-foreground text-sm font-sans tracking-wide mb-10">
                  By {guide.author}
                </p>
              )}

              <div className="max-w-[700px] w-full">
                <p className="article-intro">{guide.intro_text}</p>
                <div className="w-16 h-px bg-primary/30 mb-12" />

                <StoryBody
                  body={guide.body}
                  className="prose prose-lg max-w-none prose-editorial
                    prose-headings:font-heading prose-headings:text-primary prose-headings:font-semibold
                    prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-14 prose-h2:mb-8
                    prose-h3:text-lg prose-h3:md:text-xl prose-h3:mt-10 prose-h3:mb-5
                    prose-p:text-foreground prose-p:leading-[1.85] prose-p:mb-10 prose-p:text-[17px]
                    prose-strong:text-foreground prose-strong:font-semibold prose-strong:text-[inherit] prose-strong:not-italic
                    prose-em:text-foreground prose-em:italic prose-em:text-[inherit]
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-blockquote:border-l-primary prose-blockquote:border-l-2 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-primary prose-blockquote:my-10
                    prose-ul:text-foreground prose-ul:list-disc prose-ul:pl-6 prose-ul:space-y-4 prose-ul:my-10
                    prose-ol:text-foreground prose-ol:list-decimal prose-ol:pl-6 prose-ol:space-y-4 prose-ol:my-10
                    prose-li:mb-4 prose-li:pl-2 prose-li:leading-[1.8] prose-li:text-[17px] prose-li:marker:text-primary prose-li:marker:font-semibold
                    prose-img:rounded-[5px] prose-img:shadow-none prose-img:my-10"
                />
              </div>
            </article>

            <aside className="hidden lg:block pt-20">
              <SmartCropImage
                src={guide.image}
                alt={guide.title}
                loading="lazy"
                width={600}
                height={800}
                containerClassName="relative overflow-hidden"
                className="w-full h-auto object-cover"
                fallbackPosition="50% 25%"
              />
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StoryPreview;
