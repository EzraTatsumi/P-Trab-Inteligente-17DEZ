import React, { useCallback, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PTrabData,
  ClasseIRegistro,
  calculateDays,
  formatDate,
  formatFasesParaTexto,
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager

interface PTrabRacaoOperacionalReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  onExportSuccess: () => void;
}

const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({
  ptrabData,
  registrosClasseI,
  onExportSuccess,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const racaoOperacionalRegistros = useMemo(() => {
    return registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL' && ((r.quantidade_r2 || 0) > 0 || (r.quantidade_r3 || 0) > 0));
  }, [registrosClasseI]);
  
  const totalRacoes = racaoOperacionalRegistros.reduce((sum, r) => sum + (r.quantidade_r2 || 0) + (r.quantidade_r3 || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const exportPDF = useCallback(async () => {
    const element = contentRef.current;
    if (!element) return;

    try {
      const header = document.querySelector('.print\\:hidden');
      if (header) header.classList.add('hidden');

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: true,
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait', // Portrait para este relatório
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth; 

      const scaledImgHeight = imgHeight * ratio;

      let position = 0;
      const pageHeight = pdfHeight;

      while (position < scaledImgHeight) {
        if (position > 0) {
          pdf.addPage();
        }
        pdf.addImage(
          imgData,
          'PNG',
          0,
          -position,
          pdfWidth,
          scaledImgHeight
        );
        position += pageHeight;
      }

      const fileName = `PTrab_Racao_Op_${ptrabData?.numero_ptrab}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF gerado com sucesso!",
        description: `Arquivo ${fileName} foi baixado.`,
        duration: 3000,
      });

      if (header) header.classList.remove('hidden');
      onExportSuccess();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível exportar o documento. Verifique o console para detalhes.",
        variant: "destructive",
      });
    }
  }, [ptrabData, onExportSuccess, toast]);

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ração Operacional');
      
      worksheet.columns = [
        { width: 30 }, // A - OM
        { width: 15 }, // B - UG
        { width: 15 }, // C - Efetivo
        { width: 15 }, // D - Dias
        { width: 20 }, // E - Fase
        { width: 15 }, // F - R2 (24h)
        { width: 15 }, // G - R3 (12h)
        { width: 15 }, // H - Total Unidades
      ];
      
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').value = `RELATÓRIO DE RAÇÃO OPERACIONAL - P TRAB ${ptrabData.numero_ptrab}`;
      worksheet.getCell('A1').font = { name: 'Arial', size: 12, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      const headerRow = worksheet.getRow(3);
      headerRow.values = ['OM de Destino', 'UG', 'Efetivo', 'Dias', 'Fase da Atividade', 'R2 (24h)', 'R3 (12h)', 'Total Unidades'];
      headerRow.font = { name: 'Arial', size: 10, bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      
      let currentRow = 4;
      
      racaoOperacionalRegistros.forEach(r => {
        const row = worksheet.getRow(currentRow);
        row.getCell('A').value = r.organizacao;
        row.getCell('B').value = r.ug;
        row.getCell('C').value = r.efetivo;
        row.getCell('D').value = r.dias_operacao;
        row.getCell('E').value = formatFasesParaTexto(r.fase_atividade);
        row.getCell('F').value = r.quantidade_r2;
        row.getCell('G').value = r.quantidade_r3;
        row.getCell('H').value = (r.quantidade_r2 || 0) + (r.quantidade_r3 || 0);
        
        row.font = { name: 'Arial', size: 9 };
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell('A').alignment = { horizontal: 'left', vertical: 'middle' };
        
        currentRow++;
      });
      
      const totalRow = worksheet.getRow(currentRow + 1);
      totalRow.getCell('G').value = 'TOTAL GERAL:';
      totalRow.getCell('G').font = { name: 'Arial', size: 10, bold: true };
      totalRow.getCell('G').alignment = { horizontal: 'right' };
      totalRow.getCell('H').value = totalRacoes;
      totalRow.getCell('H').font = { name: 'Arial', size: 10, bold: true };
      totalRow.getCell('H').alignment = { horizontal: 'center' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PTrab_Racao_Op_${ptrabData.numero_ptrab}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Excel gerado com sucesso!",
        description: `Arquivo exportado com quantitativos de Ração Operacional.`,
      });
      onExportSuccess();
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast({
        title: "Erro ao gerar Excel",
        description: "Não foi possível exportar o documento. Verifique o console para detalhes.",
        variant: "destructive",
      });
    }
  }, [ptrabData, racaoOperacionalRegistros, totalRacoes, onExportSuccess, toast]);


  return (
    <div className="space-y-6">
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

      <Card className="p-6 print:p-0 print:border-none print:shadow-none" ref={contentRef}>
        <CardHeader className="print:p-0 print:mb-4">
          <CardTitle className="flex items-center gap-2 text-xl print:text-lg print:font-bold">
            <Utensils className="h-5 w-5 text-secondary print:hidden" />
            Relatório de Ração Operacional (R2/R3)
          </CardTitle>
          <p className="text-sm text-muted-foreground print:text-[10pt] print:text-black">
            P Trab: {ptrabData.numero_ptrab} - {ptrabData.nome_operacao} | Período: {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} ({diasOperacao} dias)
          </p>
        </CardHeader>
        <CardContent className="pt-4 print:p-0">
          {racaoOperacionalRegistros.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-300 print:border-black print:text-[8pt] print:w-full">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200">
                    <th className="p-2 border border-gray-300 print:border-black text-left">OM de Destino (UG)</th>
                    <th className="p-2 border border-gray-300 print:border-black text-center">Efetivo</th>
                    <th className="p-2 border border-gray-300 print:border-black text-center">Dias</th>
                    <th className="p-2 border border-gray-300 print:border-black text-left">Fase da Atividade</th>
                    <th className="p-2 border border-gray-300 print:border-black text-center">R2 (24h)</th>
                    <th className="p-2 border border-gray-300 print:border-black text-center">R3 (12h)</th>
                    <th className="p-2 border border-gray-300 print:border-black text-center font-bold">Total Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {racaoOperacionalRegistros.map((r) => (
                    <tr key={r.id} className="even:bg-gray-50 print:even:bg-gray-100">
                      <td className="p-2 border border-gray-300 print:border-black">
                        {r.organizacao} ({r.ug})
                      </td>
                      <td className="p-2 border border-gray-300 print:border-black text-center">
                        {formatNumber(r.efetivo || 0)}
                      </td>
                      <td className="p-2 border border-gray-300 print:border-black text-center">
                        {r.dias_operacao}
                      </td>
                      <td className="p-2 border border-gray-300 print:border-black">
                        {formatFasesParaTexto(r.fase_atividade)}
                      </td>
                      <td className="p-2 border border-gray-300 print:border-black text-center">
                        {formatNumber(r.quantidade_r2 || 0)}
                      </td>
                      <td className="p-2 border border-gray-300 print:border-black text-center">
                        {formatNumber(r.quantidade_r3 || 0)}
                      </td>
                      <td className="p-2 border border-gray-300 print:border-black text-center font-bold">
                        {formatNumber((r.quantidade_r2 || 0) + (r.quantidade_r3 || 0))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-200 print:bg-gray-300 font-bold">
                    <td colSpan={6} className="p-2 border border-gray-300 print:border-black text-right">
                      TOTAL GERAL DE RAÇÕES OPERACIONAIS:
                    </td>
                    <td className="p-2 border border-gray-300 print:border-black text-center">
                      {formatNumber(totalRacoes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum registro de Ração Operacional cadastrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PTrabRacaoOperacionalReport;