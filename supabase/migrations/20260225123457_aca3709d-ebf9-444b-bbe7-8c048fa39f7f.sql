
ALTER TABLE public.tradera_cache ADD COLUMN IF NOT EXISTS cache_version integer NOT NULL DEFAULT 1;
