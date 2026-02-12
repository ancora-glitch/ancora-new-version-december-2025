-- Allow admins to insert retry jobs from the client
CREATE POLICY "Admins can insert retry jobs"
ON public.tradera_retry_jobs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
