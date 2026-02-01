import { Tables } from "@/integrations/supabase/types";

// Tipos literais específicos para Categoria e Unidade de Custo
export type CategoriaConcessionaria = "Água/Esgoto" | "Energia Elétrica";
export const CATEGORIAS_CONCESSIONARIA: CategoriaConcessionaria[] = ["Água/Esgoto", "Energia Elétrica"];

export type UnidadeCustoConcessionaria = "m3" | "kWh";
export const UNIDADES_CUSTO_CONCESSIONARIA: UnidadeCustoConcessionaria[] = ["m3", "kWh"];

// Sobrescreve o tipo genérico do Supabase para impor os tipos literais
export interface DiretrizConcessionaria extends Omit<Tables<'diretrizes_concessionaria'>, 'categoria' | 'unidade_custo'> {
    categoria: CategoriaConcessionaria;
    unidade_custo: UnidadeCustoConcessionaria;
}

// Tipo de formulário para inserção/edição
export type DiretrizConcessionariaForm = Omit<DiretrizConcessionaria, 'id' | 'user_id' | 'created_at' | 'updated_at'>;