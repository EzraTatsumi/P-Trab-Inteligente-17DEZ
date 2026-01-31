import { Tables } from "@/integrations/supabase/types";

/**
 * Tipo de dados para Organização Militar (OM), baseado na tabela organizacoes_militares.
 * Usado em OmSelector e formulários de registro.
 */
export interface OMData extends Tables<'organizacoes_militares'> {}