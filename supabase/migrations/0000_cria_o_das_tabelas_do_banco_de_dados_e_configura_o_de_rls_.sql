-- Habilitar a extensão uuid-ossp para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Perfis (profiles)
-- Armazena informações adicionais do usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para a tabela profiles
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE TO authenticated USING (auth.uid() = id);

-- Função para inserir perfil quando um novo usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  RETURN new;
END;
$$;

-- Trigger para chamar a função ao criar um novo usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Tabela de Organizações Militares (organizacoes_militares)
-- Armazena a lista de OMs que o usuário pode gerenciar
CREATE TABLE public.organizacoes_militares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome_om TEXT NOT NULL,
  codug_om TEXT NOT NULL,
  rm_vinculacao TEXT NOT NULL,
  codug_rm_vinculacao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, codug_om) -- Garante que cada usuário tenha CODUGs únicos
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.organizacoes_militares ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para organizacoes_militares
CREATE POLICY "Users can only see their own oms" ON public.organizacoes_militares
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own oms" ON public.organizacoes_militares
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own oms" ON public.organizacoes_militares
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own oms" ON public.organizacoes_militares
FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 3. Tabela de Planos de Trabalho (p_trab)
-- Armazena os dados principais de cada Plano de Trabalho
CREATE TABLE public.p_trab (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  numero_ptrab TEXT NOT NULL,
  comando_militar_area TEXT NOT NULL,
  nome_om TEXT NOT NULL,
  nome_om_extenso TEXT,
  codug_om TEXT,
  rm_vinculacao TEXT,
  codug_rm_vinculacao TEXT,
  nome_operacao TEXT NOT NULL,
  periodo_inicio TEXT NOT NULL,
  periodo_fim TEXT NOT NULL,
  efetivo_empregado TEXT NOT NULL,
  acoes TEXT,
  status TEXT DEFAULT 'aberto' NOT NULL, -- 'aberto', 'em_andamento', 'completo', 'arquivado'
  nome_cmt_om TEXT,
  local_om TEXT,
  comentario TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, numero_ptrab) -- Garante que cada usuário tenha números de PTrab únicos
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.p_trab ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para p_trab
CREATE POLICY "Users can only see their own ptrabs" ON public.p_trab
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own ptrabs" ON public.p_trab
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own ptrabs" ON public.p_trab
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own ptrabs" ON public.p_trab
FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 4. Tabela de Referência LPC (p_trab_ref_lpc)
-- Armazena os dados de referência de preços para cada PTrab
CREATE TABLE public.p_trab_ref_lpc (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID REFERENCES public.p_trab(id) ON DELETE CASCADE NOT NULL UNIQUE, -- One-to-one relationship
  ambito TEXT NOT NULL, -- 'Nacional', 'Estadual', 'Municipal'
  nome_local TEXT,
  data_inicio_consulta TEXT NOT NULL,
  data_fim_consulta TEXT NOT NULL,
  preco_diesel NUMERIC NOT NULL,
  preco_gasolina NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.p_trab_ref_lpc ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para p_trab_ref_lpc
CREATE POLICY "Users can only see their own ref_lpc" ON public.p_trab_ref_lpc
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only insert their own ref_lpc" ON public.p_trab_ref_lpc
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only update their own ref_lpc" ON public.p_trab_ref_lpc
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only delete their own ref_lpc" ON public.p_trab_ref_lpc
FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));


-- 5. Tabela de Registros da Classe I (classe_i_registros)
-- Armazena os registros de subsistência para cada PTrab
CREATE TABLE public.classe_i_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID REFERENCES public.p_trab(id) ON DELETE CASCADE NOT NULL,
  organizacao TEXT NOT NULL,
  ug TEXT NOT NULL,
  om_qs TEXT NOT NULL,
  ug_qs TEXT NOT NULL,
  efetivo INTEGER NOT NULL,
  dias_operacao INTEGER NOT NULL,
  nr_ref_int INTEGER NOT NULL,
  valor_qs NUMERIC NOT NULL,
  valor_qr NUMERIC NOT NULL,
  complemento_qs NUMERIC NOT NULL,
  etapa_qs NUMERIC NOT NULL,
  total_qs NUMERIC NOT NULL,
  complemento_qr NUMERIC NOT NULL,
  etapa_qr NUMERIC NOT NULL,
  total_qr NUMERIC NOT NULL,
  total_geral NUMERIC NOT NULL,
  fase_atividade TEXT, -- Pode ser uma string CSV de fases
  memoria_calculo_qs_customizada TEXT,
  memoria_calculo_qr_customizada TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.classe_i_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para classe_i_registros
