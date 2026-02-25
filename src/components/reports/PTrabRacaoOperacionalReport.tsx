import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from "sonner";
import { formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PTrabData,
  ClasseIRegistro,
  calculateDays,
  formatDate,
} from "@/pages/PTrabReportManager";

interface PTrabRacaoOperacionalReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  fileSuffix: string;
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
}

interface RacaoOpLinha {
    om: string;
    ug: string;
    r2_quantidade: number;
    r3_quantidade: number;
    total_unidades: number;
    fase_atividade: string;
    efetivo: number;
    dias_operacao: number;
    registroOriginal: ClasseIRegistro;
}

const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({
  ptrabData,
  registrosClasseI,
  fileSuffix,
  generateClasseIMemoriaCalculo,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const racaoOperacionalConsolidada = useMemo(() => {
    const registros = registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL' && ((r.quantidadeR2 || 0) > 0 || (r.quantidadeR3 || 0) > 0));
    const grupos: Record<string, RacaoOpLinha> = {};
    
    registros.forEach(r => {
        const key = `${r.organizacao}-${r.ug}`;
        const hasCustomMemoria = !!r.memoria_calculo_op_customizada && r.memoria_calculo_op_customizada.trim().length > 0;
        
        if (!grupos[key]) {
            grupos[key] = {
                om: r.organizacao,
                ug: r.ug,
                r2_quantidade: 0,
                r3_quantidade: 0,
                total_unidades: 0,
                fase_atividade: r.faseAtividade || 'operação',
                efetivo: r.efetivo || 0,
                dias_operacao: r.diasOperacao,
                registroOriginal: r,
            };
        }
        
        grupos[key].r2_quantidade += (r.quantidadeR2 || 0);
        grupos[key].r3_quantidade += (r.quantidadeR3 || 0);
        grupos[key].total_unidades += (r.quantidadeR2 || 0) + (r.quantidadeR3 || 0);
        
        const currentSavedRecord = grupos[key].registroOriginal;
        const savedHasCustomMemoria = !!currentSavedRecord.memoria_calculo_op_customizada && currentSavedRecord.memoria_calculo_op_customizada.trim().length > 0;
        
        if (hasCustomMemoria && !savedHasCustomMemoria) {
            grupos[key].registroOriginal = r;
        }
        
        grupos[key].efetivo = r.efetivo || 0;
        grupos[key].dias_operacao = r.diasOperacao;
        grupos[key].fase_atividade = r.faseAtividade || 'operação';
    });
    
    return Object.values(grupos).sort((a, b) => a.om.localeCompare(b.om));
  }, [registrosClasseI]);
  
  const totalRacoesGeral = racaoOperacionalConsolidada.reduce((sum, r) => sum + r.total_unidades, 0);
  
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    if (isMinuta) nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    nomeBase += ` - ${ptrabData.nome_operacao} - Atz ${dataAtz} - ${fileSuffix}`;
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  const handleExportPdf = useCallback(() => {
    if (!contentRef.current) return;
    const pdfToast = toast.loading("Gerando PDF...");
    html2canvas(contentRef.current, { scale: 3, useCORS: true, allowTaint: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const margin = 5;
      const pdfWidth = 297;
      const pdfHeight = 210;
      const contentHeight = pdfHeight - 2 * margin;
      const imgWidth = pdfWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
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
      toast.dismiss(pdfToast);
      toast.success("PDF Exportado!");
    }).catch(() => {
      toast.dismiss(pdfToast);
      toast.error("Erro na Exportação");
    });
  }, [ptrabData, racaoOperacionalConsolidada, fileSuffix]);

  const exportExcel = useCallback(async () => {
    if (racaoOperacionalConsolidada.length === 0) {
        toast.warning("Não há dados de Ração Operacional para exportar.");
        return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ração Operacional');
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const cellBorder = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9';
    let currentRow = 1;
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        currentRow++;
    };
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;
    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO LOGÍSTICO - Ração Operacional';
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow += 2;
    const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = { richText: [{ text: label, font: headerFontStyle }, { text: ` ${value}`, font: { name: 'Arial', size: 9 } }] };
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
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
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell('A').value = 'DESPESAS';
    headerRow.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow.getCell('C').value = 'QUANTIDADE';
    headerRow.getCell('D').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
    worksheet.columns = [{ width: 35 }, { width: 20 }, { width: 15 }, { width: 70 }];
    ['A', 'B', 'C', 'D'].forEach(col => {
        const cell = headerRow.getCell(col);
        cell.style = { font: headerFontStyle, alignment: centerMiddleAlignment, border: cellBorder, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } } };
    });
    currentRow++;
    racaoOperacionalConsolidada.forEach(linha => {
        const row = worksheet.getRow(currentRow);
        row.getCell('A').value = `Ração Operacional de Combate`;
        row.getCell('A').alignment = leftMiddleAlignment;
        row.getCell('B').value = `${linha.om}\n(${formatCodug(linha.ug)})`;
        row.getCell('B').alignment = centerMiddleAlignment;
        row.getCell('C').value = linha.total_unidades;
        row.getCell('C').alignment = centerMiddleAlignment;
        row.getCell('C').numFmt = '#,##0'; 
        row.getCell('D').value = generateClasseIMemoriaCalculo(linha.registroOriginal, 'OP');
        row.getCell('D').alignment = leftTopAlignment;
        row.getCell('D').font = { name: 'Arial', size: 6.5 };
        ['A', 'B', 'C', 'D'].forEach(col => { row.getCell(col).border = cellBorder; row.getCell(col).font = baseFontStyle; });
        currentRow++;
    });
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell('A').value = 'TOTAL';
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalRow.getCell('A').alignment = centerMiddleAlignment;
    totalRow.getCell('A').font = headerFontStyle;
    totalRow.getCell('A').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } };
    totalRow.getCell('A').border = cellBorder;
    totalRow.getCell('C').value = totalRacoesGeral;
    totalRow.getCell('C').alignment = centerMiddleAlignment;
    totalRow.getCell('C').font = headerFontStyle;
    totalRow.getCell('C').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFB4C7E7' } };
    totalRow.getCell('C').border = cellBorder;
    totalRow.getCell('C').numFmt = '#,##0'; 
    totalRow.getCell('D').border = cellBorder;
    currentRow += 3;
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow += 3;
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
    cmtRow.getCell('A').font = { ...baseFontStyle, size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
    cargoRow.getCell('A').font = baseFontStyle;
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName('Excel');
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Excel Exportado!");
  }, [racaoOperacionalConsolidada, ptrabData, diasOperacao, fileSuffix, generateClasseIMemoriaCalculo]);

  if (racaoOperacionalConsolidada.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-secondary"><Utensils className="h-5 w-5" />Ração Operacional (R2/R3)</CardTitle></CardHeader>
        <CardContent><div className="text-center py-8"><p className="text-muted-foreground">Nenhum registro de Ração Operacional encontrado para este P Trab.</p></div></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={handleExportPdf} variant="outline"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
        <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar Excel</Button>
        <Button onClick={() => window.print()} variant="default"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
      </div>

      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header text-center mb-6">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}</p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico - Ração Operacional</p>
        </div>

        <div className="ptrab-info mb-4 text-[10pt] space-y-1">
          <p><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="font-bold mt-2">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        <div className="ptrab-table-wrapper">
          <table className="w-full border-collapse border border-black text-[9pt]">
            <thead>
              <tr className="bg-[#D9D9D9] font-bold">
                <th className="border border-black p-1 w-[25%] text-left">DESPESAS</th>
                <th className="border border-black p-1 w-[15%] text-center">OM (UGE)<br/>CODUG</th>
                <th className="border border-black p-1 w-[10%] text-center">QUANTIDADE</th>
                <th className="border border-black p-1 w-[50%] text-center">DETALHAMENTO / MEMÓRIA DE CÁLCULO</th>
              </tr>
            </thead>
            <tbody>
              {racaoOperacionalConsolidada.map((linha, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1 text-left">Ração Operacional de Combate</td>
                  <td className="border border-black p-1 text-center"><div>{linha.om}</div><div>({formatCodug(linha.ug)})</div></td>
                  <td className="border border-black p-1 text-center">{formatNumber(linha.total_unidades, 0)}</td>
                  <td className="border border-black p-1 text-left align-top" style={{ fontSize: '6.5pt' }}>
                    <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                      {generateClasseIMemoriaCalculo(linha.registroOriginal, 'OP')}
                    </pre>
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={2} className="border border-black p-1 text-center bg-[#D9D9D9]">TOTAL</td>
                <td className="border border-black p-1 text-center bg-[#B4C7E7]">{formatNumber(totalRacoesGeral, 0)}</td>
                <td className="border border-black p-1 bg-white"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ptrab-footer mt-12 text-center print-avoid-break">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="mt-16">
            <p className="text-[10pt] font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 0.5cm; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .print-avoid-break { page-break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
};

export default PTrabRacaoOperacionalReport;