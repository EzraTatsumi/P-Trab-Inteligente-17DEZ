import { Tables } from "@/integrations/supabase/types";

export type CategoriaConcessionaria = 'Água/Esgoto' | 'Energia Elétrica';
export const CATEGORIAS_CONCESSIONARIA: CategoriaConcessionaria[] = ['Água/Esgoto', 'Energia Elétrica'];

export type DiretrizConcessionaria = Tables<'diretrizes_concessionaria'>;

// Tipo usado no formulário de cadastro/edição de diretriz
export interface DiretrizConcessionariaForm {
    id?: string;
    ano_referencia: number;
    categoria: CategoriaConcessionaria;
    nome_concessionaria: string;
    consumo_pessoa_dia: number; // Consumo por pessoa por dia (m³ ou kWh)
    fonte_consumo: string | null;
    custo_unitario: number; // Custo por unidade (R$/m³ ou R$/kWh)
    fonte_custo: string | null;
    unidade_custo: string; // Ex: m³ ou kWh
}

// Tipo usado para a seleção no formulário de PTrab (análogo a TrechoSelection)
export interface ConcessionariaDiretrizSelection {
    id: string; // ID da diretriz (contrato)
    categoria: CategoriaConcessionaria;
    nome_concessionaria: string;
    consumo_pessoa_dia: number;
    custo_unitario: number;
    unidade_custo: string;
    
    // Campos de cálculo (análogo a quantidade_passagens)
    quantidade_solicitada: number; // Quantidade de unidades (m³ ou kWh) a ser solicitada
}