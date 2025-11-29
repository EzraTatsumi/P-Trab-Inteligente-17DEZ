CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: classe_i_registros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classe_i_registros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    p_trab_id uuid NOT NULL,
    organizacao text NOT NULL,
    ug text NOT NULL,
    om_qs text NOT NULL,
    ug_qs text NOT NULL,
    efetivo integer NOT NULL,
    dias_operacao integer NOT NULL,
    nr_ref_int integer NOT NULL,
    valor_qs numeric(10,2) NOT NULL,
    valor_qr numeric(10,2) NOT NULL,
    complemento_qs numeric(10,2) NOT NULL,
    etapa_qs numeric(10,2) NOT NULL,
    total_qs numeric(10,2) NOT NULL,
    complemento_qr numeric(10,2) NOT NULL,
    etapa_qr numeric(10,2) NOT NULL,
    total_qr numeric(10,2) NOT NULL,
    total_geral numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: classe_iii_registros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classe_iii_registros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    p_trab_id uuid NOT NULL,
    tipo_equipamento text NOT NULL,
    organizacao text NOT NULL,
    ug text NOT NULL,
    quantidade integer NOT NULL,
    potencia_hp numeric,
    horas_dia numeric,
    dias_operacao integer NOT NULL,
    consumo_hora numeric,
    consumo_km_litro numeric,
    km_dia numeric,
    tipo_combustivel text NOT NULL,
    preco_litro numeric NOT NULL,
    tipo_equipamento_detalhe text,
    total_litros numeric NOT NULL,
    valor_total numeric NOT NULL,
    detalhamento text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    itens_equipamentos jsonb,
    total_litros_sem_margem numeric,
    CONSTRAINT classe_iii_registros_tipo_equipamento_check CHECK ((tipo_equipamento = ANY (ARRAY['GERADOR'::text, 'EMBARCACAO'::text, 'EQUIPAMENTO_ENGENHARIA'::text, 'MOTOMECANIZACAO'::text])))
);


--
-- Name: diretrizes_custeio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diretrizes_custeio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ano_referencia integer NOT NULL,
    classe_i_valor_qs numeric DEFAULT 9.00 NOT NULL,
    classe_i_valor_qr numeric DEFAULT 6.00 NOT NULL,
    classe_iii_fator_gerador numeric DEFAULT 0.15 NOT NULL,
    classe_iii_fator_embarcacao numeric DEFAULT 0.30 NOT NULL,
    classe_iii_fator_equip_engenharia numeric DEFAULT 0.20 NOT NULL,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: diretrizes_equipamentos_classe_iii; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diretrizes_equipamentos_classe_iii (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ano_referencia integer NOT NULL,
    categoria text NOT NULL,
    nome_equipamento text NOT NULL,
    tipo_combustivel text NOT NULL,
    consumo numeric NOT NULL,
    unidade text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diretrizes_equipamentos_classe_iii_categoria_check CHECK ((categoria = ANY (ARRAY['GERADOR'::text, 'EMBARCACAO'::text, 'EQUIPAMENTO_ENGENHARIA'::text, 'MOTOMECANIZACAO'::text]))),
    CONSTRAINT diretrizes_equipamentos_classe_iii_tipo_combustivel_check CHECK ((tipo_combustivel = ANY (ARRAY['GAS'::text, 'OD'::text]))),
    CONSTRAINT diretrizes_equipamentos_classe_iii_unidade_check CHECK ((unidade = ANY (ARRAY['L/h'::text, 'km/L'::text])))
);


--
-- Name: organizacoes_militares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizacoes_militares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome_om text NOT NULL,
    codug_om text NOT NULL,
    rm_vinculacao text NOT NULL,
    codug_rm_vinculacao text NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: p_trab; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p_trab (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    numero_ptrab text NOT NULL,
    comando_militar_area text NOT NULL,
    nome_om text NOT NULL,
    nome_operacao text NOT NULL,
    periodo_inicio date NOT NULL,
    periodo_fim date NOT NULL,
    efetivo_empregado text NOT NULL,
    acoes text,
    status text DEFAULT 'aberto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nome_cmt_om text,
    local_om text,
    comentario text,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['aberto'::text, 'em_andamento'::text, 'completo'::text, 'arquivado'::text])))
);


--
-- Name: p_trab_ref_lpc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p_trab_ref_lpc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    p_trab_id uuid NOT NULL,
    data_inicio_consulta date NOT NULL,
    data_fim_consulta date NOT NULL,
    ambito text NOT NULL,
    nome_local text,
    preco_diesel numeric NOT NULL,
    preco_gasolina numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT p_trab_ref_lpc_ambito_check CHECK ((ambito = ANY (ARRAY['Nacional'::text, 'Estadual'::text, 'Municipal'::text])))
);


--
-- Name: classe_i_registros classe_i_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classe_i_registros
    ADD CONSTRAINT classe_i_registros_pkey PRIMARY KEY (id);


--
-- Name: classe_iii_registros classe_iii_registros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classe_iii_registros
    ADD CONSTRAINT classe_iii_registros_pkey PRIMARY KEY (id);


