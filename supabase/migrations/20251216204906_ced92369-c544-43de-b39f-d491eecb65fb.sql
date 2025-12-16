-- Add admin-only RLS policies for style_guides write operations
-- (Similar to the products table policies)

CREATE POLICY "Admins can insert style guides"
ON public.style_guides
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update style guides"
ON public.style_guides
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete style guides"
ON public.style_guides
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));