import * as z from "zod";
import { Tables } from "@/integrations/supabase/types";

export type DiretrizConcessionaria = Tables<'diretrizes_concessionaria'>;

export const CATEGORIAS_CONCESSIONARIA = [
    'Água/Esgoto',
    'Energia Elétrica',
] as const;

export type CategoriaConcessionaria = typeof CATEGORIAS_CONCESSIONARIA[number];

export const UNIDADES_CUSTO = [
    'm3',
    'kWh',
] as const;

export const diretrizConcessionariaSchema = z.object({
    id: z.string().uuid().optional(),
    ano_referencia: z.number().int().positive(),
    categoria: z.enum(CATEGORIAS_CONCESSIONARIA),
    nome_concessionaria: z.string().min(1, "O nome da concessionária é obrigatório."),
    consumo_pessoa_dia: z.number().min(0, "O consumo deve ser um valor positivo."),
    fonte_consumo: z.string().optional().nullable(),
    custo_unitario: z.number().min(0, "O custo unitário deve ser um valor positivo."),
    fonte_custo: z.string().optional().nullable(),
    unidade_custo: z.enum(UNIDADES_CUSTO),
});

export type DiretrizConcessionariaForm = z.infer<typeof diretrizConcessionariaSchema>;