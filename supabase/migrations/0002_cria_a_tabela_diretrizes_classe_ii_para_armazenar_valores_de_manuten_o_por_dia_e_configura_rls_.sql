-- Tabela para armazenar os valores de manutenção por dia da Classe II
CREATE TABLE public.diretrizes_classe_ii (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ano_referencia INTEGER NOT NULL,
  categoria TEXT NOT NULL, -- Ex: Equipamento Individual, Proteção Balística
  item TEXT NOT NULL, -- Ex: Colete balístico, Barraca de campanha
  valor_mnt_dia NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garante que não haja itens duplicados para o mesmo usuário, ano e categoria
  CONSTRAINT unique_classe_ii_item UNIQUE (user_id, ano_referencia, item)
);

-- Habilita RLS (OBRIGATÓRIO)
ALTER TABLE public.diretrizes_classe_ii ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança: Usuários só podem ver/gerenciar suas próprias diretrizes
CREATE POLICY "Users can only see their own classe ii directives" ON public.diretrizes_classe_ii 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own classe ii directives" ON public.diretrizes_classe_ii 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own classe ii directives" ON public.diretrizes_classe_ii 
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own classe ii directives" ON public.diretrizes_classe_ii 
FOR DELETE TO authenticated USING (auth.uid() = user_id);