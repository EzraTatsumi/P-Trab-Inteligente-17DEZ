-- Tabela para registros de Material de Consumo (ND 33.90.30 e 33.90.39)
CREATE TABLE public.material_consumo_registros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
    diretriz_id UUID NOT NULL REFERENCES public.diretrizes_material_consumo(id) ON DELETE RESTRICT, -- Referência à diretriz (subitem)
    
    -- Dados da OM Favorecida
    organizacao TEXT NOT NULL,
    ug TEXT NOT NULL,
    
    -- Dados da OM Detentora do Recurso
    om_detentora TEXT NOT NULL,
    ug_detentora TEXT NOT NULL,
    
    -- Dados da Solicitação
    dias_operacao INTEGER NOT NULL,
    efetivo INTEGER NOT NULL,
    fase_atividade TEXT,
    
    -- Dados do Subitem (Cópia da Diretriz)
    nr_subitem TEXT NOT NULL,
    nome_subitem TEXT NOT NULL,
    
    -- Itens de Aquisição Selecionados (JSONB array de ItemAquisicao com quantidade)
    itens_aquisicao_selecionados JSONB NOT NULL,
    
    -- Valores Calculados
    valor_total NUMERIC NOT NULL DEFAULT 0,
    valor_nd_30 NUMERIC NOT NULL DEFAULT 0,
    valor_nd_39 NUMERIC NOT NULL DEFAULT 0,
    
    -- Detalhamento
    detalhamento TEXT,
    detalhamento_customizado TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Habilitar RLS (MANDATÓRIO)
ALTER TABLE public.material_consumo_registros ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de RLS
-- SELECT: Usuário pode ver seus próprios registros ou registros de PTrabs compartilhados
CREATE POLICY "Users can see their own or shared material consumo records" ON public.material_consumo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- INSERT: Usuário pode inserir registros em PTrabs que ele possui ou compartilha
CREATE POLICY "Users can insert their own or shared material consumo records" ON public.material_consumo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

-- UPDATE: Usuário pode atualizar registros em PTrabs que ele possui ou compartilha
CREATE POLICY "Users can update their own or shared material consumo records" ON public.material_consumo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- DELETE: Usuário pode deletar registros em PTrabs que ele possui ou compartilha
CREATE POLICY "Users can delete their own or shared material consumo records" ON public.material_consumo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- 3. Triggers
-- Trigger para atualizar o timestamp 'updated_at' na própria tabela
DROP TRIGGER IF EXISTS set_updated_at_material_consumo_registros ON public.material_consumo_registros;
CREATE TRIGGER set_updated_at_material_consumo_registros
BEFORE UPDATE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para atualizar o timestamp 'updated_at' na tabela p_trab
DROP TRIGGER IF EXISTS update_ptrab_on_material_consumo_change ON public.material_consumo_registros;
CREATE TRIGGER update_ptrab_on_material_consumo_change
AFTER INSERT OR UPDATE OR DELETE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();