DROP POLICY IF EXISTS "Products are publicly viewable" ON public.products;

CREATE POLICY "Public can view active and sold products"
ON public.products
FOR SELECT
TO public
USING (status IN ('active', 'sold'));

CREATE POLICY "Admins can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));