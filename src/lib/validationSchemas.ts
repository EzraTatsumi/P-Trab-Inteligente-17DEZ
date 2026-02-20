import * as z from "zod";

// Helper function for currency comparison
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Helper to check if any military personnel count is greater than zero
const isEfetivoPresent = (quantidades: Record<string, number>): boolean => {
    return Object.values(quantidades).some(q => q > 0);
};

// --- Login Schema ---
export const loginSchema = z.object({
    email: z.string().email("E-mail inválido."),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    rememberMe: z.boolean().optional(),
});

// --- Diretriz Operacional Schema (Used in CustosOperacionaisPage) ---
export const diretrizOperacionalSchema = z.object({
    ano_referencia: z.number().int().min(2020, "Ano inválido."),
    
    // Fatores (0 to 10)
    fator_passagens_aereas: z.number().min(0).max(10, "Fator deve ser entre 0 e 10.").default(0),
    fator_servicos_terceiros: z.number().min(0).max(10, "Fator deve ser entre 0 e 10.").default(0),
    fator_material_consumo: z.number().min(0).max(10, "Fator deve ser entre 0 e 10.").default(0),
    fator_concessionaria: z.number().min(0).max(10, "Fator deve ser entre 0 e 10.").default(0),
    
    // Valores Monetários (R$) - Adicionado .default(0) para evitar erro "Required"
    valor_verba_operacional_dia: z.number().min(0).default(0),
    valor_suprimentos_fundo_dia: z.number().min(0).default(0),
    valor_complemento_alimentacao: z.number().min(0).default(0),
    valor_fretamento_aereo_hora: z.number().min(0).default(0),
    valor_locacao_estrutura_dia: z.number().min(0).default(0),
    valor_locacao_viaturas_dia: z.number().min(0).default(0),
    
    // Diárias e Taxa de Embarque
    diaria_referencia_legal: z.string().optional().nullable().default('Decreto Nº 12.324 de 19DEZ24'),
    diaria_of_gen_bsb: z.number().min(0).default(0),
    diaria_of_gen_capitais: z.number().min(0).default(0),
    diaria_of_gen_demais: z.number().min(0).default(0),
    diaria_of_sup_bsb: z.number().min(0).default(0),
    diaria_of_sup_capitais: z.number().min(0).default(0),
    diaria_of_sup_demais: z.number().min(0).default(0),
    diaria_of_int_sgt_bsb: z.number().min(0).default(0),
    diaria_of_int_sgt_capitais: z.number().min(0).default(0),
    diaria_of_int_sgt_demais: z.number().min(0).default(0),
    diaria_demais_pracas_bsb: z.number().min(0).default(0),
    diaria_demais_pracas_capitais: z.number().min(0).default(0),
    diaria_demais_pracas_demais: z.number().min(0).default(0),
    taxa_embarque: z.number().min(0).default(0),
    
    observacoes: z.string().optional().nullable().default(""),
});

// --- Verba Operacional Base Schema (Sem Refinamento) ---
const verbaOperacionalBase = z.object({
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
});

// --- Verba Operacional Schema (Com Refinamento) ---
export const verbaOperacionalSchema = verbaOperacionalBase.refine(data => {
    const totalAlocado = data.valor_nd_30 + data.valor_nd_39;
    return areNumbersEqual(totalAlocado, data.valor_total_solicitado);
}, {
    message: "A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.",
    path: ["valor_nd_39"],
});

// --- Suprimento de Fundos Schema (Com Extensão e Refinamento) ---
export const suprimentoFundosSchema = verbaOperacionalBase.extend({
    objeto_aquisicao: z.string().min(1, "O Objeto de Aquisição (Material) é obrigatório."),
    objeto_contratacao: z.string().min(1, "O Objeto de Contratação (Serviço) é obrigatório."),
    proposito: z.string().min(1, "O Propósito é obrigatório."),
    finalidade: z.string().min(1, "A Finalidade é obrigatória."),
    local: z.string().min(1, "O Local é obrigatório."),
    tarefa: z.string().min(1, "A Tarefa é obrigatória."),
}).refine(data => {
    const totalAlocado = data.valor_nd_30 + data.valor_nd_39;
    return areNumbersEqual(totalAlocado, data.valor_total_solicitado);
}, {
    message: "A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.",
    path: ["valor_nd_39"],
});

// --- Diaria Schema (NOVO) ---
export const diariaSchema = z.object({
    om_favorecida: z.string().min(1, "A OM Favorecida é obrigatória."),
    ug_favorecida: z.string().min(1, "A UG Favorecida é obrigatória."),
    om_detentora: z.string().min(1, "A OM Destino do Recurso é obrigatória."),
    ug_detentora: z.string().min(1, "A UG Destino do Recurso é obrigatória."),
    
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    nr_viagens: z.number().int().min(1, "O número de viagens deve ser maior que zero."),
    destino: z.enum(['bsb_capitais_especiais', 'demais_capitais', 'demais_dslc'], {
        required_error: "O destino é obrigatório.",
    }),
    local_atividade: z.string().min(1, "O local da atividade é obrigatório."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    
    quantidades_por_posto: z.record(z.string(), z.number().int().min(0)),
    
    is_aereo: z.boolean(),
    
    detalhamento_customizado: z.string().optional().nullable(),
}).refine(data => {
    return isEfetivoPresent(data.quantidades_por_posto);
}, {
    message: "Informe a quantidade de militares por posto/graduação.",
    path: ["quantidades_por_posto"],
});

// --- Item Code Search Schema (NOVO) ---
export const itemCodeSearchSchema = z.object({
    query: z.string().min(3, "A pesquisa deve ter pelo menos 3 caracteres."),
});