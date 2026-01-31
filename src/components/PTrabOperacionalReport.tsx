import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug, formatDate } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import {
  PTrabData,
  DiariaRegistro,
  VerbaOperacionalRegistro, 
  PassagemRegistro, // NOVO: Importando o tipo PassagemRegistro
  calculateDays,
} from "@/pages/PTrabReportManager"; 
import { DIARIA_RANKS_CONFIG } from "@/lib/diariaUtils";

interface PTrabOperacionalReportProps {
  ptrabData: PTrabData;
  registrosDiaria: DiariaRegistro[];
  registrosVerbaOperacional: VerbaOperacionalRegistro[]; 
  registrosSuprimentoFundos: VerbaOperacionalRegistro[];
  registrosPassagem: PassagemRegistro[]; // NOVO PROP: Registros de Passagem
  diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
  fileSuffix: string;
  generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
  generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string; 
  generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
  generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string; // NOVO PROP: Memória de cálculo para Passagem
}

// Função auxiliar para determinar o artigo (DO/DA)
const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalizedOmName = omName.toUpperCase().trim();

    // 1. Cmdo Rule: If the name contains "CMDO", it is masculine (DO).
    // Ex: Cmdo 23ª Bda Inf Sl -> DO
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


const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
  ptrabData,
  registrosDiaria,
  registrosVerbaOperacional, 
  registrosSuprimentoFundos,
  registrosPassagem, // NOVO
  diretrizesOperacionais,
  fileSuffix,
  generateDiariaMemoriaCalculo,
  generateVerbaOperacionalMemoriaCalculo, 
  generateSuprimentoFundosMemoriaCalculo,
  generatePassagemMemoriaCalculo, // NOVO
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);
  
  // NOVO: Agrupamento por OM (Diária, Verba Operacional, Suprimento de Fundos e Passagens)
  const registrosAgrupadosPorOM = useMemo(() => {
    const groups: Record<string, { diarias: DiariaRegistro[], verbas: VerbaOperacionalRegistro[], suprimentos: VerbaOperacionalRegistro[], passagens: PassagemRegistro[] }> = {};

    const initializeGroup = (om: string, ug: string) => {
        const omKey = `${om} (${ug})`;
        if (!groups[omKey]) {
            groups[omKey] = { diarias: [], verbas: [], suprimentos: [], passagens: [] };
        }
        return groups[omKey];
    };

    // 1. Agrupar Diárias (OM de Destino)
    registrosDiaria.forEach(registro => {
        const group = initializeGroup(registro.organizacao, registro.ug);
        group.diarias.push(registro);
    });
    
    // 2. Agrupar Verba Operacional (OM Detentora do Recurso)
    registrosVerbaOperacional.forEach(registro => {
        // A OM Detentora é a OM de destino do recurso (om_detentora/ug_detentora)
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        const group = initializeGroup(omDetentora, ugDetentora);
        group.verbas.push(registro);
    });
    
    // 3. Agrupar Suprimento de Fundos (OM Detentora do Recurso)
    registrosSuprimentoFundos.forEach(registro => {
        // A OM Detentora é a OM de destino do recurso (om_detentora/ug_detentora)
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        const group = initializeGroup(omDetentora, ugDetentora);
        group.suprimentos.push(registro);
    });
    
    // 4. Agrupar Passagens (OM Detentora do Recurso) - NOVO
    registrosPassagem.forEach(registro => {
        // A OM Detentora é a OM de destino do recurso (om_detentora/ug_detentora)
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        const group = initializeGroup(omDetentora, ugDetentora);
        group.passagens.push(registro);
    });
    
    return groups;
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem]);

  // Calcula os totais gerais de cada ND com base nos registros de Diária e Verba Operacional
  const totaisND = useMemo(() => {
    const totals = {
      nd15: 0, // Diárias (33.90.15)
      nd30: 0, // 33.90.30 (Passagens Aéreas + Verba Operacional ND 30 + Suprimento ND 30)
      nd33: 0, // 33.90.33 (Passagens)
      nd39: 0, // 33.90.39 (Verba Operacional ND 39 + Suprimento ND 39)
      nd00: 0, // 33.90.00 (Vazio por enquanto)
    };

    // 1. Diárias
    registrosDiaria.forEach(r => {
      totals.nd15 += r.valor_nd_15; // Total Diária (Base + Taxa)
      totals.nd30 += r.valor_nd_30; // Passagens Aéreas (deve ser 0, mas mantido por segurança)
    });
    
    // 2. Verba Operacional
    registrosVerbaOperacional.forEach(r => {
        totals.nd30 += r.valor_nd_30;
        totals.nd39 += r.valor_nd_39;
    });
    
    // 3. Suprimento de Fundos
    registrosSuprimentoFundos.forEach(r => {
        totals.nd30 += r.valor_nd_30;
        totals.nd39 += r.valor_nd_39;
    });
    
    // 4. Passagens (NOVO)
    registrosPassagem.forEach(r => {
        totals.nd33 += r.valor_nd_33;
    });

    const totalGND3 = totals.nd15 + totals.nd30 + totals.nd33 + totals.nd39 + totals.nd00;
    
    return {
      ...totals,
      totalGND3,
    };
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem]);
  
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
        description: "O P Trab Operacional foi salvo com sucesso.",
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
  }, [ptrabData, totaisND, fileSuffix, diasOperacao, generateDiariaMemoriaCalculo, registrosDiaria, diretrizesOperacionais, toast, registrosVerbaOperacional, generateVerbaOperacionalMemoriaCalculo, registrosSuprimentoFundos, generateSuprimentoFundosMemoriaCalculo, registrosPassagem]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Operacional');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
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
    const corSomaND = 'FFD9D9D9'; // Cinza para a linha de soma por ND
    
    // NOVOS OBJETOS DE PREENCHIMENTO (FILL)
    const headerFillGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHeader } }; // FFD9D9D9
    const headerFillAzul = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; // FFB4C7E7
    const totalOMFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corGrandTotal } }; // FFE8E8E8
    const totalGeralFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // FFD9D9D9
    // -------------------------------------------

    let currentRow = 1;
    
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
        currentRow++;
    };
    
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
    
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;
    
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO OPERACIONAL DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    // Título corrigido
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO OPERACIONAL'; 
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
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
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
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
    
    const headerRow1 = worksheet.getRow(currentRow);
    headerRow1.getCell('A').value = 'DESPESAS';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO OPERACIONAL';
    
    worksheet.mergeCells(`A${currentRow}:A${currentRow+1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow+1}`);
    worksheet.mergeCells(`C${currentRow}:H${currentRow}`);
    worksheet.mergeCells(`I${currentRow}:I${currentRow+1}`);
    
    const headerRow2 = worksheet.getRow(currentRow + 1);
    headerRow2.getCell('C').value = '33.90.15';
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.39';
    headerRow2.getCell('G').value = '33.90.00';
    headerRow2.getCell('H').value = 'GND 3';
    
    worksheet.columns = [
        { width: 25 }, // A: DESPESAS
        { width: 15 }, // B: OM (UGE) CODUG
        { width: 10 }, // C: 33.90.15
        { width: 10 }, // D: 33.90.30
        { width: 10 }, // E: 33.90.33
        { width: 10 }, // F: 33.90.39
        { width: 10 }, // G: 33.90.00
        { width: 10 }, // H: GND 3
        { width: 50 }, // I: DETALHAMENTO
    ];
    
    // 4️⃣ Ajustar altura das linhas (ESSENCIAL p/ texto aparecer)
    headerRow1.height = 45;
    headerRow2.height = 35;

    // Apply styles to header rows (CORRIGIDO: Aplicando individualmente)
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
    headerRow1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO OPERACIONAL';
    
    headerRow2.getCell('C').value = '33.90.15';
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.33';
    headerRow2.getCell('F').value = '33.90.39';
    headerRow2.getCell('G').value = '33.90.00';
    headerRow2.getCell('H').value = 'GND 3';
    
    currentRow += 2; // Start data rows after the two header rows

    // Dados da Tabela (Agrupados por OM)
    Object.entries(registrosAgrupadosPorOM).forEach(([omKey, group]) => {
        const omName = omKey.split(' (')[0];
        const ug = omKey.split(' (')[1].replace(')', '');
        const article = getArticleForOM(omName); // Determina DO/DA
        
        // Calculate subtotal for this OM
        const subtotalOM = group.diarias.reduce((acc, r) => ({
            nd15: acc.nd15 + r.valor_nd_15,
            nd30: acc.nd30 + r.valor_nd_30,
            nd33: acc.nd33, 
            nd39: acc.nd39, 
            nd00: acc.nd00, 
            totalGND3: acc.totalGND3 + r.valor_total,
        }), { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, totalGND3: 0 });
        
        // Add Verba Operacional totals to subtotal
        group.verbas.forEach(r => {
            subtotalOM.nd30 += r.valor_nd_30;
            subtotalOM.nd39 += r.valor_nd_39;
            subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39;
        });
        
        // Add Suprimento de Fundos totals to subtotal
        group.suprimentos.forEach(r => {
            subtotalOM.nd30 += r.valor_nd_30;
            subtotalOM.nd39 += r.valor_nd_39;
            subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39;
        });
        
        // Add Passagens totals to subtotal (NOVO)
        group.passagens.forEach(r => {
            subtotalOM.nd33 += r.valor_nd_33;
            subtotalOM.totalGND3 += r.valor_nd_33;
        });

        // --- 1. Render Diárias ---
        group.diarias.forEach(registro => {
            const row = worksheet.getRow(currentRow);
            const totalLinha = registro.valor_nd_15 + registro.valor_nd_30; // ND 15 + ND 30 (Passagens)
            
            // A: DESPESAS
            row.getCell('A').value = `DIÁRIAS`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG
            row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.15 (Diárias)
            row.getCell('C').value = registro.valor_nd_15;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // D: 33.90.30 (Passagens Aéreas)
            row.getCell('D').value = registro.valor_nd_30;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // E: 33.90.33 (0)
            row.getCell('E').value = 0;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // F: 33.90.39 (0)
            row.getCell('F').value = 0;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // G: 33.90.00 (0)
            row.getCell('G').value = 0;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = totalLinha;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // I: DETALHAMENTO
            const memoria = generateDiariaMemoriaCalculo(registro, diretrizesOperacionais);
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
        
        // --- 2. Render Verba Operacional ---
        group.verbas.forEach(registro => {
            const row = worksheet.getRow(currentRow);
            const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
            
            // OM Detentora do Recurso
            const omDetentora = registro.om_detentora || registro.organizacao;
            const ugDetentora = registro.ug_detentora || registro.ug;
            
            // A: DESPESAS
            row.getCell('A').value = `VERBA OPERACIONAL`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG (OM Detentora do Recurso)
            row.getCell('B').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.15 (0)
            row.getCell('C').value = 0;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // D: 33.90.30 (Verba ND 30)
            row.getCell('D').value = registro.valor_nd_30;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // E: 33.90.33 (0)
            row.getCell('E').value = 0;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // F: 33.90.39 (Verba ND 39)
            row.getCell('F').value = registro.valor_nd_39;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // G: 33.90.00 (0)
            row.getCell('G').value = 0;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = totalLinha;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // I: DETALHAMENTO
            const memoria = generateVerbaOperacionalMemoriaCalculo(registro);
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
        
        // --- 3. Render Suprimento de Fundos ---
        group.suprimentos.forEach(registro => {
            const row = worksheet.getRow(currentRow);
            const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
            
            // OM Detentora do Recurso
            const omDetentora = registro.om_detentora || registro.organizacao;
            const ugDetentora = registro.ug_detentora || registro.ug;
            
            // A: DESPESAS
            row.getCell('A').value = `SUPRIMENTO DE FUNDOS`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG (OM Detentora do Recurso)
            row.getCell('B').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.15 (0)
            row.getCell('C').value = 0;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // D: 33.90.30 (Suprimento ND 30)
            row.getCell('D').value = registro.valor_nd_30;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // E: 33.90.33 (0)
            row.getCell('E').value = 0;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // F: 33.90.39 (Suprimento ND 39)
            row.getCell('F').value = registro.valor_nd_39;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // G: 33.90.00 (0)
            row.getCell('G').value = 0;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = totalLinha;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // I: DETALHAMENTO
            const memoria = generateSuprimentoFundosMemoriaCalculo(registro);
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
        
        // --- 4. Render Passagens (NOVO) ---
        group.passagens.forEach(registro => {
            const row = worksheet.getRow(currentRow);
            const totalLinha = registro.valor_nd_33;
            
            // OM Detentora do Recurso
            const omDetentora = registro.om_detentora || registro.organizacao;
            const ugDetentora = registro.ug_detentora || registro.ug;
            
            // A: DESPESAS
            row.getCell('A').value = `PASSAGENS`; 
            row.getCell('A').alignment = leftMiddleAlignment; 
            
            // B: OM (UGE) CODUG (OM Detentora do Recurso)
            row.getCell('B').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
            row.getCell('B').alignment = dataCenterMiddleAlignment; 
            
            // C: 33.90.15 (0)
            row.getCell('C').value = 0;
            row.getCell('C').alignment = dataCenterMiddleAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // D: 33.90.30 (0)
            row.getCell('D').value = 0;
            row.getCell('D').alignment = dataCenterMiddleAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // E: 33.90.33 (Passagens ND 33)
            row.getCell('E').value = registro.valor_nd_33;
            row.getCell('E').alignment = dataCenterMiddleAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // F: 33.90.39 (0)
            row.getCell('F').value = 0;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').numFmt = 'R$ #,##0.00';
            row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // G: 33.90.00 (0)
            row.getCell('G').value = 0;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // H: GND 3 (Total da linha)
            row.getCell('H').value = totalLinha;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corND } }; 
            
            // I: DETALHAMENTO
            const memoria = generatePassagemMemoriaCalculo(registro);
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

        // Subtotal Row 1: SOMA POR ND E GP DE DESPESA
        const subtotalSomaRow = worksheet.getRow(currentRow);
        
        // Célula A+B (Cinza)
        subtotalSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalSomaRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalSomaRow.getCell('A').font = headerFontStyle;
        subtotalSomaRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotalOM } }; // Cinza
        subtotalSomaRow.getCell('A').border = cellBorder;
        
        // Células C, D, E, F, G, H (NDs - Cinza)
        subtotalSomaRow.getCell('C').value = subtotalOM.nd15;
        subtotalSomaRow.getCell('D').value = subtotalOM.nd30;
        subtotalSomaRow.getCell('E').value = subtotalOM.nd33; // 33.90.33
        subtotalSomaRow.getCell('F').value = subtotalOM.nd39; // 33.90.39
        subtotalSomaRow.getCell('G').value = subtotalOM.nd00; // 33.90.00
        subtotalSomaRow.getCell('H').value = subtotalOM.totalGND3; // GND 3 Total
        
        ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
            const cell = subtotalSomaRow.getCell(col);
            cell.alignment = centerMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotalOM } }; // Cinza
            cell.border = cellBorder;
            cell.numFmt = 'R$ #,##0.00';
        });
        
        // Célula I (Cinza)
        subtotalSomaRow.getCell('I').value = '';
        subtotalSomaRow.getCell('I').alignment = centerMiddleAlignment;
        subtotalSomaRow.getCell('I').font = headerFontStyle;
        subtotalSomaRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotalOM } }; // Cinza
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
        subtotalFinalRow.getCell('H').value = subtotalOM.totalGND3;
        subtotalFinalRow.getCell('H').alignment = centerMiddleAlignment;
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
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
    totalGeralSomaRow.getCell('A').font = headerFontStyle;
    totalGeralSomaRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // Cinza
    totalGeralSomaRow.getCell('A').border = cellBorder;

    // Células C, D, E, F, G, H (NDs - MUDADO PARA CINZA)
    totalGeralSomaRow.getCell('C').value = totaisND.nd15;
    totalGeralSomaRow.getCell('D').value = totaisND.nd30;
    totalGeralSomaRow.getCell('E').value = totaisND.nd33;
    totalGeralSomaRow.getCell('F').value = totaisND.nd39;
    totalGeralSomaRow.getCell('G').value = totaisND.nd00;
    totalGeralSomaRow.getCell('H').value = totaisND.totalGND3;

    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        const cell = totalGeralSomaRow.getCell(col);
        cell.alignment = centerMiddleAlignment;
        cell.font = headerFontStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // Cinza
        cell.border = cellBorder;
        cell.numFmt = 'R$ #,##0.00';
    });

    // Célula I (CORRIGIDO: Deve ser cinza)
    totalGeralSomaRow.getCell('I').value = '';
    totalGeralSomaRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralSomaRow.getCell('I').font = headerFontStyle;
    totalGeralSomaRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSomaND } }; // Cinza
    totalGeralSomaRow.getCell('I').border = cellBorder;

    currentRow++;
    
    // Linha 2: VALOR TOTAL
    const totalGeralFinalRow = worksheet.getRow(currentRow);
    
    // Mescla A até G (Colspan 7)
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
    totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment; // Alinhado à direita
    totalGeralFinalRow.getCell('A').font = headerFontStyle;
    totalGeralFinalRow.getCell('A').fill = totalGeralFill; // FFD9D9D9 (Cinza)
    totalGeralFinalRow.getCell('A').border = cellBorder;
    
    // Célula H: Valor Total GND 3 (Cinza)
    totalGeralFinalRow.getCell('H').value = totaisND.totalGND3;
    totalGeralFinalRow.getCell('H').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('H').font = headerFontStyle;
    totalGeralFinalRow.getCell('H').fill = totalGeralFill; // FFD9D9D9 (Cinza)
    totalGeralFinalRow.getCell('H').border = cellBorder;
    totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

    // Célula I: Vazia (Cinza)
    totalGeralFinalRow.getCell('I').value = '';
    totalGeralFinalRow.getCell('I').alignment = centerMiddleAlignment;
    totalGeralFinalRow.getCell('I').font = headerFontStyle;
    totalGeralFinalRow.getCell('I').fill = totalGeralFill; // FFD9D9D9 (Cinza)
    totalGeralFinalRow.getCell('I').border = cellBorder;

    currentRow++;
    
    currentRow++;
    
    // Rodapé
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    localRow.getCell('A').font = { name: 'Arial', size: 10 };
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow += 3;
    
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
    cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas
    currentRow++;
    
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
    cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:I${currentRow}`); // Ajustado para 9 colunas

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
      description: "O relatório Operacional foi salvo com sucesso.",
      duration: 3000,
    });
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, ptrabData, diasOperacao, totaisND, fileSuffix, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generatePassagemMemoriaCalculo, diretrizesOperacionais, toast, registrosAgrupadosPorOM]);


  if (registrosDiaria.length === 0 && registrosVerbaOperacional.length === 0 && registrosSuprimentoFundos.length === 0 && registrosPassagem.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <Briefcase className="h-5 w-5" />
            P Trab Operacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro de Diária, Verba Operacional, Suprimento de Fundos ou Passagem encontrado para este P Trab.</p>
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
            Plano de Trabalho Operacional de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          {/* Título corrigido */}
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Operacional</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        {registrosDiaria.length > 0 || registrosVerbaOperacional.length > 0 || registrosSuprimentoFundos.length > 0 || registrosPassagem.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table-op">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-despesas-op">DESPESAS</th>
                  <th rowSpan={2} className="col-om-op">OM (UGE)<br/>CODUG</th>
                  <th colSpan={6} className="col-nd-group">NATUREZA DE DESPESA</th>
                  <th rowSpan={2} className="col-detalhamento-op">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO OPERACIONAL</th>
                </tr>
                <tr>
                    <th className="col-nd-op-small">33.90.15</th>
                    <th className="col-nd-op-small">33.90.30</th>
                    <th className="col-nd-op-small">33.90.33</th>
                    <th className="col-nd-op-small">33.90.39</th>
                    <th className="col-nd-op-small">33.90.00</th>
                    <th className="col-nd-op-small total-gnd3-cell">GND 3</th>
                </tr>
            </thead>
            <tbody>
              {Object.entries(registrosAgrupadosPorOM).map(([omKey, group]) => {
                const omName = omKey.split(' (')[0];
                const ug = omKey.split(' (')[1].replace(')', '');
                const article = getArticleForOM(omName); // Determina DO/DA
                
                // Calculate subtotal for this OM
                const subtotalOM = group.diarias.reduce((acc, r) => ({
                    nd15: acc.nd15 + r.valor_nd_15,
                    nd30: acc.nd30 + r.valor_nd_30,
                    nd33: acc.nd33, 
                    nd39: acc.nd39, 
                    nd00: acc.nd00, 
                    totalGND3: acc.totalGND3 + r.valor_total,
                }), { nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0, totalGND3: 0 });
                
                group.verbas.forEach(r => {
                    subtotalOM.nd30 += r.valor_nd_30;
                    subtotalOM.nd39 += r.valor_nd_39;
                    subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39;
                });
                
                group.suprimentos.forEach(r => {
                    subtotalOM.nd30 += r.valor_nd_30;
                    subtotalOM.nd39 += r.valor_nd_39;
                    subtotalOM.totalGND3 += r.valor_nd_30 + r.valor_nd_39;
                });
                
                group.passagens.forEach(r => { // NOVO: Passagens
                    subtotalOM.nd33 += r.valor_nd_33;
                    subtotalOM.totalGND3 += r.valor_nd_33;
                });

                return (
                    <React.Fragment key={omKey}>
                        {/* --- 1. Render Diárias --- */}
                        {group.diarias.map((registro, index) => {
                            const totalLinha = registro.valor_nd_15 + registro.valor_nd_30;
                            
                            return (
                                <tr key={`diaria-${registro.id}`} className="expense-row">
                                  <td className="col-despesas-op"> 
                                    DIÁRIAS
                                  </td>
                                  <td className="col-om-op">
                                    <div>{registro.organizacao}</div>
                                    <div>({formatCodug(registro.ug)})</div>
                                  </td>
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_15)}</td>
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_30)}</td>
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.33 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.39 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.00 */}
                                  <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                  <td className="col-detalhamento-op">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {generateDiariaMemoriaCalculo(registro, diretrizesOperacionais)}
                                    </div>
                                  </td>
                                </tr>
                            );
                        })}
                        
                        {/* --- 2. Render Verba Operacional --- */}
                        {group.verbas.map((registro, index) => {
                            const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
                            
                            // OM Detentora do Recurso
                            const omDetentora = registro.om_detentora || registro.organizacao;
                            const ugDetentora = registro.ug_detentora || registro.ug;
                            
                            return (
                                <tr key={`verba-${registro.id}`} className="expense-row">
                                  <td className="col-despesas-op"> 
                                    VERBA OPERACIONAL
                                  </td>
                                  <td className="col-om-op">
                                    <div>{omDetentora}</div>
                                    <div>({formatCodug(ugDetentora)})</div>
                                  </td>
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.15 */}
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_30)}</td> {/* 33.90.30 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.33 */}
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_39)}</td> {/* 33.90.39 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.00 */}
                                  <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                  <td className="col-detalhamento-op">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {generateVerbaOperacionalMemoriaCalculo(registro)}
                                    </div>
                                  </td>
                                </tr>
                            );
                        })}
                        
                        {/* --- 3. Render Suprimento de Fundos --- */}
                        {group.suprimentos.map((registro, index) => {
                            const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
                            
                            // OM Detentora do Recurso
                            const omDetentora = registro.om_detentora || registro.organizacao;
                            const ugDetentora = registro.ug_detentora || registro.ug;
                            
                            return (
                                <tr key={`suprimento-${registro.id}`} className="expense-row">
                                  <td className="col-despesas-op"> 
                                    SUPRIMENTO DE FUNDOS
                                  </td>
                                  <td className="col-om-op">
                                    <div>{omDetentora}</div>
                                    <div>({formatCodug(ugDetentora)})</div>
                                  </td>
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.15 */}
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_30)}</td> {/* 33.90.30 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.33 */}
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_39)}</td> {/* 33.90.39 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.00 */}
                                  <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                  <td className="col-detalhamento-op">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {generateSuprimentoFundosMemoriaCalculo(registro)}
                                    </div>
                                  </td>
                                </tr>
                            );
                        })}
                        
                        {/* --- 4. Render Passagens (NOVO) --- */}
                        {group.passagens.map((registro, index) => {
                            const totalLinha = registro.valor_nd_33;
                            
                            // OM Detentora do Recurso
                            const omDetentora = registro.om_detentora || registro.organizacao;
                            const ugDetentora = registro.ug_detentora || registro.ug;
                            
                            return (
                                <tr key={`passagem-${registro.id}`} className="expense-row">
                                  <td className="col-despesas-op"> 
                                    PASSAGENS
                                  </td>
                                  <td className="col-om-op">
                                    <div>{omDetentora}</div>
                                    <div>({formatCodug(ugDetentora)})</div>
                                  </td>
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.15 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.30 */}
                                  <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_33)}</td> {/* 33.90.33 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.39 */}
                                  <td className="col-nd-op-small">{formatCurrency(0)}</td> {/* 33.90.00 */}
                                  <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                  <td className="col-detalhamento-op">
                                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                      {generatePassagemMemoriaCalculo(registro)}
                                    </div>
                                  </td>
                                </tr>
                            );
                        })}

                        
                        {/* Subtotal Row 1: SOMA POR ND E GP DE DESPESA - NDs agora em Cinza (#D9D9D9) */}
                        <tr className="subtotal-om-soma-row">
                            <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                                SOMA POR ND E GP DE DESPESA
                            </td>
                            <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd15)}</td>
                            <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd30)}</td>
                            <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd33)}</td>
                            <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd39)}</td>
                            <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.nd00)}</td>
                            <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(subtotalOM.totalGND3)}</td>
                            <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td>
                        </tr>
                        
                        {/* Subtotal Row 2: VALOR TOTAL DO(A) OM - Cinza Claro (#E8E8E8) */}
                        <tr className="subtotal-om-final-row">
                            <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>
                                VALOR TOTAL {article} {omName}
                            </td>
                            <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>
                                {formatCurrency(subtotalOM.totalGND3)}
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
              
              {/* Grand Total Row 1: SOMA POR ND E GP DE DESPESA - NDs agora em Cinza (#D9D9D9) */}
              <tr className="total-geral-soma-row">
                <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    SOMA POR ND E GP DE DESPESA
                </td>
                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd15)}</td>
                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd30)}</td>
                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd33)}</td>
                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd39)}</td>
                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd00)}</td>
                <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.totalGND3)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL - Mesclando A-G e alinhando à direita */}
              <tr className="total-geral-final-row">
                <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000', borderRight: 'none' }}>
                    VALOR TOTAL
                </td>
                <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                    {formatCurrency(totaisND.totalGND3)}
                </td>
                <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td> {/* Coluna I vazia */}
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro operacional cadastrado.</p>
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
        .ptrab-table-op th, .ptrab-table-op td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } 
        .ptrab-table-op thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-despesas-op { width: 20%; text-align: left; vertical-align: middle; } 
        .col-om-op { width: 10%; text-align: center; vertical-align: top; }
        .col-nd-group { background-color: #D9D9D9; font-weight: bold; text-align: center; }
        .col-nd-op-small { 
            width: 7%; 
            text-align: center; 
            vertical-align: middle; 
            background-color: #B4C7E7 !important; /* Fundo Azul para NDs (APENAS LINHAS DE DADOS) */
        }
        .col-detalhamento-op { width: 38%; text-align: left; vertical-align: top; }
        
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
        /* Garante que as NDs no subtotal sejam cinzas */
        .subtotal-om-soma-row .col-nd-op-small {
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
        .subtotal-om-final-row .col-nd-op-small {
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
        .total-geral-soma-row .col-nd-op-small {
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
        .total-geral-final-row .col-nd-op-small {
            background-color: #D9D9D9 !important;
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
          
          /* CORREÇÃO CRÍTICA: Força alinhamento vertical middle para as colunas de dados B a H */
          .expense-row td:nth-child(2), /* Coluna B: OM/CODUG */
          .expense-row td:nth-child(3), /* Coluna C: 33.90.15 */
          .expense-row td:nth-child(4), /* Coluna D: 33.90.30 */
          .expense-row td:nth-child(5), /* Coluna E: 33.90.33 */
          .expense-row td:nth-child(6), /* Coluna F: 33.90.39 */
          .expense-row td:nth-child(7), /* Coluna G: 33.90.00 */
          .expense-row td:nth-child(8) { /* Coluna H: GND 3 */
              vertical-align: middle !important;
          }
          
          /* Coluna A (Despesas) também deve ser middle */
          .expense-row .col-despesas-op {
              vertical-align: middle !important;
          }
          
          /* Coluna I (Detalhamento) deve ser top */
          .expense-row .col-detalhamento-op {
              vertical-align: top !important;
          }
          
          /* NDs nas linhas de DADOS continuam azuis */
          .expense-row .col-nd-op-small { 
              background-color: #B4C7E7 !important; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          .expense-row .total-gnd3-cell {
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

export default PTrabOperacionalReport;