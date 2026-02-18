export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ancora_import_items: {
        Row: {
          affiliate_url: string | null
          brand_text: string | null
          category_id: string | null
          color_text: string | null
          condition: Database["public"]["Enums"]["ais_condition"] | null
          condition_text: string | null
          created_at: string
          currency: string | null
          description: string | null
          description_en: string | null
          description_original: string | null
          id: string
          images: string[]
          language: string | null
          marketplace: string | null
          material_text: string | null
          price: number | null
          primary_image: string | null
          product_id: string | null
          promoted_at: string | null
          provenance: string | null
          raw_payload: Json | null
          reviewed_at: string | null
          signals: Json | null
          size_text: string | null
          source_ref: string
          source_type: Database["public"]["Enums"]["ais_source_type"]
          source_url: string | null
          status: Database["public"]["Enums"]["ais_status"]
          title: string
          title_en: string | null
          title_original: string | null
          translated_at: string | null
        }
        Insert: {
          affiliate_url?: string | null
          brand_text?: string | null
          category_id?: string | null
          color_text?: string | null
          condition?: Database["public"]["Enums"]["ais_condition"] | null
          condition_text?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          description_en?: string | null
          description_original?: string | null
          id?: string
          images?: string[]
          language?: string | null
          marketplace?: string | null
          material_text?: string | null
          price?: number | null
          primary_image?: string | null
          product_id?: string | null
          promoted_at?: string | null
          provenance?: string | null
          raw_payload?: Json | null
          reviewed_at?: string | null
          signals?: Json | null
          size_text?: string | null
          source_ref: string
          source_type: Database["public"]["Enums"]["ais_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["ais_status"]
          title: string
          title_en?: string | null
          title_original?: string | null
          translated_at?: string | null
        }
        Update: {
          affiliate_url?: string | null
          brand_text?: string | null
          category_id?: string | null
          color_text?: string | null
          condition?: Database["public"]["Enums"]["ais_condition"] | null
          condition_text?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          description_en?: string | null
          description_original?: string | null
          id?: string
          images?: string[]
          language?: string | null
          marketplace?: string | null
          material_text?: string | null
          price?: number | null
          primary_image?: string | null
          product_id?: string | null
          promoted_at?: string | null
          provenance?: string | null
          raw_payload?: Json | null
          reviewed_at?: string | null
          signals?: Json | null
          size_text?: string | null
          source_ref?: string
          source_type?: Database["public"]["Enums"]["ais_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["ais_status"]
          title?: string
          title_en?: string | null
          title_original?: string | null
          translated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ancora_import_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ancora_import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["category_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["category_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["category_status"]
          updated_at?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          checked_count: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_processed: number | null
          job_name: string
          ran_at: string
          sold_marked: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          checked_count?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_processed?: number | null
          job_name: string
          ran_at?: string
          sold_marked?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          checked_count?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_processed?: number | null
          job_name?: string
          ran_at?: string
          sold_marked?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          additional_images: Json | null
          affiliate_auto_handling: boolean | null
          affiliate_checked_via: string | null
          affiliate_last_checked_at: string | null
          affiliate_status: string | null
          affiliate_url: string | null
          ancora_select_source:
            | Database["public"]["Enums"]["ancora_select_source"]
            | null
          brand: string
          category_id: string | null
          color: string | null
          color_sv: string | null
          condition: string | null
          condition_sv: string | null
          created_at: string
          description: string | null
          description_en: string | null
          description_original: string | null
          description_sv: string | null
          id: string
          image: string
          import_queued_at: string | null
          import_retry_count: number | null
          in_weekly_edit: boolean
          language: string | null
          marketplace: string | null
          material: string | null
          material_sv: string | null
          name: string
          name_en: string | null
          name_original: string | null
          name_sv: string | null
          price: string
          size: string | null
          size_sv: string | null
          slug: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["product_status"]
          subcategory: string | null
          tradera_item_id: string | null
          translated_at: string | null
          unpublished_reason: string | null
          updated_at: string
        }
        Insert: {
          additional_images?: Json | null
          affiliate_auto_handling?: boolean | null
          affiliate_checked_via?: string | null
          affiliate_last_checked_at?: string | null
          affiliate_status?: string | null
          affiliate_url?: string | null
          ancora_select_source?:
            | Database["public"]["Enums"]["ancora_select_source"]
            | null
          brand: string
          category_id?: string | null
          color?: string | null
          color_sv?: string | null
          condition?: string | null
          condition_sv?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_original?: string | null
          description_sv?: string | null
          id?: string
          image: string
          import_queued_at?: string | null
          import_retry_count?: number | null
          in_weekly_edit?: boolean
          language?: string | null
          marketplace?: string | null
          material?: string | null
          material_sv?: string | null
          name: string
          name_en?: string | null
          name_original?: string | null
          name_sv?: string | null
          price: string
          size?: string | null
          size_sv?: string | null
          slug?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          subcategory?: string | null
          tradera_item_id?: string | null
          translated_at?: string | null
          unpublished_reason?: string | null
          updated_at?: string
        }
        Update: {
          additional_images?: Json | null
          affiliate_auto_handling?: boolean | null
          affiliate_checked_via?: string | null
          affiliate_last_checked_at?: string | null
          affiliate_status?: string | null
          affiliate_url?: string | null
          ancora_select_source?:
            | Database["public"]["Enums"]["ancora_select_source"]
            | null
          brand?: string
          category_id?: string | null
          color?: string | null
          color_sv?: string | null
          condition?: string | null
          condition_sv?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_original?: string | null
          description_sv?: string | null
          id?: string
          image?: string
          import_queued_at?: string | null
          import_retry_count?: number | null
          in_weekly_edit?: boolean
          language?: string | null
          marketplace?: string | null
          material?: string | null
          material_sv?: string | null
          name?: string
          name_en?: string | null
          name_original?: string | null
          name_sv?: string | null
          price?: string
          size?: string | null
          size_sv?: string | null
          slug?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          subcategory?: string | null
          tradera_item_id?: string | null
          translated_at?: string | null
          unpublished_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          title: string
          updated_at: string
          video_link: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          title: string
          updated_at?: string
          video_link?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
          video_link?: string | null
        }
        Relationships: []
      }
      site_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_path: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_path: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      style_guides: {
        Row: {
          author: string | null
          body: string
          created_at: string
          id: string
          image: string
          intro_text: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          body: string
          created_at?: string
          id?: string
          image: string
          intro_text: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          body?: string
          created_at?: string
          id?: string
          image?: string
          intro_text?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tradera_api_usage: {
        Row: {
          call_count: number
          created_at: string
          id: string
          updated_at: string
          usage_date: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
        }
        Update: {
          call_count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      tradera_cache: {
        Row: {
          cache_key: string
          cache_type: string
          created_at: string
          expires_at: string
          fetched_at: string
          id: string
          raw_payload: Json
        }
        Insert: {
          cache_key: string
          cache_type: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          raw_payload: Json
        }
        Update: {
          cache_key?: string
          cache_type?: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          raw_payload?: Json
        }
        Relationships: []
      }
      tradera_retry_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          id: string
          item_payload: Json
          last_error: string | null
          max_attempts: number
          retry_after: string
          source_ref: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          item_payload?: Json
          last_error?: string | null
          max_attempts?: number
          retry_after?: string
          source_ref: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          item_payload?: Json
          last_error?: string | null
          max_attempts?: number
          retry_after?: string
          source_ref?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      translation_usage: {
        Row: {
          chars_used: number
          day_utc: string
          items_used: number
          updated_at: string
        }
        Insert: {
          chars_used?: number
          day_utc?: string
          items_used?: number
          updated_at?: string
        }
        Update: {
          chars_used?: number
          day_utc?: string
          items_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      weekly_edit_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          sort_order: number
          weekly_edit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
          weekly_edit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
          weekly_edit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_edit_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_edit_products_weekly_edit_id_fkey"
            columns: ["weekly_edit_id"]
            isOneToOne: false
            referencedRelation: "weekly_edits"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_edits: {
        Row: {
          created_at: string
          id: string
          long_intro: string | null
          short_intro: string | null
          slug: string
          status: Database["public"]["Enums"]["weekly_edit_status"]
          three_ways_to_wear: Json
          title: string
          updated_at: string
          week_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          long_intro?: string | null
          short_intro?: string | null
          slug: string
          status?: Database["public"]["Enums"]["weekly_edit_status"]
          three_ways_to_wear?: Json
          title: string
          updated_at?: string
          week_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          long_intro?: string | null
          short_intro?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["weekly_edit_status"]
          three_ways_to_wear?: Json
          title?: string
          updated_at?: string
          week_label?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      tradera_get_usage: { Args: never; Returns: Json }
      tradera_increment_usage: { Args: { daily_limit?: number }; Returns: Json }
    }
    Enums: {
      ais_condition: "new" | "excellent" | "good" | "fair" | "unknown"
      ais_source_type: "tradera" | "ebay" | "manual" | "csv" | "other"
      ais_status: "draft" | "reviewed" | "promoted" | "discarded"
      ancora_select_source: "tradera"
      app_role: "admin" | "moderator" | "user"
      category_status: "draft" | "published"
      product_status:
        | "active"
        | "sold"
        | "published"
        | "draft"
        | "pending_import"
      weekly_edit_status: "draft" | "scheduled" | "published"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ais_condition: ["new", "excellent", "good", "fair", "unknown"],
      ais_source_type: ["tradera", "ebay", "manual", "csv", "other"],
      ais_status: ["draft", "reviewed", "promoted", "discarded"],
      ancora_select_source: ["tradera"],
      app_role: ["admin", "moderator", "user"],
      category_status: ["draft", "published"],
      product_status: [
        "active",
        "sold",
        "published",
        "draft",
        "pending_import",
      ],
      weekly_edit_status: ["draft", "scheduled", "published"],
    },
  },
} as const
