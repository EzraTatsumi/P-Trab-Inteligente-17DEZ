-- 1. Criação da Tabela de Catálogo CATMAT
CREATE TABLE public.catalogo_catmat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS (Obrigatório)
ALTER TABLE public.catalogo_catmat ENABLE ROW LEVEL SECURITY;

-- 3. Política de Leitura para Usuários Autenticados
CREATE POLICY "Authenticated users can read catmat catalog" ON public.catalogo_catmat
FOR SELECT TO authenticated USING (true);

-- 4. Adicionar Trigger de Atualização de Timestamp (Recomendado)
CREATE TRIGGER set_updated_at_catmat
BEFORE UPDATE ON public.catalogo_catmat
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();