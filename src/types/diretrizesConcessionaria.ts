import { Tables } from "@/integrations/supabase/types";
import * as z from "zod";

export const CATEGORIAS_CONCESSIONARIA = ['Água/Esgoto', 'Energia Elétrica'] as const;
export type CategoriaConcessionaria = typeof CATEGORIAS_CONCESSIONARIA[number];

export const UNIDADES_CUSTO = ['m3', 'kWh'] as const;
export type UnidadeCusto = typeof UNIDADES_CUSTO[number];

// 1. Fix: Use the correct table name now that it's in types.ts
export type DiretrizConcessionaria = Tables<'diretrizes_concessionaria'>;

export const diretrizConcessionariaSchema = z.object({
    ano_referencia: z.number().int().positive(),
    categoria: z.enum(CATEGORIAS_CONCESSIONARIA, {
        required_error: "A categoria é obrigatória.",
    }),
    nome_concessionaria: z.string().min(1, "O nome da concessionária é obrigatório."),
    
    // Consumo por pessoa/dia (pode ser decimal)
    consumo_pessoa_dia: z.number().min(0, "O consumo deve ser um valor positivo."),
    fonte_consumo: z.string().optional().nullable(),
    
    // Custo unitário (monetário)
    custo_unitario: z.number().min(0, "O custo unitário deve ser um valor positivo."),
    fonte_custo: z.string().optional().nullable(),
    
    // 2. Fix: Use 'm3' instead of 'm³'
    unidade_custo: z.enum(UNIDADES_CUSTO, {
        required_error: "A unidade de custo é obrigatória.",
    }),
});

export type DiretrizConcessionariaForm = z.infer<typeof diretrizConcessionariaSchema>;