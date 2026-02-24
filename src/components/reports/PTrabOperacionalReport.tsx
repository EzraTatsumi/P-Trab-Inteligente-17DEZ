import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from "sonner";
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
  PassagemRegistro,
  GrupoOMOperacional, 
  MaterialConsumoRegistro,
  ComplementoAlimentacaoRegistro,
  ServicoTerceiroRegistro,
} from "@/pages/PTrabReportManager"; 
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

const fetchDiretrizDetails = async (diretrizId: string) => {
    try {
        const { data, error } = await supabase.from('diretrizes_passagens').select('numero_pregao, ug_referencia').eq('id', diretrizId).single();
        return error ? null : data;
    } catch (e) { return null; }
};

const fetchConcessionariaDiretrizDetails = async (diretrizId: string) => {
    try {
        const { data, error } = await supabase.from('diretrizes_concessionaria').select('nome_concessionaria, unidade_custo, fonte_consumo, fonte_custo').eq('id', diretrizId).single();
        return error ? null : data;
    } catch (e) { return null; }
};

const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalized = omName.toUpperCase();
    if (normalized.includes('CMDO') || normalized.includes('º') || normalized.startsWith('COMANDO') || normalized.startsWith('BATALHÃO') || normalized.startsWith('REGIMENTO')) return 'DO';
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

const EXPENSE_ORDER_MAP: Record<string, number> = {
    'CONCESSIONÁRIA': 1, 'DIÁRIAS': 2, 'COMPLEMENTO DE ALIMENTAÇÃO': 3, 'MATERIAL DE CONSUMO': 4, 'PASSAGENS': 5, 'SERVIÇOS DE TERCEIROS': 6, 'SUPRIMENTO DE FUNDOS': 7, 'VERBA OPERACIONAL': 8,
};

type ExpenseRow = {
    type: keyof typeof EXPENSE_ORDER_MAP;
    data: any;
    isContinuation?: boolean;
    continuationIndex?: number;
    partialItems?: ItemAquisicao[];
    partialTotal?: number;
    partialND30?: number;
    partialND39?: number;
};

