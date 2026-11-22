CREATE TABLE public.stadsmissionen_auto_import_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE DEFAULT 'default',
  brands text[] NOT NULL DEFAULT '{}',
  materials text[] NOT NULL DEFAULT '{}',
  colors text[] NOT NULL DEFAULT '{}',
  target_count integer NOT NULL DEFAULT 30 CHECK (target_count BETWEEN 1 AND 50),
  active boolean NOT NULL DEFAULT false,
  running_started_at timestamptz,
  last_run_at timestamptz,
  last_run_status text,
  last_run_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stadsmissionen_auto_import_configs TO authenticated;
GRANT ALL ON public.stadsmissionen_auto_import_configs TO service_role;

ALTER TABLE public.stadsmissionen_auto_import_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read Stadsmissionen auto import config"
ON public.stadsmissionen_auto_import_configs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create Stadsmissionen auto import config"
ON public.stadsmissionen_auto_import_configs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update Stadsmissionen auto import config"
ON public.stadsmissionen_auto_import_configs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete Stadsmissionen auto import config"
ON public.stadsmissionen_auto_import_configs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_stadsmissionen_auto_import_configs_updated_at
BEFORE UPDATE ON public.stadsmissionen_auto_import_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();