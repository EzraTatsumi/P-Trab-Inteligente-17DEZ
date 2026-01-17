import * as z from "zod";

// Helper function for currency comparison
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// --- Login Schema ---
export const loginSchema = z.object({
    email: z.string().email("E-mail inválido."),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

// --- Diretriz Operacional Schema (Used in CustosOperacionaisPage) ---
export const diretrizOperacionalSchema = z.object({
    ano_referencia: z.number().int().min(2020, "Ano inválido."),
    
    // Fatores (0 to 10)
    fator_passagens_aereas: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    fator_servicos_terceiros: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    fator_material_consumo: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    fator_concessionaria: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    
    // Valores Monetários (R$)
    valor_verba_operacional_dia: z.number().min(0),
    valor_suprimentos_fundo_dia: z.number().min(0),
    valor_complemento_alimentacao: z.number().min(0),
    valor_fretamento_aereo_hora: z.number().min(0),
    valor_locacao_estrutura_dia: z.number().min(0),
    valor_locacao_viaturas_dia: z.number().min(0),
    
    // Diárias e Taxa de Embarque
    diaria_referencia_legal: z.string().optional().nullable(),
    diaria_of_gen_bsb: z.number().min(0),
    diaria_of_gen_capitais: z.number().min(0),
    diaria_of_gen_demais: z.number().min(0),
    diaria_of_sup_bsb: z.number().min(0),
    diaria_of_sup_capitais: z.number().min(0),
    diaria_of_sup_demais: z.number().min(0),
    diaria_of_int_sgt_bsb: z.number().min(0),
    diaria_of_int_sgt_capitais: z.number().min(0),
    diaria_of_int_sgt_demais: z.number().min(0),
    diaria_demais_pracas_bsb: z.number().min(0),
    diaria_demais_pracas_capitais: z.number().min(0),
    diaria_demais_pracas_demais: z.number().min(0),
    taxa_embarque: z.number().min(0),
    
    observacoes: z.string().optional().nullable(),
});

// --- Verba Operacional Schema (Used in VerbaOperacionalForm) ---
export const verbaOperacionalSchema = z.object({
    // Campos de contexto (OMs)
    om_favorecida: z.string().min(1, "A OM Favorecida é obrigatória."),
    ug_favorecida: z.string().min(1, "A UG Favorecida é obrigatória."),
    om_detentora: z.string().min(1, "A OM Destino do Recurso é obrigatória."),
    ug_detentora: z.string().min(1, "A UG Destino do Recurso é obrigatória."),
    
    // Campos de quantidade/período
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    quantidade_equipes: z.number().int().min(1, "A quantidade de equipes deve ser maior que zero."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    
    // Valores
    valor_total_solicitado: z.number().min(0.01, "O valor total solicitado deve ser maior que zero."),
    valor_nd_30: z.number().min(0, "ND 30 não pode ser negativa."),
    valor_nd_39: z.number().min(0, "ND 39 não pode ser negativa."),
    
}).refine(data => {
    // A soma das NDs deve ser igual ao valor total solicitado (com pequena tolerância)
    const totalAlocado = data.valor_nd_30 + data.valor_nd_39;
    return areNumbersEqual(totalAlocado, data.valor_total_solicitado);
}, {
    message: "A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.",
    path: ["valor_nd_39"], // Aponta para o campo de ND 39 para exibir o erro
});

// --- Suprimento de Fundos Schema (Used in SuprimentoFundosForm) ---
export const suprimentoFundosSchema = verbaOperacionalSchema.extend({
    // Campos de detalhamento específicos para Suprimento de Fundos
    objeto_aquisicao: z.string().min(1, "O Objeto de Aquisição (Material) é obrigatório."),
    objeto_contratacao: z.string().min(1, "O Objeto de Contratação (Serviço) é obrigatório."),
    proposito: z.string().min(1, "O Propósito é obrigatório."),
    finalidade: z.string().min(1, "A Finalidade é obrigatória."),
    local: z.string().min(1, "O Local é obrigatório."),
    tarefa: z.string().min(1, "A Tarefa é obrigatória."),
});