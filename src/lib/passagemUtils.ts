import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatCurrency, formatNumber, formatCodug } from "./formatUtils";
import { TrechoSelection } from "@/components/PassagemTrechoSelectorDialog";

// Tipos de dados
export type PassagemRegistro = Tables<'passagem_registros'>;
export type PassagemForm = TablesInsert<'passagem_registros'>;

// Tipo para o registro consolidado (usado no formulário e relatórios)
export interface ConsolidatedPassagemRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: PassagemRegistro[];
    totalGeral: number;
    totalND33: number;
}

/**
 * Calcula os totais de um único registro de passagem.
 * @param registro O registro de passagem.
 * @returns Um objeto com os totais calculados.
 */
export const calculatePassagemTotals = (registro: PassagemRegistro) => {
    const valorUnitario = Number(registro.valor_unitario || 0);
    const quantidadePassagens = Number(registro.quantidade_passagens || 0);
    
    const valorTotal = valorUnitario * quantidadePassagens;
    
    // Passagens são ND 33.90.33
    const valorND33 = valorTotal;
    
    return {
        valorTotal,
        valorND33,
    };
};

/**
 * Gera a memória de cálculo para um ÚNICO registro de passagem (usado no PTrab Operacional Report).
 * @param registro O registro de passagem.
 * @returns A string da memória de cálculo.
 */
export const generatePassagemMemoriaCalculo = (registro: PassagemRegistro): string => {
    // Prioriza a memória customizada se existir
    if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
        return registro.detalhamento_customizado;
    }
    
    const valorUnitario = Number(registro.valor_unitario || 0);
    const quantidadePassagens = Number(registro.quantidade_passagens || 0);
    const valorTotal = Number(registro.valor_total || 0);
    const isIdaVolta = registro.is_ida_volta;
    const tipoTransporte = registro.tipo_transporte;
    
    const omFavorecida = `${registro.organizacao} (${formatCodug(registro.ug)})`;
    const omDetentora = `${registro.om_detentora} (${formatCodug(registro.ug_detentora)})`;
    
    let memoria = `SOLICITAÇÃO DE PASSAGENS\n`;
    memoria += `OM Favorecida: ${omFavorecida}\n`;
    
    // Se a OM Detentora for diferente, incluir a linha
    if (registro.organizacao !== registro.om_detentora || registro.ug !== registro.ug_detentora) {
        memoria += `OM Destino Recurso: ${omDetentora}\n`;
    }
    
    memoria += `Fase da Atividade: ${registro.fase_atividade || 'Não Informada'}\n`;
    memoria += `Período: ${registro.dias_operacao} dias\n`;
    memoria += `Efetivo: ${registro.efetivo} militares\n`;
    memoria += `\n`;
    
    // Detalhe do Trecho
    const tipoViagem = isIdaVolta ? 'Ida/Volta' : 'Ida'; // CORRIGIDO: Usar "Ida/Volta"
    memoria += `TRECHO: ${registro.origem} -> ${registro.destino} (${tipoTransporte} - ${tipoViagem})\n`;
    memoria += `Quantidade de Passagens: ${formatNumber(quantidadePassagens)} un.\n`;
    memoria += `Valor Unitário: ${formatCurrency(valorUnitario)}\n`;
    memoria += `\n`;
    
    memoria += `CÁLCULO:\n`;
    memoria += `${formatNumber(quantidadePassagens)} un. x ${formatCurrency(valorUnitario)} = ${formatCurrency(valorTotal)}\n`;
    memoria += `TOTAL ND 33.90.33: ${formatCurrency(valorTotal)}\n`;
    
    // A linha do Pregão/UASG será adicionada dinamicamente no componente ConsolidatedPassagemMemoria.tsx
    // ou no PTrabOperacionalReport.tsx, pois depende de dados externos (diretrizes).
    
    return memoria;
};

/**
 * Gera a memória de cálculo CONSOLIDADA para um grupo de registros de passagem (usado no formulário).
 * @param group O grupo consolidado de registros.
 * @returns A string da memória de cálculo.
 */
export const generateConsolidatedPassagemMemoriaCalculo = (group: ConsolidatedPassagemRecord): string => {
    const omFavorecida = `${group.organizacao}`; // CORRIGIDO: Removendo UG do cabeçalho
    const ugFavorecida = formatCodug(group.ug);
    const omDetentora = `${group.om_detentora} (${formatCodug(group.ug_detentora)})`;
    
    let memoria = `SOLICITAÇÃO DE PASSAGENS\n`;
    memoria += `OM Favorecida: ${omFavorecida} (UG: ${ugFavorecida})\n`;
    
    // Se a OM Detentora for diferente, incluir a linha
    if (group.organizacao !== group.om_detentora || group.ug !== group.ug_detentora) {
        memoria += `OM Destino Recurso: ${omDetentora}\n`;
    }
    
    memoria += `Fase da Atividade: ${group.fase_atividade || 'Não Informada'}\n`;
    memoria += `Período: ${group.dias_operacao} dias\n`;
    memoria += `Efetivo: ${group.efetivo} militares\n`; // CORRIGIDO: Efetivo agora é um número
    memoria += `\n`;
    
    memoria += `DETALHAMENTO DOS TRECHOS:\n`;
    
    let totalGeral = 0;
    let totalPassagens = 0;
    
    group.records.forEach((registro, index) => {
        const valorUnitario = Number(registro.valor_unitario || 0);
        const quantidadePassagens = Number(registro.quantidade_passagens || 0);
        const valorTotal = valorUnitario * quantidadePassagens;
        const tipoViagem = registro.is_ida_volta ? 'Ida/Volta' : 'Ida'; // CORRIGIDO: Usar "Ida/Volta"
        
        totalGeral += valorTotal;
        totalPassagens += quantidadePassagens;
        
        memoria += `  - ${registro.origem} -> ${registro.destino} (${registro.tipo_transporte} - ${tipoViagem})\n`;
        memoria += `    Qtd: ${formatNumber(quantidadePassagens)} un. x ${formatCurrency(valorUnitario)} = ${formatCurrency(valorTotal)}\n`;
    });
    
    memoria += `\n`;
    memoria += `TOTAL CONSOLIDADO:\n`;
    memoria += `Total de Passagens: ${formatNumber(totalPassagens)} un.\n`;
    memoria += `VALOR TOTAL ND 33.90.33: ${formatCurrency(totalGeral)}\n`; // CORRIGIDO: Total estava R$ 0,00
    
    // A linha do Pregão/UASG será adicionada dinamicamente no componente ConsolidatedPassagemMemoria.tsx
    // ou no PTrabOperacionalReport.tsx, pois depende de dados externos (diretrizes).
    
    return memoria;
};