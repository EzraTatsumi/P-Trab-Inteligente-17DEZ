import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";
import { getClasseIIICategoryLabel } from "./classeIIIBadgeUtils";
import { RefLPC } from "@/types/refLPC";
import { Tables } from "@/integrations/supabase/types"; // Importando Tables

// Tipos necessários (copiados do formulário)
type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

interface ItemClasseIII {
  item: string; // nome_equipamento
  categoria: TipoEquipamento;
  consumo_fixo: number; // L/h or km/L
  tipo_combustivel_fixo: CombustivelTipo; // GASOLINA or DIESEL
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  dias_utilizados: number;
  // Lubricant fields (only for GERADOR, EMBARCACAO)
  consumo_lubrificante_litro: number; // L/100h or L/h
  preco_lubrificante: number; // R$/L
  // NEW: Internal state for masked input (string of digits)
  preco_lubrificante_input: string;
  // NEW: Internal state for raw decimal input (string)
  consumo_lubrificante_input: string;
  memoria_customizada?: string | null; // NOVO CAMPO
}

// NOVO TIPO: Estrutura esperada pela função generateGranularMemoriaCalculo
interface GranularDisplayItem {
    om_destino: string;
    ug_destino: string;
    categoria: TipoEquipamento;
    suprimento_tipo: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
    valor_total: number;
    total_litros: number;
    preco_litro: number;
    dias_operacao: number;
    fase_atividade: string;
    detailed_items: ItemClasseIII[];
    original_registro: Tables<'classe_iii_registros'>;
}

// Função auxiliar para pluralizar 'dia' ou 'dias'.
const pluralizeDay = (count: number): string => {
    return count === 1 ? 'dia' : 'dias';
};

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
    // Caso contrário, usa o padrão 'do'
    return 'do';
};

/**
 * Helper function to get the pluralized equipment name based on category.
 */
const getEquipmentPluralization = (categoria: TipoEquipamento, count: number): string => {
    const label = getClasseIIICategoryLabel(categoria);
    
    if (count === 1) {
        if (categoria === 'MOTOMECANIZACAO') return 'Viatura';
        return label;
    }
    
    switch (categoria) {
        case 'GERADOR': return 'Geradores';
        case 'EMBARCACAO': return 'Embarcações';
        case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamentos de Engenharia';
        case 'MOTOMECANIZACAO': return 'Viaturas';
        default: return `${label}s`;
    }
};

/**
 * Função auxiliar para calcular litros e valor de um item.
 */
