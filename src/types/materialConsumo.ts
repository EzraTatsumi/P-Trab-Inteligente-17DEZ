// src/types/materialConsumo.ts
import { Tables } from "@/integrations/supabase/types";

// Tipo base para um item de aquisição (vindo da diretriz)
export interface ItemAquisicao {
    id: string;
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string;
    valor_unitario: number;
    unidade_medida: string;
    gnd: '30' | '39';
    numero_pregao: string;
    uasg: string;
    om_nome: string;
    data_vigencia_final: string;
}

// Tipo para um item selecionado no formulário (inclui a quantidade solicitada e metadados do subitem)
export interface SelectedItemAquisicao extends ItemAquisicao {
    quantidade_solicitada: number;
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
}

// Tipo para um grupo de aquisição (usado no formulário para agrupar itens)
export interface AcquisitionGroup {
    id: string;
    nome: string;
    finalidade: string;
    itens: SelectedItemAquisicao[];
}

// Estado principal do formulário
export interface MaterialConsumoFormState {
    om_favorecida: string;
    ug_favorecida: string;
    om_destino: string;
    ug_destino: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    acquisition_groups: AcquisitionGroup[];
}

// Tipo para um registro individual no DB (material_consumo_registros)
export type MaterialConsumoRegistroDB = Tables<'material_consumo_registros'>;

// Tipo para o registro calculado antes de salvar (inclui campos de display)
export interface CalculatedMaterialConsumo extends MaterialConsumoRegistroDB {
    tempId: string; // ID temporário para gerenciamento local
    totalGeral: number;
    memoria_calculo_display: string; // A memória gerada
    om_favorecida: string;
    ug_favorecida: string;
}

// Tipo para o registro consolidado (agrupado por Subitem)
export interface ConsolidatedMaterialConsumoRecord {
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: MaterialConsumoRegistroDB[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

// Tipo usado no frontend para o grupo consolidado (inclui a chave de agrupamento)
export interface ConsolidatedMaterialConsumo extends ConsolidatedMaterialConsumoRecord {
    groupKey: string;
}