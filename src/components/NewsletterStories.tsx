import { useNewsletterFeed } from "@/hooks/useNewsletterFeed";

interface NewsletterStoriesProps {
  limit?: number;
  title?: string;
  showTitle?: boolean;
}

export function NewsletterStories({
  limit = 6,
  title = "From the newsletter",
  showTitle = true,
}: NewsletterStoriesProps) {
  const { posts, loading, error } = useNewsletterFeed(limit);

  if (error) return null;
  if (!loading && posts.length === 0) return null;

  return (
    <section className="px-4 md:px-8 lg:px-12 max-w-7xl mx-auto mb-16 md:mb-24">
      {showTitle && (
        <h2 className="font-serif text-2xl md:text-3xl text-primary text-center mb-10 md:mb-12">
          {title}
        </h2>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="flex flex-col animate-pulse">
              <div className="aspect-[4/5] md:aspect-[3/4] bg-secondary/60 mb-5" />
              <div className="h-4 bg-secondary/60 mb-2 w-3/4" />
              <div className="h-3 bg-secondary/40 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto">
          {posts.map((post) => (
            <article key={post.url} className="group flex flex-col">
              <a
                href={post.url}
                target="_blank"
                rel="noopener"
                className="flex flex-col flex-1"
                aria-label={`Read: ${post.title}`}
              >
                {post.image && (
                  <div className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden mb-5">
                    <img
                      src={post.image}
                      alt={post.title}
                      loading="lazy"
                      width={600}
                      height={800}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/15 transition-colors duration-300 pointer-events-none" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-serif text-base md:text-xl text-foreground mb-2 leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-2">
                      {post.excerpt}
                    </p>
                  )}
                  {post.publishedAt && (
                    <p className="text-[10px] md:text-xs tracking-[0.1em] uppercase text-muted-foreground/80">
                      {new Date(post.publishedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <span className="inline-block mt-3 py-2 px-4 md:py-3 md:px-6 bg-primary text-primary-foreground text-[10px] md:text-xs tracking-widest uppercase group-hover:bg-primary/90 transition-colors duration-200 self-start">
                  Read story
                </span>
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
