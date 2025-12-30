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
 * Helper function to get the correct pluralized vehicle name based on category.
 */
const getVehiclePluralization = (categoria: string, count: number): string => {
    const label = getClasseIILabel(categoria); // Ex: Viatura Administrativa, Motocicleta
    
    if (count === 1) {
        // Singular: Viatura Administrativa, Motocicleta, Viatura Operacional, Viatura Blindada
        return label;
    }
    
    // Plural
    if (categoria === 'Motocicleta') {
        return 'Motocicletas';
    }
    
    // Para Viaturas (Vtr Administrativa, Vtr Operacional, Vtr Blindada)
    // O rótulo completo é "Viatura X". O plural é "Viaturas X".
    if (label.startsWith('Viatura')) {
        return label.replace('Viatura', 'Viaturas');
    }
    
    return label; // Fallback
};


/**
 * Generates the detailed calculation memory for a specific Classe IX category (used for editing).
 * NOTE: This function is designed to be called for a single category (e.g., 'Vtr Administrativa')
 */
export const generateCategoryMemoriaCalculo = (registro: ClasseIXRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    const itens = (registro.itens_motomecanizacao || []) as ItemClasseIX[];
    const diasOperacao = registro.dias_operacao;
    const organizacao = registro.organizacao; // OM de Destino (usada aqui como OM Detentora para simplificar o cabeçalho de edição)
    const ug = registro.ug; // UG de Destino
    const faseAtividade = registro.fase_atividade;
    const valorND30 = registro.valor_nd_30;
    const valorND39 = registro.valor_nd_39;
    const omDetentora = registro.om_detentora || organizacao;
    const ugDetentora = registro.ug_detentora || ug;
    
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorTotalFinal = valorND30 + valorND39;

    let totalItens = 0;
    let totalValorBase = 0;
    let totalValorAcionamento = 0;

    // 1. Calcular totais e agrupar detalhes
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
        totalValorBase += base;
        totalValorAcionamento += acionamento;
        
        const nrMeses = Math.ceil(diasOperacao / 30);
        const diaPlural = diasOperacao === 1 ? 'dia' : 'dias';
        const mesPlural = nrMeses === 1 ? 'mês' : 'meses';

        // Detalhamento por item
        acc[categoria].detalhes.push(
            `- ${item.item} (${item.quantidade} Vtr): Base (${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} ${diaPlural}) + Acionamento (${formatCurrency(item.valor_acionamento_mensal)}/${mesPlural} x ${nrMeses} ${mesPlural}) = ${formatCurrency(total)}`
        );
        
        return acc;
    }, {} as Record<string, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    // 2. Formatar a seção de cálculo agrupada
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        detalhamentoItens += `\n--- ${getClasseIILabel(categoria).toUpperCase()} (${grupo.totalQuantidade} VTR) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();
    
    // 3. Determinar o prefixo ND
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
    
    const diaPluralHeader = diasOperacao === 1 ? 'dia' : 'dias';
    const omArticle = getOmArticle(omDetentora);
    
    // Obtém o termo correto e pluralizado (ex: Motocicletas, Viatura Blindada)
    const categoriaLabel = registro.categoria;
    const itemPlural = getVehiclePluralization(categoriaLabel, totalItens);
    
    // CABEÇALHO DE EDIÇÃO (Corrigido para remover redundância)
    // Ex: Manutenção de 10 Motocicletas da 10ª Cia E Cmb
    // Ex: Manutenção de 1 Viatura Blindada da 10ª Cia E Cmb
    const header = `${ndPrefix} - Manutenção de ${totalItens} ${itemPlural} ${omArticle} ${omDetentora}, durante ${diasOperacao} ${diaPluralHeader} de ${faseFormatada}.`;

    return `${header}

Cálculo:
Fórmula: (Nr Vtr x Valor Mnt/Dia x Nr Dias) + (Nr Vtr x Valor Acionamento/Mês x Nr Meses).

${detalhamentoItens}

Total: ${formatCurrency(valorTotalFinal)}.`;
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
        const diaPlural = diasOperacao === 1 ? 'dia' : 'dias';
        const mesPlural = nrMeses === 1 ? 'mês' : 'meses';

        // Detalhamento por item
        acc[categoria].detalhes.push(
            `- ${item.item} (${item.quantidade} Vtr): Base (${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} ${diaPlural}) + Acionamento (${formatCurrency(item.valor_acionamento_mensal)}/${mesPlural} x ${nrMeses} ${mesPlural}) = ${formatCurrency(total)}`
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
    
    const diaPluralHeader = diasOperacao === 1 ? 'dia' : 'dias';
    const omArticle = getOmArticle(omDetentora);
    
    // Pluralização de Viatura(s)
    const vtrPlural = totalItens === 1 ? 'viatura' : 'viaturas';
    
    // Obtém o rótulo da categoria principal (usando a categoria do primeiro item, se houver)
    // Se houver mais de uma categoria, usamos 'Motomecanização'
    const categoriasAtivas = Object.keys(gruposPorCategoria);
    let categoriaLabel;
    if (categoriasAtivas.length === 1) {
        categoriaLabel = getClasseIILabel(categoriasAtivas[0]);
    } else {
        categoriaLabel = 'Motomecanização (Diversos)';
    }

    const header = `${ndPrefix} - Aquisição de Material de Classe IX (${categoriaLabel}) para ${totalItens} ${vtrPlural}, durante ${diasOperacao} ${diaPluralHeader} de ${faseAtividade}, para ${omDetentora}.`;

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