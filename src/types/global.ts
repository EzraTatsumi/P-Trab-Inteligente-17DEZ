import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Re-exporting common types for convenience
export type PTrab = Tables<'p_trab'>;
export type Profile = Tables<'profiles'>;

// Specific record types
export type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;
export type VerbaOperacionalInsert = TablesInsert<'verba_operacional_registros'>;
export type VerbaOperacionalUpdate = TablesUpdate<'verba_operacional_registros'>;

export type DiariaRegistro = Tables<'diaria_registros'>;
export type DiariaInsert = TablesInsert<'diaria_registros'>;
export type DiariaUpdate = TablesUpdate<'diaria_registros'>;

// Add other common types as needed