--
-- Name: diretrizes_custeio diretrizes_custeio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diretrizes_custeio
    ADD CONSTRAINT diretrizes_custeio_pkey PRIMARY KEY (id);


--
-- Name: diretrizes_custeio diretrizes_custeio_user_id_ano_referencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diretrizes_custeio
    ADD CONSTRAINT diretrizes_custeio_user_id_ano_referencia_key UNIQUE (user_id, ano_referencia);


--
-- Name: diretrizes_equipamentos_classe_iii diretrizes_equipamentos_class_user_id_ano_referencia_catego_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diretrizes_equipamentos_classe_iii
    ADD CONSTRAINT diretrizes_equipamentos_class_user_id_ano_referencia_catego_key UNIQUE (user_id, ano_referencia, categoria, nome_equipamento);


--
-- Name: diretrizes_equipamentos_classe_iii diretrizes_equipamentos_classe_iii_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diretrizes_equipamentos_classe_iii
    ADD CONSTRAINT diretrizes_equipamentos_classe_iii_pkey PRIMARY KEY (id);


--
-- Name: organizacoes_militares organizacoes_militares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizacoes_militares
    ADD CONSTRAINT organizacoes_militares_pkey PRIMARY KEY (id);


--
-- Name: organizacoes_militares organizacoes_militares_user_codug_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizacoes_militares
    ADD CONSTRAINT organizacoes_militares_user_codug_nome_key UNIQUE (user_id, codug_om, nome_om);


--
-- Name: p_trab p_trab_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p_trab
    ADD CONSTRAINT p_trab_pkey PRIMARY KEY (id);


--
-- Name: p_trab_ref_lpc p_trab_ref_lpc_p_trab_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p_trab_ref_lpc
    ADD CONSTRAINT p_trab_ref_lpc_p_trab_id_key UNIQUE (p_trab_id);


--
-- Name: p_trab_ref_lpc p_trab_ref_lpc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p_trab_ref_lpc
    ADD CONSTRAINT p_trab_ref_lpc_pkey PRIMARY KEY (id);


--
-- Name: idx_classe_iii_om_tipo_combustivel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classe_iii_om_tipo_combustivel ON public.classe_iii_registros USING btree (organizacao, tipo_equipamento, tipo_combustivel, p_trab_id);


--
-- Name: idx_om_codug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_om_codug ON public.organizacoes_militares USING btree (codug_om);


--
-- Name: idx_om_rm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_om_rm ON public.organizacoes_militares USING btree (rm_vinculacao);


--
-- Name: idx_om_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_om_user_id ON public.organizacoes_militares USING btree (user_id);


--
-- Name: classe_i_registros update_classe_i_registros_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_classe_i_registros_updated_at BEFORE UPDATE ON public.classe_i_registros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: classe_iii_registros update_classe_iii_registros_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_classe_iii_registros_updated_at BEFORE UPDATE ON public.classe_iii_registros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: diretrizes_custeio update_diretrizes_custeio_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_diretrizes_custeio_updated_at BEFORE UPDATE ON public.diretrizes_custeio FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: diretrizes_equipamentos_classe_iii update_diretrizes_equipamentos_classe_iii_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_diretrizes_equipamentos_classe_iii_updated_at BEFORE UPDATE ON public.diretrizes_equipamentos_classe_iii FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizacoes_militares update_organizacoes_militares_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizacoes_militares_updated_at BEFORE UPDATE ON public.organizacoes_militares FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: p_trab_ref_lpc update_p_trab_ref_lpc_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_p_trab_ref_lpc_updated_at BEFORE UPDATE ON public.p_trab_ref_lpc FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: p_trab update_p_trab_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_p_trab_updated_at BEFORE UPDATE ON public.p_trab FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: classe_i_registros classe_i_registros_p_trab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classe_i_registros
    ADD CONSTRAINT classe_i_registros_p_trab_id_fkey FOREIGN KEY (p_trab_id) REFERENCES public.p_trab(id) ON DELETE CASCADE;


--
-- Name: classe_iii_registros classe_iii_registros_p_trab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classe_iii_registros
    ADD CONSTRAINT classe_iii_registros_p_trab_id_fkey FOREIGN KEY (p_trab_id) REFERENCES public.p_trab(id) ON DELETE CASCADE;


--
-- Name: diretrizes_equipamentos_classe_iii diretrizes_equipamentos_classe_iii_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diretrizes_equipamentos_classe_iii
    ADD CONSTRAINT diretrizes_equipamentos_classe_iii_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: p_trab_ref_lpc p_trab_ref_lpc_p_trab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p_trab_ref_lpc
    ADD CONSTRAINT p_trab_ref_lpc_p_trab_id_fkey FOREIGN KEY (p_trab_id) REFERENCES public.p_trab(id) ON DELETE CASCADE;


