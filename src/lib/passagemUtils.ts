import { formatCurrency, formatNumber } from "@/lib/formatUtils";

// Tipo simplificado para PassagemRegistro (deve ser consistente com o Manager)
interface PassagemRegistro {
    id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    fase_atividade: string;
    origem: string;
    destino: string;
    tipo_transporte: string;
    is_ida_volta: boolean;
    valor_unitario: number;
    quantidade_passagens: number;
    valor_total: number;
    valor_nd_33: number;
    detalhamento: string;
    detalhamento_customizado?: string | null;
    efetivo: number;
}

/**
 * Gera a memória de cálculo detalhada para um registro de Passagem.
 */
export const generatePassagemMemoriaCalculoUtility = (registro: PassagemRegistro): string => {
    const {
        organizacao,
        ug,
        om_detentora,
        ug_detentora,
        fase_atividade,
        origem,
        destino,
        tipo_transporte,
        is_ida_volta,
        valor_unitario,
        quantidade_passagens,
        valor_nd_33,
        detalhamento,
        efetivo,
    } = registro;

    const omDetentoraDisplay = om_detentora ? `${om_detentora} (${formatCodug(ug_detentora)})` : `${organizacao} (${formatCodug(ug)})`;
    const tipoViagem = is_ida_volta ? 'Ida e Volta' : 'Somente Ida';
    const valorUnitarioDisplay = formatCurrency(valor_unitario);
    const valorTotalDisplay = formatCurrency(valor_nd_33);
    const efetivoDisplay = formatNumber(efetivo);
    
    let memoria = `PASSAGENS - ND 33.90.33\n`;
    memoria += `OM Detentora: ${omDetentoraDisplay}\n`;
    memoria += `Fase: ${fase_atividade || 'Não Informada'}\n`;
    memoria += `Trecho: ${origem} -> ${destino}\n`;
    memoria += `Tipo de Transporte: ${tipo_transporte} (${tipoViagem})\n`;
    memoria += `Efetivo: ${efetivoDisplay} militares\n`;
    memoria += `Quantidade de Passagens: ${formatNumber(quantidade_passagens)}\n`;
    memoria += `Valor Unitário: ${valorUnitarioDisplay}\n`;
    memoria += `Cálculo: ${formatNumber(quantidade_passagens)} passagens x ${valorUnitarioDisplay} = ${valorTotalDisplay}\n`;
    
    if (detalhamento) {
        memoria += `Detalhamento: ${detalhamento}\n`;
    }

    return memoria;
};

// Função auxiliar para formatar CODUG (necessária para o utilitário)
const formatCodug = (codug: string | null | undefined): string => {
    if (!codug) return 'N/A';
    return codug.replace(/^(\d{5})(\d{1})$/, '$1-$2');
};