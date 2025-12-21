-- Change price column from numeric to text, preserving existing values
ALTER TABLE public.products
ALTER COLUMN price TYPE text USING price::text;