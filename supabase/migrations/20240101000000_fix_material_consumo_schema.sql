-- 1. Remove a tabela antiga e dependências (policies/triggers)
DROP TABLE IF EXISTS public.material_consumo_registros CASCADE;

-- 2. Cria a tabela com a estrutura correta para Grupos de Aquisição
CREATE TABLE public.material_consumo_registros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
    
    -- Contextual fields (Lote)
    organizacao TEXT NOT NULL,
    ug TEXT NOT NULL,
    om_detentora TEXT,
    ug_detentora TEXT,
    dias_operacao INTEGER NOT NULL DEFAULT 1,
    efetivo INTEGER NOT NULL DEFAULT 0,
    fase_atividade TEXT,
    
    -- Acquisition Group fields (one record per group)
    group_name TEXT NOT NULL,
    group_purpose TEXT,
    itens_aquisicao JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Calculated values
    valor_total NUMERIC NOT NULL DEFAULT 0,
    valor_nd_30 NUMERIC NOT NULL DEFAULT 0,
    valor_nd_39 NUMERIC NOT NULL DEFAULT 0,
    
    -- Customization
    detalhamento_customizado TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilita RLS (Obrigatório)
ALTER TABLE public.material_consumo_registros ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
CREATE POLICY "Users can see their own or shared material_consumo records" ON public.material_consumo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can insert their own or shared material_consumo records" ON public.material_consumo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can update their own or shared material_consumo records" ON public.material_consumo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can delete their own or shared material_consumo records" ON public.material_consumo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- 5. Triggers para updated_at e p_trab_timestamp
CREATE TRIGGER set_updated_at_material_consumo
BEFORE UPDATE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_ptrab_on_material_consumo_change
AFTER INSERT OR UPDATE OR DELETE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();