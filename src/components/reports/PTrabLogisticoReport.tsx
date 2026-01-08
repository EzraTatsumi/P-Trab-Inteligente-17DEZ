import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
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
  LinhaClasseIII, // NOVO: Importando LinhaClasseIII
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
  generateClasseIXMemoriaCalculo,
  calculateItemTotalClasseIX,
  getTipoCombustivelLabel, // Importando a função corrigida do Manager
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "@/lib/classeVIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "@/lib/classeVIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "@/lib/classeVIIIUtils";
import { RefLPC } from "@/types/refLPC"; // Importando RefLPC

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
    totalDieselLitros: number;
    totalGasolinaLitros: number;
    valorDiesel: number;
    valorGasolina: number;
    total_gnd3: number;
  };
  fileSuffix: string; // NOVO PROP
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe I
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe II/V/VI/VII/VIII/IX
  generateClasseIIMemoriaCalculo: (
    registro: ClasseIIRegistro,
    isClasseII: boolean
  ) => string;
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe V
  generateClasseVMemoriaCalculo: (registro: any) => string;
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe VI
  generateClasseVIMemoriaCalculo: (registro: any) => string;
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe VII
  generateClasseVIIMemoriaCalculo: (registro: any) => string;
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe VIII
  generateClasseVIIIMemoriaCalculo: (registro: any) => string;
  // NOVO PROP: Receber a função de geração de memória de cálculo da Classe III (granular)
  generateClasseIIIMemoriaCalculo: (registro: ClasseIIIRegistro) => string;
}

