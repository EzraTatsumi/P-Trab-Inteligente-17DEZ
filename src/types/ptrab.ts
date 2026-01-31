import { Tables, Json } from "@/integrations/supabase/types";
import { DestinoDiaria, QuantidadesPorPosto } from "@/lib/diariaUtils";
import { TipoTransporte } from "./diretrizesPassagens";

// =================================================================
// TIPOS DE REGISTROS DE CLASSE (Logística)
// =================================================================

export interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

export interface ItemClasseIX {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  categoria: string;
  memoria_customizada?: string | null;
}

export interface ItemClasseIII {
  item: string; // nome_equipamento
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  consumo_fixo: number; // L/h or km/L
  tipo_combustivel_fixo: 'GASOLINA' | 'DIESEL'; // GASOLINA or DIESEL
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  dias_utilizados: number;
  consumo_lubrificante_litro: number; // L/100h or L/h
  preco_lubrificante: number; // R$/L
  memoria_customizada?: string | null;
}

// Tipo de Registro de Classe I (Ração Quente/Operacional)
export interface ClasseIRegistro extends Tables<'classe_i_registros'> {
    // Sobrescreve as propriedades para garantir que sejam numéricas e com nomes consistentes
    valor_qs: number;
    valor_qr: number;
    complemento_qs: number;
    etapa_qs: number;
    total_qs: number;
    complemento_qr: number;
    etapa_qr: number;
    total_qr: number;
    total_geral: number;
    efetivo: number;
    dias_operacao: number;
    nr_ref_int: number;
    quantidade_r2: number;
    quantidade_r3: number;
    categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
    
    // Campos de memória customizada (para evitar conflito com o nome do DB)
    memoriaQSCustomizada?: string | null;
    memoriaQRCustomizada?: string | null;
    memoriaOPCustomizada?: string | null;
    
    // Campos de OM/UG (para evitar conflito com o nome do DB)
    omQS: string;
    ugQS: string;
    faseAtividade: string | null;
    
    // Adiciona o campo de cálculos (opcional, usado apenas no frontend)
    calculos?: {
        totalQS: number;
        totalQR: number;
        nrCiclos: number;
        diasEtapaPaga: number;
        diasEtapaSolicitada: number;
        totalEtapas: number;
        complementoQS: number;
        etapaQS: number;
        complementoQR: number;
        etapaQR: number;
    };
}

// Tipo de Registro de Classes II, V, VI, VII, VIII, IX (Unificado)
export interface ClasseIIRegistro extends Tables<'classe_ii_registros'> {
    // Sobrescreve itens_equipamentos para o tipo correto
    itens_equipamentos: ItemClasseII[];
    // Adiciona campos de outras classes para unificação
    itens_remonta?: Json; // Usado para Classe VIII Remonta
    itens_saude?: Json; // Usado para Classe VIII Saúde
    itens_motomecanizacao?: ItemClasseIX[]; // Usado para Classe IX
    animal_tipo?: 'Equino' | 'Canino' | null;
    quantidade_animais?: number;
    
    // Sobrescreve para garantir que o tipo seja correto
    efetivo: number;
    dias_operacao: number;
    fase_atividade: string | null;
}

// Tipo de Registro de Classe III (Combustível/Lubrificante)
export interface ClasseIIIRegistro extends Tables<'classe_iii_registros'> {
    // Sobrescreve itens_equipamentos para o tipo correto
    itens_equipamentos: ItemClasseIII[] | null;
    // Sobrescreve para garantir que sejam numéricos
    preco_litro: number;
    preco_lubrificante: number;
    consumo_lubrificante_litro: number;
    valor_nd_30: number;
    valor_nd_39: number;
    total_litros: number;
    valor_total: number;
    dias_operacao: number;
}

// =================================================================
// TIPOS DE REGISTROS OPERACIONAIS
// =================================================================

export interface DiariaRegistro extends Tables<'diaria_registros'> {
    destino: DestinoDiaria;
    quantidades_por_posto: QuantidadesPorPosto;
    valor_nd_15: number;
    valor_nd_30: number;
    valor_taxa_embarque: number;
    valor_total: number;
    is_aereo: boolean;
    dias_operacao: number;
}

export interface VerbaOperacionalRegistro extends Tables<'verba_operacional_registros'> {
    valor_total_solicitado: number;
    valor_nd_30: number;
    valor_nd_39: number;
    dias_operacao: number;
    quantidade_equipes: number;
}

export interface PassagemRegistro extends Tables<'passagem_registros'> {
    valor_unitario: number;
    valor_total: number;
    valor_nd_33: number;
    quantidade_passagens: number;
    is_ida_volta: boolean;
    dias_operacao: number;
}

// =================================================================
// TIPOS DE RELATÓRIO
// =================================================================

export interface PTrabData extends Tables<'p_trab'> {
    // Sobrescreve para garantir que updated_at seja string
    updated_at: string;
}

export interface LinhaTabela {
  registro: ClasseIRegistro;
  valor_nd_30: number;
  valor_nd_39: number;
  tipo: 'QS' | 'QR';
}

export interface LinhaClasseII {
  registro: ClasseIIRegistro;
  valor_nd_30: number;
  valor_nd_39: number;
}

export interface LinhaClasseIII {
  registro: ClasseIIIRegistro;
  categoria_equipamento: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO' | 'LUBRIFICANTE';
  tipo_suprimento: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total_linha: number;
  total_litros_linha: number;
  preco_litro_linha: number;
  memoria_calculo: string;
}

export interface GrupoOM {
  linhasQS: LinhaTabela[];
  linhasQR: LinhaTabela[];
  linhasClasseII: LinhaClasseII[];
  linhasClasseV: LinhaClasseII[];
  linhasClasseVI: LinhaClasseII[];
  linhasClasseVII: LinhaClasseII[];
  linhasClasseVIII: LinhaClasseII[];
  linhasClasseIX: LinhaClasseII[];
  linhasClasseIII: LinhaClasseIII[];
}

// =================================================================
// TIPOS DE DIRETRIZES
// =================================================================

export interface TrechoPassagem {
    id: string;
    origem: string;
    destino: string;
    valor: number;
    tipo_transporte: TipoTransporte;
    is_ida_volta: boolean;
}

export interface DiretrizPassagem extends Tables<'diretrizes_passagens'> {
    trechos: TrechoPassagem[];
    // Sobrescreve para garantir que as datas sejam strings (ISO 8601)
    data_inicio_vigencia: string | null;
    data_fim_vigencia: string | null;
}

export interface DiretrizPassagemForm extends Omit<DiretrizPassagem, 'id' | 'user_id' | 'ano_referencia' | 'created_at' | 'updated_at' | 'ativo' | 'trechos' | 'data_inicio_vigencia' | 'data_fim_vigencia'> {
    // Trechos são gerenciados separadamente no formulário
    trechos: TrechoPassagem[];
}

// =================================================================
// TIPOS DE SELEÇÃO DE PASSAGEM (Para o formulário de registro)
// =================================================================

export interface TrechoSelection extends TrechoPassagem {
    diretriz_id: string;
    om_detentora: string;
    ug_detentora: string;
    quantidade_passagens: number;
    valor_unitario: number; // Adicionado para consistência
}