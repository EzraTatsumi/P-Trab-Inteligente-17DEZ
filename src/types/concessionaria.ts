import { Database } from "@/integrations/supabase/database.types";

export type ConcessionariaRegistro = Database['public']['Tables']['concessionaria_registros']['Row'];
export type NewConcessionariaRegistro = Database['public']['Tables']['concessionaria_registros']['Insert'];
export type UpdateConcessionariaRegistro = Database['public']['Tables']['concessionaria_registros']['Update'];

export type ConcessionariaDiretriz = Database['public']['Tables']['diretrizes_concessionaria']['Row'];

// Tipo de dados esperado para o formulário
export interface ConcessionariaFormValues {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    diretriz_id: string;
    categoria: 'AGUA_ESGOTO' | 'ENERGIA_ELETRICA';
    detalhamento_customizado: string;
    fase_atividade: string;
}

// Tipo de dados para a memória de cálculo consolidada
export interface ConsolidatedConcessionariaRecord {
    id: string;
    categoria: string;
    nome_concessionaria: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    consumo_pessoa_dia: number;
    valor_unitario: number;
    valor_total: number;
    valor_nd_39: number;
    detalhamento: string;
    detalhamento_customizado: string;
    fase_atividade: string;
}