CREATE POLICY "Users can only see their own classe_i_records" ON public.classe_i_registros
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only insert their own classe_i_records" ON public.classe_i_registros
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only update their own classe_i_records" ON public.classe_i_registros
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only delete their own classe_i_records" ON public.classe_i_registros
FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));


-- 6. Tabela de Registros da Classe III (classe_iii_registros)
-- Armazena os registros de combustíveis e lubrificantes para cada PTrab
CREATE TABLE public.classe_iii_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  p_trab_id UUID REFERENCES public.p_trab(id) ON DELETE CASCADE NOT NULL,
  tipo_equipamento TEXT NOT NULL, -- 'GERADOR', 'EMBARCACAO', 'EQUIPAMENTO_ENGENHARIA', 'MOTOMECANIZACAO'
  organizacao TEXT NOT NULL,
  ug TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  potencia_hp NUMERIC,
  horas_dia NUMERIC,
  dias_operacao INTEGER NOT NULL,
  consumo_hora NUMERIC,
  consumo_km_litro NUMERIC,
  km_dia NUMERIC,
  tipo_combustivel TEXT NOT NULL, -- 'GASOLINA', 'DIESEL'
  preco_litro NUMERIC NOT NULL,
  tipo_equipamento_detalhe TEXT,
  total_litros NUMERIC NOT NULL,
  total_litros_sem_margem NUMERIC,
  valor_total NUMERIC NOT NULL,
  detalhamento TEXT,
  detalhamento_customizado TEXT,
  itens_equipamentos JSONB, -- Para armazenar detalhes de múltiplos itens (ex: vários geradores)
  fase_atividade TEXT, -- Pode ser uma string CSV de fases
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.classe_iii_registros ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para classe_iii_registros
CREATE POLICY "Users can only see their own classe_iii_records" ON public.classe_iii_registros
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only insert their own classe_iii_records" ON public.classe_iii_registros
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only update their own classe_iii_records" ON public.classe_iii_registros
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));

CREATE POLICY "Users can only delete their own classe_iii_records" ON public.classe_iii_registros
FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.p_trab WHERE id = p_trab_id AND user_id = auth.uid()));


-- 7. Tabela de Diretrizes de Custeio (diretrizes_custeio)
-- Armazena as diretrizes de custeio por ano para cada usuário
CREATE TABLE public.diretrizes_custeio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ano_referencia INTEGER NOT NULL,
  classe_i_valor_qs NUMERIC DEFAULT 0 NOT NULL,
  classe_i_valor_qr NUMERIC DEFAULT 0 NOT NULL,
  classe_iii_fator_gerador NUMERIC DEFAULT 0 NOT NULL,
  classe_iii_fator_embarcacao NUMERIC DEFAULT 0 NOT NULL,
  classe_iii_fator_equip_engenharia NUMERIC DEFAULT 0 NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, ano_referencia) -- Garante que cada usuário tenha apenas uma diretriz por ano
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.diretrizes_custeio ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para diretrizes_custeio
CREATE POLICY "Users can only see their own diretrizes" ON public.diretrizes_custeio
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own diretrizes" ON public.diretrizes_custeio
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own diretrizes" ON public.diretrizes_custeio
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own diretrizes" ON public.diretrizes_custeio
FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- 8. Tabela de Diretrizes de Equipamentos Classe III (diretrizes_equipamentos_classe_iii)
-- Armazena as configurações de consumo para equipamentos da Classe III
CREATE TABLE public.diretrizes_equipamentos_classe_iii (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ano_referencia INTEGER NOT NULL,
  categoria TEXT NOT NULL, -- 'GERADOR', 'EMBARCACAO', 'EQUIPAMENTO_ENGENHARIA', 'MOTOMECANIZACAO'
  nome_equipamento TEXT NOT NULL,
  tipo_combustivel TEXT NOT NULL, -- 'GAS', 'OD'
  consumo NUMERIC NOT NULL,
  unidade TEXT NOT NULL, -- 'L/h', 'km/L'
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, ano_referencia, categoria, nome_equipamento) -- Garante unicidade por usuário, ano, categoria e nome
);

-- Habilitar RLS (OBRIGATÓRIO para segurança)
ALTER TABLE public.diretrizes_equipamentos_classe_iii ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para diretrizes_equipamentos_classe_iii
CREATE POLICY "Users can only see their own equipment directives" ON public.diretrizes_equipamentos_classe_iii
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own equipment directives" ON public.diretrizes_equipamentos_classe_iii
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own equipment directives" ON public.diretrizes_equipamentos_classe_iii
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own equipment directives" ON public.diretrizes_equipamentos_classe_iii
FOR DELETE TO authenticated USING (auth.uid() = user_id);