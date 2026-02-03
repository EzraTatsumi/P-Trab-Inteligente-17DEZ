-- Tabela para armazenar os registros de Horas de Voo (AvEx)
CREATE TABLE public.horas_voo_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
  
  -- Dados da Solicitação (OM Favorecida)
  organizacao TEXT NOT NULL, -- Nome da OM Favorecida (do PTrab)
  ug TEXT NOT NULL,          -- UG da OM Favorecida
  
  -- Dados do Recurso (OM Detentora/Destino)
  om_detentora TEXT,         -- OM Detentora do Recurso (Pode ser a mesma que 'organizacao')
  ug_detentora TEXT,         -- UG Detentora do Recurso
  
  dias_operacao INTEGER NOT NULL DEFAULT 1,
  fase_atividade TEXT,
  
  -- Campos Específicos de Horas de Voo
  codug_destino TEXT NOT NULL, -- CODUG do Município/Destino
  municipio TEXT NOT NULL,     -- Nome do Município/Destino
  quantidade_hv NUMERIC NOT NULL, -- Quantidade de Horas de Voo
  tipo_anv TEXT NOT NULL,      -- Tipo de Aeronave (Ex: HM-1, HM-4)
  amparo TEXT,                 -- Amparo Legal/Diretriz
  
  -- Valores de Custeio
  valor_nd_30 NUMERIC NOT NULL DEFAULT 0, -- ND 33.90.30 (Custeio)
  valor_nd_39 NUMERIC NOT NULL DEFAULT 0, -- ND 33.90.39 (Serviços)
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Detalhamento e Memória
  detalhamento TEXT,
  detalhamento_customizado TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Obrigatório)
ALTER TABLE public.horas_voo_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (Usando a função is_ptrab_owner_or_shared para segurança)
CREATE POLICY "Users can see their own or shared horas_voo records" ON public.horas_voo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can insert their own or shared horas_voo records" ON public.horas_voo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can update their own or shared horas_voo records" ON public.horas_voo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can delete their own or shared horas_voo records" ON public.horas_voo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- Trigger para atualizar o timestamp do PTrab (Reutilizando a função existente)
CREATE TRIGGER update_ptrab_on_horas_voo_change
AFTER INSERT OR UPDATE OR DELETE ON public.horas_voo_registros
FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();