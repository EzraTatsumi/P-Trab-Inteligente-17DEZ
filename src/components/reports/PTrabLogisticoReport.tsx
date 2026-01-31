omQS, total_qs -> total_qs, etc.) based on centralized types.">
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
    LinhaClasseIII, 
    GrupoOM, 
    LinhaTabela,
    LinhaClasseII,
    getClasseIILabel,
    CLASSE_V_CATEGORIES,
    CLASSE_VI_CATEGORIES,
    CLASSE_VII_CATEGORIES,
    CLASSE_VIII_CATEGORIES,
    CLASSE_IX_CATEGORIES,
    calculateDays,
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares

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
  generateClasseIXMemoriaCalculo: (registro: ClasseIIRegistro) => string;
}

// Função auxiliar para determinar o artigo (DO/DA)
const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalizedOmName = omName.toUpperCase().trim();

    // 1. Cmdo Rule: If the name contains "CMDO", it is masculine (DO).
    if (normalizedOmName.includes('CMDO')) {
        return 'DO';
    }

    // 2. Ordinal Rule: Check for ª (feminine) or º (masculine)
    if (normalizedOmName.includes('ª')) {
        return 'DA';
    }
    if (normalizedOmName.includes('º')) {
        return 'DO';
    }

    // 3. Existing Noun Rule (Heuristic for full names or common abbreviations)
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
    
    // 4. Default: Feminine
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
  generateClasseIXMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);

  // Calcula o total geral de GND 3 e GND 4
  const totaisGerais = useMemo(() => {
    let totalGND3 = 0;
    let totalGND4 = 0;
    let totalCombustivel = 0;
    let totalLubrificante = 0;
    let totalND30 = 0;
    let totalND39 = 0;

    omsOrdenadas.forEach(omName => {
      const grupo = gruposPorOM[omName];
      if (grupo) {
        const totaisOM = calcularTotaisPorOM(grupo, omName);
        totalGND3 += totaisOM.total_gnd3;
        totalCombustivel += totaisOM.total_combustivel;
        totalND30 += totaisOM.total_33_90_30;
        totalND39 += totaisOM.total_33_90_39;
        
        // Lubrificante é somado dentro de total_33_90_30, mas vamos calcular separadamente para o total geral
        totalLubrificante += grupo.linhasClasseIII
            .filter(l => l.tipo_suprimento === 'LUBRIFICANTE')
            .reduce((acc, linha) => acc + linha.valor_total_linha, 0);
      }
    });
    
    // O total ND30 calculado acima inclui o Lubrificante.
    // O total GND3 é a soma de todos os custos logísticos.
    
    return {
      totalGND3,
      totalGND4, // Mantido como 0 por enquanto
      totalCombustivel,
      totalLubrificante,
      totalND30,
      totalND39,
    };
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);
  
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
  }, [ptrabData, totaisGerais, fileSuffix, diasOperacao, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseVMemoriaCalculo, generateClasseVIMemoriaCalculo, generateClasseVIIMemoriaCalculo, generateClasseVIIIMemoriaCalculo, generateClasseIXMemoriaCalculo, toast]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Logístico');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const leftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }; 
    
    const dataCenterMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    
    const cellBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle: Partial<ExcelJS.Font> = { name: 'Arial', size: 8 };
    const headerFontStyle: Partial<ExcelJS.Font> = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
    const titleFontStyle: Partial<ExcelJS.Font> = { name: 'Arial', size: 11, bold: true };
    const corHeader = 'FFD9D9D9'; // Cinza claro para o cabeçalho da tabela
    const corSubtotalOM = 'FFD9D9D9'; // Cinza para o subtotal OM
    const corGrandTotal = 'FFE8E8E8'; // Cinza claro para o total geral
    const corND = 'FFB4C7E7'; // Azul para as NDs
    const corSomaND = 'FFD9D9D9'; // Cinza para a linha de soma por ND
    
    // NOVOS OBJETOS DE PREENCHIMENTO (FILL) - CORRIGIDO: Usando 'pattern' type
    const headerFillGray: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } };
    const headerFillAzul: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
    const totalOMFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } };
    const totalGeralFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } };
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
    headerRow1.getCell('A').value = 'DESPESAS';
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
    headerRow2.getCell('G').value = 'GND 3';
    headerRow2.getCell('H').value = 'GND 4';
    
    worksheet.columns = [
        { width: 25 }, // A: DESPESAS
        { width: 15 }, // B: OM (UGE) CODUG
        { width: 10 }, // C: 33.90.30
        { width: 10 }, // D: 33.90.39
        { width: 10 }, // E: 33.90.33
        { width: 10 }, // F: 33.90.00
        { width: 10 }, // G: GND 3
        { width: 10 }, // H: GND 4
        { width: 50 }, // I: DETALHAMENTO
    ];
    
    // Ajustar altura das linhas (ESSENCIAL p/ texto aparecer)
    headerRow1.height = 45;
    headerRow2.height = 35;

    // Apply styles to header rows
    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    
    headerCols.forEach(col => {
        // Linha 1 – ÂNCORA
        const cell1 = headerRow1.getCell(col);
        cell1.font = headerFontStyle;
        cell1.alignment = centerMiddleAlignment;
        cell1.border = cellBorder;
        
        // Linha 2 – DETALHE
        const cell2 = headerRow2.getCell(col);
        cell2.font = headerFontStyle;
        cell2.alignment = centerMiddleAlignment;
        cell2.border = cellBorder;

        if (col === 'A' || col === 'B' || col === 'I') {
            // Células mescladas verticalmente (A, B, I)
            cell1.fill = headerFillGray;
            cell2.value = '';
            cell2.fill = headerFillGray;
        } else {
            // Células mescladas horizontalmente (C, D, E, F, G, H)
            cell1.fill = headerFillGray; // Cor de fundo da linha 1 (NATUREZA DE DESPESA)
            cell2.fill = headerFillAzul; // Cor de fundo da linha 2 (NDs)
        }
    });
    
    // Reaplicar valores para garantir que não sejam perdidos
    headerRow1.getCell('A').value = 'DESPESAS';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO';
    
    headerRow2.getCell('C').value = '33.90.30';
    headerRow2.getCell('D').value = '33.90.39';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.00';
    headerRow2.getCell('G').value = 'GND 3';
    headerRow2.getCell('H').value = 'GND 4';
    
    currentRow += 2; // Start data rows after the two header rows

    // Dados da Tabela (Agrupados por OM)
    omsOrdenadas.forEach(omName => {
        const grupo = gruposPorOM[omName];
        if (!grupo) return;
        
        const totaisOM = calcularTotaisPorOM(grupo, omName);
        const article = getArticleForOM(omName); // Determina DO/DA

        // --- 1. Render Classe I - QS ---
        grupo.linhasQS.forEach((linha: LinhaTabela) => {
            const registro = linha.registro;
            const row = worksheet.getRow(currentRow);
            
            // A: DESPESAS
            row.getCell('A').value = `CLASSE I - QS`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG
            row.getCell('B').value = `${registro.omQS}\n(${formatCodug(registro.ugQS)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.30 (Total QS)
            row.getCell('C').value = registro.total_qs;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = headerFillAzul; 
            
            // D, E, F, H (0)
            ['D', 'E', 'F', 'H'].forEach(col => {
                row.getCell(col).value = 0;
                row.getCell(col).alignment = dataCenterMiddleAlignment;
                row.getCell(col).numFmt = 'R$ #,##0.00';
                row.getCell(col).fill = headerFillAzul;
            });
            
            // G: GND 3 (Total da linha)
            row.getCell('G').value = registro.total_qs;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = headerFillAzul; 
            
            // I: DETALHAMENTO
            const memoria = generateClasseIMemoriaCalculo(registro, 'QS');
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
        
        // --- 2. Render Classe I - QR ---
        grupo.linhasQR.forEach((linha: LinhaTabela) => {
            const registro = linha.registro;
            const row = worksheet.getRow(currentRow);
            
            // A: DESPESAS
            row.getCell('A').value = `CLASSE I - QR`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG
            row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.30 (Total QR)
            row.getCell('C').value = registro.total_qr;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = headerFillAzul; 
            
            // D, E, F, H (0)
            ['D', 'E', 'F', 'H'].forEach(col => {
                row.getCell(col).value = 0;
                row.getCell(col).alignment = dataCenterMiddleAlignment;
                row.getCell(col).numFmt = 'R$ #,##0.00';
                row.getCell(col).fill = headerFillAzul;
            });
            
            // G: GND 3 (Total da linha)
            row.getCell('G').value = registro.total_qr;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = headerFillAzul; 
            
            // I: DETALHAMENTO
            const memoria = generateClasseIMemoriaCalculo(registro, 'QR');
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
        
        // --- 3. Render Classes II, V, VI, VII, VIII, IX ---
        const allClassesDiversas: { label: string, linhas: LinhaClasseII[], isClasseII: boolean, generateMemoria: (r: ClasseIIRegistro) => string }[] = [
            { label: 'CLASSE II', linhas: grupo.linhasClasseII, isClasseII: true, generateMemoria: (r) => generateClasseIIMemoriaCalculo(r, true) },
            { label: 'CLASSE V', linhas: grupo.linhasClasseV, isClasseII: false, generateMemoria: generateClasseVMemoriaCalculo },
            { label: 'CLASSE VI', linhas: grupo.linhasClasseVI, isClasseII: false, generateMemoria: generateClasseVIMemoriaCalculo },
            { label: 'CLASSE VII', linhas: grupo.linhasClasseVII, isClasseII: false, generateMemoria: generateClasseVIIMemoriaCalculo },
            { label: 'CLASSE VIII', linhas: grupo.linhasClasseVIII, isClasseII: false, generateMemoria: generateClasseVIIIMemoriaCalculo },
            { label: 'CLASSE IX', linhas: grupo.linhasClasseIX, isClasseII: false, generateMemoria: generateClasseIXMemoriaCalculo },
        ];
        
        allClassesDiversas.forEach(classe => {
            classe.linhas.forEach((linha: LinhaClasseII) => {
                const registro = linha.registro;
                const row = worksheet.getRow(currentRow);
                
                // A: DESPESAS
                row.getCell('A').value = `${classe.label} - ${getClasseIILabel(registro.categoria)}`; 
                row.getCell('A').alignment = leftMiddleAlignment; 
                
                // B: OM (UGE) CODUG
                row.getCell('B').value = `${registro.om_detentora || registro.organizacao}\n(${formatCodug(registro.ug_detentora || registro.ug)})`;
                row.getCell('B').alignment = dataCenterMiddleAlignment; 
                
                // C: 33.90.30
                row.getCell('C').value = registro.valor_nd_30;
                row.getCell('C').alignment = dataCenterMiddleAlignment;
                row.getCell('C').numFmt = 'R$ #,##0.00';
                row.getCell('C').fill = headerFillAzul; 
                
                // D: 33.90.39
                row.getCell('D').value = registro.valor_nd_39;
                row.getCell('D').alignment = dataCenterMiddleAlignment;
                row.getCell('D').numFmt = 'R$ #,##0.00';
                row.getCell('D').fill = headerFillAzul; 
                
                // E, F (0)
                ['E', 'F'].forEach(col => {
                    row.getCell(col).value = 0;
                    row.getCell(col).alignment = dataCenterMiddleAlignment;
                    row.getCell(col).numFmt = 'R$ #,##0.00';
                    row.getCell(col).fill = headerFillAzul;
                });
                
                // G: GND 3 (Total da linha)
                row.getCell('G').value = registro.valor_nd_30 + registro.valor_nd_39;
                row.getCell('G').alignment = dataCenterMiddleAlignment;
                row.getCell('G').numFmt = 'R$ #,##0.00';
                row.getCell('G').fill = headerFillAzul; 
                
                // H: GND 4 (0)
                row.getCell('H').value = 0;
                row.getCell('H').alignment = dataCenterMiddleAlignment;
                row.getCell('H').numFmt = 'R$ #,##0.00';
                row.getCell('H').fill = headerFillAzul; 
                
                // I: DETALHAMENTO
                const memoria = classe.generateMemoria(registro);
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
        });
        
        // --- 4. Render Classe III - Combustível e Lubrificante ---
        grupo.linhasClasseIII.forEach((linha: LinhaClasseIII) => {
            const row = worksheet.getRow(currentRow);
            
            // A: DESPESAS
            let despesaLabel = '';
            if (linha.tipo_suprimento === 'LUBRIFICANTE') {
                despesaLabel = 'CLASSE III - LUBRIFICANTE';
            } else {
                despesaLabel = `CLASSE III - ${linha.tipo_suprimento.replace('COMBUSTIVEL_', '')}`;
            }
            row.getCell('A').value = despesaLabel; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG
            row.getCell('B').value = `${linha.registro.om_detentora || linha.registro.organizacao}\n(${formatCodug(linha.registro.ug_detentora || linha.registro.ug)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.30 (Valor Total da Linha)
            row.getCell('C').value = linha.valor_total_linha;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = headerFillAzul; 
            
            // D, E, F, H (0)
            ['D', 'E', 'F', 'H'].forEach(col => {
                row.getCell(col).value = 0;
                row.getCell(col).alignment = dataCenterMiddleAlignment;
                row.getCell(col).numFmt = 'R$ #,##0.00';
                row.getCell(col).fill = headerFillAzul;
            });
            
            // G: GND 3 (Total da linha)
            row.getCell('G').value = linha.valor_total_linha;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = headerFillAzul; 
            
            // I: DETALHAMENTO
            row.getCell('I').value = linha.memoria_calculo;
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

        // Subtotal Row 1: SOMA POR ND E GP DE DESPESA
        const subtotalSomaRow = worksheet.getRow(currentRow);
        
        // Célula A+B (Cinza)
        subtotalSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalSomaRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalSomaRow.getCell('A').font = headerFontStyle;
        subtotalSomaRow.getCell('A').fill = totalGeralFill; // Cinza
        subtotalSomaRow.getCell('A').border = cellBorder;
        
        // Células C, D, E, F, G, H (NDs - Cinza)
        subtotalSomaRow.getCell('C').value = totaisOM.total_33_90_30 + totaisOM.total_combustivel;
        subtotalSomaRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalSomaRow.getCell('E').value = 0; // 33.90.33
        subtotalSomaRow.getCell('F').value = 0; // 33.90.00
        subtotalSomaRow.getCell('G').value = totaisOM.total_gnd3; // GND 3 Total
        subtotalSomaRow.getCell('H').value = 0; // GND 4 Total
        
        ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
            const cell = subtotalSomaRow.getCell(col);
            cell.alignment = dataCenterMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = totalGeralFill; // Cinza
            cell.border = cellBorder;
            cell.numFmt = 'R$ #,##0.00';
        });
        
        // Célula I (Cinza)
        subtotalSomaRow.getCell('I').value = '';
        subtotalSomaRow.getCell('I').alignment = dataCenterMiddleAlignment;
        subtotalSomaRow.getCell('I').font = headerFontStyle;
        subtotalSomaRow.getCell('I').fill = totalGeralFill; // Cinza
        subtotalSomaRow.getCell('I').border = cellBorder;

        currentRow++;

        // Subtotal Row 2: VALOR TOTAL DO(A) OM
        const subtotalFinalRow = worksheet.getRow(currentRow);
        
        // Mescla A até F (Cinza Claro) - Colspan 6
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        subtotalFinalRow.getCell('A').value = `VALOR TOTAL ${article} ${omName}`;
        subtotalFinalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalFinalRow.getCell('A').font = headerFontStyle;
        subtotalFinalRow.getCell('A').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('A').border = cellBorder;
        
        // Célula G: Valor Total GND 3 (Cinza Claro)
        subtotalFinalRow.getCell('G').value = totaisOM.total_gnd3;
        subtotalFinalRow.getCell('G').alignment = dataCenterMiddleAlignment;
        subtotalFinalRow.getCell('G').font = headerFontStyle;
        subtotalFinalRow.getCell('G').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('G').border = cellBorder;
        subtotalFinalRow.getCell('G').numFmt = 'R$ #,##0.00';

        // Célula H: Valor Total GND 4 (Cinza Claro)
        subtotalFinalRow.getCell('H').value = totaisGerais.totalGND4; // Mantido como 0
        subtotalFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
        subtotalFinalRow.getCell('H').font = headerFontStyle;
        subtotalFinalRow.getCell('H').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('H').border = cellBorder;
        subtotalFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

        // Célula I: Vazia (Cinza Claro)
        subtotalFinalRow.getCell('I').value = '';
        subtotalFinalRow.getCell('I').alignment = dataCenterMiddleAlignment;
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
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = totalGeralFill; // Cinza
    totalGeralSomaRow.getCell('A').border = cellBorder;

    // Células C, D, E, F, G, H (NDs - MUDADO PARA CINZA)
    totalGeralSomaRow.getCell('C').value = totaisGerais.totalND30 + totaisGerais.totalCombustivel;
    totalGeralSomaRow.getCell('D').value = totaisGerais.totalND39;
    totalGeralSomaRow.getCell('E').value = 0; // 33.90.33
    totalGeralSomaRow.getCell('F').value = 0; // 33.90.00
    totalGeralSomaRow.getCell('G').value = totaisGerais.totalGND3;
    totalGeralSomaRow.getCell('H').value = totaisGerais.totalGND4;

    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        const cell = totalGeralSomaRow.getCell(col);
        cell.alignment = dataCenterMiddleAlignment;
        cell.font = headerFontStyle;
        cell.fill = totalGeralFill; // Cinza
        cell.border = cellBorder;
        cell.numFmt = 'R$ #,##0.00';
    });

    // Célula I (CORRIGIDO: Deve ser cinza)
    totalGeralSomaRow.getCell('I').value = '';
    totalGeralSomaRow.getCell('I').alignment = dataCenterMiddleAlignment;
    totalGeralSomaRow.getCell('I').font = headerFontStyle;
    totalGeralSomaRow.getCell('I').fill = totalGeralFill; // Cinza
    totalGeralSomaRow.getCell('I').border = cellBorder;

    currentRow++;
    
    // Linha 2: VALOR TOTAL
    const totalGeralFinalRow = worksheet.getRow(currentRow);
    
    // Mescla A até F (Colspan 6)
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
    totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment; // Alinhado à direita
    totalGeralFinalRow.getCell('A').font = headerFontStyle;
    totalGeralFinalRow.getCell('A').fill = totalGeralFill; // Cinza
    totalGeralFinalRow.getCell('A').border = cellBorder;
    
    // Célula G: Valor Total GND 3 (Cinza)
    totalGeralFinalRow.getCell('G').value = totaisGerais.totalGND3;
    totalGeralFinalRow.getCell('G').alignment = dataCenterMiddleAlignment;
    totalGeralFinalRow.getCell('G').font = headerFontStyle;
    totalGeralFinalRow.getCell('G').fill = totalGeralFill; // Cinza
    totalGeralFinalRow.getCell('G').border = cellBorder;
    totalGeralFinalRow.getCell('G').numFmt = 'R$ #,##0.00';

    // Célula H: Valor Total GND 4 (Cinza)
    totalGeralFinalRow.getCell('H').value = totaisGerais.totalGND4;
    totalGeralFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
    totalGeralFinalRow.getCell('H').font = headerFontStyle;
    totalGeralFinalRow.getCell('H').fill = totalGeralFill; // Cinza
    totalGeralFinalRow.getCell('H').border = cellBorder;
    totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

    // Célula I: Vazia (Cinza)
    totalGeralFinalRow.getCell('I').value = '';
    totalGeralFinalRow.getCell('I').alignment = dataCenterMiddleAlignment;
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
  }, [ptrabData, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, totaisGerais, fileSuffix, diasOperacao, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseVMemoriaCalculo, generateClasseVIMemoriaCalculo, generateClasseVIIMemoriaCalculo, generateClasseVIIIMemoriaCalculo, generateClasseIXMemoriaCalculo, toast]);


  // Calcula o total de registros para exibir a mensagem de "nenhum registro"
  const totalRegistros = useMemo(() => {
    let count = 0;
    Object.values(gruposPorOM).forEach(grupo => {
        count += grupo.linhasQS.length;
        count += grupo.linhasQR.length;
        count += grupo.linhasClasseII.length;
        count += grupo.linhasClasseV.length;
        count += grupo.linhasClasseVI.length;
        count += grupo.linhasClasseVII.length;
        count += grupo.linhasClasseVIII.length;
        count += grupo.linhasClasseIX.length;
        count += grupo.linhasClasseIII.length;
    });
    return count;
  }, [gruposPorOM]);

  if (totalRegistros === 0) {
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
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico</p>
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
                <th rowSpan={2} className="col-despesas">DESPESAS</th>
                <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                <th colSpan={6} className="col-nd-group">NATUREZA DE DESPESA</th>
                <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO</th>
              </tr>
              <tr>
                  <th className="col-nd-small">33.90.30</th>
                  <th className="col-nd-small">33.90.39</th>
                  <th className="col-nd-small">33.90.33</th>
                  <th className="col-nd-small">33.90.00</th>
                  <th className="col-nd-small total-gnd3-cell">GND 3</th>
                  <th className="col-nd-small total-gnd4-cell">GND 4</th>
              </tr>
            </thead>
            <tbody>
              {omsOrdenadas.map(omName => {
                const grupo = gruposPorOM[omName];
                if (!grupo) return null;
                
                const totaisOM = calcularTotaisPorOM(grupo, omName);
                const article = getArticleForOM(omName);

                return (
                  <React.Fragment key={omName}>
                    {/* --- 1. Classe I - QS --- */}
                    {grupo.linhasQS.map((linha: LinhaTabela) => (
                      <tr key={`qs-${linha.registro.id}`} className="expense-row">
                        <td className="col-despesas">CLASSE I - QS</td>
                        <td className="col-om">
                          <div>{linha.registro.omQS}</div>
                          <div>({formatCodug(linha.registro.ugQS)})</div>
                        </td>
                        <td className="col-nd-small">{formatCurrency(linha.registro.total_qs)}</td>
                        <td className="col-nd-small">{formatCurrency(0)}</td>
                        <td className="col-nd-small">{formatCurrency(0)}</td>
                        <td className="col-nd-small">{formatCurrency(0)}</td>
                        <td className="col-nd-small total-gnd3-cell">{formatCurrency(linha.registro.total_qs)}</td>
                        <td className="col-nd-small total-gnd4-cell">{formatCurrency(0)}</td>
                        <td className="col-detalhamento">
                          <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {generateClasseIMemoriaCalculo(linha.registro, 'QS')}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {/* --- 2. Classe I - QR --- */}
                    {grupo.linhasQR.map((linha: LinhaTabela) => (
                      <tr key={`qr-${linha.registro.id}`} className="expense-row">
                        <td className="col-despesas">CLASSE I - QR</td>
                        <td className="col-om">
                          <div>{linha.registro.organizacao}</div>
                          <div>({formatCodug(linha.registro.ug)})</div>
                        </td>
                        <td className="col-nd-small">{formatCurrency(linha.registro.total_qr)}</td>
                        <td className="col-nd-small">{formatCurrency(0)}</td>
                        <td className="col-nd-small">{formatCurrency(0)}</td>
                        <td className="col-nd-small">{formatCurrency(0)}</td>
                        <td className="col-nd-small total-gnd3-cell">{formatCurrency(linha.registro.total_qr)}</td>
                        <td className="col-nd-small total-gnd4-cell">{formatCurrency(0)}</td>
                        <td className="col-detalhamento">
                          <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {generateClasseIMemoriaCalculo(linha.registro, 'QR')}
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {/* --- 3. Classes II, V, VI, VII, VIII, IX --- */}
                    {[
                        { label: 'CLASSE II', linhas: grupo.linhasClasseII, isClasseII: true, generateMemoria: (r: ClasseIIRegistro) => generateClasseIIMemoriaCalculo(r, true) },
                        { label: 'CLASSE V', linhas: grupo.linhasClasseV, isClasseII: false, generateMemoria: generateClasseVMemoriaCalculo },
                        { label: 'CLASSE VI', linhas: grupo.linhasClasseVI, isClasseII: false, generateMemoria: generateClasseVIMemoriaCalculo },
                        { label: 'CLASSE VII', linhas: grupo.linhasClasseVII, isClasseII: false, generateMemoria: generateClasseVIIMemoriaCalculo },
                        { label: 'CLASSE VIII', linhas: grupo.linhasClasseVIII, isClasseII: false, generateMemoria: generateClasseVIIIMemoriaCalculo },
                        { label: 'CLASSE IX', linhas: grupo.linhasClasseIX, isClasseII: false, generateMemoria: generateClasseIXMemoriaCalculo },
                    ].map(classe => (
                        classe.linhas.map((linha: LinhaClasseII) => (
                            <tr key={`${classe.label}-${linha.registro.id}`} className="expense-row">
                                <td className="col-despesas">{classe.label} - {getClasseIILabel(linha.registro.categoria)}</td>
                                <td className="col-om">
                                    <div>{linha.registro.om_detentora || linha.registro.organizacao}</div>
                                    <div>({formatCodug(linha.registro.ug_detentora || linha.registro.ug)})</div>
                                </td>
                                <td className="col-nd-small">{formatCurrency(linha.registro.valor_nd_30)}</td>
                                <td className="col-nd-small">{formatCurrency(linha.registro.valor_nd_39)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small total-gnd3-cell">{formatCurrency(linha.registro.valor_nd_30 + linha.registro.valor_nd_39)}</td>
                                <td className="col-nd-small total-gnd4-cell">{formatCurrency(0)}</td>
                                <td className="col-detalhamento">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {classe.generateMemoria(linha.registro)}
                                    </div>
                                </td>
                            </tr>
                        ))
                    ))}
                    
                    {/* --- 4. Classe III - Combustível e Lubrificante --- */}
                    {grupo.linhasClasseIII.map((linha: LinhaClasseIII) => {
                        let despesaLabel = '';
                        if (linha.tipo_suprimento === 'LUBRIFICANTE') {
                            despesaLabel = 'CLASSE III - LUBRIFICANTE';
                        } else {
                            despesaLabel = `CLASSE III - ${linha.tipo_suprimento.replace('COMBUSTIVEL_', '')}`;
                        }
                        
                        return (
                            <tr key={`cl3-${linha.registro.id}-${linha.tipo_suprimento}`} className="expense-row">
                                <td className="col-despesas">{despesaLabel}</td>
                                <td className="col-om">
                                    <div>{linha.registro.om_detentora || linha.registro.organizacao}</div>
                                    <div>({formatCodug(linha.registro.ug_detentora || linha.registro.ug)})</div>
                                </td>
                                <td className="col-nd-small">{formatCurrency(linha.valor_total_linha)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small">{formatCurrency(0)}</td>
                                <td className="col-nd-small total-gnd3-cell">{formatCurrency(linha.valor_total_linha)}</td>
                                <td className="col-nd-small total-gnd4-cell">{formatCurrency(0)}</td>
                                <td className="col-detalhamento">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {linha.memoria_calculo}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {/* Subtotal Row 1: SOMA POR ND E GP DE DESPESA */}
                    <tr className="subtotal-om-soma-row">
                        <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                        <td className="col-nd-small text-center font-bold">{formatCurrency(totaisOM.total_33_90_30 + totaisOM.total_combustivel)}</td>
                        <td className="col-nd-small text-center font-bold">{formatCurrency(totaisOM.total_33_90_39)}</td>
                        <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                        <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                        <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisOM.total_gnd3)}</td>
                        <td className="col-nd-small text-center font-bold total-gnd4-cell">{formatCurrency(0)}</td>
                        <td></td>
                    </tr>
                    
                    {/* Subtotal Row 2: VALOR TOTAL DO(A) OM */}
                    <tr className="subtotal-om-final-row">
                        <td colSpan={6} className="text-right font-bold">VALOR TOTAL {article} {omName}</td>
                        <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisOM.total_gnd3)}</td>
                        <td className="col-nd-small text-center font-bold total-gnd4-cell">{formatCurrency(0)}</td>
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
                <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.totalND30 + totaisGerais.totalCombustivel)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.totalND39)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisGerais.totalGND3)}</td>
                <td className="col-nd-small text-center font-bold total-gnd4-cell">{formatCurrency(totaisGerais.totalGND4)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL */}
              <tr className="total-geral-final-row">
                <td colSpan={6} className="text-right font-bold">VALOR TOTAL</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisGerais.totalGND3)}</td>
                <td className="col-nd-small text-center font-bold total-gnd4-cell">{formatCurrency(totaisGerais.totalGND4)}</td>
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
        .col-despesas { width: 20%; text-align: left; vertical-align: middle; } 
        .col-om { width: 10%; text-align: center; vertical-align: top; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-small { 
            width: 7%; 
            text-align: center; 
            vertical-align: middle; 
            background-color: #B4C7E7 !important; /* Fundo Azul para NDs (APENAS LINHAS DE DADOS) */
        }
        .col-detalhamento { width: 38%; text-align: left; vertical-align: top; }
        
        .total-gnd3-cell { background-color: #B4C7E7 !important; }
        .total-gnd4-cell { background-color: #B4C7E7 !important; }
        
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
        .subtotal-om-soma-row td:nth-child(1) { /* Colspan 2 */
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
        .subtotal-om-final-row td:nth-child(1) { /* Colspan 6 */
            text-align: right;
            background-color: #E8E8E8 !important;
        }
        /* Garante que a coluna G e H seja Cinza Claro */
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
        .total-geral-soma-row td:nth-child(1) { /* Colspan 2 */
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
        .total-geral-final-row td:nth-child(1) { /* Colspan 6 */
            text-align: right;
            background-color: #D9D9D9 !important;
        }
        
        /* CORREÇÃO: Garante que a coluna G e H no Total Geral Final seja Cinza D9D9D9 */
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
          
          /* CORREÇÃO CRÍTICA: Força alinhamento vertical middle para as colunas de dados B a H */
          .expense-row td:nth-child(2), /* Coluna B: OM/CODUG */
          .expense-row td:nth-child(3), /* Coluna C: 33.90.30 */
          .expense-row td:nth-child(4), /* Coluna D: 33.90.39 */
          .expense-row td:nth-child(5), /* Coluna E: 33.90.33 */
          .expense-row td:nth-child(6), /* Coluna F: 33.90.00 */
          .expense-row td:nth-child(7), /* Coluna G: GND 3 */
          .expense-row td:nth-child(8) { /* Coluna H: GND 4 */
              vertical-align: middle !important;
          }
          
          /* Coluna A (Despesas) também deve ser middle */
          .expense-row .col-despesas {
              vertical-align: middle !important;
          }
          
          /* Coluna I (Detalhamento) deve ser top */
          .expense-row .col-detalhamento {
              vertical-align: top !important;
          }
          
          /* NDs nas linhas de DADOS continuam azuis */
          .expense-row .col-nd-small { 
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .expense-row .total-gnd3-cell, .expense-row .total-gnd4-cell {
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          /* Subtotal e Totais agora são Cinza */
          .subtotal-om-soma-row td {
              background-color: #D9D9D9 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .subtotal-om-final-row td {
              background-color: #E8E8E8 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .total-geral-soma-row td {
              background-color: #D9D9D9 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .total-geral-final-row td {
              background-color: #D9D9D9 !important; /* Alterado para D9D9D9 */
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