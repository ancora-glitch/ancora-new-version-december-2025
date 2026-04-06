
-- Create table
CREATE TABLE public.intake_brand_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL UNIQUE,
  tier text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intake_brand_tiers ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can select intake_brand_tiers"
  ON public.intake_brand_tiers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_brand_tiers"
  ON public.intake_brand_tiers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_brand_tiers"
  ON public.intake_brand_tiers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete intake_brand_tiers"
  ON public.intake_brand_tiers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed Tier A
INSERT INTO public.intake_brand_tiers (brand_name, tier) VALUES
  ('Toteme', 'a'),
  ('Acne Studios', 'a'),
  ('Filippa K', 'a'),
  ('Tiger of Sweden', 'a'),
  ('Stine Goya', 'a'),
  ('Ganni', 'a'),
  ('By Malene Birger', 'a'),
  ('Rodebjer', 'a'),
  ('Hope Stockholm', 'a'),
  ('Our Legacy', 'a'),
  ('3.1 Phillip Lim', 'a'),
  ('Alaia', 'a'),
  ('Alexander McQueen', 'a'),
  ('ATP Atelier', 'a'),
  ('APC', 'a'),
  ('A.P.C', 'a'),
  ('Balenciaga', 'a'),
  ('Baserange', 'a'),
  ('Baum und Pferdgarten', 'a'),
  ('Brixtol Textiles', 'a'),
  ('Bottega Veneta', 'a'),
  ('Burberry', 'a'),
  ('Copenhagen Studios', 'a'),
  ('By Malina', 'a'),
  ('Carhartt', 'a'),
  ('Carhartt WIP', 'a'),
  ('Cartier', 'a'),
  ('CDLP', 'a'),
  ('Chanel', 'a'),
  ('Chimi', 'a'),
  ('Chloe', 'a'),
  ('Dagmar', 'a'),
  ('Dior', 'a'),
  ('Dr Martens', 'a'),
  ('Eytys', 'a'),
  ('Flattered', 'a'),
  ('House of Dagmar', 'a'),
  ('Gant', 'a'),
  ('Gucci', 'a'),
  ('Patagonia', 'a'),
  ('Isabel Marant', 'a'),
  ('Jacquemus', 'a'),
  ('Jeanerica', 'a'),
  ('Jil Sander', 'a'),
  ('Lisa Yang', 'a'),
  ('Levi''s', 'a'),
  ('Loewe', 'a'),
  ('Louis Vuitton', 'a'),
  ('Ralph Lauren', 'a'),
  ('Maison Margiela', 'a'),
  ('Maria Nilsdotter', 'a'),
  ('Marimekko', 'a'),
  ('Marni', 'a'),
  ('McQueen', 'a'),
  ('Miu Miu', 'a'),
  ('Moncler', 'a'),
  ('Mulberry', 'a'),
  ('Prada', 'a'),
  ('Pucci', 'a'),
  ('Saint Laurent', 'a'),
  ('Sandqvist', 'a'),
  ('See by Chloe', 'a'),
  ('Self Portrait', 'a'),
  ('Sefr', 'a'),
  ('Skall Studio', 'a'),
  ('Stella McCartney', 'a'),
  ('The Row', 'a'),
  ('Sophie Billie Brahe', 'a'),
  ('Stand Studio', 'a'),
  ('Valentino', 'a'),
  ('Veja', 'a'),
  ('Versace', 'a'),
  ('Wood Wood', 'a'),
  ('Avavav', 'a'),
  ('Soft Goat', 'a'),
  ('Vivienne Westwood', 'a'),
  ('Diesel', 'a'),
  ('Adidas by Stella McCartney', 'a'),
  ('Barbour x Levis', 'a'),
  ('Barbour', 'a'),
  ('Barbour x Alexa Chung', 'a'),
  ('Barbour x Ganni', 'a'),
  ('Ahlvar Gallery', 'a'),
  ('ROTATE Birger Christensen', 'a'),
  ('Stylein', 'a'),
  ('Just Cavalli', 'a'),
  ('Helmut Lang', 'a'),
  ('Calvin Klein', 'a'),
  ('Filippa K Soft Sport', 'a'),
  ('Acne Studios x Per B Sundberg', 'a'),
  ('Little Liffner', 'a'),
  ('Paloma Wool', 'a'),
  ('Simone Rocha', 'a'),
  ('Proenza Schouler', 'a'),
  ('Axel Arigato', 'a'),
  ('Our Legacy x Byredo', 'a'),
  ('Celine', 'a'),
  -- Seed Tier B
  ('Samsøe Samsøe', 'b'),
  ('ADOORE', 'b'),
  ('American Vintage', 'b'),
  ('Asics', 'b'),
  ('A Part of the Art', 'b'),
  ('Blankens', 'b'),
  ('Hunter', 'b'),
  ('Karhu', 'b'),
  ('Kernemilk', 'b'),
  ('Kings of Indigo', 'b'),
  ('Knowledge', 'b'),
  ('Langerchen', 'b'),
  ('Lemaire', 'b'),
  ('Madewell', 'b'),
  ('Munthe', 'b'),
  ('New Balance', 'b'),
  ('Nike', 'b'),
  ('Nour Hammour', 'b'),
  ('Nudie Jeans', 'b'),
  ('Nudie', 'b'),
  ('Palmes', 'b'),
  ('Rohe', 'b'),
  ('Pernille Corydon', 'b'),
  ('Samsoe Samsoe', 'b'),
  ('Resume', 'b'),
  ('Satisfy', 'b'),
  ('Saucony', 'b'),
  ('Soeur', 'b'),
  ('Stockholm', 'b');
