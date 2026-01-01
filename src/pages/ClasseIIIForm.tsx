import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, Sparkles, Tractor, Droplet, Check, ChevronsUpDown, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import RefLPCFormSection from "@/components/RefLPCFormSection";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands, formatCurrencyInput, numberToRawDigits, formatCodug } from "@/lib/formatUtils";
import { TablesInsert } from "@/integrations/supabase/types";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { getClasseIIICategoryBadgeStyle, getClasseIIICategoryLabel } from "@/lib/classeIIIBadgeUtils";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

const CATEGORIAS: { key: TipoEquipamento, label: string, icon: React.FC<any> }[] = [
  { key: 'GERADOR', label: 'Gerador', icon: Zap },
  { key: 'EMBARCACAO', label: 'Embarcação', icon: Ship },
  { key: 'EQUIPAMENTO_ENGENHARIA', label: 'Equipamento de Engenharia', icon: Tractor },
  { key: 'MOTOMECANIZACAO', label: 'Motomecanização', icon: Truck },
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

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

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora do Equipamento
  ug: string; // UG Detentora do Equipamento
  dias_operacao: number; // Global days of activity (used only for detailing header)
  itens: ItemClasseIII[]; // All items across all categories (SAVED/COMMITTED)
}

interface LubricantAllocation {
  om_destino_recurso: string; // OM Destino Recurso (ND 30)
  ug_destino_recurso: string; // UG Destino Recurso (ND 30)
  selectedOmDestinoId?: string;
}

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: string; // COMBUSTIVEL_CONSOLIDADO, LUBRIFICANTE_CONSOLIDADO
  organizacao: string; // OM Detentora do Equipamento (para agrupamento)
  ug: string; // UG Detentora do Equipamento (para agrupamento)
  quantidade: number;
  dias_operacao: number; // Global days of activity (saved for context)
  tipo_combustivel: string;
  preco_litro: number;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  itens_equipamentos?: any;
  fase_atividade?: string;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
  valor_nd_30: number;
  valor_nd_39: number;
  // Campos existentes no DB para OM Detentora do Recurso (Lubrificante)
  om_detentora?: string | null; 
  ug_detentora?: string | null;
}

// NEW INTERFACE FOR GRANULAR DISPLAY
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
  original_registro: ClasseIIIRegistro;
  detailed_items: ItemClasseIII[];
}

// NEW INTERFACE FOR CONSOLIDATED DISPLAY (Seção 4)
interface ConsolidatedSuprimentoGroup {
  om_detentora_equipamento: string; // OM Detentora (Chave de agrupamento)
  ug_detentora_equipamento: string;
  suprimento_tipo: 'COMBUSTIVEL' | 'LUBRIFICANTE';
  total_valor: number;
  total_litros: number;
  // Totais detalhados por categoria (para exibição)
  categoria_totais: Record<TipoEquipamento, { litros: number, valor: number }>;
  // Referência ao registro consolidado original (para ações de edição/deleção)
  original_registro: ClasseIIIRegistro;
}

const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
  if (!faseCSV) return 'operação';
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

// NOVO: Função para capitalizar a primeira letra
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
  return Math.abs(a - b) < tolerance;
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
        // Singular: Gerador, Embarcação, Equipamento de Engenharia, Viatura
        if (categoria === 'MOTOMECANIZACAO') return 'Viatura';
        return label;
    }
    
    // Plural
    switch (categoria) {
        case 'GERADOR': return 'Geradores';
        case 'EMBARCACAO': return 'Embarcações';
        case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamentos de Engenharia';
        case 'MOTOMECANIZACAO': return 'Viaturas';
        default: return `${label}s`;
    }
};

/**
 * Helper function to pluralize 'dia' or 'dias'.
 */
const pluralizeDay = (count: number): string => {
    return count === 1 ? 'dia' : 'dias';
};

