import * as z from "zod";
import { Tables } from "@/integrations/supabase/types"; // Importação de Tables

// Tipos de Categoria
export const CATEGORIAS_CONCESSIONARIA = ["Água/Esgoto", "Energia Elétrica"] as const;
export type CategoriaConcessionaria = typeof CATEGORIAS_CONCESSIONARIA[number];

// Tipo de dados do banco de dados (Row)
// Usamos 'as any' para contornar a restrição de tipo se 'diretrizes_concessionaria' não estiver na união de TableName
export type DiretrizConcessionaria = Tables<'diretrizes_concessionaria' extends keyof Tables ? 'diretrizes_concessionaria' : any>;

// Schema de Validação
export const diretrizConcessionariaSchema = z.object({
    ano_referencia: z.number().int().min(2020, "Ano inválido"),
    categoria: z.enum(CATEGORIAS_CONCESSIONARIA, {
        required_error: "A categoria é obrigatória.",
    }),
    nome_concessionaria: z.string().min(1, "O nome da concessionária é obrigatório."),
    
    // Consumo é tratado como string no formulário para aceitar vírgula, mas validado como número
    consumo_pessoa_dia: z.union([
        z.number().min(0, "O consumo deve ser positivo."),
        z.string().min(1, "O consumo é obrigatório.").refine(val => {
            const num = parseFloat(String(val).replace(',', '.'));
            return !isNaN(num) && num >= 0;
        }, "Consumo inválido ou negativo."),
    ]),
    
    fonte_consumo: z.string().optional(),
    
    custo_unitario: z.number().min(0, "O custo unitário deve ser positivo."),
    fonte_custo: z.string().optional(),
    unidade_custo: z.enum(["m3", "kWh"]),
});

// Tipo de dados do formulário (inclui a string para consumo)
export type DiretrizConcessionariaForm = z.infer<typeof diretrizConcessionariaSchema>;