
ALTER TABLE categories
  ADD CONSTRAINT categories_slug_unique UNIQUE (slug);

ALTER TABLE style_guides
  ADD CONSTRAINT style_guides_slug_unique UNIQUE (slug);
