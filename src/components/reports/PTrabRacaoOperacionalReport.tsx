import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug, formatDate } from "@/lib/formatUtils";
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
  generateClasseIMemoriaCalculo: typeof generateClasseIMemoriaCalculoUnificada;
}

// Função auxiliar para determinar o artigo (DO/DA)
const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalizedOmName = omName.toUpperCase().trim();

    if (normalizedOmName.includes('CMDO')) {
        return 'DO';
    }
    if (normalizedOmName.includes('ª')) {
        return 'DA';
    }
    if (normalizedOmName.includes('º')) {
        return 'DO';
    }
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
    ) {
      return 'DO';
    }
    
    return 'DA';
};


const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({
  ptrabData,
  registrosClasseI,
  fileSuffix,
  generateClasseIMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);
  
  // Filtra apenas registros de Ração Operacional
  const registrosRacaoOperacional = useMemo(() => {
    return registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL');
  }, [registrosClasseI]);
  
  // Calcula os totais gerais de Ração Operacional
  const totaisRacaoOperacional = useMemo(() => {
    let totalR2 = 0;
    let totalR3 = 0;
    
    registrosRacaoOperacional.forEach(r => {
        totalR2 += r.quantidadeR2 || 0; // Usando camelCase
        totalR3 += r.quantidadeR3 || 0; // Usando camelCase
    });
    
    return {
      totalR2,
      totalR3,
      totalGeral: totalR2 + totalR3,
    };
  }, [registrosRacaoOperacional]);
  
  // Função para gerar o nome do arquivo (reutilizada do Logístico)
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
  }, [ptrabData, fileSuffix, diasOperacao, registrosRacaoOperacional, generateClasseIMemoriaCalculo, toast]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ração Operacional');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }; 
    
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
    const corTotal = 'FFE8E8E8'; // Cinza claro para o total geral
    
    const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } };
    const totalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotal } };

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
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO CLASSE I - RAÇÃO OPERACIONAL OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`); 
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO CLASSE I - RAÇÃO OPERACIONAL'; 
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
    despesasRow.getCell('A').value = '5. DESPESAS CLASSE I - RAÇÃO OPERACIONAL:';
    despesasRow.getCell('A').font = headerFontStyle;
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    currentRow++;
    
    // Cabeçalho da Tabela
    const headerRow = worksheet.getRow(currentRow);
    headerRow.getCell('A').value = 'OM DE DESTINO';
    headerRow.getCell('B').value = 'UG';
    headerRow.getCell('C').value = 'QTD R2 (24h)';
    headerRow.getCell('D').value = 'QTD R3 (12h)';
    headerRow.getCell('E').value = 'TOTAL RAÇÕES';
    headerRow.getCell('F').value = 'MEMÓRIA DE CÁLCULO';
    
    worksheet.columns = [
        { width: 25 }, // A: OM DE DESTINO
        { width: 10 }, // B: UG
        { width: 10 }, // C: QTD R2
        { width: 10 }, // D: QTD R3
        { width: 10 }, // E: TOTAL RAÇÕES
        { width: 60 }, // F: MEMÓRIA DE CÁLCULO
    ];
    
    headerRow.height = 30;

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
        const totalRacoesLinha = (registro.quantidadeR2 || 0) + (registro.quantidadeR3 || 0); // Usando camelCase
        
        // A: OM DE DESTINO
        row.getCell('A').value = registro.organizacao; 
        row.getCell('A').alignment = leftMiddleAlignment; 
        
        // B: UG
        row.getCell('B').value = formatCodug(registro.ug);
        row.getCell('B').alignment = centerMiddleAlignment; 
        
        // C: QTD R2
        row.getCell('C').value = registro.quantidadeR2 || 0; // Usando camelCase
        row.getCell('C').alignment = centerMiddleAlignment;
        row.getCell('C').numFmt = '#,##0';
        
        // D: QTD R3
        row.getCell('D').value = registro.quantidadeR3 || 0; // Usando camelCase
        row.getCell('D').alignment = centerMiddleAlignment;
        row.getCell('D').numFmt = '#,##0';
        
        // E: TOTAL RAÇÕES
        row.getCell('E').value = totalRacoesLinha;
        row.getCell('E').alignment = centerMiddleAlignment;
        row.getCell('E').numFmt = '#,##0';
        
        // F: MEMÓRIA DE CÁLCULO
        const memoria = generateClasseIMemoriaCalculo(registro, 'OP');
        row.getCell('F').value = memoria;
        row.getCell('F').alignment = leftTopAlignment; 
        row.getCell('F').font = { name: 'Arial', size: 6.5 };
        
        // Apply base styles
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
            row.getCell(col).font = baseFontStyle;
            row.getCell(col).border = cellBorder;
        });
        currentRow++;
    });

    // Linha Total Geral
    const totalRow = worksheet.getRow(currentRow);
    
    // Mescla A até B
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalRow.getCell('A').value = 'TOTAL GERAL';
    totalRow.getCell('A').alignment = leftMiddleAlignment;
    totalRow.getCell('A').font = headerFontStyle;
    totalRow.getCell('A').fill = totalFill;
    totalRow.getCell('A').border = cellBorder;
    
    // C: Total R2
    totalRow.getCell('C').value = totaisRacaoOperacional.totalR2;
    totalRow.getCell('C').alignment = centerMiddleAlignment;
    totalRow.getCell('C').font = headerFontStyle;
    totalRow.getCell('C').fill = totalFill;
    totalRow.getCell('C').border = cellBorder;
    totalRow.getCell('C').numFmt = '#,##0';

    // D: Total R3
    totalRow.getCell('D').value = totaisRacaoOperacional.totalR3;
    totalRow.getCell('D').alignment = centerMiddleAlignment;
    totalRow.getCell('D').font = headerFontStyle;
    totalRow.getCell('D').fill = totalFill;
    totalRow.getCell('D').border = cellBorder;
    totalRow.getCell('D').numFmt = '#,##0';
    
    // E: Total Geral
    totalRow.getCell('E').value = totaisRacaoOperacional.totalGeral;
    totalRow.getCell('E').alignment = centerMiddleAlignment;
    totalRow.getCell('E').font = headerFontStyle;
    totalRow.getCell('E').fill = totalFill;
    totalRow.getCell('E').border = cellBorder;
    totalRow.getCell('E').numFmt = '#,##0';

    // F: Vazio
    totalRow.getCell('F').value = '';
    totalRow.getCell('F').alignment = centerMiddleAlignment;
    totalRow.getCell('F').font = headerFontStyle;
    totalRow.getCell('F').fill = totalFill;
    totalRow.getCell('F').border = cellBorder;

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
      description: "O relatório Ração Operacional foi salvo com sucesso.",
      duration: 3000,
    });
  }, [registrosRacaoOperacional, ptrabData, diasOperacao, fileSuffix, generateClasseIMemoriaCalculo, totaisRacaoOperacional, toast]);


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
            Plano de Trabalho Classe I - Ração Operacional Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Classe I - Ração Operacional</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS CLASSE I - RAÇÃO OPERACIONAL:</p>
        </div>

        {registrosRacaoOperacional.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table-op">
              <thead>
                <tr>
                  <th className="col-om-op">OM DE DESTINO</th>
                  <th className="col-ug-op">UG</th>
                  <th className="col-qtd-op">QTD R2 (24h)</th>
                  <th className="col-qtd-op">QTD R3 (12h)</th>
                  <th className="col-qtd-op">TOTAL RAÇÕES</th>
                  <th className="col-memoria-op">MEMÓRIA DE CÁLCULO</th>
                </tr>
            </thead>
            <tbody>
              {registrosRacaoOperacional.map((registro) => {
                const totalRacoesLinha = (registro.quantidadeR2 || 0) + (registro.quantidadeR3 || 0); // Usando camelCase
                
                return (
                    <tr key={registro.id} className="expense-row">
                      <td className="col-om-op text-left"> 
                        {registro.organizacao}
                      </td>
                      <td className="col-ug-op">
                        {formatCodug(registro.ug)}
                      </td>
                      <td className="col-qtd-op">
                        {formatNumber(registro.quantidadeR2 || 0, 0)}
                      </td>
                      <td className="col-qtd-op">
                        {formatNumber(registro.quantidadeR3 || 0, 0)}
                      </td>
                      <td className="col-qtd-op font-bold">
                        {formatNumber(totalRacoesLinha, 0)}
                      </td>
                      <td className="col-memoria-op">
                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {generateClasseIMemoriaCalculo(registro, 'OP')}
                        </div>
                      </td>
                    </tr>
                );
              })}
              
              {/* Linha Total Geral */}
              <tr className="total-geral-final-row">
                <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>
                    TOTAL GERAL
                </td>
                <td className="col-qtd-op text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>
                    {formatNumber(totaisRacaoOperacional.totalR2, 0)}
                </td>
                <td className="col-qtd-op text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>
                    {formatNumber(totaisRacaoOperacional.totalR3, 0)}
                </td>
                <td className="col-qtd-op text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>
                    {formatNumber(totaisRacaoOperacional.totalGeral, 0)}
                </td>
                <td style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td> {/* Coluna F vazia */}
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro de Ração Operacional cadastrado.</p>
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
        .ptrab-table-op { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table-op thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        .ptrab-table-op th, .ptrab-table-op td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-om-op { width: 25%; text-align: center; vertical-align: middle; } 
        .col-ug-op { width: 10%; text-align: center; vertical-align: middle; }
        .col-qtd-op { width: 10%; text-align: center; vertical-align: middle; }
        .col-memoria-op { width: 45%; text-align: left; vertical-align: top; }
        
        /* Estilos para Total Geral */
        .total-geral-final-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #E8E8E8; /* Cinza Claro */
        }
        .total-geral-final-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
        }
        .total-geral-final-row td:nth-child(1) { /* Colspan 2 */
            text-align: right;
            background-color: #E8E8E8 !important;
        }
        
        /* AJUSTE DE ALINHAMENTO DO RODAPÉ */
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-table-op thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table-op th, .ptrab-table-op td { border: 0.25pt solid #000 !important; } 
          .ptrab-table-op { border: 0.25pt solid #000 !important; }
          
          .total-geral-final-row td {
              background-color: #E8E8E8 !important;
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