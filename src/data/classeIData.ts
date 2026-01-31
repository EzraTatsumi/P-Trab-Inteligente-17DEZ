// Valores padrão para Classe I (Suprimento)
export const defaultClasseIConfig = {
    // Valores unitários padrão (se não houver diretriz de custeio)
    valor_qs_padrao: 15.00, // Ração Quente
    valor_qr_padrao: 10.00, // Ração de Reserva
    valor_r2_padrao: 12.00, // Ração Operacional R2
    valor_r3_padrao: 15.00, // Ração Operacional R3

    // Estrutura de registro vazia
    registro_vazio: {
        organizacao: "",
        ug: "",
        om_qs: "",
        ug_qs: "",
        efetivo: 0,
        dias_operacao: 1,
        nr_ref_int: 1,
        categoria: 'RACAO_QUENTE' as const,
        quantidade_r2: 0,
        quantidade_r3: 0,
        fase_atividade: "",
        memoria_calculo_qs_customizada: "",
        memoria_calculo_qr_customizada: "",
        memoria_calculo_op_customizada: "",
    }
};