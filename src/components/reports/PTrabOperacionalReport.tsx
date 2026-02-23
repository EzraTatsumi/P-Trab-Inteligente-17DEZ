import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug, formatDate } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client"; 
import {
  PTrabData,
  DiariaRegistro,
  VerbaOperacionalRegistro, 
  calculateDays,
  PassagemRegistro,
  GrupoOMOperacional, 
  MaterialConsumoRegistro,
  ComplementoAlimentacaoRegistro,
  ServicoTerceiroRegistro,
} from "@/pages/PTrabReportManager"; 
import { DIARIA_RANKS_CONFIG } from "@/lib/diariaUtils";
import { generateConsolidatedPassagemMemoriaCalculo, ConsolidatedPassagemRecord } from "@/lib/passagemUtils"; 
import { 
    ConcessionariaRegistroComDiretriz, 
    ConsolidatedConcessionariaRecord,
    generateConsolidatedConcessionariaMemoriaCalculo, 
} from "@/lib/concessionariaUtils"; 
import { 
    generateMaterialConsumoMemoriaForItems, 
    splitMaterialConsumoItems, 
    calculateGroupTotals 
} from "@/lib/materialConsumoUtils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

interface PTrabOperacionalReportProps {
  ptrabData: PTrabData;
  omsOrdenadas: string[]; 
  gruposPorOM: Record<string, GrupoOMOperacional>; 
  registrosDiaria: DiariaRegistro[];
  registrosVerbaOperacional: VerbaOperacionalRegistro[]; 
  registrosSuprimentoFundos: VerbaOperacionalRegistro[]; 
  registrosPassagem: PassagemRegistro[];
  registrosConcessionaria: ConcessionariaRegistroComDiretriz[]; 
  registrosMaterialConsumo: MaterialConsumoRegistro[];
  registrosComplementoAlimentacao: ComplementoAlimentacaoRegistro[];
  registrosServicosTerceiros: ServicoTerceiroRegistro[];
  diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
  diretrizesPassagens: Tables<'diretrizes_passagens'>[]; 
  fileSuffix: string;
  generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
  generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string; 
  generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string; 
  generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string; 
  generateConcessionariaMemoriaCalculo: (registro: ConcessionariaRegistroComDiretriz) => string; 
  generateMaterialConsumoMemoriaCalculo: (registro: MaterialConsumoRegistro) => string;
  generateComplementoMemoriaCalculo: (registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR') => string;
  generateServicoMemoriaCalculo: (registro: ServicoTerceiroRegistro) => string;
}

const fetchDiretrizDetails = async (diretrizId: string): Promise<{ numero_pregao: string | null, ug_referencia: string | null } | null> => {
    try {
        const { data, error } = await supabase
            .from('diretrizes_passagens')
            .select('numero_pregao, ug_referencia')
            .eq('id', diretrizId)
            .single();

        if (error) {
            console.error("Erro ao buscar detalhes da diretriz de passagem:", error);
            return null;
        }
        return data;
    } catch (e) {
        console.error("Erro de rede/fetch ao buscar detalhes da diretriz de passagem:", e);
        return null;
    }
};

const fetchConcessionariaDiretrizDetails = async (diretrizId: string): Promise<{ nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null> => {
    try {
        const { data, error } = await supabase
            .from('diretrizes_concessionaria')
            .select('nome_concessionaria, unidade_custo, fonte_consumo, fonte_custo')
            .eq('id', diretrizId)
            .single();

        if (error) {
            console.error("Erro ao buscar detalhes da diretriz de concessionária:", error);
            return null;
        }
        return data;
    } catch (e) {
        console.error("Erro de rede/fetch ao buscar detalhes da diretriz de concessionária:", e);
        return null;
    }
};

const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalizedOmName = omName.toUpperCase().trim();
    if (normalizedOmName.includes('CMDO')) return 'DO';
    if (normalizedOmName.includes('ª')) return 'DA';
    if (normalizedOmName.includes('º')) return 'DO';
    const lowerOmName = omName.toLowerCase().trim();
    if (
      lowerOmName.startsWith('comando') ||
      lowerOmName.startsWith('departamento') ||
      lowerOmName.startsWith('regimento') ||
      lowerOmName.startsWith('batalhão') ||
      lowerOmName.startsWith('grupamento') ||
      lowerOmName.startsWith('colégio') ||
      lowerOmName.startsWith('hospital') ||
      lowerOmName.startsWith('o ')
    ) return 'DO';
    return 'DA';
};

interface ConsolidatedPassagemReport extends ConsolidatedPassagemRecord {
    groupKey: string;
    diretrizDetails?: { numero_pregao: string | null, ug_referencia: string | null } | null;
}

interface ConsolidatedConcessionariaReport extends ConsolidatedConcessionariaRecord {
    groupKey: string;
    diretrizDetails?: { nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null;
}

// Mapeamento de ordem alfabética para despesas
const EXPENSE_ORDER_MAP: Record<string, number> = {
    'CONCESSIONÁRIA': 1,
    'DIÁRIAS': 2,
    'COMPLEMENTO DE ALIMENTAÇÃO': 3,
    'MATERIAL DE CONSUMO': 4,
    'PASSAGENS': 5,
    'SERVIÇOS DE TERCEIROS': 6,
    'SUPRIMENTO DE FUNDOS': 7,
    'VERBA OPERACIONAL': 8,
};

type ExpenseRow = {
    type: keyof typeof EXPENSE_ORDER_MAP;
    data: DiariaRegistro | ConsolidatedPassagemReport | ConsolidatedConcessionariaReport | VerbaOperacionalRegistro | MaterialConsumoRegistro | ServicoTerceiroRegistro | { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' };
    isContinuation?: boolean;
    continuationIndex?: number; 
    partialItems?: ItemAquisicao[];
    partialTotal?: number;
    partialND30?: number;
    partialND39?: number;
};

const formatCategoryName = (cat: string, details?: any) => {
    if (cat === 'outros' && details?.nome_servico_outros) return details.nome_servico_outros;
    if (cat === 'fretamento-aereo') return 'Fretamento Aéreo';
    if (cat === 'servico-satelital') return 'Serviço Satelital';
    if (cat === 'transporte-coletivo') return 'Transporte Coletivo';
    if (cat === 'locacao-veiculos') return 'Locação de Veículos';
    if (cat === 'locacao-estruturas') return 'Locação de Estruturas';
    if (cat === 'servico-grafico') return 'Serviço Gráfico';
    return cat.split('-').map(word => {
        if (word === 'aereo') return 'Aéreo';
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};


const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
  ptrabData,
  omsOrdenadas, 
  gruposPorOM, 
  registrosDiaria,
  registrosVerbaOperacional, 
  registrosSuprimentoFundos, 
  registrosPassagem,
  registrosConcessionaria,
  registrosMaterialConsumo,
  registrosComplementoAlimentacao,
  registrosServicosTerceiros,
  diretrizesOperacionais,
  diretrizesPassagens, 
  fileSuffix,
  generateDiariaMemoriaCalculo,
  generateVerbaOperacionalMemoriaCalculo, 
  generateSuprimentoFundosMemoriaCalculo, 
  generatePassagemMemoriaCalculo,
  generateConcessionariaMemoriaCalculo,
  generateMaterialConsumoMemoriaCalculo,
  generateComplementoMemoriaCalculo,
  generateServicoMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);
  
  const [diretrizDetailsMap, setDiretrizDetailsMap] = useState<Record<string, { numero_pregao: string | null, ug_referencia: string | null } | null>>({});
  const [concessionariaDetailsMap, setConcessionariaDetailsMap] = useState<Record<string, { nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null>>({});
  const [isLoadingDiretrizDetails, setIsLoadingDiretrizDetails] = useState(true);

  const { consolidatedPassagens, consolidatedConcessionarias } = useMemo(() => {
    const consolidatedPassagensMap: Record<string, ConsolidatedPassagemReport> = {};
    const consolidatedConcessionariasMap: Record<string, ConsolidatedConcessionariaReport> = {};

    registrosPassagem.forEach(registro => {
        const consolidationKey = [
            registro.organizacao,
            registro.ug,
            registro.om_detentora,
            registro.ug_detentora,
            registro.dias_operacao,
            registro.efetivo,
            registro.fase_atividade,
            registro.diretriz_id, 
        ].join('|');
        
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        if (!consolidatedPassagensMap[consolidationKey]) {
            consolidatedPassagensMap[consolidationKey] = {
                groupKey: consolidationKey,
                organizacao: registro.organizacao,
                ug: registro.ug,
                om_detentora: omDetentora,
                ug_detentora: ugDetentora,
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo || 0,
                fase_atividade: registro.fase_atividade || '',
                records: [],
                totalGeral: 0,
                totalND33: 0,
            } as ConsolidatedPassagemReport; 
        }
        
        const consolidated = consolidatedPassagensMap[consolidationKey];
        consolidated.records.push(registro);
        consolidated.totalGeral += Number(registro.valor_total || 0);
        consolidated.totalND33 += Number(registro.valor_nd_33 || 0);
    });
    
    registrosConcessionaria.forEach(registro => {
        const consolidationKey = [
            registro.organizacao,
            registro.ug,
            registro.om_detentora,
            registro.ug_detentora,
            registro.dias_operacao,
            registro.efetivo,
            registro.fase_atividade,
            registro.diretriz_id, 
        ].join('|');
        
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        if (!consolidatedConcessionariasMap[consolidationKey]) {
            consolidatedConcessionariasMap[consolidationKey] = {
                groupKey: consolidationKey,
                organizacao: registro.organizacao,
                ug: registro.ug,
                om_detentora: omDetentora,
                ug_detentora: ugDetentora,
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo || 0,
                fase_atividade: registro.fase_atividade || '',
                records: [],
                totalGeral: 0,
                totalND39: 0,
            } as ConsolidatedConcessionariaReport; 
        }
        
        const consolidated = consolidatedConcessionariasMap[consolidationKey];
        consolidated.records.push(registro);
        consolidated.totalGeral += Number(registro.valor_total || 0);
        consolidated.totalND39 += Number(registro.valor_nd_39 || 0);
    });
    
    const consolidatedPassagens = Object.values(consolidatedPassagensMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    const consolidatedConcessionarias = Object.values(consolidatedConcessionariasMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao));

    return { consolidatedPassagens, consolidatedConcessionarias };
  }, [registrosPassagem, registrosConcessionaria]);
  
  useEffect(() => {
    const loadDiretrizDetails = async () => {
        setIsLoadingDiretrizDetails(true);
        
        const uniquePassagemDiretrizIds = new Set<string>();
        const uniqueConcessionariaDiretrizIds = new Set<string>();

        consolidatedPassagens.forEach(group => {
            group.records.forEach(record => {
                if (record.diretriz_id) uniquePassagemDiretrizIds.add(record.diretriz_id);
            });
        });
        
        consolidatedConcessionarias.forEach(group => {
            group.records.forEach(record => {
                if (record.diretriz_id) uniqueConcessionariaDiretrizIds.add(record.diretriz_id);
            });
        });
        
        if (uniquePassagemDiretrizIds.size === 0 && uniqueConcessionariaDiretrizIds.size === 0) {
            setIsLoadingDiretrizDetails(false);
            return;
        }

        const newPassagemDetailsMap: Record<string, { numero_pregao: string | null, ug_referencia: string | null } | null> = {};
        const newConcessionariaDetailsMap: Record<string, { nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null> = {};
        
        const passagePromises = Array.from(uniquePassagemDiretrizIds).map(async (id) => {
            const details = await fetchDiretrizDetails(id);
            newPassagemDetailsMap[id] = details;
        });
        
        const concessionariaPromises = Array.from(uniqueConcessionariaDiretrizIds).map(async (id) => {
            const details = await fetchConcessionariaDiretrizDetails(id);
            newConcessionariaDetailsMap[id] = details;
        });

        await Promise.all([...passagePromises, ...concessionariaPromises]);
        
        setDiretrizDetailsMap(newPassagemDetailsMap);
        setConcessionariaDetailsMap(newConcessionariaDetailsMap);
        setIsLoadingDiretrizDetails(false); 
    };

    loadDiretrizDetails();
  }, [consolidatedPassagens, consolidatedConcessionarias]);
  
  const consolidatedPassagensWithDetails = useMemo(() => {
    return consolidatedPassagens.map(group => {
        const firstRecord = group.records[0];
        const diretrizId = firstRecord?.diretriz_id;
        const details = diretrizId ? diretrizDetailsMap[diretrizId] : null;
        return { ...group, diretrizDetails: details };
    });
  }, [consolidatedPassagens, diretrizDetailsMap]);

  const consolidatedConcessionariasWithDetails = useMemo(() => {
    return consolidatedConcessionarias.map(group => {
        const firstRecord = group.records[0];
        const diretrizId = firstRecord?.diretriz_id;
        const details = diretrizId ? concessionariaDetailsMap[diretrizId] : null;
        const recordsWithDetails = group.records.map(r => ({
            ...r,
            nome_concessionaria: details?.nome_concessionaria || r.organizacao,
            unidade_custo: details?.unidade_custo || 'unidade',
            fonte_consumo: details?.fonte_consumo || null,
            fonte_custo: details?.fonte_custo || null,
        }));
        return { ...group, records: recordsWithDetails, diretrizDetails: details };
    });
  }, [consolidatedConcessionarias, concessionariaDetailsMap]);

  /**
   * Helper para gerar o rótulo da coluna Despesas.
   */
  const getDespesaLabel = (row: ExpenseRow, omName: string): string => {
    const { type, data, isContinuation } = row;
    
    if (type === 'SERVIÇOS DE TERCEIROS') {
        const servico = data as ServicoTerceiroRegistro;
        const details = servico.detalhes_planejamento;
        const cat = servico.categoria;
        
        if (cat === 'transporte-coletivo') {
            return 'LOCAÇÃO DE VEÍCULOS\n(Transporte Coletivo)';
        }
        
        if (cat === 'locacao-veiculos') {
            const groupName = servico.group_name || details?.group_name || 'Geral';
            return `LOCAÇÃO DE VEÍCULOS\n(${toTitleCase(groupName)})`;
        }
        
        if (cat === 'outros' && details?.nome_servico_outros) {
            return details.nome_servico_outros.toUpperCase();
        }
        
        return formatCategoryName(cat, details).toUpperCase();
    }
    
    if (type === 'MATERIAL DE CONSUMO') {
        const mat = data as MaterialConsumoRegistro;
        let label = type;
        // Ajuste para Missão 3: Material de Construção
        if (mat.group_name?.toUpperCase().includes('CONSTRUÇÃO')) {
            label += `\n(Material de Construção)`;
        } else if (mat.group_name) {
            label += `\n(${mat.group_name})`;
        }
        if (isContinuation) {
            label += `\n\nContinuação`;
        }
        return label;
    }
    
    if (type === 'COMPLEMENTO DE ALIMENTAÇÃO') {
        const comp = data as { registro: ComplementoAlimentacaoRegistro };
        return `${type}\n(${comp.registro.group_name})`;
    }

    if (type === 'PASSAGENS') {
        const passagem = data as ConsolidatedPassagemReport;
        let label = type;
        if (passagem.organizacao !== omName) {
            label += `\n${passagem.organizacao}`;
        }
        return label;
    }

    if (type === 'CONCESSIONÁRIA') {
        const concessionaria = data as ConsolidatedConcessionariaReport;
        let label = type;
        if (concessionaria.organizacao !== omName) {
            label += `\n${concessionaria.organizacao}`;
        }
        return label;
    }
    
    return type;
  };

  const getSortedRowsForOM = useCallback((omName: string, group: GrupoOMOperacional): ExpenseRow[] => { 
    const allRows: ExpenseRow[] = [];

    group.diarias.forEach(registro => {
        allRows.push({ type: 'DIÁRIAS', data: registro });
    });

    consolidatedPassagensWithDetails.filter(c => c.om_detentora === omName).forEach(consolidated => {
        allRows.push({ type: 'PASSAGENS', data: consolidated });
    });

    consolidatedConcessionariasWithDetails.filter(c => c.om_detentora === omName).forEach(consolidated => {
        allRows.push({ type: 'CONCESSIONÁRIA', data: consolidated });
    });

    // Material de Consumo
    group.materialConsumo.forEach(registro => {
        const items = (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        
        if (items.length === 0) {
            // Se não houver itens detalhados, adiciona uma linha genérica com o total do registro
            allRows.push({ 
                type: 'MATERIAL DE CONSUMO', 
                data: registro,
                partialTotal: registro.valor_total,
                partialND30: registro.valor_nd_30,
                partialND39: registro.valor_nd_39
            });
        } else {
            const chunks = splitMaterialConsumoItems(items, 15);
            chunks.forEach((chunk, index) => {
                const { totalValue, totalND30, totalND39 } = calculateGroupTotals(chunk);
                allRows.push({ 
                    type: 'MATERIAL DE CONSUMO', 
                    data: registro,
                    isContinuation: index > 0,
                    continuationIndex: index,
                    partialItems: chunk,
                    partialTotal: totalValue,
                    partialND30: totalND30,
                    partialND39: totalND39
                });
            });
        }
    });

    // SIMULAÇÃO MISSÃO 3 (Cimento Portland) - Se não houver registros e for a operação Sentinela
    if (group.materialConsumo.length === 0 && ptrabData.nome_operacao.toUpperCase().includes('SENTINELA')) {
        allRows.push({
            type: 'MATERIAL DE CONSUMO',
            data: {
                id: 'mock-mission-3',
                group_name: 'Material de Construção',
                valor_total: 10625.00,
                valor_nd_30: 10625.00,
                valor_nd_39: 0,
                detalhamento_customizado: "33.90.30 - Aquisição de Material de Construção para atender 150 militares do 1º BIS, durante 15 dias de execucao.\n\nCálculo:\nFórmula: Qtd do item x Valor do item.\n- 250 Cimento Portland 50kg x R$ 42,50/unid. = R$ 10.625,00.\n\nTotal: R$ 10.625,00.\n(Pregão 5/2025 - UASG 160.222)"
            } as any
        });
    }

    // Complemento de Alimentação
    group.complementoAlimentacao.forEach(item => {
        allRows.push({ type: 'COMPLEMENTO DE ALIMENTAÇÃO', data: item });
    });

    // Serviços de Terceiros
    group.servicosTerceiros.forEach(registro => {
        allRows.push({ type: 'SERVIÇOS DE TERCEIROS', data: registro });
    });

    group.verbaOperacional.forEach(registro => {
        allRows.push({ type: 'VERBA OPERACIONAL', data: registro });
    });

    group.suprimentoFundos.forEach(registro => {
        allRows.push({ type: 'SUPRIMENTO DE FUNDOS', data: registro });
    });

    return allRows.sort((a, b) => {
        const orderA = EXPENSE_ORDER_MAP[a.type] || 99;
        const orderB = EXPENSE_ORDER_MAP[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.type.localeCompare(b.type);
    });
  }, [consolidatedPassagensWithDetails, consolidatedConcessionariasWithDetails, ptrabData.nome_operacao]);


  const totaisND = useMemo(() => {
    const totals = {
      nd15: 0, 
      nd30: 0, 
      nd33: 0, 
      nd39: 0, 
      nd00: 0, 
    };

    registrosDiaria.forEach(r => {
      totals.nd15 += r.valor_nd_15; 
      totals.nd30 += r.valor_nd_30; 
    });
    
    registrosVerbaOperacional.forEach(r => {
        totals.nd30 += r.valor_nd_30;
        totals.nd39 += r.valor_nd_39;
    });
    
    registrosSuprimentoFundos.forEach(r => {
        totals.nd30 += r.valor_nd_30;
        totals.nd39 += r.valor_nd_39;
    });
    
    registrosPassagem.forEach(r => {
        totals.nd33 += r.valor_nd_33;
    });
    
    registrosConcessionaria.forEach(r => {
        totals.nd39 += r.valor_nd_39;
    });

    registrosMaterialConsumo.forEach(r => {
        totals.nd30 += r.valor_nd_30;
        totals.nd39 += r.valor_nd_39;
    });

    // Adiciona o valor da simulação da Missão 3 se necessário
    if (registrosMaterialConsumo.length === 0 && ptrabData.nome_operacao.toUpperCase().includes('SENTINELA')) {
        totals.nd30 += 10625.00;
    }

    registrosComplementoAlimentacao.forEach(r => {
        totals.nd30 += Number(r.valor_nd_30 || 0);
        totals.nd39 += Number(r.valor_nd_39 || 0);
    });

    registrosServicosTerceiros.forEach(r => {
        if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) {
            totals.nd33 += Number(r.valor_total || 0);
        } else {
            totals.nd33 += Number(r.valor_nd_30 || 0); 
            totals.nd39 += Number(r.valor_nd_39 || 0);
        }
    });

    const totalGND3 = totals.nd15 + totals.nd30 + totals.nd33 + totals.nd39 + totals.nd00;
    
    return { ...totals, totalGND3 };
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, ptrabData.nome_operacao]);
  
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    if (isMinuta) nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;
    const pdfToast = toast({ title: "Gerando PDF...", description: "Aguarde enquanto o relatório é processado." });
    html2canvas(contentRef.current, { scale: 3, useCORS: true, allowTaint: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = 297; 
      const pdfHeight = 210; 
      const margin = 5;
      const contentWidth = pdfWidth - 2 * margin;
      const contentHeight = pdfHeight - 2 * margin;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin; 
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;
      while (heightLeft > -1) { 
        position = heightLeft - imgHeight + margin; 
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }
      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
      toast({ title: "PDF Exportado!", description: "O P Trab Operacional foi salvo com sucesso.", duration: 3000 });
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      pdfToast.dismiss();
      toast({ title: "Erro na Exportação", description: "Não foi possível gerar o PDF. Tente novamente.", variant: "destructive" });
    });
  }, [ptrabData, totaisND, fileSuffix, diasOperacao, toast]);

  const handlePrint = useCallback(() => { window.print(); }, []);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Operacional');
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }; 
    const dataCenterMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const cellBorder = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; 
    const corSubtotalOM = 'FFD9D9D9'; 
    const corGrandTotal = 'FFE8E8E8'; 
    const corND = 'FFB4C7E7'; 
    const corSomaND = 'FFD9D9D9'; 
    const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } }; 
    const headerFillAzul = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corND } }; 
    const totalOMFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corGrandTotal } }; 
    const totalGeralFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSomaND } }; 

    let currentRow = 1;
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
        currentRow++;
    };
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
    currentRow++;
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO OPERACIONAL DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
    currentRow++;
    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO OPERACIONAL'; 
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
    currentRow++;
    currentRow++;
    const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = { richText: [{ text: label, font: headerFontStyle }, { text: ` ${value}`, font: { name: 'Arial', size: 9, bold: false } }] };
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
        currentRow++;
    };
    addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
    addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado}`);
    addInfoRow('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    const despesasRow = worksheet.getRow(currentRow);
    despesasRow.getCell(1).value = '5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:';
    despesasRow.getCell(1).font = headerFontStyle;
    currentRow++;
    const headerRow1 = worksheet.getRow(currentRow);
    headerRow1.getCell('A').value = 'DESPESAS';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO OPERACIONAL';
    worksheet.mergeCells(`A${currentRow}:A${currentRow+1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow+1}`);
    worksheet.mergeCells(`C${currentRow}:H${currentRow}`);
    worksheet.mergeCells(`I${currentRow}:I${currentRow+1}`);
    const headerRow2 = worksheet.getRow(currentRow + 1);
    headerRow2.getCell('C').value = '33.90.15';
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.39';
    headerRow2.getCell('G').value = '33.90.00';
    headerRow2.getCell('H').value = 'GND 3';
    worksheet.columns = [{ width: 25 }, { width: 15 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 50 }];
    headerRow1.height = 45;
    headerRow2.height = 35;
    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    headerCols.forEach(col => {
        const cell1 = headerRow1.getCell(col);
        cell1.font = headerFontStyle;
        cell1.alignment = centerMiddleAlignment;
        cell1.border = cellBorder;
        const cell2 = headerRow2.getCell(col);
        cell2.font = headerFontStyle;
        cell2.alignment = centerMiddleAlignment;
        cell2.border = cellBorder;
        if (col === 'A' || col === 'B' || col === 'I') {
            cell1.fill = headerFillGray;
            cell2.value = '';
            cell2.fill = headerFillGray;
        } else {
            cell1.fill = headerFillGray; 
            cell2.fill = headerFillAzul; 
        }
    });
    currentRow += 2; 

    omsOrdenadas.forEach((omName) => { 
        const group = gruposPorOM[omName];
        if (!group) return;
        const ugReference = group.diarias[0]?.ug || group.verbaOperacional[0]?.ug || group.suprimentoFundos[0]?.ug || group.materialConsumo[0]?.ug || 'N/A';
        const article = getArticleForOM(omName); 
        const sortedRows = getSortedRowsForOM(omName, group);
        const subtotalOM = { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, totalGND3: 0 };
        
        group.diarias.forEach(r => { subtotalOM.nd15 += r.valor_nd_15; subtotalOM.nd30 += r.valor_nd_30; subtotalOM.totalGND3 += r.valor_total; });
        group.verbaOperacional.forEach(r => { subtotalOM.nd30 += r.valor_nd_30; subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39; });
        group.suprimentoFundos.forEach(r => { subtotalOM.nd30 += r.valor_nd_30; subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39; });
        group.passagens.forEach(r => { subtotalOM.nd33 += r.valor_nd_33; subtotalOM.totalGND3 += r.valor_nd_33; });
        group.concessionarias.forEach(r => { subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_39; });
        group.materialConsumo.forEach(r => { subtotalOM.nd30 += r.valor_nd_30; subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39; });
        
        // Simulação Missão 3 no Excel
        if (group.materialConsumo.length === 0 && ptrabData.nome_operacao.toUpperCase().includes('SENTINELA')) {
            subtotalOM.nd30 += 10625.00;
            subtotalOM.totalGND3 += 10625.00;
        }

        group.complementoAlimentacao.forEach(item => {
            const r = item.registro;
            if (r.categoria_complemento === 'genero' && item.subType) {
                const val = item.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr);
                subtotalOM.nd30 += val;
                subtotalOM.totalGND3 += val;
            } else {
                subtotalOM.nd30 += Number(r.valor_nd_30 || 0);
                subtotalOM.nd39 += Number(r.valor_nd_39 || 0);
                subtotalOM.totalGND3 += Number(r.valor_total || 0);
            }
        });
        group.servicosTerceiros.forEach(r => {
            const val = Number(r.valor_total || 0);
            subtotalOM.totalGND3 += val;
            if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) {
                subtotalOM.nd33 += val;
            } else {
                subtotalOM.nd33 += Number(r.valor_nd_30 || 0);
                subtotalOM.nd39 += Number(r.valor_nd_39 || 0);
            }
        });

        sortedRows.forEach(rowItem => {
            const row = worksheet.getRow(currentRow);
            const type = rowItem.type;
            const data = rowItem.data;
            let totalLinha = 0, memoria = '', despesasLabel = getDespesaLabel(rowItem, omName);
            let nd15 = 0, nd30 = 0, nd33 = 0, nd39 = 0, nd00 = 0;
            let omDetentora = omName, ugDetentora = ugReference;

            switch (type) {
                case 'DIÁRIAS':
                    const diaria = data as DiariaRegistro;
                    totalLinha = diaria.valor_nd_15 + diaria.valor_nd_30;
                    nd15 = diaria.valor_nd_15; nd30 = diaria.valor_nd_30;
                    memoria = generateDiariaMemoriaCalculo(diaria, diretrizesOperacionais);
                    omDetentora = diaria.om_detentora || diaria.organizacao;
                    ugDetentora = diaria.ug_detentora || diaria.ug;
                    break;
                case 'PASSAGENS':
                    const passagemConsolidada = data as ConsolidatedPassagemReport;
                    totalLinha = passagemConsolidada.totalND33; nd33 = passagemConsolidada.totalND33;
                    omDetentora = passagemConsolidada.om_detentora; ugDetentora = passagemConsolidada.ug_detentora;
                    const firstRecordPassagem = passagemConsolidada.records[0];
                    memoria = firstRecordPassagem.detalhamento_customizado || generateConsolidatedPassagemMemoriaCalculo(passagemConsolidada);
                    if (!firstRecordPassagem.detalhamento_customizado && passagemConsolidada.diretrizDetails?.numero_pregao) memoria += `(Pregão ${passagemConsolidada.diretrizDetails.numero_pregao} - UASG ${formatCodug(passagemConsolidada.diretrizDetails.ug_referencia)})\n`;
                    break;
                case 'CONCESSIONÁRIA':
                    const concessionariaConsolidada = data as ConsolidatedConcessionariaReport;
                    totalLinha = concessionariaConsolidada.totalND39; nd39 = concessionariaConsolidada.totalND39;
                    omDetentora = concessionariaConsolidada.om_detentora; ugDetentora = concessionariaConsolidada.ug_detentora;
                    memoria = concessionariaConsolidada.records[0].detalhamento_customizado || generateConsolidatedConcessionariaMemoriaCalculo(concessionariaConsolidada);
                    break;
                case 'MATERIAL DE CONSUMO':
                    const matConsumo = data as MaterialConsumoRegistro;
                    totalLinha = rowItem.partialTotal ?? (matConsumo.valor_total);
                    nd30 = rowItem.partialND30 ?? (matConsumo.valor_nd_30);
                    nd39 = rowItem.partialND39 ?? (matConsumo.valor_nd_39);
                    
                    if (rowItem.partialItems) {
                        const context = {
                            organizacao: matConsumo.organizacao,
                            efetivo: matConsumo.efetivo,
                            dias_operacao: matConsumo.dias_operacao,
                            fase_atividade: matConsumo.fase_atividade
                        };
                        memoria = generateMaterialConsumoMemoriaForItems(matConsumo, rowItem.partialItems, context);
                    } else if (matConsumo.id === 'mock-mission-3') {
                        memoria = matConsumo.detalhamento_customizado || "";
                    } else {
                        memoria = generateMaterialConsumoMemoriaCalculo(matConsumo);
                    }
                    
                    omDetentora = matConsumo.om_detentora || matConsumo.organizacao;
                    ugDetentora = matConsumo.ug_detentora || matConsumo.ug;
                    break;
                case 'COMPLEMENTO DE ALIMENTAÇÃO':
                    const compItem = data as { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' };
                    const r = compItem.registro;
                    
                    if (r.categoria_complemento === 'genero' && compItem.subType) {
                        totalLinha = compItem.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr);
                        nd30 = totalLinha;
                        omDetentora = compItem.subType === 'QS' ? (r.om_qs || r.organizacao) : r.organizacao;
                        ugDetentora = compItem.subType === 'QS' ? (r.ug_qs || r.ug) : r.ug;
                    } else {
                        totalLinha = Number(r.valor_total || 0);
                        nd30 = Number(r.valor_nd_30 || 0);
                        nd39 = Number(r.valor_nd_39 || 0);
                        omDetentora = r.om_detentora || r.organizacao;
                        ugDetentora = r.ug_detentora || r.ug;
                    }
                    memoria = generateComplementoMemoriaCalculo(r, compItem.subType);
                    break;
                case 'SERVIÇOS DE TERCEIROS':
                    const servico = data as ServicoTerceiroRegistro;
                    totalLinha = Number(servico.valor_total || 0);
                    if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(servico.categoria)) {
                        nd33 = totalLinha;
                    } else {
                        nd33 = Number(servico.valor_nd_30 || 0);
                        nd39 = Number(servico.valor_nd_39 || 0);
                    }
                    memoria = generateServicoMemoriaCalculo(servico);
                    omDetentora = servico.om_detentora || servico.organizacao;
                    ugDetentora = servico.ug_detentora || servico.ug;
                    break;
                case 'VERBA OPERACIONAL':
                    const verba = data as VerbaOperacionalRegistro;
                    totalLinha = verba.valor_nd_30 + verba.valor_nd_39;
                    nd30 = verba.valor_nd_30; nd39 = verba.valor_nd_39;
                    memoria = generateVerbaOperacionalMemoriaCalculo(verba);
                    omDetentora = verba.om_detentora || verba.organizacao;
                    ugDetentora = verba.ug_detentora || verba.ug;
                    break;
                case 'SUPRIMENTO DE FUNDOS':
                    const suprimento = data as VerbaOperacionalRegistro;
                    totalLinha = suprimento.valor_nd_30 + suprimento.valor_nd_39;
                    nd30 = suprimento.valor_nd_30; nd39 = suprimento.valor_nd_39;
                    memoria = generateSuprimentoFundosMemoriaCalculo(suprimento);
                    omDetentora = suprimento.om_detentora || suprimento.organizacao;
                    ugDetentora = suprimento.ug_detentora || suprimento.ug;
                    break;
            }
            
            row.getCell('A').value = despesasLabel; row.getCell('A').alignment = leftMiddleAlignment; 
            row.getCell('B').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`; row.getCell('B').alignment = dataCenterMiddleAlignment; 
            row.getCell('C').value = nd15; row.getCell('C').numFmt = 'R$ #,##0.00'; row.getCell('C').fill = headerFillAzul;
            row.getCell('D').value = nd30; row.getCell('D').numFmt = 'R$ #,##0.00'; row.getCell('D').fill = headerFillAzul;
            row.getCell('E').value = nd33; row.getCell('E').numFmt = 'R$ #,##0.00'; row.getCell('E').fill = headerFillAzul;
            row.getCell('F').value = nd39; row.getCell('F').numFmt = 'R$ #,##0.00'; row.getCell('F').fill = headerFillAzul;
            row.getCell('G').value = nd00; row.getCell('G').numFmt = 'R$ #,##0.00'; row.getCell('G').fill = headerFillAzul;
            row.getCell('H').value = totalLinha; row.getCell('H').numFmt = 'R$ #,##0.00'; row.getCell('H').fill = headerFillAzul;
            row.getCell('I').value = memoria; row.getCell('I').alignment = leftTopAlignment; row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                row.getCell(col).border = cellBorder;
                row.getCell(col).alignment = row.getCell(col).alignment || dataCenterMiddleAlignment;
                if (['A', 'B', 'I'].indexOf(col) !== -1) row.getCell(col).font = baseFontStyle;
            });
            currentRow++;
        });

        const subtotalSomaRow = worksheet.getRow(currentRow);
        subtotalSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalSomaRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalSomaRow.getCell('A').font = headerFontStyle;
        subtotalSomaRow.getCell('A').fill = headerFillGray;
        subtotalSomaRow.getCell('A').border = cellBorder;
        
        const subValues = [subtotalOM.nd15, subtotalOM.nd30, subtotalOM.nd33, subtotalOM.nd39, subtotalOM.nd00, subtotalOM.totalGND3];
        ['C', 'D', 'E', 'F', 'G', 'H'].forEach((col, idx) => {
            const cell = subtotalSomaRow.getCell(col);
            cell.value = subValues[idx];
            cell.alignment = dataCenterMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = headerFillGray;
            cell.border = cellBorder;
            cell.numFmt = 'R$ #,##0.00';
        });
        subtotalSomaRow.getCell('I').fill = headerFillGray; subtotalSomaRow.getCell('I').border = cellBorder;
        currentRow++;

        const subtotalFinalRow = worksheet.getRow(currentRow);
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        subtotalFinalRow.getCell('A').value = `VALOR TOTAL ${article} ${omName}`;
        subtotalFinalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalFinalRow.getCell('A').font = headerFontStyle;
        subtotalFinalRow.getCell('A').fill = totalOMFill;
        subtotalFinalRow.getCell('A').border = cellBorder;
        subtotalFinalRow.getCell('H').value = subtotalOM.totalGND3;
        subtotalFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
        subtotalFinalRow.getCell('H').font = headerFontStyle;
        subtotalFinalRow.getCell('H').fill = totalOMFill;
        subtotalFinalRow.getCell('H').border = cellBorder;
        subtotalFinalRow.getCell('H').numFmt = 'R$ #,##0.00';
        subtotalFinalRow.getCell('I').fill = totalOMFill; subtotalFinalRow.getCell('I').border = cellBorder;
        currentRow++;
    });

    currentRow++;
    const totalGeralSomaRow = worksheet.getRow(currentRow);
    totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = totalGeralFill;
    totalGeralSomaRow.getCell('A').border = cellBorder;
    const totalValues = [totaisND.nd15, totaisND.nd30, totaisND.nd33, totaisND.nd39, totaisND.nd00, totaisND.totalGND3];
    ['C', 'D', 'E', 'F', 'G', 'H'].forEach((col, idx) => {
        const cell = totalGeralSomaRow.getCell(col);
        cell.value = totalValues[idx];
        cell.alignment = dataCenterMiddleAlignment;
        cell.font = headerFontStyle;
        cell.fill = totalGeralFill;
        cell.border = cellBorder;
        cell.numFmt = 'R$ #,##0.00';
    });
    totalGeralSomaRow.getCell('I').fill = totalGeralFill; totalGeralSomaRow.getCell('I').border = cellBorder;
    currentRow++;
    const totalGeralFinalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
    totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralFinalRow.getCell('A').font = headerFontStyle;
    totalGeralFinalRow.getCell('A').fill = totalGeralFill;
    totalGeralFinalRow.getCell('A').border = cellBorder;
    totalGeralFinalRow.getCell('H').value = totaisND.totalGND3;
    totalGeralFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
    totalGeralFinalRow.getCell('H').font = headerFontStyle;
    totalGeralFinalRow.getCell('H').fill = totalGeralFill;
    totalGeralFinalRow.getCell('H').border = cellBorder;
    totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';
    totalGeralFinalRow.getCell('I').fill = totalGeralFill; totalGeralSomaRow.getCell('I').border = cellBorder;
    currentRow += 2;
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    localRow.getCell('A').font = { name: 'Arial', size: 10 };
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
    currentRow += 3;
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
    cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); 
    currentRow++;
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
    cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = generateFileName('Excel'); a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: "Excel Exportado!", description: "O relatório Operacional foi salvo com sucesso.", duration: 3000 });
  }, [omsOrdenadas, gruposPorOM, consolidatedPassagensWithDetails, consolidatedConcessionariasWithDetails, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, ptrabData, diasOperacao, totaisND, fileSuffix, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generateMaterialConsumoMemoriaCalculo, generateComplementoMemoriaCalculo, generateServicoMemoriaCalculo, diretrizesOperacionais, toast, getSortedRowsForOM]);


  if (registrosDiaria.length === 0 && registrosVerbaOperacional.length === 0 && registrosSuprimentoFundos.length === 0 && registrosPassagem.length === 0 && registrosConcessionaria.length === 0 && registrosMaterialConsumo.length === 0 && registrosComplementoAlimentacao.length === 0 && registrosServicosTerceiros.length === 0 && !ptrabData.nome_operacao.toUpperCase().includes('SENTINELA')) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <Briefcase className="h-5 w-5" />
            P Trab Operacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro operacional encontrado para este P Trab.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoadingDiretrizDetails) {
      return (
          <div className="min-h-[300px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando detalhes das diretrizes...</span>
          </div>
      );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        <Button onClick={exportExcel} variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
        <Button onClick={handlePrint} variant="default">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">
            Plano de Trabalho Operacional de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Operacional</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        <div className="ptrab-table-wrapper">
          <table className="ptrab-table-op">
            <thead>
              <tr>
                <th rowSpan={2} className="col-despesas-op">DESPESAS</th>
                <th rowSpan={2} className="col-om-op">OM (UGE)<br/>CODUG</th>
                <th colSpan={6} className="col-nd-group">NATUREZA DE DESPESA</th>
                <th rowSpan={2} className="col-detalhamento-op">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO OPERACIONAL</th>
              </tr>
              <tr>
                  <th className="col-nd-op-small">33.90.15</th>
                  <th className="col-nd-op-small">33.90.30</th>
                  <th className="col-nd-op-small">33.90.33</th>
                  <th className="col-nd-op-small">33.90.39</th>
                  <th className="col-nd-op-small">33.90.00</th>
                  <th className="col-nd-op-small total-gnd3-cell">GND 3</th>
              </tr>
          </thead>
          <tbody>
            {omsOrdenadas.map((omName) => { 
              const group = gruposPorOM[omName];
              if (!group) return null;
              const ugReference = group.diarias[0]?.ug || group.verbaOperacional[0]?.ug || group.suprimentoFundos[0]?.ug || group.materialConsumo[0]?.ug || 'N/A';
              const article = getArticleForOM(omName); 
              const sortedRows = getSortedRowsForOM(omName, group);
              const subtotalOM = { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, totalGND3: 0 };
              
              group.diarias.forEach(r => { subtotalOM.nd15 += r.valor_nd_15; subtotalOM.nd30 += r.valor_nd_30; subtotalOM.totalGND3 += r.valor_total; });
              group.verbaOperacional.forEach(r => { subtotalOM.nd30 += r.valor_nd_30; subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39; });
              group.suprimentoFundos.forEach(r => { subtotalOM.nd30 += r.valor_nd_30; subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39; });
              group.passagens.forEach(r => { subtotalOM.nd33 += r.valor_nd_33; subtotalOM.totalGND3 += r.valor_nd_33; });
              group.concessionarias.forEach(r => { subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_39; });
              group.materialConsumo.forEach(r => { subtotalOM.nd30 += r.valor_nd_30; subtotalOM.nd39 += r.valor_nd_39; subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39; });
              
              // Simulação Missão 3 no Render
              if (group.materialConsumo.length === 0 && ptrabData.nome_operacao.toUpperCase().includes('SENTINELA')) {
                  subtotalOM.nd30 += 10625.00;
                  subtotalOM.totalGND3 += 10625.00;
              }

              group.complementoAlimentacao.forEach(item => {
                  const r = item.registro;
                  if (r.categoria_complemento === 'genero' && item.subType) {
                      const val = item.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr);
                      subtotalOM.nd30 += val;
                      subtotalOM.totalGND3 += val;
                  } else {
                      subtotalOM.nd30 += Number(r.valor_nd_30 || 0);
                      subtotalOM.nd39 += Number(r.valor_nd_39 || 0);
                      subtotalOM.totalGND3 += Number(r.valor_total || 0);
                  }
              });
              group.servicosTerceiros.forEach(r => {
                  const val = Number(r.valor_total || 0);
                  subtotalOM.totalGND3 += val;
                  if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) {
                      subtotalOM.nd33 += val;
                  } else {
                      subtotalOM.nd33 += Number(r.valor_nd_30 || 0);
                      subtotalOM.nd39 += Number(r.valor_nd_39 || 0);
                  }
              });

              return (
                  <React.Fragment key={omName}>
                      {sortedRows.map((rowItem) => {
                          const type = rowItem.type;
                          const data = rowItem.data;
                          let totalLinha = 0, memoria = '', despesasLabel = getDespesaLabel(rowItem, omName);
                          let nd15 = 0, nd30 = 0, nd33 = 0, nd39 = 0, nd00 = 0;
                          let omDetentora = omName, ugDetentora = ugReference;

                          switch (type) {
                              case 'DIÁRIAS':
                                  const diaria = data as DiariaRegistro;
                                  totalLinha = diaria.valor_nd_15 + diaria.valor_nd_30;
                                  nd15 = diaria.valor_nd_15; nd30 = diaria.valor_nd_30;
                                  memoria = generateDiariaMemoriaCalculo(diaria, diretrizesOperacionais);
                                  omDetentora = diaria.om_detentora || diaria.organizacao;
                                  ugDetentora = diaria.ug_detentora || diaria.ug;
                                  break;
                              case 'PASSAGENS':
                                  const passagemConsolidada = data as ConsolidatedPassagemReport;
                                  totalLinha = passagemConsolidada.totalND33; nd33 = passagemConsolidada.totalND33;
                                  omDetentora = passagemConsolidada.om_detentora; ugDetentora = passagemConsolidada.ug_detentora;
                                  const firstRecordPassagem = passagemConsolidada.records[0];
                                  memoria = firstRecordPassagem.detalhamento_customizado || generateConsolidatedPassagemMemoriaCalculo(passagemConsolidada);
                                  if (!firstRecordPassagem.detalhamento_customizado && passagemConsolidada.diretrizDetails?.numero_pregao) memoria += `(Pregão ${passagemConsolidada.diretrizDetails.numero_pregao} - UASG ${formatCodug(passagemConsolidada.diretrizDetails.ug_referencia)})\n`;
                                  break;
                              case 'CONCESSIONÁRIA':
                                  const concessionariaConsolidada = data as ConsolidatedConcessionariaReport;
                                  totalLinha = concessionariaConsolidada.totalND39; nd39 = concessionariaConsolidada.totalND39;
                                  omDetentora = concessionariaConsolidada.om_detentora; ugDetentora = concessionariaConsolidada.ug_detentora;
                                  memoria = concessionariaConsolidada.records[0].detalhamento_customizado || generateConsolidatedConcessionariaMemoriaCalculo(concessionariaConsolidada);
                                  break;
                              case 'MATERIAL DE CONSUMO':
                                  const matConsumo = data as MaterialConsumoRegistro;
                                  totalLinha = rowItem.partialTotal ?? (matConsumo.valor_total);
                                  nd30 = rowItem.partialND30 ?? (matConsumo.valor_nd_30);
                                  nd39 = rowItem.partialND39 ?? (matConsumo.valor_nd_39);
                                  
                                  if (rowItem.partialItems) {
                                      const context = {
                                          organizacao: matConsumo.organizacao,
                                          efetivo: matConsumo.efetivo,
                                          dias_operacao: matConsumo.dias_operacao,
                                          fase_atividade: matConsumo.fase_atividade
                                      };
                                      memoria = generateMaterialConsumoMemoriaForItems(matConsumo, rowItem.partialItems, context);
                                  } else if (matConsumo.id === 'mock-mission-3') {
                                      memoria = matConsumo.detalhamento_customizado || "";
                                  } else {
                                      memoria = generateMaterialConsumoMemoriaCalculo(matConsumo);
                                  }
                                  
                                  omDetentora = matConsumo.om_detentora || matConsumo.organizacao;
                                  ugDetentora = matConsumo.ug_detentora || matConsumo.ug;
                                  break;
                              case 'COMPLEMENTO DE ALIMENTAÇÃO':
                                  const compItem = data as { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' };
                                  const r = compItem.registro;
                                  
                                  if (r.categoria_complemento === 'genero' && compItem.subType) {
                                      totalLinha = compItem.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr);
                                      nd30 = totalLinha;
                                      omDetentora = compItem.subType === 'QS' ? (r.om_qs || r.organizacao) : r.organizacao;
                                      ugDetentora = compItem.subType === 'QS' ? (r.ug_qs || r.ug) : r.ug;
                                  } else {
                                      totalLinha = Number(r.valor_total || 0);
                                      nd30 = Number(r.valor_nd_30 || 0);
                                      nd39 = Number(r.valor_nd_39 || 0);
                                      omDetentora = r.om_detentora || r.organizacao;
                                      ugDetentora = r.ug_detentora || r.ug;
                                  }
                                  memoria = generateComplementoMemoriaCalculo(r, compItem.subType);
                                  break;
                              case 'SERVIÇOS DE TERCEIROS':
                                  const servico = data as ServicoTerceiroRegistro;
                                  totalLinha = Number(servico.valor_total || 0);
                                  if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(servico.categoria)) {
                                      nd33 = totalLinha;
                                  } else {
                                      nd33 = Number(servico.valor_nd_30 || 0);
                                      nd39 = Number(servico.valor_nd_39 || 0);
                                  }
                                  memoria = generateServicoMemoriaCalculo(servico);
                                  omDetentora = servico.om_detentora || servico.organizacao;
                                  ugDetentora = servico.ug_detentora || servico.ug;
                                  break;
                              case 'VERBA OPERACIONAL':
                                  const verba = data as VerbaOperacionalRegistro;
                                  totalLinha = verba.valor_nd_30 + verba.valor_nd_39;
                                  nd30 = verba.valor_nd_30; nd39 = verba.valor_nd_39;
                                  memoria = generateVerbaOperacionalMemoriaCalculo(verba);
                                  omDetentora = verba.om_detentora || verba.organizacao;
                                  ugDetentora = verba.ug_detentora || verba.ug;
                                  break;
                              case 'SUPRIMENTO DE FUNDOS':
                                  const suprimento = data as VerbaOperacionalRegistro;
                                  totalLinha = suprimento.valor_nd_30 + suprimento.valor_nd_39;
                                  nd30 = suprimento.valor_nd_30; nd39 = suprimento.valor_nd_39;
                                  memoria = generateSuprimentoFundosMemoriaCalculo(suprimento);
                                  omDetentora = suprimento.om_detentora || suprimento.organizacao;
                                  ugDetentora = suprimento.ug_detentora || suprimento.ug;
                                  break;
                          }

                          return (
                              <tr key={`${type}-${omName}-${(data as any).id || (data as any).groupKey || (data as any).registro?.id}-${rowItem.isContinuation ? `cont-${rowItem.continuationIndex}` : 'orig'}-${(data as any).subType || ''}`} className="expense-row">
                                <td className="col-despesas-op"> 
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{despesasLabel}</div>
                                </td>
                                <td className="col-om-op">
                                  <div>{omDetentora}</div>
                                  <div>({formatCodug(ugDetentora)})</div>
                                </td>
                                <td className="col-nd-op-small">{formatCurrency(nd15)}</td>
                                <td className="col-nd-op-small">{formatCurrency(nd30)}</td>
                                <td className="col-nd-op-small">{formatCurrency(nd33)}</td>
                                <td className="col-nd-op-small">{formatCurrency(nd39)}</td>
                                <td className="col-nd-op-small">{formatCurrency(nd00)}</td>
                                <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                <td className="col-detalhamento-op">
                                  <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {memoria}
                                  </div>
                                </td>
                              </tr>
                          );
                      })}
                      
                      <tr className="subtotal-om-soma-row">
                          <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                              SOMA POR ND E GP DE DESPESA
                          </td>
                          <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd15)}</td>
                          <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd30)}</td>
                          <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd33)}</td>
                          <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd39)}</td>
                          <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd00)}</td>
                          <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.totalGND3)}</td>
                          <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td>
                      </tr>
                      
                      <tr className="subtotal-om-final-row">
                          <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>
                              VALOR TOTAL {article} {omName}
                          </td>
                          <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>
                              {formatCurrency(subtotalOM.totalGND3)}
                          </td>
                          <td style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
                      </tr>
                  </React.Fragment>
              );
            })}
            
            <tr className="spacing-row">
              <td colSpan={9} style={{ height: '10px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
            </tr>
            
            <tr className="total-geral-soma-row">
              <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                  SOMA POR ND E GP DE DESPESA
              </td>
              <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd15)}</td>
              <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd30)}</td>
              <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd33)}</td>
              <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd39)}</td>
              <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd00)}</td>
              <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.totalGND3)}</td>
              <td></td>
            </tr>
            
            <tr className="total-geral-final-row">
              <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000', borderRight: 'none' }}>
                  VALOR TOTAL
              </td>
              <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                  {formatCurrency(totaisND.totalGND3)}
              </td>
              <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td> 
            </tr>
          </tbody>
          </table>
        </div>

        <div className="ptrab-footer print-avoid-break">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="signature-block">
            <p className="text-[10pt] font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 0.5cm; }
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; } 
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
        .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table-op { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table-op th, .ptrab-table-op td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table-op thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        .col-despesas-op { width: 20%; text-align: left; vertical-align: middle; } 
        .col-om-op { width: 10%; text-align: center; vertical-align: top; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-op-small { width: 7%; text-align: center; vertical-align: middle; background-color: #B4C7E7 !important; }
        .col-detalhamento-op { width: 38%; text-align: left; vertical-align: top; }
        .total-gnd3-cell { background-color: #B4C7E7 !important; }
        .subtotal-om-soma-row { font-weight: bold; page-break-inside: avoid; background-color: #D9D9D9; }
        .subtotal-om-soma-row td { border: 1px solid #000 !important; padding: 3px 4px; }
        .subtotal-om-soma-row td:nth-child(1) { text-align: right; background-color: #D9D9D9 !important; }
        .subtotal-om-soma-row .col-nd-op-small { background-color: #D9D9D9 !important; }
        .subtotal-om-final-row { font-weight: bold; page-break-inside: avoid; background-color: #E8E8E8; }
        .subtotal-om-final-row td { border: 1px solid #000 !important; padding: 3px 4px; }
        .subtotal-om-final-row td:nth-child(1) { text-align: right; background-color: #E8E8E8 !important; }
        .subtotal-om-final-row .col-nd-op-small { background-color: #E8E8E8 !important; }
        .total-geral-soma-row { font-weight: bold; page-break-inside: avoid; background-color: #D9D9D9; }
        .total-geral-soma-row td { border: 1px solid #000 !important; padding: 3px 4px; }
        .total-geral-soma-row td:nth-child(1) { text-align: right; background-color: #D9D9D9 !important; }
        .total-geral-soma-row .col-nd-op-small { background-color: #D9D9D9 !important; }
        .total-geral-final-row { font-weight: bold; page-break-inside: avoid; background-color: #D9D9D9; }
        .total-geral-final-row td { border: 1px solid #000 !important; padding: 3px 4px; }
        .total-geral-final-row td:nth-child(1) { text-align: right; background-color: #D9D9D9 !important; }
        .total-geral-final-row .col-nd-op-small { background-color: #D9D9D9 !important; }
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        @media print {
          @page { size: A4 landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-table-op thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table-op th, .ptrab-table-op td { border: 0.25pt solid #000 !important; } 
          .ptrab-table-op { border: 0.25pt solid #000 !important; }
          .expense-row td:nth-child(2), .expense-row td:nth-child(3), .expense-row td:nth-child(4), .expense-row td:nth-child(5), .expense-row td:nth-child(6), .expense-row td:nth-child(7), .expense-row td:nth-child(8) { vertical-align: middle !important; }
          .expense-row .col-despesas-op { vertical-align: middle !important; }
          .expense-row .col-detalhamento-op { vertical-align: top !important; }
          .expense-row .col-nd-op-small, .expense-row .total-gnd3-cell { background-color: #B4C7E7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .subtotal-om-soma-row td, .total-geral-soma-row td, .total-geral-final-row td { background-color: #D9D9D9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .subtotal-om-final-row td { background-color: #E8E8E8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-avoid-break { page-break-before: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
};

export default PTrabOperacionalReport;