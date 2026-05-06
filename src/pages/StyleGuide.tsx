import { useParams, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useStyleGuide } from "@/hooks/useStyleGuides";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoryBody } from "@/components/StoryBody";

// Convert markdown-style image syntax to HTML figure elements
const convertInlineImages = (text: string): string => {
  // Match ![caption](url) syntax - caption is optional
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, caption, url) => {
    const captionHtml = caption ? `<figcaption class="article-image-caption">${caption}</figcaption>` : '';
    return `</p><figure class="article-inline-image"><img src="${url}" alt="${caption || 'Article image'}" loading="lazy" />${captionHtml}</figure><p>`;
  });
};

// Convert markdown-style formatting to HTML
const convertMarkdownFormatting = (text: string): string => {
  // First convert inline images
  let result = convertInlineImages(text);
  // Convert **bold** to <strong> (greedy match for double asterisks)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Convert *italic* to <em> (after bold is processed, only single asterisks remain)
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return result;
};

// Convert plain text line breaks to HTML paragraphs
const formatBodyContent = (body: string): string => {
  // If content already contains HTML block elements, return as-is
  if (/<(p|div|h[1-6]|ul|ol|li|blockquote)[^>]*>/i.test(body)) {
    // Still apply markdown formatting to existing HTML
    return convertMarkdownFormatting(body);
  }
  
  // Split by any line break first
  const lines = body.split(/\n/);
  const result: string[] = [];
  let currentParagraph: string[] = [];
  
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = convertMarkdownFormatting(currentParagraph.join('<br>'));
      result.push(`<p>${content}</p>`);
      currentParagraph = [];
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Empty line = paragraph break
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    
    // Numbered line (e.g. "1.", "2.", "10.") = separate paragraph with spacing
    if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      const content = convertMarkdownFormatting(trimmed);
      result.push(`<p>${content}</p>`);
      continue;
    }
    
    // Regular line - accumulate into current paragraph
    currentParagraph.push(trimmed);
  }
  
  // Flush any remaining content
  flushParagraph();
  
  return result.join('\n');
};

const StyleGuide = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: guide, isLoading, error } = useStyleGuide(slug || "");
  const viewTracked = useRef(false);

  // Track story view (once per page load, non-admin, non-preview)
  useEffect(() => {
    if (viewTracked.current || !slug || !guide) return;
    // Skip admin/preview
    if (window.location.hostname.includes("preview") && window.location.hostname.includes("id-preview")) return;
    if (window.location.pathname.startsWith("/admin")) return;

    viewTracked.current = true;

    // Check if current user is admin before tracking
    const trackView = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
          });
          if (isAdmin) return;
        }

        const backendUrl = import.meta.env.VITE_SUPABASE_URL;
        await fetch(`${backendUrl}/functions/v1/register-story-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ story_slug: slug }),
        });
      } catch {
        // Silently fail — analytics should not break the page
      }
    };

    trackView();
  }, [slug, guide]);

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
      
      <main className="pt-20 md:pt-24">
        {/* Mobile/Tablet: Full-width hero image with portrait crop */}
        <div className="lg:hidden relative w-full aspect-[4/5] overflow-hidden">
          <img
            src={guide.image}
            alt={guide.title}
            loading="eager"
            width={800}
            height={1000}
            style={{ objectPosition: guide.focal_point || '50% 30%' }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Desktop: Two-column editorial layout */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="lg:grid lg:grid-cols-[minmax(0,680px)_1fr] lg:gap-16 xl:gap-20">
            {/* Left Column: Text Content */}
            <article className="py-12 md:py-16 lg:py-20">
              {/* Back Link */}
              <Link 
                to="/stories" 
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 text-sm tracking-wider uppercase font-sans"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Stories
              </Link>

              {/* Title */}
              <h1 className="font-serif text-3xl md:text-5xl lg:text-[3.25rem] xl:text-[3.5rem] text-primary leading-tight mb-4">
                {guide.title}
              </h1>

              {/* Byline */}
              {guide.author && (
                <p className="text-muted-foreground text-sm font-sans tracking-wide mb-10">
                  By {guide.author}
                </p>
              )}

              <div className="max-w-[700px] w-full">
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
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatBodyContent(guide.body), { ADD_TAGS: ['figure', 'figcaption'], ADD_ATTR: ['loading', 'class', 'src', 'alt'] }) }}
                />
              </div>
            </article>

            {/* Right Column: Featured Image (Desktop only) */}
            <aside className="hidden lg:block pt-20">
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={guide.image}
                  alt={guide.title}
                  loading="lazy"
                  width={600}
                  height={800}
                  style={{ objectPosition: guide.focal_point || '50% 30%' }}
                  className="w-full h-full object-cover"
                />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StyleGuide;
