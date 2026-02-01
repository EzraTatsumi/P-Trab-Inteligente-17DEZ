import { Database } from "@/integrations/supabase/database.types";

export type PTrab = Database['public']['Tables']['p_trab']['Row'];

export interface PTrabData {
    id: string;
    numero_ptrab: string;
    comando_militar_area: string;
    nome_om: string;
    nome_operacao: string;
    periodo_inicio: string;
    periodo_fim: string;
    efetivo_empregado: string;
    acoes: string;
    status: string;
    nome_cmt_om?: string;
    local_om?: string;
    rotulo_versao?: string;
    user_id: string;
}