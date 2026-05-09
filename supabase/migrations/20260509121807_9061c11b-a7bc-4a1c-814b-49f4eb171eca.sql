-- 1. Segment enum
CREATE TYPE product_segment AS ENUM ('womenswear', 'menswear');

-- 2. Add segment to products (backfills via default)
ALTER TABLE public.products
  ADD COLUMN segment product_segment NOT NULL DEFAULT 'womenswear';

UPDATE public.products SET segment = 'womenswear' WHERE segment IS NULL;

-- 3. intake_configs table
CREATE TABLE public.intake_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  marketplace   text NOT NULL,
  segment       product_segment NOT NULL,
  category_ids  text[] NOT NULL,
  query_terms   text[] NOT NULL,
  min_price_sek integer NOT NULL DEFAULT 500,
  active        boolean NOT NULL DEFAULT true,
  run_order     integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace, segment, name)
);

ALTER TABLE public.intake_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_configs"
  ON public.intake_configs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert intake_configs"
  ON public.intake_configs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update intake_configs"
  ON public.intake_configs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete intake_configs"
  ON public.intake_configs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_intake_configs_updated_at
  BEFORE UPDATE ON public.intake_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Seed
INSERT INTO public.intake_configs (name, marketplace, segment, category_ids, query_terms, min_price_sek, run_order)
VALUES
  (
    'eBay womenswear default',
    'ebay',
    'womenswear',
    ARRAY['15724'],
    ARRAY['women''s clothing'],
    500,
    1
  ),
  (
    'eBay menswear default',
    'ebay',
    'menswear',
    ARRAY['1059','57988','3002','2517','57991','57989','10158'],
    ARRAY['men''s jacket','men''s suit','men''s shirt','men''s knitwear','men''s trousers','men''s t-shirt'],
    500,
    2
  )
ON CONFLICT (marketplace, segment, name) DO NOTHING;