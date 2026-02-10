"use client";

import React, { useMemo } from 'react';
import { 
    PTrabData, 
    GrupoOMOperacional, 
    DiariaRegistro, 
    VerbaOperacionalRegistro, 
    PassagemRegistro, 
    ConcessionariaRegistro, 
    MaterialConsumoRegistro,
    ComplementoAlimentacaoRegistro
} from "@/pages/PTrabReportManager";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';

interface PTrabOperacionalReportProps {
    ptrabData: PTrabData;
    omsOrdenadas: string[];
    gruposPorOM: Record<string, GrupoOMOperacional>;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: ConcessionariaRegistro[];
    registrosMaterialConsumo: MaterialConsumoRegistro[];
    registrosComplementoAlimentacao: ComplementoAlimentacaoRegistro[];
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    diretrizesPassagens: Tables<'diretrizes_passagens'>[];
    fileSuffix: string;
    generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
    generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string;
    generateConcessionariaMemoriaCalculo: (registro: ConcessionariaRegistro) => string;
    generateMaterialConsumoMemoriaCalculo: (registro: MaterialConsumoRegistro) => string;
    generateComplementoMemoriaCalculo: (registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR') => string;
}

interface ExpenseRow {
  text: string;
  value: number;
  nd: string;
  isContinuation?: boolean;
  subType?: string; // ADICIONADO PARA CORREÇÃO DO ERRO TS
}

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
}) => {
    const reportRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadPDF = async () => {
        if (!reportRef.current) return;
        const canvas = await html2canvas(reportRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`PTrab_Operacional_${ptrabData.numero_ptrab.replace(/\//g, '-')}.pdf`);
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('P Trab Operacional');

        worksheet.columns = [
            { header: 'OM', key: 'om', width: 30 },
            { header: 'UG', key: 'ug', width: 15 },
            { header: 'Despesa', key: 'despesa', width: 50 },
            { header: 'ND', key: 'nd', width: 15 },
            { header: 'Valor', key: 'valor', width: 20 },
        ];

        omsOrdenadas.forEach(omName => {
            const grupo = gruposPorOM[omName];
            const firstRecord = [...grupo.diarias, ...grupo.verbaOperacional, ...grupo.suprimentoFundos, ...grupo.passagens, ...grupo.concessionarias, ...grupo.materialConsumo, ...grupo.complementoAlimentacao.map(c => c.registro)][0];
            const ug = firstRecord ? firstRecord.ug : '';

            const addRows = (items: any[], type: string, nd: string, valueField: string) => {
                items.forEach(item => {
                    worksheet.addRow({
                        om: omName,
                        ug: formatCodug(ug),
                        despesa: type,
                        nd: nd,
                        valor: item[valueField]
                    });
                });
            };

            addRows(grupo.diarias, 'Diárias', '33.90.15/30', 'valor_total');
            addRows(grupo.verbaOperacional, 'Verba Operacional', '33.90.30/39', 'valor_total_solicitado');
            addRows(grupo.suprimentoFundos, 'Suprimento de Fundos', '33.90.30/39', 'valor_total_solicitado');
            addRows(grupo.passagens, 'Passagens', '33.90.33', 'valor_total');
            addRows(grupo.concessionarias, 'Concessionária', '33.90.39', 'valor_total');
            addRows(grupo.materialConsumo, 'Material de Consumo', '33.90.30/39', 'valor_total');
            
            grupo.complementoAlimentacao.forEach(c => {
                worksheet.addRow({
                    om: omName,
                    ug: formatCodug(ug),
                    despesa: `Complemento (${c.subType || 'Geral'})`,
                    nd: '33.90.30',
                    valor: c.registro.valor_total
                });
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PTrab_Operacional_${ptrabData.numero_ptrab.replace(/\//g, '-')}.xlsx`;
        a.click();
    };

    const splitTextIntoRows = (text: string, maxChars: number): string[] => {
        const lines = text.split('\n');
        const rows: string[] = [];
        lines.forEach(line => {
            let currentLine = line;
            while (currentLine.length > maxChars) {
                let splitIndex = currentLine.lastIndexOf(' ', maxChars);
                if (splitIndex === -1) splitIndex = maxChars;
                rows.push(currentLine.substring(0, splitIndex));
                currentLine = currentLine.substring(splitIndex).trim();
            }
            rows.push(currentLine);
        });
        return rows;
    };

    const getExpenseRows = (text: string, value: number, nd: string, subType?: string): ExpenseRow[] => {
        const lines = splitTextIntoRows(text, 85);
        return lines.map((line, index) => ({
            text: line,
            value: index === 0 ? value : 0,
            nd: index === 0 ? nd : '',
            isContinuation: index > 0,
            subType: index === 0 ? subType : undefined
        }));
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-end gap-4 print:hidden">
                <Button onClick={handleDownloadPDF} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> PDF
                </Button>
                <Button onClick={handleExportExcel} variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
            </div>

            <div ref={reportRef} className="bg-white p-8 shadow-sm border rounded-lg print:shadow-none print:border-none text-black font-serif">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold uppercase">Plano de Trabalho Operacional</h1>
                    <h2 className="text-lg font-bold">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</h2>
                    <p className="text-sm mt-2">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
                </div>

                <table className="w-full border-collapse border border-black text-[10px]">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 text-left w-1/4">OM / UG</th>
                            <th className="border border-black p-2 text-left">Memória de Cálculo / Despesa</th>
                            <th className="border border-black p-2 text-center w-20">ND</th>
                            <th className="border border-black p-2 text-right w-32">Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {omsOrdenadas.map(omName => {
                            const grupo = gruposPorOM[omName];
                            const firstRecord = [...grupo.diarias, ...grupo.verbaOperacional, ...grupo.suprimentoFundos, ...grupo.passagens, ...grupo.concessionarias, ...grupo.materialConsumo, ...grupo.complementoAlimentacao.map(c => c.registro)][0];
                            const ug = firstRecord ? firstRecord.ug : '';

                            const allRows: { type: string, data: any, rows: ExpenseRow[] }[] = [
                                ...grupo.diarias.map(d => ({ type: 'diaria', data: d, rows: getExpenseRows(generateDiariaMemoriaCalculo(d, diretrizesOperacionais), d.valor_total, '33.90.15/30') })),
                                ...grupo.verbaOperacional.map(v => ({ type: 'verba', data: v, rows: getExpenseRows(generateVerbaOperacionalMemoriaCalculo(v), v.valor_total_solicitado, '33.90.30/39') })),
                                ...grupo.suprimentoFundos.map(s => ({ type: 'suprimento', data: s, rows: getExpenseRows(generateSuprimentoFundosMemoriaCalculo(s), s.valor_total_solicitado, '33.90.30/39') })),
                                ...grupo.passagens.map(p => ({ type: 'passagem', data: p, rows: getExpenseRows(generatePassagemMemoriaCalculo(p), p.valor_total, '33.90.33') })),
                                ...grupo.concessionarias.map(c => ({ type: 'concessionaria', data: c, rows: getExpenseRows(generateConcessionariaMemoriaCalculo(c), c.valor_total, '33.90.39') })),
                                ...grupo.materialConsumo.map(m => ({ type: 'material', data: m, rows: getExpenseRows(generateMaterialConsumoMemoriaCalculo(m), m.valor_total, '33.90.30/39') })),
                                ...grupo.complementoAlimentacao.map(c => ({ type: 'complemento', data: c.registro, rows: getExpenseRows(generateComplementoMemoriaCalculo(c.registro, c.subType), c.registro.valor_total, '33.90.30', c.subType) }))
                            ];

                            return (
                                <React.Fragment key={omName}>
                                    <tr className="bg-gray-50 font-bold">
                                        <td className="border border-black p-2" colSpan={4}>
                                            {omName} (UG: {formatCodug(ug)})
                                        </td>
                                    </tr>
                                    {allRows.map(({ type, data, rows }) => (
                                        rows.map((rowItem, idx) => (
                                            <tr key={`${type}-${omName}-${data.id || data.groupKey || data.registro?.id}-${idx}-${rowItem.subType || ''}`} className="expense-row">
                                                <td className="border border-black p-2"></td>
                                                <td className="border border-black p-2 font-mono whitespace-pre-wrap">
                                                    {rowItem.text}
                                                </td>
                                                <td className="border border-black p-2 text-center">
                                                    {rowItem.nd}
                                                </td>
                                                <td className="border border-black p-2 text-right">
                                                    {rowItem.value > 0 ? formatCurrency(rowItem.value) : ''}
                                                </td>
                                            </tr>
                                        ))
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PTrabOperacionalReport;