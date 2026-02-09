-- Tabela para armazenar os registros de Material de Consumo (ND 33.90.30 e 33.90.39)
CREATE TABLE public.material_consumo_registros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
    
    -- Dados da Solicitação
    organizacao TEXT NOT NULL,
    ug TEXT NOT NULL,
    om_detentora TEXT,
    ug_detentora TEXT,
    dias_operacao INTEGER NOT NULL,
    efetivo INTEGER NOT NULL,
    fase_atividade TEXT,
    
    -- Dados do Grupo de Aquisição
    group_name TEXT NOT NULL,
    group_purpose TEXT,
    itens_aquisicao JSONB NOT NULL, -- Array de ItemAquisicao
    
    -- Valores Calculados
    valor_total NUMERIC DEFAULT 0 NOT NULL,
    valor_nd_30 NUMERIC DEFAULT 0 NOT NULL,
    valor_nd_39 NUMERIC DEFAULT 0 NOT NULL,
    
    -- Detalhamento
    detalhamento_customizado TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. RLS: Habilitar RLS
ALTER TABLE public.material_consumo_registros ENABLE ROW LEVEL SECURITY;

-- 2. RLS: Políticas de Acesso (Usando a função is_ptrab_owner_or_shared)
CREATE POLICY "Users can see their own or shared material_consumo records" ON public.material_consumo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can insert their own or shared material_consumo records" ON public.material_consumo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can update their own or shared material_consumo records" ON public.material_consumo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can delete their own or shared material_consumo records" ON public.material_consumo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- 3. Trigger: Atualizar o campo updated_at do registro
DROP TRIGGER IF EXISTS set_updated_at_material_consumo ON public.material_consumo_registros;
CREATE TRIGGER set_updated_at_material_consumo
BEFORE UPDATE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Trigger: Atualizar o timestamp do PTrab pai
DROP TRIGGER IF EXISTS update_ptrab_on_material_consumo_change ON public.material_consumo_registros;
CREATE TRIGGER update_ptrab_on_material_consumo_change
AFTER INSERT OR UPDATE OR DELETE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();