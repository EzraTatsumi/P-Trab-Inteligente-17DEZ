import { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<'profiles'> & {
    om_details?: {
        id: string;
        nome_om: string;
        codug_om: string;
    } | null;
    // Campos de ano padrão atualizados
    default_logistica_year: number | null;
    default_operacional_year: number | null;
};

export interface ProfileFormValues {
    first_name: string;
    last_name: string;
    avatar_url: string;
    // Campos de ano padrão atualizados
    default_logistica_year: number | null;
    default_operacional_year: number | null;
    // Campos da OM (para exibição e seleção)
    om_id: string | null;
    om_name: string;
    om_ug: string;
}