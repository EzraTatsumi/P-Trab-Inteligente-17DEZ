-- Tabela para armazenar os registros de Classe II (Material de Intendência)
CREATE TABLE public.classe_ii_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
  organizacao TEXT NOT NULL,
  ug TEXT NOT NULL,
  dias_operacao INTEGER NOT NULL,
  categoria TEXT NOT NULL, -- Ex: 'Equipamento Individual', 'Proteção Balística'
  itens_equipamentos JSONB NOT NULL, -- Lista de itens e quantidades
  valor_total NUMERIC NOT NULL,
  detalhamento TEXT,
  detalhamento_customizado TEXT,
  fase_atividade TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.classe_ii_registros ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver registros se forem donos do PTrab
CREATE POLICY "Users can only see their own classe ii records" ON public.classe_ii_registros 
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM p_trab WHERE p_trab.id = classe_ii_registros.p_trab_id AND p_trab.user_id = auth.uid()));

-- Policy: Usuários podem inserir registros se forem donos do PTrab
CREATE POLICY "Users can only insert their own classe ii records" ON public.classe_ii_registros 
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM p_trab WHERE p_trab.id = classe_ii_registros.p_trab_id AND p_trab.user_id = auth.uid()));

-- Policy: Usuários podem atualizar registros se forem donos do PTrab
CREATE POLICY "Users can only update their own classe ii records" ON public.classe_ii_registros 
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM p_trab WHERE p_trab.id = classe_ii_registros.p_trab_id AND p_trab.user_id = auth.uid()));

-- Policy: Usuários podem deletar registros se forem donos do PTrab
CREATE POLICY "Users can only delete their own classe ii records" ON public.classe_ii_registros 
FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM p_trab WHERE p_trab.id = classe_ii_registros.p_trab_id AND p_trab.user_id = auth.uid()));