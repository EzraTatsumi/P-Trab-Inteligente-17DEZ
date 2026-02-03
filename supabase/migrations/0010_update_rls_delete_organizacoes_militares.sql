-- 0010_update_rls_delete_organizacoes_militares.sql

-- 1. Drop the existing DELETE policy
DROP POLICY IF EXISTS "Users can only delete their own oms" ON public.organizacoes_militares;

-- 2. Create a new DELETE policy allowing authenticated users to delete their own records (user_id = auth.uid()) 
--    OR default records (user_id IS NULL).
CREATE POLICY "Users can delete their own or default oms" ON public.organizacoes_militares
FOR DELETE TO authenticated USING (
  (auth.uid() = user_id) OR (user_id IS NULL)
);