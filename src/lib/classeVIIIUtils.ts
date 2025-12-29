import { formatCurrency, formatCodug } from "./formatUtils";
import { getCategoryLabel } from "./badgeUtils";
import { DiretrizClasseII } from "@/types/diretrizesClasseII";

// Tipos necessários (copiados do formulário)
type Categoria = 'Saúde' | 'Remonta/Veterinária';

interface ItemSaude {
  item: string;
  quantidade: number; // Nr Kits
  valor_mnt_dia: number; // Valor do Kit
  categoria: 'Saúde';
}

interface ItemRemonta {
  item: string; // Ex: Equino, Canino
  quantidade_animais: number;
  dias_operacao_item: number; // Dias específicos de uso do animal
  valor_mnt_dia: number; // Valor base (Anual/Mensal/Diário)
  categoria: 'Remonta/Veterinária';
}

type ItemClasseVIII = ItemSaude | ItemRemonta;

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
    // Verifica se a OM contém 'ª' (ex: 23ª Bda Inf Sl)
    if (omName.includes('ª')) {
        return 'da';
    }
    // Verifica se a OM é uma Região Militar (RM)
    if (omName.toUpperCase().includes('RM')) {
        return 'da';
    }
    return 'do';
};

/**
 * Helper function to get the pluralized animal name.
 */
const getAnimalPlural = (animalType: 'Equino' | 'Canino', count: number): string => {
    const base = animalType.toLowerCase();
    return count === 1 ? base : `${base}s`;
};

// --- Lógica de Cálculo Remonta/Veterinária ---

export const calculateRemontaItemTotal = (item: ItemRemonta): number => {
    const baseValue = item.valor_mnt_dia;
    const nrAnimais = item.quantidade_animais;
    const diasOperacao = item.dias_operacao_item;
    
    if (diasOperacao <= 0 || nrAnimais <= 0) return 0;

    let total = 0;
    
    if (item.item.includes('(Anual)')) {
        // Item B, D, E (Annual): Nr Animais x Item Valor x ceil(diasOperacao / 365)
        const multiplier = Math.ceil(diasOperacao / 365);
        total = baseValue * multiplier * nrAnimais;
        
    } else if (item.item.includes('(Mensal)')) {
        // Item C (Monthly): [Nr Animais x (Item C / 30 dias) x Nr dias]
        // Formula: Nr Animais x Item C x (diasOperacao / 30)
        total = nrAnimais * (baseValue / 30) * diasOperacao;
        
    } else {
        // Item G (Daily): Nr Animais x Item Valor x diasOperacao
        total = baseValue * diasOperacao * nrAnimais;
    }
    
    return total;
};

export const calculateSaudeItemTotal = (item: ItemSaude): number => {
    return item.valor_mnt_dia * item.quantidade;
};

/**
 * Calculates the total cost for a specific animal type (Equino/Canino) by aggregating all related directives.
 * This is used in the form to calculate the total for the animal type input row.
 */
export const calculateTotalForAnimalType = (
    animalItem: ItemRemonta, 
    allDirectives: DiretrizClasseII[]
): number => {
    const animalType = animalItem.item; // 'Equino' or 'Canino'
    const nrAnimais = animalItem.quantidade_animais;
    const diasOperacao = animalItem.dias_operacao_item;
    
    if (nrAnimais <= 0 || diasOperacao <= 0) return 0;
    
    // Filter directives related to this animal type (e.g., 'Equino - Item B: ...', 'Equino - Item C: ...')
    const relatedDirectives = allDirectives.filter(d => d.item.includes(animalType));
    
    const directivesAsItems: ItemRemonta[] = relatedDirectives.map(d => ({
        item: d.item,
        quantidade_animais: nrAnimais,
        dias_operacao_item: diasOperacao,
        valor_mnt_dia: Number(d.valor_mnt_dia),
        categoria: 'Remonta/Veterinária',
    }));
    
    return directivesAsItems.reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
};

// --- Geração de Memória de Cálculo ---

/**
 * Generates the detailed calculation memory for a specific Classe VIII category (Saúde or Remonta).
 * This is used for the editable memory field.
 */
