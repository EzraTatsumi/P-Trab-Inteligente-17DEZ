-- Drop existing policy to recreate it with optimized syntax
DROP POLICY IF EXISTS "Users can see their own or default oms" ON public.organizacoes_militares;