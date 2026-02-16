import React, { useRef, useCallback, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDateDDMMMAA, formatCodug, formatDate } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PTrabData, MaterialPermanenteRegistro } from "@/pages/PTrabReportManager";
import { generateMaterialPermanenteMemoriaCalculo, ItemMaterialPermanente } from "@/lib/materialPermanenteUtils";

interface PTrabMaterialPermanenteReportProps {
  ptrabData: PTrabData;
  registrosMaterialPermanente: MaterialPermanenteRegistro[];
  fileSuffix: string;
}

const PTrabMaterialPermanenteReport: React.FC<PTrabMaterialPermanenteReportProps> = ({
  ptrabData,
  registrosMaterialPermanente,
  fileSuffix,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = useMemo(() => {
    const start = new Date(ptrabData.periodo_inicio);
    const end = new Date(ptrabData.periodo_fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  }, [ptrabData]);

  const totalGeralND52 = useMemo(() => 
    registrosMaterialPermanente.reduce((acc, r) => acc + Number(r.valor_nd_52 || 0), 0)
  , [registrosMaterialPermanente]);

  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    return `P Trab Nr ${numeroPTrab} - ${ptrabData.nome_operacao} - ${fileSuffix}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;
    const pdfToast = toast({ title: "Gerando PDF...", description: "Aguarde enquanto o relatório é processado." });
    html2canvas(contentRef.current, { scale: 3, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = 297; 
      const pdfHeight = 210; 
      const margin = 5;
      const contentWidth = pdfWidth - 2 * margin;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight);
      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
      toast({ title: "PDF Exportado!", description: "O relatório foi salvo com sucesso." });
    });
  }, [ptrabData, fileSuffix, toast]);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Mat Perm');
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const cellBorder = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; 

    let currentRow = 1;
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`); 
        currentRow++;
    };

    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    addHeaderRow((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase());
    addHeaderRow(`PLANO DE TRABALHO DE MATERIAL PERMANENTE - OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`);
    currentRow++;

    const headerRow = worksheet.getRow(currentRow);
    const headers = ['DESPESAS', 'OM (UGE) CODUG', '44.90.52', 'GND 4', 'DETALHAMENTO / MEMÓRIA DE CÁLCULO'];
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = headerFontStyle;
        cell.alignment = centerMiddleAlignment;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } };
        cell.border = cellBorder;
    });
    worksheet.columns = [{ width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 60 }];
    currentRow++;

    registrosMaterialPermanente.forEach(registro => {
        const items = (registro.detalhes_planejamento as any)?.items || [];
        items.forEach((item: ItemMaterialPermanente) => {
            const row = worksheet.getRow(currentRow);
            row.getCell(1).value = item.descricao.toUpperCase();
            row.getCell(2).value = `${registro.om_detentora || registro.organizacao}\n(${formatCodug(registro.ug_detentora || registro.ug)})`;
            row.getCell(3).value = item.quantidade * item.valor_unitario;
            row.getCell(4).value = item.quantidade * item.valor_unitario;
            row.getCell(5).value = generateMaterialPermanenteMemoriaCalculo(registro, item);
            
            row.getCell(3).numFmt = 'R$ #,##0.00';
            row.getCell(4).numFmt = 'R$ #,##0.00';
            
            [1, 2, 3, 4, 5].forEach(i => {
                row.getCell(i).border = cellBorder;
                row.getCell(i).alignment = { vertical: 'top', wrapText: true };
                if (i === 2 || i === 3 || i === 4) row.getCell(i).alignment = centerMiddleAlignment;
            });
            currentRow++;
        });
    });

    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(1).value = 'VALOR TOTAL';
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalRow.getCell(3).value = totalGeralND52;
    totalRow.getCell(4).value = totalGeralND52;
    [1, 3, 4, 5].forEach(i => {
        totalRow.getCell(i).font = headerFontStyle;
        totalRow.getCell(i).border = cellBorder;
        totalRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } };
    });
    totalRow.getCell(3).numFmt = 'R$ #,##0.00';
    totalRow.getCell(4).numFmt = 'R$ #,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = generateFileName('Excel'); a.click();
    window.URL.revokeObjectURL(url);
  }, [ptrabData, registrosMaterialPermanente, totalGeralND52, fileSuffix]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline"><Download className="mr-2 h-4 w-4" />Exportar PDF</Button>
        <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar Excel</Button>
        <Button onClick={() => window.print()} variant="default"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
      </div>

      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="text-center mb-6 space-y-1">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">PLANO DE TRABALHO DE MATERIAL PERMANENTE - OPERAÇÃO {ptrabData.nome_operacao.toUpperCase()}</p>
        </div>

        <div className="mb-4 text-[10pt] space-y-1">
          <p><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="font-bold">5. DESPESAS DE MATERIAL PERMANENTE REALIZADAS OU A REALIZAR:</p>
        </div>

        <table className="w-full border-collapse border border-black text-[8pt]">
          <thead>
            <tr className="bg-[#D9D9D9]">
              <th className="border border-black p-1 w-[20%]">DESPESAS</th>
              <th className="border border-black p-1 w-[15%]">OM (UGE)<br/>CODUG</th>
              <th className="border border-black p-1 w-[10%]">44.90.52</th>
              <th className="border border-black p-1 w-[10%]">GND 4</th>
              <th className="border border-black p-1 w-[45%]">DETALHAMENTO / MEMÓRIA DE CÁLCULO</th>
            </tr>
          </thead>
          <tbody>
            {registrosMaterialPermanente.map((registro) => {
              const items = (registro.detalhes_planejamento as any)?.items || [];
              return items.map((item: ItemMaterialPermanente, idx: number) => (
                <tr key={`${registro.id}-${idx}`}>
                  <td className="border border-black p-1 uppercase">{item.descricao}</td>
                  <td className="border border-black p-1 text-center">
                    {registro.om_detentora || registro.organizacao}<br/>
                    ({formatCodug(registro.ug_detentora || registro.ug)})
                  </td>
                  <td className="border border-black p-1 text-center">{formatCurrency(item.quantidade * item.valor_unitario)}</td>
                  <td className="border border-black p-1 text-center">{formatCurrency(item.quantidade * item.valor_unitario)}</td>
                  <td className="border border-black p-1 text-[6.5pt] whitespace-pre-wrap align-top">
                    {generateMaterialPermanenteMemoriaCalculo(registro, item)}
                  </td>
                </tr>
              ));
            })}
            <tr className="bg-[#D9D9D9] font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">VALOR TOTAL</td>
              <td className="border border-black p-1 text-center">{formatCurrency(totalGeralND52)}</td>
              <td className="border border-black p-1 text-center">{formatCurrency(totalGeralND52)}</td>
              <td className="border border-black p-1"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-12 text-center space-y-12">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="inline-block">
            <p className="text-[10pt] font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTrabMaterialPermanenteReport;