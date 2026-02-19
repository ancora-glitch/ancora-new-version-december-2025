-- Add review_required to product_status enum
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'review_required';