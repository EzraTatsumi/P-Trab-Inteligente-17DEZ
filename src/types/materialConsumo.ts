import { Tables } from "@/integrations/supabase/types";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

// Tipo de registro salvo no banco de dados (se fosse uma tabela separada, mas Material de Consumo usa diretrizes)
// Para este formulário, vamos definir o tipo de registro que seria salvo (que é o ItemAquisicao, mas com campos de contexto)
export interface MaterialConsumoRegistroDB extends Tables<'diretrizes_material_consumo'> {
    // Campos de contexto do PTrab (simulados, pois o registro real seria em outra tabela)
    p_trab_id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    
    // O item de aquisição em si (que é o que realmente importa)
    item_aquisicao: ItemAquisicao;
    
    // Campos de cálculo
    valor_nd_30: number;
    valor_nd_39: number;
    valor_total: number;
    detalhamento: string | null;
    detalhamento_customizado: string | null;
}

// Tipo para o grupo de aquisição gerenciado no formulário (Staging Area)
export interface MaterialConsumoGrupo {
    id: string; // ID temporário (UUID)
    
    // Dados do Subitem (Diretriz)
    diretrizId: string;
    nrSubitem: string;
    nomeSubitem: string;
    
    // Dados da Solicitação (Contexto)
    organizacao: string; // OM Favorecida
    ug: string; // UG Favorecida
    om_detentora: string; // OM Destino
    ug_detentora: string; // UG Destino
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    
    // Itens de Aquisição (com quantidades atualizadas)
    itensSelecionados: ItemAquisicao[];
    
    // Campos de Cálculo
    valorND30: number;
    valorND39: number;
    totalLinha: number;
    memoriaCalculo: string;
    detalhamentoCustomizado: string | null;
}

// Tipo para o registro consolidado (para exibição na Seção 4)
export interface ConsolidatedMaterialConsumo {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    
    // Registros individuais (cada um representa um ItemAquisicao salvo)
    records: MaterialConsumoRegistroDB[]; 
    
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}