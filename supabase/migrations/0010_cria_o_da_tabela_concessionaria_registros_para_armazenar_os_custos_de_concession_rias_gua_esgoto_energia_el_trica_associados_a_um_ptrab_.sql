-- Tabela para registrar os custos de concessionárias por PTrab
CREATE TABLE public.concessionaria_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
  diretriz_id UUID NOT NULL REFERENCES public.diretrizes_concessionaria(id) ON DELETE RESTRICT,
  
  organizacao TEXT NOT NULL,
  ug TEXT NOT NULL,
  om_detentora TEXT,
  ug_detentora TEXT,
  
  dias_operacao INTEGER NOT NULL DEFAULT 1,
  efetivo INTEGER NOT NULL DEFAULT 0,
  
  categoria TEXT NOT NULL, -- Categoria da diretriz (Água/Esgoto, Energia Elétrica)
  
  valor_unitario NUMERIC NOT NULL DEFAULT 0, -- Custo unitário da diretriz
  consumo_pessoa_dia NUMERIC NOT NULL DEFAULT 0, -- Consumo por pessoa/dia da diretriz
  
  valor_total NUMERIC NOT NULL DEFAULT 0,
  valor_nd_39 NUMERIC NOT NULL DEFAULT 0, -- ND 33.90.39 (Custeio Operacional)
  
  detalhamento TEXT,
  detalhamento_customizado TEXT,
  fase_atividade TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Obrigatório)
ALTER TABLE public.concessionaria_registros ENABLE ROW LEVEL SECURITY;

-- Trigger para atualizar o timestamp do PTrab pai
CREATE TRIGGER update_ptrab_on_concessionaria_change
  AFTER INSERT OR UPDATE OR DELETE ON public.concessionaria_registros
  FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();

-- Trigger para atualizar o updated_at
CREATE TRIGGER set_updated_at_concessionaria_registros
  BEFORE UPDATE ON public.concessionaria_registros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Políticas de RLS
CREATE POLICY "Users can see their own or shared concessionaria records" ON public.concessionaria_registros 
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can insert their own or shared concessionaria records" ON public.concessionaria_registros 
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can update their own or shared concessionaria records" ON public.concessionaria_registros 
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can delete their own or shared concessionaria records" ON public.concessionaria_registros 
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));