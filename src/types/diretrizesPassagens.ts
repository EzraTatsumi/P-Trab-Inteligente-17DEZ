import { Tables } from "@/integrations/supabase/types";

export type TipoTransporte = 'AEREO' | 'TERRESTRE' | 'FLUVIAL';

export interface TrechoPassagem {
    id: string;
    origem: string;
    destino: string;
    tipo_transporte: TipoTransporte;
    valor: number;
    is_ida_volta: boolean;
    quantidade_passagens: number;
}

// Estende o tipo gerado pelo Supabase, mas sobrescreve 'trechos' para o tipo correto
export interface DiretrizPassagem extends Omit<Tables<'diretrizes_passagens'>, 'trechos' | 'data_inicio_vigencia' | 'data_fim_vigencia'> {
    trechos: TrechoPassagem[];
    data_inicio_vigencia: string | null;
    data_fim_vigencia: string | null;
}

// Tipo de dados para o formulário de passagens (inclui todos os campos necessários)
export type DiretrizPassagemForm = Omit<DiretrizPassagem, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
    id?: string;
};