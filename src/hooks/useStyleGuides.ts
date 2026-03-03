import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StoryStatus = "draft" | "published" | "archived";

export interface StyleGuide {
  id: string;
  title: string;
  image: string;
  intro_text: string;
  body: string;
  slug: string;
  author?: string | null;
  focal_point?: string | null;
  status: StoryStatus;
  published_at?: string | null;
  unpublished_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Public: only published stories, sorted by published_at DESC
export const useStyleGuides = () => {
  return useQuery({
    queryKey: ["style-guides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("style_guides")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data as StyleGuide[];
    },
  });
};

// Admin: all stories, for management
export const useAllStyleGuides = () => {
  return useQuery({
    queryKey: ["style-guides-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("style_guides")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StyleGuide[];
    },
  });
};

export const useStyleGuide = (slug: string) => {
  return useQuery({
    queryKey: ["style-guide", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("style_guides")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (error) throw error;
      return data as StyleGuide | null;
    },
    enabled: !!slug,
  });
};

// Admin preview: fetch by ID regardless of status
export const useStyleGuidePreview = (id: string) => {
  return useQuery({
    queryKey: ["style-guide-preview", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("style_guides")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as StyleGuide | null;
    },
    enabled: !!id,
  });
};
