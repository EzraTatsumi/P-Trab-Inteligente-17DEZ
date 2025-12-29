import { formatCurrency, formatCodug } from "./formatUtils";
import { getCategoryLabel } from "./badgeUtils";

// Tipos necessários
type Categoria = 'Comunicações' | 'Informática'; 

interface ItemClasseVII {
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
const getCategoryArticle = (categoria: Categoria): 'do' | 'da' | 'de' => {
    switch (categoria) {
        case 'Comunicações':
            return 'de'; // Manutenção DE Comunicações
        case 'Informática':
            return 'de'; // Manutenção DE Informática
        default:
            return 'do';
    }
};

/**
 * Gera a memória de cálculo detalhada para uma categoria (usada para edição).
 * Esta função é usada para preencher o campo de edição da memória.
 */
export const generateCategoryMemoriaCalculo = (
    categoria: Categoria, 
    itens: ItemClasseVII[], 
    diasOperacao: number, 
    omDetentora: string, // OM Detentora (Source)
    ugDetentora: string, // UG Detentora (Source)
    faseAtividade: string | null | undefined,
    efetivo: number = 0, // Não usado, mas mantido para consistência de assinatura
    valorND30: number = 0, 
    valorND39: number = 0 
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalValor = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);

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
    
    // 2. Determinar o artigo 'do/da' da OM
    const omArticle = getOmArticle(omDetentora);
    
    // 3. Determinar o artigo 'do/da' da Categoria
    const categoryArticle = getCategoryArticle(categoria);
    
    // 4. Determinar singular/plural de 'dia'
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";

    // 5. Montar o cabeçalho dinâmico:
    const categoryLabel = getCategoryLabel(categoria);
    
    // Cabeçalho
    const header = `${ndPrefix} - Manutenção de componentes ${categoryArticle} ${categoryLabel} ${omArticle} ${omDetentora}, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}.`;

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        
        // APLICANDO CONCORDÂNCIA AQUI:
        const diasPluralFormula = diasOperacao === 1 ? "dia" : "dias";
        
        detalhamentoItens += `- ${item.item}: ${item.quantidade} Un. x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} ${diasPluralFormula} = ${formatCurrency(valorItem)}\n`;
    });

    // Montar a memória de cálculo completa
    return `${header}

Cálculo:
Fórmula: Nr Itens x Valor Mnt/Dia x Nr Dias de Atividade:
${detalhamentoItens.trim()}

Total: ${formatCurrency(totalValor)}.`;
};


/**
 * Generates the final, consolidated detailing string for the database record.
 * Esta função é usada para salvar no campo 'detalhamento' do DB e para o relatório final.
 */
export const generateDetalhamento = (
    itens: ItemClasseVII[], 
    diasOperacao: number, 
    omDetentora: string, // OM Detentora (Source)
    ugDetentora: string, // UG Detentora (Source)
    faseAtividade: string, 
    omDestino: string, // OM de Destino do Recurso (ND 30/39)
    ugDestino: string, // UG de Destino do Recurso (ND 30/39)
    valorND30: number, 
    valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;

    // 1. Determinar o prefixo ND
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
    
    // 2. Determinar o artigo 'do/da' da OM Detentora
    const omArticle = getOmArticle(omDetentora);
    
    // 3. Determinar singular/plural de 'dia'
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";

    // 4. Montar o cabeçalho dinâmico (usando OM Detentora)
    const header = `${ndPrefix} - Aquisição de Material de Classe VII (Diversos) para ${totalItens} itens, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}, para ${omDetentora}.`;

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
        
        // APLICANDO CONCORDÂNCIA AQUI:
        const diasPluralFormula = diasOperacao === 1 ? "dia" : "dias";

        acc[categoria].detalhes.push(
            `- ${item.item}: ${item.quantidade} Un. x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} ${diasPluralFormula} = ${formatCurrency(valorItem)}`
        );
        
        return acc;
    }, {} as Record<Categoria, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    // 6. Formatar a seção de cálculo agrupada
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        detalhamentoItens += `\n--- ${getCategoryLabel(categoria).toUpperCase()} (${grupo.totalQuantidade} ITENS) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    // Cabeçalho padronizado
    return `${header}

OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})
Recurso destinado à OM: ${omDestino} (UG: ${formatCodug(ugDestino)})
Total de Itens: ${totalItens}

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo Detalhado por Categoria:
${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;
};