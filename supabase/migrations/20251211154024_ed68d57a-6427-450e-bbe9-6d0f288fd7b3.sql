-- Add restrictive policies for UPDATE and DELETE on waitlist table
-- These block all client-side UPDATE/DELETE while service_role bypasses RLS

CREATE POLICY "No public update access"
ON public.waitlist
FOR UPDATE
USING (false);

CREATE POLICY "No public delete access"
ON public.waitlist
FOR DELETE
USING (false);