-- Drop the existing check constraint and add a new one that allows all event types
ALTER TABLE public.site_analytics DROP CONSTRAINT IF EXISTS site_analytics_event_type_check;

ALTER TABLE public.site_analytics ADD CONSTRAINT site_analytics_event_type_check 
CHECK (event_type IN ('page_view', 'click', 'product_click', 'buy_now_click'));