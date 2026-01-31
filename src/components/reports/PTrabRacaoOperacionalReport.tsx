import React, { useRef, useCallback, useMemo } from "react";
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
  generateClasseIMemoriaCalculoUnificada, // Corrigido o nome da função
} from "@/pages/PTrabReportManager"; 

interface PTrabRacaoOperacionalReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  fileSuffix: string;
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
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
  
  const registrosRacaoOperacional = useMemo(() => {
    return registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL');
  }, [registrosClasseI]);
  
  const totaisGerais = useMemo(() => {
    let totalR2 = 0;
    let totalR3 = 0;
    let totalValor = 0;
    
    registrosRacaoOperacional.forEach(r => {
        totalR2 += r.quantidade_r2;
        totalR3 += r.quantidade_r3;
        totalValor += r.total_geral;
    });
    
    return {
        totalR2,
        totalR3,
        totalValor,
    };
  }, [registrosRacaoOperacional]);

  // Função para gerar o nome do arquivo
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
        position = heightLeft - contentHeight; 
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
  }, [ptrabData, totaisGerais, fileSuffix, diasOperacao, toast]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Ração Operacional');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const rightMiddleAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle', wrapText: true };
    const leftTopAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'top', wrapText: true };
    const leftMiddleAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true }; 
    
    const dataCenterMiddleAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    
    const cellBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    
    const baseFontStyle: Partial<ExcelJS.Font> = { name: 'Arial', size: 8 };
    const headerFontStyle: Partial<ExcelJS.Font> = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const titleFontStyle: Partial<ExcelJS.Font> = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; // Cinza claro para o cabeçalho da tabela
    const corND = 'FFB4C7E7'; // Azul para as NDs
    const corGrandTotal = 'FFD9D9D9'; // Cinza para o total geral
    
    const headerFillGray: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } };
    const headerFillAzul: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
    const totalGeralFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } };

    let currentRow = 1;
    
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
    };
    
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    currentRow++;
    
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO CLASSE I - RAÇÃO OPERACIONAL DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO CLASSE I - RAÇÃO OPERACIONAL';
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
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
        
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
    };
    
    addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
    addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado}`);
    addInfoRow('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
    
    const despesasRow = worksheet.getRow(currentRow);
    despesasRow.getCell(1).value = '5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:';
    despesasRow.getCell(1).font = headerFontStyle;
    currentRow++;
    
    const headerRow1 = worksheet.getRow(currentRow);
    headerRow1.getCell('A').value = 'CLASSE';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO';
    
    worksheet.mergeCells(`A${currentRow}:A${currentRow+1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow+1}`);
    worksheet.mergeCells(`C${currentRow}:H${currentRow}`);
    worksheet.mergeCells(`I${currentRow}:I${currentRow+1}`);
    
    const headerRow2 = worksheet.getRow(currentRow + 1);
    headerRow2.getCell('C').value = '33.90.30';
    headerRow2.getCell('D').value = '33.90.39';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.00';
    headerRow2.getCell('G').value = '33.90.00';
    headerRow2.getCell('H').value = 'GND 3';
    
    worksheet.columns = [
        { width: 15 }, // A: CLASSE
        { width: 15 }, // B: OM (UGE) CODUG
        { width: 10 }, // C: 33.90.30
        { width: 10 }, // D: 33.90.39
        { width: 10 }, // E: 33.90.33
        { width: 10 }, // F: 33.90.00
        { width: 10 }, // G: 33.90.00
        { width: 10 }, // H: GND 3
        { width: 50 }, // I: DETALHAMENTO
    ];
    
    // Ajustar altura das linhas
    headerRow1.height = 45;
    headerRow2.height = 35;

    // Apply styles to header rows
    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    
    headerCols.forEach(col => {
        const cell1 = headerRow1.getCell(col);
        cell1.font = headerFontStyle;
        cell1.alignment = centerMiddleAlignment;
        cell1.border = cellBorder;
        
        const cell2 = headerRow2.getCell(col);
        cell2.font = headerFontStyle;
        cell2.alignment = centerMiddleAlignment;
        cell2.border = cellBorder;

        if (col === 'A' || col === 'B' || col === 'I') {
            cell1.fill = headerFillGray;
            cell2.value = '';
            cell2.fill = headerFillGray;
        } else {
            cell1.fill = headerFillGray;
            cell2.fill = headerFillAzul;
        }
    });
    
    // Reaplicar valores para garantir que não sejam perdidos
    headerRow1.getCell('A').value = 'CLASSE';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO';
    
    headerRow2.getCell('C').value = '33.90.30';
    headerRow2.getCell('D').value = '33.90.39';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.00';
    headerRow2.getCell('G').value = '33.90.00';
    headerRow2.getCell('H').value = 'GND 3';
    
    currentRow += 2; // Start data rows after the two header rows

    // Dados da Tabela
    registrosRacaoOperacional.forEach(registro => {
        const row = worksheet.getRow(currentRow);
        
        // A: CLASSE
        row.getCell('A').value = `CLASSE I (Ração Operacional)`; 
        row.getCell('A').alignment = leftMiddleAlignment; 
        
        // B: OM (UGE) CODUG
        row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
        row.getCell('B').alignment = dataCenterMiddleAlignment; 
        
        // C: 33.90.30
        row.getCell('C').value = registro.total_geral;
        row.getCell('C').alignment = dataCenterMiddleAlignment;
        row.getCell('C').numFmt = 'R$ #,##0.00';
        row.getCell('C').fill = headerFillAzul;
        
        // D, E, F, G (0)
        ['D', 'E', 'F', 'G'].forEach(col => {
            row.getCell(col).value = 0;
            row.getCell(col).alignment = dataCenterMiddleAlignment;
            row.getCell(col).numFmt = 'R$ #,##0.00';
            row.getCell(col).fill = headerFillAzul;
        });
        
        // H: GND 3 (Total da linha)
        row.getCell('H').value = registro.total_geral;
        row.getCell('H').alignment = dataCenterMiddleAlignment;
        row.getCell('H').numFmt = 'R$ #,##0.00';
        row.getCell('H').fill = headerFillAzul;
        
        // I: DETALHAMENTO
        // CORRIGIDO: Usando memoriaCalculoOpCustomizada
        const memoria = generateClasseIMemoriaCalculo(registro, 'OP');
        row.getCell('I').value = memoria;
        row.getCell('I').alignment = leftTopAlignment; 
        row.getCell('I').font = { name: 'Arial', size: 6.5 };
        
        // Apply base styles
        ['A', 'B', 'I'].forEach(col => {
            row.getCell(col).font = baseFontStyle;
        });
        
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            row.getCell(col).border = cellBorder;
        });
        currentRow++;
    });

    // Linha em branco para espaçamento
    currentRow++;
    
    // ========== TOTAL GERAL ==========
    
    // Linha 1: SOMA POR ND E GP DE DESPESA
    const totalGeralSomaRow = worksheet.getRow(currentRow);
    totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = totalGeralFill;
    totalGeralSomaRow.getCell('A').border = cellBorder;

    // Células C, D, E, F, G, H (NDs - Cinza)
    totalGeralSomaRow.getCell('C').value = totaisGerais.totalValor;
    totalGeralSomaRow.getCell('D').value = 0;
    totalGeralSomaRow.getCell('E').value = 0;
    totalGeralSomaRow.getCell('F').value = 0;
    totalGeralSomaRow.getCell('G').value = 0;
    totalGeralSomaRow.getCell('H').value = totaisGerais.totalValor;

    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        const cell = totalGeralSomaRow.getCell(col);
        cell.alignment = centerMiddleAlignment;
        cell.font = headerFontStyle;
        cell.fill = totalGeralFill;
        cell.border = cellBorder;
        cell.numFmt = 'R$ #,##0.00';
    });

    // Célula I (Cinza)
    totalGeralSomaRow.getCell('I').value = '';
    totalGeralSomaRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralSomaRow.getCell('I').font = headerFontStyle;
    totalGeralSomaRow.getCell('I').fill = totalGeralFill;
    totalGeralSomaRow.getCell('I').border = cellBorder;

    currentRow++;
    
    // Linha 2: VALOR TOTAL
    const totalGeralFinalRow = worksheet.getRow(currentRow);
    
    // Mescla A até G (Colspan 7)
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
    totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralFinalRow.getCell('A').font = headerFontStyle;
    totalGeralFinalRow.getCell('A').fill = totalGeralFill;
    totalGeralFinalRow.getCell('A').border = cellBorder;
    
    // Célula H: Valor Total GND 3 (Cinza)
    totalGeralFinalRow.getCell('H').value = totaisGerais.totalValor;
    totalGeralFinalRow.getCell('H').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('H').font = headerFontStyle;
    totalGeralFinalRow.getCell('H').fill = totalGeralFill;
    totalGeralFinalRow.getCell('H').border = cellBorder;
    totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

    // Célula I: Vazia (Cinza)
    totalGeralFinalRow.getCell('I').value = '';
    totalGeralFinalRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('I').font = headerFontStyle;
    totalGeralFinalRow.getCell('I').fill = totalGeralFill;
    totalGeralFinalRow.getCell('I').border = cellBorder;

    currentRow++;
    
    currentRow++;
    
    // Rodapé
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    localRow.getCell('A').font = { name: 'Arial', size: 10 };
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    currentRow += 3;
    
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
    cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    currentRow++;
    
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
    cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);

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
  }, [ptrabData, totaisGerais, fileSuffix, diasOperacao, registrosRacaoOperacional, generateClasseIMemoriaCalculo, toast]);


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
            Plano de Trabalho Classe I - Ração Operacional de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
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

        <div className="ptrab-table-wrapper">
          <table className="ptrab-table">
            <thead>
              <tr>
                <th rowSpan={2} className="col-classe">CLASSE</th>
                <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                <th colSpan={6} className="col-nd-group">NATUREZA DE DESPESA</th>
                <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO</th>
              </tr>
              <tr>
                <th className="col-nd-small nd-logistico">33.90.30</th>
                <th className="col-nd-small nd-logistico">33.90.39</th>
                <th className="col-nd-small nd-combustivel">33.90.33</th>
                <th className="col-nd-small nd-combustivel">33.90.00</th>
                <th className="col-nd-small nd-zero">33.90.00</th>
                <th className="col-nd-small total-gnd3-cell">GND 3</th>
              </tr>
            </thead>
            <tbody>
              {registrosRacaoOperacional.map((registro) => {
                const memoria = generateClasseIMemoriaCalculo(registro, 'OP');
                const omName = registro.organizacao;
                const article = getArticleForOM(omName);
                
                return (
                    <tr key={registro.id} className="expense-row">
                        <td className="col-classe">CLASSE I (Ração Operacional)</td>
                        <td className="col-om">
                            <div>{registro.organizacao}</div>
                            <div>({formatCodug(registro.ug)})</div>
                        </td>
                        <td className="col-nd-small nd-logistico">{formatCurrency(registro.total_geral)}</td>
                        <td className="col-nd-small nd-logistico">{formatCurrency(0)}</td>
                        <td className="col-nd-small nd-combustivel">{formatCurrency(0)}</td>
                        <td className="col-nd-small nd-combustivel">{formatCurrency(0)}</td>
                        <td className="col-nd-small nd-zero">{formatCurrency(0)}</td>
                        <td className="col-nd-small total-gnd3-cell">{formatCurrency(registro.total_geral)}</td>
                        <td className="col-detalhamento">
                            <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                {memoria}
                            </div>
                        </td>
                    </tr>
                );
              })}
              
              {/* Linha em branco para espaçamento */}
              <tr className="spacing-row">
                <td colSpan={9} style={{ height: '10px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
              </tr>
              
              {/* Grand Total Row 1: SOMA POR ND E GP DE DESPESA */}
              <tr className="total-geral-soma-row">
                <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.totalValor)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisGerais.totalValor)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL */}
              <tr className="total-geral-final-row">
                <td colSpan={7} className="text-right font-bold">VALOR TOTAL</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisGerais.totalValor)}</td>
                <td></td>
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
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-classe { width: 15%; text-align: left; vertical-align: middle; } 
        .col-om { width: 10%; text-align: center; vertical-align: top; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-small { 
            width: 7%; 
            text-align: center; 
            vertical-align: middle; 
        }
        .nd-logistico { background-color: #B4C7E7 !important; } /* Azul */
        .nd-combustivel { background-color: #FFC000 !important; } /* Laranja */
        .nd-zero { background-color: #B4C7E7 !important; } /* Azul */
        .col-detalhamento { width: 38%; text-align: left; vertical-align: top; }
        
        .total-gnd3-cell { background-color: #D9D9D9 !important; }
        
        /* Estilos para Linhas de Dados */
        .expense-row .col-nd-small {
            background-color: #B4C7E7 !important; /* Azul padrão para NDs */
        }
        .expense-row .nd-combustivel {
            background-color: #FFC000 !important; /* Laranja para Combustível */
        }
        .expense-row .total-gnd3-cell {
            background-color: #D9D9D9 !important; /* Cinza para Total GND 3 */
        }
        
        /* Estilos para Subtotal OM - Linha 1 (Soma por ND) */
        .subtotal-om-soma-row { 
            font-weight: bold; 
            page-break-inside: avoid; 
            background-color: #D9D9D9; /* Cinza */
        }
        .subtotal-om-soma-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
            background-color: #D9D9D9 !important;
        }
        .subtotal-om-soma-row td:nth-child(1) { /* Colspan 2 */
            text-align: right;
        }
        
        /* Estilos para Subtotal OM - Linha 2 (Valor Total) */
        .subtotal-om-final-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #E8E8E8; /* Cinza Claro */
        }
        .subtotal-om-final-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
            background-color: #E8E8E8 !important;
        }
        .subtotal-om-final-row td:nth-child(1) { /* Colspan 7 */
            text-align: right;
        }
        
        /* Estilos para Total Geral */
        .total-geral-soma-row, .total-geral-final-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #D9D9D9; /* Cinza */
        }
        .total-geral-soma-row td, .total-geral-final-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
            background-color: #D9D9D9 !important;
        }
        .total-geral-soma-row td:nth-child(1), .total-geral-final-row td:nth-child(1) {
            text-align: right;
        }
        
        /* AJUSTE DE ALINHAMENTO DO RODAPÉ */
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: A4 landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; } 
          .ptrab-table { border: 0.25pt solid #000 !important; }
          
          /* Força cores e alinhamentos */
          .expense-row .col-nd-small { 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .subtotal-om-soma-row td, .subtotal-om-final-row td, .total-geral-soma-row td, .total-geral-final-row td {
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