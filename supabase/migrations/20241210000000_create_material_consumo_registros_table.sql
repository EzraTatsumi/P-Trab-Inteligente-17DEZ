-- Tabela para armazenar os registros de Material de Consumo (ND 33.90.30 e 33.90.39)
CREATE TABLE public.material_consumo_registros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
    
    -- Dados da OM Favorecida (OM do PTrab)
    organizacao TEXT NOT NULL,
    ug TEXT NOT NULL,
    
    -- Dados da OM Detentora do Recurso (Pode ser diferente da OM Favorecida)
    om_detentora TEXT,
    ug_detentora TEXT,
    
    -- Contexto da Solicitação
    dias_operacao INTEGER NOT NULL DEFAULT 1,
    efetivo INTEGER NOT NULL DEFAULT 0,
    fase_atividade TEXT,
    
    -- Detalhes do Grupo de Aquisição
    group_name TEXT NOT NULL,
    group_purpose TEXT,
    itens_aquisicao JSONB NOT NULL DEFAULT '[]'::jsonb, -- Lista de ItemAquisicao
    
    -- Valores Calculados
    valor_total NUMERIC NOT NULL DEFAULT 0,
    valor_nd_30 NUMERIC NOT NULL DEFAULT 0,
    valor_nd_39 NUMERIC NOT NULL DEFAULT 0,
    
    -- Memória de Cálculo Customizada
    detalhamento_customizado TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Habilitar RLS (OBRIGATÓRIO)
ALTER TABLE public.material_consumo_registros ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de Acesso (Usando a função is_ptrab_owner_or_shared)

-- SELECT: Proprietário ou Compartilhado pode ver
CREATE POLICY "Users can see their own or shared material_consumo records" ON public.material_consumo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- INSERT: Proprietário ou Compartilhado pode inserir
CREATE POLICY "Users can insert their own or shared material_consumo records" ON public.material_consumo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

-- UPDATE: Proprietário ou Compartilhado pode atualizar
CREATE POLICY "Users can update their own or shared material_consumo records" ON public.material_consumo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- DELETE: Proprietário ou Compartilhado pode deletar
CREATE POLICY "Users can delete their own or shared material_consumo records" ON public.material_consumo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- 3. Triggers de Timestamp

-- Trigger para atualizar o updated_at da própria tabela
CREATE TRIGGER set_updated_at_material_consumo_registros
BEFORE UPDATE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para atualizar o updated_at da tabela p_trab quando um registro é alterado
CREATE TRIGGER update_ptrab_on_material_consumo_change
AFTER INSERT OR UPDATE OR DELETE ON public.material_consumo_registros
FOR EACH ROW EXECUTE FUNCTION public.update_ptrab_timestamp();