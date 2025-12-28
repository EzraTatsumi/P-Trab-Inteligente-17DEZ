import { formatCurrency, formatCodug } from "./formatUtils";
import { getCategoryLabel } from "./badgeUtils";

// Tipos necessários (copiados do formulário para evitar dependência de tipos internos)
interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

type Categoria = 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';

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
 * @param categoria A categoria da Classe II.
 * @returns 'do' ou 'da'.
 */
const getCategoryArticle = (categoria: Categoria): 'do' | 'da' => {
    switch (categoria) {
        case 'Proteção Balística':
            return 'da'; // Manutenção de componentes DA Proteção Balística
        case 'Equipamento Individual':
        case 'Material de Estacionamento':
        default:
            return 'do'; // Manutenção de componentes DO Equipamento Individual / DO Material de Estacionamento
    }
};

/**
 * Generates the detailed calculation memory for a specific Classe II category.
 * This is used for the editable memory field.
 */
export const generateClasseIIMemoriaCalculo = (
    categoria: Categoria, 
    itens: ItemClasseII[], 
    diasOperacao: number, 
    omDetentora: string, // OM Detentora (Source)
    ugDetentora: string, // UG Detentora (Source)
    faseAtividade: string | null | undefined,
    efetivo: number, // NOVO: Efetivo Empregado
    valorND30: number, // NOVO: Valor ND 30
    valorND39: number // NOVO: Valor ND 39
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalValor = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);

    // 1. Determinar o prefixo ND (REMOVIDO 'ND ')
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
    
    // 2. Determinar singular/plural do efetivo
    const militarPlural = efetivo === 1 ? "militar" : "militares";
    
    // 3. Determinar o artigo 'do/da' da OM
    const omArticle = getOmArticle(omDetentora);
    
    // 4. Determinar o artigo 'do/da' da Categoria
    const categoryArticle = getCategoryArticle(categoria);
    
    // 5. Determinar singular/plural de 'dia' (para o cabeçalho)
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";

    // 6. Montar o cabeçalho dinâmico
    const categoryLabel = getCategoryLabel(categoria);
    const header = `${ndPrefix} - Manutenção de componentes ${categoryArticle} ${categoryLabel} de ${efetivo} ${militarPlural} ${omArticle} ${omDetentora}, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}.`;

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        // NOVO FORMATO: - <Item>: <Qtd Item> Un. x <Mnt/Dia> x <Qtd Dias Atividade> = <Total>
        // APLICANDO CONCORDÂNCIA AQUI:
        const diasPluralFormula = diasOperacao === 1 ? "dia" : "dias";
        detalhamentoItens += `- ${item.item}: ${item.quantidade} Un. x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} ${diasPluralFormula} = ${formatCurrency(valorItem)}\n`;
    });

    // Montar a memória de cálculo simplificada
    return `${header}\n\nCálculo:\nFórmula: Nr Itens x Valor Mnt/Dia x Nr Dias:\n${detalhamentoItens.trim()}\n\nTotal: ${formatCurrency(totalValor)}.`;
};

/**
 * Generates the final, consolidated detailing string for the database record.
 * This includes the ND split and the OM of resource destination.
 */
export const generateDetalhamento = (
    itens: ItemClasseII[], 
    diasOperacao: number, 
    omDetentora: string, // OM Detentora (Source)
    ugDetentora: string, // UG Detentora (Source)
    faseAtividade: string, 
    omDestino: string, // OM de Destino do Recurso
    ugDestino: string, // UG de Destino do Recurso
    valorND30: number, 
    valorND39: number,
    efetivo: number // NOVO: Efetivo
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;
    
    // 1. Determinar o prefixo ND (REMOVIDO 'ND ')
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
    
    // 2. Determinar singular/plural do efetivo
    const militarPlural = efetivo === 1 ? "militar" : "militares";
    
    // 3. Determinar o artigo 'do/da'
    const omArticle = getOmArticle(omDetentora);
    
    // 4. Determinar singular/plural de 'dia'
    const diaPlural = diasOperacao === 1 ? "dia" : "dias";

    // 5. Montar o cabeçalho dinâmico (usando OM Detentora)
    // Nota: Aqui usamos uma descrição genérica 'Material de Intendência (Diversos)'
    const header = `${ndPrefix} - Manutenção de componente de Material de Intendência (Diversos) de ${efetivo} ${militarPlural} ${omArticle} ${omDetentora}, durante ${diasOperacao} ${diaPlural} de ${faseFormatada}.`;


    // 6. Agrupar itens por categoria que possuem quantidade > 0
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
            // NOVO FORMATO: - <Item>: <Qtd Item> Un. x <Mnt/Dia> x <Qtd Dias Atividade> = <Total> (sem ponto final)
            `- ${item.item}: ${item.quantidade} Un. x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} ${diasPluralFormula} = ${formatCurrency(valorItem)}`
        );
        
        return acc;
    }, {} as Record<Categoria, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    // 7. Formatar a seção de cálculo agrupada
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
OM Destino Recurso: ${omDestino} (UG: ${formatCodug(ugDestino)})
Total de Itens: ${totalItens}

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo Detalhado por Categoria:
${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;
};