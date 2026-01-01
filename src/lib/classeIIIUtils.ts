import { formatCurrency, formatCodug } from "./formatUtils";
import { getClasseIIICategoryLabel } from "@/lib/classeIIIBadgeUtils";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

interface ItemClasseIII {
  item: string; // nome_equipamento
  categoria: TipoEquipamento;
  consumo_fixo: number; // L/h or km/L
  tipo_combustivel_fixo: CombustivelTipo; // GASOLINA or DIESEL
  unidade_fixa: 'L/h' | 'km/L'; // User input fields
  quantidade: number; // Usage fields (mutually exclusive based on category)
  horas_dia: number; // Used by GERADOR, EMBARCACAO, EQUIPAMENTO_ENGENHARIA
  distancia_percorrida: number; // Used by MOTOMECANIZACAO
  quantidade_deslocamentos: number; // Used by MOTOMECANIZACAO
  dias_utilizados: number; // Days used for this specific equipment
  // Lubricant fields (only for GERADOR, EMBARCACAO)
  consumo_lubrificante_litro: number; // L/100h or L/h
  preco_lubrificante: number; // R$/L
  // NEW: Internal state for masked input (string of digits)
  preco_lubrificante_input: string;
  // NEW: Internal state for raw decimal input (string)
  consumo_lubrificante_input: string;
}

interface GranularDisplayItem {
  id: string; // Unique ID for the display item (e.g., based on original record ID + index)
  om_destino: string; // OM Detentora do Equipamento
  ug_destino: string; // UG Detentora do Equipamento
  categoria: TipoEquipamento; // GERADOR, EMBARCACAO, etc.
  suprimento_tipo: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total: number;
  total_litros: number;
  preco_litro: number; // Only for fuel
  dias_operacao: number;
  fase_atividade: string;
  valor_nd_30: number;
  valor_nd_39: number;
  original_registro: any;
  detailed_items: ItemClasseIII[];
}