export const calculateItemTotals = (item: ItemClasseIII, refLPC: RefLPC | null, diasOperacao: number) => {
  const diasUtilizados = item.dias_utilizados || 0;
  let litrosSemMargemItem = 0;
  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
  let formulaLitros = '';
  
  const diasPluralItem = pluralizeDay(diasUtilizados);
  
  if (diasUtilizados > 0) {
    if (isMotomecanizacao) {
      if (item.consumo_fixo > 0) {
        litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
        formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${diasUtilizados} ${diasPluralItem}) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
      }
    } else {
      litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
      formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${diasUtilizados} ${diasPluralItem}`;
    }
  }
  
  const totalLitros = litrosSemMargemItem * 1.3;
  const precoLitro = item.tipo_combustivel_fixo === 'GASOLINA' 
    ? (refLPC?.preco_gasolina ?? 0) 
    : (refLPC?.preco_diesel ?? 0);
  const valorCombustivel = totalLitros * precoLitro;
  
  let valorLubrificante = 0;
  let litrosLubrificante = 0;
  const isLubricantType = item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO';
  if (isLubricantType && item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0 && diasUtilizados > 0) {
    const totalHoras = item.quantidade * item.horas_dia * item.dias_utilizados;
    
    if (item.categoria === 'GERADOR') {
      litrosLubrificante = (totalHoras / 100) * item.consumo_lubrificante_litro;
    } else if (item.categoria === 'EMBARCACAO') {
      litrosLubrificante = totalHoras * item.consumo_lubrificante_litro;
    }
    
    valorLubrificante = litrosLubrificante * item.preco_lubrificante;
  }
  
  const itemTotal = valorCombustivel + valorLubrificante;
  
  return { 
    totalLitros, 
    valorCombustivel, 
    valorLubrificante, 
    litrosLubrificante,
    itemTotal,
    formulaLitros,
    precoLitro,
    litrosSemMargemItem,
  };
};

/**
 * Função auxiliar para gerar a memória de cálculo consolidada (usada para salvar no DB).
 * Esta função é chamada apenas no momento de salvar.
 */
export const generateConsolidatedMemoriaCalculo = (
    tipo_equipamento: 'COMBUSTIVEL_CONSOLIDADO' | 'LUBRIFICANTE_CONSOLIDADO',
    itens: ItemClasseIII[],
    diasOperacaoGlobal: number,
    omDetentoraEquipamento: string,
    ugDetentoraEquipamento: string,
    faseAtividade: string,
    omDestinoRecurso: string,
    ugDestinoRecurso: string,
    refLPC: RefLPC | null,
    valorTotal: number,
    totalLitros: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const omArticle = getOmArticle(omDetentoraEquipamento);
    const diasPluralHeader = pluralizeDay(diasOperacaoGlobal);
    
    const totalEquipamentos = itens.reduce((sum, item) => sum + item.quantidade, 0);
    
    // 1. Determinar o prefixo ND (sempre 33.90.30 para Classe III)
    const ndPrefix = "33.90.30";
    
    if (tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') {
        // MEMÓRIA LUBRIFICANTE (CONSOLIDADA)
        
        // NOVO: Pluralização da Categoria (usando a categoria mais frequente ou 'Equipamentos Diversos')
        const categoriasAtivas = Array.from(new Set(itens.map(item => item.categoria)));
        let categoriaLabel;
        if (categoriasAtivas.length === 1) {
            categoriaLabel = getEquipmentPluralization(categoriasAtivas[0], totalEquipamentos);
        } else {
            categoriaLabel = 'Equipamentos Diversos';
        }
        
        const header = `${ndPrefix} - Aquisição de Lubrificante para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${omDetentoraEquipamento}, durante ${diasOperacaoGlobal} ${diasPluralHeader} de ${faseAtividade}.`;

        let detalhamentoCalculo = "";
        
        // --- CÁLCULO DO PREÇO MÉDIO ---
        let precoMedio = 0;
        if (totalLitros > 0) {
            precoMedio = valorTotal / totalLitros;
        }
        // --- FIM CÁLCULO DO PREÇO MÉDIO ---

        // Para a exibição consolidada, pegamos o primeiro item para mostrar o consumo/preço unitário
        const firstLubricantItem = itens.find(item => item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0);
        const consumoLub = firstLubricantItem?.consumo_lubrificante_litro || 0;
        const precoLub = firstLubricantItem?.preco_lubrificante || 0;
        const consumptionUnit = firstLubricantItem?.categoria === 'GERADOR' ? 'L/100h' : 'L/h';

        // REMOVIDO: (Exemplo)
        detalhamentoCalculo += `- Consumo Lubrificante: ${formatNumber(consumoLub, 2)} ${consumptionUnit}\n`;
        detalhamentoCalculo += `- Preço Lubrificante: ${formatCurrency(precoLub)}\n\n`;
        
        detalhamentoCalculo += `Fórmula: (Nr Equipamentos x Nr Horas/dia x Nr dias) x Consumo Lubrificante.\n`;

        itens.forEach(item => {
            const { litrosLubrificante } = calculateItemTotals(item, refLPC, diasOperacaoGlobal);
            
            // NOVO FORMATO SOLICITADO: <item>: (<Qtd Item> un. x <Qtd Nr horas/dia> x <Qtd Nr dias>) x <Consumo Lubrificante> = <Total Lubrificante> (L)
            const diasPluralItem = pluralizeDay(item.dias_utilizados);
            const itemConsumptionUnit = item.categoria === 'GERADOR' ? 'L/100h' : 'L/h';
            
            const formulaPart1 = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${item.dias_utilizados} ${diasPluralItem})`;
            const formulaPart2 = `x ${formatNumber(item.consumo_lubrificante_litro, 2)} ${itemConsumptionUnit}`;
            
            // REMOVIDO: (GASOLINA) ou (DIESEL)
            detalhamentoCalculo += `- ${item.item}: ${formulaPart1} ${formulaPart2} = ${formatNumber(litrosLubrificante, 2)} L\n`;
        });
        
        return `${header}

OM Detentora Equipamento: ${omDetentoraEquipamento} (UG: ${formatCodug(ugDetentoraEquipamento)})
Recurso destinado à OM: ${omDestinoRecurso} (UG: ${formatCodug(ugDestinoRecurso)})
Total de Equipamentos: ${totalEquipamentos}

Cálculo:
${detalhamentoCalculo.trim()}

Total: ${formatNumber(totalLitros, 2)} L x ${formatCurrency(precoMedio)} = ${formatCurrency(valorTotal)}.`; // USANDO PREÇO MÉDIO
        
    } else {
        // MEMÓRIA COMBUSTÍVEL (CONSOLIDADA)
        const tipoCombustivel = itens[0].tipo_combustivel_fixo; // Assume que todos são do mesmo tipo
        const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel';
        const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        
        // NOVO: Pluralização da Categoria
        const categoriasAtivas = Array.from(new Set(itens.map(item => item.categoria)));
        let categoriaLabel;
        if (categoriasAtivas.length === 1) {
            categoriaLabel = getEquipmentPluralization(categoriasAtivas[0], totalEquipamentos);
        } else {
            categoriaLabel = 'Equipamentos Diversos';
        }
        
        const header = `${ndPrefix} - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${omDetentoraEquipamento}, durante ${diasOperacaoGlobal} ${diasPluralHeader} de ${faseAtividade}.`;

        let totalLitrosSemMargem = 0;
        let detalhes: string[] = [];
        
        // Determinar a fórmula principal
        let formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
        const hasMotomecanizacao = categoriasAtivas.includes('MOTOMECANIZACAO');
        const hasOutrasCategorias = categoriasAtivas.some(cat => cat !== 'MOTOMECANIZACAO');
        
        if (hasMotomecanizacao && !hasOutrasCategorias) {
            // APLICANDO A FÓRMULA ESPECÍFICA DE MOTOMECANIZAÇÃO
            formulaPrincipal = "Fórmula: (Nr Viaturas x Km/Desloc x Nr Desloc/dia x Nr Dias) ÷ Rendimento (Km/L).";
        } else if (hasMotomecanizacao && hasOutrasCategorias) {
            // Se houver mistura, usa a fórmula genérica (ou a mais complexa)
            formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/Km x Consumo) x Nr dias de utilização.";
        } else {
            // Apenas Gerador/Embarcação/Engenharia
            formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
        }
        
        itens.forEach(item => {
            const { litrosSemMargemItem, formulaLitros } = calculateItemTotals(item, refLPC, diasOperacaoGlobal);
            totalLitrosSemMargem += litrosSemMargemItem;
            detalhes.push(`- ${item.item}: ${formulaLitros} = ${formatNumber(litrosSemMargemItem)} L ${unidadeLabel}.`);
        });
        
        const totalLitrosComMargem = totalLitrosSemMargem * 1.3;
        const precoLitro = tipoCombustivel === 'GASOLINA' 
            ? refLPC?.preco_gasolina ?? 0 
            : refLPC?.preco_diesel ?? 0;
        const valorTotal = totalLitrosComMargem * precoLitro;
        
        const formatarData = (data: string) => {
            const [ano, mes, dia] = data.split('-');
            return `${dia}/${mes}/${ano}`;
        };
        
        const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
        const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
        const localConsultaDisplay = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? ` (${refLPC.nome_local})` : '';
        
        // REMOVIDO: OM Detentora Equipamento e Recurso fornecido pela RM
        return `${header}

Cálculo:
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada}${localConsultaDisplay}: ${combustivelLabel} - ${formatCurrency(precoLitro)}.

${formulaPrincipal}

${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% (Margem) = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(precoLitro)} = ${formatCurrency(valorTotal)}.`;
    }
};

