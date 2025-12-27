import { formatCurrency, formatCodug } from "./formatUtils";
import { getCategoryLabel } from "./badgeUtils";

// Tipos necessários (copiados do formulário)
type Categoria = 'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN';

interface ItemClasseV {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

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
 * Determina a concordância de gênero para o cabeçalho da categoria.
 */
const getCategoryArticle = (categoria: Categoria): 'do' | 'da' => {
    switch (categoria) {
        case 'Armt L':
        case 'Armt P':
            return 'do'; // Manutenção DO Armamento Leve/Pesado
        case 'IODCT':
            return 'do'; // Manutenção DO IODCT
        case 'DQBRN':
            return 'da'; // Manutenção DA DQBRN
        default:
            return 'do';
    }
};

/**
 * Generates the detailed calculation memory for a specific Classe V category.
 */
export const generateCategoryMemoriaCalculo = (
    categoria: Categoria, 
    itens: ItemClasseV[], 
    diasOperacao: number, 
    omDestino: string, 
    ugDestino: string, 
    faseAtividade: string | null | undefined
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalValor = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);

    // Assume que a alocação de ND será feita no formulário, mas a memória deve ser genérica
    const ndPrefix = "33.90.30 / 33.90.39";
    
    const categoryArticle = getCategoryArticle(categoria);
    const categoryLabel = getCategoryLabel(categoria);
    
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";

    const header = `${ndPrefix} - Manutenção de componentes ${categoryArticle} ${categoryLabel} da OM ${omDestino}, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}.`;

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        detalhamentoItens += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.\n`;
    });

    return `${header}\n\nCálculo:\nFórmula: Nr Itens x Valor Mnt/Dia x Nr Dias:\n${detalhamentoItens.trim()}\n\nTotal: ${formatCurrency(totalValor)}.`;
};

/**
 * Generates the final, consolidated detailing string for the database record.
 */
export const generateDetalhamento = (
    itens: ItemClasseV[], 
    diasOperacao: number, 
    omDetentora: string, // Para Classe V, a Detentora é a mesma que a Destino
    ugDetentora: string, 
    faseAtividade: string, 
    omDestino: string, 
    ugDestino: string, 
    valorND30: number, 
    valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;
    
    let ndPrefix = "";
    if (valorND30 > 0 && valorND39 > 0) {
        ndPrefix += "33.90.30 / 33.90.39";
    } else if (valorND30 > 0) {
        ndPrefix += "33.90.30";
    } else if (valorND39 > 0) {
        ndPrefix += "33.90.39";
    } else {
        ndPrefix = "(Não Alocado)";
    }
    
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";

    // Cabeçalho padronizado
    const header = `${ndPrefix} - Manutenção de componente de Armamento (Diversos) da OM ${omDetentora}, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}.`;

    // Agrupar itens por categoria que possuem quantidade > 0
    const gruposPorCategoria = itens.reduce((acc, item) => {
        const categoria = item.categoria as Categoria;
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        
        if (!acc[categoria]) {
            acc[categoria] = {
                totalValor: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[categoria].totalValor += valorItem;
        acc[categoria].totalQuantidade += item.quantidade;
        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.`
        );
        
        return acc;
    }, {} as Record<Categoria, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        detalhamentoItens += `\n--- ${getCategoryLabel(categoria).toUpperCase()} (${grupo.totalQuantidade} ITENS) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    return `${header}

OM Detentora/Destino Recurso: ${omDestino} (UG: ${formatCodug(ugDestino)})
Total de Itens: ${totalItens}

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo Detalhado por Categoria:
${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;
};