-- Enable RLS on the table (if not already enabled)
ALTER TABLE public.material_consumo_registros ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (Read access)
DROP POLICY IF EXISTS "Users can see their own or shared material_consumo records" ON public.material_consumo_registros;
CREATE POLICY "Users can see their own or shared material_consumo records" ON public.material_consumo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- Policy for INSERT (Create access)
DROP POLICY IF EXISTS "Users can insert their own or shared material_consumo records" ON public.material_consumo_registros;
CREATE POLICY "Users can insert their own or shared material_consumo records" ON public.material_consumo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

-- Policy for UPDATE (Modify access)
DROP POLICY IF EXISTS "Users can update their own or shared material_consumo records" ON public.material_consumo_registros;
CREATE POLICY "Users can update their own or shared material_consumo records" ON public.material_consumo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- Policy for DELETE (Delete access)
DROP POLICY IF EXISTS "Users can delete their own or shared material_consumo records" ON public.material_consumo_registros;
CREATE POLICY "Users can delete their own or shared material_consumo records" ON public.material_consumo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));