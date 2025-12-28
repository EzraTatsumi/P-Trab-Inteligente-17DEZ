import { formatCurrency, formatCodug } from "./formatUtils";
import { getCategoryLabel } from "./badgeUtils";

// Tipos necessários (copiados do formulário para evitar dependência de tipos internos)
type Categoria = 'Embarcação' | 'Equipamento de Engenharia'; // Categorias corretas para Classe VI

// CONSTANTE DA MARGEM DE RESERVA
const MARGEM_RESERVA = 0.10; // 10%

interface ItemClasseVI {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

/**
 * Formats the activity phases from a semicolon-separated string into a readable text format.
 * @param faseCSV The semicolon-separated string of phases.
 * @returns A formatted string (e.g., "Execução, Reconhecimento e Mobilização").
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
 * Assumes 'da' if the OM name contains 'ª' (indicating feminine ordinal number).
 * @param omName The name of the Military Organization (OM).
 * @returns 'do' or 'da'.
 */
const getOmArticle = (omName: string): string => {
    // Verifica se a OM contém 'ª' (ex: 23ª Bda Inf Sl)
    if (omName.includes('ª')) {
        return 'da';
    }
    // Caso contrário, usa o padrão 'do'
    return 'do';
};

/**
 * Gera a memória de cálculo detalhada para uma categoria (usada para edição).
 * Esta função não inclui a alocação ND 30/39, apenas o cálculo base.
 */
export const generateCategoryMemoriaCalculo = (
    categoria: Categoria, 
    itens: ItemClasseVI[], 
    diasOperacao: number, 
    omDetentora: string, // OM Detentora (Source)
    ugDetentora: string, // UG Detentora (Source)
    faseAtividade: string | null | undefined
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const totalValorSemMargem = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
    const totalValorComMargem = totalValorSemMargem * (1 + MARGEM_RESERVA);

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        detalhamentoItens += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.\n`;
    });

    return `33.90.30 - Aquisição de Material de Classe VI (${getCategoryLabel(categoria)})
OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})
Período: ${diasOperacao} dias de ${faseFormatada}
Total de Itens na Categoria: ${totalQuantidade}

Cálculo:
Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

Detalhes dos Itens (Valor Base):
${detalhamentoItens.trim()}

Valor Total Base: ${formatCurrency(totalValorSemMargem)}.
Margem de Reserva (${MARGEM_RESERVA * 100}%): ${formatCurrency(totalValorComMargem - totalValorSemMargem)}.

Valor Total Solicitado (Com Margem): ${formatCurrency(totalValorComMargem)}.`;
};


/**
 * Generates the final, consolidated detailing string for the database record.
 * This includes the ND split and the OM of resource destination.
 */
export const generateDetalhamento = (
    itens: ItemClasseVI[], 
    diasOperacao: number, 
    omDetentora: string, // NOVO: OM Detentora (Source)
    ugDetentora: string, // NOVO: UG Detentora (Source)
    faseAtividade: string, 
    omDestino: string, // OM de Destino do Recurso (ND 30/39)
    ugDestino: string, // UG de Destino do Recurso (ND 30/39)
    valorND30: number, 
    valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotalComMargem = valorND30 + valorND39;
    const valorTotalSemMargem = valorTotalComMargem / (1 + MARGEM_RESERVA);
    const valorMargem = valorTotalComMargem - valorTotalSemMargem;

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
        
        // Valor do item com margem
        const valorItemComMargem = valorItem * (1 + MARGEM_RESERVA);

        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias (+10% Margem) = ${formatCurrency(valorItemComMargem)}.`
        );
        
        return acc;
    }, {} as Record<Categoria, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        // O valor total base aqui é o valor SEM margem, mas o detalhamento abaixo usa o valor COM margem
        const totalCategoriaComMargem = grupo.totalValor * (1 + MARGEM_RESERVA);

        detalhamentoItens += `\n--- ${getCategoryLabel(categoria).toUpperCase()} (${grupo.totalQuantidade} ITENS) ---\n`;
        detalhamentoItens += `Valor Total Base Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Valor Total Categoria (C/ Margem): ${formatCurrency(totalCategoriaComMargem)}\n`;
        detalhamentoItens += `Detalhes (Valores já incluem 10% de Margem):\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    return `33.90.30 / 33.90.39 - Aquisição de Material de Classe VI (Diversos) para ${totalItens} itens, durante ${diasOperacao} dias de ${faseFormatada}, para ${omDetentora}.
OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})
Recurso destinado à OM: ${omDestino} (UG: ${formatCodug(ugDestino)})

Cálculo Base (Sem Margem): ${formatCurrency(valorTotalSemMargem)}.
Margem de Reserva (${MARGEM_RESERVA * 100}%): ${formatCurrency(valorMargem)}.

Alocação (Com Margem):
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

${detalhamentoItens}

Valor Total Solicitado (Com Margem): ${formatCurrency(valorTotalComMargem)}.`;
};