// Implementação padrão (fallback) para generateClasseIIMemoriaCalculo
const defaultGenerateClasseIIMemoriaCalculo = (registro: any, isClasseII: boolean): string => {
    // Verifica se existe detalhamento customizado primeiro
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    // Se for Classe II (Equipamento Individual, Proteção Balística, Material de Estacionamento)
    if (isClasseII && registro.itens_equipamentos && registro.efetivo !== undefined) {
        // Usa a função utilitária detalhada para Classe II
        return generateClasseIIUtility(
            registro.categoria,
            registro.itens_equipamentos,
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    // Para outras classes (V, VI, VII, VIII) ou se os dados estiverem incompletos, retorna o detalhamento armazenado
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

// Implementação padrão (fallback) para generateClasseVMemoriaCalculo
const defaultGenerateClasseVMemoriaCalculo = (registro: any): string => {
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    if (CLASSE_V_CATEGORIES.includes(registro.categoria) && registro.itens_equipamentos && registro.efetivo !== undefined) {
        // Usa a função utilitária detalhada para Classe V
        return generateClasseVUtility(
            registro.categoria,
            registro.itens_equipamentos,
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao, // Para Classe V, a OM Detentora é a OM de Destino
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

// Implementação padrão (fallback) para generateClasseVIMemoriaCalculo
const defaultGenerateClasseVIMemoriaCalculo = (registro: any): string => {
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    if (CLASSE_VI_CATEGORIES.includes(registro.categoria) && registro.itens_equipamentos) {
        // Usa a função utilitária detalhada para Classe VI
        return generateClasseVIUtility(
            registro.categoria, // Categoria é o primeiro argumento
            registro.itens_equipamentos,
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao, // OM Detentora
            registro.ug_detentora || registro.ug, // UG Detentora
            registro.fase_atividade,
            registro.efetivo || 0, // Efetivo (embora não usado no cálculo, é necessário para a assinatura)
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

// Implementação padrão (fallback) para generateClasseVIIMemoriaCalculo
const defaultGenerateClasseVIIMemoriaCalculo = (registro: any): string => {
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    if (CLASSE_VII_CATEGORIES.includes(registro.categoria) && registro.itens_equipamentos) {
        // Usa a função utilitária detalhada para Classe VII
        return generateClasseVIIUtility(
            registro.categoria,
            registro.itens_equipamentos,
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39
        );
    }
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

// Implementação padrão (fallback) para generateClasseVIIIMemoriaCalculo
const defaultGenerateClasseVIIIMemoriaCalculo = (registro: any): string => {
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
        // Para Classe VIII, os itens estão em itens_saude ou itens_remonta
        const itens = registro.categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
        
        return generateClasseVIIIUtility(
            registro.categoria as 'Saúde' | 'Remonta/Veterinária',
            itens,
            registro.dias_operacao,
            registro.om_detentora || registro.organizacao,
            registro.ug_detentora || registro.ug,
            registro.fase_atividade,
            registro.efetivo || 0,
            registro.valor_nd_30,
            registro.valor_nd_39,
            registro.animal_tipo
        );
    }
    return registro.detalhamento || "Memória de cálculo não disponível.";
};

// Implementação padrão (fallback) para generateClasseIIIMemoriaCalculo
const defaultGenerateClasseIIIMemoriaCalculo = (registro: ClasseIIIRegistro): string => {
    // Se não for passada a função do Manager, retorna o detalhamento consolidado (fallback)
    return registro.detalhamento_customizado || registro.detalhamento || "Memória de cálculo não disponível.";
};


// =================================================================
// FUNÇÕES AUXILIARES DE RÓTULO
// =================================================================

const getTipoEquipamentoLabel = (tipo: string) => {
    switch (tipo) {
        case 'GERADOR': return 'GERADOR';
        case 'EMBARCACAO': return 'EMBARCAÇÃO';
        case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
        case 'MOTOMECANIZACAO': return 'MOTOMECANIZAÇÃO';
        default: return tipo;
    }
};

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
  registrosClasseI,
  registrosClasseII,
  registrosClasseIII,
  nomeRM,
  omsOrdenadas,
  gruposPorOM,
  calcularTotaisPorOM,
  fileSuffix, // NOVO PROP
  generateClasseIMemoriaCalculo, // DESESTRUTURANDO A FUNÇÃO
  generateClasseIIMemoriaCalculo = defaultGenerateClasseIIMemoriaCalculo, // CORRIGIDO: Usando o nome correto da função de fallback
  generateClasseVMemoriaCalculo = defaultGenerateClasseVMemoriaCalculo, // NOVO: DESESTRUTURANDO E USANDO DEFAULT
  generateClasseVIMemoriaCalculo = defaultGenerateClasseVIMemoriaCalculo, // NOVO: ADICIONADO CLASSE VI
  generateClasseVIIMemoriaCalculo = defaultGenerateClasseVIIMemoriaCalculo, // NOVO: ADICIONADO CLASSE VII
  generateClasseVIIIMemoriaCalculo = defaultGenerateClasseVIIIMemoriaCalculo, // NOVO: ADICIONADO CLASSE VIII
  generateClasseIIIMemoriaCalculo = defaultGenerateClasseIIIMemoriaCalculo, // NOVO: ADICIONADO CLASSE III
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';

  // 1. Recalcular Totais Gerais (para HTML/PDF)
  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.registro.organizacao || '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  
  // FIX: Total Combustível é a soma dos valores das linhas desagregadas de Combustível na RM
  const totalValorCombustivel = useMemo(() => {
    const rmGroup = gruposPorOM[nomeRM];
    if (!rmGroup) return 0;
    return rmGroup.linhasClasseIII
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL' || l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      .reduce((acc, l) => acc + l.valor_total_linha, 0);
  }, [gruposPorOM, nomeRM]);
  
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
  const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivel;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  // NOVO: Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    // Usa a função atualizada que retorna DDMMMAA
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    // Substitui barras por hífens para segurança no nome do arquivo
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    
    // 1. Construir o nome base
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    
    if (isMinuta) {
        // Se for Minuta, adiciona o ano e a sigla da OM
        nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    } else {
        // Se for Aprovado, o número já contém o ano e a sigla da OM (ex: 1-2025-23ª Bda Inf Sl)
        // Apenas adiciona a sigla da OM para clareza, mas sem o separador extra
        // Ex: P Trab Nr 1-2025-23ª Bda Inf Sl - Op MARAJOARA...
    }
    
    // 2. Adicionar o nome da operação
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    
    // 3. Adicionar a data de atualização e o sufixo da aba
    // A data já está no formato DDMMMAA (sem barras)
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  // RENOMEADO: Função que era handlePrint, agora é exportPDF
  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;

    const pdfToast = toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto o relatório é processado.",
    });

    // OTIMIZAÇÃO: Forçar a captura do estilo de impressão e aumentar a escala
    html2canvas(contentRef.current, {
      scale: 3, // Aumenta a escala para maior nitidez
      useCORS: true,
      allowTaint: true,
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // A4 em Paisagem: 297mm (largura) x 210mm (altura)
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = 297; // Largura do A4 em mm (Paisagem)
      const pdfHeight = 210; // Altura do A4 em mm (Paisagem)
      
      // Margem de 0.5cm = 5mm
      const margin = 5;
      const contentWidth = pdfWidth - 2 * margin;
      const contentHeight = pdfHeight - 2 * margin;

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin; // Começa com a margem superior

      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;

      while (heightLeft > -1) { // Ajustado para garantir que a última parte seja incluída
        position = heightLeft - imgHeight + margin; // Calcula a posição para a próxima página
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      pdf.save(generateFileName('PDF'));
      // REMOVIDO: onExportSuccess();
      pdfToast.dismiss(); // Usa o dismiss do objeto retornado
      toast({
        title: "PDF Exportado!",
        description: "O P Trab Logístico foi salvo com sucesso.",
        duration: 3000,
      });
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      pdfToast.dismiss(); // Usa o dismiss do objeto retornado
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    });
  }, [ptrabData, toast, diasOperacao, totalGeral_GND3_ND, totalValorCombustivel, totalGeral_33_90_30, totalGeral_33_90_39, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, fileSuffix, generateClasseVIIIMemoriaCalculo]);

  // NOVO: Função para abrir o diálogo de impressão do navegador
  const handlePrint = () => {
    window.print();
    // REMOVIDO: onExportSuccess();
  };

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
    const rightTopAlignment = { horizontal: 'right' as const, vertical: 'top' as const, wrapText: true };
    
    // NOVOS ALINHAMENTOS PARA DADOS (Verticalmente Centralizado)
    const dataLeftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
    const dataCenterMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    // Alterado para CenterMiddleAlignment para C, D, E e H
    const dataCenterMonetaryAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }; 
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } }; // Cor da fonte preta
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
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares do Exército Brasileiro`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell('A').value = '5. DESPESAS OPERACIONAIS:';
      despesasRow.getCell('A').font = titleFontStyle;
      currentRow++;
      
      const headerRow1 = currentRow;
      const headerRow2 = currentRow + 1;
      
      const hdr1 = worksheet.getRow(headerRow1);
      hdr1.getCell('A').value = 'DESPESAS\n(ORDENAR POR CLASSE DE SUBSISTÊNCIA)';
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      hdr1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
      
      // Mesclagens
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
      
      // --- APLICAÇÃO DE ESTILOS E CORES EXPLÍCITAS ---
      const headerFillGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } }; // FFE8E8E8
      const headerFillAzul = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } }; // FFB4C7E7
      const headerFillLaranja = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } }; // FFF8CBAD
      
      const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

      // Linha 1 do Cabeçalho (hdr1)
      headerCols.forEach(col => {
          const cell = hdr1.getCell(col);
          cell.style = headerStyle;
          cell.border = cellBorder;
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.fill = headerFillGray;
          } else if (col === 'C' || col === 'D' || col === 'E') {
              cell.fill = headerFillAzul;
              cell.font = headerFontStyle; // Garante letra preta
          } else if (col === 'F' || col === 'G' || col === 'H') {
              cell.fill = headerFillLaranja;
              cell.font = headerFontStyle; // Garante letra preta
          }
      });

      // Linha 2 do Cabeçalho (hdr2)
      headerCols.forEach(col => {
          const cell = hdr2.getCell(col);
          cell.style = headerStyle;
          cell.border = cellBorder;
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.fill = headerFillGray;
          } else if (col === 'C' || col === 'D' || col === 'E') {
              cell.fill = headerFillAzul;
              cell.font = headerFontStyle; // Garante letra preta
          } else if (col === 'F' || col === 'G' || col === 'H') {
              cell.fill = headerFillLaranja;
              cell.font = headerFontStyle; // Garante letra preta
          }
          // Ajuste para garantir que as células mescladas não tenham valor na linha 2
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.value = '';
          }
      });
      
      currentRow = headerRow2 + 1;

      // Reusable alignment styles for data
      const dataTextStyle = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
      
      omsOrdenadas.forEach((nomeOM) => {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasClasseIII.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
          return;
        }
        
        // Linhas de Classe III (Lubrificante e Combustível) - Ordenação interna
        const linhasClasseIIIOrdenadas = grupo.linhasClasseIII.sort((a, b) => {
            // Ordena Lubrificante antes de Combustível
            if (a.tipo_suprimento === 'LUBRIFICANTE' && b.tipo_suprimento !== 'LUBRIFICANTE') return -1;
            if (a.tipo_suprimento !== 'LUBRIFICANTE' && b.tipo_suprimento === 'LUBRIFICANTE') return 1;
            
            // Dentro de Combustível, ordena Diesel antes de Gasolina
            if (a.tipo_suprimento === 'COMBUSTIVEL_DIESEL' && b.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') return -1;
            if (a.tipo_suprimento === 'COMBUSTIVEL_GASOLINA' && b.tipo_suprimento === 'COMBUSTIVEL_DIESEL') return 1;
            
            // Ordena por categoria de equipamento
            return a.categoria_equipamento.localeCompare(b.categoria_equipamento);
        });
        
        // NOVO: Array de todas as linhas de despesa na ordem correta (I, II, III, V-IX)
        const allExpenseLines = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...linhasClasseIIIOrdenadas, // CLASSE III INSERIDA AQUI
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI,
            ...grupo.linhasClasseVII,
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX,
        ];

        // Renderizar todas as linhas de despesa (I, II, III, V-IX)
        allExpenseLines.forEach((linha, index) => {
            const row = worksheet.getRow(currentRow);
            
            // Type guards to determine the type of line
            const isClasseI = 'tipo' in linha;
            const isClasseIII = 'categoria_equipamento' in linha;
            const isClasseII_IX = !isClasseI && !isClasseIII; // Must be LinhaClasseII

            // ADICIONANDO VERIFICAÇÃO DE SEGURANÇA AQUI
            if (!linha) return;
            
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
            
            if (isClasseI) { // Classe I (QS/QR)
                const registro = (linha as LinhaTabela).registro as ClasseIRegistro;
                const ug_qs_formatted = formatCodug(registro.ug_qs);
                const ug_qr_formatted = formatCodug(registro.ug);

                if ((linha as LinhaTabela).tipo === 'QS') {
                    rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
                    rowData.omValue = `${registro.om_qs}\n(${ug_qs_formatted})`;
                    rowData.valorC = registro.total_qs;
                    rowData.valorE = registro.total_qs;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                } else { // QR
                    rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA`;
                    rowData.omValue = `${registro.organizacao}\n(${ug_qr_formatted})`;
                    rowData.valorC = registro.total_qr;
                    rowData.valorE = registro.total_qr;
                    rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                }
            } else if (isClasseIII) { // Classe III (Combustível/Lubrificante)
                const linhaClasseIII = linha as LinhaClasseIII;
                const registro = linhaClasseIII.registro;
                const isCombustivelLinha = linhaClasseIII.tipo_suprimento !== 'LUBRIFICANTE';
                const isLubrificanteLinha = linhaClasseIII.tipo_suprimento === 'LUBRIFICANTE';
                
                // OM Detentora do Equipamento (Source)
                const omDetentoraEquipamento = registro.organizacao;
                
                // 1ª Linha: CLASSE III - DIESEL/GASOLINA/LUBRIFICANTE
                const tipoSuprimentoLabel = isLubrificanteLinha ? 'LUBRIFICANTE' : getTipoCombustivelLabel(linhaClasseIII.tipo_suprimento);
                let despesasValue = `CLASSE III - ${tipoSuprimentoLabel}`;
                
                // 2ª Linha: CATEGORIA
                const categoriaEquipamento = getTipoEquipamentoLabel(linhaClasseIII.categoria_equipamento);
                despesasValue += `\n${categoriaEquipamento}`;
                
                // 3ª Linha: OM Detentora (se for necessário, ou seja, se for diferente da OM de destino do recurso)
                const omDestinoRecurso = isCombustivelLinha ? nomeOM : (registro.om_detentora || registro.organizacao);
                const isDifferentOm = omDetentoraEquipamento !== omDestinoRecurso;
                
                if (isDifferentOm) {
                    despesasValue += `\n${omDetentoraEquipamento}`;
                }
                
                // OM (UGE) CODUG: OM de Destino do Recurso
                const ugDestinoRecurso = isCombustivelLinha ? (registro.ug_detentora || '') : (registro.ug_detentora || registro.ug);
                const ugDestinoFormatted = formatCodug(ugDestinoRecurso);
                let omValue = `${omDestinoRecurso}\n(${ugDestinoFormatted})`;
                
                rowData.despesasValue = despesasValue;
                rowData.omValue = omValue;
                
                if (isCombustivelLinha) {
                    rowData.valorC = 0;
                    rowData.valorD = 0;
                    rowData.valorE = 0;
                    
                    rowData.litrosF = `${formatNumber(linhaClasseIII.total_litros_linha)} L`;
                    rowData.precoUnitarioG = formatCurrency(linhaClasseIII.preco_litro_linha);
                    rowData.precoTotalH = formatCurrency(linhaClasseIII.valor_total_linha);
                    
                } else if (isLubrificanteLinha) {
                    rowData.valorC = linhaClasseIII.valor_total_linha;
                    rowData.valorD = 0;
                    rowData.valorE = linhaClasseIII.valor_total_linha;
                    
                    rowData.litrosF = '';
                    rowData.precoUnitarioG = '';
                    rowData.precoTotalH = '';
                }
                
                rowData.detalhamentoValue = linhaClasseIII.memoria_calculo;
                
            } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                const omDestinoRecurso = registro.organizacao;
                const ugDestinoRecurso = formatCodug(registro.ug);
                
                let categoriaDetalhe = getClasseIILabel(registro.categoria); // Usar rótulo completo
                
                if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                    categoriaDetalhe = registro.animal_tipo;
                }
                            
                const omDetentora = registro.om_detentora || omDestinoRecurso;
                const isDifferentOm = omDetentora !== omDestinoRecurso;
                
                // 1. Define o prefixo CLASSE X
                let prefixoClasse = '';
                if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE V';
                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VI';
                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VII';
                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE VIII';
                } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                    prefixoClasse = 'CLASSE IX';
                } else {
                    prefixoClasse = 'CLASSE II';
                }
                
                rowData.despesasValue = `${prefixoClasse} - ${categoriaDetalhe.toUpperCase()}`;
                
                // 2. Adiciona a OM Detentora se for diferente da OM de Destino
                if (isDifferentOm) {
                    rowData.despesasValue += `\n${omDetentora}`;
                }
                
                rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                rowData.valorC = registro.valor_nd_30;
                rowData.valorD = registro.valor_nd_39;
                rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                
                // 3. Prioriza o detalhamento customizado ou usa a função de memória unificada
                if (registro.detalhamento_customizado) {
                    rowData.detalhamentoValue = registro.detalhamento_customizado;
                } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseIXMemoriaCalculo(registro);
                } else if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVMemoriaCalculo(registro);
                } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIMemoriaCalculo(registro);
                } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIIMemoriaCalculo(registro);
                } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                    rowData.detalhamentoValue = generateClasseVIIIMemoriaCalculo(registro);
                } else {
                    const isClasseII = ['Equipamento Individual', 'Proteção Balística', 'Material de Estacionamento'].includes(registro.categoria);
                    rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, isClasseII);
                }
            }
            
            // --- Renderização da Linha ---
            row.getCell('A').value = rowData.despesasValue;
            row.getCell('B').value = rowData.omValue;
            row.getCell('C').value = rowData.valorC > 0 ? rowData.valorC : '';
            row.getCell('D').value = rowData.valorD > 0 ? rowData.valorD : '';
            row.getCell('E').value = rowData.valorE > 0 ? rowData.valorE : '';
            row.getCell('F').value = rowData.litrosF;
            row.getCell('G').value = rowData.precoUnitarioG;
            row.getCell('H').value = rowData.precoTotalH;
            row.getCell('I').value = rowData.detalhamentoValue;
            
            // Estilos
            ['A', 'B'].forEach(col => {
                row.getCell(col).alignment = dataTextStyle;
                row.getCell(col).font = baseFontStyle;
                row.getCell(col).border = cellBorder;
            });
            
            ['C', 'D', 'E'].forEach(col => {
                const cell = row.getCell(col);
                cell.alignment = dataCenterMonetaryAlignment;
                cell.font = baseFontStyle;
                cell.border = cellBorder;
                cell.numFmt = 'R$ #,##0.00'; // Formato monetário
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
            });
            
            ['F', 'G', 'H'].forEach(col => {
                const cell = row.getCell(col);
                cell.alignment = dataCenterMonetaryAlignment;
                cell.font = baseFontStyle;
                cell.border = cellBorder;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
                if (col === 'H') {
                    cell.numFmt = 'R$ #,##0.00'; // Formato monetário
                }
            });
            
            row.getCell('I').alignment = leftTopAlignment;
            row.getCell('I').font = { name: 'Arial', size: 6.5 }; // Fonte menor para detalhamento
            row.getCell('I').border = cellBorder;
            
            currentRow++;
        });
        
        // Subtotal da OM
        const subtotalRow = worksheet.getRow(currentRow);
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = headerFontStyle;
        subtotalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
        subtotalRow.getCell('A').border = cellBorder;
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30;
        subtotalRow.getCell('C').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('C').font = headerFontStyle;
        subtotalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('C').border = cellBorder;
        subtotalRow.getCell('C').numFmt = 'R$ #,##0.00';
        
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalRow.getCell('D').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('D').font = headerFontStyle;
        subtotalRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('D').border = cellBorder;
        subtotalRow.getCell('D').numFmt = 'R$ #,##0.00';
        
        subtotalRow.getCell('E').value = totaisOM.total_parte_azul;
        subtotalRow.getCell('E').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('E').font = headerFontStyle;
        subtotalRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('E').border = cellBorder;
        subtotalRow.getCell('E').numFmt = 'R$ #,##0.00';
        
        // Combustível (Apenas na RM)
        const isRM = nomeOM === nomeRM;
        
        // CORREÇÃO 2: Remove a verificação > 0 para garantir que '0 L OD' seja exibido se for a RM
        subtotalRow.getCell('F').value = isRM ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` : '';
        subtotalRow.getCell('F').alignment = dataCenterMiddleAlignment;
        subtotalRow.getCell('F').font = headerFontStyle;
        subtotalRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('F').border = cellBorder;
        
        // CORREÇÃO 2: Remove a verificação > 0 para garantir que '0 L GAS' seja exibido se for a RM
        subtotalRow.getCell('G').value = isRM ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` : '';
        subtotalRow.getCell('G').alignment = dataCenterMiddleAlignment;
        subtotalRow.getCell('G').font = headerFontStyle;
        subtotalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('G').border = cellBorder;
        
        // CORREÇÃO 2: Remove a verificação > 0 para garantir que 'R$ 0,00' seja exibido se for a RM
        subtotalRow.getCell('H').value = isRM ? totaisOM.total_combustivel : '';
        subtotalRow.getCell('H').alignment = dataCenterMonetaryAlignment;
        subtotalRow.getCell('H').font = headerFontStyle;
        subtotalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        subtotalRow.getCell('H').border = cellBorder;
        subtotalRow.getCell('H').numFmt = 'R$ #,##0.00';
        
        subtotalRow.getCell('I').value = '';
        subtotalRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
        subtotalRow.getCell('I').border = cellBorder;
        
        currentRow++;
        
        // Total da OM
        const totalOMRow = worksheet.getRow(currentRow);
        totalOMRow.getCell('A').value = `VALOR TOTAL DO ${nomeOM}`;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        totalOMRow.getCell('A').alignment = rightMiddleAlignment;
        totalOMRow.getCell('A').font = headerFontStyle;
        totalOMRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('A').border = cellBorder;
        
        totalOMRow.getCell('E').value = totaisOM.total_gnd3;
        totalOMRow.getCell('E').alignment = dataCenterMonetaryAlignment;
        totalOMRow.getCell('E').font = headerFontStyle;
        totalOMRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('E').border = cellBorder;
        totalOMRow.getCell('E').numFmt = 'R$ #,##0.00';
        
        worksheet.mergeCells(`F${currentRow}:I${currentRow}`);
        totalOMRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('F').border = cellBorder;
        
        currentRow++;
      });
      
      // Linha em branco para espaçamento
      currentRow++;
      
      // ========== TOTAL GERAL ==========
      
      // Linha 1: Soma detalhada por ND e GP de Despesa
      const totalGeralSomaRow = worksheet.getRow(currentRow);
      totalGeralSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      totalGeralSomaRow.getCell('A').alignment = rightMiddleAlignment;
      totalGeralSomaRow.getCell('A').font = headerFontStyle;
      totalGeralSomaRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
      totalGeralSomaRow.getCell('A').border = cellBorder;
      
      totalGeralSomaRow.getCell('C').value = totalGeral_33_90_30;
      totalGeralSomaRow.getCell('C').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('C').font = headerFontStyle;
      totalGeralSomaRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      totalGeralSomaRow.getCell('C').border = cellBorder;
      totalGeralSomaRow.getCell('C').numFmt = 'R$ #,##0.00';
      
      totalGeralSomaRow.getCell('D').value = totalGeral_33_90_39;
      totalGeralSomaRow.getCell('D').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('D').font = headerFontStyle;
      totalGeralSomaRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      totalGeralSomaRow.getCell('D').border = cellBorder;
      totalGeralSomaRow.getCell('D').numFmt = 'R$ #,##0.00';
      
      totalGeralSomaRow.getCell('E').value = totalGeral_GND3_ND;
      totalGeralSomaRow.getCell('E').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('E').font = headerFontStyle;
      totalGeralSomaRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      totalGeralSomaRow.getCell('E').border = cellBorder;
      totalGeralSomaRow.getCell('E').numFmt = 'R$ #,##0.00';
      
      const totalDiesel = gruposPorOM[nomeRM]?.linhasClasseIII
        .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')
        .reduce((acc, l) => acc + l.total_litros_linha, 0) || 0;
        
      const totalGasolina = gruposPorOM[nomeRM]?.linhasClasseIII
        .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
        .reduce((acc, l) => acc + l.total_litros_linha, 0) || 0;
        
      const totalValorCombustivelFinal = totalValorCombustivel;

      // CORREÇÃO 3: Remove a verificação > 0 para garantir que '0 L OD' seja exibido
      totalGeralSomaRow.getCell('F').value = `${formatNumber(totalDiesel)} L OD`;
      totalGeralSomaRow.getCell('F').alignment = dataCenterMiddleAlignment;
      totalGeralSomaRow.getCell('F').font = headerFontStyle;
      totalGeralSomaRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      totalGeralSomaRow.getCell('F').border = cellBorder;
      
      // CORREÇÃO 3: Remove a verificação > 0 para garantir que '0 L GAS' seja exibido
      totalGeralSomaRow.getCell('G').value = `${formatNumber(totalGasolina)} L GAS`;
      totalGeralSomaRow.getCell('G').alignment = dataCenterMiddleAlignment;
      totalGeralSomaRow.getCell('G').font = headerFontStyle;
      totalGeralSomaRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      totalGeralSomaRow.getCell('G').border = cellBorder;
      
      totalGeralSomaRow.getCell('H').value = totalValorCombustivelFinal;
      totalGeralSomaRow.getCell('H').alignment = dataCenterMonetaryAlignment;
      totalGeralSomaRow.getCell('H').font = headerFontStyle;
      totalGeralSomaRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      totalGeralSomaRow.getCell('H').border = cellBorder;
      totalGeralSomaRow.getCell('H').numFmt = 'R$ #,##0.00';
      
      totalGeralSomaRow.getCell('I').value = '';
      totalGeralSomaRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
      totalGeralSomaRow.getCell('I').border = cellBorder;
      
      currentRow++;

      // Linha 2: Valor Total
      const totalGeralFinalRow = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      totalGeralFinalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('A').border = cellBorder;
      
      totalGeralFinalRow.getCell('G').value = 'VALOR TOTAL';
      totalGeralFinalRow.getCell('G').alignment = centerMiddleAlignment;
      totalGeralFinalRow.getCell('G').font = headerFontStyle;
      totalGeralFinalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('G').border = cellBorder;
      
      totalGeralFinalRow.getCell('H').value = valorTotalSolicitado;
      totalGeralFinalRow.getCell('H').alignment = dataCenterMonetaryAlignment;
      totalGeralFinalRow.getCell('H').font = headerFontStyle;
      totalGeralFinalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('H').border = cellBorder;
      totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';
      
      totalGeralFinalRow.getCell('I').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      totalGeralFinalRow.getCell('I').border = cellBorder;
      
      currentRow++;
      
      // Linha 3: GND - 3 (dividida em 2 subdivisões)
      const gnd3Row1 = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      gnd3Row1.getCell('H').value = 'GND - 3';
      gnd3Row1.getCell('H').alignment = centerMiddleAlignment;
      gnd3Row1.getCell('H').font = headerFontStyle;
      gnd3Row1.getCell('H').border = { top: cellBorder.top, left: cellBorder.left, right: cellBorder.right };
      
      currentRow++;
      
      // Segunda subdivisão: Valor Total
      const gnd3Row2 = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      gnd3Row2.getCell('H').value = valorTotalSolicitado;
      gnd3Row2.getCell('H').alignment = dataCenterMonetaryAlignment;
      gnd3Row2.getCell('H').font = headerFontStyle;
      gnd3Row2.getCell('H').border = { bottom: cellBorder.bottom, left: cellBorder.left, right: cellBorder.right };
      gnd3Row2.getCell('H').numFmt = 'R$ #,##0.00';
      
      currentRow++;
      
      // Rodapé
      currentRow += 2;
      
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
      console.error("Erro ao gerar Excel:", error);
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o Excel. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [ptrabData, diasOperacao, totalGeral_33_90_30, totalGeral_33_90_39, totalValorCombustivel, valorTotalSolicitado, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, fileSuffix, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseVMemoriaCalculo, generateClasseVIMemoriaCalculo, generateClasseVIIMemoriaCalculo, generateClasseVIIIMemoriaCalculo, generateClasseIIIMemoriaCalculo]);


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
                  <th rowSpan={2} className="col-despesas">DESPESAS<br/>(ORDENAR POR CLASSE DE SUBSISTÊNCIA)</th>
                  <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                  <th colSpan={3} className="col-natureza-header">NATUREZA DE DESPESA</th>
                  <th colSpan={3} className="col-combustivel-header">COMBUSTÍVEL</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                </tr>
                <tr>
                  <th className="col-nd" style={{ backgroundColor: '#B4C7E7' }}>33.90.30</th>
                  <th className="col-nd" style={{ backgroundColor: '#B4C7E7' }}>33.90.39</th>
                  <th className="col-nd" style={{ backgroundColor: '#B4C7E7' }}>TOTAL</th>
                  <th className="col-combustivel">LITROS</th>
                  <th className="col-combustivel">PREÇO<br/>UNITÁRIO</th>
                  <th className="col-combustivel">PREÇO<br/>TOTAL</th>
                </tr>
            </thead>
            <tbody>
              {[
                ...omsOrdenadas.flatMap((nomeOM, omIndex) => {
                  const grupo = gruposPorOM[nomeOM];
                  const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
                  
                  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
                  
                  if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasClasseIII.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
                    return [];
                  }
                  
                  // Linhas de Classe III (Lubrificante e Combustível) - Ordenação interna
                  const linhasClasseIIIOrdenadas = grupo.linhasClasseIII.sort((a, b) => {
                      // Ordena Lubrificante antes de Combustível
                      if (a.tipo_suprimento === 'LUBRIFICANTE' && b.tipo_suprimento !== 'LUBRIFICANTE') return -1;
                      if (a.tipo_suprimento !== 'LUBRIFICANTE' && b.tipo_suprimento === 'LUBRIFICANTE') return 1;
                      
                      // Dentro de Combustível, ordena Diesel antes de Gasolina
                      if (a.tipo_suprimento === 'COMBUSTIVEL_DIESEL' && b.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') return -1;
                      if (a.tipo_suprimento === 'COMBUSTIVEL_GASOLINA' && b.tipo_suprimento === 'COMBUSTIVEL_DIESEL') return 1;
                      
                      // Ordena por categoria de equipamento
                      return a.categoria_equipamento.localeCompare(b.categoria_equipamento);
                  });
                  
                  // NOVO: Array de todas as linhas de despesa na ordem correta (I, II, III, V-IX)
                  const allExpenseLines = [
                      ...grupo.linhasQS,
                      ...grupo.linhasQR,
                      ...grupo.linhasClasseII,
                      ...linhasClasseIIIOrdenadas, // CLASSE III INSERIDA AQUI
                      ...grupo.linhasClasseV,
                      ...grupo.linhasClasseVI,
                      ...grupo.linhasClasseVII,
                      ...grupo.linhasClasseVIII,
                      ...grupo.linhasClasseIX,
                  ];
                  
                  return [
                    // 1. Renderizar todas as linhas de despesa (I, II, III, V-IX)
                    ...allExpenseLines.map((linha, index) => {
                        // Type guards to determine the type of line
                        const isClasseI = 'tipo' in linha;
                        const isClasseIII = 'categoria_equipamento' in linha;
                        const isClasseII_IX = !isClasseI && !isClasseIII; // Must be LinhaClasseII

                        // ADICIONANDO VERIFICAÇÃO DE SEGURANÇA AQUI
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
                        
                        if (isClasseI) { // Classe I (QS/QR)
                            const registro = (linha as LinhaTabela).registro as ClasseIRegistro;
                            const tipo = (linha as LinhaTabela).tipo;
                            const ug_qs_formatted = formatCodug(registro.ug_qs);
                            const ug_qr_formatted = formatCodug(registro.ug);

                            if (tipo === 'QS') {
                                rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
                                rowData.omValue = `${registro.om_qs}\n(${ug_qs_formatted})`;
                                rowData.valorC = registro.total_qs;
                                rowData.valorE = registro.total_qs;
                                rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QS');
                            } else { // QR
                                rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA`;
                                rowData.omValue = `${registro.organizacao}\n(${ug_qr_formatted})`;
                                rowData.valorC = registro.total_qr;
                                rowData.valorE = registro.total_qr;
                                rowData.detalhamentoValue = generateClasseIMemoriaCalculo(registro, 'QR');
                            }
                        } else if (isClasseIII) { // Classe III (Combustível/Lubrificante)
                            const linhaClasseIII = linha as LinhaClasseIII;
                            const registro = linhaClasseIII.registro;
                            const isCombustivelLinha = linhaClasseIII.tipo_suprimento !== 'LUBRIFICANTE';
                            const isLubrificanteLinha = linhaClasseIII.tipo_suprimento === 'LUBRIFICANTE';
                            
                            // OM Detentora do Equipamento (Source)
                            const omDetentoraEquipamento = registro.organizacao;
                            
                            // 1ª Linha: CLASSE III - DIESEL/GASOLINA/LUBRIFICANTE
                            const tipoSuprimentoLabel = isLubrificanteLinha ? 'LUBRIFICANTE' : getTipoCombustivelLabel(linhaClasseIII.tipo_suprimento);
                            let despesasValue = `CLASSE III - ${tipoSuprimentoLabel}`;
                            
                            // 2ª Linha: CATEGORIA
                            const categoriaEquipamento = getTipoEquipamentoLabel(linhaClasseIII.categoria_equipamento);
                            despesasValue += `\n${categoriaEquipamento}`;
                            
                            // 3ª Linha: OM Detentora (se for necessário, ou seja, se for diferente da OM de destino do recurso)
                            const omDestinoRecurso = isCombustivelLinha ? nomeOM : (registro.om_detentora || registro.organizacao);
                            const isDifferentOm = omDetentoraEquipamento !== omDestinoRecurso;
                            
                            if (isDifferentOm) {
                                despesasValue += `\n${omDetentoraEquipamento}`;
                            }
                            
                            // OM (UGE) CODUG: OM de Destino do Recurso
                            const ugDestinoRecurso = isCombustivelLinha ? (registro.ug_detentora || '') : (registro.ug_detentora || registro.ug);
                            const ugDestinoFormatted = formatCodug(ugDestinoRecurso);
                            let omValue = `${omDestinoRecurso}\n(${ugDestinoFormatted})`;
                            
                            rowData.despesasValue = despesasValue;
                            rowData.omValue = omValue;
                            
                            if (isCombustivelLinha) {
                                rowData.valorC = 0;
                                rowData.valorD = 0;
                                rowData.valorE = 0;
                                
                                rowData.litrosF = `${formatNumber(linhaClasseIII.total_litros_linha)} L`;
                                rowData.precoUnitarioG = formatCurrency(linhaClasseIII.preco_litro_linha);
                                rowData.precoTotalH = formatCurrency(linhaClasseIII.valor_total_linha);
                                
                            } else if (isLubrificanteLinha) {
                                rowData.valorC = linhaClasseIII.valor_total_linha;
                                rowData.valorD = 0;
                                rowData.valorE = linhaClasseIII.valor_total_linha;
                                
                                rowData.litrosF = '';
                                rowData.precoUnitarioG = '';
                                rowData.precoTotalH = '';
                            }
                            
                            rowData.detalhamentoValue = linhaClasseIII.memoria_calculo;
                            
                        } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                            const registro = (linha as LinhaClasseII).registro as ClasseIIRegistro;
                            const omDestinoRecurso = registro.organizacao;
                            const ugDestinoRecurso = formatCodug(registro.ug);
                            
                            let categoriaDetalhe = getClasseIILabel(registro.categoria); // Usar rótulo completo
                            
                            if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                                categoriaDetalhe = registro.animal_tipo;
                            }
                                
                            const omDetentora = registro.om_detentora || omDestinoRecurso;
                            const isDifferentOm = omDetentora !== omDestinoRecurso;
                            
                            // 1. Define o prefixo CLASSE X
                            let prefixoClasse = '';
                            if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE V';
                            } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE VI';
                            } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE VII';
                            } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE VIII';
                            } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                                prefixoClasse = 'CLASSE IX';
                            } else {
                                prefixoClasse = 'CLASSE II';
                            }
                            
                            rowData.despesasValue = `${prefixoClasse} - ${categoriaDetalhe.toUpperCase()}`;
                            
                            // 2. Adiciona a OM Detentora se for diferente da OM de Destino
                            if (isDifferentOm) {
                                rowData.despesasValue += `\n${omDetentora}`;
                            }
                            
                            rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                            rowData.valorC = registro.valor_nd_30;
                            rowData.valorD = registro.valor_nd_39;
                            rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                            
                            // 3. Prioriza o detalhamento customizado ou usa a função de memória unificada
                            if (registro.detalhamento_customizado) {
                                rowData.detalhamentoValue = registro.detalhamento_customizado;
                            } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseIXMemoriaCalculo(registro);
                            } else if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVMemoriaCalculo(registro);
                            } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVIMemoriaCalculo(registro);
                            } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVIIMemoriaCalculo(registro);
                            } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                                rowData.detalhamentoValue = generateClasseVIIIMemoriaCalculo(registro);
                            } else {
                                const isClasseII = ['Equipamento Individual', 'Proteção Balística', 'Material de Estacionamento'].includes(registro.categoria);
                                rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, isClasseII);
                            }
                        }
                        
                        return (
                            <tr key={index}>
                                <td className="col-despesas">
                                    {rowData.despesasValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                                </td>
                                <td className="col-om">
                                    {rowData.omValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                                </td>
                                <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorC > 0 ? formatCurrency(rowData.valorC) : ''}</td>
                                <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorD > 0 ? formatCurrency(rowData.valorD) : ''}</td>
                                <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorE > 0 ? formatCurrency(rowData.valorE) : ''}</td>
                                <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.litrosF}</td>
                                <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.precoUnitarioG}</td>
                                <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.precoTotalH}</td>
                                <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                                    <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                        {rowData.detalhamentoValue}
                                    </pre>
                                </td>
                            </tr>
                        );
                    }),
                    
                    // Subtotal da OM
                    <tr key={`subtotal-${omIndex}`} className="subtotal-row">
                      <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                      {/* Parte Azul (Natureza de Despesa) */}
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_33_90_30)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_33_90_39)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totaisOM.total_parte_azul)}</td> {/* TOTAL ND (C+D) */}
                      {/* Parte Laranja (Combustivel) - CORREÇÃO 1: Remove a verificação > 0 */}
                      {(() => {
                          const isRMFornecedora = nomeOM === nomeRM;
                          return (
                            <>
                                <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                                    {isRMFornecedora
                                    ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
                                    : ''}
                                </td>
                                <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                                    {isRMFornecedora
                                    ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
                                    : ''}
                                </td>
                                <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
                                    {isRMFornecedora
                                    ? formatCurrency(totaisOM.total_combustivel) 
                                    : ''}
                                </td>
                            </>
                          );
                      })()}
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
                }),
                
                // Linha em branco para espaçamento
                <tr key="spacing-row" className="spacing-row">
                  <td colSpan={9} style={{ height: '20px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
                </tr>,
                
                // ========== TOTAL GERAL ==========
                ...(() => {
                  // Totais de combustível por tipo (para exibição na parte laranja)
                  const totalDiesel = gruposPorOM[nomeRM]?.linhasClasseIII
                    .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')
                    .reduce((acc, l) => acc + l.total_litros_linha, 0) || 0;
                    
                  const totalGasolina = gruposPorOM[nomeRM]?.linhasClasseIII
                    .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
                    .reduce((acc, l) => acc + l.total_litros_linha, 0) || 0;
                    
                  const totalValorCombustivelFinal = totalValorCombustivel;

                  return [
                    // Linha 1: Soma detalhada por ND e GP de Despesa
                    <tr key="total-geral-soma-row" className="total-geral-soma-row">
                      <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_30)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_39)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_GND3_ND)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{`${formatNumber(totalDiesel)} L OD`}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{`${formatNumber(totalGasolina)} L GAS`}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalValorCombustivelFinal > 0 ? formatCurrency(totalValorCombustivelFinal) : ''}</td>
                      <td style={{ backgroundColor: 'white' }}></td>
                    </tr>,

                    // Linha 2: Valor Total
                    <tr key="total-geral-final-row" className="total-geral-final-row">
                      <td colSpan={6} style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}></td>
                      <td className="text-center font-bold" style={{ whiteSpace: 'nowrap', backgroundColor: '#E8E8E8', border: '1px solid #000' }}>VALOR TOTAL</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
                    </tr>,
                    
                    // Linha 3: GND - 3 (dividida em 2 subdivisões)
                    <tr key="gnd3-row-1" style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderTop: '1px solid #000', borderRight: '1px solid #000' }}>GND - 3</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>,
                    
                    // Segunda subdivisão: Valor Total
                    <tr key="gnd3-row-2" style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                  ];
                })(),
              ]}
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
        
        .subtotal-row, .subtotal-om-row, .total-geral-soma-row, .total-geral-final-row { 
            font-weight: bold; 
            page-break-inside: avoid; /* Previne quebra */
        } 
        .subtotal-row { background-color: #D3D3D3; }
        .subtotal-om-row { background-color: #E8E8E8; }
        .total-geral-soma-row { background-color: #D3D3D3; border-top: 1px solid #000; }
        .total-geral-final-row { background-color: #E8E8E8; }
        
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
        
        /* REGRAS ESPECÍFICAS DE IMPRESSÃO (MANTIDAS PARA GARANTIR O COMPORTAMENTO NATIVO) */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-print-container { padding: 0 !important; margin: 0 !important; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; } /* Borda mais fina para impressão */
          .ptrab-table { border: 0.25pt solid #000 !important; }
          .ptrab-table td { vertical-align: top !important; } /* Alinhamento superior para células de dados */
          
          .print-avoid-break {
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* REMOVIDO: AlertDialog */}
    </div>
  );
};

export default PTrabLogisticoReport;