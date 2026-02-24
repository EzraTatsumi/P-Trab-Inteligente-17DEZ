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
        if (error) return null;
        return data;
    } catch (e) { return null; }
};

const fetchConcessionariaDiretrizDetails = async (diretrizId: string): Promise<{ nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null> => {
    try {
        const { data, error } = await supabase
            .from('diretrizes_concessionaria')
            .select('nome_concessionaria, unidade_custo, fonte_consumo, fonte_custo')
            .eq('id', diretrizId)
            .single();
        if (error) return null;
        return data;
    } catch (e) { return null; }
};

const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalizedOmName = omName.toUpperCase().trim();
    if (normalizedOmName.includes('CMDO')) return 'DO';
    if (normalizedOmName.includes('ª')) return 'DA';
    if (normalizedOmName.includes('º')) return 'DO';
    const lowerOmName = omName.toLowerCase().trim();
    if (lowerOmName.startsWith('comando') || lowerOmName.startsWith('departamento') || lowerOmName.startsWith('regimento') || lowerOmName.startsWith('batalhão') || lowerOmName.startsWith('grupamento') || lowerOmName.startsWith('colégio') || lowerOmName.startsWith('hospital') || lowerOmName.startsWith('o ')) return 'DO';
    return 'DA';
};

interface ConsolidatedPassagemReport extends ConsolidatedPassagemRecord { groupKey: string; diretrizDetails?: { numero_pregao: string | null, ug_referencia: string | null } | null; }
interface ConsolidatedConcessionariaReport extends ConsolidatedConcessionariaRecord { groupKey: string; diretrizDetails?: { nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null; }

const EXPENSE_ORDER_MAP: Record<string, number> = { 'CONCESSIONÁRIA': 1, 'DIÁRIAS': 2, 'COMPLEMENTO DE ALIMENTAÇÃO': 3, 'MATERIAL DE CONSUMO': 4, 'PASSAGENS': 5, 'SERVIÇOS DE TERCEIROS': 6, 'SUPRIMENTO DE FUNDOS': 7, 'VERBA OPERACIONAL': 8, };

type ExpenseRow = { type: keyof typeof EXPENSE_ORDER_MAP; data: DiariaRegistro | ConsolidatedPassagemReport | ConsolidatedConcessionariaReport | VerbaOperacionalRegistro | MaterialConsumoRegistro | ServicoTerceiroRegistro | { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' }; isContinuation?: boolean; continuationIndex?: number; partialItems?: ItemAquisicao[]; partialTotal?: number; partialND30?: number; partialND39?: number; };

const formatCategoryName = (cat: string, details?: any) => { if (cat === 'outros' && details?.nome_servico_outros) return details.nome_servico_outros; if (cat === 'fretamento-aereo') return 'Fretamento Aéreo'; if (cat === 'servico-satelital') return 'Serviço Satelital'; if (cat === 'transporte-coletivo') return 'Transporte Coletivo'; if (cat === 'locacao-veiculos') return 'Locação de Veículos'; if (cat === 'locacao-estruturas') return 'Locação de Estruturas'; if (cat === 'servico-grafico') return 'Serviço Gráfico'; return cat.split('-').map(word => word === 'aereo' ? 'Aéreo' : word.charAt(0).toUpperCase() + word.slice(1)).join(' '); };

const toTitleCase = (str: string) => { if (!str) return ''; return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); };

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
  ptrabData, omsOrdenadas, gruposPorOM, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, diretrizesOperacionais, diretrizesPassagens, fileSuffix, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generatePassagemMemoriaCalculo, generateConcessionariaMemoriaCalculo, generateMaterialConsumoMemoriaCalculo, generateComplementoMemoriaCalculo, generateServicoMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);
  const [diretrizDetailsMap, setDiretrizDetailsMap] = useState<Record<string, { numero_pregao: string | null, ug_referencia: string | null } | null>>({});
  const [concessionariaDetailsMap, setConcessionariaDetailsMap] = useState<Record<string, { nome_concessionaria: string, unidade_custo: string, fonte_consumo: string | null, fonte_custo: string | null } | null>>({});
  const [isLoadingDiretrizDetails, setIsLoadingDiretrizDetails] = useState(true);