export const generateCategoryMemoriaCalculo = (
    categoria: Categoria, 
    itens: ItemClasseVIII[], 
    diasOperacaoGlobal: number, 
    omDetentora: string, 
    ugDetentora: string, 
    faseAtividade: string | null | undefined,
    efetivo: number = 0, // Não usado, mas mantido para consistência de assinatura
    valorND30: number = 0, 
    valorND39: number = 0,
    animalTipo?: 'Equino' | 'Canino' // Apenas para Remonta
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const omArticle = getOmArticle(omDetentora);
    
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
    
    if (categoria === 'Saúde') {
        const itensSaude = itens as ItemSaude[];
        const totalKits = itensSaude.reduce((sum, item) => sum + item.quantidade, 0);
        const totalValor = itensSaude.reduce((sum, item) => calculateSaudeItemTotal(item) + sum, 0);
        
        let detalhamentoCalculo = "";
        itensSaude.forEach(item => {
            const itemTotal = calculateSaudeItemTotal(item);
            detalhamentoCalculo += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)} = ${formatCurrency(itemTotal)}\n`;
        });
        
        // Lógica de concordância para Kits e Dias
        const kitPlural = totalKits === 1 ? 'Kit' : 'Kits';
        const diaPlural = diasOperacaoGlobal === 1 ? 'dia' : 'dias';
        
        // CABEÇALHO SAÚDE
        const header = `${ndPrefix} - Recomposição de itens de ${totalKits} ${kitPlural} de Primeiros Socorros e Prescrição Tática ${omArticle} ${omDetentora}, durante ${diasOperacaoGlobal} ${diaPlural} de ${faseFormatada}.`;
        
        return `${header}

Cálculo:
Fórmula: Nr KPSC/KPT x valor do item
${detalhamentoCalculo.trim()}

Total: ${formatCurrency(totalValor)}.`;
        
    } else { // Remonta/Veterinária
        const itensRemonta = itens as ItemRemonta[];
        
        // Agrupar itens pelo tipo de animal (Equino ou Canino)
        const itensPorAnimal = itensRemonta.filter(i => i.item.includes(animalTipo || ''));
        
        if (itensPorAnimal.length === 0) return "Memória de cálculo não disponível para este tipo de animal.";
        
        const nrAnimais = itensPorAnimal[0].quantidade_animais;
        const diasOperacaoItem = itensPorAnimal[0].dias_operacao_item;
        const totalValor = itensPorAnimal.reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        
        let formulaComponents: string[] = [];
        let calculationComponents: string[] = [];
        let detailedItemsList = ""; // Lista de itens detalhados
        
        // Agrupar itens por tipo (B, C, D, E, G) ou por item completo se não tiver prefixo
        const groupedItems: Record<string, ItemRemonta[]> = itensPorAnimal.reduce((acc, item) => {
            const itemTypeMatch = item.item.match(/-\s([A-G]):/);
            const key = itemTypeMatch ? itemTypeMatch[1] : item.item; // Usa o item completo como chave se não houver prefixo
            
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<string, ItemRemonta[]>);
        
        // Ordenar as chaves para garantir a ordem (B, C, D, E, G, e depois os demais)
        const sortedKeys = Object.keys(groupedItems).sort((a, b) => {
            const order = ['B', 'C', 'D', 'E', 'G'];
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
        
        sortedKeys.forEach(key => {
            const itemsOfType = groupedItems[key] || [];
            
            itemsOfType.forEach(item => {
                const baseValue = item.valor_mnt_dia;
                const itemTotal = calculateRemontaItemTotal(item);
                
                const itemTypeMatch = item.item.match(/-\s([A-G]):/);
                const itemPrefix = itemTypeMatch ? `Item ${itemTypeMatch[1]}` : item.item;
                const itemDescription = itemTypeMatch ? item.item.split(/-\s[A-G]:\s/)[1].trim() : item.item;
                
                const itemUnit = item.item.includes('(Anual)') ? 'ano' : item.item.includes('(Mensal)') ? 'mês' : 'dia';
                
                detailedItemsList += `- ${itemPrefix} (${itemDescription}): ${formatCurrency(baseValue)} / ${getAnimalPlural(animalTipo!, 1)} / ${itemUnit}.\n`;
                
                // Pluralização correta de dias
                const diasPluralFormula = diasOperacaoItem === 1 ? 'dia' : 'dias';
                const animalPluralFormula = getAnimalPlural(animalTipo!, nrAnimais);
                
                // Lógica para montar a fórmula (calculationComponents)
                if (item.item.includes('(Mensal)')) {
                    formulaComponents.push(`[Nr ${animalPluralFormula} x (Item C / 30 dias) x Nr dias]`);
                    calculationComponents.push(`(${nrAnimais} x (${formatCurrency(baseValue)} / 30 dias) x ${diasOperacaoItem} ${diasPluralFormula})`);
                } else if (item.item.includes('(Diário)')) {
                    formulaComponents.push(`(Nr ${animalPluralFormula} x Item G x Nr dias)`);
                    calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)} x ${diasOperacaoItem} ${diasPluralFormula})`);
                } else if (item.item.includes('(Anual)')) {
                    formulaComponents.push(`(Nr ${animalPluralFormula} x Item ${itemTypeMatch ? itemTypeMatch[1] : 'Anual'})`);
                    const multiplier = Math.ceil(diasOperacaoItem / 365);
                    if (multiplier > 1) {
                        calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)} x ${multiplier} anos)`);
                    } else {
                        calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)})`);
                    }
                } else {
                    // Novo item (Medicação, etc.) - Assume-se que é um custo por animal por dia/período
                    // Se não tiver prefixo, assume-se que é um custo por animal por dia de operação
                    formulaComponents.push(`(Nr ${animalPluralFormula} x ${itemDescription} x Nr dias)`);
                    calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)} x ${diasOperacaoItem} ${diasPluralFormula})`);
                }
            });
        });
        
        const formulaString = formulaComponents.join(' + ');
        const calculationString = calculationComponents.join(' + ');
        
        // CABEÇALHO REMONTA (AJUSTADO)
        const animalPlural = getAnimalPlural(animalTipo!, nrAnimais);
        const diaPlural = diasOperacaoItem === 1 ? 'dia' : 'dias';
        
        const header = `${ndPrefix} - Recomposição dos itens de Remonta/Veterinária de ${nrAnimais} ${animalPlural} ${omArticle} ${omDetentora}, durante ${diasOperacaoItem} ${diaPlural} de ${faseFormatada}.`;

        // REORDENAMENTO FINAL:
        return `${header}

