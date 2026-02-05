import { Tables } from "@/integrations/supabase/types";

/**
 * Estrutura de um item do Catálogo CATMAT.
 * Estes são dados de referência estáticos.
 */
export interface CatmatItem extends Tables<'catalogo_catmat'> {
    // Campos garantidos
    code: string;
    description: string;
}