import { Tables } from "@/integrations/supabase/types";

/**
 * Estrutura de um item do Catálogo de Subitens da Natureza da Despesa (ND).
 * Estes são dados de referência estáticos.
 */
export interface CatalogoSubitem extends Tables<'catalogo_subitens_nd'> {
    // Campos garantidos
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
}