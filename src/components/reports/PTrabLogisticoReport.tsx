import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PTrabData,
  ClasseIRegistro,
  ClasseIIRegistro,
  ClasseIIIRegistro,
  GrupoOM,
  CLASSE_V_CATEGORIES,
  CLASSE_VI_CATEGORIES,
  CLASSE_VII_CATEGORIES,
  CLASSE_VIII_CATEGORIES,
  CLASSE_IX_CATEGORIES,
  calculateDays,
  formatDate,
  formatFasesParaTexto,
  getClasseIILabel,
  generateClasseIMemoriaCalculo,
  generateClasseIIMemoriaCalculo,
  generateClasseIXMemoriaCalculo,
  calculateItemTotalClasseIX,
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager

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
  onExportSuccess: () => void;
  showCompleteStatusDialog: boolean;
  setShowCompleteStatusDialog: (show: boolean) => void;
  handleConfirmCompleteStatus: () => void;
  handleCancelCompleteStatus: () => void;
}

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
  registrosClasseI,
  registrosClasseII,
  registrosClasseIII,
  nomeRM,
  omsOrdenadas,
  gruposPorOM,
  calcularTotaisPorOM,
  onExportSuccess,
  showCompleteStatusDialog,
  setShowCompleteStatusDialog,
  handleConfirmCompleteStatus,
  handleCancelCompleteStatus,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento !== 'LUBRIFICANTE_GERADOR' && r.tipo_equipamento !== 'LUBRIFICANTE_EMBARCACAO' && r.tipo_equipamento !== 'LUBRIFICANTE_CONSOLIDADO';

  // 1. Recalcular Totais Gerais (para HTML/PDF)
  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasLubrificante[0]?.registro.organizacao || '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasLubrificante[0]?.registro.organizacao || '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalValorCombustivel = useMemo(() => registrosClasseIII.filter(isCombustivel).reduce((acc, reg) => acc + reg.valor_total, 0), [registrosClasseIII]);
  
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
  const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivel;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);

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
        orientation: 'landscape',
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

      const fileName = `PTrab_Logistico_${ptrabData?.numero_ptrab}.pdf`;
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
  }, [ptrabData, onExportSuccess, toast, gruposPorOM, calcularTotaisPorOM, registrosClasseIII]);

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
    const rightTopAlignment = { horizontal: 'right' as const, vertical: 'top' as const, wrapText: true };
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    
    // Cores padronizadas para o Excel (ARGB)
    const corAzul = 'FFB4C7E7'; // Natureza de Despesa (33.90.30/39/Total)
    const corLaranja = 'FFF8CBAD'; // Combustível (Litros/Preço Unitário/Preço Total)
    const corSubtotal = 'FFD3D3D3'; // SOMA POR ND E GP DE DESPESA (Fundo cinza)
    const corTotalOM = 'FFE8E8E8'; // VALOR TOTAL DO OM (Fundo cinza muito claro)
    // -------------------------------------------

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('P Trab Logístico');
      
      worksheet.columns = [
        { width: 35 }, // A - DESPESAS
        { width: 20 }, // B - OM (UGE) CODUG
        { width: 15 }, // C - 33.90.30
        { width: 15 }, // D - 33.90.39
        { width: 15 }, // E - TOTAL ND
        { width: 15 }, // F - LITROS
        { width: 15 }, // G - PREÇO UNITÁRIO
        { width: 18 }, // H - PREÇO TOTAL
        { width: 70 }, // I - DETALHAMENTO
      ];
      
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
      
      const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
      
      const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        
        row.getCell(1).value = {
          richText: [
            { text: label, font: titleFontStyle },
            { text: ` ${value}`, font: { name: 'Arial', size: 11, bold: false } }
          ]
        };
        
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell(1).value = '5. DESPESAS OPERACIONAIS:';
      despesasRow.getCell(1).font = titleFontStyle;
      currentRow++;
      
      const headerRow1 = currentRow;
      const headerRow2 = currentRow + 1;
      
      const hdr1 = worksheet.getRow(headerRow1);
      hdr1.getCell('A').value = 'DESPESAS\n(ORDENAR POR CLASSE DE SUBSISTÊNCIA)';
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      hdr1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
      
      worksheet.mergeCells(`A${headerRow1}:A${headerRow2}`);
      worksheet.mergeCells(`B${headerRow1}:B${headerRow2}`);
      worksheet.mergeCells(`C${headerRow1}:E${headerRow1}`);
      worksheet.mergeCells(`F${headerRow1}:H${headerRow1}`);
      worksheet.mergeCells(`I${headerRow1}:I${headerRow2}`);
      
      const hdr2 = worksheet.getRow(headerRow2);
      hdr2.getCell('C').value = '33.90.30';
      hdr2.getCell('D').value = '33.90.39';
      hdr2.getCell('E').value = 'TOTAL';
      hdr2.getCell('F').value = 'LITROS';
      hdr2.getCell('G').value = 'PREÇO\nUNITÁRIO';
      hdr2.getCell('H').value = 'PREÇO\nTOTAL';
      
      const headerStyle = {
        font: headerFontStyle,
        alignment: centerMiddleAlignment,
        border: cellBorder
      };
      
      ['A', 'B', 'C', 'F', 'I'].forEach(col => {
        hdr1.getCell(col).style = headerStyle;
      });
      
      ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        hdr2.getCell(col).style = headerStyle;
      });
      
      // Aplica cores de fundo nos cabeçalhos
      hdr1.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr1.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      hdr2.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr2.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr2.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr2.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      hdr2.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      hdr2.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      
      currentRow = headerRow2 + 1;

      // Reusable alignment styles for data
      const dataCurrencyStyle = { horizontal: 'right' as const, vertical: 'top' as const, wrapText: true };
      const dataTextStyle = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
      
      omsOrdenadas.forEach((nomeOM) => {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasLubrificante.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
          return;
        }
        
        const linhasDespesaOrdenadas = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...grupo.linhasLubrificante,
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI,
            ...grupo.linhasClasseVII,
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX,
        ];
        
        linhasDespesaOrdenadas.forEach((linha) => {
          const row = worksheet.getRow(currentRow);
          
          let despesasValue = '';
          let omValue = '';
          let detalhamentoValue = '';
          let valorC = 0;
          let valorD = 0;
          let valorE = 0;
          
          if ('tipo' in linha) { // Classe I (QS/QR)
            const registro = linha.registro as ClasseIRegistro;
            if (linha.tipo === 'QS') {
              despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
              omValue = `${registro.om_qs}\n(${registro.ug_qs})`;
              valorC = registro.total_qs;
              valorE = registro.total_qs;
              detalhamentoValue = registro.memoria_calculo_qs_customizada || generateClasseIMemoriaCalculo(registro).qs;
            } else { // QR
              despesasValue = `CLASSE I - SUBSISTÊNCIA`;
              omValue = `${registro.organizacao}\n(${registro.ug})`;
              valorC = registro.total_qr;
              valorE = registro.total_qr;
              detalhamentoValue = registro.memoria_calculo_qr_customizada || generateClasseIMemoriaCalculo(registro).qr;
            }
          } else if ('categoria' in linha.registro) { // Classe II, V, VI, VII, VIII, IX
            const registro = linha.registro as ClasseIIRegistro;
            const omDestinoRecurso = registro.organizacao;
            const ugDestinoRecurso = registro.ug;
            
            let secondDivContent = registro.categoria.toUpperCase();
            
            if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                secondDivContent = registro.animal_tipo.toUpperCase();
            }
                
            despesasValue = `${getClasseIILabel(registro.categoria)}\n${secondDivContent}`;
            omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
            valorC = registro.valor_nd_30;
            valorD = registro.valor_nd_39;
            valorE = registro.valor_nd_30 + registro.valor_nd_39;
            
            if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                detalhamentoValue = generateClasseIXMemoriaCalculo(registro);
            } else {
                detalhamentoValue = generateClasseIIMemoriaCalculo(registro);
            }
            
          } else if ('tipo_equipamento' in linha.registro) { // Classe III Lubrificante
            const registro = linha.registro as ClasseIIIRegistro;
            // const tipoEquipamento = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR' ? 'GERADOR' : 'EMBARCAÇÃO';
            
            let despesasLubValue = `CLASSE III - LUBRIFICANTE`;
            despesasValue = despesasLubValue;
            omValue = `${registro.organizacao}\n(${registro.ug})`;
            valorC = registro.valor_total;
            valorE = registro.valor_total;
            detalhamentoValue = registro.detalhamento_customizado || registro.detalhamento || '';
          }
          
          row.getCell('A').value = despesasValue;
          row.getCell('B').value = omValue;
          
          // Colunas Natureza de Despesa (Azul)
          row.getCell('C').value = valorC > 0 ? valorC : '';
          row.getCell('C').numFmt = 'R$ #,##0.00';
          row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
          
          row.getCell('D').value = valorD > 0 ? valorD : '';
          row.getCell('D').numFmt = 'R$ #,##0.00';
          row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
          
          row.getCell('E').value = valorE > 0 ? valorE : '';
          row.getCell('E').numFmt = 'R$ #,##0.00';
          row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
          
          // Colunas Combustível (Laranja) - Vazias para ND
          row.getCell('F').value = '';
          row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          row.getCell('G').value = '';
          row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          row.getCell('H').value = '';
          row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          
          row.getCell('I').value = detalhamentoValue;
          row.getCell('I').font = { name: 'Arial', size: 6.5 };
          
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            row.getCell(col).border = cellBorder;
            row.getCell(col).font = baseFontStyle;
          });
          
          // Aplica alinhamentos específicos para dados
          row.getCell('A').alignment = dataTextStyle;
          row.getCell('B').alignment = centerTopAlignment;
          row.getCell('C').alignment = dataCurrencyStyle;
          row.getCell('D').alignment = dataCurrencyStyle;
          row.getCell('E').alignment = dataCurrencyStyle;
          row.getCell('F').alignment = centerTopAlignment;
          row.getCell('G').alignment = rightTopAlignment;
          row.getCell('H').alignment = rightTopAlignment;
          row.getCell('I').alignment = dataTextStyle;
          
          currentRow++;
        });
        
        // 2. Linhas Combustível (APENAS na RM) - Classe III Combustível
        if (nomeOM === nomeRM) {
          registrosClasseIII.filter(isCombustivel).forEach((registro) => {
            const getTipoEquipamentoLabel = (tipo: string) => {
              switch (tipo) {
                case 'GERADOR': return 'GERADOR';
                case 'EMBARCACAO': return 'EMBARCAÇÃO';
                case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
                case 'MOTOMECANIZACAO': return 'MOTOMECANIZAÇÃO';
                default: return tipo;
              }
            };
            
            const getTipoCombustivelLabel = (tipo: string) => {
              if (tipo === 'DIESEL' || tipo === 'OD') return 'ÓLEO DIESEL';
              if (tipo === 'GASOLINA' || tipo === 'GAS') return 'GASOLINA';
              return tipo;
            };
            
            const row = worksheet.getRow(currentRow);
            
            // Tenta obter a UG da RM a partir de um registro de QS/QR, se existir
            const rmUg = grupo.linhasQS[0]?.registro.ug_qs || grupo.linhasQR[0]?.registro.ug_qs || '';
            
            row.getCell('A').value = `CLASSE III - ${getTipoCombustivelLabel(registro.tipo_combustivel)}\n${getTipoEquipamentoLabel(registro.tipo_equipamento)}\n${registro.organizacao}`;
            row.getCell('B').value = `${nomeRM}\n(${rmUg})`;
            
            // Colunas azuis (C, D, E) - Vazias para Combustível
            row.getCell('C').value = ''; 
            row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
            row.getCell('D').value = ''; 
            row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
            row.getCell('E').value = ''; 
            row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
            
            // Colunas Laranjas (F, G, H) permanecem preenchidas
            row.getCell('F').value = Math.round(registro.total_litros);
            row.getCell('F').numFmt = '#,##0 "L"';
            row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
            
            row.getCell('G').value = registro.preco_litro;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
            
            row.getCell('H').value = registro.valor_total;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
            
            const detalhamentoCombustivel = registro.detalhamento_customizado || registro.detalhamento || '';
            
            row.getCell('I').value = detalhamentoCombustivel;
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
              row.getCell(col).border = cellBorder;
              row.getCell(col).font = baseFontStyle;
            });
            
            // Aplica alinhamentos específicos para dados de Combustível
            row.getCell('A').alignment = dataTextStyle;
            row.getCell('B').alignment = centerTopAlignment;
            row.getCell('C').alignment = centerTopAlignment;
            row.getCell('D').alignment = centerTopAlignment;
            row.getCell('E').alignment = centerTopAlignment;
            row.getCell('F').alignment = centerTopAlignment;
            row.getCell('G').alignment = rightTopAlignment;
            row.getCell('H').alignment = rightTopAlignment;
            row.getCell('I').alignment = dataTextStyle;
            
            currentRow++;
          });
        }
        
        // Subtotal da OM
        const subtotalRow = worksheet.getRow(currentRow);
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        // Cor de fundo para a linha de subtotal
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30;
        subtotalRow.getCell('C').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('C').font = { bold: true };
        subtotalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('C').style = { ...subtotalRow.getCell('C').style, alignment: rightMiddleAlignment, border: cellBorder };
        
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalRow.getCell('D').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('D').font = { bold: true };
        subtotalRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('D').style = { ...subtotalRow.getCell('D').style, alignment: rightMiddleAlignment, border: cellBorder };

        subtotalRow.getCell('E').value = totaisOM.total_parte_azul;
        subtotalRow.getCell('E').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('E').font = { bold: true };
        subtotalRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('E').style = { ...subtotalRow.getCell('E').style, alignment: rightMiddleAlignment, border: cellBorder };
        
        // Colunas F, G, H (Combustível)
        subtotalRow.getCell('F').value = nomeOM === nomeRM && totaisOM.totalDieselLitros > 0 ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` : '';
        subtotalRow.getCell('F').font = { bold: true };
        subtotalRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('F').style = { ...subtotalRow.getCell('F').style, alignment: centerMiddleAlignment, border: cellBorder };
        
        subtotalRow.getCell('G').value = nomeOM === nomeRM && totaisOM.totalGasolinaLitros > 0 ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` : '';
        subtotalRow.getCell('G').font = { bold: true };
        subtotalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('G').style = { ...subtotalRow.getCell('G').style, alignment: centerMiddleAlignment, border: cellBorder };
        
        subtotalRow.getCell('H').value = totaisOM.total_combustivel > 0 ? totaisOM.total_combustivel : '';
        subtotalRow.getCell('H').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('H').font = { bold: true };
        subtotalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('H').style = { ...subtotalRow.getCell('H').style, alignment: rightMiddleAlignment, border: cellBorder };
        
        ['A', 'B', 'I'].forEach(col => {
            subtotalRow.getCell(col).border = cellBorder;
            // Aplica cor de fundo cinza claro para as células não coloridas (A, B, I)
            if (!subtotalRow.getCell(col).fill) {
                subtotalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
            }
        });
        
        currentRow++;
        
        const totalOMRow = worksheet.getRow(currentRow);
        totalOMRow.getCell('A').value = `VALOR TOTAL DO ${nomeOM}`;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        totalOMRow.getCell('A').alignment = rightMiddleAlignment;
        totalOMRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        totalOMRow.getCell('E').value = totaisOM.total_gnd3;
        totalOMRow.getCell('E').numFmt = 'R$ #,##0.00';
        totalOMRow.getCell('E').font = { bold: true };
        totalOMRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('E').style = { ...totalOMRow.getCell('E').style, alignment: rightMiddleAlignment, border: cellBorder };
        
        ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'I'].forEach(col => {
            totalOMRow.getCell(col).border = cellBorder;
            if (!totalOMRow.getCell(col).fill) {
                totalOMRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
            }
        });
        
        currentRow++;
      });
      
      currentRow++;
      
      // CÁLCULO TOTAL GERAL
      const totalDiesel = registrosClasseIII.filter(isCombustivel)
        .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
        .reduce((acc, reg) => acc + reg.total_litros, 0);
      const totalGasolina = registrosClasseIII.filter(isCombustivel)
        .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
        .reduce((acc, reg) => acc + reg.total_litros, 0);
      const totalValorCombustivelFinal = totalValorCombustivel;
      
      const somaRow = worksheet.getRow(currentRow);
      somaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      somaRow.getCell('A').alignment = rightMiddleAlignment;
      somaRow.getCell('A').font = { bold: true };
      
      somaRow.getCell('C').value = totalGeral_33_90_30;
      somaRow.getCell('C').numFmt = 'R$ #,##0.00';
      somaRow.getCell('C').font = { bold: true };
      somaRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('C').style = { ...somaRow.getCell('C').style, alignment: rightMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('D').value = totalGeral_33_90_39;
      somaRow.getCell('D').numFmt = 'R$ #,##0.00';
      somaRow.getCell('D').font = { bold: true };
      somaRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('D').style = { ...somaRow.getCell('D').style, alignment: rightMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('E').value = totalGeral_GND3_ND;
      somaRow.getCell('E').numFmt = 'R$ #,##0.00';
      somaRow.getCell('E').font = { bold: true };
      somaRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('E').style = { ...somaRow.getCell('E').style, alignment: rightMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('F').value = totalDiesel > 0 ? `${formatNumber(totalDiesel)} L OD` : '';
      somaRow.getCell('F').font = { bold: true };
      somaRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      somaRow.getCell('F').style = { ...somaRow.getCell('F').style, alignment: centerMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('G').value = totalGasolina > 0 ? `${formatNumber(totalGasolina)} L GAS` : '';
      somaRow.getCell('G').font = { bold: true };
      somaRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      somaRow.getCell('G').style = { ...somaRow.getCell('G').style, alignment: centerMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('H').value = totalValorCombustivelFinal > 0 ? totalValorCombustivelFinal : '';
      somaRow.getCell('H').numFmt = 'R$ #,##0.00';
      somaRow.getCell('H').font = { bold: true };
      somaRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      somaRow.getCell('H').style = { ...somaRow.getCell('H').style, alignment: rightMiddleAlignment, border: cellBorder };
      
      ['A', 'B', 'I'].forEach(col => {
        somaRow.getCell(col).border = cellBorder;
        if (!somaRow.getCell(col).fill) {
            somaRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
        }
      });
      
      currentRow++;
      
      const valorTotalRow = worksheet.getRow(currentRow);
      valorTotalRow.getCell('G').value = 'VALOR TOTAL';
      valorTotalRow.getCell('G').font = { bold: true };
      valorTotalRow.getCell('G').alignment = centerMiddleAlignment;
      
      valorTotalRow.getCell('H').value = valorTotalSolicitado;
      valorTotalRow.getCell('H').numFmt = 'R$ #,##0.00';
      valorTotalRow.getCell('H').font = { bold: true };
      valorTotalRow.getCell('H').alignment = centerMiddleAlignment;
      
      ['G', 'H'].forEach(col => {
        valorTotalRow.getCell(col).border = cellBorder;
      });
      
      currentRow++;
      
      const gndLabelRow = worksheet.getRow(currentRow);
      gndLabelRow.getCell('H').value = 'GND - 3';
      gndLabelRow.getCell('H').font = { bold: true };
      gndLabelRow.getCell('H').alignment = centerMiddleAlignment;
      gndLabelRow.getCell('H').border = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };
      
      currentRow++;
      
      const gndValueRow = worksheet.getRow(currentRow);
      gndValueRow.getCell('H').value = valorTotalSolicitado;
      gndValueRow.getCell('H').numFmt = 'R$ #,##0.00';
      gndValueRow.getCell('H').font = { bold: true };
      gndValueRow.getCell('H').alignment = centerMiddleAlignment;
      gndValueRow.getCell('H').border = {
        left: { style: 'thin' as const },
        bottom: { style: 'thick' as const },
        right: { style: 'thin' as const }
      };
      
      currentRow++;
      
      currentRow++;
      
      const localRow = worksheet.getRow(currentRow);
      localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      localRow.getCell('A').font = { name: 'Arial', size: 10 };
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const cmtRow = worksheet.getRow(currentRow);
      cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
      cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      const cargoRow = worksheet.getRow(currentRow);
      cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
      cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PTrab_Logistico_${ptrabData.numero_ptrab}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Excel gerado com sucesso!",
        description: `Arquivo exportado com formatação completa.`,
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
  }, [ptrabData, onExportSuccess, toast, gruposPorOM, calcularTotaisPorOM, registrosClasseIII, nomeRM]);

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

      <div className="ptrab-print-container" ref={contentRef}>
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
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        {registrosClasseI.length > 0 || registrosClasseII.length > 0 || registrosClasseIII.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-despesas">DESPESAS<br/>(ORDENAR POR CLASSE DE SUBSISTÊNCIA)</th>
                  <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                  <th colSpan={3} className="col-natureza-header">NATUREZA DE DESPESA</th>
                  <th colSpan={3} className="col-combustivel-header">COMBUSTÍVEL</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                </tr>
                <tr>
                  <th className="col-nd col-natureza">33.90.30</th>
                  <th className="col-nd col-natureza">33.90.39</th>
                  <th className="col-nd col-natureza">TOTAL</th>
                  <th className="col-combustivel">LITROS</th>
                  <th className="col-combustivel">PREÇO<br/>UNITÁRIO</th>
                  <th className="col-combustivel">PREÇO<br/>TOTAL</th>
                </tr>
            </thead>
            <tbody>
              {/* ========== SUBSEÇÕES DINÂMICAS POR OM ========== */}
              {omsOrdenadas.flatMap((nomeOM, omIndex) => {
                const grupo = gruposPorOM[nomeOM];
                const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
                
                // Se o grupo não tem linhas, pula
                if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasLubrificante.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
                  return [];
                }
                
                // Array de todas as linhas de despesa, ordenadas pela sequência romana:
                const linhasDespesaOrdenadas = [
                    ...grupo.linhasQS,
                    ...grupo.linhasQR,
                    ...grupo.linhasClasseII,
                    ...grupo.linhasLubrificante, // Classe III Lubrificante
                    ...grupo.linhasClasseV,
                    ...grupo.linhasClasseVI,
                    ...grupo.linhasClasseVII,
                    ...grupo.linhasClasseVIII,
                    ...grupo.linhasClasseIX, // NOVO
                ];
                
                return [
                  // 1. Renderizar todas as linhas de despesa (I, II, III Lub, V, VI, VII, VIII, IX)
                  ...linhasDespesaOrdenadas.map((linha) => {
                    const isClasseI = 'tipo' in linha;
                    const isClasseII_IX = 'categoria' in linha.registro;
                    const isLubrificante = 'tipo_equipamento' in linha.registro;
                    
                    const rowData = {
                        despesasValue: '',
                        omValue: '',
                        detalhamentoValue: '',
                        valorC: 0,
                        valorD: 0,
                        valorE: 0,
                    };
                    
                    if (isClasseI) { // Classe I (QS/QR)
                        const registro = linha.registro as ClasseIRegistro;
                        if (linha.tipo === 'QS') {
                            rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
                            rowData.omValue = `${registro.om_qs}\n(${registro.ug_qs})`;
                            rowData.valorC = registro.total_qs;
                            rowData.valorE = registro.total_qs;
                            rowData.detalhamentoValue = registro.memoria_calculo_qs_customizada || generateClasseIMemoriaCalculo(registro).qs;
                        } else { // QR
                            rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA`;
                            rowData.omValue = `${registro.organizacao}\n(${registro.ug})`;
                            rowData.valorC = registro.total_qr;
                            rowData.valorE = registro.total_qr;
                            rowData.detalhamentoValue = registro.memoria_calculo_qr_customizada || generateClasseIMemoriaCalculo(registro).qr;
                        }
                    } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                        const registro = linha.registro as ClasseIIRegistro;
                        const omDestinoRecurso = registro.organizacao;
                        const ugDestinoRecurso = registro.ug;
                        
                        let secondDivContent = registro.categoria.toUpperCase();
                        
                        if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                            secondDivContent = registro.animal_tipo.toUpperCase();
                        }
                            
                        rowData.despesasValue = `${getClasseIILabel(registro.categoria)}\n${secondDivContent}`;
                        rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                        rowData.valorC = registro.valor_nd_30;
                        rowData.valorD = registro.valor_nd_39;
                        rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                        
                        if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                            rowData.detalhamentoValue = generateClasseIXMemoriaCalculo(registro);
                        } else {
                            rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro);
                        }
                        
                    } else if (isLubrificante) { // Classe III Lubrificante
                        const registro = linha.registro as ClasseIIIRegistro;
                        // const tipoEquipamento = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR' ? 'GERADOR' : 'EMBARCAÇÃO';
                        
                        let despesasLubValue = `CLASSE III - LUBRIFICANTE`;
                        rowData.despesasValue = despesasLubValue;
                        rowData.omValue = `${registro.organizacao}\n(${registro.ug})`;
                        rowData.valorC = registro.valor_total;
                        rowData.valorE = registro.valor_total;
                        rowData.detalhamentoValue = registro.detalhamento_customizado || registro.detalhamento || '';
                    }
                    
                    return (
                      <tr key={isClasseI ? `${linha.registro.id}-${linha.tipo}` : isLubrificante ? `lub-${linha.registro.id}` : `classe-ii-${linha.registro.id}`}>
                        <td className="col-despesas">
                          {rowData.despesasValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </td>
                        <td className="col-om">
                          {rowData.omValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorC > 0 ? formatCurrency(rowData.valorC) : ''}</td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorD > 0 ? formatCurrency(rowData.valorD) : ''}</td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorE > 0 ? formatCurrency(rowData.valorE) : ''}</td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}></td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}></td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}></td>
                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                          <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {rowData.detalhamentoValue}
                          </pre>
                        </td>
                      </tr>
                    );
                  }),
                  
                  // 2. Linhas Combustível (APENAS na RM) - Classe III Combustível
                  ...(nomeOM === nomeRM ? registrosClasseIII.filter(isCombustivel).map((registro) => {
                    const getTipoEquipamentoLabel = (tipo: string) => {
                      switch (tipo) {
                        case 'GERADOR': return 'GERADOR';
                        case 'EMBARCACAO': return 'EMBARCAÇÃO';
                        case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
                        case 'MOTOMECANIZACAO': return 'MOTOMECANIZAÇÃO';
                        default: return tipo;
                      }
                    };

                    const getTipoCombustivelLabel = (tipo: string) => {
                      if (tipo === 'DIESEL' || tipo === 'OD') {
                        return 'ÓLEO DIESEL';
                      } else if (tipo === 'GASOLINA' || tipo === 'GAS') {
                        return 'GASOLINA';
                      }
                      return tipo;
                    };

                    return (
                      <tr key={`classe-iii-${registro.id}`}>
                        <td className="col-despesas">
                          <div>CLASSE III - {getTipoCombustivelLabel(registro.tipo_combustivel)}</div>
                          <div>{getTipoEquipamentoLabel(registro.tipo_equipamento)}</div>
                          <div>{registro.organizacao}</div>
                        </td>
                        <td className="col-om">
                          <div>{nomeRM}</div>
                          <div>({gruposPorOM[nomeRM]?.linhasQS[0]?.registro.ug_qs || gruposPorOM[nomeRM]?.linhasQR[0]?.registro.ug || 'UG'})</div>
                        </td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}></td> {/* 33.90.30 (Vazio) */}
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}></td> {/* 33.90.39 (Vazio) */}
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}></td> {/* TOTAL (Vazio) */}
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{formatNumber(registro.total_litros)} L</td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{formatCurrency(registro.preco_litro)}</td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{formatCurrency(registro.valor_total)}</td>
                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                          <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {registro.detalhamento_customizado || registro.detalhamento || ''}
                          </pre>
                        </td>
                      </tr>
                    );
                  }) : []),
                  
                  // Subtotal da OM
                  <tr key={`subtotal-${omIndex}`} className="subtotal-row">
                    <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                    {/* Parte Azul (Natureza de Despesa) */}
                    <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_33_90_30)}</td>
                    <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_33_90_39)}</td>
                    <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_parte_azul)}</td> {/* TOTAL ND (C+D) */}
                    {/* Parte Laranja (Combustivel) */}
                    <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                      {nomeOM === nomeRM && totaisOM.totalDieselLitros > 0 
                        ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
                        : ''}
                    </td>
                    <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                      {nomeOM === nomeRM && totaisOM.totalGasolinaLitros > 0 
                        ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
                        : ''}
                    </td>
                    <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                      {nomeOM === nomeRM && totaisOM.total_combustivel > 0 
                        ? formatCurrency(totaisOM.total_combustivel) 
                        : ''}
                    </td>
                    <td></td>
                  </tr>,
                  
                  // Total da OM
                  <tr key={`total-${omIndex}`} className="subtotal-om-row">
                    <td colSpan={4} className="text-right font-bold">
                      VALOR TOTAL DO {nomeOM}
                    </td>
                    <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8' }}>{formatCurrency(totaisOM.total_gnd3)}</td>
                    <td colSpan={3}></td>
                    <td></td>
                  </tr>
                ];
              })}
              
              {/* ========== TOTAL GERAL ========== */}
              {/* Linha em branco para espaçamento */}
              <tr className="spacing-row">
                <td colSpan={9} style={{ height: '20px', border: 'none', backgroundColor: 'transparent' }}></td>
              </tr>
              
              {(() => {
                // Totais de combustível por tipo (para exibição na parte laranja)
                const totalDiesel = registrosClasseIII.filter(isCombustivel)
                  .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
                  .reduce((acc, reg) => acc + reg.total_litros, 0);
                const totalGasolina = registrosClasseIII.filter(isCombustivel)
                  .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
                  .reduce((acc, reg) => acc + reg.total_litros, 0);
                const totalValorCombustivelFinal = totalValorCombustivel;

                return (
                  <>
                    {/* Linha 1: Soma detalhada por ND e GP de Despesa */}
                    <tr className="total-geral-soma-row">
                      <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_30)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_39)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_GND3_ND)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalDiesel > 0 ? `${formatNumber(totalDiesel)} L OD` : ''}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalGasolina > 0 ? `${formatNumber(totalGasolina)} L GAS` : ''}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalValorCombustivelFinal > 0 ? formatCurrency(totalValorCombustivelFinal) : ''}</td>
                      <td style={{ backgroundColor: 'white' }}></td>
                    </tr>

                    {/* Linha 2: Valor Total */}
                    <tr className="total-geral-final-row">
                      <td colSpan={6}></td>
                      <td className="text-center font-bold" style={{ whiteSpace: 'nowrap' }}>VALOR TOTAL</td>
                      <td className="text-center font-bold">{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ backgroundColor: 'white' }}></td>
                    </tr>
                    
                    {/* Linha 3: GND - 3 (dividida em 2 subdivisões) */}
                    {/* Primeira subdivisão: GND - 3 */}
                    <tr style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderTop: '1px solid #000', borderRight: '1px solid #000' }}>GND - 3</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                    
                    {/* Segunda subdivisão: Valor Total */}
                    <tr style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderBottom: '3px solid #000', borderRight: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro logístico cadastrado.</p>
        )}

        <div className="ptrab-footer">
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
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-print-container { padding: 0 !important; margin: 0 !important; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table thead tr { page-break-inside: avoid; page-break-after: auto; }
          .ptrab-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
          .ptrab-table tr { page-break-inside: avoid; break-inside: avoid; }
        }
        .ptrab-print-container { max-width: 100%; margin: 0 auto; padding: 2rem 1rem; font-family: Arial, sans-serif; }
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 2px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; }
        .ptrab-table thead th { background-color: #E8E8E8; font-weight: bold; text-align: center; font-size: 9pt; }
        .col-despesas { width: 14%; text-align: left; }
        .col-om { width: 9%; text-align: center; }
        .col-natureza-header { background-color: #B4C7E7 !important; text-align: center; font-weight: bold; }
        .col-natureza { background-color: #B4C7E7 !important; width: 8%; text-align: center; }
        .col-nd { width: 8%; text-align: center; }
        .col-combustivel-header { background-color: #F8CBAD !important; text-align: center; font-weight: bold; }
        .col-combustivel { background-color: #F8CBAD !important; width: 6%; text-align: center; font-size: 8pt; }
        .col-combustivel-data { background-color: #FFF; text-align: center; width: 6%; }
        .col-valor-natureza { background-color: #B4C7E7 !important; text-align: center; padding: 6px 8px; }
        .col-combustivel-data-filled { background-color: #F8CBAD !important; text-align: center; padding: 6px 8px; }
        .col-detalhamento { width: 28%; text-align: left; }
        .detalhamento-cell { font-size: 6.5pt; line-height: 1.2; }
        .total-row { background-color: #FFFF99; font-weight: bold; }
        .subtotal-row { background-color: #D3D3D3; font-weight: bold; border-top: 2px solid #000; }
        .subtotal-om-row { background-color: #E8E8E8; font-weight: bold; }
        .total-geral-soma-row { background-color: #D3D3D3; font-weight: bold; border-top: 3px solid #000; }
        .total-geral-final-row { background-color: #E8E8E8; font-weight: bold; }
        .total-geral-gnd-row { background-color: #E8E8E8; font-weight: bold; border-bottom: 3px solid #000; }
        .secao-header-row { background-color: #4A7C4E; color: white; font-weight: bold; border-top: 3px solid #000; border-bottom: 3px solid #000; }
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
      `}</style>

      <AlertDialog open={showCompleteStatusDialog} onOpenChange={setShowCompleteStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab "{ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}" foi exportado. Deseja alterar o status para "Arquivado"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmCompleteStatus}>Sim, arquivar</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelCompleteStatus}>Não, manter status atual</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PTrabLogisticoReport;