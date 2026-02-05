-- Tabela para armazenar diretrizes de Material de Consumo (Classe IX)
CREATE TABLE public.diretrizes_material_consumo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano_referencia INTEGER NOT NULL,
  
  -- Dados do Subitem da Natureza da Despesa (equivalente ao Contrato)
  nr_subitem TEXT NOT NULL,
  nome_subitem TEXT NOT NULL,
  descricao_subitem TEXT NULL, -- Detalhamento do propósito
  
  -- Array de Itens de Aquisição (equivalente aos Trechos)
  itens_aquisicao JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garante que o usuário só tenha um subitem com o mesmo número por ano
  UNIQUE (user_id, ano_referencia, nr_subitem)
);

-- Habilita RLS (OBRIGATÓRIO)
ALTER TABLE public.diretrizes_material_consumo ENABLE ROW LEVEL SECURITY;

-- Trigger para atualizar 'updated_at'
CREATE TRIGGER set_updated_at_diretrizes_material_consumo
BEFORE UPDATE ON public.diretrizes_material_consumo
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Políticas de RLS (Apenas o dono pode ver/inserir/atualizar/deletar)
CREATE POLICY "Users can only see their own material consumo directives" ON public.diretrizes_material_consumo
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can only insert their own material consumo directives" ON public.diretrizes_material_consumo
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update their own material consumo directives" ON public.diretrizes_material_consumo
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can only delete their own material consumo directives" ON public.diretrizes_material_consumo
FOR DELETE TO authenticated USING (user_id = auth.uid());