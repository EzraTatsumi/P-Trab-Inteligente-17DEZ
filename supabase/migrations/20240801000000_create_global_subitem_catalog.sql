-- Tabela para armazenar o catálogo global de subitens de material de consumo
CREATE TABLE public.catalogo_subitens_global (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nr_subitem TEXT,
  nome_subitem TEXT NOT NULL,
  descricao_subitem TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.catalogo_subitens_global ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Permitir que QUALQUER usuário autenticado leia o catálogo global
CREATE POLICY "Allow authenticated users to read global catalog" ON public.catalogo_subitens_global
FOR SELECT TO authenticated USING (true);