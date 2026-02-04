-- Criação da tabela para o catálogo global de subitens
CREATE TABLE public.catalogo_subitens_global (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nr_subitem TEXT,
  nome_subitem TEXT NOT NULL,
  descricao_subitem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Obrigatório)
ALTER TABLE public.catalogo_subitens_global ENABLE ROW LEVEL SECURITY;

-- Política de Leitura Pública (SELECT)
-- Permite que qualquer usuário (anon ou authenticated) leia os dados do catálogo.
CREATE POLICY "Allow public read access to global catalog" ON public.catalogo_subitens_global
FOR SELECT USING (true);