-- Create enums for AIS
CREATE TYPE ais_source_type AS ENUM ('tradera', 'ebay', 'manual', 'csv', 'other');
CREATE TYPE ais_condition AS ENUM ('new', 'excellent', 'good', 'fair', 'unknown');
CREATE TYPE ais_status AS ENUM ('draft', 'reviewed', 'promoted', 'discarded');

-- Create the ancora_import_items table
CREATE TABLE public.ancora_import_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core identity
  source_type ais_source_type NOT NULL,
  source_ref TEXT NOT NULL,
  source_url TEXT,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  
  -- Commercial
  price NUMERIC,
  currency TEXT,
  condition ais_condition,
  
  -- Provenance
  provenance TEXT,
  
  -- Signals (JSON object)
  signals JSONB DEFAULT '{"keywords": [], "colors": [], "era": null, "material": null, "vibe": null}'::jsonb,
  
  -- Workflow
  status ais_status NOT NULL DEFAULT 'draft',
  
  -- Relations
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Metadata
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  promoted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ancora_import_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access (internal, editorial tool)
CREATE POLICY "Only admins can view import items"
ON public.ancora_import_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert import items"
ON public.ancora_import_items
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update import items"
ON public.ancora_import_items
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete import items"
ON public.ancora_import_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for common queries
CREATE INDEX idx_ancora_import_items_status ON public.ancora_import_items(status);
CREATE INDEX idx_ancora_import_items_source_type ON public.ancora_import_items(source_type);
CREATE INDEX idx_ancora_import_items_created_at ON public.ancora_import_items(created_at DESC);