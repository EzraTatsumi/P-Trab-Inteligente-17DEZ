-- Tabela para armazenar diretrizes de consumo e custo de concessionárias
CREATE TABLE public.diretrizes_concessionaria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ano_referencia INTEGER NOT NULL,
  categoria TEXT NOT NULL, -- 'AGUA_ESGOTO' ou 'ENERGIA_ELETRICA'
  nome_concessionaria TEXT NOT NULL,
  consumo_pessoa_dia NUMERIC NOT NULL DEFAULT 0,
  fonte_consumo TEXT,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  fonte_custo TEXT,
  unidade_custo TEXT NOT NULL, -- 'm3' ou 'kWh'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garante que não haja duplicidade de categoria/ano/usuário (embora a categoria possa ter múltiplos itens)
  UNIQUE (user_id, ano_referencia, nome_concessionaria, categoria)
);

-- Habilitar RLS (OBRIGATÓRIO)
ALTER TABLE public.diretrizes_concessionaria ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: Usuários autenticados podem ver suas próprias diretrizes
CREATE POLICY "Users can only see their own concessionaria directives" ON public.diretrizes_concessionaria 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Política de INSERT: Usuários autenticados podem inserir suas próprias diretrizes
CREATE POLICY "Users can only insert their own concessionaria directives" ON public.diretrizes_concessionaria 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Política de UPDATE: Usuários autenticados podem atualizar suas próprias diretrizes
CREATE POLICY "Users can only update their own concessionaria directives" ON public.diretrizes_concessionaria 
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Política de DELETE: Usuários autenticados podem deletar suas próprias diretrizes
CREATE POLICY "Users can only delete their own concessionaria directives" ON public.diretrizes_concessionaria 
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger para atualizar o timestamp
CREATE TRIGGER set_updated_at_concessionaria
BEFORE UPDATE ON public.diretrizes_concessionaria
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();