/**
 * Função auxiliar para gerar a memória de cálculo detalhada para um item granular
 */
export const generateGranularMemoriaCalculo = (item: GranularDisplayItem, refLPC: RefLPC | null, rmFornecimento: string, codugRmFornecimento: string): string => {
    const { om_destino, ug_destino, categoria, suprimento_tipo, valor_total, total_litros, preco_litro, dias_operacao, fase_atividade, detailed_items } = item;
    
    // 1. Check for custom memory on the first item of the granular group
    // Since we are now storing custom memory on the ItemClasseIII, we check the first item.
    if (detailed_items.length > 0 && detailed_items[0].memoria_customizada) {
        return detailed_items[0].memoria_customizada;
    }
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    const totalEquipamentos = detailed_items.reduce((sum, item) => sum + item.quantidade, 0);
    
    const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    };
    
    const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
    const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
    
    // Lógica de exibição do local:
    let localConsultaDisplay = '';
    if (refLPC) {
        // Se for Nacional, não exibe o nome do local, apenas o âmbito
        if (refLPC.ambito === 'Nacional') {
            localConsultaDisplay = ` (${refLPC.ambito})`;
        } else if (refLPC.nome_local) {
            // Se for Estadual/Municipal e tiver nome_local
            localConsultaDisplay = ` (${refLPC.ambito} - ${refLPC.nome_local})`;
        } else {
            // Se for Estadual/Municipal mas sem nome_local
            localConsultaDisplay = ` (${refLPC.ambito})`;
        }
    }

    const diasPluralHeader = pluralizeDay(dias_operacao);

    if (suprimento_tipo === 'LUBRIFICANTE') {
        // MEMÓRIA LUBRIFICANTE (CONSOLIDADA POR CATEGORIA)
        // A OM Destino Recurso para Lubrificante é salva em om_detentora/ug_detentora no registro consolidado
        const omDestinoRecurso = item.original_registro.om_detentora || om_destino;
        const ugDestinoRecurso = item.original_registro.ug_detentora || ug_destino;
        
        const categoriaLabel = getEquipmentPluralization(categoria, totalEquipamentos);
        const omArticle = getOmArticle(om_destino);
        
        // --- CÁLCULO DO PREÇO MÉDIO ---
        let precoMedio = 0;
        if (total_litros > 0) {
            precoMedio = valor_total / total_litros;
        }
        // --- FIM CÁLCULO DO PREÇO MÉDIO ---
        
        // Para a exibição, pegamos o consumo/preço do primeiro item (assumindo consistência dentro da categoria)
        const firstItem = detailed_items[0];
        const consumoLub = firstItem.consumo_lubrificante_litro || 0;
        const precoLub = firstItem.preco_lubrificante || 0;
        const consumptionUnit = firstItem.categoria === 'GERADOR' ? 'L/100h' : 'L/h';

        return `33.90.30 - Aquisição de Lubrificante para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${om_destino}, durante ${dias_operacao} ${diasPluralHeader} de ${fase_atividade}.

Cálculo:
- Consumo Lubrificante: ${formatNumber(consumoLub, 2)} ${consumptionUnit}
- Preço Lubrificante: ${formatCurrency(precoLub)}

Fórmula: (Nr Equipamentos x Nr Horas/dia x Nr dias) x Consumo Lubrificante.
${detailed_items.map(item => {
    const { litrosLubrificante } = calculateItemTotals(item, refLPC, dias_operacao);
    
    const diasPluralItem = pluralizeDay(item.dias_utilizados);
    const itemConsumptionUnit = item.categoria === 'GERADOR' ? 'L/100h' : 'L/h';
    
    const formulaPart1 = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${item.dias_utilizados} ${diasPluralItem})`;
    const formulaPart2 = `x ${formatNumber(item.consumo_lubrificante_litro, 2)} ${itemConsumptionUnit}`;
    
    // REMOVIDO: (item.tipo_combustivel_fixo)
    return `- ${item.item}: ${formulaPart1} ${formulaPart2} = ${formatNumber(litrosLubrificante, 2)} L`;
}).join('\n')}

