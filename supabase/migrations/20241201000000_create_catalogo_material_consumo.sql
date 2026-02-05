-- 1. Criação da Tabela de Catálogo Mestre
CREATE TABLE public.catalogo_material_consumo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT,
  unidade_medida TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilita RLS (Obrigatório)
ALTER TABLE public.catalogo_material_consumo ENABLE ROW LEVEL SECURITY;

-- 3. Política de Leitura Pública (Permite que QUALQUER usuário autenticado leia o catálogo)
CREATE POLICY "Allow authenticated users to read catalog" ON public.catalogo_material_consumo
FOR SELECT TO authenticated USING (true);

-- 4. Política de Inserção/Atualização (Nega escrita via API do cliente para manter a integridade do catálogo mestre)
CREATE POLICY "Deny all writes" ON public.catalogo_material_consumo
FOR ALL TO authenticated WITH CHECK (false);