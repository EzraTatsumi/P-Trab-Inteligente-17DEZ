import * as z from "zod";

// Esquema para validação de Diretrizes Operacionais (já existente, mas garantindo que está aqui)
export const diretrizOperacionalSchema = z.object({
    id: z.string().optional(),
    user_id: z.string().optional(),
    ano_referencia: z.number().int().min(2020, "O ano deve ser 2020 ou posterior."),
    
    fator_passagens_aereas: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    fator_servicos_terceiros: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    valor_verba_operacional_dia: z.number().min(0, "Valor deve ser positivo."),
    valor_suprimentos_fundo_dia: z.number().min(0, "Valor deve ser positivo."),
    valor_complemento_alimentacao: z.number().min(0, "Valor deve ser positivo."),
    valor_fretamento_aereo_hora: z.number().min(0, "Valor deve ser positivo."),
    valor_locacao_estrutura_dia: z.number().min(0, "Valor deve ser positivo."),
    valor_locacao_viaturas_dia: z.number().min(0, "Valor deve ser positivo."),
    fator_material_consumo: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    fator_concessionaria: z.number().min(0).max(10, "Fator deve ser entre 0 e 10."),
    observacoes: z.string().nullable().optional(),
    
    // Campos de Diárias
    diaria_referencia_legal: z.string().nullable().optional(),
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
});

// Esquema para validação de Diretrizes de Concessionária
export const diretrizConcessionariaSchema = z.object({
    id: z.string().optional(),
    ano_referencia: z.number().int().min(2020, "O ano deve ser 2020 ou posterior."),
    categoria: z.enum(["Água/Esgoto", "Energia Elétrica"], { required_error: "A categoria é obrigatória." }),
    nome_concessionaria: z.string().min(1, "O nome da concessionária é obrigatório."),
    consumo_pessoa_dia: z.number().min(0.01, "O consumo deve ser maior que zero."),
    fonte_consumo: z.string().nullable().optional(),
    custo_unitario: z.number().min(0.01, "O custo unitário deve ser maior que zero."),
    fonte_custo: z.string().nullable().optional(),
    unidade_custo: z.string().min(1, "A unidade de custo (m³ ou kWh) é obrigatória."),
});