import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Package, Utensils, Fuel, Swords, HardHat, Radio, HeartPulse, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    PTrabData, 
    ClasseIRegistro, 
    ClasseIIIRegistro, 
    ClasseIIRegistro, // Importar ClasseIIRegistro
    GrupoOM, 
    LinhaClasseIII, 
    LinhaTabela, // <-- Importado
    LinhaClasseII, // <-- Importado
    calculateDays, 
    formatFasesParaTexto, 
    getClasseIILabel,
    calculateItemTotalClasseIX,
    CLASSE_V_CATEGORIES,
    CLASSE_VI_CATEGORIES,
    CLASSE_VII_CATEGORIES,
    CLASSE_VIII_CATEGORIES,
    CLASSE_IX_CATEGORIES,
} from "@/pages/PTrabReportManager"; 
import { cn } from "@/lib/utils";

// Local type extension to fix missing properties on ClasseIRegistro
interface ClasseIRegistroWithTotals extends ClasseIRegistro {
    total_qs: number;
    total_qr: number;
    omQS: string; 
    ugQS: string; 
}

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
  
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);
  
  // 1. Recalcular Totais Gerais (para HTML/PDF)
  // FIX Errors 1 and 2: Use omQS instead of om_qs
  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.omQS || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.omQS || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeralCombustivel = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.omQS || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_combustivel, 0), [gruposPorOM, calcularTotaisPorOM]);
  
  const totalGeralGND3 = totalGeral_33_90_30 + totalGeral_33_90_39 + totalGeralCombustivel;

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
  }, [ptrabData, totalGeralGND3, fileSuffix, diasOperacao, toast]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Função para exportar Excel
  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Logístico');

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
    const corND = 'FFB4C7E7'; // Azul para as NDs (33.90.30, 33.90.39)
    const corLaranja = 'FFFBE5D5'; // Laranja claro para Combustível (33.90.33)
    const corGrandTotal = 'FFE8E8E8'; // Cinza claro para o subtotal OM
    const corSomaND = 'FFD9D9D9'; // Cinza para a linha de soma por ND

    // NOVOS OBJETOS DE PREENCHIMENTO (FILL)
    // FIX Errors 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 23, 24: Use literal types for Fill
    const headerFillGray: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } };
    const headerFillAzul: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } };
    const headerFillLaranja: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
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
        
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
    };
    
    addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfoRow('2. PERÍODO:', `de ${diasOperacao} dias, de ${formatDateDDMMMAA(ptrabData.periodo_inicio)} a ${formatDateDDMMMAA(ptrabData.periodo_fim)}`);
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
    headerRow2.getCell('E').value = '33.90.30';
    headerRow2.getCell('F').value = '33.90.33';
    headerRow2.getCell('G').value = '33.90.39';
    headerRow2.getCell('H').value = 'GND 3';
    
    worksheet.columns = [
        { width: 25 }, // A: DESPESAS
        { width: 15 }, // B: OM (UGE) CODUG
        { width: 10 }, // C: 33.90.30 (Classe I)
        { width: 10 }, // D: 33.90.39 (Classes II-IX ND 39)
        { width: 10 }, // E: 33.90.30 (Classes II-IX ND 30)
        { width: 10 }, // F: 33.90.33 (Classe III Combustível)
        { width: 10 }, // G: 33.90.39 (Classe III Lubrificante)
        { width: 10 }, // H: GND 3
        { width: 50 }, // I: DETALHAMENTO
    ];
    
    headerRow1.height = 45;
    headerRow2.height = 35;

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

        if (['A', 'B', 'I'].includes(col)) {
            cell1.fill = headerFillGray;
            cell2.value = ''; // Explicitly clear value for merged cells
            cell2.fill = headerFillGray;
        } else if (['C', 'D', 'E'].includes(col)) {
            cell1.fill = headerFillAzul;
            cell2.fill = headerFillAzul;
        } else if (['F', 'G', 'H'].includes(col)) {
            cell1.fill = headerFillLaranja;
            cell2.fill = headerFillLaranja;
        }
    });
    
    // Reaplicar valores para garantir que não sejam perdidos
    headerRow1.getCell('A').value = 'DESPESAS';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO';
    
    headerRow2.getCell('C').value = '33.90.30';
    headerRow2.getCell('D').value = '33.90.39';
    headerRow2.getCell('E').value = '33.90.30';
    headerRow2.getCell('F').value = '33.90.33';
    headerRow2.getCell('G').value = '33.90.39';
    headerRow2.getCell('H').value = 'GND 3';
    
    currentRow += 2; // Start data rows after the two header rows

    // Dados da Tabela (Agrupados por OM)
    omsOrdenadas.forEach(omName => {
        const grupo = gruposPorOM[omName];
        if (!grupo) return;

        const omTotals = calcularTotaisPorOM(grupo, omName);
        const article = getArticleForOM(omName);
        
        // Combina todas as linhas de despesa para iteração
        const allLines: ({ type: 'I' | 'II_IX' | 'III', linha: LinhaTabela | LinhaClasseII | LinhaClasseIII })[] = [
            ...grupo.linhasQS.map(l => ({ type: 'I' as const, linha: l })),
            ...grupo.linhasQR.map(l => ({ type: 'I' as const, linha: l })),
            ...grupo.linhasClasseII.map(l => ({ type: 'II_IX' as const, linha: l })),
            ...grupo.linhasClasseV.map(l => ({ type: 'II_IX' as const, linha: l })),
            ...grupo.linhasClasseVI.map(l => ({ type: 'II_IX' as const, linha: l })),
            ...grupo.linhasClasseVII.map(l => ({ type: 'II_IX' as const, linha: l })),
            ...grupo.linhasClasseVIII.map(l => ({ type: 'II_IX' as const, linha: l })),
            ...grupo.linhasClasseIX.map(l => ({ type: 'II_IX' as const, linha: l })),
            ...grupo.linhasClasseIII.map(l => ({ type: 'III' as const, linha: l })),
        ];
        
        // Ordena as linhas: Classe I (QS, QR), Classes II-IX, Classe III
        allLines.sort((a, b) => {
            if (a.type === 'I' && b.type !== 'I') return -1;
            if (a.type !== 'I' && b.type === 'I') return 1;
            if (a.type === 'II_IX' && b.type === 'III') return -1;
            if (a.type === 'III' && b.type === 'II_IX') return 1;
            return 0;
        });

        allLines.forEach(({ type, linha }) => {
            const row = worksheet.getRow(currentRow);
            const rowData = {
                despesasValue: '',
                omValue: '',
                valorC: 0, // 33.90.30 (Classe I)
                valorD: 0, // 33.90.39 (Classes II-IX)
                valorE: 0, // 33.90.30 (Classes II-IX)
                valorF: 0, // 33.90.33 (Combustível)
                valorG: 0, // 33.90.39 (Lubrificante)
                valorH: 0, // GND 3 Total
                detalhamentoValue: '',
                fillType: 'AZUL' as 'AZUL' | 'LARANJA',
            };
            
            const isClasseI = type === 'I';
            const isClasseII_IX = type === 'II_IX';
            const isClasseIII = type === 'III';

            if (isClasseI) { // Classe I (QS/QR)
                // FIX Errors 9, 10, 14, 15, 16, 17, 25, 26, 30, 31, 32, 33: Use local type extension
                const registro = (linha as LinhaTabela).registro as ClasseIRegistroWithTotals;
                const tipo = (linha as LinhaTabela).tipo;
                // FIX Errors 11, 27: Use ugQS
                const ug_qs_formatted = formatCodug(registro.ugQS);
                const ug_qr_formatted = formatCodug(registro.ug);
                
                rowData.despesasValue = 'CLASSE I - SUBSISTÊNCIA';
                rowData.fillType = 'AZUL';

                if (tipo === 'QS') {
                    const omDestino = registro.organizacao;
                    // FIX Errors 12, 28: Use omQS
                    const omFornecedora = registro.omQS; 
                    
                    rowData.despesasValue = 'CLASSE I - SUBSISTÊNCIA (QS)';
                    // FIX Errors 13, 29: Use omQS
                    rowData.omValue = `${registro.omQS}\n(${ug_qs_formatted})`; // OM Fornecedora
                    rowData.valorC = registro.total_qs;
                    rowData.valorE = registro.total_qs;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                } else if (tipo === 'QR') {
                    rowData.despesasValue = 'CLASSE I - SUBSISTÊNCIA (QR)';
                    rowData.omValue = `${registro.organizacao}\n(${ug_qr_formatted})`;
                    rowData.valorC = registro.total_qr;
                    rowData.valorE = registro.total_qr;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                }
                rowData.valorH = rowData.valorC + rowData.valorD + rowData.valorE + rowData.valorF + rowData.valorG;

            } else if (isClasseII_IX) { // Classes II, V, VI, VII, VIII, IX
                // FIX Errors 18, 34: LinhaClasseII is now imported
                const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                const omDestinoRecurso = registro.organizacao;
                const ugDestinoRecurso = registro.ug;
                const isClasseII = CATEGORIAS_CLASSE_II.includes(registro.categoria);
                
                rowData.despesasValue = `CLASSE ${registro.categoria.split(' ')[0]} - ${getClasseIILabel(registro.categoria).toUpperCase()}`;
                rowData.omValue = `${omDestinoRecurso}\n(${formatCodug(ugDestinoRecurso)})`;
                rowData.valorE = registro.valor_nd_30;
                rowData.valorD = registro.valor_nd_39;
                rowData.fillType = 'AZUL';
                
                if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVMemoriaCalculo(registro);
                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIMemoriaCalculo(registro);
                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIIMemoriaCalculo(registro);
                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIIIMemoriaCalculo(registro);
                } else {
                    rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, isClasseII);
                }
                rowData.valorH = rowData.valorC + rowData.valorD + rowData.valorE + rowData.valorF + rowData.valorG;

            } else if (isClasseIII) { // Classe III (Combustível e Lubrificante)
                const linhaIII = linha as LinhaClasseIII;
                const isCombustivel = linhaIII.tipo_suprimento.startsWith('COMBUSTIVEL');
                const isLubrificante = linhaIII.tipo_suprimento === 'LUBRIFICANTE';
                
                rowData.despesasValue = `CLASSE III - ${isCombustivel ? 'COMBUSTÍVEL' : 'LUBRIFICANTE'} (${linhaIII.categoria_equipamento})`;
                
                // OM Detentora do Recurso (OM Fornecedora para Combustível, OM Usuária para Lubrificante)
                const omDetentora = linhaIII.registro.om_detentora || linhaIII.registro.organizacao;
                const ugDetentora = linhaIII.registro.ug_detentora || linhaIII.registro.ug;
                rowData.omValue = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
                
                rowData.detalhamentoValue = linhaIII.memoria_calculo;
                rowData.fillType = 'LARANJA';

                if (isCombustivel) {
                    rowData.valorF = linhaIII.valor_total_linha; // 33.90.33
                } else if (isLubrificante) {
                    rowData.valorG = linhaIII.valor_total_linha; // 33.90.39
                }
                rowData.valorH = rowData.valorC + rowData.valorD + rowData.valorE + rowData.valorF + rowData.valorG;
            }
            
            // Renderização da Linha
            row.getCell('A').value = rowData.despesasValue;
            row.getCell('A').alignment = leftMiddleAlignment;
            
            row.getCell('B').value = rowData.omValue;
            row.getCell('B').alignment = dataCenterMiddleAlignment;
            
            // NDs
            row.getCell('C').value = rowData.valorC;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = headerFillAzul;
            row.getCell('C').border = cellBorder;
            
            row.getCell('D').value = rowData.valorD;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = headerFillAzul;
            row.getCell('D').border = cellBorder;
            
            row.getCell('E').value = rowData.valorE;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = headerFillAzul;
            row.getCell('E').border = cellBorder;
            
            row.getCell('F').value = rowData.valorF;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').font = baseFontStyle;
            row.getCell('F').fill = headerFillLaranja;
            row.getCell('F').border = cellBorder;
            
            row.getCell('G').value = rowData.valorG;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').font = baseFontStyle;
            row.getCell('G').fill = headerFillLaranja;
            row.getCell('G').border = cellBorder;
            
            row.getCell('H').value = rowData.valorH;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').font = headerFontStyle;
            row.getCell('H').fill = rowData.fillType === 'AZUL' ? headerFillAzul : headerFillLaranja;
            row.getCell('H').border = cellBorder;
            
            row.getCell('I').value = rowData.detalhamentoValue;
            row.getCell('I').alignment = leftTopAlignment;
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            // Apply base styles to non-ND columns
            ['A', 'B', 'I'].forEach(col => {
                row.getCell(col).font = baseFontStyle;
                row.getCell(col).border = cellBorder;
            });
            
            currentRow++;
        });

        // Subtotal Row 1: SOMA POR ND E GP DE DESPESA
        const subtotalSomaRow = worksheet.getRow(currentRow);
        
        const subtotalOM = omTotals; // Reutiliza os totais calculados
        
        // Célula A+B (Cinza)
        subtotalSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalSomaRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalSomaRow.getCell('A').font = headerFontStyle;
        subtotalSomaRow.getCell('A').fill = totalGeralFill; // Cinza
        subtotalSomaRow.getCell('A').border = cellBorder;
        
        // Células C, D, E, F, G, H (NDs - Cinza)
        subtotalSomaRow.getCell('C').value = omTotals.total_33_90_30 - omTotals.total_combustivel; // Classe I (ND 30) + Lubrificante (ND 30)
        subtotalSomaRow.getCell('D').value = omTotals.total_33_90_39; // Classes II-IX (ND 39)
        subtotalSomaRow.getCell('E').value = omTotals.total_33_90_30 - omTotals.total_combustivel; // Classes II-IX (ND 30) + Lubrificante (ND 30)
        subtotalSomaRow.getCell('F').value = omTotals.valorDiesel + omTotals.valorGasolina; // Combustível (ND 33)
        subtotalSomaRow.getCell('G').value = 0; // Lubrificante (ND 39) - Não temos esse campo no cálculo atual, mas deve ser 0
        subtotalSomaRow.getCell('H').value = omTotals.total_gnd3; // GND 3 Total
        
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
        subtotalFinalRow.getCell('H').value = omTotals.total_gnd3;
        subtotalFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
        subtotalFinalRow.getCell('H').font = headerFontStyle;
        subtotalFinalRow.getCell('H').fill = totalOMFill; // FFE8E8E8
        subtotalFinalRow.getCell('H').border = cellBorder;
        totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

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
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = totalGeralFill; // Cinza
    totalGeralSomaRow.getCell('A').border = cellBorder;

    // Células C, D, E, F, G, H (NDs - Cinza)
    totalGeralSomaRow.getCell('C').value = totalGeral_33_90_30 - totalGeralCombustivel; // Classe I (ND 30) + Lubrificante (ND 30)
    totalGeralSomaRow.getCell('D').value = totalGeral_33_90_39; // Classes II-IX (ND 39)
    totalGeralSomaRow.getCell('E').value = totalGeral_33_90_30 - totalGeralCombustivel; // Classes II-IX (ND 30) + Lubrificante (ND 30)
    totalGeralSomaRow.getCell('F').value = totalGeralCombustivel; // Combustível (ND 33)
    totalGeralSomaRow.getCell('G').value = 0; // Lubrificante (ND 39)
    totalGeralSomaRow.getCell('H').value = totalGeralGND3; // GND 3 Total

    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
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
    totalGeralFinalRow.getCell('H').value = totalGeralGND3;
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
  }, [ptrabData, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, totalGeralGND3, totalGeral_33_90_30, totalGeral_33_90_39, totalGeralCombustivel, fileSuffix, toast]);

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
            <p className="text-muted-foreground">Nenhum registro de Classe I, II, III, V, VI, VII, VIII ou IX encontrado para este P Trab.</p>
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
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {diasOperacao} dias, de {formatDateDDMMMAA(ptrabData.periodo_inicio)} a {formatDateDDMMMAA(ptrabData.periodo_fim)}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:</p>
        </div>

        {omsOrdenadas.length > 0 ? (
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
                    <th className="col-nd-small nd-azul">33.90.30</th>
                    <th className="col-nd-small nd-azul">33.90.39</th>
                    <th className="col-nd-small nd-azul">33.90.30</th>
                    <th className="col-nd-small nd-laranja">33.90.33</th>
                    <th className="col-nd-small nd-laranja">33.90.39</th>
                    <th className="col-nd-small total-gnd3-cell">GND 3</th>
                </tr>
            </thead>
            <tbody>
              {omsOrdenadas.map(omName => {
                const grupo = gruposPorOM[omName];
                if (!grupo) return null;
                
                const omTotals = calcularTotaisPorOM(grupo, omName);
                const article = getArticleForOM(omName);
                
                // Combina todas as linhas de despesa para iteração
                const allLines: ({ type: 'I' | 'II_IX' | 'III', linha: LinhaTabela | LinhaClasseII | LinhaClasseIII })[] = [
                    ...grupo.linhasQS.map(l => ({ type: 'I' as const, linha: l })),
                    ...grupo.linhasQR.map(l => ({ type: 'I' as const, linha: l })),
                    ...grupo.linhasClasseII.map(l => ({ type: 'II_IX' as const, linha: l })),
                    ...grupo.linhasClasseV.map(l => ({ type: 'II_IX' as const, linha: l })),
                    ...grupo.linhasClasseVI.map(l => ({ type: 'II_IX' as const, linha: l })),
                    ...grupo.linhasClasseVII.map(l => ({ type: 'II_IX' as const, linha: l })),
                    ...grupo.linhasClasseVIII.map(l => ({ type: 'II_IX' as const, linha: l })),
                    ...grupo.linhasClasseIX.map(l => ({ type: 'II_IX' as const, linha: l })),
                    ...grupo.linhasClasseIII.map(l => ({ type: 'III' as const, linha: l })),
                ];
                
                // Ordena as linhas: Classe I (QS, QR), Classes II-IX, Classe III
                allLines.sort((a, b) => {
                    if (a.type === 'I' && b.type !== 'I') return -1;
                    if (a.type !== 'I' && b.type === 'I') return 1;
                    if (a.type === 'II_IX' && b.type === 'III') return -1;
                    if (a.type === 'III' && b.type === 'II_IX') return 1;
                    return 0;
                });

                return (
                    <React.Fragment key={omName}>
                        {allLines.map(({ type, linha }, index) => {
                            const rowData = {
                                despesasValue: '',
                                omValue: '',
                                valorC: 0, // 33.90.30 (Classe I)
                                valorD: 0, // 33.90.39 (Classes II-IX)
                                valorE: 0, // 33.90.30 (Classes II-IX)
                                valorF: 0, // 33.90.33 (Combustível)
                                valorG: 0, // 33.90.39 (Lubrificante)
                                valorH: 0, // GND 3 Total
                                detalhamentoValue: '',
                                fillType: 'AZUL' as 'AZUL' | 'LARANJA',
                            };
                            
                            const isClasseI = type === 'I';
                            const isClasseII_IX = type === 'II_IX';
                            const isClasseIII = type === 'III';

                            if (isClasseI) { // Classe I (QS/QR)
                                const registro = (linha as LinhaTabela).registro as ClasseIRegistroWithTotals;
                                const tipo = (linha as LinhaTabela).tipo;
                                const ug_qs_formatted = formatCodug(registro.ugQS);
                                const ug_qr_formatted = formatCodug(registro.ug);
                                
                                rowData.despesasValue = 'CLASSE I - SUBSISTÊNCIA';
                                rowData.fillType = 'AZUL';

                                if (tipo === 'QS') {
                                    const omDestino = registro.organizacao;
                                    const omFornecedora = registro.omQS;
                                    
                                    rowData.despesasValue = 'CLASSE I - SUBSISTÊNCIA (QS)';
                                    rowData.omValue = `${registro.omQS}\n(${ug_qs_formatted})`; // OM Fornecedora
                                    rowData.valorC = registro.total_qs;
                                    rowData.valorE = registro.total_qs;
                                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                                } else if (tipo === 'QR') {
                                    rowData.despesasValue = 'CLASSE I - SUBSISTÊNCIA (QR)';
                                    rowData.omValue = `${registro.organizacao}\n(${ug_qr_formatted})`;
                                    rowData.valorC = registro.total_qr;
                                    rowData.valorE = registro.total_qr;
                                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                                }
                                rowData.valorH = rowData.valorC + rowData.valorD + rowData.valorE + rowData.valorF + rowData.valorG;

                            } else if (isClasseII_IX) { // Classes II, V, VI, VII, VIII, IX
                                const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                                const omDestinoRecurso = registro.organizacao;
                                const ugDestinoRecurso = registro.ug;
                                const isClasseII = CATEGORIAS_CLASSE_II.includes(registro.categoria);
                                
                                rowData.despesasValue = `CLASSE ${registro.categoria.split(' ')[0]} - ${getClasseIILabel(registro.categoria).toUpperCase()}`;
                                rowData.omValue = `${omDestinoRecurso}\n(${formatCodug(ugDestinoRecurso)})`;
                                rowData.valorE = registro.valor_nd_30;
                                rowData.valorD = registro.valor_nd_39;
                                rowData.fillType = 'AZUL';
                                
                                if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                                    rowData.detalhamentoValue = generateClasseVMemoriaCalculo(registro);
                                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                                    rowData.detalhamentoValue = generateClasseVIMemoriaCalculo(registro);
                                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                                    rowData.detalhamentoValue = generateClasseVIIMemoriaCalculo(registro);
                                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                                    rowData.detalhamentoValue = generateClasseVIIIMemoriaCalculo(registro);
                                } else {
                                    rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, isClasseII);
                                }
                                rowData.valorH = rowData.valorC + rowData.valorD + rowData.valorE + rowData.valorF + rowData.valorG;

                            } else if (isClasseIII) { // Classe III (Combustível e Lubrificante)
                                const linhaIII = linha as LinhaClasseIII;
                                const isCombustivel = linhaIII.tipo_suprimento.startsWith('COMBUSTIVEL');
                                const isLubrificante = linhaIII.tipo_suprimento === 'LUBRIFICANTE';
                                
                                rowData.despesasValue = `CLASSE III - ${isCombustivel ? 'COMBUSTÍVEL' : 'LUBRIFICANTE'} (${linhaIII.categoria_equipamento})`;
                                
                                // OM Detentora do Recurso (OM Fornecedora para Combustível, OM Usuária para Lubrificante)
                                const omDetentora = linhaIII.registro.om_detentora || linhaIII.registro.organizacao;
                                const ugDetentora = linhaIII.registro.ug_detentora || linhaIII.registro.ug;
                                rowData.omValue = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
                                
                                rowData.detalhamentoValue = linhaIII.memoria_calculo;
                                rowData.fillType = 'LARANJA';

                                if (isCombustivel) {
                                    rowData.valorF = linhaIII.valor_total_linha; // 33.90.33
                                } else if (isLubrificante) {
                                    rowData.valorG = linhaIII.valor_total_linha; // 33.90.39
                                }
                                rowData.valorH = rowData.valorC + rowData.valorD + rowData.valorE + rowData.valorF + rowData.valorG;
                            }
                            
                            const isAzul = rowData.fillType === 'AZUL';
                            const icon = isClasseI ? <Utensils className="h-4 w-4 text-orange-500" />
                                : isClasseII_IX && CLASSE_V_CATEGORIES.includes((linha as LinhaClasseII).registro.categoria) ? <Swords className="h-4 w-4 text-orange-500" />
                                : isClasseII_IX && CLASSE_VI_CATEGORIES.includes((linha as LinhaClasseII).registro.categoria) ? <HardHat className="h-4 w-4 text-orange-500" />
                                : isClasseII_IX && CLASSE_VII_CATEGORIES.includes((linha as LinhaClasseII).registro.categoria) ? <Radio className="h-4 w-4 text-orange-500" />
                                : isClasseII_IX && CLASSE_VIII_CATEGORIES.includes((linha as LinhaClasseII).registro.categoria) ? <HeartPulse className="h-4 w-4 text-orange-500" />
                                : isClasseII_IX && CLASSE_IX_CATEGORIES.includes((linha as LinhaClasseII).registro.categoria) ? <Truck className="h-4 w-4 text-orange-500" />
                                : isClasseIII ? <Fuel className="h-4 w-4 text-orange-500" />
                                : <Package className="h-4 w-4 text-orange-500" />;

                            return (
                                <tr key={`${omName}-${type}-${index}`} className="expense-row">
                                  <td className="col-despesas"> 
                                    <div className="flex items-center gap-2">
                                        {icon}
                                        {rowData.despesasValue}
                                    </div>
                                  </td>
                                  <td className="col-om">
                                    <div className="flex flex-col">
                                        {rowData.omValue.split('\n').map((line, i) => <span key={i}>{line}</span>)}
                                    </div>
                                  </td>
                                  <td className={cn("col-nd-small", isAzul && "nd-azul")}>{formatCurrency(rowData.valorC)}</td>
                                  <td className={cn("col-nd-small", isAzul && "nd-azul")}>{formatCurrency(rowData.valorD)}</td>
                                  <td className={cn("col-nd-small", isAzul && "nd-azul")}>{formatCurrency(rowData.valorE)}</td>
                                  <td className={cn("col-nd-small", !isAzul && "nd-laranja")}>{formatCurrency(rowData.valorF)}</td>
                                  <td className={cn("col-nd-small", !isAzul && "nd-laranja")}>{formatCurrency(rowData.valorG)}</td>
                                  <td className="col-nd-small total-gnd3-cell">{formatCurrency(rowData.valorH)}</td>
                                  <td className="col-detalhamento">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {rowData.detalhamentoValue}
                                    </div>
                                  </td>
                                </tr>
                            );
                        })}
                        
                        {/* Subtotal Row 1: SOMA POR ND E GP DE DESPESA */}
                        <tr className="subtotal-om-soma-row">
                            <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                                SOMA POR ND E GP DE DESPESA
                            </td>
                            <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(omTotals.total_33_90_30 - omTotals.total_combustivel)}</td>
                            <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(omTotals.total_33_90_39)}</td>
                            <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(omTotals.total_33_90_30 - omTotals.total_combustivel)}</td>
                            <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(omTotals.valorDiesel + omTotals.valorGasolina)}</td>
                            <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(0)}</td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(omTotals.total_gnd3)}</td>
                            <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td>
                        </tr>
                        
                        {/* Subtotal Row 2: VALOR TOTAL DO(A) OM */}
                        <tr className="subtotal-om-final-row">
                            <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>
                                VALOR TOTAL {article} {omName}
                            </td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>
                                {formatCurrency(omTotals.total_gnd3)}
                            </td>
                            <td style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
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
                <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    SOMA POR ND E GP DE DESPESA
                </td>
                <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totalGeral_33_90_30 - totalGeralCombustivel)}</td>
                <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totalGeral_33_90_39)}</td>
                <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totalGeral_33_90_30 - totalGeralCombustivel)}</td>
                <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totalGeralCombustivel)}</td>
                <td className="col-nd-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(0)}</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totalGeralGND3)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL */}
              <tr className="total-geral-final-row">
                <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000', borderRight: 'none' }}>
                    VALOR TOTAL
                </td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    {formatCurrency(totalGeralGND3)}
                </td>
                <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td> {/* Coluna I vazia */}
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
        .col-despesas { width: 20%; text-align: left; vertical-align: middle; } 
        .col-om { width: 10%; text-align: center; vertical-align: top; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-small { width: 7%; text-align: center; vertical-align: middle; }
        .col-detalhamento { width: 38%; text-align: left; vertical-align: top; }
        
        /* CORES DE FUNDO */
        .nd-azul { background-color: #B4C7E7 !important; } /* 33.90.30 e 33.90.39 (Classes I, II, V, VI, VII, VIII, IX) */
        .nd-laranja { background-color: #FFFBE5D5 !important; } /* 33.90.33 e 33.90.39 (Classe III) */
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
        .subtotal-om-soma-row td:nth-child(1) { /* Colspan 2 */
            text-align: right;
            background-color: #D9D9D9 !important;
        }
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
          
          .expense-row td:nth-child(2) { /* Coluna B: OM/CODUG */
              vertical-align: middle !important;
          }
          .expense-row .col-detalhamento {
              vertical-align: top !important;
          }
          
          .nd-azul { 
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .nd-laranja { 
              background-color: #FFFBE5D5 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .total-gnd3-cell {
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          .subtotal-om-soma-row td, .total-geral-soma-row td {
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