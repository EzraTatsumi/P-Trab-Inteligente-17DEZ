import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type CategoriaConcessionaria = 'Água/Esgoto' | 'Energia Elétrica';
export const CATEGORIAS_CONCESSIONARIA: CategoriaConcessionaria[] = ['Água/Esgoto', 'Energia Elétrica'];

export type DiretrizConcessionaria = Tables<'diretrizes_concessionaria'>;

export interface DiretrizConcessionariaForm {
    id?: string;
    categoria: CategoriaConcessionaria;
    nome_concessionaria: string;
    consumo_pessoa_dia: number; // Number or string from input
    fonte_consumo: string | null;
    custo_unitario: number;
    fonte_custo: string | null;
    unidade_custo: string;
}