import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PTrabData,
  calculateDays,
  formatDate,
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager
import { DiariaRegistro } from "@/pages/DiariaForm"; // Importar o tipo DiariaRegistro

interface PTrabDiariaReportProps {
  ptrabData: PTrabData;
  registrosDiaria: DiariaRegistro[];
  fileSuffix: string;
}

// Interface para a linha consolidada de Diária (para a tabela)
interface DiariaLinha {
    om: string;
    ug: string;
    local_atividade: string;
    dias_operacao: number;
    nr_viagens: number;
    total_militares: number;
    valor_diaria_base: number; // ND 15 (Diária)
    valor_taxa_embarque: number; // ND 15 (Taxa)
    valor_total: number; // Total ND 15
    detalhamento: string;
    detalhamento_customizado: string | null;
}

const PTrabDiariaReport: React.FC<PTrabDiariaReportProps> = ({
  ptrabData,
  registrosDiaria,
  fileSuffix,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const diariasConsolidadas: DiariaLinha[] = useMemo(() => {
    return registrosDiaria.map(r => {
        const totalDiariaBase = (r.valor_total || 0) - (r.valor_taxa_embarque || 0);
        
        return {
            om: r.organizacao,
            ug: r.ug,
            local_atividade: r.local_atividade || 'Local Desconhecido',
            dias_operacao: r.dias_operacao,
            nr_viagens: r.nr_viagens,
            total_militares: r.quantidade,
            valor_diaria_base: totalDiariaBase,
            valor_taxa_embarque: r.valor_taxa_embarque || 0,
            valor_total: r.valor_total || 0,
            detalhamento: r.detalhamento || '',
            detalhamento_customizado: r.detalhamento_customizado || null,
        };
    }).sort((a, b) => a.om.localeCompare(b.om));
  }, [registrosDiaria]);
  
  const totalDiariasGeral = diariasConsolidadas.reduce((sum, r) => sum + r.valor_total, 0);
  
  // Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    
    if (ptrabData.numero_ptrab.startsWith("Minuta")) {
        const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
        nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    }
    
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  // Função para exportar PDF (Download)
  const handleExportPdf = useCallback(() => {
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
      
      // A4 em Paisagem: 297mm (largura) x 210mm (altura)
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
      toast({
        title: "PDF Exportado!",
        description: "O relatório de Diárias foi salvo com sucesso.",
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
  }, [ptrabData, diariasConsolidadas, toast, fileSuffix]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);


  const exportExcel = useCallback(async () => {
    if (diariasConsolidadas.length === 0) {
        toast({ title: "Aviso", description: "Não há dados de Diárias para exportar.", variant: "default" });
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Diárias');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; // Cinza claro para o cabeçalho da tabela
    const corTotalA = 'FFD9D9D9'; // Cinza para o total (Célula A+B)
    const corTotalC = 'FFB4C7E7'; // Azul para a quantidade (Célula C)
    const corTotalD = 'FFFFFFFF'; // Branco para o detalhamento (Célula D)
    // -------------------------------------------

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
    
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow++;
    
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO LOGÍSTICO - Pagamento de Diárias';
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow++;
    
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
    addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
    addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado}`);
    addInfoRow('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    
    const despesasRow = worksheet.getRow(currentRow);
    despesasRow.getCell(1).value = '5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:';
    despesasRow.getCell(1).font = headerFontStyle;
    currentRow++;
    
    // Cabeçalho da Tabela (6 colunas)
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell('A').value = 'DESPESAS (ND 33.90.15)';
    headerRow.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow.getCell('C').value = 'LOCAL / PERÍODO';
    headerRow.getCell('D').value = 'VALOR TOTAL\n(R$)';
    headerRow.getCell('E').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, VALORES UNITÁRIOS E TOTAIS)';
    
    worksheet.columns = [
        { width: 25 }, // A - DESPESAS
        { width: 15 }, // B - OM (UGE) CODUG
        { width: 25 }, // C - LOCAL / PERÍODO
        { width: 15 }, // D - VALOR TOTAL (R$)
        { width: 80 }, // E - DETALHAMENTO
    ];
    
    // Mesclagem da coluna E (Detalhamento)
    worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
    
    ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        const cell = headerRow.getCell(col);
        cell.style = {
            font: headerFontStyle,
            alignment: centerMiddleAlignment,
            border: cellBorder,
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } }
        };
    });
    currentRow++;

    // Dados da Tabela
    diariasConsolidadas.forEach(linha => {
        const row = worksheet.getRow(currentRow);
        
        // A: DESPESAS
        row.getCell('A').value = `Pagamento de Diárias`;
        row.getCell('A').alignment = leftMiddleAlignment;
        
        // B: OM (UGE) CODUG
        row.getCell('B').value = `${linha.om}\n(${formatCodug(linha.ug)})`;
        row.getCell('B').alignment = centerMiddleAlignment;
        
        // C: LOCAL / PERÍODO
        row.getCell('C').value = `${linha.local_atividade}\n${linha.dias_operacao} dias x ${linha.nr_viagens} viagens`;
        row.getCell('C').alignment = leftTopAlignment;
        
        // D: VALOR TOTAL (R$)
        row.getCell('D').value = linha.valor_total;
        row.getCell('D').alignment = rightMiddleAlignment;
        row.getCell('D').numFmt = 'R$ #,##0.00';
        
        // E: DETALHAMENTO
        row.getCell('E').value = linha.detalhamento_customizado || linha.detalhamento;
        row.getCell('E').alignment = leftTopAlignment;
        row.getCell('E').font = { name: 'Arial', size: 6.5 };
        
        // Mesclagem da coluna E (Detalhamento)
        worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
        
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
            row.getCell(col).border = cellBorder;
            row.getCell(col).font = baseFontStyle;
        });
        currentRow++;
    });
    
    // Linha de Total
    const totalRow = worksheet.getRow(currentRow);
    
    // Célula A+B+C (Cinza)
    totalRow.getCell('A').value = 'TOTAL GERAL';
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    totalRow.getCell('A').alignment = rightMiddleAlignment;
    totalRow.getCell('A').font = headerFontStyle;
    totalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalA } };
    totalRow.getCell('A').border = cellBorder;
    
    // Célula D (Valor Total)
    totalRow.getCell('D').value = totalDiariasGeral;
    totalRow.getCell('D').alignment = rightMiddleAlignment;
    totalRow.getCell('D').font = headerFontStyle;
    totalRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalA } };
    totalRow.getCell('D').border = cellBorder;
    totalRow.getCell('D').numFmt = 'R$ #,##0.00';
    
    // Célula E (Mesclada)
    worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
    totalRow.getCell('E').value = '';
    totalRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalD } };
    totalRow.getCell('E').border = cellBorder;

    currentRow++;
    
    currentRow++;
    
    // Rodapé
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    localRow.getCell('A').font = { name: 'Arial', size: 10 };
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow += 3;
    
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
    cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow++;
    
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
    cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);

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
      description: "O relatório de Diárias foi salvo com sucesso.",
      duration: 3000,
    });
  }, [diariasConsolidadas, ptrabData, diasOperacao, toast, fileSuffix]);


  if (diariasConsolidadas.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <Briefcase className="h-5 w-5" />
            Pagamento de Diárias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro de Diária encontrado para este P Trab.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botões de Exportação/Impressão padronizados */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={handleExportPdf} variant="outline">
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

      {/* Conteúdo do Relatório (para impressão) */}
      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">
            Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico - Pagamento de Diárias</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        {diariasConsolidadas.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table-diaria">
              <thead>
                <tr>
                  <th className="col-despesas-diaria">DESPESAS (ND 33.90.15)</th>
                  <th className="col-om-diaria">OM (UGE)<br/>CODUG</th>
                  <th className="col-local-diaria">LOCAL / PERÍODO</th>
                  <th className="col-valor-diaria">VALOR TOTAL<br/>(R$)</th>
                  <th className="col-detalhamento-diaria" colSpan={2}>DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, VALORES UNITÁRIOS E TOTAIS)</th>
                </tr>
            </thead>
            <tbody>
              {diariasConsolidadas.map((linha, index) => (
                <tr key={index}>
                  <td className="col-despesas-diaria">
                    Pagamento de Diárias
                  </td>
                  <td className="col-om-diaria">
                    <div>{linha.om}</div>
                    <div>({formatCodug(linha.ug)})</div>
                  </td>
                  <td className="col-local-diaria">
                    <div>{linha.local_atividade}</div>
                    <div className="text-[7pt] mt-1">
                        {linha.total_militares} militares x {linha.dias_operacao} dias x {linha.nr_viagens} viagens
                    </div>
                  </td>
                  <td className="col-valor-diaria">
                    {formatCurrency(linha.valor_total)}
                  </td>
                  <td className="col-detalhamento-diaria" colSpan={2} style={{ fontSize: '6.5pt' }}>
                    <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                      {linha.detalhamento_customizado || linha.detalhamento}
                    </pre>
                  </td>
                </tr>
              ))}
              
              {/* Linha de Total - Estilos aplicados inline */}
              <tr className="total-row-diaria">
                <td 
                  colSpan={3} 
                  className="text-right font-bold" 
                  style={{ 
                    backgroundColor: '#D9D9D9', 
                    color: '#000', 
                    border: '1px solid #000',
                    fontWeight: 'bold',
                  }}
                >
                  TOTAL GERAL
                </td>
                <td 
                  className="text-center font-bold" 
                  style={{ 
                    backgroundColor: '#D9D9D9', 
                    color: '#000', 
                    border: '1px solid #000',
                    fontWeight: 'bold',
                  }}
                >
                  {formatCurrency(totalDiariasGeral)}
                </td>
                <td 
                  colSpan={2}
                  style={{ 
                    backgroundColor: '#FFFFFF', 
                    color: '#000', 
                    border: '1px solid #000',
                  }}
                >
                </td>
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro de Diária cadastrado.</p>
        )}

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
        .ptrab-table-diaria { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table-diaria th, .ptrab-table-diaria td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table-diaria thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-despesas-diaria { width: 20%; text-align: left; }
        .col-om-diaria { width: 15%; text-align: center; }
        .col-local-diaria { width: 20%; text-align: left; }
        .col-valor-diaria { width: 15%; text-align: center; }
        .col-detalhamento-diaria { width: 30%; text-align: left; }
        
        .total-row-diaria { page-break-inside: avoid; font-weight: bold; } 
        
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO (MANTIDAS PARA GARANTIR O COMPORTAMENTO NATIVO) */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-table-diaria thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table-diaria th, .ptrab-table-diaria td { border: 0.25pt solid #000 !important; } 
          .ptrab-table-diaria { border: 0.25pt solid #000 !important; }
          .ptrab-table-diaria td { vertical-align: top !important; } 
          
          .print-avoid-break {
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PTrabDiariaReport;