--
-- Name: p_trab p_trab_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p_trab
    ADD CONSTRAINT p_trab_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: p_trab_ref_lpc Usuários atualizam LPC de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários atualizam LPC de seus P Trabs" ON public.p_trab_ref_lpc FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = p_trab_ref_lpc.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: p_trab_ref_lpc Usuários criam LPC em seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários criam LPC em seus P Trabs" ON public.p_trab_ref_lpc FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = p_trab_ref_lpc.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: p_trab_ref_lpc Usuários deletam LPC de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários deletam LPC de seus P Trabs" ON public.p_trab_ref_lpc FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = p_trab_ref_lpc.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: classe_i_registros Usuários podem atualizar registros de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar registros de seus P Trabs" ON public.classe_i_registros FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_i_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: classe_iii_registros Usuários podem atualizar registros de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar registros de seus P Trabs" ON public.classe_iii_registros FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_iii_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: p_trab Usuários podem atualizar seus próprios P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios P Trabs" ON public.p_trab FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: organizacoes_militares Usuários podem atualizar suas próprias OMs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar suas próprias OMs" ON public.organizacoes_militares FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: diretrizes_custeio Usuários podem atualizar suas próprias diretrizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar suas próprias diretrizes" ON public.diretrizes_custeio FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: diretrizes_equipamentos_classe_iii Usuários podem atualizar suas próprias diretrizes de equipame; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar suas próprias diretrizes de equipame" ON public.diretrizes_equipamentos_classe_iii FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: classe_i_registros Usuários podem criar registros em seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar registros em seus P Trabs" ON public.classe_i_registros FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_i_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: classe_iii_registros Usuários podem criar registros em seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar registros em seus P Trabs" ON public.classe_iii_registros FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_iii_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: p_trab Usuários podem criar seus próprios P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar seus próprios P Trabs" ON public.p_trab FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: organizacoes_militares Usuários podem criar suas próprias OMs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar suas próprias OMs" ON public.organizacoes_militares FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: diretrizes_custeio Usuários podem criar suas próprias diretrizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar suas próprias diretrizes" ON public.diretrizes_custeio FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: diretrizes_equipamentos_classe_iii Usuários podem criar suas próprias diretrizes de equipamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar suas próprias diretrizes de equipamentos" ON public.diretrizes_equipamentos_classe_iii FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: classe_i_registros Usuários podem deletar registros de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar registros de seus P Trabs" ON public.classe_i_registros FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_i_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: classe_iii_registros Usuários podem deletar registros de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar registros de seus P Trabs" ON public.classe_iii_registros FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_iii_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: p_trab Usuários podem deletar seus próprios P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar seus próprios P Trabs" ON public.p_trab FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: organizacoes_militares Usuários podem deletar suas próprias OMs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar suas próprias OMs" ON public.organizacoes_militares FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: diretrizes_custeio Usuários podem deletar suas próprias diretrizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar suas próprias diretrizes" ON public.diretrizes_custeio FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: diretrizes_equipamentos_classe_iii Usuários podem deletar suas próprias diretrizes de equipament; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar suas próprias diretrizes de equipament" ON public.diretrizes_equipamentos_classe_iii FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: classe_i_registros Usuários podem ver registros de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver registros de seus P Trabs" ON public.classe_i_registros FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_i_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: classe_iii_registros Usuários podem ver registros de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver registros de seus P Trabs" ON public.classe_iii_registros FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = classe_iii_registros.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: p_trab Usuários podem ver seus próprios P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seus próprios P Trabs" ON public.p_trab FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: organizacoes_militares Usuários podem ver suas próprias OMs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver suas próprias OMs" ON public.organizacoes_militares FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: diretrizes_custeio Usuários podem ver suas próprias diretrizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver suas próprias diretrizes" ON public.diretrizes_custeio FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: diretrizes_equipamentos_classe_iii Usuários podem ver suas próprias diretrizes de equipamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver suas próprias diretrizes de equipamentos" ON public.diretrizes_equipamentos_classe_iii FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: p_trab_ref_lpc Usuários veem LPC de seus P Trabs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem LPC de seus P Trabs" ON public.p_trab_ref_lpc FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.p_trab
  WHERE ((p_trab.id = p_trab_ref_lpc.p_trab_id) AND (p_trab.user_id = auth.uid())))));


--
-- Name: classe_i_registros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classe_i_registros ENABLE ROW LEVEL SECURITY;

--
-- Name: classe_iii_registros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classe_iii_registros ENABLE ROW LEVEL SECURITY;

--
-- Name: diretrizes_custeio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diretrizes_custeio ENABLE ROW LEVEL SECURITY;

--
-- Name: diretrizes_equipamentos_classe_iii; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diretrizes_equipamentos_classe_iii ENABLE ROW LEVEL SECURITY;

--
-- Name: organizacoes_militares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizacoes_militares ENABLE ROW LEVEL SECURITY;

--
-- Name: p_trab; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p_trab ENABLE ROW LEVEL SECURITY;

--
-- Name: p_trab_ref_lpc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p_trab_ref_lpc ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


