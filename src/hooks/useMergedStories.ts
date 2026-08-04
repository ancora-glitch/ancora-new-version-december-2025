import { useMemo } from "react";
import { useStyleGuides } from "@/hooks/useStyleGuides";
import { useNewsletterFeed } from "@/hooks/useNewsletterFeed";

export interface MergedStory {
  id: string;
  title: string;
  excerpt: string;
  image: string | null;
  publishedAt: string | null;
  href: string;
  external: boolean;
  focalPoint?: string | null;
  author?: string | null;
}

/**
 * Merges editorial stories (style_guides) with Substack newsletter posts,
 * sorted by publishedAt descending. Read-only, no DB writes.
 */
export function useMergedStories(limit?: number) {
  const { data: styleGuides, isLoading: guidesLoading } = useStyleGuides();
  const { posts, loading: feedLoading } = useNewsletterFeed(limit ?? 20);

  const stories = useMemo<MergedStory[]>(() => {
    const internal: MergedStory[] = (styleGuides ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      excerpt: g.intro_text ?? "",
      image: g.image,
      publishedAt: g.published_at ?? g.created_at ?? null,
      href: `/style-guides/${g.slug}`,
      external: false,
      focalPoint: g.focal_point,
      author: g.author,
    }));

    const external: MergedStory[] = posts.map((p) => ({
      id: p.url,
      title: p.title,
      excerpt: p.excerpt,
      image: p.image,
      publishedAt: p.publishedAt,
      href: p.url,
      external: true,
      author: "Carin Roeraade",
    }));

    const merged = [...internal, ...external].sort((a, b) => {
      const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bt - at;
    });

    return typeof limit === "number" ? merged.slice(0, limit) : merged;
  }, [styleGuides, posts, limit]);

  return { stories, isLoading: guidesLoading || feedLoading };
}
