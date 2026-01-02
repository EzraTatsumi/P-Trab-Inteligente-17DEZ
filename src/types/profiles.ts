import { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<'profiles'> & {
    om_details?: {
        id: string;
        nome_om: string;
        codug_om: string;
    } | null;
};

export interface ProfileFormValues {
    first_name: string;
    last_name: string;
    avatar_url: string;
    default_diretriz_year: number | null;
    // Campos da OM (para exibição e seleção)
    om_id: string | null;
    om_name: string;
    om_ug: string;
}