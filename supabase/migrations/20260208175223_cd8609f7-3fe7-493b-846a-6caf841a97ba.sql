-- Table to track Tradera API calls per UTC day
CREATE TABLE public.tradera_api_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tradera_api_usage_date_unique UNIQUE (usage_date)
);

-- Enable RLS (admin only)
ALTER TABLE public.tradera_api_usage ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions use service role)
CREATE POLICY "Service role only" ON public.tradera_api_usage
  FOR ALL USING (false);

-- Table to cache Tradera API responses
CREATE TABLE public.tradera_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL,
  cache_type text NOT NULL, -- 'search' | 'item'
  raw_payload jsonb NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tradera_cache_key_unique UNIQUE (cache_key)
);

-- Enable RLS
ALTER TABLE public.tradera_cache ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role only" ON public.tradera_cache
  FOR ALL USING (false);

-- Index for cache lookups
CREATE INDEX idx_tradera_cache_lookup ON public.tradera_cache (cache_key, expires_at);

-- Index for cleanup
CREATE INDEX idx_tradera_cache_expires ON public.tradera_cache (expires_at);

-- Function to increment and check Tradera API usage
CREATE OR REPLACE FUNCTION public.tradera_increment_usage(daily_limit integer DEFAULT 75)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  result jsonb;
BEGIN
  -- Insert or update today's usage
  INSERT INTO tradera_api_usage (usage_date, call_count)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (usage_date) 
  DO UPDATE SET 
    call_count = tradera_api_usage.call_count + 1,
    updated_at = now()
  RETURNING call_count INTO current_count;

  -- Check if limit exceeded (we already incremented, so check if > limit)
  IF current_count > daily_limit THEN
    -- Rollback the increment
    UPDATE tradera_api_usage 
    SET call_count = call_count - 1, updated_at = now()
    WHERE usage_date = CURRENT_DATE;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', current_count - 1,
      'daily_limit', daily_limit,
      'message', 'Tradera API quota reached for today'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', current_count,
    'daily_limit', daily_limit,
    'remaining', daily_limit - current_count
  );
END;
$$;

-- Function to get current usage without incrementing
CREATE OR REPLACE FUNCTION public.tradera_get_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  daily_limit integer := 75;
BEGIN
  SELECT call_count INTO current_count
  FROM tradera_api_usage
  WHERE usage_date = CURRENT_DATE;

  IF current_count IS NULL THEN
    current_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'current_count', current_count,
    'daily_limit', daily_limit,
    'remaining', daily_limit - current_count,
    'limit_reached', current_count >= daily_limit
  );
END;
$$;