import React, { useMemo, useRef, useCallback } from 'react';
import { PTrabData, HorasVooRegistro, calculateDays, formatDate } from '@/pages/PTrabReportManager';
import { formatCurrency, formatNumber, formatCodug } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plane, FileSpreadsheet, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { formatDateDDMMMAA } from '@/lib/formatUtils';

interface PTrabHorasVooReportProps {
  ptrabData: PTrabData;
  omsOrdenadas: string[];
  gruposPorOM: Record<string, HorasVooRegistro[]>;
  fileSuffix: string;
}

const PTrabHorasVooReport: React.FC<PTrabHorasVooReportProps> = ({
  ptrabData,
  omsOrdenadas,
  gruposPorOM,
  fileSuffix,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Registros desagregados, ordenados por OM
  const registros = useMemo(() => {
    return omsOrdenadas.flatMap(om => gruposPorOM[om] || []);
  }, [omsOrdenadas, gruposPorOM]);

  const totalGeral = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_total, 0);
  }, [registros]);

  const totalND30 = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_nd_30, 0);
  }, [registros]);

  const totalND39 = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_nd_39, 0);
  }, [registros]);
  
  const totalHV = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.quantidade_hv, 0);
  }, [registros]);

  // Lógica para exibir "A CARGO DO COTER"
  const isACargoDoCoter = totalND30 === 0 && totalND39 === 0 && totalHV > 0;
  const valorND30Display = isACargoDoCoter ? 'A CARGO COTER' : formatCurrency(totalND30);
  const valorND39Display = isACargoDoCoter ? 'A CARGO COTER' : formatCurrency(totalND39);
  const valorGND3Display = isACargoDoCoter ? 'A CARGO COTER' : formatCurrency(totalGeral);
  
  const numDias = useMemo(() => {
    return calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  }, [ptrabData.periodo_inicio, ptrabData.periodo_fim]);
  
  const dataAtual = useMemo(() => {
    const date = new Date(ptrabData.updated_at);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
  }, [ptrabData.updated_at]);
  
  const localOM = ptrabData.local_om || 'Localidade-UF';
  const nomeCmtOM = ptrabData.nome_cmt_om || 'NOME DO COMANDANTE';
  const nomeOMExtenso = ptrabData.nome_om_extenso || ptrabData.nome_om;
  const comandoMilitarArea = ptrabData.comando_militar_area || 'COMANDO MILITAR DE ÁREA';
  
  // OM Gestora Fixa para o relatório de HV, com quebra de linha
  const OM_GESTORA_HV = 'DMAvEx/COLOG Gestor\n(160.504)'; 

  // --- FUNÇÕES DE EXPORTAÇÃO ---

  const generateFileName = useCallback((reportType: 'PDF' | 'Excel') => {
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
  }, [ptrabData, fileSuffix]);

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
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
      toast({
        title: "PDF Exportado!",
        description: "O P Trab Hora de Voo foi salvo com sucesso.",
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
  }, [generateFileName, toast]);

  const exportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Horas Voo');

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
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
    
    // Cores padronizadas
    const corHeader = 'FFD9D9D9'; // Cinza padrão para o cabeçalho da tabela (A, B, C, G)
    const corND = 'FFB4C7E7'; // Azul para as NDs
    const corSubtotal = 'FFE8E8E8'; // Cinza claro para o subtotal (Linha 1)
    const corTotalFinal = 'FFD9D9D9'; // Cinza padrão para o total geral (Linha 2)
    
    const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } }; // D9D9D9
    const headerFillAzul = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corND } };
    const subtotalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotal } }; // E8E8E8
    const totalFinalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalFinal } }; // D9D9D9

    let currentRow = 1;
    
    const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
        currentRow++;
    };
    
    addHeaderRow('MINISTÉRIO DA DEFESA');
    addHeaderRow('EXÉRCITO BRASILEIRO');
    addHeaderRow(comandoMilitarArea.toUpperCase());
    
    const omExtensoRow = worksheet.getRow(currentRow);
    omExtensoRow.getCell(1).value = nomeOMExtenso.toUpperCase();
    omExtensoRow.getCell(1).font = titleFontStyle;
    omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
    currentRow++;
    
    const fullTitleRow = worksheet.getRow(currentRow);
    fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
    fullTitleRow.getCell(1).font = titleFontStyle;
    fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
    currentRow++;

    const shortTitleRow = worksheet.getRow(currentRow);
    shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO LOGÍSTICO - Hora de Voo'; 
    shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
    shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
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
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
        currentRow++;
    };
    
    addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
    addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${numDias}`);
    addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares do Exército Brasileiro`);
    addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
    
    const despesasRow = worksheet.getRow(currentRow);
    despesasRow.getCell(1).value = '5. DESPESAS OPERACIONAIS:';
    despesasRow.getCell(1).font = headerFontStyle;
    currentRow++;
    
    // --- CABEÇALHO DA TABELA ---
    const headerRow1 = worksheet.getRow(currentRow);
    headerRow1.getCell('A').value = 'DESPESAS (ORDENAR POR CLASSE DE SUBSISTÊNCIA)';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'MUNICÍPIO(S)/ LOCALIDADE(S)';
    headerRow1.getCell('D').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('G').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
    
    worksheet.mergeCells(`A${currentRow}:A${currentRow+1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow+1}`);
    worksheet.mergeCells(`C${currentRow}:C${currentRow+1}`);
    worksheet.mergeCells(`D${currentRow}:F${currentRow}`);
    worksheet.mergeCells(`G${currentRow}:G${currentRow+1}`);
    
    const headerRow2 = worksheet.getRow(currentRow + 1);
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.39';
    headerRow2.getCell('F').value = 'GND 3';
    
    worksheet.columns = [
        { width: 25 }, // A: DESPESAS
        { width: 15 }, // B: OM (UGE) CODUG
        { width: 20 }, // C: MUNICÍPIO
        { width: 10 }, // D: 33.90.30
        { width: 10 }, // E: 33.90.39
        { width: 10 }, // F: GND 3
        { width: 50 }, // G: DETALHAMENTO
    ];
    
    headerRow1.height = 45;
    headerRow2.height = 35;

    const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    
    headerCols.forEach(col => {
        const cell1 = headerRow1.getCell(col);
        cell1.font = headerFontStyle;
        cell1.alignment = centerMiddleAlignment;
        cell1.border = cellBorder;
        
        const cell2 = headerRow2.getCell(col);
        cell2.font = headerFontStyle;
        cell2.alignment = centerMiddleAlignment;
        cell2.border = cellBorder;

        if (col === 'A' || col === 'B' || col === 'C' || col === 'G') {
            cell1.fill = headerFillGray; // D9D9D9
            cell2.value = '';
            cell2.fill = headerFillGray; // D9D9D9
        } else {
            cell1.fill = headerFillAzul; 
            cell2.fill = headerFillAzul; 
        }
    });
    
    // Reaplicar valores para garantir que não sejam perdidos
    headerRow1.getCell('A').value = 'DESPESAS (ORDENAR POR CLASSE DE SUBSISTÊNCIA)';
    headerRow1.getCell('B').value = 'OM (UGE)\nCODUG';
    headerRow1.getCell('C').value = 'MUNICÍPIO(S)/ LOCALIDADE(S)';
    headerRow1.getCell('D').value = 'NATUREZA DE DESPESA';
    headerRow1.getCell('G').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
    
    headerRow2.getCell('D').value = '33.90.30';
    headerRow2.getCell('E').value = '33.90.39';
    headerRow2.getCell('F').value = 'GND 3';
    
    currentRow += 2; 

    // --- LINHAS DE DADOS DESAGREGADAS ---
    
    // Variáveis para rastrear a OM Detentora atual para mesclagem
    let startRowOM = currentRow;
    
    registros.forEach((registro, index) => {
        // Usamos a OM Gestora fixa para a coluna B
        const omGestoraDisplay = OM_GESTORA_HV.replace('\n', ' '); // No Excel, usamos espaço para evitar problemas de formatação complexa na mesclagem.
        
        const isCoterRegistro = registro.valor_nd_30 === 0 && registro.valor_nd_39 === 0;
        
        // Detalhamento / Memória de Cálculo (Ajustado conforme solicitação)
        const memoria = registro.detalhamento_customizado || 
                        `33.90.30 – Aquisição de Suprimento de Aviação, referente a ${formatNumber(registro.quantidade_hv, 2)} HV na Anv ${registro.tipo_anv}. \n\nAmparo: ${registro.amparo || 'N/I'}`; // Removido o ponto final fixo
        
        const dataRow = worksheet.getRow(currentRow);
        
        // A: DESPESAS (Removendo o tipo de aeronave)
        dataRow.getCell('A').value = `Horas de voo Anv Aviação do Exército`; 
        dataRow.getCell('A').alignment = leftTopAlignment; 
        dataRow.getCell('A').font = baseFontStyle;
        
        // B: OM (UGE) CODUG (OM Gestora Fixa)
        dataRow.getCell('B').value = omGestoraDisplay;
        dataRow.getCell('B').alignment = dataCenterMiddleAlignment; 
        dataRow.getCell('B').font = baseFontStyle;
        
        // C: MUNICÍPIO (Apenas o município)
        dataRow.getCell('C').value = registro.municipio;
        dataRow.getCell('C').alignment = dataCenterMiddleAlignment; 
        dataRow.getCell('C').font = baseFontStyle;
        
        // D: 33.90.30
        dataRow.getCell('D').value = registro.valor_nd_30;
        dataRow.getCell('D').alignment = dataCenterMiddleAlignment;
        dataRow.getCell('D').numFmt = 'R$ #,##0.00';
        dataRow.getCell('D').fill = headerFillAzul; 
        dataRow.getCell('D').font = baseFontStyle;
        
        // E: 33.90.39
        dataRow.getCell('E').value = registro.valor_nd_39;
        dataRow.getCell('E').alignment = dataCenterMiddleAlignment;
        dataRow.getCell('E').numFmt = 'R$ #,##0.00';
        dataRow.getCell('E').fill = headerFillAzul; 
        dataRow.getCell('E').font = baseFontStyle;
        
        // F: GND 3
        dataRow.getCell('F').value = registro.valor_total;
        dataRow.getCell('F').alignment = dataCenterMiddleAlignment;
        dataRow.getCell('F').numFmt = 'R$ #,##0.00';
        dataRow.getCell('F').fill = headerFillAzul; 
        dataRow.getCell('F').font = baseFontStyle;
        
        // G: DETALHAMENTO
        dataRow.getCell('G').value = memoria;
        dataRow.getCell('G').alignment = leftTopAlignment; 
        dataRow.getCell('G').font = { name: 'Arial', size: 6.5 };
        
        // Apply borders
        headerCols.forEach(col => {
            dataRow.getCell(col).border = cellBorder;
        });
        currentRow++;
    });
    
    // Mescla a coluna B para todos os registros, já que agora exibe a OM Gestora fixa
    if (registros.length > 0) {
        worksheet.mergeCells(`B${startRowOM}:B${currentRow - 1}`);
    }
    
    // --- LINHA 1: SUBTOTAL ---
    const subtotalRow = worksheet.getRow(currentRow);
    
    // Mescla A, B, C (Colspan 3)
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    subtotalRow.getCell('A').value = 'SUBTOTAL';
    subtotalRow.getCell('A').alignment = rightMiddleAlignment;
    subtotalRow.getCell('A').font = headerFontStyle;
    subtotalRow.getCell('A').fill = subtotalFill; // E8E8E8
    subtotalRow.getCell('A').border = cellBorder;
    
    // D: 33.90.30
    subtotalRow.getCell('D').value = totalND30;
    subtotalRow.getCell('D').alignment = dataCenterMiddleAlignment;
    subtotalRow.getCell('D').numFmt = 'R$ #,##0.00';
    subtotalRow.getCell('D').fill = headerFillAzul; 
    subtotalRow.getCell('D').border = cellBorder;
    subtotalRow.getCell('D').font = baseFontStyle;
    
    // E: 33.90.39
    subtotalRow.getCell('E').value = totalND39;
    subtotalRow.getCell('E').alignment = dataCenterMiddleAlignment;
    subtotalRow.getCell('E').numFmt = 'R$ #,##0.00';
    subtotalRow.getCell('E').fill = headerFillAzul; 
    subtotalRow.getCell('E').border = cellBorder;
    subtotalRow.getCell('E').font = baseFontStyle;
    
    // F: GND 3
    subtotalRow.getCell('F').value = totalGeral;
    subtotalRow.getCell('F').alignment = dataCenterMiddleAlignment;
    subtotalRow.getCell('F').numFmt = 'R$ #,##0.00';
    subtotalRow.getCell('F').fill = headerFillAzul; 
    subtotalRow.getCell('F').border = cellBorder;
    subtotalRow.getCell('F').font = baseFontStyle;
    
    // G: Vazio
    subtotalRow.getCell('G').value = '';
    subtotalRow.getCell('G').fill = subtotalFill; // E8E8E8
    subtotalRow.getCell('G').border = cellBorder;
    
    currentRow++;
    
    // --- LINHA 2: VALOR TOTAL ---
    const totalRow = worksheet.getRow(currentRow);
    
    // Mescla A até E (Colspan 5)
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    totalRow.getCell('A').value = 'VALOR TOTAL';
    totalRow.getCell('A').alignment = rightMiddleAlignment;
    totalRow.getCell('A').font = headerFontStyle;
    totalRow.getCell('A').fill = totalFinalFill; // D9D9D9
    totalRow.getCell('A').border = cellBorder;
    
    // F: GND 3
    totalRow.getCell('F').value = totalGeral;
    totalRow.getCell('F').alignment = dataCenterMiddleAlignment;
    totalRow.getCell('F').numFmt = 'R$ #,##0.00';
    totalRow.getCell('F').fill = totalFinalFill; // D9D9D9
    totalRow.getCell('F').border = cellBorder;
    totalRow.getCell('F').font = headerFontStyle;
    
    // G: Vazio
    totalRow.getCell('G').value = '';
    totalRow.getCell('G').fill = totalFinalFill; // D9D9D9
    totalRow.getCell('G').border = cellBorder;
    
    currentRow++;
    
    currentRow++;
    
    // Rodapé
    const localRow = worksheet.getRow(currentRow);
    localRow.getCell('A').value = `${localOM}, ${dataAtual}`;
    localRow.getCell('A').font = { name: 'Arial', size: 10 };
    localRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
    currentRow += 3;
    
    const cmtRow = worksheet.getRow(currentRow);
    cmtRow.getCell('A').value = nomeCmtOM.toUpperCase();
    cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
    cmtRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`); 
    currentRow++;
    
    const cargoRow = worksheet.getRow(currentRow);
    cargoRow.getCell('A').value = `Comandante da ${nomeOMExtenso}`;
    cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
    cargoRow.getCell('A').alignment = centerMiddleAlignment;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);

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
      description: "O relatório Hora de Voo foi salvo com sucesso.",
      duration: 3000,
    });
  }, [ptrabData, totalGeral, totalND30, totalND39, totalHV, generateFileName, localOM, nomeCmtOM, nomeOMExtenso, comandoMilitarArea, numDias, dataAtual, toast, registros]);

  // Função para Imprimir (Abre a caixa de diálogo de impressão)
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (registros.length === 0) {
    return (
        <div className="text-center py-16 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Plane className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground">
                P Trab Hora de Voo
            </h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Não há dados de Horas de Voo registrados neste P Trab para gerar o relatório.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
                Verifique se o P Trab possui registros na aba Horas de Voo (AvEx).
            </p>
        </div>
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
        
        {/* CABEÇALHO FORMAL */}
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{comandoMilitarArea.toUpperCase()}</p>
          <p className="text-[11pt] font-bold uppercase">{nomeOMExtenso.toUpperCase()}</p>
          
          {/* Título Principal */}
          <p className="text-[11pt] font-bold uppercase">
            PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO {ptrabData.nome_operacao.toUpperCase()}
          </p>
          
          {/* Título do Relatório (Sublinhado e Contido) */}
          <div className="mx-auto w-fit">
            <p className="text-[11pt] font-bold uppercase underline">
              PLANO DE TRABALHO LOGÍSTICO - Hora de Voo
            </p>
          </div>
        </div>

        {/* INFORMAÇÕES DA OPERAÇÃO */}
        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {numDias}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS:</p>
        </div>

        {/* TABELA DE DESPESAS (DESAGREGADA) */}
        <section className="mb-6 print:mb-4">
          <Table className="w-full border border-black print:border-black [&_th]:p-1 [&_td]:p-1">
            <TableHeader>
              <TableRow className="h-auto bg-gray-100 print:bg-gray-100">
                <TableHead rowSpan={2} className="w-[20%] border border-black text-center align-middle font-bold bg-[#D9D9D9] text-black header-font-size">
                  DESPESAS (ORDENAR POR CLASSE DE SUBSISTÊNCIA)
                </TableHead>
                <TableHead rowSpan={2} className="w-[10%] border border-black text-center align-middle font-bold bg-[#D9D9D9] text-black header-font-size">
                  OM (UGE)<br/>CODUG
                </TableHead>
                <TableHead rowSpan={2} className="w-[15%] border border-black text-center align-middle font-bold bg-[#D9D9D9] text-black header-font-size">
                  MUNICÍPIO(S)/ LOCALIDADE(S)
                </TableHead>
                <TableHead colSpan={3} className="w-[20%] border border-black text-center font-bold bg-[#B4C7E7] text-black header-font-size">
                  NATUREZA DE DESPESA
                </TableHead>
                <TableHead rowSpan={2} className="w-[35%] border border-black text-center align-middle font-bold bg-[#D9D9D9] text-black header-font-size">
                  DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>
                  <span className="font-normal text-[8pt]">(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/><span className="font-bold underline">OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</span></span>
                </TableHead>
              </TableRow>
              <TableRow className="h-auto bg-gray-100 print:bg-gray-100">
                <TableHead className="w-[6.6%] border border-black text-center font-bold bg-[#B4C7E7] text-black header-font-size">
                  33.90.30
                </TableHead>
                <TableHead className="w-[6.6%] border border-black text-center font-bold bg-[#B4C7E7] text-black header-font-size">
                  33.90.39
                </TableHead>
                <TableHead className="w-[6.6%] border border-black text-center font-bold bg-[#B4C7E7] text-black header-font-size">
                  GND 3
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((registro, index) => {
                const isCoterRegistro = registro.valor_nd_30 === 0 && registro.valor_nd_39 === 0;
                
                // Detalhamento / Memória de Cálculo (Ajustado conforme solicitação)
                const memoria = registro.detalhamento_customizado || 
                                `33.90.30 – Aquisição de Suprimento de Aviação, referente a ${formatNumber(registro.quantidade_hv, 2)} HV na Anv ${registro.tipo_anv}. \n\nAmparo: ${registro.amparo || 'N/I'}`;
                
                // OM Gestora Fixa para a coluna B
                const omGestoraDisplay = OM_GESTORA_HV;
                
                return (
                  <TableRow key={registro.id} className="h-auto">
                    <TableCell className="border border-black text-left align-middle text-[8pt]">
                      Horas de voo Anv Aviação do Exército
                    </TableCell>
                    <TableCell className="border border-black text-center align-middle text-[8pt] whitespace-pre-wrap">
                      {omGestoraDisplay}
                    </TableCell>
                    <TableCell className="border border-black text-center align-middle text-[8pt]">
                      {registro.municipio}
                    </TableCell>
                    <TableCell className={`border border-black text-center align-middle bg-[#B4C7E7] text-[8pt] ${isCoterRegistro ? 'font-bold' : ''}`}>
                      {isCoterRegistro ? 'A CARGO COTER' : formatCurrency(registro.valor_nd_30)}
                    </TableCell>
                    <TableCell className={`border border-black text-center align-middle bg-[#B4C7E7] text-[8pt] ${isCoterRegistro ? 'font-bold' : ''}`}>
                      {isCoterRegistro ? 'A CARGO COTER' : formatCurrency(registro.valor_nd_39)}
                    </TableCell>
                    <TableCell className={`border border-black text-center align-middle bg-[#B4C7E7] font-bold text-[8pt] ${isCoterRegistro ? 'text-[8pt]' : ''}`}>
                      {isCoterRegistro ? 'A CARGO COTER' : formatCurrency(registro.valor_total)}
                    </TableCell>
                    <TableCell className="border border-black align-middle whitespace-pre-wrap text-left text-[8pt]">
                      {memoria}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* LINHA 1: SUBTOTAL (ND 30, ND 39, GND 3) */}
              <TableRow className="h-auto font-bold bg-[#E8E8E8] print:bg-[#E8E8E8]">
                <TableCell colSpan={3} className="border border-black text-right bg-[#E8E8E8] text-[8pt]">
                  SUBTOTAL
                </TableCell>
                <TableCell className="border border-black text-center bg-[#B4C7E7] text-[8pt]">
                  {formatCurrency(totalND30)}
                </TableCell>
                <TableCell className="border border-black text-center bg-[#B4C7E7] text-[8pt]">
                  {formatCurrency(totalND39)}
                </TableCell>
                <TableCell className="border border-black text-center bg-[#B4C7E7] text-[8pt]">
                  {formatCurrency(totalGeral)}
                </TableCell>
                <TableCell className="border border-black bg-[#E8E8E8]">
                  {/* Vazio */}
                </TableCell>
              </TableRow>

              {/* LINHA 2: VALOR TOTAL (GND 3) */}
              <TableRow className="h-auto font-bold bg-[#D9D9D9] print:bg-[#D9D9D9]">
                <TableCell colSpan={5} className="border border-black text-right bg-[#D9D9D9] text-[9pt]">
                  VALOR TOTAL
                </TableCell>
                <TableCell className="border border-black text-center bg-[#D9D9D9] text-[9pt]">
                  {formatCurrency(totalGeral)}
                </TableCell>
                <TableCell className="border border-black bg-[#D9D9D9]">
                  {/* Vazio */}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* RODAPÉ PADRONIZADO */}
        <div className="ptrab-footer print-avoid-break">
          <p className="text-[10pt]">{localOM}, {dataAtual}.</p>
          <div className="signature-block">
            <p className="text-[10pt] font-bold">{nomeCmtOM.toUpperCase()}</p>
            <p className="text-[9pt]">Comandante da {nomeOMExtenso}</p>
          </div>
        </div>
      </div>
      
      {/* ESTILOS CSS INLINE PARA CONTROLE FINO DE IMPRESSÃO */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0.5cm;
        }
        
        /* REGRAS DE ESTILO UNIFICADAS (TELA E IMPRESSÃO) */
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; margin: 0; padding: 0; } /* ZERANDO MARGENS PADRÃO DO P */
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; } /* Espaçamento mínimo entre itens */
        
        /* Estilos da Tabela */
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; }
        .ptrab-table thead th { background-color: #D9D9D9; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* NOVO: Classe para ajustar o tamanho da fonte do cabeçalho da tabela para 9pt */
        .header-font-size { font-size: 9pt !important; }
        
        /* Cores específicas para Horas de Voo */
        .bg-\\[\\#B4C7E7\\] { background-color: #B4C7E7 !important; }
        .bg-\\[\\#E8E8E8\\] { background-color: #E8E8E8 !important; }
        .bg-\\[\\#D9D9D9\\] { background-color: #D9D9D9 !important; }

        /* RODAPÉ PADRONIZADO */
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
        .signature-block p { margin: 0; padding: 0; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: A4 landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          
          /* Garante que as cores de fundo sejam impressas */
          .bg-\\[\\#B4C7E7\\], .bg-\\[\\#E8E8E8\\], .bg-\\[\\#D9D9D9\\], .bg-gray-100 {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
          
          /* Ajuste fino para a tabela */
          section table {
            font-size: 8pt !important; /* Força 8pt para o corpo da tabela */
          }
          
          /* Ajuste fino para o total final (9pt) */
          section table tbody tr:last-child td {
            font-size: 9pt !important;
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

export default PTrabHorasVooReport;