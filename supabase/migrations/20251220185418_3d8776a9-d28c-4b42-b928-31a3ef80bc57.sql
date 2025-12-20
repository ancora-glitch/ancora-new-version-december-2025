-- Create storage policies for products bucket

-- Allow public read access (SELECT) for products bucket
CREATE POLICY "Public read access for products" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'products');

-- Allow admins to upload files to products bucket
CREATE POLICY "Admins can upload to products" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'products' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow admins to update files in products bucket
CREATE POLICY "Admins can update products files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'products' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow admins to delete files from products bucket
CREATE POLICY "Admins can delete products files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'products' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);