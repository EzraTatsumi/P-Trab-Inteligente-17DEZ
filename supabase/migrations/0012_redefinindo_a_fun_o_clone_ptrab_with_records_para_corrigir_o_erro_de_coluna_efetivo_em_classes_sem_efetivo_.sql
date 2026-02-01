CREATE OR REPLACE FUNCTION public.clone_ptrab_with_records(old_ptrab_id uuid, new_user_id uuid, new_numero_ptrab text, new_rotulo_versao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    new_ptrab_id uuid;
BEGIN
    -- 1. Clone the main p_trab record
    INSERT INTO public.p_trab (
        user_id, numero_ptrab, comando_militar_area, nome_om, nome_om_extenso, codug_om, 
        rm_vinculacao, codug_rm_vinculacao, nome_operacao, periodo_inicio, periodo_fim, 
        efetivo_empregado, acoes, status, nome_cmt_om, local_om, comentario, 
        origem, rotulo_versao, shared_with, share_token
    )
    SELECT
        new_user_id, -- New user ID
        new_numero_ptrab, -- New PTrab number
        comando_militar_area, nome_om, nome_om_extenso, codug_om, 
        rm_vinculacao, codug_rm_vinculacao, nome_operacao, periodo_inicio, periodo_fim, 
        efetivo_empregado, acoes, 'minuta', nome_cmt_om, local_om, comentario, 
        'clonado', new_rotulo_versao, ARRAY[]::uuid[], gen_random_uuid() -- Reset sharing info
    FROM public.p_trab
    WHERE id = old_ptrab_id
    RETURNING id INTO new_ptrab_id;

    IF new_ptrab_id IS NULL THEN
        RAISE EXCEPTION 'Failed to clone main p_trab record.';
    END IF;

    -- 2. Clone associated records

    -- CLONE CLASSE I (Possui efetivo)
    INSERT INTO public.classe_i_registros (
        p_trab_id, organizacao, ug, om_qs, ug_qs, efetivo, dias_operacao, nr_ref_int, 
        valor_qs, valor_qr, complemento_qs, etapa_qs, total_qs, complemento_qr, etapa_qr, 
        total_qr, total_geral, fase_atividade, memoria_calculo_qs_customizada, 
        memoria_calculo_qr_customizada, categoria, quantidade_r2, quantidade_r3, 
        memoria_calculo_op_customizada
    )
    SELECT
        new_ptrab_id, organizacao, ug, om_qs, ug_qs, efetivo, dias_operacao, nr_ref_int, 
        valor_qs, valor_qr, complemento_qs, etapa_qs, total_qs, complemento_qr, etapa_qr, 
        total_qr, total_geral, fase_atividade, memoria_calculo_qs_customizada, 
        memoria_calculo_qr_customizada, categoria, quantidade_r2, quantidade_r3, 
        memoria_calculo_op_customizada
    FROM public.classe_i_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE II (Possui efetivo)
    INSERT INTO public.classe_ii_registros (
        p_trab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, efetivo, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, efetivo, om_detentora, ug_detentora
    FROM public.classe_ii_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE III (Não possui efetivo, usa quantidade)
    INSERT INTO public.classe_iii_registros (
        p_trab_id, tipo_equipamento, organizacao, ug, quantidade, potencia_hp, 
        horas_dia, dias_operacao, consumo_hora, consumo_km_litro, km_dia, 
        tipo_combustivel, preco_litro, tipo_equipamento_detalhe, total_litros, 
        total_litros_sem_margem, valor_total, detalhamento, detalhamento_customizado, 
        itens_equipamentos, fase_atividade, consumo_lubrificante_litro, 
        preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, categoria
    )
    SELECT
        new_ptrab_id, tipo_equipamento, organizacao, ug, quantidade, potencia_hp, 
        horas_dia, dias_operacao, consumo_hora, consumo_km_litro, km_dia, 
        tipo_combustivel, preco_litro, tipo_equipamento_detalhe, total_litros, 
        total_litros_sem_margem, valor_total, detalhamento, detalhamento_customizado, 
        itens_equipamentos, fase_atividade, consumo_lubrificante_litro, 
        preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora, categoria
    FROM public.classe_iii_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE V (Possui efetivo)
    INSERT INTO public.classe_v_registros (
        p_trab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, efetivo, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, efetivo, om_detentora, ug_detentora
    FROM public.classe_v_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE VI (Não possui efetivo)
    INSERT INTO public.classe_vi_registros (
        p_trab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, om_detentora, ug_detentora
    FROM public.classe_vi_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE VII (Não possui efetivo)
    INSERT INTO public.classe_vii_registros (
        p_trab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, om_detentora, ug_detentora
    FROM public.classe_vii_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE VIII - SAÚDE (Não possui efetivo)
    INSERT INTO public.classe_viii_saude_registros (
        p_trab_id, organizacao, ug, dias_operacao, categoria, itens_saude, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, categoria, itens_saude, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, om_detentora, ug_detentora
    FROM public.classe_viii_saude_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE VIII - REMONTA (Não possui efetivo)
    INSERT INTO public.classe_viii_remonta_registros (
        p_trab_id, organizacao, ug, dias_operacao, animal_tipo, quantidade_animais, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, itens_remonta, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, animal_tipo, quantidade_animais, 
        valor_total, detalhamento, detalhamento_customizado, fase_atividade, 
        valor_nd_30, valor_nd_39, itens_remonta, om_detentora, ug_detentora
    FROM public.classe_viii_remonta_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE CLASSE IX (Não possui efetivo)
    INSERT INTO public.classe_ix_registros (
        p_trab_id, organizacao, ug, dias_operacao, categoria, valor_total, 
        detalhamento, detalhamento_customizado, fase_atividade, valor_nd_30, 
        valor_nd_39, itens_motomecanizacao, om_detentora, ug_detentora
    )
    SELECT
        new_ptrab_id, organizacao, ug, dias_operacao, categoria, valor_total, 
        detalhamento, detalhamento_customizado, fase_atividade, valor_nd_30, 
        valor_nd_39, itens_motomecanizacao, om_detentora, ug_detentora
    FROM public.classe_ix_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE PASSAGENS (Possui efetivo)
    INSERT INTO public.passagem_registros (
        p_trab_id, organizacao, ug, om_detentora, ug_detentora, dias_operacao, 
        fase_atividade, trecho_id, diretriz_id, origem, destino, tipo_transporte, 
        is_ida_volta, valor_unitario, quantidade_passagens, valor_total, 
        valor_nd_33, detalhamento, detalhamento_customizado, efetivo
    )
    SELECT
        new_ptrab_id, organizacao, ug, om_detentora, ug_detentora, dias_operacao, 
        fase_atividade, trecho_id, diretriz_id, origem, destino, tipo_transporte, 
        is_ida_volta, valor_unitario, quantidade_passagens, valor_total, 
        valor_nd_33, detalhamento, detalhamento_customizado, efetivo
    FROM public.passagem_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE DIÁRIAS (Não possui efetivo)
    INSERT INTO public.diaria_registros (
        p_trab_id, organizacao, ug, om_detentora, ug_detentora, dias_operacao, 
        fase_atividade, posto_graduacao, destino, quantidade, valor_diaria_unitario, 
        valor_taxa_embarque, valor_total, valor_nd_30, detalhamento, 
        detalhamento_customizado, nr_viagens, local_atividade, quantidades_por_posto, 
        is_aereo, valor_nd_15
    )
    SELECT
        new_ptrab_id, organizacao, ug, om_detentora, ug_detentora, dias_operacao, 
        fase_atividade, posto_graduacao, destino, quantidade, valor_diaria_unitario, 
        valor_taxa_embarque, valor_total, valor_nd_30, detalhamento, 
        detalhamento_customizado, nr_viagens, local_atividade, quantidades_por_posto, 
        is_aereo, valor_nd_15
    FROM public.diaria_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE VERBA OPERACIONAL / SUPRIMENTO DE FUNDOS (Não possui efetivo)
    INSERT INTO public.verba_operacional_registros (
        p_trab_id, organizacao, ug, om_detentora, ug_detentora, dias_operacao, 
        quantidade_equipes, valor_total_solicitado, fase_atividade, detalhamento, 
        detalhamento_customizado, valor_nd_30, valor_nd_39, objeto_aquisicao, 
        objeto_contratacao, proposito, finalidade, local, tarefa
    )
    SELECT
        new_ptrab_id, organizacao, ug, om_detentora, ug_detentora, dias_operacao, 
        quantidade_equipes, valor_total_solicitado, fase_atividade, detalhamento, 
        detalhamento_customizado, valor_nd_30, valor_nd_39, objeto_aquisicao, 
        objeto_contratacao, proposito, finalidade, local, tarefa
    FROM public.verba_operacional_registros
    WHERE p_trab_id = old_ptrab_id;

    -- CLONE REFERÊNCIA LPC
    INSERT INTO public.p_trab_ref_lpc (
        p_trab_id, ambito, nome_local, data_inicio_consulta, data_fim_consulta, 
        preco_diesel, preco_gasolina, source
    )
    SELECT
        new_ptrab_id, ambito, nome_local, data_inicio_consulta, data_fim_consulta, 
        preco_diesel, preco_gasolina, source
    FROM public.p_trab_ref_lpc
    WHERE p_trab_id = old_ptrab_id;

    RETURN new_ptrab_id;
END;
$function$;