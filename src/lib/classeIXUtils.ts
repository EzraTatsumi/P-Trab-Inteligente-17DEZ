import { formatCurrency, formatCodug } from "./formatUtils";
import { getClasseIILabel } from "./badgeUtils"; // Importação corrigida

// Tipos necessários para cálculo
interface ItemClasseIX {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  categoria: string;
}

interface ClasseIXRegistro {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: string;
  itens_motomecanizacao: ItemClasseIX[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
  om_detentora?: string | null;
  ug_detentora?: string | null;
}

// Tolerância para comparação de valores monetários
const ND_TOLERANCE = 0.01;

/**
 * Formats the activity phases from a semicolon-separated string into a readable text format.
 */
export const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

/**
 * Helper function to determine 'do' or 'da' based on OM name.
 */
const getOmArticle = (omName: string): string => {
    if (omName.includes('ª')) {
        return 'da';
    }
    return 'do';
};

/**
 * Calculates the total cost for a single Classe IX item (Base + Acionamento).
 */
export const calculateItemTotalClasseIX = (item: ItemClasseIX, diasOperacao: number): { base: number, acionamento: number, total: number } => {
    const nrVtr = item.quantidade;
    const valorDia = item.valor_mnt_dia;
    const valorMensal = item.valor_acionamento_mensal;
    
    if (nrVtr <= 0 || diasOperacao <= 0) {
        return { base: 0, acionamento: 0, total: 0 };
    }
    
    const custoBase = nrVtr * valorDia * diasOperacao;
    const nrMeses = Math.ceil(diasOperacao / 30);
    const custoAcionamento = nrVtr * valorMensal * nrMeses;
    
    const total = custoBase + custoAcionamento;
    
    return { base: custoBase, acionamento: custoAcionamento, total };
};

/**
 * Generates the detailed calculation memory for a specific Classe IX category (used for editing).
 */
export const generateCategoryMemoriaCalculo = (registro: ClasseIXRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    const itens = (registro.itens_motomecanizacao || []) as ItemClasseIX[];
    const diasOperacao = registro.dias_operacao;
    const organizacao = registro.organizacao;
    const ug = registro.ug;
    const faseAtividade = registro.fase_atividade;
    const valorND30 = registro.valor_nd_30;
    const valorND39 = registro.valor_nd_39;
    const omDetentora = registro.om_detentora || organizacao;
    const ugDetentora = registro.ug_detentora || ug;
    
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorTotalFinal = valorND30 + valorND39;

    let totalItens = 0;

    const gruposPorCategoria = itens.reduce((acc, item) => {
        const categoria = item.categoria;
        const { base, acionamento, total } = calculateItemTotalClasseIX(item, diasOperacao);
        
        if (!acc[categoria]) {
            acc[categoria] = {
                totalValorBase: 0,
                totalValorAcionamento: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[categoria].totalValorBase += base;
        acc[categoria].totalValorAcionamento += acionamento;
        acc[categoria].totalQuantidade += item.quantidade;
        totalItens += item.quantidade;
        
        const nrMeses = Math.ceil(diasOperacao / 30);

        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} (Base: ${formatCurrency(base)}, Acionamento: ${formatCurrency(acionamento)} em ${nrMeses} meses) = ${formatCurrency(total)}`
        );
        
        return acc;
    }, {} as Record<string, { totalValorBase: number, totalValorAcionamento: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        const totalCategoria = grupo.totalValorBase + grupo.totalValorAcionamento;

        detalhamentoItens += `\n--- ${getClasseIILabel(categoria).toUpperCase()} (${grupo.totalQuantidade} VTR) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(totalCategoria)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    return `33.90.30 / 33.90.39 - Aquisição de Material de Classe IX (Motomecanização) para ${totalItens} viaturas, durante ${diasOperacao} dias de ${faseFormatada}, para ${omDetentora}.
Recurso destinado à OM proprietária: ${organizacao} (UG: ${formatCodug(ug)})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Fórmula Base: (Nr Vtr x Valor Mnt/Dia x Nr Dias) + (Nr Vtr x Valor Acionamento/Mês x Nr Meses).

${detalhamentoItens}

Valor Total Solicitado: ${formatCurrency(valorTotalFinal)}.`;
};

/**
 * Generates the final, consolidated detailing string for the database record.
 */
export const generateDetalhamento = (
    itens: ItemClasseIX[], 
    diasOperacao: number, 
    omDetentora: string, 
    ugDetentora: string, 
    faseAtividade: string, 
    omDestino: string, 
    ugDestino: string, 
    valorND30: number, 
    valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorTotal = valorND30 + valorND39;

    // 1. Determinar o prefixo ND
    const isND30Active = valorND30 > ND_TOLERANCE;
    const isND39Active = valorND39 > ND_TOLERANCE;
    
    let ndPrefix = "";
    if (isND30Active && isND39Active) {
        ndPrefix += "33.90.30 / 33.90.39";
    } else if (isND30Active) {
        ndPrefix += "33.90.30";
    } else if (isND39Active) {
        ndPrefix += "33.90.39";
    } else {
        ndPrefix = "(Não Alocado)";
    }
    
    let totalItens = 0;
    
    // 2. Agrupar itens e calcular totais
    const gruposPorCategoria = itens.reduce((acc, item) => {
        const categoria = item.categoria;
        const { base, acionamento, total } = calculateItemTotalClasseIX(item, diasOperacao);
        
        if (!acc[categoria]) {
            acc[categoria] = {
                totalValor: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[categoria].totalValor += total;
        acc[categoria].totalQuantidade += item.quantidade;
        totalItens += item.quantidade;
        
        const nrMeses = Math.ceil(diasOperacao / 30);

        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} (Base: ${formatCurrency(base)}, Acionamento: ${formatCurrency(acionamento)} em ${nrMeses} meses) = ${formatCurrency(total)}`
        );
        
        return acc;
    }, {} as Record<string, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoCalculo = "";
    
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        detalhamentoCalculo += `\n--- ${getClasseIILabel(categoria).toUpperCase()} (${grupo.totalQuantidade} VTR) ---\n`;
        detalhamentoCalculo += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoCalculo += `Detalhes:\n`;
        detalhamentoCalculo += grupo.detalhes.join('\n');
        detalhamentoCalculo += `\n`;
    });
    
    detalhamentoCalculo = detalhamentoCalculo.trim();
    
    const diaPlural = diasOperacao === 1 ? 'dia' : 'dias';

    const header = `${ndPrefix} - Aquisição de Material de Classe IX (Motomecanização) para ${totalItens} viaturas, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}, para ${omDetentora}.`;

    // Montar o detalhamento final
    return `${header}

OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})
Recurso destinado à OM: ${omDestino} (UG: ${formatCodug(ugDestino)})
Total de Viaturas: ${totalItens}

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo Detalhado por Categoria:
${detalhamentoCalculo}

Valor Total: ${formatCurrency(valorTotal)}.`;
};