// Função auxiliar para calcular litros e valor de um item (AGORA RETORNA DETALHES DA FÓRMULA)
const calculateItemTotals = (item: ItemClasseIII, refLPC: any | null, diasOperacao: number) => {
  const diasUtilizados = item.dias_utilizados || 0;
  let litrosSemMargemItem = 0;
  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
  let formulaLitros = '';
  
  if (diasUtilizados > 0) {
    if (isMotomecanizacao) {
      if (item.consumo_fixo > 0) {
        litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
        formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${diasUtilizados} dias) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
      }
    } else {
      litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
      formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${diasUtilizados} dias`;
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
    const totalHoras = item.quantidade * item.horas_dia * diasUtilizados;
    
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
    litrosLubrificante, // Adicionado litros de lubrificante
    itemTotal,
    formulaLitros,
    precoLitro,
    litrosSemMargemItem, // Adicionado para detalhamento na UI
  };
};

// Função auxiliar para calcular totais de um grupo granular
const calculateGranularTotals = (
  items: ItemClasseIII[], 
  refLPC: any | null, 
  diasOperacao: number, 
  suprimento_tipo: GranularDisplayItem['suprimento_tipo']
) => {
    let totalValor = 0;
    let totalLitros = 0;
    let precoLitro = 0;
    
    items.forEach(item => {
        const totals = calculateItemTotals(item, refLPC, diasOperacao);
        
        if (suprimento_tipo === 'LUBRIFICANTE') {
            totalValor += totals.valorLubrificante;
            totalLitros += totals.litrosLubrificante;
        } else {
            totalValor += totals.valorCombustivel;
            totalLitros += totals.totalLitros;
            precoLitro = totals.precoLitro; // Assuming price is consistent within the group
        }
    });
    
    return { totalValor, totalLitros, precoLitro };
};

// Função auxiliar para gerar a memória de cálculo detalhada para um item granular
export const generateGranularMemoriaCalculo = (item: GranularDisplayItem, refLPC: any | null, rmFornecimento: string, codugRmFornecimento: string): string => {
    const { om_destino, ug_destino, categoria, suprimento_tipo, valor_total, total_litros, preco_litro, dias_operacao, fase_atividade, detailed_items } = item;
    
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

    if (suprimento_tipo === 'LUBRIFICANTE') {
        // MEMÓRIA LUBRIFICANTE (GRANULAR)
        // A OM Destino Recurso para Lubrificante é salva em om_detentora/ug_detentora no registro consolidado
        const omDestinoRecurso = item.original_registro.om_detentora || om_destino;
        const ugDestinoRecurso = item.original_registro.ug_detentora || ug_destino;
        
        const categoriaLabel = getEquipmentPluralization(categoria, totalEquipamentos);

        return `33.90.30 - Aquisição de Lubrificante para ${totalEquipamentos} ${categoriaLabel}, durante ${dias_operacao} dias de ${faseFormatada}.
OM Destino Recurso: ${omDestinoRecurso} (UG: ${formatCodug(ugDestinoRecurso)})

Cálculo:
Fórmula Base: (Nr Equipamentos x Nr Horas utilizadas/dia x Nr dias de utilização) x Consumo Lubrificante/hora (ou /100h).

Detalhes dos Itens:
${detailed_items.map(item => {
    const { litrosLubrificante, valorLubrificante } = calculateItemTotals(item, refLPC, dias_operacao);
    
    return `- ${item.quantidade} ${item.item} (${item.categoria}): Consumo: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/${item.categoria === 'GERADOR' ? '100h' : 'h'}. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}. Litros: ${formatNumber(litrosLubrificante, 2)} L. Valor: ${formatCurrency(valorLubrificante)}.`;
}).join('\n')}

Total Litros: ${formatNumber(total_litros, 2)} L.
Valor Total: ${formatCurrency(valor_total)}.`;
    } else {
        // MEMÓRIA COMBUSTÍVEL (GRANULAR)
        const tipoCombustivel = suprimento_tipo === 'COMBUSTIVEL_GASOLINA' ? 'Gasolina' : 'Diesel';
        const unidadeLabel = suprimento_tipo === 'COMBUSTIVEL_GASOLINA' ? 'Gas' : 'OD';
        
        let totalLitrosSemMargem = 0;
        let detalhes: string[] = [];
        
        detailed_items.forEach(item => {
            const { litrosSemMargemItem, formulaLitros } = calculateItemTotals(item, refLPC, dias_operacao);
            totalLitrosSemMargem += litrosSemMargemItem;
            // ALTERAÇÃO APLICADA AQUI: Adiciona o nome do item
            detalhes.push(`- ${item.item}: ${formulaLitros} = ${formatNumber(litrosSemMargemItem)} L ${unidadeLabel}.`);
        });
        
        const totalEquipamentos = detailed_items.reduce((sum, item) => sum + item.quantidade, 0);
        const diaPlural = dias_operacao === 1 ? 'dia' : 'dias';
        const omArticle = getOmArticle(om_destino);
        
        // NOVO: Pluralização da Categoria
        const categoriaLabel = getEquipmentPluralization(categoria, totalEquipamentos);
        
        // CABEÇALHO ATUALIZADO
        return `33.90.30 - Aquisição de Combustível (${tipoCombustivel}) para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${om_destino}, durante ${dias_operacao} ${diaPlural} de ${faseFormatada}.

Cálculo:
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada}${localConsultaDisplay}: ${tipoCombustivel} - ${formatCurrency(preco_litro)}.

Fórmula: (Nr Equipamentos x Nr/dia x Consumo) x Nr dias de utilização.
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(total_litros)} L ${unidadeLabel}.
Valor: ${formatNumber(total_litros)} L ${unidadeLabel} x ${formatCurrency(preco_litro)} = ${formatCurrency(valor_total)}.`;
    }
};

// Funções auxiliares (mantidas para evitar erros de importação no ClasseIIIForm)
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

const getOmArticle = (omName: string): string => {
    if (omName.includes('ª')) {
        return 'da';
    }
    return 'do';
};

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