const formatCategoryName = (cat: string, details?: any) => {
    if (cat === 'outros' && details?.nome_servico_outros) return details.nome_servico_outros;
    return cat.split('-').map(w => w === 'aereo' ? 'Aéreo' : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
  ptrabData, omsOrdenadas, gruposPorOM, registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros, diretrizesOperacionais, diretrizesPassagens, fileSuffix, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generatePassagemMemoriaCalculo, generateConcessionariaMemoriaCalculo, generateMaterialConsumoMemoriaCalculo, generateComplementoMemoriaCalculo, generateServicoMemoriaCalculo,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const diasOperacao = useMemo(() => {
    const start = new Date(ptrabData.periodo_inicio);
    const end = new Date(ptrabData.periodo_fim);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
  }, [ptrabData]);
  
  const [diretrizDetailsMap, setDiretrizDetailsMap] = useState<Record<string, any>>({});
  const [concessionariaDetailsMap, setConcessionariaDetailsMap] = useState<Record<string, any>>({});
  const [isLoadingDiretrizDetails, setIsLoadingDiretrizDetails] = useState(true);

  const { consolidatedPassagens, consolidatedConcessionarias } = useMemo(() => {
    const passagensMap: Record<string, ConsolidatedPassagemReport> = {};
    const concessionariasMap: Record<string, ConsolidatedConcessionariaReport> = {};

    registrosPassagem.forEach(r => {
        const key = [r.organizacao, r.ug, r.om_detentora, r.ug_detentora, r.dias_operacao, r.efetivo, r.fase_atividade, r.diretriz_id].join('|');
        if (!passagensMap[key]) passagensMap[key] = { groupKey: key, organizacao: r.organizacao, ug: r.ug, om_detentora: r.om_detentora || r.organizacao, ug_detentora: r.ug_detentora || r.ug, dias_operacao: r.dias_operacao, efetivo: r.efetivo || 0, fase_atividade: r.fase_atividade || '', records: [], totalGeral: 0, totalND33: 0 } as ConsolidatedPassagemReport;
        passagensMap[key].records.push(r); passagensMap[key].totalGeral += Number(r.valor_total || 0); passagensMap[key].totalND33 += Number(r.valor_nd_33 || 0);
    });
    
    registrosConcessionaria.forEach(r => {
        const key = [r.organizacao, r.ug, r.om_detentora, r.ug_detentora, r.dias_operacao, r.efetivo, r.fase_atividade, r.diretriz_id].join('|');
        if (!concessionariasMap[key]) concessionariasMap[key] = { groupKey: key, organizacao: r.organizacao, ug: r.ug, om_detentora: r.om_detentora || r.organizacao, ug_detentora: r.ug_detentora || r.ug, dias_operacao: r.dias_operacao, efetivo: r.efetivo || 0, fase_atividade: r.fase_atividade || '', records: [], totalGeral: 0, totalND39: 0 } as ConsolidatedConcessionariaReport;
        concessionariasMap[key].records.push(r); concessionariasMap[key].totalGeral += Number(r.valor_total || 0); concessionariasMap[key].totalND39 += Number(r.valor_nd_39 || 0);
    });
    
    return { consolidatedPassagens: Object.values(passagensMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao)), consolidatedConcessionarias: Object.values(concessionariasMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao)) };
  }, [registrosPassagem, registrosConcessionaria]);
  
  useEffect(() => {
    const load = async () => {
        setIsLoadingDiretrizDetails(true);
        const pIds = new Set<string>(); const cIds = new Set<string>();
        consolidatedPassagens.forEach(g => g.records.forEach(r => { if (r.diretriz_id) pIds.add(r.diretriz_id); }));
        consolidatedConcessionarias.forEach(g => g.records.forEach(r => { if (r.diretriz_id) cIds.add(r.diretriz_id); }));
        if (pIds.size === 0 && cIds.size === 0) { setIsLoadingDiretrizDetails(false); return; }
        const pMap: Record<string, any> = {}; const cMap: Record<string, any> = {};
        await Promise.all([ ...Array.from(pIds).map(async (id) => { pMap[id] = await fetchDiretrizDetails(id); }), ...Array.from(cIds).map(async (id) => { cMap[id] = await fetchConcessionariaDiretrizDetails(id); }) ]);
        setDiretrizDetailsMap(pMap); setConcessionariaDetailsMap(cMap); setIsLoadingDiretrizDetails(false); 
    };
    load();
  }, [consolidatedPassagens, consolidatedConcessionarias]);
  
  const consolidatedPassagensWithDetails = useMemo(() => consolidatedPassagens.map(g => ({ ...g, diretrizDetails: g.records[0]?.diretriz_id ? diretrizDetailsMap[g.records[0].diretriz_id] : null })), [consolidatedPassagens, diretrizDetailsMap]);
  const consolidatedConcessionariasWithDetails = useMemo(() => consolidatedConcessionarias.map(g => {
    const det = g.records[0]?.diretriz_id ? concessionariaDetailsMap[g.records[0].diretriz_id] : null;
    return { ...g, records: g.records.map(r => ({ ...r, nome_concessionaria: det?.nome_concessionaria || r.organizacao, unidade_custo: det?.unidade_custo || 'unidade', fonte_consumo: det?.fonte_consumo || null, fonte_custo: det?.fonte_custo || null })), diretrizDetails: det };
  }), [consolidatedConcessionarias, concessionariaDetailsMap]);

  const getDespesaLabel = (row: ExpenseRow, omName: string): string => {
    const { type, data, isContinuation } = row;
    if (type === 'SERVIÇOS DE TERCEIROS') {
        const s = data as ServicoTerceiroRegistro; const c = s.categoria;
        if (c === 'transporte-coletivo') return 'LOCAÇÃO DE VEÍCULOS\n(Transporte Coletivo)';
        if (c === 'locacao-veiculos') return `LOCAÇÃO DE VEÍCULOS\n(${s.group_name || 'Geral'})`;
        if (c === 'outros' && s.detalhes_planejamento?.nome_servico_outros) return s.detalhes_planejamento.nome_servico_outros.toUpperCase();
        return formatCategoryName(c, s.detalhes_planejamento).toUpperCase();
    }
    if (type === 'MATERIAL DE CONSUMO') {
        const m = data as MaterialConsumoRegistro; let l = type;
        const gName = m.group_name || (m as any).nome_grupo;
        if (gName) l += `\n(${gName})`;
        if (isContinuation) l += `\n\nContinuação`;
        return l;
    }
    if (type === 'COMPLEMENTO DE ALIMENTAÇÃO') return `${type}\n(${(data as any).registro.group_name})`;
    if (type === 'PASSAGENS' || type === 'CONCESSIONÁRIA') return (data as any).organizacao !== omName ? `${type}\n${(data as any).organizacao}` : type;
    return type;
  };

  const getSortedRowsForOM = useCallback((omName: string, group: GrupoOMOperacional): ExpenseRow[] => { 
    const allRows: ExpenseRow[] = [];
    group.diarias.forEach(r => allRows.push({ type: 'DIÁRIAS', data: r }));
    consolidatedPassagensWithDetails.filter(c => c.om_detentora === omName).forEach(c => allRows.push({ type: 'PASSAGENS', data: c }));
    consolidatedConcessionariasWithDetails.filter(c => c.om_detentora === omName).forEach(c => allRows.push({ type: 'CONCESSIONÁRIA', data: c }));
    group.materialConsumo.forEach(r => {
        const items = (r.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        const chunks = items.length > 0 ? splitMaterialConsumoItems(items, 15) : [[]];
        chunks.forEach((chunk, index) => {
            const { totalValue, totalND30, totalND39 } = calculateGroupTotals(chunk);
            allRows.push({ type: 'MATERIAL DE CONSUMO', data: r, isContinuation: index > 0, continuationIndex: index, partialItems: chunk, partialTotal: chunk.length > 0 ? totalValue : r.valor_total, partialND30: chunk.length > 0 ? totalND30 : r.valor_nd_30, partialND39: chunk.length > 0 ? totalND39 : r.valor_nd_39 });
        });
    });
    group.complementoAlimentacao.forEach(item => allRows.push({ type: 'COMPLEMENTO DE ALIMENTAÇÃO', data: item }));
    group.servicosTerceiros.forEach(r => allRows.push({ type: 'SERVIÇOS DE TERCEIROS', data: r }));
    group.verbaOperacional.forEach(r => allRows.push({ type: 'VERBA OPERACIONAL', data: r }));
    group.suprimentoFundos.forEach(r => allRows.push({ type: 'SUPRIMENTO DE FUNDOS', data: r }));
    return allRows.sort((a, b) => (EXPENSE_ORDER_MAP[a.type] || 99) - (EXPENSE_ORDER_MAP[b.type] || 99));
  }, [consolidatedPassagensWithDetails, consolidatedConcessionariasWithDetails]);

  const totaisND = useMemo(() => {
    const totals = { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, totalGND3: 0 };
    registrosDiaria.forEach(r => { totals.nd15 += r.valor_nd_15; totals.nd30 += r.valor_nd_30; });
    registrosVerbaOperacional.forEach(r => { totals.nd30 += r.valor_nd_30; totals.nd39 += r.valor_nd_39; });
    registrosSuprimentoFundos.forEach(r => { totals.nd30 += r.valor_nd_30; totals.nd39 += r.valor_nd_39; });
    registrosPassagem.forEach(r => { totals.nd33 += r.valor_nd_33; });
    registrosConcessionaria.forEach(r => { totals.nd39 += r.valor_nd_39; });
    registrosMaterialConsumo.forEach(r => { totals.nd30 += r.valor_nd_30; totals.nd39 += r.valor_nd_39; });
    registrosComplementoAlimentacao.forEach(r => { totals.nd30 += Number(r.valor_nd_30 || 0); totals.nd39 += Number(r.valor_nd_39 || 0); });
    registrosServicosTerceiros.forEach(r => {
        const val = Number(r.valor_total || 0);
        if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) totals.nd33 += val;
        else { totals.nd33 += Number(r.valor_nd_30 || 0); totals.nd39 += Number(r.valor_nd_39 || 0); }
    });
    totals.totalGND3 = totals.nd15 + totals.nd30 + totals.nd33 + totals.nd39;
    return totals;
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria, registrosMaterialConsumo, registrosComplementoAlimentacao, registrosServicosTerceiros]);

  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;
    html2canvas(contentRef.current, { scale: 3, useCORS: true }).then((canvas) => {
      const pdf = new jsPDF('l', 'mm', 'a4'); const imgWidth = 297 - 10;
      pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 5, 5, imgWidth, (canvas.height * imgWidth) / canvas.width);
      pdf.save(`P Trab - ${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}.pdf`);
    });
  }, [ptrabData]);

  if (isLoadingDiretrizDetails) return <div className="min-h-[300px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Carregando detalhes...</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline" className="btn-export-pdf"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
        <Button onClick={() => window.print()} variant="default" className="btn-print"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
      </div>

      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa / Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
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
                <th rowSpan={2} className="col-detalhamento-op">DETALHAMENTO / MEMÓRIA DE CÁLCULO</th>
              </tr>
              <tr>
                  <th className="col-nd-op-small">33.90.15</th><th className="col-nd-op-small">33.90.30</th><th className="col-nd-op-small">33.90.33</th><th className="col-nd-op-small">33.90.39</th><th className="col-nd-op-small">33.90.00</th><th className="col-nd-op-small total-gnd3-cell">GND 3</th>
              </tr>
          </thead>
          <tbody>
            {omsOrdenadas.map((omName) => { 
              const group = gruposPorOM[omName]; if (!group) return null;
              const ugRef = group.diarias[0]?.ug || group.verbaOperacional[0]?.ug || group.materialConsumo[0]?.ug || 'N/A';
              const sortedRows = getSortedRowsForOM(omName, group);
              const subOM = { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, total: 0 };
              
              group.diarias.forEach(r => { subOM.nd15 += r.valor_nd_15; subOM.nd30 += r.valor_nd_30; subOM.total += r.valor_total; });
              group.verbaOperacional.forEach(r => { subOM.nd30 += r.valor_nd_30; subOM.nd39 += r.valor_nd_39; subOM.total += r.valor_nd_30 + r.valor_nd_39; });
              group.suprimentoFundos.forEach(r => { subOM.nd30 += r.valor_nd_30; subOM.nd39 += r.valor_nd_39; subOM.total += r.valor_nd_30 + r.valor_nd_39; });
              group.passagens.forEach(r => { subOM.nd33 += r.valor_nd_33; subOM.total += r.valor_nd_33; });
              group.concessionarias.forEach(r => { subOM.nd39 += r.valor_nd_39; subOM.total += r.valor_nd_39; });
              group.materialConsumo.forEach(r => { subOM.nd30 += r.valor_nd_30; subOM.nd39 += r.valor_nd_39; subOM.total += r.valor_nd_30 + r.valor_nd_39; });
              group.complementoAlimentacao.forEach(i => { const r = i.registro; if (r.categoria_complemento === 'genero' && i.subType) { const v = i.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr); subOM.nd30 += v; subOM.total += v; } else { subOM.nd30 += Number(r.valor_nd_30 || 0); subOM.nd39 += Number(r.valor_nd_39 || 0); subOM.total += Number(r.valor_total || 0); } });
              group.servicosTerceiros.forEach(r => { const v = Number(r.valor_total || 0); subOM.total += v; if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(r.categoria)) subOM.nd33 += v; else { subOM.nd33 += Number(r.valor_nd_30 || 0); subOM.nd39 += Number(r.valor_nd_39 || 0); } });

              return (
                  <React.Fragment key={omName}>
                      {sortedRows.map((rowItem) => {
                          const { type, data } = rowItem;
                          let totalLinha = 0, memoria = '', despesasLabel = getDespesaLabel(rowItem, omName);
                          let v15 = 0, v30 = 0, v33 = 0, v39 = 0, v00 = 0;
                          let omDetentora = omName, ugDetentora = ugRef;

                          switch (type) {
                              case 'DIÁRIAS':
                                  const d = data as DiariaRegistro; totalLinha = d.valor_nd_15 + d.valor_nd_30; v15 = d.valor_nd_15; v30 = d.valor_nd_30; memoria = generateDiariaMemoriaCalculo(d, diretrizesOperacionais); omDetentora = d.om_detentora || d.organizacao; ugDetentora = d.ug_detentora || d.ug; break;
                              case 'PASSAGENS':
                                  const p = data as ConsolidatedPassagemReport; totalLinha = p.totalND33; v33 = p.totalND33; omDetentora = p.om_detentora; ugDetentora = p.ug_detentora; memoria = p.records[0].detalhamento_customizado || generateConsolidatedPassagemMemoriaCalculo(p); break;
                              case 'CONCESSIONÁRIA':
                                  const c = data as ConsolidatedConcessionariaReport; totalLinha = c.totalND39; v39 = c.totalND39; omDetentora = c.om_detentora; ugDetentora = c.ug_detentora; memoria = c.records[0].detalhamento_customizado || generateConsolidatedConcessionariaMemoriaCalculo(c); break;
                              case 'MATERIAL DE CONSUMO':
                                  const m = data as MaterialConsumoRegistro; totalLinha = rowItem.partialTotal ?? m.valor_total; v30 = rowItem.partialND30 ?? m.valor_nd_30; v39 = rowItem.partialND39 ?? m.valor_nd_39; memoria = rowItem.partialItems ? generateMaterialConsumoMemoriaForItems(m, rowItem.partialItems, { organizacao: m.organizacao, efetivo: m.efetivo, dias_operacao: m.dias_operacao, fase_atividade: m.fase_atividade }) : generateMaterialConsumoMemoriaCalculo(m); omDetentora = m.om_detentora || m.organizacao; ugDetentora = m.ug_detentora || m.ug; break;
                              case 'COMPLEMENTO DE ALIMENTAÇÃO':
                                  const comp = data as { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' }; const r = comp.registro; if (r.categoria_complemento === 'genero' && comp.subType) { totalLinha = comp.subType === 'QS' ? (r.efetivo * r.dias_operacao * r.valor_etapa_qs) : (r.efetivo * r.dias_operacao * r.valor_etapa_qr); v30 = totalLinha; omDetentora = comp.subType === 'QS' ? (r.om_qs || r.organizacao) : r.organizacao; ugDetentora = comp.subType === 'QS' ? (r.ug_qs || r.ug) : r.ug; } else { totalLinha = Number(r.valor_total || 0); v30 = Number(r.valor_nd_30 || 0); v39 = Number(r.valor_nd_39 || 0); omDetentora = r.om_detentora || r.organizacao; ugDetentora = r.ug_detentora || r.ug; } memoria = generateComplementoMemoriaCalculo(r, comp.subType); break;
                              case 'SERVIÇOS DE TERCEIROS':
                                  const s = data as ServicoTerceiroRegistro; totalLinha = Number(s.valor_total || 0); if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(s.categoria)) v33 = totalLinha; else { v33 = Number(s.valor_nd_30 || 0); v39 = Number(s.valor_nd_39 || 0); } memoria = generateServicoMemoriaCalculo(s); omDetentora = s.om_detentora || s.organizacao; ugDetentora = s.ug_detentora || s.ug; break;
                              case 'VERBA OPERACIONAL':
                                  const v = data as VerbaOperacionalRegistro; totalLinha = v.valor_nd_30 + v.valor_nd_39; v30 = v.valor_nd_30; v39 = v.valor_nd_39; memoria = generateVerbaOperacionalMemoriaCalculo(v); omDetentora = v.om_detentora || v.organizacao; ugDetentora = v.ug_detentora || v.ug; break;
                              case 'SUPRIMENTO DE FUNDOS':
                                  const sup = data as VerbaOperacionalRegistro; totalLinha = sup.valor_nd_30 + sup.valor_nd_39; v30 = sup.valor_nd_30; v39 = sup.valor_nd_39; memoria = generateSuprimentoFundosMemoriaCalculo(sup); omDetentora = sup.om_detentora || sup.organizacao; ugDetentora = sup.ug_detentora || sup.ug; break;
                          }

                          return (
                              <tr key={`${type}-${omName}-${(data as any).id || (data as any).groupKey || 'key'}-${rowItem.continuationIndex || '0'}`} 
                                  className="expense-row" id={type === 'MATERIAL DE CONSUMO' && (data as any).id === 'ghost-mat' ? 'tour-mat-consumo-row' : undefined}>
                                <td className="col-despesas-op"><div style={{ whiteSpace: 'pre-wrap' }}>{despesasLabel}</div></td>
                                <td className="col-om-op"><div>{omDetentora}</div><div>({formatCodug(ugDetentora)})</div></td>
                                <td className="col-nd-op-small">{formatCurrency(v15)}</td><td className="col-nd-op-small">{formatCurrency(v30)}</td><td className="col-nd-op-small">{formatCurrency(v33)}</td><td className="col-nd-op-small">{formatCurrency(v39)}</td><td className="col-nd-op-small">{formatCurrency(v00)}</td><td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                <td className="col-detalhamento-op"><div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>{memoria}</div></td>
                              </tr>
                          );
                      })}
                      <tr className="subtotal-om-soma-row">
                          <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>SOMA POR ND E GP DE DESPESA</td>
                          <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subOM.nd15)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subOM.nd30)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subOM.nd33)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subOM.nd39)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subOM.nd00)}</td><td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subOM.total)}</td>
                          <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td>
                      </tr>
                      <tr className="subtotal-om-final-row">
                          <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>VALOR TOTAL {getArticleForOM(omName)} {omName}</td>
                          <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', width: '7%' }}>{formatCurrency(subOM.total)}</td>
                          <td style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
                      </tr>
                  </React.Fragment>
              );
            })}
            <tr className="total-geral-soma-row">
              <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>SOMA POR ND E GP DE DESPESA</td>
              <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd15)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd30)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd33)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd39)}</td><td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd00)}</td><td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.totalGND3)}</td>
              <td></td>
            </tr>
            <tr className="total-geral-final-row">
              <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000', borderRight: 'none' }}>VALOR TOTAL</td>
              <td className="text-center font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000', width: '7%' }}>{formatCurrency(totaisND.totalGND3)}</td>
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
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table-op { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; }
        .ptrab-table-op th, .ptrab-table-op td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table-op thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-despesas-op { width: 20%; text-align: left; } 
        .col-om-op { width: 10%; text-align: center; }
        .col-nd-op-small { width: 7%; text-align: center; background-color: #B4C7E7 !important; }
        .col-detalhamento-op { width: 38%; text-align: left; }
        .total-gnd3-cell { background-color: #B4C7E7 !important; }
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
      `}</style>
    </div>
  );
};

export default PTrabOperacionalReport;