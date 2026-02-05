-- Create table for Material de Consumo Subitens (ND 33.90.30)
CREATE TABLE public.material_consumo_subitens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  codigo TEXT,
  unidade_medida TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.material_consumo_subitens ENABLE ROW LEVEL SECURITY;

-- Policies for user-specific data access
CREATE POLICY "Users can only see their own material_consumo_subitens" ON public.material_consumo_subitens
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own material_consumo_subitens" ON public.material_consumo_subitens
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own material_consumo_subitens" ON public.material_consumo_subitens
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own material_consumo_subitens" ON public.material_consumo_subitens
FOR DELETE TO authenticated USING (auth.uid() = user_id);