-- Tabela A: Categorias (Nível 3)
CREATE TABLE public.diretrizes_material_consumo_categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ano_referencia INTEGER NOT NULL,
  nome_categoria TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, ano_referencia, nome_categoria)
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.diretrizes_material_consumo_categorias ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated users to read their own categories" ON public.diretrizes_material_consumo_categorias
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their own categories" ON public.diretrizes_material_consumo_categorias
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own categories" ON public.diretrizes_material_consumo_categorias
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own categories" ON public.diretrizes_material_consumo_categorias
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tabela B: Itens (Nível 4)
CREATE TABLE public.diretrizes_material_consumo_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID REFERENCES public.diretrizes_material_consumo_categorias(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  descricao_item TEXT NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  numero_pregao TEXT,
  uasg_referencia TEXT,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (categoria_id, descricao_item)
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.diretrizes_material_consumo_itens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated users to read their own items" ON public.diretrizes_material_consumo_itens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their own items" ON public.diretrizes_material_consumo_itens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own items" ON public.diretrizes_material_consumo_itens
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own items" ON public.diretrizes_material_consumo_itens
FOR DELETE TO authenticated USING (auth.uid() = user_id);