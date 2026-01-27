import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StyleGuide {
  id: string;
  title: string;
  image: string;
  intro_text: string;
  body: string;
  slug: string;
  author?: string | null;
  created_at: string;
  updated_at: string;
}

export const useStyleGuides = () => {
  return useQuery({
    queryKey: ["style-guides"],
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
        .maybeSingle();

      if (error) throw error;
      return data as StyleGuide | null;
    },
    enabled: !!slug,
  });
};
