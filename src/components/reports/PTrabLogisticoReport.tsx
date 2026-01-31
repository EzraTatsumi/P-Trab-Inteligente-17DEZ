import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PTrabData,
  ClasseIRegistro,
  ClasseIIRegistro,
  ClasseIIIRegistro,
  LinhaClasseIII,
  GrupoOM,
  CLASSE_V_CATEGORIES,
  CLASSE_VI_CATEGORIES,
  CLASSE_VII_CATEGORIES,
  CLASSE_VIII_CATEGORIES,
  CLASSE_IX_CATEGORIES,
  calculateDays,
  formatDate,
  getClasseIILabel,
  generateClasseIXMemoriaCalculo,
  getTipoCombustivelLabel,
  LinhaTabela,
  LinhaClasseII,
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
  };
  fileSuffix: string;
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
  generateClasseIIMemoriaCalculo: (
    registro: ClasseIIRegistro, 
    isClasseII: boolean
  ) => string;
  generateClasseVMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIIIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
}

// =================================================================
// FUNÇÕES AUXILIARES DE RÓTULO
// =================================================================

const getTipoEquipamentoLabel = (tipo: string) => {
    switch (tipo) {
        case 'GERADOR': return 'GERADOR';
        case 'EMBARCACAO': return 'EMBARCAÇÃO';
        case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
        default: return tipo;
    }
};

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
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
  
  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';

  // 1. Recalcular Totais Gerais (para HTML/PDF)
  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.omQS || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.omQS || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  
  // NOVO: Cálculo dos totais gerais de combustível (litros e valor)
  const { totalDiesel, totalGasolina, totalValorCombustivelFinal } = useMemo(() => {
    let totalDiesel = 0;
    let totalGasolina = 0;
    let totalValorCombustivelFinal = 0;

    // Itera sobre todas as OMs e soma os totais de combustível (que só estarão preenchidos na RM fornecedora)
    omsOrdenadas.forEach(nomeOM => {
        const grupo = gruposPorOM[nomeOM];
        if (grupo) {
            const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
            totalDiesel += totaisOM.totalDieselLitros;
            totalGasolina += totaisOM.totalGasolinaLitros;
            totalValorCombustivelFinal += totaisOM.total_combustivel;
        }
    });

    return { totalDiesel, totalGasolina, totalValorCombustivelFinal };
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);
  
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
  const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivelFinal;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  // NOVO: Função para gerar o nome do arquivo
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
  }, [ptrabData, toast, diasOperacao, totalGeral_GND3_ND, valorTotalSolicitado, totalGeral_33_90_30, totalGeral_33_90_39, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, fileSuffix, totalDiesel, totalGasolina, totalValorCombustivelFinal]);

  const handlePrint = () => {
    window.print();
  };

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    
    const dataCenterMonetaryAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }; 
    const dataLeftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
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
    
    const corAzul = 'FFB4C7E7';
    const corLaranja = 'FFF8CBAD';
    const corSubtotal = 'FFD3D3D3';
    const corTotalOM = 'FFE8E8E8';
    
    const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
    const headerFillAzul = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corAzul } };
    const headerFillLaranja = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corLaranja } };

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
      omExtensoRow.getCell('A').value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
      omExtensoRow.getCell('A').font = titleFontStyle;
      omExtensoRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      const fullTitleRow = worksheet.getRow(currentRow);
      fullTitleRow.getCell('A').value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
      fullTitleRow.getCell('A').font = titleFontStyle;
      fullTitleRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;

      const shortTitleRow = worksheet.getRow(currentRow);
      shortTitleRow.getCell('A').value = 'PLANO DE TRABALHO LOGÍSTICO';
      shortTitleRow.getCell('A').font = { ...titleFontStyle, underline: true };
      shortTitleRow.getCell('A').alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
      
      const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        
        row.getCell(1).value = {
          richText: [
            { text: label, font: headerFontStyle },
            { text: ` ${value}`, font: { name: 'Arial', size: 11, bold: false } }
          ]
        };
        
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares do Exército Brasileiro`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell('A').value = '5. DESPESAS OPERACIONAIS:';
      despesasRow.getCell('A').font = titleFontStyle;
      currentRow++;
      
      const headerRow1 = currentRow;
      const headerRow2 = currentRow + 1;
      
      // 1️⃣ MESCLAR PRIMEIRO
      worksheet.mergeCells(`A${headerRow1}:A${headerRow2}`);
      worksheet.mergeCells(`B${headerRow1}:B${headerRow2}`);
      worksheet.mergeCells(`C${headerRow1}:E${headerRow1}`);
      worksheet.mergeCells(`F${headerRow1}:H${headerRow1}`);
      worksheet.mergeCells(`I${headerRow1}:I${headerRow2}`);
      
      const hdr1 = worksheet.getRow(headerRow1);
      const hdr2 = worksheet.getRow(headerRow2);
      
      const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

      // 4️⃣ Ajustar altura das linhas (ESSENCIAL p/ texto aparecer)
      hdr1.height = 45;
      hdr2.height = 35;

      // 2️⃣ Aplicar estilos SEM `style =`
      headerCols.forEach(col => {
          // Linha 1 – ÂNCORA
          const cell1 = hdr1.getCell(col);
          cell1.font = headerFontStyle;
          cell1.alignment = centerMiddleAlignment;
          cell1.border = cellBorder;

          if (['A', 'B', 'I'].includes(col)) {
              cell1.fill = headerFillGray;
          } else if (['C', 'D', 'E'].includes(col)) {
              cell1.fill = headerFillAzul;
          } else if (['F', 'G', 'H'].includes(col)) {
              cell1.fill = headerFillLaranja;
          }

          // Linha 2 – DETALHE
          const cell2 = hdr2.getCell(col);
          cell2.font = headerFontStyle;
          cell2.alignment = centerMiddleAlignment;
          cell2.border = cellBorder;

          if (['A', 'B', 'I'].includes(col)) {
              cell2.value = '';
              cell2.fill = headerFillGray;
          } else if (['C', 'D', 'E'].includes(col)) {
              cell2.fill = headerFillAzul;
          } else if (['F', 'G', 'H'].includes(col)) {
              cell2.fill = headerFillLaranja;
          }
      });
      
      // 3️⃣ Setar valores APÓS os estilos
      
      hdr1.getCell('A').value = 'DESPESAS';
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('I').value =
        'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n' +
        '(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\n' +
        'OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
      
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      
      hdr2.getCell('C').value = '33.90.30';
      hdr2.getCell('D').value = '33.90.39';
      hdr2.getCell('E').value = 'TOTAL';
      hdr2.getCell('F').value = 'LITROS';
      hdr2.getCell('G').value = 'PREÇO\nUNITÁRIO';
      hdr2.getCell('H').value = 'PREÇO\nTOTAL';
      
      currentRow = headerRow2 + 1;

      // Iterar sobre as OMs ordenadas
      for (const nomeOM of omsOrdenadas) {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        const isCombustivelCheck = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
        
        if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasClasseIII.length === 0 && (nomeOM !== nomeRM || grupo.linhasClasseIII.filter(l => l.tipo_suprimento !== 'LUBRIFICANTE').length === 0)) {
          continue;
        }
        
        // Linhas de Classe III (Lubrificante e Combustível) - Ordenação interna
        const linhasClasseIIIOrdenadas = grupo.linhasClasseIII.sort((a, b) => {
            if (a.tipo_suprimento === 'LUBRIFICANTE' && b.tipo_suprimento !== 'LUBRIFICANTE') return -1;
            if (a.tipo_suprimento !== 'LUBRIFICANTE' && b.tipo_suprimento === 'LUBRIFICANTE') return 1;
            
            if (a.tipo_suprimento === 'COMBUSTIVEL_DIESEL' && b.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') return -1;
            if (a.tipo_suprimento === 'COMBUSTIVEL_GASOLINA' && b.tipo_suprimento === 'COMBUSTIVEL_DIESEL') return 1;
            
            return a.categoria_equipamento.localeCompare(b.categoria_equipamento);
        });
        
        // Array de todas as linhas de despesa na ordem correta (I, II, V, VI, VII, VIII, IX, III)
        const allExpenseLines = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI, // INCLUÍDO
            ...grupo.linhasClasseVII, // INCLUÍDO
            ...grupo.linhasClasseVIII, // INCLUÍDO
            ...grupo.linhasClasseIX, // INCLUÍDO
            ...linhasClasseIIIOrdenadas,
        ].sort((a, b) => {
            const getClasseOrder = (linha: any) => {
                if ('tipo' in linha) return 1; // Classe I
                if ('categoria_equipamento' in linha) return 3; // Classe III
                
                const cat = linha.registro.categoria;
                if (CLASSE_V_CATEGORIES.includes(cat)) return 5;
                if (CLASSE_VI_CATEGORIES.includes(cat)) return 6;
                if (CLASSE_VII_CATEGORIES.includes(cat)) return 7;
                if (CLASSE_VIII_CATEGORIES.includes(cat)) return 8;
                if (CLASSE_IX_CATEGORIES.includes(cat)) return 9;
                return 2; // Classe II (default)
            };
            
            const orderA = getClasseOrder(a);
            const orderB = getClasseOrder(b);
            
            if (orderA !== orderB) return orderA - orderB;
            
            if ('tipo' in a && 'tipo' in b) {
                return a.tipo.localeCompare(b.tipo);
            }
            if ('categoria_equipamento' in a && 'categoria_equipamento' in b) {
                return a.tipo_suprimento.localeCompare(b.tipo_suprimento);
            }
            
            return 0;
        });

        // Renderizar todas as linhas de despesa (I, II, III, V-IX)
        for (const linha of allExpenseLines) {
            const isClasseI = 'tipo' in linha;
            const isClasseIII = 'categoria_equipamento' in linha;
            const isClasseII_IX = !isClasseI && !isClasseIII;

            if (!linha) continue;
            
            let rowData = {
                despesasValue: '',
                omValue: '',
                detalhamentoValue: '',
                valorC: 0,
                valorD: 0,
                valorE: 0,
                litrosF: '',
                precoUnitarioG: '',
                precoTotalH: '',
            };
            
            let line1 = '';
            let line2 = '';
            
            if (isClasseI) { // Classe I (QS/QR)
                const registro = (linha as LinhaTabela).registro as ClasseIRegistro;
                const tipo = (linha as LinhaTabela).tipo;
                const ug_qs_formatted = formatCodug(registro.ugQS);

                line1 = `CLASSE I - SUBSISTÊNCIA`;

                if (tipo === 'QS') {
                    const omDestino = registro.organizacao;
                    const omFornecedora = registro.omQS;
                    
                    if (omDestino !== omFornecedora) {
                        line2 = omDestino;
                    }
                    
                    rowData.omValue = `${registro.omQS}\n(${ug_qs_formatted})`;
                    rowData.valorC = registro.totalQS;
                    rowData.valorE = registro.totalQS;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                    
                } else { // QR
                    line1 = `CLASSE I - SUBSISTÊNCIA`;
                    rowData.omValue = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
                    rowData.valorC = registro.totalQR;
                    rowData.valorE = registro.totalQR;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                }
                rowData.despesasValue = line1 + (line2 ? `\n${line2}` : '');

            } else if (isClasseIII) { // Classe III (Combustível/Lubrificante)
                const linhaClasseIII = linha as LinhaClasseIII;
                const registro = linhaClasseIII.registro;
                const isCombustivelLinha = linhaClasseIII.tipo_suprimento !== 'LUBRIFICANTE';
                
                const omDetentoraEquipamento = registro.organizacao; 
                const omDestinoRecurso = nomeOM; 
                
                const tipoSuprimentoLabel = isLubrificante(registro) ? 'LUBRIFICANTE' : getTipoCombustivelLabel(linhaClasseIII.tipo_suprimento);
                const categoriaEquipamento = getTipoEquipamentoLabel(linhaClasseIII.categoria_equipamento);
                
                line1 = `CLASSE III - ${tipoSuprimentoLabel}\n${categoriaEquipamento}`;
                
                const isDifferentOm = omDetentoraEquipamento !== omDestinoRecurso;
                
                if (isDifferentOm) {
                    line2 = omDetentoraEquipamento;
                }
                
                const ugDestinoRecurso = registro.ug_detentora || registro.ug;
                const ugDestinoFormatted = formatCodug(ugDestinoRecurso);
                
                let omValue = `${omDestinoRecurso}\n(${ugDestinoFormatted})`;
                
                rowData.despesasValue = line1 + (line2 ? `\n${line2}` : '');
                rowData.omValue = omValue;
                
                if (isCombustivelLinha) {
                    rowData.valorC = 0;
                    rowData.valorD = 0;
                    rowData.valorE = 0;
                    
                    rowData.litrosF = `${formatNumber(linhaClasseIII.total_litros_linha)} L`;
                    rowData.precoUnitarioG = formatCurrency(linhaClasseIII.preco_litro_linha);
                    rowData.precoTotalH = formatCurrency(linhaClasseIII.valor_total_linha);
                    
                } else if (isLubrificante(registro)) {
                    rowData.valorC = linhaClasseIII.valor_total_linha;
                    rowData.valorD = 0;
                    rowData.valorE = linhaClasseIII.valor_total_linha;
                    
                    rowData.litrosF = '';
                    rowData.precoUnitarioG = '';
                    rowData.precoTotalH = '';
                }
                
                rowData.detalhamentoValue = linhaClasseIII.memoria_calculo;
                
            } else if (isClasseII_IX) { // Classes II, V, VI, VII, VIII, IX
                const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                const omDestinoRecurso = registro.organizacao;
                const ugDestinoRecurso = formatCodug(registro.ug);
                
                let categoriaDetalhe = getClasseIILabel(registro.categoria);
                
                if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                    categoriaDetalhe = registro.animal_tipo;
                }
                                            
                const omDetentora = registro.om_detentora || omDestinoRecurso;
                const isDifferentOm = omDetentora !== omDestinoRecurso;
                
                let prefixoClasse = '';
                let generateMemoriaFunc: (r: ClasseIIRegistro) => string;

                // CORREÇÃO: Garantir que a ordem de verificação cubra todas as classes
                if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE V';
                    generateMemoriaFunc = generateClasseVMemoriaCalculo;
                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VI';
                    generateMemoriaFunc = generateClasseVIMemoriaCalculo;
                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VII';
                    generateMemoriaFunc = generateClasseVIIMemoriaCalculo;
                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VIII';
                    generateMemoriaFunc = generateClasseVIIIMemoriaCalculo;
                } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE IX';
                    generateMemoriaFunc = generateClasseIXMemoriaCalculo; 
                } else {
                    // Deve ser Classe II (Equipamento Individual, Proteção Balística, Material de Estacionamento)
                    prefixoClasse = 'CLASSE II';
                    generateMemoriaFunc = (r) => generateClasseIIMemoriaCalculo(r, true);
                }
                
                line1 = `${prefixoClasse} - ${categoriaDetalhe.toUpperCase()}`;
                
                if (isDifferentOm) {
                    line2 = omDetentora;
                }
                
                rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                rowData.valorC = registro.valor_nd_30;
                rowData.valorD = registro.valor_nd_39;
                rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                
                if (registro.detalhamento_customizado) {
                    rowData.detalhamentoValue = registro.detalhamento_customizado;
                } else {
                    rowData.detalhamentoValue = generateMemoriaFunc(registro);
                }
                
                rowData.despesasValue = line1 + (line2 ? `\n${line2}` : '');
            }
            
            // --- Renderização da Linha no Excel ---
            const row = worksheet.getRow(currentRow);
            
            row.getCell('A').value = rowData.despesasValue;
            row.getCell('A').alignment = dataLeftMiddleAlignment;
            row.getCell('A').font = baseFontStyle;
            row.getCell('A').border = cellBorder;
            
            row.getCell('B').value = rowData.omValue;
            row.getCell('B').alignment = dataCenterMiddleAlignment;
            row.getCell('B').font = baseFontStyle;
            row.getCell('B').border = cellBorder;
            
            row.getCell('C').value = rowData.valorC;
            row.getCell('C').alignment = dataCenterMonetaryAlignment;
            row.getCell('C').numFmt = 'R$ #,##0.00';
            row.getCell('C').fill = headerFillAzul;
            row.getCell('C').border = cellBorder;
            
            row.getCell('D').value = rowData.valorD;
            row.getCell('D').alignment = dataCenterMonetaryAlignment;
            row.getCell('D').numFmt = 'R$ #,##0.00';
            row.getCell('D').fill = headerFillAzul;
            row.getCell('D').border = cellBorder;
            
            row.getCell('E').value = rowData.valorE;
            row.getCell('E').alignment = dataCenterMonetaryAlignment;
            row.getCell('E').numFmt = 'R$ #,##0.00';
            row.getCell('E').fill = headerFillAzul;
            row.getCell('E').border = cellBorder;
            
            row.getCell('F').value = rowData.litrosF;
            row.getCell('F').alignment = dataCenterMiddleAlignment;
            row.getCell('F').font = baseFontStyle;
            row.getCell('F').fill = headerFillLaranja;
            row.getCell('F').border = cellBorder;
            
            row.getCell('G').value = rowData.precoUnitarioG;
            row.getCell('G').alignment = dataCenterMiddleAlignment;
            row.getCell('G').font = baseFontStyle;
            row.getCell('G').fill = headerFillLaranja;
            row.getCell('G').border = cellBorder;
            
            row.getCell('H').value = rowData.precoTotalH;
            row.getCell('H').alignment = dataCenterMiddleAlignment;
            row.getCell('H').font = baseFontStyle;
            row.getCell('H').fill = headerFillLaranja;
            row.getCell('H').border = cellBorder;
            
            row.getCell('I').value = rowData.detalhamentoValue;
            row.getCell('I').alignment = leftTopAlignment;
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            row.getCell('I').border = cellBorder;
            
            currentRow++;
        }
        
        // Subtotal Row for OM
        const subtotalRow = worksheet.getRow(currentRow);
        
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = headerFontStyle;
        subtotalRow.getCell('A').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotal } };
        subtotalRow.getCell('A').border = cellBorder;
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30;
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalRow.getCell('E').value = totaisOM.total_parte_azul;
        
        ['C', 'D', 'E'].forEach(col => {
            const cell = subtotalRow.getCell(col);
            cell.alignment = dataCenterMonetaryAlignment;
            cell.font = headerFontStyle;
            cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corAzul } };
            cell.border = cellBorder;
            cell.numFmt = 'R$ #,##0.00';
        });
        
        subtotalRow.getCell('F').value = totaisOM.totalDieselLitros > 0 ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` : '';
        subtotalRow.getCell('G').value = totaisOM.totalGasolinaLitros > 0 ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` : '';
        subtotalRow.getCell('H').value = totaisOM.total_combustivel > 0 ? formatCurrency(totaisOM.total_combustivel) : '';
        
        ['F', 'G', 'H'].forEach(col => {
            const cell = subtotalRow.getCell(col);
            cell.alignment = dataCenterMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corLaranja } };
            cell.border = cellBorder;
        });
        
        subtotalRow.getCell('I').value = '';
        subtotalRow.getCell('I').alignment = centerMiddleAlignment;
        subtotalRow.getCell('I').font = headerFontStyle;
        subtotalRow.getCell('I').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotal } };
        subtotalRow.getCell('I').border = cellBorder;

        currentRow++;
        
        // Total Row for OM
        const totalOMRow = worksheet.getRow(currentRow);
        
        totalOMRow.getCell('A').value = `VALOR TOTAL DO ${nomeOM}`;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        totalOMRow.getCell('A').alignment = rightMiddleAlignment;
        totalOMRow.getCell('A').font = headerFontStyle;
        totalOMRow.getCell('A').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('A').border = cellBorder;
        
        totalOMRow.getCell('E').value = totaisOM.total_gnd3;
        totalOMRow.getCell('E').alignment = dataCenterMonetaryAlignment;
        totalOMRow.getCell('E').font = headerFontStyle;
        totalOMRow.getCell('E').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('E').border = cellBorder;
        totalOMRow.getCell('E').numFmt = 'R$ #,##0.00';
        
        ['F', 'G', 'H', 'I'].forEach(col => {
            const cell = totalOMRow.getCell(col);
            cell.value = '';
            cell.alignment = centerMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
            cell.border = cellBorder;
        });

        currentRow++;
      }
      
      currentRow++;
      
      // ========== TOTAL GERAL ==========
      
      // Linha 1: Soma detalhada por ND e GP de Despesa
      const totalGeralSomaRow = worksheet.getRow(currentRow);
      totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
      totalGeralSomaRow.getCell('A').font = headerFontStyle;
      totalGeralSomaRow.getCell('A').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotal } };
      totalGeralSomaRow.getCell('A').border = cellBorder;

      totalGeralSomaRow.getCell('C').value = totalGeral_33_90_30;
      totalGeralSomaRow.getCell('D').value = totalGeral_33_90_39;
      totalGeralSomaRow.getCell('E').value = totalGeral_GND3_ND;
      
      ['C', 'D', 'E'].forEach(col => {
          const cell = totalGeralSomaRow.getCell(col);
          cell.alignment = dataCenterMonetaryAlignment;
          cell.font = headerFontStyle;
          cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corAzul } };
          cell.border = cellBorder;
          cell.numFmt = 'R$ #,##0.00';
      });
      
      totalGeralSomaRow.getCell('F').value = totalDiesel > 0 ? `${formatNumber(totalDiesel)} L OD` : '';
      totalGeralSomaRow.getCell('G').value = totalGasolina > 0 ? `${formatNumber(totalGasolina)} L GAS` : '';
      totalGeralSomaRow.getCell('H').value = totalValorCombustivelFinal > 0 ? formatCurrency(totalValorCombustivelFinal) : '';
      
      ['F', 'G', 'H'].forEach(col => {
          const cell = totalGeralSomaRow.getCell(col);
          cell.alignment = dataCenterMiddleAlignment;
          cell.font = headerFontStyle;
          cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corLaranja } };
          cell.border = cellBorder;
      });
      
      totalGeralSomaRow.getCell('I').value = '';
      totalGeralSomaRow.getCell('I').alignment = centerMiddleAlignment;
      totalGeralSomaRow.getCell('I').font = headerFontStyle;
      totalGeralSomaRow.getCell('I').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotal } };
      totalGeralSomaRow.getCell('I').border = cellBorder;

      currentRow++;
      
      // Linha 2: VALOR TOTAL
      const totalGeralFinalRow = worksheet.getRow(currentRow);
      
      totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment;
      totalGeralFinalRow.getCell('A').font = headerFontStyle;
      totalGeralFinalRow.getCell('A').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('A').border = cellBorder;
      
      totalGeralFinalRow.getCell('E').value = valorTotalSolicitado;
      totalGeralFinalRow.getCell('E').alignment = dataCenterMonetaryAlignment;
      totalGeralFinalRow.getCell('E').font = headerFontStyle;
      totalGeralFinalRow.getCell('E').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('E').border = cellBorder;
      totalGeralFinalRow.getCell('E').numFmt = 'R$ #,##0.00';
      
      ['F', 'G', 'H', 'I'].forEach(col => {
            const cell = totalGeralFinalRow.getCell(col);
            cell.value = '';
            cell.alignment = centerMiddleAlignment;
            cell.font = headerFontStyle;
            cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corTotalOM } };
            cell.border = cellBorder;
      });

      currentRow++;
      
      // Linha 3: GND - 3 (dividida em 2 subdivisões)
      const gnd3Row1 = worksheet.getRow(currentRow);
      gnd3Row1.getCell('E').value = 'GND - 3';
      gnd3Row1.getCell('E').alignment = centerMiddleAlignment;
      gnd3Row1.getCell('E').font = headerFontStyle;
      gnd3Row1.getCell('E').border = { top: cellBorder.top, left: cellBorder.left, right: cellBorder.right };
      
      currentRow++;
      
      // Segunda subdivisão: Valor Total
      const gnd3Row2 = worksheet.getRow(currentRow);
      gnd3Row2.getCell('E').value = valorTotalSolicitado;
      gnd3Row2.getCell('E').alignment = centerMiddleAlignment;
      gnd3Row2.getCell('E').font = headerFontStyle;
      gnd3Row2.getCell('E').border = { bottom: cellBorder.bottom, left: cellBorder.left, right: cellBorder.right };
      gnd3Row2.getCell('E').numFmt = 'R$ #,##0.00';
      
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
        description: "O P Trab Logístico foi salvo com sucesso.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o arquivo Excel.",
        variant: "destructive",
      });
    }
  }, [ptrabData, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, totalGeral_33_90_30, totalGeral_33_90_39, totalGeral_GND3_ND, valorTotalSolicitado, totalDiesel, totalGasolina, totalValorCombustivelFinal, fileSuffix, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseVMemoriaCalculo, generateClasseVIMemoriaCalculo, generateClasseVIIMemoriaCalculo, generateClasseVIIIMemoriaCalculo]);


  if (!ptrabData) return null;

  // Função auxiliar para renderizar as linhas de despesa no HTML/PDF
  const renderExpenseLines = (allExpenseLines: (LinhaTabela | LinhaClasseII | LinhaClasseIII)[], currentOMName: string) => {
    console.log(`[PTrabLogisticoReport] Rendering ${allExpenseLines.length} expense lines for ${currentOMName}`);

    return allExpenseLines.map((linha, index) => {
        console.log(`[PTrabLogisticoReport] Processing line ${index} for ${currentOMName}:`, linha);
        
        const isClasseI = 'tipo' in linha;
        const isClasseIII = 'categoria_equipamento' in linha;
        const isClasseII_IX = !isClasseI && !isClasseIII;

        if (isClasseII_IX) {
          const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
          console.log(`[PTrabLogisticoReport] Line ${index} is Classe II/IX with category:`, registro.categoria);
        }

        if (!linha) return null;
        
        let rowData = {
            despesasValue: '',
            omValue: '',
            detalhamentoValue: '',
            valorC: 0,
            valorD: 0,
            valorE: 0,
            litrosF: '',
            precoUnitarioG: '',
            precoTotalH: '',
        };
        
        let line1 = '';
        let line2 = '';

        if (isClasseI) { // Classe I (QS/QR)
            const registro = (linha as LinhaTabela).registro as ClasseIRegistro;
            const tipo = (linha as LinhaTabela).tipo;
            const ug_qs_formatted = formatCodug(registro.ugQS);

            line1 = `CLASSE I - SUBSISTÊNCIA`;

            if (tipo === 'QS') {
                const omDestino = registro.organizacao;
                const omFornecedora = registro.omQS;
                
                if (omDestino !== omFornecedora) {
                    line2 = omDestino;
                }
                
                rowData.omValue = `${registro.omQS}<br/>(${ug_qs_formatted})`;
                rowData.valorC = registro.totalQS;
                rowData.valorE = registro.totalQS;
                rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                
            } else { // QR
                line1 = `CLASSE I - SUBSISTÊNCIA`;
                rowData.omValue = `${registro.organizacao}<br/>(${formatCodug(registro.ug)})`;
                rowData.valorC = registro.totalQR;
                rowData.valorE = registro.totalQR;
                rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
            }
            rowData.despesasValue = line1 + (line2 ? `<br/>${line2}` : '');

        } else if (isClasseIII) { // Classe III (Combustível/Lubrificante)
            const linhaClasseIII = linha as LinhaClasseIII;
            const registro = linhaClasseIII.registro;
            const isCombustivelLinha = linhaClasseIII.tipo_suprimento !== 'LUBRIFICANTE';
            
            const omDetentoraEquipamento = registro.organizacao; 
            const omDestinoRecurso = currentOMName; // USANDO O ARGUMENTO CORRIGIDO
            
            const tipoSuprimentoLabel = isLubrificante(registro) ? 'LUBRIFICANTE' : getTipoCombustivelLabel(linhaClasseIII.tipo_suprimento);
            const categoriaEquipamento = getTipoEquipamentoLabel(linhaClasseIII.categoria_equipamento);
            
            line1 = `CLASSE III - ${tipoSuprimentoLabel}<br/>${categoriaEquipamento}`;
            
            const isDifferentOm = omDetentoraEquipamento !== omDestinoRecurso;
            
            if (isDifferentOm) {
                line2 = omDetentoraEquipamento;
            }
            
            const ugDestinoRecurso = registro.ug_detentora || registro.ug;
            const ugDestinoFormatted = formatCodug(ugDestinoRecurso);
            
            let omValue = `${omDestinoRecurso}<br/>(${ugDestinoFormatted})`;
            
            rowData.despesasValue = line1 + (line2 ? `<br/>${line2}` : '');
            rowData.omValue = omValue;
            
            if (isCombustivelLinha) {
                rowData.valorC = 0;
                rowData.valorD = 0;
                rowData.valorE = 0;
                
                rowData.litrosF = `${formatNumber(linhaClasseIII.total_litros_linha)} L`;
                rowData.precoUnitarioG = formatCurrency(linhaClasseIII.preco_litro_linha);
                rowData.precoTotalH = formatCurrency(linhaClasseIII.valor_total_linha);
                
            } else if (isLubrificante(registro)) {
                rowData.valorC = linhaClasseIII.valor_total_linha;
                rowData.valorD = 0;
                rowData.valorE = linhaClasseIII.valor_total_linha;
                
                rowData.litrosF = '';
                rowData.precoUnitarioG = '';
                rowData.precoTotalH = '';
            }
            
            rowData.detalhamentoValue = linhaClasseIII.memoria_calculo;
        } else if (isClasseII_IX) {
            const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
            const omDestinoRecurso = registro.organizacao;
            const ugDestinoRecurso = formatCodug(registro.ug);
            
            let categoriaDetalhe = getClasseIILabel(registro.categoria);
            
            if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                categoriaDetalhe = registro.animal_tipo;
            }
                            
            const omDetentora = registro.om_detentora || omDestinoRecurso;
            const isDifferentOm = omDetentora !== omDestinoRecurso;
            
            let prefixoClasse = '';
            let generateMemoriaFunc: (r: ClasseIIRegistro) => string;

            // Lógica de identificação da classe (garantindo que todas as classes sejam cobertas)
            if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                prefixoClasse = 'CLASSE V';
                generateMemoriaFunc = generateClasseVMemoriaCalculo;
            } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                prefixoClasse = 'CLASSE VI';
                generateMemoriaFunc = generateClasseVIMemoriaCalculo;
            } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                prefixoClasse = 'CLASSE VII';
                generateMemoriaFunc = generateClasseVIIMemoriaCalculo;
            } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                prefixoClasse = 'CLASSE VIII';
                generateMemoriaFunc = generateClasseVIIIMemoriaCalculo;
            } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                prefixoClasse = 'CLASSE IX';
                generateMemoriaFunc = generateClasseIXMemoriaCalculo;
            } else {
                // Classe II (Equipamento Individual, Proteção Balística, Material de Estacionamento)
                prefixoClasse = 'CLASSE II';
                generateMemoriaFunc = (r) => generateClasseIIMemoriaCalculo(r, true);
            }
            
            line1 = `${prefixoClasse} - ${categoriaDetalhe.toUpperCase()}`;
            
            if (isDifferentOm) {
                line2 = omDetentora;
            }
            
            rowData.omValue = `${omDestinoRecurso}<br/>(${ugDestinoRecurso})`;
            rowData.valorC = registro.valor_nd_30;
            rowData.valorD = registro.valor_nd_39;
            rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
            
            if (registro.detalhamento_customizado) {
                rowData.detalhamentoValue = registro.detalhamento_customizado;
            } else {
                rowData.detalhamentoValue = generateMemoriaFunc(registro);
            }
            
            rowData.despesasValue = line1 + (line2 ? `<br/>${line2}` : '');
        }

        return (
            <tr key={`${currentOMName}-${index}`} className="expense-row">
                <td className="col-despesas">
                    <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: rowData.despesasValue }} />
                </td>
                <td className="col-om">
                    <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: rowData.omValue.replace(/\n/g, '<br/>') }} />
                </td>
                <td className="col-nd col-valor-natureza">
                    {rowData.valorC > 0 ? formatCurrency(rowData.valorC) : ''}
                </td>
                <td className="col-nd col-valor-natureza">
                    {rowData.valorD > 0 ? formatCurrency(rowData.valorD) : ''}
                </td>
                <td className="col-nd col-valor-natureza">
                    {rowData.valorE > 0 ? formatCurrency(rowData.valorE) : ''}
                </td>
                <td className="col-combustivel-data-filled">
                    {rowData.litrosF}
                </td>
                <td className="col-combustivel-data-filled">
                    {rowData.precoUnitarioG}
                </td>
                <td className="col-combustivel-data-filled">
                    {rowData.precoTotalH}
                </td>
                <td className="col-detalhamento">
                    <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {rowData.detalhamentoValue}
                    </div>
                </td>
            </tr>
        );
    });
  };

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
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS:</p>
        </div>

        {omsOrdenadas.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-despesas">DESPESAS</th>
                  <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                  <th colSpan={3} className="col-natureza-header">NATUREZA DE DESPESA</th>
                  <th colSpan={3} className="col-combustivel-header">COMBUSTÍVEL</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                </tr>
                <tr>
                  <th className="col-natureza">33.90.30</th>
                  <th className="col-natureza">33.90.39</th>
                  <th className="col-natureza">TOTAL</th>
                  <th className="col-combustivel">LITROS</th>
                  <th className="col-combustivel">PREÇO<br/>UNITÁRIO</th>
                  <th className="col-combustivel">PREÇO<br/>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {omsOrdenadas.map(nomeOM => {
                  const grupo = gruposPorOM[nomeOM];
                  const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
                  
                  const hasRelevantLines = grupo.linhasQS.length > 0 || grupo.linhasQR.length > 0 || grupo.linhasClasseII.length > 0 || grupo.linhasClasseV.length > 0 || grupo.linhasClasseVI.length > 0 || grupo.linhasClasseVII.length > 0 || grupo.linhasClasseVIII.length > 0 || grupo.linhasClasseIX.length > 0 || grupo.linhasClasseIII.length > 0;
                  
                  if (!hasRelevantLines) return null;

                  const linhasClasseIIIOrdenadas = grupo.linhasClasseIII.sort((a, b) => {
                      if (a.tipo_suprimento === 'LUBRIFICANTE' && b.tipo_suprimento !== 'LUBRIFICANTE') return -1;
                      if (a.tipo_suprimento !== 'LUBRIFICANTE' && b.tipo_suprimento === 'LUBRIFICANTE') return 1;
                      
                      if (a.tipo_suprimento === 'COMBUSTIVEL_DIESEL' && b.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') return -1;
                      if (a.tipo_suprimento === 'COMBUSTIVEL_GASOLINA' && b.tipo_suprimento === 'COMBUSTIVEL_DIESEL') return 1;
                      
                      return a.categoria_equipamento.localeCompare(b.categoria_equipamento);
                  });
                  
                  const allExpenseLines = [
                      ...grupo.linhasQS,
                      ...grupo.linhasQR,
                      ...grupo.linhasClasseII,
                      ...grupo.linhasClasseV,
                      ...grupo.linhasClasseVI, // INCLUÍDO
                      ...grupo.linhasClasseVII, // INCLUÍDO
                      ...grupo.linhasClasseVIII, // INCLUÍDO
                      ...grupo.linhasClasseIX, // INCLUÍDO
                      ...linhasClasseIIIOrdenadas,
                  ].sort((a, b) => {
                      const getClasseOrder = (linha: any) => {
                          if ('tipo' in linha) return 1;
                          if ('categoria_equipamento' in linha) return 3;
                          
                          const cat = linha.registro.categoria;
                          if (CLASSE_V_CATEGORIES.includes(cat)) return 5;
                          if (CLASSE_VI_CATEGORIES.includes(cat)) return 6;
                          if (CLASSE_VII_CATEGORIES.includes(cat)) return 7;
                          if (CLASSE_VIII_CATEGORIES.includes(cat)) return 8;
                          if (CLASSE_IX_CATEGORIES.includes(cat)) return 9;
                          return 2;
                      };
                      
                      const orderA = getClasseOrder(a);
                      const orderB = getClasseOrder(b);
                      
                      if (orderA !== orderB) return orderA - orderB;
                      
                      if ('tipo' in a && 'tipo' in b) {
                          return a.tipo.localeCompare(b.tipo);
                      }
                      if ('categoria_equipamento' in a && 'categoria_equipamento' in b) {
                          return a.tipo_suprimento.localeCompare(b.tipo_suprimento);
                      }
                      
                      return 0;
                  });
                  
                  console.log(`[PTrabLogisticoReport] Ordered lines for ${nomeOM}:`, allExpenseLines);
                  console.log(`[PTrabLogisticoReport] All expense lines for ${nomeOM}:`, allExpenseLines);
                  console.log(`[PTrabLogisticoReport] Raw grupo data for ${nomeOM}:`, grupo);


                  return (
                    <React.Fragment key={`${nomeOM}-group`}>
                      {renderExpenseLines(allExpenseLines, nomeOM)}
                      
                      {/* Subtotal Row - SOMA POR ND E GP DE DESPESA */}
                      <tr key={`${nomeOM}-subtotal`} className="subtotal-row">
                        <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                        <td className="col-valor-natureza text-center font-bold">{formatCurrency(totaisOM.total_33_90_30)}</td>
                        <td className="col-valor-natureza text-center font-bold">{formatCurrency(totaisOM.total_33_90_39)}</td>
                        <td className="col-valor-natureza text-center font-bold">{formatCurrency(totaisOM.total_parte_azul)}</td>
                        <td className="col-combustivel-data-filled text-center font-bold border border-black">
                          {totaisOM.totalDieselLitros > 0 
                            ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
                            : ''}
                        </td>
                        <td className="col-combustivel-data-filled text-center font-bold border border-black">
                          {totaisOM.totalGasolinaLitros > 0 
                            ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
                            : ''}
                        </td>
                        <td className="col-combustivel-data-filled text-center font-bold border border-black">
                          {totaisOM.total_combustivel > 0 
                            ? formatCurrency(totaisOM.total_combustivel) 
                            : ''}
                        </td>
                        <td></td>
                      </tr>
                      
                      {/* Total da OM */}
                      <tr key={`${nomeOM}-total`} className="subtotal-om-row">
                        <td colSpan={4} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8' }}>
                          VALOR TOTAL DO {nomeOM}
                        </td>
                        <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8' }}>{formatCurrency(totaisOM.total_gnd3)}</td>
                        <td colSpan={3}></td>
                        <td></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                
                {/* Linha em branco para espaçamento */}
                <tr key="spacing-row" className="spacing-row">
                  <td colSpan={9} style={{ height: '20px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
                </tr>
                
                {/* ========== TOTAL GERAL ========== */}
                
                {/* Linha 1: Soma detalhada por ND e GP de Despesa */}
                <tr key="total-geral-soma-row" className="total-geral-soma-row">
                  <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                  <td className="col-valor-natureza text-center font-bold">{formatCurrency(totalGeral_33_90_30)}</td>
                  <td className="col-valor-natureza text-center font-bold">{formatCurrency(totalGeral_33_90_39)}</td>
                  <td className="col-valor-natureza text-center font-bold">{formatCurrency(totalGeral_GND3_ND)}</td>
                  <td className="col-combustivel-data-filled text-center font-bold border border-black">
                    {totalDiesel > 0 ? `${formatNumber(totalDiesel)} L OD` : ''}
                  </td>
                  <td className="col-combustivel-data-filled text-center font-bold border border-black">
                    {totalGasolina > 0 ? `${formatNumber(totalGasolina)} L GAS` : ''}
                  </td>
                  <td className="col-combustivel-data-filled text-center font-bold border border-black">
                    {totalValorCombustivelFinal > 0 ? formatCurrency(totalValorCombustivelFinal) : ''}
                  </td>
                  <td style={{ backgroundColor: 'white' }}></td>
                </tr>

                {/* Linha 2: Valor Total */}
                <tr key="total-geral-final-row" className="total-geral-final-row">
                  <td colSpan={4} className="text-right font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}>
                    VALOR TOTAL
                  </td>
                  <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                  <td colSpan={4} style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
                </tr>
                
                {/* Linha 3: GND - 3 (dividida em 2 subdivisões) */}
                <tr key="gnd3-row-1" style={{ backgroundColor: 'white' }}>
                  <td colSpan={4} style={{ border: 'none' }}></td>
                  <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderTop: '1px solid #000', borderRight: '1px solid #000' }}>GND - 3</td>
                  <td colSpan={4} style={{ border: 'none' }}></td>
                </tr>
                
                {/* Segunda subdivisão: Valor Total */}
                <tr key="gnd3-row-2" style={{ backgroundColor: 'white' }}>
                  <td colSpan={4} style={{ border: 'none' }}></td>
                  <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                  <td colSpan={4} style={{ border: 'none' }}></td>
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
        .ptrab-print-container { max-width: 100%; margin: 0 auto; padding: 2rem 1rem; font-family: Arial, sans-serif; }
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; } /* Tamanho de fonte fixo */
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; } /* Fonte de dados reduzida para 8pt */
        .ptrab-table thead th { background-color: #E8E8E8; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* LARGURAS DE COLUNA FIXAS */
        .col-despesas { width: 14%; text-align: left; white-space: pre-wrap; }
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
        
        .subtotal-row, .subtotal-om-row, .total-geral-soma-row, .total-geral-final-row { 
            font-weight: bold; 
            page-break-inside: avoid;
        } 
        .subtotal-row { background-color: #D3D3D3; }
        .subtotal-om-row { background-color: #E8E8E8; }
        .total-geral-soma-row { background-color: #D3D3D3; border-top: 1px solid #000; }
        .total-geral-final-row { background-color: #E8E8E8; }
        
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO (CORREÇÃO DE ALINHAMENTO) */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-print-container { padding: 0 !important; margin: 0 !important; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; }
          .ptrab-table { border: 0.25pt solid #000 !important; }
          
          /* CORREÇÃO CRÍTICA: Força alinhamento vertical middle para as colunas de dados A a H */
          .expense-row td:nth-child(1),
          .expense-row td:nth-child(2),
          .expense-row td:nth-child(3),
          .expense-row td:nth-child(4),
          .expense-row td:nth-child(5),
          .expense-row td:nth-child(6),
          .expense-row td:nth-child(7),
          .expense-row td:nth-child(8) {
              vertical-align: middle !important;
          }
          
          /* Coluna I (Detalhamento) deve ser top */
          .expense-row .col-detalhamento {
              vertical-align: top !important;
          }
          
          /* Garante que as cores de fundo sejam impressas */
          .subtotal-row td, .total-geral-soma-row td, .total-geral-final-row td,
          .col-valor-natureza, .col-combustivel-data-filled {
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