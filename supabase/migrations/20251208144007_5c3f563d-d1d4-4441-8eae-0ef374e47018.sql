-- Create waitlist table for email signups
CREATE TABLE public.waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert their email (public signup)
CREATE POLICY "Anyone can sign up for waitlist"
ON public.waitlist
FOR INSERT
WITH CHECK (true);

-- Prevent public from reading the waitlist
CREATE POLICY "No public read access"
ON public.waitlist
FOR SELECT
USING (false);