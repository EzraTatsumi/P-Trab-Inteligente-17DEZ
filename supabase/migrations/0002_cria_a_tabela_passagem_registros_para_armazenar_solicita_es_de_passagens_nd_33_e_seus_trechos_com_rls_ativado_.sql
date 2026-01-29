-- Tabela para armazenar os registros de passagens solicitadas em um PTrab
CREATE TABLE public.passagem_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
  
  -- OM Solicitante (Favorecida)
  organizacao TEXT NOT NULL,
  ug TEXT NOT NULL,
  
  -- OM Detentora do Recurso (OM Contratante da Diretriz)
  om_detentora TEXT NOT NULL,
  ug_detentora TEXT NOT NULL,
  
  -- Dados da Solicitação
  dias_operacao INTEGER NOT NULL DEFAULT 1,
  fase_atividade TEXT,
  
  -- Detalhes do Trecho Solicitado
  trecho_id UUID NOT NULL, -- ID do trecho na diretriz_passagens
  diretriz_id UUID NOT NULL REFERENCES public.diretrizes_passagens(id) ON DELETE RESTRICT, -- ID da diretriz de origem
  
  -- Dados do Trecho (Cópia para persistência)
  origem TEXT NOT NULL,
  destino TEXT NOT NULL,
  tipo_transporte TEXT NOT NULL, -- 'AÉREO', 'TERRESTRE', 'FLUVIAL'
  is_ida_volta BOOLEAN NOT NULL DEFAULT FALSE,
  valor_unitario NUMERIC NOT NULL DEFAULT 0, -- Valor do trecho
  
  -- Quantidade e Totais
  quantidade_passagens INTEGER NOT NULL DEFAULT 1,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Alocação de ND (Apenas ND 33 para Passagens)
  valor_nd_33 NUMERIC NOT NULL DEFAULT 0,
  
  -- Memória de Cálculo
  detalhamento TEXT,
  detalhamento_customizado TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS (Obrigatório)
ALTER TABLE public.passagem_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Acesso apenas se for dono ou compartilhado com o PTrab)
CREATE POLICY "Users can see their own or shared passagem records" ON public.passagem_registros 
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can insert their own or shared passagem records" ON public.passagem_registros 
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can update their own or shared passagem records" ON public.passagem_registros 
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can delete their own or shared passagem records" ON public.passagem_registros 
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- Trigger para atualizar o timestamp do PTrab quando um registro de passagem é alterado
CREATE TRIGGER update_ptrab_on_passagem_change
  AFTER INSERT OR UPDATE OR DELETE ON public.passagem_registros
  FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();