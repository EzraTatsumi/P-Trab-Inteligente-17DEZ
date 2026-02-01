import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
// Reutilizando o tipo PTrabData

// Tipo para as diretrizes operacionais (valores unitários)
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Define a união de tabelas que possuem a coluna p_trab_id
type PTrabLinkedTableName =
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' | 
    'classe_viii_saude_registros' | 'classe_viii_remonta_registros' | 
    'classe_ix_registros' | 'p_trab_ref_lpc' | 'passagem_registros' | 
    'diaria_registros' | 'verba_operacional_registros';

/**
 * Tipo de dados para o PTrab principal.
 */
export type PTrabData = Tables<'p_trab'>; // EXPORTANDO O TIPO AQUI

/**
 * Verifica o status de um PTrab e o atualiza para 'em_andamento' se estiver 'aberto'.
 * @param ptrabId O ID do Plano de Trabalho.
 */
export async function updatePTrabStatusIfAberto(ptrabId: string) {
// ... (rest of the file remains the same)