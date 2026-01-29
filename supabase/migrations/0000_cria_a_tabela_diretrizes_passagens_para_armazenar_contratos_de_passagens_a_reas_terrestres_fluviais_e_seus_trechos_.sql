-- Tabela para armazenar contratos de passagens (pregões) e seus trechos
CREATE TABLE public.diretrizes_passagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ano_referencia INTEGER NOT NULL,
  
  -- Dados do Contrato/OM de Referência
  om_referencia TEXT NOT NULL,
  ug_referencia TEXT NOT NULL,
  numero_pregao TEXT, -- Número do Pregão/Contrato
  
  -- Trechos de Viagem (JSONB para armazenar a lista de trechos)
  trechos JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Restrição para garantir que o usuário só tenha um contrato por OM/UG por ano (opcional, mas útil)
  CONSTRAINT unique_passagem_diretriz UNIQUE (user_id, ano_referencia, om_referencia, ug_referencia)
);

-- Habilita RLS (Obrigatório)
ALTER TABLE public.diretrizes_passagens ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS)
CREATE POLICY "Users can only see their own passage directives" ON public.diretrizes_passagens 
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can only insert their own passage directives" ON public.diretrizes_passagens 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update their own passage directives" ON public.diretrizes_passagens 
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can only delete their own passage directives" ON public.diretrizes_passagens 
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger para atualizar 'updated_at'
CREATE TRIGGER set_updated_at_diretrizes_passagens
BEFORE UPDATE ON public.diretrizes_passagens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();