  const { consolidatedPassagens, consolidatedConcessionarias } = useMemo(() => {
    const cpMap: Record<string, ConsolidatedPassagemReport> = {};
    const ccMap: Record<string, ConsolidatedConcessionariaReport> = {};
    registrosPassagem.forEach(r => { const key = [r.organizacao, r.ug, r.om_detentora || r.organizacao, r.ug_detentora || r.ug, r.dias_operacao, r.efetivo, r.fase_atividade, r.diretriz_id].join('|'); if (!cpMap[key]) cpMap[key] = { groupKey: key, organizacao: r.organizacao, ug: r.ug, om_detentora: r.om_detentora || r.organizacao, ug_detentora: r.ug_detentora || r.ug, dias_operacao: r.dias_operacao, efetivo: r.efetivo || 0, fase_atividade: r.fase_atividade || '', records: [], totalGeral: 0, totalND33: 0 } as any; const c = cpMap[key]; c.records.push(r); c.totalGeral += Number(r.valor_total || 0); c.totalND33 += Number(r.valor_nd_33 || 0); });
    registrosConcessionaria.forEach(r => { const key = [r.organizacao, r.ug, r.om_detentora || r.organizacao, r.ug_detentora || r.ug, r.dias_operacao, r.efetivo, r.fase_atividade, r.diretriz_id].join('|'); if (!ccMap[key]) ccMap[key] = { groupKey: key, organizacao: r.organizacao, ug: r.ug, om_detentora: r.om_detentora || r.organizacao, ug_detentora: r.ug_detentora || r.ug, dias_operacao: r.dias_operacao, efetivo: r.efetivo || 0, fase_atividade: r.fase_atividade || '', records: [], totalGeral: 0, totalND39: 0 } as any; const c = ccMap[key]; c.records.push(r); c.totalGeral += Number(r.valor_total || 0); c.totalND39 += Number(r.valor_nd_39 || 0); });
    return { consolidatedPassagens: Object.values(cpMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao)), consolidatedConcessionarias: Object.values(ccMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao)) };
  }, [registrosPassagem, registrosConcessionaria]);
  
  useEffect(() => {
    const loadDetails = async () => {
        setIsLoadingDiretrizDetails(true);
        const upIds = new Set<string>(); const ucIds = new Set<string>();
        consolidatedPassagens.forEach(g => g.records.forEach(r => { if (r.diretriz_id) upIds.add(r.diretriz_id); }));
        consolidatedConcessionarias.forEach(g => g.records.forEach(r => { if (r.diretriz_id) ucIds.add(r.diretriz_id); }));
        if (upIds.size === 0 && ucIds.size === 0) { setIsLoadingDiretrizDetails(false); return; }
        const npMap: Record<string, any> = {}; const ncMap: Record<string, any> = {};
        await Promise.all([...Array.from(upIds).map(async id => { npMap[id] = await fetchDiretrizDetails(id); }), ...Array.from(ucIds).map(async id => { ncMap[id] = await fetchConcessionariaDiretrizDetails(id); })]);
        setDiretrizDetailsMap(npMap); setConcessionariaDetailsMap(ncMap); setIsLoadingDiretrizDetails(false); 
    };
    loadDetails();
  }, [consolidatedPassagens, consolidatedConcessionarias]);
  
  const consolidatedPassagensWithDetails = useMemo(() => consolidatedPassagens.map(g => ({ ...g, diretrizDetails: g.records[0]?.diretriz_id ? diretrizDetailsMap[g.records[0].diretriz_id] : null })), [consolidatedPassagens, diretrizDetailsMap]);
  const consolidatedConcessionariasWithDetails = useMemo(() => consolidatedConcessionarias.map(g => { const d = g.records[0]?.diretriz_id ? concessionariaDetailsMap[g.records[0].diretriz_id] : null; return { ...g, records: g.records.map(r => ({ ...r, nome_concessionaria: d?.nome_concessionaria || r.organizacao, unidade_custo: d?.unidade_custo || 'unidade', fonte_consumo: d?.fonte_consumo || null, fonte_custo: d?.fonte_custo || null })), diretrizDetails: d }; }), [consolidatedConcessionarias, concessionariaDetailsMap]);

  const getDespesaLabel = (row: ExpenseRow, omName: string): string => {
    const { type, data, isContinuation } = row;
    if (type === 'SERVIÇOS DE TERCEIROS') { const s = data as ServicoTerceiroRegistro; const d = s.detalhes_planejamento; const c = s.categoria; if (c === 'transporte-coletivo') return 'LOCAÇÃO DE VEÍCULOS\n(Transporte Coletivo)'; if (c === 'locacao-veiculos') return `LOCAÇÃO DE VEÍCULOS\n(${toTitleCase(s.group_name || d?.group_name || 'Geral')})`; if (c === 'outros' && d?.nome_servico_outros) return d.nome_servico_outros.toUpperCase(); return formatCategoryName(c, d).toUpperCase(); }
    if (type === 'MATERIAL DE CONSUMO') { const m = data as MaterialConsumoRegistro; let l = type; if (m.group_name) l += `\n(${m.group_name})`; if (isContinuation) l += `\n\nContinuação`; return l; }
    if (type === 'COMPLEMENTO DE ALIMENTAÇÃO') return `${type}\n(${(data as any).registro.group_name})`;
    if (type === 'PASSAGENS') { const p = data as ConsolidatedPassagemReport; let l = type; if (p.organizacao !== omName) l += `\n${p.organizacao}`; return l; }
    if (type === 'CONCESSIONÁRIA') { const c = data as ConsolidatedConcessionariaReport; let l = type; if (c.organizacao !== omName) l += `\n${c.organizacao}`; return l; }
    return type;
  };

  const getSortedRowsForOM = useCallback((omName: string, group: GrupoOMOperacional): ExpenseRow[] => { 
    const allRows: ExpenseRow[] = [];
    group.diarias.forEach(r => allRows.push({ type: 'DIÁRIAS', data: r }));
    consolidatedPassagensWithDetails.filter(c => c.om_detentora === omName).forEach(c => allRows.push({ type: 'PASSAGENS', data: c }));
    consolidatedConcessionariasWithDetails.filter(c => c.om_detentora === omName).forEach(c => allRows.push({ type: 'CONCESSIONÁRIA', data: c }));
    group.materialConsumo.forEach(r => { const chunks = splitMaterialConsumoItems((r.itens_aquisicao as any) || [], 15); chunks.forEach((chunk, i) => { const { totalValue, totalND30, totalND39 } = calculateGroupTotals(chunk); allRows.push({ type: 'MATERIAL DE CONSUMO', data: r, isContinuation: i > 0, continuationIndex: i, partialItems: chunk, partialTotal: totalValue, partialND30: totalND30, partialND39: totalND39 }); }); });
    group.complementoAlimentacao.forEach(i => allRows.push({ type: 'COMPLEMENTO DE ALIMENTAÇÃO', data: i }));
    group.servicosTerceiros.forEach(r => allRows.push({ type: 'SERVIÇOS DE TERCEIROS', data: r }));
    group.verbaOperacional.forEach(r => allRows.push({ type: 'VERBA OPERACIONAL', data: r }));
    group.suprimentoFundos.forEach(r => allRows.push({ type: 'SUPRIMENTO DE FUNDOS', data: r }));
    return allRows.sort((a, b) => (EXPENSE_ORDER_MAP[a.type] || 99) - (EXPENSE_ORDER_MAP[b.type] || 99) || a.type.localeCompare(b.type));
  }, [consolidatedPassagensWithDetails, consolidatedConcessionariasWithDetails]);

  const totaisND = useMemo(() => {
    const t = { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0 };
    registrosDiaria.forEach(r => { t.nd15 += r.valor_nd_15; t.nd30 += r.valor_nd_30; });
    registrosVerbaOperacional.forEach(r => { t.nd30 += r.valor_nd_30; t.nd39 += r.valor_nd_39; });
    registrosSuprimentoFundos.forEach(r => { t.nd30 += r.valor_nd_30; t.nd39 += r.valor_nd_39; });
    registrosPassagem.forEach(r => t.nd33 += r.valor_nd_33);
    registrosConcessionaria.forEach(r => t.nd39 += r.valor_nd_39);
    registrosMaterialConsumo.forEach(r => { t.nd30 += r.valor_nd_30; t.nd39 += r.valor_nd_39; });
    registrosComplementoAlimentacao.forEach(r => { t.nd30 += Number(r.valor_nd_30 || 0); t.nd39 += Number(r.valor_nd_39 || 0); });
    registrosServicosTerceiros.forEach(r => { const v = Number(r.valor_total || 0); if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) t.nd33 += v; else { t.nd33 += Number(r.valor_nd_30 || 0); t.nd39 += Number(r.valor_nd_39 || 0); } });
    return { ...t, totalGND3: t.nd15 + t.nd30 + t.nd33 + t.nd39 + t.nd00 };
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros]);
  
  const generateFileName = (t: 'PDF' | 'Excel') => { const n = ptrabData.numero_ptrab.replace(/\//g, '-'); const y = new Date(ptrabData.periodo_inicio).getFullYear(); return `P Trab Nr ${n}${ptrabData.numero_ptrab.startsWith("Minuta") ? ` - ${y} - ${ptrabData.nome_om}` : ''} - ${ptrabData.nome_operacao} - Atz ${formatDateDDMMMAA(ptrabData.updated_at)} - ${fileSuffix}.${t === 'PDF' ? 'pdf' : 'xlsx'}`; };

  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;
    const tId = toast({ title: "Gerando PDF..." });
    html2canvas(contentRef.current, { scale: 3, useCORS: true }).then(c => {
      const img = c.toDataURL('image/jpeg', 1.0); const pdf = new jsPDF('l', 'mm', 'a4'); const w = 297, h = 210, m = 5, cw = w - 2*m, ch = h - 2*m, ih = (c.height * cw) / c.width;
      let hl = ih, p = m; pdf.addImage(img, 'JPEG', m, p, cw, ih); hl -= ch;
      while (hl > -1) { p = hl - ih + m; pdf.addPage(); pdf.addImage(img, 'JPEG', m, p, cw, ih); hl -= ch; }
      pdf.save(generateFileName('PDF')); toast({ title: "PDF Exportado!" });
    });
  }, [ptrabData, fileSuffix, toast]);

  const exportExcel = useCallback(async () => {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('P Trab Operacional');
    const cma = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rma = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const lta = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const lma = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }; 
    const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9D9D9' } };
    const ndFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFB4C7E7' } };
    let cur = 1; const addH = (t: string, f: any) => { const r = ws.getRow(cur); r.getCell(1).value = t; r.getCell(1).font = f; r.getCell(1).alignment = cma; ws.mergeCells(`A${cur}:I${cur}`); cur++; };
    addH('MINISTÉRIO DA DEFESA', { name: 'Arial', size: 11, bold: true }); addH('EXÉRCITO BRASILEIRO', { name: 'Arial', size: 11, bold: true }); addH(ptrabData.comando_militar_area.toUpperCase(), { name: 'Arial', size: 11, bold: true }); addH((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase(), { name: 'Arial', size: 11, bold: true }); addH(`PLANO DE TRABALHO OPERACIONAL DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`, { name: 'Arial', size: 11, bold: true }); addH('PLANO DE TRABALHO OPERACIONAL', { name: 'Arial', size: 11, bold: true, underline: true }); cur++;
    const addI = (l: string, v: string) => { const r = ws.getRow(cur); r.getCell(1).value = { richText: [{ text: l, font: { name: 'Arial', size: 9, bold: true } }, { text: ` ${v}`, font: { name: 'Arial', size: 9 } }] }; r.getCell(1).alignment = lma; ws.mergeCells(`A${cur}:I${cur}`); cur++; };
    addI('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao); addI('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`); addI('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado}`); addI('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    ws.getRow(cur).getCell(1).value = '5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:'; ws.getRow(cur).getCell(1).font = { name: 'Arial', size: 9, bold: true }; cur++;
    const h1 = ws.getRow(cur); h1.getCell('A').value = 'DESPESAS'; h1.getCell('B').value = 'OM (UGE)\nCODUG'; h1.getCell('C').value = 'NATUREZA DE DESPESA'; h1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO'; ws.mergeCells(`A${cur}:A${cur+1}`); ws.mergeCells(`B${cur}:B${cur+1}`); ws.mergeCells(`C${cur}:H${cur}`); ws.mergeCells(`I${cur}:I${cur+1}`);
    const h2 = ws.getRow(cur+1); h2.getCell('C').value = '33.90.15'; h2.getCell('D').value = '33.90.30'; h2.getCell('E').value = '33.90.33'; h2.getCell('F').value = '33.90.39'; h2.getCell('G').value = '33.90.00'; h2.getCell('H').value = 'GND 3'; ws.columns = [{ width: 25 }, { width: 15 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 50 }]; h1.height = 45; h2.height = 35;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(c => { [h1, h2].forEach(r => { const cell = r.getCell(c); cell.font = { name: 'Arial', size: 9, bold: true }; cell.alignment = cma; cell.border = border; cell.fill = (c === 'A' || c === 'B' || c === 'I') ? headerFill : headerFill; }); h2.getCell(c).fill = (['C','D','E','F','G','H'].includes(c)) ? ndFill : headerFill; }); cur += 2;
    omsOrdenadas.forEach(om => { const g = gruposPorOM[om]; if (!g) return; const rows = getSortedRowsForOM(om, g); const sub = { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, total: 0 }; g.diarias.forEach(r => { sub.nd15 += r.valor_nd_15; sub.nd30 += r.valor_nd_30; sub.total += r.valor_total; }); g.verbaOperacional.forEach(r => { sub.nd30 += r.valor_nd_30; sub.nd39 += r.valor_nd_39; sub.total += r.valor_nd_30 + r.valor_nd_39; }); g.suprimentoFundos.forEach(r => { sub.nd30 += r.valor_nd_30; sub.nd39 += r.valor_nd_39; sub.total += r.valor_nd_30 + r.valor_nd_39; }); g.passagens.forEach(r => { sub.nd33 += r.valor_nd_33; sub.total += r.valor_nd_33; }); g.concessionarias.forEach(r => { sub.nd39 += r.valor_nd_39; sub.total += r.valor_nd_39; }); g.materialConsumo.forEach(r => { sub.nd30 += r.valor_nd_30; sub.nd39 += r.valor_nd_39; sub.total += r.valor_nd_30 + r.valor_nd_39; }); g.complementoAlimentacao.forEach(i => { const r = i.registro; if (r.categoria_complemento === 'genero' && i.subType) { const v = i.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr); sub.nd30 += v; sub.total += v; } else { sub.nd30 += Number(r.valor_nd_30 || 0); sub.nd39 += Number(r.valor_nd_39 || 0); sub.total += Number(r.valor_total || 0); } }); g.servicosTerceiros.forEach(r => { const v = Number(r.valor_total || 0); sub.total += v; if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) sub.nd33 += v; else { sub.nd33 += Number(r.valor_nd_30 || 0); sub.nd39 += Number(r.valor_nd_39 || 0); } });
    rows.forEach(ri => { const r = ws.getRow(cur); let tL = 0, mem = '', lbl = getDespesaLabel(ri, om), n15=0, n30=0, n33=0, n39=0, n00=0, od = om, ud = g.diarias[0]?.ug || g.verbaOperacional[0]?.ug || 'N/A';
    if (ri.type === 'DIÁRIAS') { const d = ri.data as any; tL = d.valor_nd_15 + d.valor_nd_30; n15 = d.valor_nd_15; n30 = d.valor_nd_30; mem = generateDiariaMemoriaCalculo(d, diretrizesOperacionais); od = d.om_detentora || d.organizacao; ud = d.ug_detentora || d.ug; }
    else if (ri.type === 'PASSAGENS') { const p = ri.data as any; tL = p.totalND33; n33 = p.totalND33; od = p.om_detentora; ud = p.ug_detentora; mem = p.records[0].detalhamento_customizado || generateConsolidatedPassagemMemoriaCalculo(p); }
    else if (ri.type === 'CONCESSIONÁRIA') { const c = ri.data as any; tL = c.totalND39; n39 = c.totalND39; od = c.om_detentora; ud = c.ug_detentora; mem = c.records[0].detalhamento_customizado || generateConsolidatedConcessionariaMemoriaCalculo(c); }
    else if (ri.type === 'MATERIAL DE CONSUMO') { const m = ri.data as any; tL = ri.partialTotal ?? m.valor_total; n30 = ri.partialND30 ?? m.valor_nd_30; n39 = ri.partialND39 ?? m.valor_nd_39; mem = ri.partialItems ? generateMaterialConsumoMemoriaForItems(m, ri.partialItems, { organizacao: m.organizacao, efetivo: m.efetivo, dias_operacao: m.dias_operacao, fase_atividade: m.fase_atividade }) : generateMaterialConsumoMemoriaCalculo(m); od = m.om_detentora || m.organizacao; ud = m.ug_detentora || m.ug; }
    else if (ri.type === 'COMPLEMENTO DE ALIMENTAÇÃO') { const ci = ri.data as any; const rg = ci.registro; if (rg.categoria_complemento === 'genero' && ci.subType) { tL = ci.subType === 'QS' ? (rg.efetivo * rg.dias_operacao * rg.valor_etapa_qs) : (rg.efetivo * rg.dias_operacao * rg.valor_etapa_qr); n30 = tL; od = ci.subType === 'QS' ? (rg.om_qs || rg.organizacao) : rg.organizacao; ud = ci.subType === 'QS' ? (rg.ug_qs || rg.ug) : rg.ug; } else { tL = Number(rg.valor_total || 0); n30 = Number(rg.valor_nd_30 || 0); n39 = Number(rg.valor_nd_39 || 0); od = rg.om_detentora || rg.organizacao; ud = rg.ug_detentora || rg.ug; } mem = generateComplementoMemoriaCalculo(rg, ci.subType); }
    else if (ri.type === 'SERVIÇOS DE TERCEIROS') { const s = ri.data as any; tL = Number(s.valor_total || 0); if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(s.categoria)) n33 = tL; else { n33 = Number(s.valor_nd_30 || 0); n39 = Number(s.valor_nd_39 || 0); } mem = generateServicoMemoriaCalculo(s); od = s.om_detentora || s.organizacao; ud = s.ug_detentora || s.ug; }
    else if (ri.type === 'VERBA OPERACIONAL') { const v = ri.data as any; tL = v.valor_nd_30 + v.valor_nd_39; n30 = v.valor_nd_30; n39 = v.valor_nd_39; mem = generateVerbaOperacionalMemoriaCalculo(v); od = v.om_detentora || v.organizacao; ud = v.ug_detentora || v.ug; }
    else if (ri.type === 'SUPRIMENTO DE FUNDOS') { const sf = ri.data as any; tL = sf.valor_nd_30 + sf.valor_nd_39; n30 = sf.valor_nd_30; n39 = sf.valor_nd_39; mem = generateSuprimentoFundosMemoriaCalculo(sf); od = sf.om_detentora || sf.organizacao; ud = sf.ug_detentora || sf.ug; }
    r.getCell('A').value = lbl; r.getCell('B').value = `${od}\n(${formatCodug(ud)})`; r.getCell('C').value = n15; r.getCell('D').value = n30; r.getCell('E').value = n33; r.getCell('F').value = n39; r.getCell('G').value = n00; r.getCell('H').value = tL; r.getCell('I').value = mem;
    ['C','D','E','F','G','H'].forEach(c => { const cl = r.getCell(c); cl.numFmt = 'R$ #,##0.00'; cl.fill = ndFill; }); ['A','B','I'].forEach(c => { const cl = r.getCell(c); cl.font = { name: 'Arial', size: 8 }; cl.alignment = c === 'I' ? lta : lma; }); ['A','B','C','D','E','F','G','H','I'].forEach(c => r.getCell(c).border = border); cur++; });
    const s1 = ws.getRow(cur); s1.getCell('A').value = 'SOMA POR ND E GP DE DESPESA'; ws.mergeCells(`A${cur}:B${cur}`); s1.getCell('A').alignment = rma; s1.getCell('A').font = { name: 'Arial', size: 9, bold: true }; s1.getCell('A').fill = headerFill; [s1.getCell('C'), s1.getCell('D'), s1.getCell('E'), s1.getCell('F'), s1.getCell('G'), s1.getCell('H')].forEach((cl, i) => { const v = [sub.nd15, sub.nd30, sub.nd33, sub.nd39, sub.nd00, sub.total][i]; cl.value = v; cl.numFmt = 'R$ #,##0.00'; cl.alignment = cma; cl.font = { name: 'Arial', size: 9, bold: true }; cl.fill = headerFill; }); ['A','B','C','D','E','F','G','H','I'].forEach(c => s1.getCell(c).border = border); cur++;
    const s2 = ws.getRow(cur); ws.mergeCells(`A${cur}:G${cur}`); s2.getCell('A').value = `VALOR TOTAL ${getArticleForOM(om)} ${om}`; s2.getCell('A').alignment = rma; s2.getCell('A').font = { name: 'Arial', size: 9, bold: true }; s2.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }; s2.getCell('H').value = sub.total; s2.getCell('H').numFmt = 'R$ #,##0.00'; s2.getCell('H').alignment = cma; s2.getCell('H').font = { name: 'Arial', size: 9, bold: true }; s2.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }; ['A','B','C','D','E','F','G','H','I'].forEach(c => s2.getCell(c).border = border); cur++; });
    cur++; const g1 = ws.getRow(cur); g1.getCell('A').value = 'SOMA POR ND E GP DE DESPESA'; ws.mergeCells(`A${cur}:B${cur}`); g1.getCell('A').alignment = rma; g1.getCell('A').font = { name: 'Arial', size: 9, bold: true }; g1.getCell('A').fill = headerFill; [g1.getCell('C'), g1.getCell('D'), g1.getCell('E'), g1.getCell('F'), g1.getCell('G'), g1.getCell('H')].forEach((cl, i) => { const v = [totaisND.nd15, totaisND.nd30, totaisND.nd33, totaisND.nd39, totaisND.nd00, totaisND.totalGND3][i]; cl.value = v; cl.numFmt = 'R$ #,##0.00'; cl.alignment = cma; cl.font = { name: 'Arial', size: 9, bold: true }; cl.fill = headerFill; }); ['A','B','C','D','E','F','G','H','I'].forEach(c => g1.getCell(c).border = border); cur++;
    const g2 = ws.getRow(cur); ws.mergeCells(`A${cur}:G${cur}`); g2.getCell('A').value = 'VALOR TOTAL'; g2.getCell('A').alignment = rma; g2.getCell('A').font = { name: 'Arial', size: 9, bold: true }; g2.getCell('A').fill = headerFill; g2.getCell('H').value = totaisND.totalGND3; g2.getCell('H').numFmt = 'R$ #,##0.00'; g2.getCell('H').alignment = cma; g2.getCell('H').font = { name: 'Arial', size: 9, bold: true }; g2.getCell('H').fill = headerFill; ['A','B','C','D','E','F','G','H','I'].forEach(c => g2.getCell(c).border = border); cur += 2;
    const lR = ws.getRow(cur); lR.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`; lR.getCell('A').font = { name: 'Arial', size: 10 }; lR.getCell('A').alignment = cma; ws.mergeCells(`A${cur}:I${cur}`); cur += 3;
    const cR = ws.getRow(cur); cR.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'; cR.getCell('A').font = { name: 'Arial', size: 10, bold: true }; cR.getCell('A').alignment = cma; ws.mergeCells(`A${cur}:I${cur}`); cur++;
    const cgR = ws.getRow(cur); cgR.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`; cgR.getCell('A').font = { name: 'Arial', size: 9 }; cgR.getCell('A').alignment = cma; ws.mergeCells(`A${cur}:I${cur}`);
    const b = await wb.xlsx.writeBuffer(); const bl = new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const u = window.URL.createObjectURL(bl); const a = document.createElement('a'); a.href = u; a.download = generateFileName('Excel'); a.click(); window.URL.revokeObjectURL(u);
  }, [omsOrdenadas, gruposPorOM, consolidatedPassagensWithDetails, consolidatedConcessionariasWithDetails, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, ptrabData, diasOperacao, totaisND, fileSuffix, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generateMaterialConsumoMemoriaCalculo, generateComplementoMemoriaCalculo, generateServicoMemoriaCalculo, diretrizesOperacionais, getSortedRowsForOM]);

  const handlePrint = useCallback(() => { window.print(); }, []);

  if (isLoadingDiretrizDetails) return <div className="min-h-[300px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Carregando detalhes das diretrizes...</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline" className="btn-export-pdf">
          <Download className="mr-2 h-4 w-4" /> Exportar PDF
        </Button>
        <Button onClick={exportExcel} variant="outline" className="btn-export-excel">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel
        </Button>
        <Button onClick={handlePrint} variant="default" className="btn-print">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header text-center mb-6">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase mt-4">Plano de Trabalho Operacional de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}</p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Operacional</p>
        </div>

        <div className="ptrab-info mb-4 text-[10pt]">
          <p className="mb-1"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="mb-1"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="mb-1"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="mb-1"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        <div className="ptrab-table-wrapper overflow-x-auto">
          <table className="ptrab-table-op w-full border-collapse border border-black text-[8pt]">
            <thead>
              <tr className="bg-[#D9D9D9] font-bold text-center">
                <th rowSpan={2} className="border border-black p-1 w-[20%]">DESPESAS</th>
                <th rowSpan={2} className="border border-black p-1 w-[10%]">OM (UGE)<br/>CODUG</th>
                <th colSpan={6} className="border border-black p-1">NATUREZA DE DESPESA</th>
                <th rowSpan={2} className="border border-black p-1 w-[38%]">DETALHAMENTO / MEMÓRIA DE CÁLCULO</th>
              </tr>
              <tr className="bg-[#D9D9D9] font-bold text-center">
                  {['33.90.15','33.90.30','33.90.33','33.90.39','33.90.00','GND 3'].map(nd => <th key={nd} className={`border border-black p-1 bg-[#B4C7E7] w-[7%] ${nd === 'GND 3' ? 'total-gnd3-cell' : ''}`}>{nd}</th>)}
              </tr>
          </thead>
          <tbody>
            {omsOrdenadas.map((omName) => { 
              const group = gruposPorOM[omName]; if (!group) return null;
              const ugRef = group.diarias[0]?.ug || group.verbaOperacional[0]?.ug || group.materialConsumo[0]?.ug || 'N/A';
              const sortedRows = getSortedRowsForOM(omName, group);
              const sub = { n15: 0, n30: 0, n33: 0, n39: 0, n00: 0, t: 0 };
              group.diarias.forEach(r => { sub.n15 += r.valor_nd_15; sub.n30 += r.valor_nd_30; sub.t += r.valor_total; });
              group.verbaOperacional.forEach(r => { sub.n30 += r.valor_nd_30; sub.n39 += r.valor_nd_39; sub.t += r.valor_nd_30 + r.valor_nd_39; });
              group.suprimentoFundos.forEach(r => { sub.n30 += r.valor_nd_30; sub.n39 += r.valor_nd_39; sub.t += r.valor_nd_30 + r.valor_nd_39; });
              group.passagens.forEach(r => { sub.n33 += r.valor_nd_33; sub.t += r.valor_nd_33; });
              group.concessionarias.forEach(r => { sub.n39 += r.valor_nd_39; sub.t += r.valor_nd_39; });
              group.materialConsumo.forEach(r => { sub.n30 += r.valor_nd_30; sub.n39 += r.valor_nd_39; sub.t += r.valor_nd_30 + r.valor_nd_39; });
              group.complementoAlimentacao.forEach(i => { const r = i.registro; if (r.categoria_complemento === 'genero' && i.subType) { const v = i.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr); sub.n30 += v; sub.t += v; } else { sub.n30 += Number(r.valor_nd_30 || 0); sub.n39 += Number(r.valor_nd_39 || 0); sub.t += Number(r.valor_total || 0); } });
              group.servicosTerceiros.forEach(r => { const v = Number(r.valor_total || 0); sub.t += v; if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) sub.n33 += v; else { sub.n33 += Number(r.valor_nd_30 || 0); sub.n39 += Number(r.valor_nd_39 || 0); } });
              return (
                  <React.Fragment key={omName}>
                      {sortedRows.map((rowItem) => {
                          const { type, data } = rowItem; let tL = 0, mem = '', lbl = getDespesaLabel(rowItem, omName), n15=0, n30=0, n33=0, n39=0, n00=0, od = omName, ud = ugRef;
                          if (type === 'DIÁRIAS') { const d = data as any; tL = d.valor_nd_15 + d.valor_nd_30; n15 = d.valor_nd_15; n30 = d.valor_nd_30; mem = generateDiariaMemoriaCalculo(d, diretrizesOperacionais); od = d.om_detentora || d.organizacao; ud = d.ug_detentora || d.ug; }
                          else if (type === 'PASSAGENS') { const p = data as any; tL = p.totalND33; n33 = p.totalND33; od = p.om_detentora; ud = p.ug_detentora; mem = p.records[0].detalhamento_customizado || generateConsolidatedPassagemMemoriaCalculo(p); }
                          else if (type === 'CONCESSIONÁRIA') { const c = data as any; tL = c.totalND39; n39 = c.totalND39; od = c.om_detentora; ud = c.ug_detentora; mem = c.records[0].detalhamento_customizado || generateConsolidatedConcessionariaMemoriaCalculo(c); }
                          else if (type === 'MATERIAL DE CONSUMO') { const m = data as any; tL = rowItem.partialTotal ?? m.valor_total; n30 = rowItem.partialND30 ?? m.valor_nd_30; n39 = rowItem.partialND39 ?? m.valor_nd_39; mem = rowItem.partialItems ? generateMaterialConsumoMemoriaForItems(m, rowItem.partialItems, { organizacao: m.organizacao, efetivo: m.efetivo, dias_operacao: m.dias_operacao, fase_atividade: m.fase_atividade }) : generateMaterialConsumoMemoriaCalculo(m); od = m.om_detentora || m.organizacao; ud = m.ug_detentora || m.ug; }
                          else if (type === 'COMPLEMENTO DE ALIMENTAÇÃO') { const ci = data as any; const rg = ci.registro; if (rg.categoria_complemento === 'genero' && ci.subType) { tL = ci.subType === 'QS' ? (rg.efetivo * rg.dias_operacao * rg.valor_etapa_qs) : (rg.efetivo * rg.dias_operacao * rg.valor_etapa_qr); n30 = tL; od = ci.subType === 'QS' ? (rg.om_qs || rg.organizacao) : rg.organizacao; ud = ci.subType === 'QS' ? (rg.ug_qs || rg.ug) : rg.ug; } else { tL = Number(rg.valor_total || 0); n30 = Number(rg.valor_nd_30 || 0); n39 = Number(rg.valor_nd_39 || 0); od = rg.om_detentora || rg.organizacao; ud = rg.ug_detentora || rg.ug; } mem = generateComplementoMemoriaCalculo(rg, ci.subType); }
                          else if (type === 'SERVIÇOS DE TERCEIROS') { const s = data as any; tL = Number(s.valor_total || 0); if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(s.categoria)) n33 = tL; else { n33 = Number(s.valor_nd_30 || 0); n39 = Number(s.valor_nd_39 || 0); } mem = generateServicoMemoriaCalculo(s); od = s.om_detentora || s.organizacao; ud = s.ug_detentora || s.ug; }
                          else if (type === 'VERBA OPERACIONAL') { const v = data as any; tL = v.valor_nd_30 + v.valor_nd_39; n30 = v.valor_nd_30; n39 = v.valor_nd_39; mem = generateVerbaOperacionalMemoriaCalculo(v); od = v.om_detentora || v.organizacao; ud = v.ug_detentora || v.ug; }
                          else if (type === 'SUPRIMENTO DE FUNDOS') { const sf = data as any; tL = sf.valor_nd_30 + sf.valor_nd_39; n30 = sf.valor_nd_30; n39 = sf.valor_nd_39; mem = generateSuprimentoFundosMemoriaCalculo(sf); od = sf.om_detentora || sf.organizacao; ud = sf.ug_detentora || sf.ug; }
                          return (
                              <tr key={`${type}-${omName}-${(data as any).id || (data as any).groupKey}-${rowItem.continuationIndex || 'orig'}`} id={type === 'MATERIAL DE CONSUMO' ? "tour-mat-consumo-row" : undefined} className="expense-row border border-black">
                                <td className="border border-black p-1 align-middle whitespace-pre-wrap">{lbl}</td>
                                <td className="border border-black p-1 text-center align-top"><div>{od}</div><div>({formatCodug(ud)})</div></td>
                                <td className="border border-black p-1 text-center align-middle bg-[#B4C7E7]">{formatCurrency(n15)}</td>
                                <td className="border border-black p-1 text-center align-middle bg-[#B4C7E7]">{formatCurrency(n30)}</td>
                                <td className="border border-black p-1 text-center align-middle bg-[#B4C7E7]">{formatCurrency(n33)}</td>
                                <td className="border border-black p-1 text-center align-middle bg-[#B4C7E7]">{formatCurrency(n39)}</td>
                                <td className="border border-black p-1 text-center align-middle bg-[#B4C7E7]">{formatCurrency(n00)}</td>
                                <td className="border border-black p-1 text-center align-middle bg-[#B4C7E7] font-bold">{formatCurrency(tL)}</td>
                                <td className="border border-black p-1 align-top"><div className="text-[6.5pt] whitespace-pre-wrap">{mem}</div></td>
                              </tr>
                          );
                      })}
                      <tr className="bg-[#D9D9D9] font-bold"><td colSpan={2} className="border border-black p-1 text-right">SOMA POR ND E GP DE DESPESA</td><td className="border border-black p-1 text-center">{formatCurrency(sub.n15)}</td><td className="border border-black p-1 text-center">{formatCurrency(sub.n30)}</td><td className="border border-black p-1 text-center">{formatCurrency(sub.n33)}</td><td className="border border-black p-1 text-center">{formatCurrency(sub.n39)}</td><td className="border border-black p-1 text-center">{formatCurrency(sub.n00)}</td><td className="border border-black p-1 text-center">{formatCurrency(sub.t)}</td><td className="border border-black p-1"></td></tr>
                      <tr className="bg-[#E8E8E8] font-bold"><td colSpan={7} className="border border-black p-1 text-right">VALOR TOTAL {getArticleForOM(omName)} {omName}</td><td className="border border-black p-1 text-center">{formatCurrency(sub.t)}</td><td className="border border-black p-1"></td></tr>
                  </React.Fragment>
              );
            })}
            <tr className="border-none"><td colSpan={9} className="h-4 border-none"></td></tr>
            <tr className="bg-[#D9D9D9] font-bold"><td colSpan={2} className="border border-black p-1 text-right">SOMA POR ND E GP DE DESPESA</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.nd15)}</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.nd30)}</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.nd33)}</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.nd39)}</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.nd00)}</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.totalGND3)}</td><td className="border border-black p-1"></td></tr>
            <tr className="bg-[#D9D9D9] font-bold"><td colSpan={7} className="border border-black p-1 text-right uppercase">VALOR TOTAL</td><td className="border border-black p-1 text-center">{formatCurrency(totaisND.totalGND3)}</td><td className="border border-black p-1"></td></tr>
          </tbody>
          </table>
        </div>
        <div className="ptrab-footer text-center mt-12 text-[10pt]">
          <p>{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="mt-16"><p className="font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p><p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p></div>
        </div>
      </div>
      <style>{`@media print { @page { size: A4 landscape; margin: 0.5cm; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .expense-row { page-break-inside: avoid; } }`}</style>
    </div>
  );
};

export default PTrabOperacionalReport;