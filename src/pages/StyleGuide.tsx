import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStyleGuide } from "@/hooks/useStyleGuides";
import { ArrowLeft } from "lucide-react";
import DOMPurify from "dompurify";

const StyleGuide = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: guide, isLoading, error } = useStyleGuide(slug || "");

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
                <div className="h-4 bg-muted rounded w-4/6" />
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
            <h1 className="font-serif text-3xl md:text-4xl text-primary mb-4">
              Story not found
            </h1>
            <p className="text-muted-foreground mb-8">
              The story you're looking for doesn't exist or has been removed.
            </p>
            <Link 
              to="/stories" 
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Stories
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20">
        {/* Hero Image */}
        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          <img
            src={guide.image}
            alt={guide.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <article className="max-w-[700px] mx-auto px-6 py-12 md:py-16">
          {/* Back Link */}
          <Link 
            to="/stories" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 text-sm tracking-wider uppercase font-sans"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Stories
          </Link>

          {/* Title */}
          <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl text-primary leading-tight mb-10">
            {guide.title}
          </h1>

          {/* Intro Text */}
          <p className="article-intro">
            {guide.intro_text}
          </p>

          {/* Divider */}
          <div className="w-16 h-px bg-primary/30 mb-12" />

          {/* Body Content (Rich Text) */}
          <div 
            className="prose prose-lg max-w-none prose-editorial
              prose-headings:font-heading prose-headings:text-primary prose-headings:font-semibold
              prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-12 prose-h2:mb-6
              prose-h3:text-lg prose-h3:md:text-xl prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-foreground prose-p:leading-relaxed prose-p:mb-6
              prose-strong:text-foreground prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-primary prose-blockquote:border-l-2 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-primary
              prose-ul:text-foreground prose-ul:list-none prose-ul:pl-0 prose-ul:space-y-4
              prose-ol:text-foreground prose-ol:list-none prose-ol:pl-0 prose-ol:space-y-4
              prose-li:mb-4 prose-li:pl-0 prose-li:leading-relaxed
              prose-img:rounded-lg prose-img:shadow-md"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(guide.body) }}
          />
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default StyleGuide;
