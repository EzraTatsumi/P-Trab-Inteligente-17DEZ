import { Tables } from "@/integrations/supabase/types";

/**
 * Estrutura de um item do Catálogo CATMAT.
 */
export interface CatmatItem extends Tables<'catalogo_catmat'> {
    // Campos garantidos
    code: string;
    description: string;
}