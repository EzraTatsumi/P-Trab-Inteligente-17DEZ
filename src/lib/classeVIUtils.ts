import { formatCurrency, formatCodug } from "./formatUtils";
import { getCategoryLabel } from "./badgeUtils";

// Tipos necessários (copiados do formulário para evitar dependência de tipos internos)
type Categoria = 'Gerador' | 'Embarcação' | 'Equipamento de Engenharia'; // Categorias corretas para Classe VI

// CONSTANTE DA MARGEM DE RESERVA
const MARGEM_RESERVA = 0.10; // 10%

interface ItemClasseVI {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

// Tolerância para comparação de valores monetários
const ND_TOLERANCE = 0.01;

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
 * Determina a concordância de gênero para o cabeçalho da categoria.
 * @param categoria A categoria da Classe VI.
 * @returns 'do' ou 'da' ou 'de'.
 */
const getCategoryArticle = (categoria: Categoria): 'do' | 'da' | 'de' => {
    switch (categoria) {
        case 'Embarcação':
            return 'da'; // Manutenção DE Embarcação
        case 'Equipamento de Engenharia':
        case 'Gerador':
        default:
            return 'do'; // Manutenção DO Equipamento de Engenharia / DO Gerador
    }
};

/**
 * Helper function to get the pluralized category name.
 */
const getPluralizedCategory = (categoria: Categoria, quantidade: number): string => {
    const label = getCategoryLabel(categoria); // Assumes this returns the base label
    
    if (quantidade <= 1) {
        return label;
    }
    
    switch (categoria) {
        case 'Gerador':
            return 'Geradores';
        case 'Embarcação':
            return 'Embarcações';
        case 'Equipamento de Engenharia':
            return 'Equipamentos de Engenharia'; // Correct plural form
        default:
            return `${label}s`;
    }
};


/**
 * Gera a memória de cálculo detalhada para uma categoria (usada para edição).
 * Esta função agora inclui ND 30/39 e efetivo, seguindo a estrutura da Classe V,
 * mas mantendo a lógica de margem de 10%.
 */
export const generateCategoryMemoriaCalculo = (
    categoria: Categoria, 
    itens: ItemClasseVI[], 
    diasOperacao: number, 
    omDetentora: string, // OM Detentora (Source)
    ugDetentora: string, // UG Detentora (Source)
    faseAtividade: string | null | undefined,
    efetivo: number = 0, // Adicionado efetivo (embora não usado no cálculo, é usado no detalhamento)
    valorND30: number = 0, // NOVO: Valor ND 30
    valorND39: number = 0 // NOVO: Valor ND 39
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const totalValorSemMargem = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
    const totalValorComMargem = totalValorSemMargem * (1 + MARGEM_RESERVA);
    const valorMargem = totalValorComMargem - totalValorSemMargem;

    // 1. Determinar o prefixo ND baseado nos valores (usando tolerância)
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
    
    // 2. Determinar singular/plural de 'dia'
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";
    
    // 3. Determinar o artigo 'do/da' da OM
    const omArticle = getOmArticle(omDetentora);

    // 4. Montar o cabeçalho dinâmico:
    const pluralizedCategory = getPluralizedCategory(categoria, totalQuantidade);
    
    // Cabeçalho
    const header = `${ndPrefix} - Manutenção de componentes de ${totalQuantidade} ${pluralizedCategory} ${omArticle} ${omDetentora}, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}.`;

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItemBase = item.quantidade * item.valor_mnt_dia * diasOperacao;
        const valorItemComMargem = valorItemBase * (1 + MARGEM_RESERVA);
        
        // NOVO FORMATO DE DETALHAMENTO POR ITEM
        detalhamentoItens += `- ${item.item}: ${item.quantidade} Un. x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias de Atividade + (10% Margem) = ${formatCurrency(valorItemComMargem)}.\n`;
    });

    // Montar a memória de cálculo completa
    return `${header}

Cálculo:
Fórmula: Nr Itens x Valor Mnt/Dia x Nr Dias de Atividade + (10% Margem).

${detalhamentoItens.trim()}

Valor Total Base: ${formatCurrency(totalValorSemMargem)}.
Margem de Reserva (${MARGEM_RESERVA * 100}%): ${formatCurrency(valorMargem)}.

Alocação (Com Margem):
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

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

    // 1. Determinar o prefixo ND (usando tolerância)
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
    
    // 2. Determinar o artigo 'do/da' da OM Detentora
    const omArticle = getOmArticle(omDetentora);
    
    // 3. Determinar singular/plural de 'dia'
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";
    
    // 4. Montar o cabeçalho dinâmico (usando OM Detentora)
    // Nota: Removido o efetivo, pois Classe VI não o utiliza.
    const header = `${ndPrefix} - Aquisição de Material de Classe VI (Diversos) para ${totalItens} itens, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}, para ${omDetentora}.`;

    // 5. Agrupar itens por categoria que possuem quantidade > 0
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
    
    // 6. Formatar a seção de cálculo agrupada
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

    // Cabeçalho padronizado
    return `${header}

OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})
Recurso destinado à OM: ${omDestino} (UG: ${formatCodug(ugDestino)})
Total de Itens: ${totalItens}

Cálculo Base (Sem Margem): ${formatCurrency(valorTotalSemMargem)}.
Margem de Reserva (${MARGEM_RESERVA * 100}%): ${formatCurrency(valorMargem)}.

Alocação (Com Margem):
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

${detalhamentoItens}

Valor Total Solicitado (Com Margem): ${formatCurrency(valorTotalComMargem)}.`;
};