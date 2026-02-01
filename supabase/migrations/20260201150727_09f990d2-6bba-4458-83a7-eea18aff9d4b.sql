-- Fix: Add admin SELECT policy for waitlist table so admins can view signups
-- This addresses waitlist_email_exposure finding
CREATE POLICY "Only admins can view waitlist"
  ON public.waitlist
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: Add email length constraint to prevent abuse (max email length per RFC 5321 is 320 chars)
-- This addresses permissive_insert_abuse finding
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_email_length_check CHECK (length(email) <= 320);

-- Fix: Add page_path length constraint to prevent abuse
-- This addresses permissive_insert_abuse and SUPA_rls_policy_always_true findings
ALTER TABLE public.site_analytics
  ADD CONSTRAINT analytics_page_path_length_check CHECK (length(page_path) <= 500);

-- Fix: Add event_type constraint if not already present
-- Limit to known event types to prevent arbitrary data insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'analytics_event_type_check'
  ) THEN
    ALTER TABLE public.site_analytics
      ADD CONSTRAINT analytics_event_type_check 
      CHECK (event_type IN ('page_view', 'click', 'product_click', 'buy_now_click'));
  END IF;
END $$;