Total: ${formatNumber(total_litros, 2)} L x ${formatCurrency(precoMedio)} = ${formatCurrency(valor_total)}.`; // USANDO PREÇO MÉDIO
    } else {
        // MEMÓRIA COMBUSTÍVEL (GRANULAR)
        const tipoCombustivel = suprimento_tipo === 'COMBUSTIVEL_GASOLINA' ? 'Gasolina' : 'Diesel';
        const unidadeLabel = suprimento_tipo === 'COMBUSTIVEL_GASOLINA' ? 'GAS' : 'OD';
        
        let totalLitrosSemMargem = 0;
        let detalhes: string[] = [];
        
        detailed_items.forEach(item => {
            const { litrosSemMargemItem, formulaLitros } = calculateItemTotals(item, refLPC, dias_operacao);
            totalLitrosSemMargem += litrosSemMargemItem;
            detalhes.push(`- ${item.item}: ${formulaLitros} = ${formatNumber(litrosSemMargemItem)} L ${unidadeLabel}.`);
        });
        
        const totalEquipamentos = detailed_items.reduce((sum, item) => sum + item.quantidade, 0);
        const omArticle = getOmArticle(om_destino);
        
        // NOVO: Pluralização da Categoria
        const categoriaLabel = getEquipmentPluralization(categoria, totalEquipamentos);
        
        // Determinar a fórmula principal
        let formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
        if (categoria === 'MOTOMECANIZACAO') {
            // APLICANDO A FÓRMULA ESPECÍFICA DE MOTOMECANIZAÇÃO
            formulaPrincipal = "Fórmula: (Nr Viaturas x Km/Desloc x Nr Desloc/dia x Nr Dias) ÷ Rendimento (Km/L).";
        }
        
        // CABEÇALHO ATUALIZADO
        return `33.90.30 - Aquisição de Combustível (${tipoCombustivel}) para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${om_destino}, durante ${dias_operacao} ${diasPluralHeader} de ${fase_atividade}.

Cálculo:
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada}${localConsultaDisplay}: ${tipoCombustivel} - ${formatCurrency(preco_litro)}.

${formulaPrincipal}
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% (Margem) = ${formatNumber(total_litros)} L ${unidadeLabel}.
Valor: ${formatNumber(total_litros)} L ${unidadeLabel} x ${formatCurrency(preco_litro)} = ${formatCurrency(valor_total)}.`;
    }
};