-- Policy for SELECT (Read)
CREATE POLICY "Users can see their own or default oms" ON public.organizacoes_militares 
FOR SELECT TO authenticated USING ((user_id = (SELECT auth.uid())) OR (user_id IS NULL));