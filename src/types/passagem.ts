import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Tipo completo para um registro de passagem (Row da tabela passagem_registros).
 */
export type PassagemRegistro = Tables<'passagem_registros'>;

/**
 * Tipo para inserção de um registro de passagem.
 */
export type PassagemRegistroInsert = TablesInsert<'passagem_registros'>;

/**
 * Tipo para atualização de um registro de passagem.
 */
export type PassagemRegistroUpdate = TablesUpdate<'passagem_registros'>;

/**
 * Tipo para o resumo de totais de passagens.
 */
export interface PassagemResumo {
    total_passagens: number;
    total_nd_33: number;
}