// Função auxiliar para calcular litros e valor de um item (AGORA RETORNA DETALHES DA FÓRMULA)
const calculateItemTotals = (item: ItemClasseIII, refLPC: RefLPC | null, diasOperacao: number) => {
  const diasUtilizados = item.dias_utilizados || 0;
  let litrosSemMargemItem = 0;
  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
  let formulaLitros = '';
  
  const diasPluralItem = pluralizeDay(diasUtilizados);
  
  if (diasUtilizados > 0) {
    if (isMotomecanizacao) {
      if (item.consumo_fixo > 0) {
        litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
        // NOVO TEXTO DA FÓRMULA PARA MOTOMECANIZAÇÃO
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
  refLPC: RefLPC | null, 
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

/**
 * Função auxiliar para gerar a memória de cálculo consolidada (usada para salvar no DB).
 * Esta função é chamada apenas no momento de salvar.
 */
const generateConsolidatedMemoriaCalculo = (
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
        
        const header = `${ndPrefix} - Aquisição de Lubrificante para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${omDetentoraEquipamento}, durante ${diasOperacaoGlobal} ${diasPluralHeader} de ${faseFormatada}.`;

        let detalhamentoCalculo = "";
        itens.forEach(item => {
            const { litrosLubrificante, valorLubrificante } = calculateItemTotals(item, refLPC, diasOperacaoGlobal);
            
            // NOVO FORMATO SOLICITADO: <item>: (<Qtd Item> un. x <Qtd Horas/dia> x <Qtd Dias>) x <Consumo> = <Total Lubrificante>.
            const consumoUnit = item.categoria === 'GERADOR' ? 'L/100h' : 'L/h';
            
            detalhamentoCalculo += `- ${item.item}: (${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${item.dias_utilizados} ${pluralizeDay(item.dias_utilizados)}) x ${formatNumber(item.consumo_lubrificante_litro, 2)} ${consumoUnit} = ${formatCurrency(valorLubrificante)} (${formatNumber(litrosLubrificante, 2)} L)\n`;
        });
        
        return `${header}

OM Detentora Equipamento: ${omDetentoraEquipamento} (UG: ${formatCodug(ugDetentoraEquipamento)})
Total de Equipamentos: ${totalEquipamentos}

Cálculo Detalhado:
${detalhamentoCalculo.trim()}

Valor Total: ${formatCurrency(valorTotal)}.`;
        
    } else {
        // MEMÓRIA COMBUSTÍVEL (CONSOLIDADA)
        const tipoCombustivel = itens[0].tipo_combustivel_fixo; // Assume que todos são do mesmo tipo
        const precoLitro = tipoCombustivel === 'GASOLINA' 
            ? refLPC?.preco_gasolina 
            : refLPC?.preco_diesel;
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
        
        const header = `${ndPrefix} - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${omDetentoraEquipamento}, durante ${diasOperacaoGlobal} ${diasPluralHeader} de ${faseFormatada}.`;

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
        
        const totalLitros = totalLitrosSemMargem * 1.3;
        const valorTotal = totalLitros * (precoLitro || 0);
        
        const formatarData = (data: string) => {
            const [ano, mes, dia] = data.split('-');
            return `${dia}/${mes}/${ano}`;
        };
        
        const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
        const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
        const localConsultaDisplay = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? ` (${refLPC.nome_local})` : ''; // NEW DEFINITION
        
        // REESTRUTURAÇÃO DA MEMÓRIA DE CÁLCULO DE COMBUSTÍVEL (NOVO PADRÃO)
        return `${header}

Cálculo:
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada}${localConsultaDisplay}: ${combustivelLabel} - ${formatCurrency(precoLitro || 0)}.

${formulaPrincipal}

${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% (Margem) = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(precoLitro || 0)} = ${formatCurrency(valorTotal)}.`;
    }
};

/**
 * Função auxiliar para gerar a memória de cálculo detalhada para um item granular
 */
const generateGranularMemoriaCalculo = (item: GranularDisplayItem, refLPC: RefLPC | null, rmFornecimento: string, codugRmFornecimento: string): string => {
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

    const diasPluralHeader = pluralizeDay(dias_operacao);

    if (suprimento_tipo === 'LUBRIFICANTE') {
        // MEMÓRIA LUBRIFICANTE (GRANULAR)
        // A OM Destino Recurso para Lubrificante é salva em om_detentora/ug_detentora no registro consolidado
        const omDestinoRecurso = item.original_registro.om_detentora || om_destino;
        const ugDestinoRecurso = item.original_registro.ug_detentora || ug_destino;
        
        const categoriaLabel = getEquipmentPluralization(categoria, totalEquipamentos);
        const omArticle = getOmArticle(om_destino);

        return `33.90.30 - Aquisição de Lubrificante para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${om_destino}, durante ${dias_operacao} ${diasPluralHeader} de ${faseFormatada}.

Cálculo:
Fórmula Base: (Nr Equipamentos x Nr Horas utilizadas/dia x Nr dias de utilização) x Consumo Lubrificante/hora (ou /100h).

Detalhes dos Itens:
${detailed_items.map(item => {
    const { litrosLubrificante, valorLubrificante } = calculateItemTotals(item, refLPC, dias_operacao);
    
    // NOVO FORMATO SOLICITADO: <item>: (<Qtd Item> un. x <Qtd Horas/dia> x <Qtd Dias>) x <Consumo> = <Total Lubrificante>.
    const consumoUnit = item.categoria === 'GERADOR' ? 'L/100h' : 'L/h';
    
    return `- ${item.item}: (${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${item.dias_utilizados} ${pluralizeDay(item.dias_utilizados)}) x ${formatNumber(item.consumo_lubrificante_litro, 2)} ${consumoUnit} = ${formatCurrency(valorLubrificante)} (${formatNumber(litrosLubrificante, 2)} L)`;
}).join('\n')}

Total Litros: ${formatNumber(total_litros, 2)} L.
Valor Total: ${formatCurrency(valor_total)}.`;
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
        return `33.90.30 - Aquisição de Combustível (${tipoCombustivel}) para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${om_destino}, durante ${dias_operacao} ${diasPluralHeader} de ${faseFormatada}.

Cálculo:
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada}${localConsultaDisplay}: ${tipoCombustivel} - ${formatCurrency(preco_litro)}.

${formulaPrincipal}
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% (Margem) = ${formatNumber(total_litros)} L ${unidadeLabel}.
Valor: ${formatNumber(total_litros)} L ${unidadeLabel} x ${formatCurrency(preco_litro)} = ${formatCurrency(valor_total)}.`;
    }
};


const ClasseIIIForm = () => {
// ... (rest of the component remains unchanged)