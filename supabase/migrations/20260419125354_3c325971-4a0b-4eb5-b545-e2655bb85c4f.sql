CREATE TABLE public.intake_editorial_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_editorial_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select intake_editorial_briefs"
  ON public.intake_editorial_briefs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert intake_editorial_briefs"
  ON public.intake_editorial_briefs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update intake_editorial_briefs"
  ON public.intake_editorial_briefs FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete intake_editorial_briefs"
  ON public.intake_editorial_briefs FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX intake_editorial_briefs_one_active
  ON public.intake_editorial_briefs (is_active)
  WHERE is_active = true;

CREATE TRIGGER update_intake_editorial_briefs_updated_at
  BEFORE UPDATE ON public.intake_editorial_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();