import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NewsletterPost {
  title: string;
  excerpt: string;
  url: string;
  image: string | null;
  publishedAt: string | null;
}

interface UseNewsletterFeedResult {
  posts: NewsletterPost[];
  loading: boolean;
  error: string | null;
}

export function useNewsletterFeed(limit = 6): UseNewsletterFeedResult {
  const [posts, setPosts] = useState<NewsletterPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke(
        "newsletter-feed",
        { body: { limit } }
      );

      if (cancelled) return;

      if (invokeError) {
        setError(invokeError.message);
        setPosts([]);
      } else {
        setPosts(Array.isArray(data) ? (data as NewsletterPost[]) : []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { posts, loading, error };
}
