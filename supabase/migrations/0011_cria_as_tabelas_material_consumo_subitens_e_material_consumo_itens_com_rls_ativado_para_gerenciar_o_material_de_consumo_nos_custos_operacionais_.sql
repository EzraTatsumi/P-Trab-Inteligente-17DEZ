-- Cria a tabela de subitens (categorias)
CREATE TABLE public.material_consumo_subitens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.material_consumo_subitens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para subitens
CREATE POLICY "Allow authenticated users to view their subitems" ON public.material_consumo_subitens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their subitems" ON public.material_consumo_subitens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their subitems" ON public.material_consumo_subitens
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their subitems" ON public.material_consumo_subitens
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cria a tabela de itens
CREATE TABLE public.material_consumo_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subitem_id UUID REFERENCES public.material_consumo_subitens(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  pregao TEXT,
  uasg TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.material_consumo_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para itens
CREATE POLICY "Allow authenticated users to view their items" ON public.material_consumo_itens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their items" ON public.material_consumo_itens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their items" ON public.material_consumo_itens
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their items" ON public.material_consumo_itens
FOR DELETE TO authenticated USING (auth.uid() = user_id);