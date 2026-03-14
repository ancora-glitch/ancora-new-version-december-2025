
-- intake_raw_listings
CREATE TABLE public.intake_raw_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  partner_id text,
  external_id text,
  raw_payload jsonb NOT NULL,
  import_run_id uuid,
  checksum text,
  imported_at timestamptz DEFAULT now()
);

ALTER TABLE public.intake_raw_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_raw_listings"
  ON public.intake_raw_listings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_raw_listings"
  ON public.intake_raw_listings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_raw_listings"
  ON public.intake_raw_listings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intake_normalized_products
CREATE TABLE public.intake_normalized_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_listing_id uuid REFERENCES public.intake_raw_listings(id),
  source text NOT NULL,
  partner_id text,
  external_id text,
  affiliate_url text,
  title_raw text,
  title_clean text,
  description_raw text,
  brand text,
  category text,
  subcategory text,
  color text,
  size text,
  material text,
  condition text,
  price numeric,
  currency text DEFAULT 'SEK',
  image_urls jsonb,
  availability_status text,
  confidence jsonb,
  style_tags jsonb,
  current_queue_state text DEFAULT 'raw_imported',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.intake_normalized_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_normalized_products"
  ON public.intake_normalized_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_normalized_products"
  ON public.intake_normalized_products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_normalized_products"
  ON public.intake_normalized_products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intake_evaluations
CREATE TABLE public.intake_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_product_id uuid REFERENCES public.intake_normalized_products(id),
  rules_version text,
  prompt_version text,
  model_version text,
  hard_flags jsonb,
  soft_flags jsonb,
  subscores jsonb,
  score_total integer,
  decision text,
  reasons jsonb,
  evaluated_at timestamptz DEFAULT now()
);

ALTER TABLE public.intake_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_evaluations"
  ON public.intake_evaluations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_evaluations"
  ON public.intake_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_evaluations"
  ON public.intake_evaluations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intake_editorial_actions
CREATE TABLE public.intake_editorial_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_product_id uuid REFERENCES public.intake_normalized_products(id),
  editor_id uuid,
  previous_state text,
  new_state text,
  action_type text,
  changed_fields jsonb,
  override_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.intake_editorial_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_editorial_actions"
  ON public.intake_editorial_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_editorial_actions"
  ON public.intake_editorial_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_editorial_actions"
  ON public.intake_editorial_actions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intake_run_logs
CREATE TABLE public.intake_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text,
  source text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text,
  items_fetched integer DEFAULT 0,
  items_processed integer DEFAULT 0,
  rules_rejected_count integer DEFAULT 0,
  review_count integer DEFAULT 0,
  draft_approved_count integer DEFAULT 0,
  rate_limit_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  summary jsonb
);

ALTER TABLE public.intake_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_run_logs"
  ON public.intake_run_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_run_logs"
  ON public.intake_run_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_run_logs"
  ON public.intake_run_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- intake_duplicate_candidates
CREATE TABLE public.intake_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_product_id uuid REFERENCES public.intake_normalized_products(id),
  matched_reference text,
  match_type text,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.intake_duplicate_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_duplicate_candidates"
  ON public.intake_duplicate_candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intake_duplicate_candidates"
  ON public.intake_duplicate_candidates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update intake_duplicate_candidates"
  ON public.intake_duplicate_candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
