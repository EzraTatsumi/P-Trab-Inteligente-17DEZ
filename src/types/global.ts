import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Re-exportando tipos comuns para conveniência
export type PTrab = Tables<'p_trab'>;
export type Profile = Tables<'profiles'>;

// Tipos de registro específicos
export type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;
export type VerbaOperacionalInsert = TablesInsert<'verba_operacional_registros'>;
export type VerbaOperacionalUpdate = TablesUpdate<'verba_operacional_registros'>;

export type DiariaRegistro = Tables<'diaria_registros'>;
export type DiariaInsert = TablesInsert<'diaria_registros'>;
export type DiariaUpdate = TablesUpdate<'diaria_registros'>;

// Adicione outros tipos comuns conforme necessário