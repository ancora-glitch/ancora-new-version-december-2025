-- Create enum type for ancora_select_source
CREATE TYPE public.ancora_select_source AS ENUM ('tradera');

-- Add nullable column to products table
ALTER TABLE public.products
ADD COLUMN ancora_select_source public.ancora_select_source DEFAULT NULL;