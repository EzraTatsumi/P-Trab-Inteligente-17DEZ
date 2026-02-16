import React, { useState, useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug, formatDate, calculateDays } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, HardHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PTrabData, MaterialPermanenteRegistro } from "@/pages/PTrabReportManager";
import { generateMaterialPermanenteMemoriaCalculo } from "@/lib/materialPermanenteUtils";

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
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);

  // Consolidação de itens para a tabela: Uma linha por item
  const rows = useMemo(() => {
    const allRows: any[] = [];
    registrosMaterialPermanente.forEach(reg => {
      // Tenta buscar itens de detalhes_planejamento ou itens_aquisicao (dependendo da versão do form)
      const items = (reg.detalhes_planejamento as any)?.items || (reg as any).itens_aquisicao || [];
      
      items.forEach((item: any) => {
        const valorTotal = Number(item.valor_unitario || 0) * Number(item.quantidade || 1);
        allRows.push({
          id: `${reg.id}-${item.descricao_item}-${item.quantidade}`,
          itemNome: (item.descricao_reduzida || item.descricao_item || "Item sem descrição").toUpperCase(),
          omDestino: reg.om_detentora || reg.organizacao,
          ugDestino: reg.ug_detentora || reg.ug,
          valor: valorTotal,
          memoria: generateMaterialPermanenteMemoriaCalculo(reg, { itemEspecifico: item })
        });
      });
    });
    return allRows;
  }, [registrosMaterialPermanente]);

  const totalGeral = useMemo(() => rows.reduce((acc, row) => acc + row.valor, 0), [rows]);

  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-');
    return `P Trab Nr ${numeroPTrab} - ${ptrabData.nome_operacao} - ${fileSuffix}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
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
      const imgWidth = pdfWidth - 2 * margin;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
      toast({ title: "PDF Exportado!" });
    });
  }, [ptrabData, fileSuffix, toast]);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Material Permanente');
    
    const centerStyle = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopStyle = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9D9D9' } };
    const ndFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }; // Verde claro
    
    let curr = 1;
    const addTitle = (text: string, bold = true, underline = false) => {
      const row = worksheet.getRow(curr);
      row.getCell(1).value = text;
      row.getCell(1).font = { name: 'Arial', size: 11, bold, underline };
      row.getCell(1).alignment = centerStyle;
      worksheet.mergeCells(`A${curr}:E${curr}`);
      curr++;
    };

    addTitle('MINISTÉRIO DA DEFESA');
    addTitle('EXÉRCITO BRASILEIRO');
    addTitle(ptrabData.comando_militar_area.toUpperCase());
    addTitle((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase());
    addTitle(`PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`);
    addTitle('PLANO DE TRABALHO DE MATERIAL PERMANENTE', true, true);
    curr++;

    const addInfo = (label: string, val: string) => {
      const row = worksheet.getRow(curr);
      row.getCell(1).value = { richText: [{ text: label, font: { bold: true, size: 9 } }, { text: ` ${val}`, font: { size: 9 } }] };
      worksheet.mergeCells(`A${curr}:E${curr}`);
      curr++;
    };
    addInfo('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfo('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
    addInfo('3. EFETIVO EMPREGADO:', ptrabData.efetivo_empregado);
    addInfo('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    addInfo('5. DESPESAS DE MATERIAL PERMANENTE REALIZADAS OU A REALIZAR:', '');

    const h1 = worksheet.getRow(curr);
    const h2 = worksheet.getRow(curr + 1);
    
    h1.getCell('A').value = 'DESPESAS';
    worksheet.mergeCells(`A${curr}:A${curr+1}`);
    h1.getCell('B').value = 'OM (UGE)';
    worksheet.mergeCells(`C${curr}:D${curr}`);
    h1.getCell('E').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO';

    h2.getCell('B').value = 'CODUG';
    h2.getCell('C').value = '44.90.52';
    h2.getCell('D').value = 'GND 4';
    h2.getCell('E').value = '(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';

    ['A', 'B', 'C', 'D', 'E'].forEach(c => {
      const cell1 = h1.getCell(c);
      const cell2 = h2.getCell(c);
      [cell1, cell2].forEach(cell => {
        cell.fill = headerFill;
        cell.border = border;
        cell.alignment = centerStyle;
        cell.font = { bold: true, size: 9 };
      });
    });

    h2.getCell('C').fill = ndFill;
    h2.getCell('D').fill = ndFill;
    h2.getCell('E').font = { size: 7, bold: false };

    worksheet.columns = [{ width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 60 }];
    curr += 2;

    rows.forEach(r => {
      const row = worksheet.getRow(curr);
      row.getCell('A').value = r.itemNome;
      row.getCell('B').value = `${r.omDestino}\n(${formatCodug(r.ugDestino)})`;
      row.getCell('C').value = r.valor;
      row.getCell('D').value = r.valor;
      row.getCell('E').value = r.memoria;

      ['C', 'D'].forEach(c => {
        row.getCell(c).numFmt = 'R$ #,##0.00';
        row.getCell(c).fill = ndFill;
      });

      ['A', 'B', 'C', 'D', 'E'].forEach(c => {
        row.getCell(c).border = border;
        row.getCell(c).alignment = c === 'E' ? leftTopStyle : centerStyle;
        row.getCell(c).font = { size: 8 };
      });
      curr++;
    });

    const tRow = worksheet.getRow(curr);
    tRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
    worksheet.mergeCells(`A${curr}:B${curr}`);
    tRow.getCell('C').value = totalGeral;
    tRow.getCell('D').value = totalGeral;
    ['A', 'B', 'C', 'D', 'E'].forEach(c => {
      tRow.getCell(c).fill = headerFill;
      tRow.getCell(c).border = border;
      tRow.getCell(c).font = { bold: true, size: 9 };
      if (c === 'C' || c === 'D') tRow.getCell(c).numFmt = 'R$ #,##0.00';
    });
    curr++;

    const fRow = worksheet.getRow(curr);
    fRow.getCell('A').value = 'VALOR TOTAL';
    worksheet.mergeCells(`A${curr}:B${curr}`);
    fRow.getCell('C').value = totalGeral;
    worksheet.mergeCells(`C${curr}:D${curr}`);
    ['A', 'B', 'C', 'D', 'E'].forEach(c => {
      fRow.getCell(c).fill = headerFill;
      fRow.getCell(c).border = border;
      fRow.getCell(c).font = { bold: true, size: 10 };
      if (c === 'C') fRow.getCell(c).numFmt = 'R$ #,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = generateFileName('Excel'); a.click();
    toast({ title: "Excel Exportado!" });
  }, [ptrabData, rows, totalGeral, diasOperacao, fileSuffix, toast]);

  if (rows.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <HardHat className="h-5 w-5" />
            P Trab Material Permanente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro de material permanente encontrado.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline"><Download className="mr-2 h-4 w-4" />PDF</Button>
        <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        <Button onClick={() => window.print()} variant="default"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
      </div>

      <div ref={contentRef} className="bg-white shadow-xl print:shadow-none" style={{ padding: '0.5cm', minHeight: '29.7cm' }}>
        <div className="text-center uppercase font-bold text-[11pt] leading-tight space-y-0.5 mb-4">
          <p>Ministério da Defesa</p>
          <p>Exército Brasileiro</p>
          <p>{ptrabData.comando_militar_area}</p>
          <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="mt-2">PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO {ptrabData.nome_operacao}</p>
          <p className="underline underline-offset-2">PLANO DE TRABALHO DE MATERIAL PERMANENTE</p>
        </div>

        <div className="text-[10pt] space-y-0.5 mb-1 leading-tight">
          <p><strong>1. NOME DA OPERAÇÃO:</strong> {ptrabData.nome_operacao}</p>
          <p><strong>2. PERÍODO:</strong> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p><strong>3. EFETIVO EMPREGADO:</strong> {ptrabData.efetivo_empregado}</p>
          <p><strong>4. AÇÕES REALIZADAS OU A REALIZAR:</strong> {ptrabData.acoes}</p>
          <p><strong>5. DESPESAS DE MATERIAL PERMANENTE REALIZADAS OU A REALIZAR:</strong></p>
        </div>

        <table className="w-full border-collapse border border-black text-[8pt]">
          <thead>
            <tr className="bg-[#D9D9D9] font-bold text-center">
              <th rowSpan={2} className="border border-black p-1 w-[20%]">DESPESAS</th>
              <th className="border border-black p-1 w-[15%]">OM (UGE)</th>
              <th colSpan={2} className="border border-black p-1"></th>
              <th className="border border-black p-1">DETALHAMENTO / MEMÓRIA DE CÁLCULO</th>
            </tr>
            <tr className="bg-[#D9D9D9] font-bold text-center">
              <th className="border border-black p-1">CODUG</th>
              <th className="border border-black p-1 w-[12%] bg-[#E2EFDA]">44.90.52</th>
              <th className="border border-black p-1 w-[12%] bg-[#E2EFDA]">GND 4</th>
              <th className="border border-black p-1 font-normal text-[7pt] leading-tight">
                (DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>
                <span className="underline">OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i}>
                <td className="border border-black p-1 font-bold text-left align-middle">{r.itemNome}</td>
                <td className="border border-black p-1 text-center align-middle">
                  <div className="font-bold">{r.omDestino}</div>
                  <div>({formatCodug(r.ugDestino)})</div>
                </td>
                <td className="border border-black p-1 text-center align-middle bg-[#E2EFDA]">{formatCurrency(r.valor)}</td>
                <td className="border border-black p-1 text-center align-middle bg-[#E2EFDA]">{formatCurrency(r.valor)}</td>
                <td className="border border-black p-1 whitespace-pre-wrap text-[7pt] text-left align-top">{r.memoria}</td>
              </tr>
            ))}
            <tr className="bg-[#D9D9D9] font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">SOMA POR ND E GP DE DESPESA</td>
              <td className="border border-black p-1 text-center">{formatCurrency(totalGeral)}</td>
              <td className="border border-black p-1 text-center">{formatCurrency(totalGeral)}</td>
              <td className="border border-black p-1"></td>
            </tr>
            <tr className="bg-[#D9D9D9] font-bold">
              <td colSpan={2} className="border border-black p-1 text-right">VALOR TOTAL</td>
              <td colSpan={2} className="border border-black p-1 text-center">{formatCurrency(totalGeral)}</td>
              <td className="border border-black p-1"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 text-center">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="mt-12 inline-block border-t border-black pt-1 px-8">
            <p className="text-[10pt] font-bold uppercase">{ptrabData.nome_cmt_om}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTrabMaterialPermanenteReport;