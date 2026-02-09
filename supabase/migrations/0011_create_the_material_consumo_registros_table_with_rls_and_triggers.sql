-- 1. Create the table
CREATE TABLE public.material_consumo_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID NOT NULL REFERENCES public.p_trab(id) ON DELETE CASCADE,
  organizacao TEXT NOT NULL,
  ug TEXT NOT NULL,
  om_detentora TEXT,
  ug_detentora TEXT,
  dias_operacao INTEGER NOT NULL DEFAULT 1,
  fase_atividade TEXT,
  codug_destino TEXT NOT NULL,
  municipio TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0, -- Assuming a quantity field is needed for consumption
  descricao TEXT NOT NULL, -- Assuming a description of the material is needed
  amparo TEXT,
  valor_nd_30 NUMERIC NOT NULL DEFAULT 0,
  valor_nd_39 NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  detalhamento TEXT,
  detalhamento_customizado TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS (REQUIRED)
ALTER TABLE public.material_consumo_registros ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies using the existing function is_ptrab_owner_or_shared
CREATE POLICY "Users can see their own or shared material_consumo records" ON public.material_consumo_registros
FOR SELECT TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can insert their own or shared material_consumo records" ON public.material_consumo_registros
FOR INSERT TO authenticated WITH CHECK (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can update their own or shared material_consumo records" ON public.material_consumo_registros
FOR UPDATE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

CREATE POLICY "Users can delete their own or shared material_consumo records" ON public.material_consumo_registros
FOR DELETE TO authenticated USING (is_ptrab_owner_or_shared(p_trab_id));

-- 4. Add triggers to update p_trab timestamp on change
CREATE TRIGGER update_ptrab_on_material_consumo_change
  AFTER INSERT OR UPDATE OR DELETE ON public.material_consumo_registros
  FOR EACH ROW EXECUTE FUNCTION update_ptrab_timestamp();