import { Tables } from "@/integrations/supabase/types";

/**
 * Estrutura de um item do Catálogo de Material (CATMAT).
 */
export interface CatalogoCatmat extends Tables<'catalogo_catmat'> {
    // Campos garantidos
    code: string;
    description: string;
    short_description: string | null; // Novo campo
}