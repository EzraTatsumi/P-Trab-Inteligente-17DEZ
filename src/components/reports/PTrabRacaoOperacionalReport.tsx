import React, { useCallback, useRef } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PTrabData, 
  ClasseIRegistro, 
  calculateDays,
  generateClasseIMemoriaCalculoUnificada, // Importação corrigida
} from "@/pages/PTrabReportManager"; 

interface PTrabRacaoOperacionalReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  fileSuffix: string;
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
}

const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({
  ptrabData,
  registrosClasseI,
  fileSuffix,
  generateClasseIMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const registrosRacaoOperacional = registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL');

  // Função para gerar o nome do arquivo (reutilizada)
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    
    if (isMinuta) {
        nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    }
    
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  // Função para exportar PDF (Download)
  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;

    const pdfToast = toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto o relatório é processado.",
    });

    html2canvas(contentRef.current, {
      scale: 3, 
      useCORS: true,
      allowTaint: true,
    }).then((canvas) => {
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
        position = heightLeft - imgWidth + margin; 
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
      toast({
        title: "PDF Exportado!",
        description: "O P Trab Ração Operacional foi salvo com sucesso.",
        duration: 3000,
      });
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      pdfToast.dismiss();
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    });
  }, [ptrabData, fileSuffix, toast]);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ração Operacional');

    // --- Definição de Estilos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; 
    const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } }; 
    
    let currentRow = 1;
    
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        currentRow++;
    };
    
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    addHeaderRow((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase());
    addHeaderRow(`PLANO DE TRABALHO CLASSE I - RAÇÃO OPERACIONAL - OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`);
    addHeaderRow('PLANO DE TRABALHO CLASSE I - RAÇÃO OPERACIONAL');
    
    currentRow++;
    
    const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = {
          richText: [
            { text: label, font: headerFontStyle },
            { text: ` ${value}`, font: { name: 'Arial', size: 9, bold: false } }
          ]
        };
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        currentRow++;
    };
    
    addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfoRow('2. PERÍODO:', `de ${ptrabData.periodo_inicio} a ${ptrabData.periodo_fim} - Nr Dias: ${diasOperacao}`);
    addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado}`);
    addInfoRow('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    
    const despesasRow = worksheet.getRow(currentRow);
    despesasRow.getCell(1).value = '5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:';
    despesasRow.getCell(1).font = headerFontStyle;
    currentRow++;
    
    // Tabela Header
    const headerRow = worksheet.getRow(currentRow);
    headerRow.height = 30;
    headerRow.getCell('A').value = 'OM FAVORECIDA';
    headerRow.getCell('B').value = 'UG';
    headerRow.getCell('C').value = 'FASE DA ATIVIDADE';
    headerRow.getCell('D').value = 'DIAS';
    headerRow.getCell('E').value = 'QTD R2 (24h)';
    headerRow.getCell('F').value = 'QTD R3 (12h)';
    
    worksheet.columns = [
        { width: 20 }, // A: OM FAVORECIDA
        { width: 10 }, // B: UG
        { width: 25 }, // C: FASE DA ATIVIDADE
        { width: 8 },  // D: DIAS
        { width: 10 }, // E: QTD R2
        { width: 10 }, // F: QTD R3
    ];
    
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        const cell = headerRow.getCell(col);
        cell.font = headerFontStyle;
        cell.alignment = centerMiddleAlignment;
        cell.border = cellBorder;
        cell.fill = headerFillGray;
    });
    
    currentRow++;

    // Dados da Tabela
    registrosRacaoOperacional.forEach(registro => {
        const row = worksheet.getRow(currentRow);
        
        row.getCell('A').value = registro.organizacao;
        row.getCell('B').value = registro.ug;
        row.getCell('C').value = formatFasesParaTexto(registro.faseAtividade); // CORRIGIDO: fase_atividade -> faseAtividade
        row.getCell('D').value = registro.diasOperacao; // CORRIGIDO: dias_operacao -> diasOperacao
        row.getCell('E').value = registro.quantidadeR2; // CORRIGIDO: quantidade_r2 -> quantidadeR2
        row.getCell('F').value = registro.quantidadeR3; // CORRIGIDO: quantidade_r3 -> quantidadeR3
        
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
            const cell = row.getCell(col);
            cell.font = baseFontStyle;
            cell.alignment = centerMiddleAlignment;
            cell.border = cellBorder;
        });
        
        // Alinhamento específico para OM e Detalhamento
        row.getCell('A').alignment = leftTopAlignment;
        row.getCell('C').alignment = leftTopAlignment;
        
        currentRow++;
    });
    
    // Linha de Total
    const totalR2 = registrosRacaoOperacional.reduce((sum, r) => sum + (r.quantidadeR2 || 0), 0); // CORRIGIDO
    const totalR3 = registrosRacaoOperacional.reduce((sum, r) => sum + (r.quantidadeR3 || 0), 0); // CORRIGIDO
    const totalGeral = totalR2 + totalR3;
    
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell('A').value = 'TOTAL GERAL DE RAÇÕES OPERACIONAIS';
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    totalRow.getCell('A').alignment = centerMiddleAlignment;
    totalRow.getCell('A').font = headerFontStyle;
    totalRow.getCell('A').border = cellBorder;
    totalRow.getCell('A').fill = headerFillGray;
    
    totalRow.getCell('E').value = totalR2;
    totalRow.getCell('E').alignment = centerMiddleAlignment;
    totalRow.getCell('E').font = headerFontStyle;
    totalRow.getCell('E').border = cellBorder;
    totalRow.getCell('E').fill = headerFillGray;
    
    totalRow.getCell('F').value = totalR3;
    totalRow.getCell('F').alignment = centerMiddleAlignment;
    totalRow.getCell('F').font = headerFontStyle;
    totalRow.getCell('F').border = cellBorder;
    totalRow.getCell('F').fill = headerFillGray;
    
    currentRow++;
    
    // Rodapé (Memória de Cálculo Consolidada)
    const memoriaRow = worksheet.getRow(currentRow);
    memoriaRow.getCell('A').value = 'MEMÓRIA DE CÁLCULO CONSOLIDADA:';
    memoriaRow.getCell('A').font = headerFontStyle;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow++;
    
    registrosRacaoOperacional.forEach(registro => {
        const memoria = generateClasseIMemoriaCalculo(registro, 'OP');
        const row = worksheet.getRow(currentRow);
        row.getCell('A').value = memoria;
        row.getCell('A').alignment = leftTopAlignment;
        row.getCell('A').font = { name: 'Arial', size: 6.5 };
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        currentRow++;
    });

    // Exportar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName('Excel');
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Excel Exportado!",
      description: "O relatório Ração Operacional foi salvo com sucesso.",
      duration: 3000,
    });
  }, [registrosRacaoOperacional, ptrabData, diasOperacao, fileSuffix, generateClasseIMemoriaCalculo, toast]);


  if (registrosRacaoOperacional.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <Utensils className="h-5 w-5" />
            P Trab Classe I - Ração Operacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro de Ração Operacional encontrado para este P Trab.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botões de Exportação/Impressão padronizados */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        <Button onClick={exportExcel} variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
        <Button onClick={() => window.print()} variant="default">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Conteúdo do Relatório (para impressão) */}
      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">
            Plano de Trabalho Classe I - Ração Operacional - Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Classe I - Ração Operacional</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:</p>
        </div>

        {registrosRacaoOperacional.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table-op">
              <thead>
                <tr>
                  <th className="col-om-op">OM FAVORECIDA</th>
                  <th className="col-ug-op">UG</th>
                  <th className="col-fase-op">FASE DA ATIVIDADE</th>
                  <th className="col-dias-op">DIAS</th>
                  <th className="col-qtd-op">QTD R2 (24h)</th>
                  <th className="col-qtd-op">QTD R3 (12h)</th>
                </tr>
            </thead>
            <tbody>
              {registrosRacaoOperacional.map((registro) => (
                <tr key={registro.id} className="expense-row">
                  <td className="col-om-op text-left">
                    <div>{registro.organizacao}</div>
                  </td>
                  <td className="col-ug-op">
                    <div>{registro.ug}</div>
                  </td>
                  <td className="col-fase-op text-left">
                    {formatFasesParaTexto(registro.faseAtividade)}
                  </td>
                  <td className="col-dias-op">
                    {registro.diasOperacao}
                  </td>
                  <td className="col-qtd-op">
                    {registro.quantidadeR2}
                  </td>
                  <td className="col-qtd-op">
                    {registro.quantidadeR3}
                  </td>
                </tr>
              ))}
              
              {/* Linha de Total */}
              <tr className="total-geral-final-row">
                <td colSpan={4} className="text-center font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    TOTAL GERAL DE RAÇÕES OPERACIONAIS
                </td>
                <td className="col-qtd-op text-center font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    {totalR2}
                </td>
                <td className="col-qtd-op text-center font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    {totalR3}
                </td>
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro de Ração Operacional cadastrado.</p>
        )}
        
        {/* Memória de Cálculo Consolidada */}
        <div className="ptrab-info mt-8 print-avoid-break">
            <p className="info-item font-bold underline">MEMÓRIA DE CÁLCULO CONSOLIDADA:</p>
            <div className="space-y-4">
                {registrosRacaoOperacional.map((registro) => (
                    <div key={registro.id} className="border p-3 rounded-md bg-muted/50 print:bg-transparent print:border-none">
                        <div style={{ fontSize: '8pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {generateClasseIMemoriaCalculo(registro, 'OP')}
                        </div>
                    </div>
                ))}
            </div>
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
        @page {
          size: A4 landscape;
          margin: 0.5cm;
        }
        
        /* REGRAS DE ESTILO UNIFICADAS (TELA E IMPRESSÃO) */
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; } 
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table-op { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table-op th, .ptrab-table-op td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table-op thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-om-op { width: 25%; text-align: center; vertical-align: middle; } 
        .col-ug-op { width: 10%; text-align: center; vertical-align: middle; }
        .col-fase-op { width: 35%; text-align: center; vertical-align: middle; }
        .col-dias-op { width: 10%; text-align: center; vertical-align: middle; }
        .col-qtd-op { width: 10%; text-align: center; vertical-align: middle; }
        
        .total-geral-final-row td {
            background-color: #D9D9D9 !important;
        }
        
        /* AJUSTE DE ALINHAMENTO DO RODAPÉ */
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-table-op th, .ptrab-table-op td { border: 0.25pt solid #000 !important; } 
          .ptrab-table-op { border: 0.25pt solid #000 !important; }
          
          .total-geral-final-row td {
              background-color: #D9D9D9 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          .print-avoid-break {
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PTrabRacaoOperacionalReport;