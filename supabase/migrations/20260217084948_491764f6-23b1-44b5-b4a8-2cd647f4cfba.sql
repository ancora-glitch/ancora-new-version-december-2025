
-- Enum for weekly edit status
CREATE TYPE public.weekly_edit_status AS ENUM ('draft', 'scheduled', 'published');

-- Main weekly edits table
CREATE TABLE public.weekly_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status weekly_edit_status NOT NULL DEFAULT 'draft',
  week_label TEXT,
  short_intro TEXT,
  long_intro TEXT,
  three_ways_to_wear JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table: products selected for a weekly edit
CREATE TABLE public.weekly_edit_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  weekly_edit_id UUID NOT NULL REFERENCES public.weekly_edits(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (weekly_edit_id, product_id)
);

-- Enable RLS
ALTER TABLE public.weekly_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_edit_products ENABLE ROW LEVEL SECURITY;

-- RLS: weekly_edits publicly readable, admin writable
CREATE POLICY "Weekly edits are publicly viewable"
  ON public.weekly_edits FOR SELECT USING (true);
CREATE POLICY "Admins can insert weekly edits"
  ON public.weekly_edits FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update weekly edits"
  ON public.weekly_edits FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete weekly edits"
  ON public.weekly_edits FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS: weekly_edit_products publicly readable, admin writable
CREATE POLICY "Weekly edit products are publicly viewable"
  ON public.weekly_edit_products FOR SELECT USING (true);
CREATE POLICY "Admins can insert weekly edit products"
  ON public.weekly_edit_products FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update weekly edit products"
  ON public.weekly_edit_products FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete weekly edit products"
  ON public.weekly_edit_products FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_weekly_edits_updated_at
  BEFORE UPDATE ON public.weekly_edits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
