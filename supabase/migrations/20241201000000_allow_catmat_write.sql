-- RLS Policy for catalogo_catmat

-- Allow authenticated users to insert new CATMAT entries
CREATE POLICY "Authenticated users can insert catmat entries" ON public.catalogo_catmat
FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update existing CATMAT entries (e.g., adding a short description)
CREATE POLICY "Authenticated users can update catmat entries" ON public.catalogo_catmat
FOR UPDATE TO authenticated USING (true);