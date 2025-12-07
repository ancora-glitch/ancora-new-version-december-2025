-- Create a table for style guides
CREATE TABLE public.style_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image TEXT NOT NULL,
  intro_text TEXT NOT NULL,
  body TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.style_guides ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Style guides are publicly viewable" 
ON public.style_guides 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_style_guides_updated_at
BEFORE UPDATE ON public.style_guides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();