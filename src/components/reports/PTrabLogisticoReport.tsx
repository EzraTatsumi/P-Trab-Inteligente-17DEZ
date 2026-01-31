import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug, formatDate } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PTrabData, 
  ClasseIRegistro, 
  ClasseIIRegistro, 
  ClasseIIIRegistro,
  LinhaTabela,
  LinhaClasseII,
  LinhaClasseIII,
  GrupoOM,
  calculateDays,
  getClasseIILabel,
  calculateItemTotalClasseIX,
  getTipoCombustivelLabel,
} from "@/pages/PTrabReportManager"; 

interface PTrabLogisticoReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  registrosClasseII: ClasseIIRegistro[];
  registrosClasseIII: ClasseIIIRegistro[];
  nomeRM: string;
  omsOrdenadas: string[];
  gruposPorOM: Record<string, GrupoOM>;
  calcularTotaisPorOM: (grupo: GrupoOM, nomeOM: string) => {
    total_33_90_30: number;
    total_33_90_39: number;
    total_parte_azul: number;
    total_combustivel: number;
    total_gnd3: number;
    totalDieselLitros: number;
    totalGasolinaLitros: number;
    valorDiesel: number;
    valorGasolina: number;
  };
  fileSuffix: string;
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
  generateClasseIIMemoriaCalculo: (registro: ClasseIIRegistro, isClasseII: boolean) => string;
  generateClasseVMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIIIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
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

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
  registrosClasseI,
  registrosClasseII,
  registrosClasseIII,
  nomeRM,
  omsOrdenadas,
  gruposPorOM,
  calcularTotaisPorOM,
  fileSuffix,
  generateClasseIMemoriaCalculo,
  generateClasseIIMemoriaCalculo,
  generateClasseVMemoriaCalculo,
  generateClasseVIMemoriaCalculo,
  generateClasseVIIMemoriaCalculo,
  generateClasseVIIIMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  // Calcula os totais gerais de GND 3
  const totaisGerais = useMemo(() => {
    let total_33_90_30 = 0;
    let total_33_90_39 = 0;
    let total_combustivel = 0;
    let total_gnd3 = 0;
    
    omsOrdenadas.forEach(omName => {
        const grupo = gruposPorOM[omName];
        if (grupo) {
            const totaisOM = calcularTotaisPorOM(grupo, omName);
            total_33_90_30 += totaisOM.total_33_90_30;
            total_33_90_39 += totaisOM.total_33_90_39;
            total_combustivel += totaisOM.total_combustivel;
            total_gnd3 += totaisOM.total_gnd3;
        }
    });
    
    return {
        total_33_90_30,
        total_33_90_39,
        total_combustivel,
        total_gnd3,
    };
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);

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
        description: "O P Trab Logístico foi salvo com sucesso.",
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

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Logístico');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }; 
    
    const dataCenterMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    
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
    const corSubtotalOM = 'FFD9D9D9'; // Cinza para o subtotal OM
    const corGrandTotal = 'FFE8E8E8'; // Cinza claro para o total geral
    const corND = 'FFB4C7E7'; // Azul para as NDs
    const corCombustivel = 'FFD9E1F2'; // Azul mais claro para Combustível
    
    // NOVOS OBJETOS DE PREENCHIMENTO (FILL)
    const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } }; 
    const headerFillAzul = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corND } }; 
    const totalOMFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corGrandTotal } }; 
    const totalGeralFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotalOM } }; 
    const combustivelFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corCombustivel } }; 
    // -------------------------------------------

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
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO LOGÍSTICO';
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
        
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
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
    headerRow1.getCell('B').value = 'OM FAVORECIDA\n(UG)';
    headerRow1.getCell('C').value = 'OM DETENTORA DO RECURSO\n(UG)';
    headerRow1.getCell('D').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO';
    
    worksheet.mergeCells(`A${currentRow}:A${currentRow+1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow+1}`);
    worksheet.mergeCells(`C${currentRow}:C${currentRow+1}`);
    worksheet.mergeCells(`D${currentRow}:H${currentRow}`);
    worksheet.mergeCells(`I${currentRow}:I${currentRow+1}`);
    
    const headerRow2 = worksheet.getRow(currentRow + 1);
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.39';
    headerRow2.getCell('F').value = '33.90.00';
    headerRow2.getCell('G').value = 'COMBUSTÍVEL';
    headerRow2.getCell('H').value = 'GND 3';
    
    worksheet.columns = [
        { width: 10 }, // A: CLASSE
        { width: 15 }, // B: OM FAVORECIDA (UG)
        { width: 15 }, // C: OM DETENTORA DO RECURSO (UG)
        { width: 10 }, // D: 33.90.30
        { width: 10 }, // E: 33.90.39
        { width: 10 }, // F: 33.90.00
        { width: 10 }, // G: COMBUSTÍVEL
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

        if (col === 'A' || col === 'B' || col === 'C' || col === 'I') {
            cell1.fill = headerFillGray;
            cell2.value = '';
            cell2.fill = headerFillGray;
        } else {
            cell1.fill = headerFillGray; 
            cell2.fill = headerFillAzul; 
        }
    });
    
    // Corrigir cor de fundo da coluna G (Combustível)
    headerRow2.getCell('G').fill = combustivelFill;
    
    currentRow += 2; // Start data rows after the two header rows

    // Dados da Tabela (Agrupados por OM)
    omsOrdenadas.forEach(omName => {
        const grupo = gruposPorOM[omName];
        if (!grupo) return;
        
        const totaisOM = calcularTotaisPorOM(grupo, omName);
        const isRMFornecedora = omName === nomeRM;
        const article = getArticleForOM(omName);
        
        // --- 1. Render Classe I (QS/QR) ---
        const linhasClasseI = [...grupo.linhasQS, ...grupo.linhasQR];
        linhasClasseI.forEach(linha => {
            const registro = linha.registro;
            const omDetentora = registro.omQS || registro.organizacao; // OM que fornece a etapa (RM)
            const ugDetentora = registro.ugQS || registro.ug;
            
            const row = worksheet.getRow(currentRow);
            
            // A: CLASSE
            row.getCell('A').value = `CLASSE I (${linha.tipo})`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM FAVORECIDA (UG)
            row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: OM DETENTORA DO RECURSO (UG)
            row.getCell('C').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
            row.getCell('C').alignment = dataCenterMiddleAlignment; 
            
            // D: 33.90.30
            row.getCell('D').value = linha.registro.totalQS + linha.registro.totalQR; // Total QS + QR
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = headerFillAzul; 
            
            // E: 33.90.39 (0)
            row.getCell('E').value = 0;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = headerFillAzul; 
            
            // F: 33.90.00 (0)
            row.getCell('F').value = 0;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = headerFillAzul; 
            
            // G: COMBUSTÍVEL (0)
            row.getCell('G').value = 0;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = combustivelFill; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = linha.registro.totalQS + linha.registro.totalQR;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = headerFillAzul; 
            
            // I: DETALHAMENTO
            const memoria = generateClasseIMemoriaCalculo(registro, linha.tipo);
            row.getCell('I').value = memoria;
            row.getCell('I').alignment = leftTopAlignment; 
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            // Apply base styles
            ['A', 'B', 'C', 'I'].forEach(col => {
                row.getCell(col).font = baseFontStyle;
            });
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                row.getCell(col).border = cellBorder;
            });
            currentRow++;
        });
        
        // --- 2. Render Classes II, V, VI, VII, VIII, IX ---
        const allClassesDiversas = [
            ...grupo.linhasClasseII.map(l => ({ ...l, classe: 'II', isClasseII: true })),
            ...grupo.linhasClasseV.map(l => ({ ...l, classe: 'V', isClasseII: false })),
            ...grupo.linhasClasseVI.map(l => ({ ...l, classe: 'VI', isClasseII: false })),
            ...grupo.linhasClasseVII.map(l => ({ ...l, classe: 'VII', isClasseII: false })),
            ...grupo.linhasClasseVIII.map(l => ({ ...l, classe: 'VIII', isClasseII: false })),
            ...grupo.linhasClasseIX.map(l => ({ ...l, classe: 'IX', isClasseII: false })),
        ];
        
        allClassesDiversas.forEach(linha => {
            const registro = linha.registro;
            const omDetentora = registro.om_detentora || registro.organizacao;
            const ugDetentora = registro.ug_detentora || registro.ug;
            
            const row = worksheet.getRow(currentRow);
            
            // A: CLASSE
            row.getCell('A').value = `CLASSE ${linha.classe}`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM FAVORECIDA (UG)
            row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: OM DETENTORA DO RECURSO (UG)
            row.getCell('C').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
            row.getCell('C').alignment = dataCenterMiddleAlignment; 
            
            // D: 33.90.30
            row.getCell('D').value = registro.valor_nd_30;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = headerFillAzul; 
            
            // E: 33.90.39
            row.getCell('E').value = registro.valor_nd_39;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = headerFillAzul; 
            
            // F: 33.90.00 (0)
            row.getCell('F').value = 0;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = headerFillAzul; 
            
            // G: COMBUSTÍVEL (0)
            row.getCell('G').value = 0;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = combustivelFill; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = registro.valor_total;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = headerFillAzul; 
            
            // I: DETALHAMENTO
            const memoria = generateClasseIIMemoriaCalculo(registro, linha.isClasseII);
            row.getCell('I').value = memoria;
            row.getCell('I').alignment = leftTopAlignment; 
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            // Apply base styles
            ['A', 'B', 'C', 'I'].forEach(col => {
                row.getCell(col).font = baseFontStyle;
            });
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                row.getCell(col).border = cellBorder;
            });
            currentRow++;
        });
        
        // --- 3. Render Classe III (Combustível e Lubrificante) ---
        grupo.linhasClasseIII.forEach(linha => {
            const registro = linha.registro;
            const omDetentora = registro.om_detentora || registro.organizacao;
            const ugDetentora = registro.ug_detentora || registro.ug;
            
            const row = worksheet.getRow(currentRow);
            
            // A: CLASSE
            row.getCell('A').value = `CLASSE III`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM FAVORECIDA (UG)
            row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: OM DETENTORA DO RECURSO (UG)
            row.getCell('C').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
            row.getCell('C').alignment = dataCenterMiddleAlignment; 
            
            // D: 33.90.30
            const isLubrificante = linha.tipo_suprimento === 'LUBRIFICANTE';
            row.getCell('D').value = isLubrificante ? linha.valor_total_linha : 0;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = headerFillAzul; 
            
            // E: 33.90.39 (0)
            row.getCell('E').value = 0;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = headerFillAzul; 
            
            // F: 33.90.00 (0)
            row.getCell('F').value = 0;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = headerFillAzul; 
            
            // G: COMBUSTÍVEL
            row.getCell('G').value = isLubrificante ? 0 : linha.valor_total_linha;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = combustivelFill; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = linha.valor_total_linha;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = headerFillAzul; 
            
            // I: DETALHAMENTO
            row.getCell('I').value = linha.memoria_calculo;
            row.getCell('I').alignment = leftTopAlignment; 
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            // Apply base styles
            ['A', 'B', 'C', 'I'].forEach(col => {
                row.getCell(col).font = baseFontStyle;
            });
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
                row.getCell(col).border = cellBorder;
            });
            currentRow++;
        });

        // Subtotal Row 1: SOMA POR ND E GP DE DESPESA
        const subtotalSomaRow = worksheet.getRow(currentRow);
        
        // Célula A+B+C (Cinza)
        subtotalSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        subtotalSomaRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalSomaRow.getCell('A').font = headerFontStyle;
        subtotalSomaRow.getCell('A').fill = totalGeralFill; // Cinza
        subtotalSomaRow.getCell('A').border = cellBorder;
        
        // Células D, E, F, G, H (NDs - Cinza)
        subtotalSomaRow.getCell('D').value = totaisOM.total_33_90_30;
        subtotalSomaRow.getCell('E').value = totaisOM.total_33_90_39;
        subtotalSomaRow.getCell('F').value = 0; // 33.90.00
        subtotalSomaRow.getCell('G').value = totaisOM.total_combustivel;
        subtotalSomaRow.getCell('H').value = totaisOM.total_gnd3;
        
        ['D', 'E', 'F', 'G', 'H'].forEach(col => {
            const cell = subtotalSomaRow.getCell(col);
            cell.alignment = dataCenterMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = totalGeralFill; // Cinza
            cell.border = cellBorder;
            cell.numFmt = 'R$ #,##0.00';
        });
        
        // Célula I (Cinza)
        subtotalSomaRow.getCell('I').value = '';
        subtotalSomaRow.getCell('I').alignment = centerMiddleAlignment;
        subtotalSomaRow.getCell('I').font = headerFontStyle;
        subtotalSomaRow.getCell('I').fill = totalGeralFill; // Cinza
        subtotalSomaRow.getCell('I').border = cellBorder;

        currentRow++;

        // Subtotal Row 2: VALOR TOTAL DO(A) OM
        const subtotalFinalRow = worksheet.getRow(currentRow);
        
        // Mescla A até G (Cinza Claro) - Colspan 7
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        subtotalFinalRow.getCell('A').value = `VALOR TOTAL ${article} ${omName}`;
        subtotalFinalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalFinalRow.getCell('A').font = headerFontStyle;
        subtotalFinalRow.getCell('A').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('A').border = cellBorder;
        
        // Célula H: Valor Total GND 3 (Cinza Claro)
        subtotalFinalRow.getCell('H').value = totaisOM.total_gnd3;
        subtotalFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
        subtotalFinalRow.getCell('H').font = headerFontStyle;
        subtotalFinalRow.getCell('H').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('H').border = cellBorder;
        subtotalFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

        // Célula I: Vazia (Cinza Claro)
        subtotalFinalRow.getCell('I').value = '';
        subtotalFinalRow.getCell('I').alignment = centerMiddleAlignment;
        subtotalFinalRow.getCell('I').font = headerFontStyle;
        subtotalFinalRow.getCell('I').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('I').border = cellBorder;

        currentRow++;
    });

    // Linha em branco para espaçamento
    currentRow++;
    
    // ========== TOTAL GERAL ==========
    
    // Linha 1: SOMA POR ND E GP DE DESPESA
    const totalGeralSomaRow = worksheet.getRow(currentRow);
    totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = totalGeralFill; // Cinza
    totalGeralSomaRow.getCell('A').border = cellBorder;

    // Células D, E, F, G, H (NDs - Cinza)
    totalGeralSomaRow.getCell('D').value = totaisGerais.total_33_90_30;
    totalGeralSomaRow.getCell('E').value = totaisGerais.total_33_90_39;
    totalGeralSomaRow.getCell('F').value = 0; // 33.90.00
    totalGeralSomaRow.getCell('G').value = totaisGerais.total_combustivel;
    totalGeralSomaRow.getCell('H').value = totaisGerais.total_gnd3;

    ['D', 'E', 'F', 'G', 'H'].forEach(col => {
        const cell = totalGeralSomaRow.getCell(col);
        cell.alignment = dataCenterMiddleAlignment;
        cell.font = headerFontStyle;
        cell.fill = totalGeralFill; // Cinza
        cell.border = cellBorder;
        cell.numFmt = 'R$ #,##0.00';
    });

    // Célula I (Cinza)
    totalGeralSomaRow.getCell('I').value = '';
    totalGeralSomaRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralSomaRow.getCell('I').font = headerFontStyle;
    totalGeralSomaRow.getCell('I').fill = totalGeralFill; // Cinza
    totalGeralSomaRow.getCell('I').border = cellBorder;

    currentRow++;
    
    // Linha 2: VALOR TOTAL
    const totalGeralFinalRow = worksheet.getRow(currentRow);
    
    // Mescla A até G (Colspan 7)
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
    totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment; // Alinhado à direita
    totalGeralFinalRow.getCell('A').font = headerFontStyle;
    totalGeralFinalRow.getCell('A').fill = totalGeralFill; // Cinza
    totalGeralFinalRow.getCell('A').border = cellBorder;
    
    // Célula H: Valor Total GND 3 (Cinza)
    totalGeralFinalRow.getCell('H').value = totaisGerais.total_gnd3;
    totalGeralFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
    totalGeralFinalRow.getCell('H').font = headerFontStyle;
    totalGeralFinalRow.getCell('H').fill = totalGeralFill; // Cinza
    totalGeralFinalRow.getCell('H').border = cellBorder;
    totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

    // Célula I: Vazia (Cinza)
    totalGeralFinalRow.getCell('I').value = '';
    totalGeralFinalRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('I').font = headerFontStyle;
    totalGeralFinalRow.getCell('I').fill = totalGeralFill; // Cinza
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
      description: "O relatório Logístico foi salvo com sucesso.",
      duration: 3000,
    });
  }, [ptrabData, diasOperacao, totaisGerais, fileSuffix, gruposPorOM, omsOrdenadas, calcularTotaisPorOM, toast]);


  if (registrosClasseI.length === 0 && registrosClasseII.length === 0 && registrosClasseIII.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <Package className="h-5 w-5" />
            P Trab Logístico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro logístico (Classes I, II, III, V, VI, VII, VIII, IX) encontrado para este P Trab.</p>
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
            Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:</p>
        </div>

        {omsOrdenadas.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-classe">CLASSE</th>
                  <th rowSpan={2} className="col-om-favorecida">OM FAVORECIDA<br/>(UG)</th>
                  <th rowSpan={2} className="col-om-detentora">OM DETENTORA DO RECURSO<br/>(UG)</th>
                  <th colSpan={5} className="col-nd-group">NATUREZA DE DESPESA</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO</th>
                </tr>
                <tr>
                    <th className="col-nd-small">33.90.30</th>
                    <th className="col-nd-small">33.90.39</th>
                    <th className="col-nd-small">33.90.00</th>
                    <th className="col-nd-small col-combustivel">COMBUSTÍVEL</th>
                    <th className="col-nd-small total-gnd3-cell">GND 3</th>
                </tr>
            </thead>
            <tbody>
              {omsOrdenadas.map(omName => {
                const grupo = gruposPorOM[omName];
                if (!grupo) return null;
                
                const totaisOM = calcularTotaisPorOM(grupo, omName);
                const isRMFornecedora = omName === nomeRM;
                const article = getArticleForOM(omName);

                // --- 1. Classe I (QS/QR) ---
                const linhasClasseI = [...grupo.linhasQS, ...grupo.linhasQR];
                
                // Agrupar por OM Favorecida (para o caso de OM Detentora ser a RM)
                const linhasClasseIByFavorecida: Record<string, LinhaTabela[]> = linhasClasseI.reduce((acc, linha) => {
                    const key = `${linha.registro.organizacao} (${linha.registro.ug})`;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(linha);
                    return acc;
                }, {} as Record<string, LinhaTabela[]>);
                
                Object.entries(linhasClasseIByFavorecida).forEach(([omFavorecidaKey, linhas]) => {
                    linhas.forEach((linha, index) => {
                        const registro = linha.registro;
                        const omDetentora = registro.omQS || registro.organizacao;
                        const ugDetentora = registro.ugQS || registro.ug;
                        
                        // Se for Ração Quente, o valor total é a soma de QS e QR
                        const valorTotal = (registro.totalQS || 0) + (registro.totalQR || 0);
                        
                        // Se for a primeira linha do grupo de OM Favorecida, mescla as células
                        const isFirstRow = index === 0;
                        
                        return (
                            <tr key={`cl1-${linha.registro.id}-${linha.tipo}`} className="expense-row">
                                <td className="col-classe">
                                    CLASSE I
                                </td>
                                <td className="col-om-favorecida">
                                    <div>{registro.organizacao}</div>
                                    <div>({formatCodug(registro.ug)})</div>
                                </td>
                                <td className="col-om-detentora">
                                    <div>{omDetentora}</div>
                                    <div>({formatCodug(ugDetentora)})</div>
                                </td>
                                <td className="col-nd-small">{formatCurrency(valorTotal)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small col-combustivel">{formatCurrency(0)}</td>
                                <td className="col-nd-small total-gnd3-cell">{formatCurrency(valorTotal)}</td>
                                <td className="col-detalhamento">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {generateClasseIMemoriaCalculo(registro, 'QS')}
                                        <br/>
                                        {generateClasseIMemoriaCalculo(registro, 'QR')}
                                    </div>
                                </td>
                            </tr>
                        );
                    });
                });
                
                // --- 2. Classes II, V, VI, VII, VIII, IX ---
                const allClassesDiversas = [
                    ...grupo.linhasClasseII.map(l => ({ ...l, classe: 'II', isClasseII: true })),
                    ...grupo.linhasClasseV.map(l => ({ ...l, classe: 'V', isClasseII: false })),
                    ...grupo.linhasClasseVI.map(l => ({ ...l, classe: 'VI', isClasseII: false })),
                    ...grupo.linhasClasseVII.map(l => ({ ...l, classe: 'VII', isClasseII: false })),
                    ...grupo.linhasClasseVIII.map(l => ({ ...l, classe: 'VIII', isClasseII: false })),
                    ...grupo.linhasClasseIX.map(l => ({ ...l, classe: 'IX', isClasseII: false })),
                ];
                
                allClassesDiversas.forEach(linha => {
                    const registro = linha.registro;
                    const omDetentora = registro.om_detentora || registro.organizacao;
                    const ugDetentora = registro.ug_detentora || registro.ug;
                    
                    return (
                        <tr key={`cl${linha.classe}-${registro.id}`} className="expense-row">
                            <td className="col-classe">
                                CLASSE {linha.classe}
                            </td>
                            <td className="col-om-favorecida">
                                <div>{registro.organizacao}</div>
                                <div>({formatCodug(registro.ug)})</div>
                            </td>
                            <td className="col-om-detentora">
                                <div>{omDetentora}</div>
                                <div>({formatCodug(ugDetentora)})</div>
                            </td>
                            <td className="col-nd-small">{formatCurrency(registro.valor_nd_30)}</td>
                            <td className="col-nd-small">{formatCurrency(registro.valor_nd_39)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel">{formatCurrency(0)}</td>
                            <td className="col-nd-small total-gnd3-cell">{formatCurrency(registro.valor_total)}</td>
                            <td className="col-detalhamento">
                                <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {generateClasseIIMemoriaCalculo(registro, linha.isClasseII)}
                                </div>
                            </td>
                        </tr>
                    );
                });
                
                // --- 3. Classe III (Combustível e Lubrificante) ---
                grupo.linhasClasseIII.forEach(linha => {
                    const registro = linha.registro;
                    const isLubrificante = linha.tipo_suprimento === 'LUBRIFICANTE';
                    const omDetentora = registro.om_detentora || registro.organizacao;
                    const ugDetentora = registro.ug_detentora || registro.ug;
                    
                    const valorND30 = isLubrificante ? linha.valor_total_linha : 0;
                    const valorCombustivel = isLubrificante ? 0 : linha.valor_total_linha;
                    const valorTotal = linha.valor_total_linha;
                    
                    return (
                        <tr key={`cl3-${registro.id}-${linha.tipo_suprimento}-${linha.categoria_equipamento}`} className="expense-row">
                            <td className="col-classe">
                                CLASSE III
                            </td>
                            <td className="col-om-favorecida">
                                <div>{registro.organizacao}</div>
                                <div>({formatCodug(registro.ug)})</div>
                            </td>
                            <td className="col-om-detentora">
                                <div>{omDetentora}</div>
                                <div>({formatCodug(ugDetentora)})</div>
                            </td>
                            <td className="col-nd-small">{formatCurrency(valorND30)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel">{formatCurrency(valorCombustivel)}</td>
                            <td className="col-nd-small total-gnd3-cell">{formatCurrency(valorTotal)}</td>
                            <td className="col-detalhamento">
                                <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {linha.memoria_calculo}
                                </div>
                            </td>
                        </tr>
                    );
                });

                // Subtotal Row 1: SOMA POR ND E GP DE DESPESA
                return (
                    <React.Fragment key={`subtotal-om-${omName}`}>
                        <tr className="subtotal-om-soma-row">
                            <td colSpan={3} className="text-right font-bold">
                                SOMA POR ND E GP DE DESPESA
                            </td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(totaisOM.total_33_90_30)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(totaisOM.total_33_90_39)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel text-center font-bold">{formatCurrency(totaisOM.total_combustivel)}</td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisOM.total_gnd3)}</td>
                            <td></td>
                        </tr>
                        
                        {/* Subtotal Row 2: VALOR TOTAL DO(A) OM */}
                        <tr className="subtotal-om-final-row">
                            <td colSpan={7} className="text-right font-bold">
                                VALOR TOTAL {article} {omName}
                            </td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell">
                                {formatCurrency(totaisOM.total_gnd3)}
                            </td>
                            <td></td>
                        </tr>
                    </React.Fragment>
                );
              })}
              
              {/* Linha em branco para espaçamento */}
              <tr className="spacing-row">
                <td colSpan={9} style={{ height: '10px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
              </tr>
              
              {/* Grand Total Row 1: SOMA POR ND E GP DE DESPESA */}
              <tr className="total-geral-soma-row">
                <td colSpan={3} className="text-right font-bold">
                    SOMA POR ND E GP DE DESPESA
                </td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.total_33_90_30)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.total_33_90_39)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small col-combustivel text-center font-bold">{formatCurrency(totaisGerais.total_combustivel)}</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisGerais.total_gnd3)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL */}
              <tr className="total-geral-final-row">
                <td colSpan={7} className="text-right font-bold">
                    VALOR TOTAL
                </td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">
                    {formatCurrency(totaisGerais.total_gnd3)}
                </td>
                <td></td>
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro logístico cadastrado.</p>
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
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-classe { width: 8%; } 
        .col-om-favorecida { width: 12%; }
        .col-om-detentora { width: 12%; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-small { 
            width: 8%; 
            text-align: center; 
            vertical-align: middle; 
            background-color: #B4C7E7 !important; /* Fundo Azul para NDs (APENAS LINHAS DE DADOS) */
        }
        .col-combustivel { background-color: #D9E1F2 !important; } /* Azul mais claro para Combustível */
        .col-detalhamento { width: 40%; text-align: left; vertical-align: top; }
        
        .total-gnd3-cell { background-color: #B4C7E7 !important; }
        
        /* Estilos para Subtotal OM - Linha 1 (Soma por ND) */
        .subtotal-om-soma-row { 
            font-weight: bold; 
            page-break-inside: avoid; 
            background-color: #D9D9D9; /* Cinza */
        }
        .subtotal-om-soma-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
        }
        .subtotal-om-soma-row td:nth-child(1) { /* Colspan 3 */
            text-align: right;
            background-color: #D9D9D9 !important;
        }
        /* Garante que as NDs no subtotal sejam cinzas */
        .subtotal-om-soma-row .col-nd-small {
            background-color: #D9D9D9 !important;
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
        }
        .subtotal-om-final-row td:nth-child(1) { /* Colspan 7 */
            text-align: right;
            background-color: #E8E8E8 !important;
        }
        /* Garante que a coluna H seja Cinza Claro */
        .subtotal-om-final-row .col-nd-small {
            background-color: #E8E8E8 !important;
        }
        
        /* Estilos para Total Geral */
        .total-geral-soma-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #D9D9D9; /* Cinza */
        }
        .total-geral-soma-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
        }
        .total-geral-soma-row td:nth-child(1) { /* Colspan 3 */
            text-align: right;
            background-color: #D9D9D9 !important;
        }
        /* Garante que as NDs na soma geral sejam cinzas */
        .total-geral-soma-row .col-nd-small {
            background-color: #D9D9D9 !important;
        }
        
        .total-geral-final-row {
            font-weight: bold;
            page-break-inside: avoid;
            background-color: #D9D9D9; /* Cinza */
        }
        .total-geral-final-row td {
            border: 1px solid #000 !important;
            padding: 3px 4px;
        }
        .total-geral-final-row td:nth-child(1) { /* Colspan 7 */
            text-align: right;
            background-color: #D9D9D9 !important;
        }
        
        /* CORREÇÃO: Garante que a coluna H (GND 3) no Total Geral Final seja Cinza D9D9D9 */
        .total-geral-final-row .col-nd-small {
            background-color: #D9D9D9 !important;
        }
        
        /* AJUSTE DE ALINHAMENTO DO RODAPÉ */
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; } 
          .ptrab-table { border: 0.25pt solid #000 !important; }
          
          /* NDs nas linhas de DADOS */
          .expense-row .col-nd-small { 
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .expense-row .col-combustivel {
              background-color: #D9E1F2 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .expense-row .total-gnd3-cell {
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          /* Subtotal e Totais agora são Cinza */
          .subtotal-om-soma-row td,
          .total-geral-soma-row td {
              background-color: #D9D9D9 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .subtotal-om-final-row td {
              background-color: #E8E8E8 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
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

export default PTrabLogisticoReport;