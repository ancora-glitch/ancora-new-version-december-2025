-- Enable public read access for guide-images bucket
CREATE POLICY "Public read access for guide-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'guide-images');

-- Allow admins to upload to guide-images bucket
CREATE POLICY "Admins can upload to guide-images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'guide-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update guide-images files
CREATE POLICY "Admins can update guide-images files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'guide-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete guide-images files
CREATE POLICY "Admins can delete guide-images files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'guide-images' AND has_role(auth.uid(), 'admin'::app_role));