Cálculo:
${detailedItemsList.trim()}

Fórmula: ${formulaString} = ${formatCurrency(totalValor)}.
- ${calculationString} = ${formatCurrency(totalValor)}.

Total: ${formatCurrency(totalValor)}.`;
    }
};


/**
 * Generates the final, consolidated detailing string for the database record.
 * This is used for the 'detalhamento' field in the DB.
 */
export const generateDetalhamento = (
    itens: ItemClasseVIII[], 
    diasOperacaoGlobal: number, 
    omDetentora: string, 
    ugDetentora: string, 
    faseAtividade: string, 
    omDestino: string, 
    ugDestino: string, 
    valorND30: number, 
    valorND39: number,
    categoria: Categoria,
    animalTipo?: 'Equino' | 'Canino'
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const omArticle = getOmArticle(omDetentora);
    const valorTotal = valorND30 + valorND39;

    // 1. Determinar o prefixo ND
    let ndPrefix = "";
    if (valorND30 > ND_TOLERANCE && valorND39 > ND_TOLERANCE) {
        ndPrefix += "33.90.30 / 33.90.39";
    } else if (valorND30 > ND_TOLERANCE) {
        ndPrefix += "33.90.30";
    } else if (valorND39 > ND_TOLERANCE) {
        ndPrefix += "33.90.39";
    } else {
        ndPrefix = "(Não Alocado)";
    }
    
    let header = "";
    let detalhamentoCalculo = "";
    let totalItens = 0;
    
    if (categoria === 'Saúde') {
        const itensSaude = itens as ItemSaude[];
        totalItens = itensSaude.reduce((sum, item) => sum + item.quantidade, 0);
        
        // Lógica de concordância para Kits e Dias
        const kitPlural = totalItens === 1 ? 'Kit' : 'Kits';
        const diaPlural = diasOperacaoGlobal === 1 ? 'dia' : 'dias';
        
        // NOVO CABEÇALHO
        header = `${ndPrefix} - Recomposição de itens de ${totalItens} ${kitPlural} de Primeiros Socorros e Prescrição Tática ${omArticle} ${omDetentora}, durante ${diasOperacaoGlobal} ${diaPlural} de ${faseFormatada}.`;
        
        itensSaude.forEach(item => {
            const itemTotal = calculateSaudeItemTotal(item);
            detalhamentoCalculo += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)} = ${formatCurrency(itemTotal)}\n`;
        });
        
    } else { // Remonta/Veterinária
        const itensRemonta = itens as ItemRemonta[];
        
        // Filtra itens apenas para o tipo de animal específico (Equino ou Canino)
        const itensPorAnimal = itensRemonta.filter(i => i.item.includes(animalTipo || ''));
        
        if (itensPorAnimal.length === 0) return "Detalhamento não disponível.";
        
        const nrAnimais = itensPorAnimal[0].quantidade_animais;
        const diasOperacaoItem = itensPorAnimal[0].dias_operacao_item;
        totalItens = nrAnimais;
        
        // CABEÇALHO REMONTA (AJUSTADO)
        const animalPlural = getAnimalPlural(animalTipo!, nrAnimais);
        const diaPlural = diasOperacaoItem === 1 ? 'dia' : 'dias';
        
        header = `${ndPrefix} - Recomposição dos itens de Remonta/Veterinária de ${nrAnimais} ${animalPlural} ${omArticle} ${omDetentora}, durante ${diasOperacaoItem} ${diaPlural} de ${faseFormatada}.`;

        // Detalhamento de Remonta (usando a lógica de cálculo detalhada)
        const groupedItems: Record<string, ItemRemonta[]> = itensPorAnimal.reduce((acc, item) => {
            const itemTypeMatch = item.item.match(/-\s([A-G]):/);
            const key = itemTypeMatch ? itemTypeMatch[1] : item.item; // Usa o item completo como chave se não houver prefixo
            
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<string, ItemRemonta[]>);
        
        detalhamentoCalculo += `--- ${animalTipo?.toUpperCase()} (${nrAnimais} ANIMAIS) ---\n`;
        
        // Ordenar as chaves para garantir a ordem (B, C, D, E, G, e depois os demais)
        const sortedKeys = Object.keys(groupedItems).sort((a, b) => {
            const order = ['B', 'C', 'D', 'E', 'G'];
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
        
        sortedKeys.forEach(key => {
            const itemsOfType = groupedItems[key] || [];
            itemsOfType.forEach(item => {
                const itemTotal = calculateRemontaItemTotal(item);
                const itemDescription = item.item.split(/-\s[A-G]:\s/)[1]?.trim() || item.item;
                const itemUnit = item.item.includes('(Anual)') ? 'ano' : item.item.includes('(Mensal)') ? 'mês' : 'dia';
                
                // Pluralização correta de dias
                const diasPluralFormula = diasOperacaoItem === 1 ? 'dia' : 'dias';
                const animalPluralFormula = getAnimalPlural(animalTipo!, nrAnimais);
                
                let formulaDetail = `${nrAnimais} un. x ${formatCurrency(item.valor_mnt_dia)} / ${itemUnit}`;
                if (item.item.includes('(Mensal)')) {
                    formulaDetail = `${nrAnimais} un. x (${formatCurrency(item.valor_mnt_dia)} / 30 dias) x ${diasOperacaoItem} ${diasPluralFormula}`;
                } else if (item.item.includes('(Diário)')) {
                    formulaDetail = `${nrAnimais} un. x ${formatCurrency(item.valor_mnt_dia)} x ${diasOperacaoItem} ${diasPluralFormula}`;
                } else if (item.item.includes('(Anual)')) {
                    const multiplier = Math.ceil(diasOperacaoItem / 365);
                    if (multiplier > 1) {
                        formulaDetail = `${nrAnimais} un. x ${formatCurrency(item.valor_mnt_dia)} x ${multiplier} anos`;
                    }
                }
                
                detalhamentoCalculo += `- Item ${key} (${itemDescription}): ${formulaDetail} = ${formatCurrency(itemTotal)}\n`;
            });
        });
    }

    // Montar o detalhamento final
    return `${header}

OM Detentora: ${omDetentora} (UG: ${formatCodug(ugDetentora)})
Recurso destinado à OM: ${omDestino} (UG: ${formatCodug(ugDestino)})
Total de Itens: ${totalItens}

Cálculo Detalhado:
${detalhamentoCalculo.trim()}

Valor Total: ${formatCurrency(valorTotal)}.`;
};