-- 1. Remove a política de UPDATE existente para evitar conflitos
DROP POLICY IF EXISTS "Users can only update their own oms" ON public.organizacoes_militares;

-- 2. Cria uma nova política de UPDATE que permite:
--    a) Atualizar suas próprias OMs (user_id = auth.uid())
--    b) Atualizar OMs padrão (user_id IS NULL)
CREATE POLICY "Users can update their own or default oms" ON public.organizacoes_militares
FOR UPDATE TO authenticated
USING (
    (auth.uid() = user_id) OR (user_id IS NULL)
);