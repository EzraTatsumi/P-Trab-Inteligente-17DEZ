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
  generateClasseIMemoriaCalculo as generateClasseIMemoriaCalculoImport, // Importar com alias
  generateClasseIXMemoriaCalculo,
  calculateItemTotalClasseIX,
  generateClasseIIIMemoriaCalculo, // Importando a função de memória da Classe III
  LinhaClasseIII, // NOVO: Importando LinhaClasseIII
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils"; 
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "@/lib/classeVIUtils"; 
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "@/lib/classeVIIUtils"; 
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "@/lib/classeVIIIUtils"; // NOVO: Importando utilitário de Classe VIII
import { ItemClasseIII, calculateItemTotals } from "@/lib/classeIIIUtils"; // Importando ItemClasseIII e calculateItemTotals

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
  generateClasseVIIIMemoriaCalculo: (registro: any) => string; // ADICIONADO
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

// NOVO: Implementação padrão (fallback) para generateClasseVIIIMemoriaCalculo
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


// =================================================================
// FUNÇÕES AUXILIARES DE RÓTULO (MOVIDAS PARA FORA DO COMPONENTE)
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

const getTipoCombustivelLabel = (tipo: string) => {
    if (tipo === 'DIESEL' || tipo === 'OD' || tipo === 'COMBUSTIVEL_DIESEL') {
        return 'ÓLEO DIESEL';
    } else if (tipo === 'GASOLINA' || tipo === 'GAS' || tipo === 'COMBUSTIVEL_GASOLINA') {
        return 'GASOLINA';
    }
    return tipo;
};

// NOVO: Função para gerar a memória de cálculo granular da Classe III
const generateGranularClasseIIIMemoria = (linha: LinhaClasseIII): string => {
    // 1. Prioriza a memória customizada salva no item granular
    if (linha.itemEquipamento.memoria_customizada) {
        return linha.itemEquipamento.memoria_customizada;
    }
    
    // 2. Se não houver customizada, gera a memória automática para o item granular
    const item = linha.itemEquipamento;
    const isLubrificante = linha.suprimentoTipo === 'LUBRIFICANTE';
    const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
    
    const omArticle = getOmArticle(linha.omDetentoraEquipamento);
    const diasPluralHeader = pluralizeDay(linha.itemEquipamento.dias_utilizados);
    const faseFormatada = formatFasesParaTexto(linha.faseAtividade);
    
    let header = "";
    let detalhamento = "";
    
    if (isLubrificante) {
        const consumptionUnit = item.categoria === 'GERADOR' ? 'L/100h' : 'L/h';
        
        header = `33.90.30 - Aquisição de Lubrificante para ${item.item} (${item.quantidade} un.) ${omArticle} ${linha.omDetentoraEquipamento}, durante ${item.dias_utilizados} ${diasPluralHeader} de ${faseFormatada}.`;
        
        const totalHoras = item.quantidade * item.horas_dia * item.dias_utilizados;
        const litrosLubrificante = linha.totalLitros;
        
        detalhamento = `Cálculo:
- Consumo Lubrificante: ${formatNumber(item.consumo_lubrificante_litro, 2)} ${consumptionUnit}
- Preço Lubrificante: ${formatCurrency(item.preco_lubrificante)}

Fórmula: (Nr Equipamentos x Nr Horas/dia x Nr dias) x Consumo Lubrificante.
- (${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${item.dias_utilizados} ${diasPluralHeader}) x ${formatNumber(item.consumo_lubrificante_litro, 2)} ${consumptionUnit} = ${formatNumber(litrosLubrificante, 2)} L

Total: ${formatNumber(litrosLubrificante, 2)} L x ${formatCurrency(item.preco_lubrificante)} = ${formatCurrency(linha.valorTotal)}.`;
        
    } else {
        // Combustível
        const tipoCombustivelLabel = getTipoCombustivelLabel(linha.suprimentoTipo);
        const unidadeLabel = linha.suprimentoTipo === 'COMBUSTIVEL_GASOLINA' ? 'GAS' : 'OD';
        
        header = `33.90.30 - Aquisição de Combustível (${tipoCombustivelLabel}) para ${item.item} (${item.quantidade} un.) ${omArticle} ${linha.omDetentoraEquipamento}, durante ${item.dias_utilizados} ${diasPluralHeader} de ${faseFormatada}.`;
        
        let formulaPrincipal = "";
        let formulaLitros = "";
        let litrosSemMargemItem = 0;
        
        if (isMotomecanizacao) {
            formulaPrincipal = "Fórmula: (Nr Viaturas x Km/Desloc x Nr Desloc/dia x Nr Dias) ÷ Rendimento (Km/L).";
            litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * item.dias_utilizados) / item.consumo_fixo;
            formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${item.dias_utilizados} ${diasPluralHeader}) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
        } else {
            formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
            litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * item.dias_utilizados;
            formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${item.dias_utilizados} ${diasPluralHeader}`;
        }
        
        detalhamento = `Cálculo:
- Preço Unitário: ${formatCurrency(linha.precoLitro)}.

${formulaPrincipal}
- ${formulaLitros} = ${formatNumber(litrosSemMargemItem)} L ${unidadeLabel}.

Total: ${formatNumber(litrosSemMargemItem)} L ${unidadeLabel} + 30% (Margem) = ${formatNumber(linha.totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(linha.totalLitros)} L ${unidadeLabel} x ${formatCurrency(linha.precoLitro)} = ${formatCurrency(linha.valorTotal)}.`;
    }
    
    return `${header}

OM Detentora Equipamento: ${linha.omDetentoraEquipamento} (UG: ${formatCodug(linha.ugDetentoraEquipamento)})
Recurso destinado à OM: ${linha.omDestinoRecurso} (UG: ${formatCodug(linha.ugDestinoRecurso)})

${detalhamento}`;
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
  fileSuffix,
  generateClasseIMemoriaCalculo,
  generateClasseIIMemoriaCalculo = defaultGenerateClasseIIMemoriaCalculo,
  generateClasseVMemoriaCalculo,
  generateClasseVIMemoriaCalculo = defaultGenerateClasseVIMemoriaCalculo,
  generateClasseVIIMemoriaCalculo = defaultGenerateClasseVIIMemoriaCalculo,
  generateClasseVIIIMemoriaCalculo = defaultGenerateClasseVIIIMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isLubrificanteConsolidado = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivelConsolidado = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';

  // 1. Recalcular Totais Gerais (para HTML/PDF)
  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.omDestinoRecurso || '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasClasseIII[0]?.omDestinoRecurso || '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  
  // NOVO: Total Combustível Geral (somado de todas as OMs)
  const totalValorCombustivel = useMemo(() => {
    return Object.values(gruposPorOM).reduce((acc, grupo) => {
        // Soma o valor total de todas as linhas de combustível (Diesel/Gasolina)
        return acc + grupo.linhasClasseIII
            .filter(l => l.suprimentoTipo.startsWith('COMBUSTIVEL'))
            .reduce((sum, l) => sum + l.valorTotal, 0);
    }, 0);
  }, [gruposPorOM]);
  
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
  const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivel;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  // NOVO: Função para gerar o nome do arquivo (mantida)
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    
    if (isMinuta) {
        nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    }
    
    nomeBase += ` - ${ptrabData.nome_operacao}`;
    nomeBase += ` - Atz ${dataAtz} - ${fileSuffix}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  // RENOMEADO: Função que era handlePrint, agora é exportPDF (mantida)
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
  }, [ptrabData, toast, diasOperacao, totalGeral_GND3_ND, totalValorCombustivel, totalGeral_33_90_30, totalGeral_33_90_39, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, fileSuffix, generateClasseVIIIMemoriaCalculo]);

  // NOVO: Função para abrir o diálogo de impressão do navegador (mantida)
  const handlePrint = () => {
    window.print();
  };

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const dataLeftMiddleAlignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
    const dataCenterMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const dataCenterMonetaryAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }; 
    const dataTextStyle = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    
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
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares do Exército Brasileiro`);
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
      const headerFillGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      const headerFillAzul = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      const headerFillLaranja = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      
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
              cell.font = headerFontStyle;
          } else if (col === 'F' || col === 'G' || col === 'H') {
              cell.fill = headerFillLaranja;
              cell.font = headerFontStyle;
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
              cell.font = headerFontStyle;
          } else if (col === 'F' || col === 'G' || col === 'H') {
              cell.fill = headerFillLaranja;
              cell.font = headerFontStyle;
          }
          if (col === 'A' || col === 'B' || col === 'I') {
              cell.value = '';
          }
      });
      
      currentRow = headerRow2 + 1;

      omsOrdenadas.forEach((nomeOM) => {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        if (totaisOM.total_gnd3 === 0 && grupo.linhasClasseIII.length === 0) {
          return;
        }
        
        // Array de todas as linhas de despesa, ordenadas pela sequência romana:
        const linhasDespesaOrdenadas = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...grupo.linhasClasseIII.filter(l => l.suprimentoTipo === 'LUBRIFICANTE'), // Lubrificante (ND 30)
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI,
            ...grupo.linhasClasseVII,
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX,
            // Combustível (ND 30, mas com colunas Laranja) - APENAS na RM de Fornecimento
            ...(nomeOM === nomeRM ? grupo.linhasClasseIII.filter(l => l.suprimentoTipo.startsWith('COMBUSTIVEL')) : []),
        ];
        
        linhasDespesaOrdenadas.forEach((linha) => {
          const isClasseI = 'tipo' in linha;
          const isClasseII_IX = 'categoria' in linha.registro;
          const isClasseIII = 'suprimentoTipo' in linha;
          
          const rowData = {
              despesasValue: '',
              omValue: '',
              detalhamentoValue: '',
              valorC: 0,
              valorD: 0,
              valorE: 0,
              litrosF: 0,
              precoG: 0,
              precoH: 0,
              isCombustivelLine: false,
          };
          
          if (isClasseI) { // Classe I (QS/QR)
              const registro = linha.registro as ClasseIRegistro;
              const ug_qs_formatted = formatCodug(registro.ug_qs);
              const ug_qr_formatted = formatCodug(registro.ug);

              if (linha.tipo === 'QS') {
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
          } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
              const registro = linha.registro as ClasseIIRegistro;
              const omDestinoRecurso = registro.organizacao;
              const ugDestinoRecurso = formatCodug(registro.ug);
              
              let categoriaDetalhe = getClasseIILabel(registro.categoria);
              if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                  categoriaDetalhe = `${categoriaDetalhe} - ${registro.animal_tipo}`;
              }
                            
              const omDetentora = registro.om_detentora || omDestinoRecurso;
              const isDifferentOm = omDetentora !== omDestinoRecurso;
              
              let prefixoClasse = '';
              if (CLASSE_V_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE V'; } 
              else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE VI'; } 
              else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE VII'; } 
              else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE VIII'; } 
              else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE IX'; } 
              else { prefixoClasse = 'CLASSE II'; }
              
              rowData.despesasValue = `${prefixoClasse} - ${categoriaDetalhe ? categoriaDetalhe.toUpperCase() : 'CATEGORIA DESCONHECIDA'}`;
              if (isDifferentOm) { rowData.despesasValue += `\n${omDetentora}`; }
              
              rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
              rowData.valorC = registro.valor_nd_30;
              rowData.valorD = registro.valor_nd_39;
              rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
              
              rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, prefixoClasse === 'CLASSE II');
              
          } else if (isClasseIII) { // Classe III (Granular)
              const linhaClasseIII = linha as LinhaClasseIII;
              const item = linhaClasseIII.itemEquipamento;
              const isLub = linhaClasseIII.suprimentoTipo === 'LUBRIFICANTE';
              
              const omDetentoraEquipamento = linhaClasseIII.omDetentoraEquipamento;
              const omDestinoRecurso = linhaClasseIII.omDestinoRecurso;
              const ugDestinoRecurso = formatCodug(linhaClasseIII.ugDestinoRecurso);
              
              const categoriaLabel = getTipoEquipamentoLabel(item.categoria);
              
              // 1. Coluna A: Despesas
              if (isLub) {
                  rowData.despesasValue = `CLASSE III - LUBRIFICANTE\n${omDetentoraEquipamento}\n${categoriaLabel} - ${item.item}`;
              } else {
                  const tipoCombustivelLabel = getTipoCombustivelLabel(linhaClasseIII.suprimentoTipo);
                  rowData.despesasValue = `CLASSE III - COMBUSTÍVEL\n${tipoCombustivelLabel}\n${omDetentoraEquipamento}\n${categoriaLabel} - ${item.item}`;
                  rowData.isCombustivelLine = true;
              }
              
              // 2. Coluna B: OM (UGE) CODUG
              rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
              
              // 3. Colunas C, D, E (Natureza de Despesa)
              if (isLub) {
                  rowData.valorC = linhaClasseIII.valorTotal; // Lubrificante é ND 30
                  rowData.valorE = linhaClasseIII.valorTotal;
              } else {
                  // Combustível: ND 30, mas só preenche se não for linha de Combustível (para evitar dupla contagem)
                  // NOVO: Para granularidade, Combustível é ND 30, mas só é exibido na parte Laranja.
                  // Deixamos C, D, E vazios para linhas de Combustível.
                  rowData.valorC = 0; 
                  rowData.valorD = 0;
                  rowData.valorE = 0;
              }
              
              // 4. Colunas F, G, H (Combustível)
              if (isLub) {
                  // Lubrificante: Litros e Preço Unitário (Preço Médio)
                  rowData.litrosF = linhaClasseIII.totalLitros;
                  rowData.precoG = linhaClasseIII.precoLitro;
                  rowData.precoH = linhaClasseIII.valorTotal;
              } else {
                  // Combustível: Litros e Preço Unitário
                  rowData.litrosF = linhaClasseIII.totalLitros;
                  rowData.precoG = linhaClasseIII.precoLitro;
                  rowData.precoH = linhaClasseIII.valorTotal;
              }
              
              // 5. Coluna I: Detalhamento (Memória Granular)
              rowData.detalhamentoValue = generateGranularClasseIIIMemoria(linhaClasseIII);
          }
          
          const row = worksheet.getRow(currentRow);
          
          row.getCell('A').value = rowData.despesasValue;
          row.getCell('B').value = rowData.omValue;
          
          // Colunas Natureza de Despesa (Azul)
          row.getCell('C').value = rowData.valorC > 0 ? rowData.valorC : '';
          row.getCell('C').numFmt = 'R$ #,##0.00';
          row.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
          
          row.getCell('D').value = rowData.valorD > 0 ? rowData.valorD : '';
          row.getCell('D').numFmt = 'R$ #,##0.00';
          row.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
          
          row.getCell('E').value = rowData.valorE > 0 ? rowData.valorE : '';
          row.getCell('E').numFmt = 'R$ #,##0.00';
          row.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
          
          // Colunas Combustível (Laranja)
          row.getCell('F').value = rowData.litrosF > 0 ? Math.round(rowData.litrosF) : '';
          row.getCell('F').numFmt = '#,##0 "L"';
          row.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          
          row.getCell('G').value = rowData.precoG > 0 ? rowData.precoG : '';
          row.getCell('G').numFmt = 'R$ #,##0.00';
          row.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          
          row.getCell('H').value = rowData.precoH > 0 ? rowData.precoH : '';
          row.getCell('H').numFmt = 'R$ #,##0.00';
          row.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          
          row.getCell('I').value = rowData.detalhamentoValue;
          row.getCell('I').font = { name: 'Arial', size: 6.5 };
          
          // GARANTIA DE BORDA SIMPLES PARA LINHAS DE DADOS
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            row.getCell(col).border = cellBorder;
            row.getCell(col).font = baseFontStyle;
          });
          
          // Aplica alinhamentos específicos para dados
          row.getCell('A').alignment = dataLeftMiddleAlignment;
          row.getCell('B').alignment = dataCenterMiddleAlignment;
          row.getCell('C').alignment = dataCenterMonetaryAlignment;
          row.getCell('D').alignment = dataCenterMonetaryAlignment;
          row.getCell('E').alignment = dataCenterMonetaryAlignment;
          row.getCell('F').alignment = dataCenterMiddleAlignment;
          row.getCell('G').alignment = dataCenterMiddleAlignment;
          row.getCell('H').alignment = dataCenterMonetaryAlignment;
          row.getCell('I').alignment = dataTextStyle;
          
          currentRow++;
        });
        
        // Subtotal da OM (Mantido)
        const subtotalRow = worksheet.getRow(currentRow);
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30;
        subtotalRow.getCell('C').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('C').font = { bold: true };
        subtotalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('C').style = { ...subtotalRow.getCell('C').style, alignment: centerMiddleAlignment, border: cellBorder };
        
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalRow.getCell('D').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('D').font = { bold: true };
        subtotalRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('D').style = { ...subtotalRow.getCell('D').style, alignment: centerMiddleAlignment, border: cellBorder };

        subtotalRow.getCell('E').value = totaisOM.total_parte_azul;
        subtotalRow.getCell('E').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('E').font = { bold: true };
        subtotalRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('E').style = { ...subtotalRow.getCell('E').style, alignment: centerMiddleAlignment, border: cellBorder };
        
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
        subtotalRow.getCell('H').style = { ...subtotalRow.getCell('H').style, alignment: centerMiddleAlignment, border: cellBorder };
        
        ['A', 'B', 'I'].forEach(col => {
            subtotalRow.getCell(col).border = cellBorder;
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
        totalOMRow.getCell('E').style = { ...totalOMRow.getCell('E').style, alignment: centerMiddleAlignment, border: cellBorder };
        
        ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'I'].forEach(col => {
            totalOMRow.getCell(col).border = cellBorder;
            if (!totalOMRow.getCell(col).fill) {
                totalOMRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
            }
        });
        
        currentRow++;
      });
      
      currentRow++;
      
      // CÁLCULO TOTAL GERAL (Mantido)
      const totalDiesel = gruposPorOM[nomeRM]?.linhasClasseIII
        .filter(l => l.suprimentoTipo === 'COMBUSTIVEL_DIESEL')
        .reduce((acc, reg) => acc + reg.totalLitros, 0) || 0;
      const totalGasolina = gruposPorOM[nomeRM]?.linhasClasseIII
        .filter(l => l.suprimentoTipo === 'COMBUSTIVEL_GASOLINA')
        .reduce((acc, reg) => acc + reg.totalLitros, 0) || 0;
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
      somaRow.getCell('C').style = { ...somaRow.getCell('C').style, alignment: centerMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('D').value = totalGeral_33_90_39;
      somaRow.getCell('D').numFmt = 'R$ #,##0.00';
      somaRow.getCell('D').font = { bold: true };
      somaRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('D').style = { ...somaRow.getCell('D').style, alignment: centerMiddleAlignment, border: cellBorder };
      
      somaRow.getCell('E').value = totalGeral_GND3_ND;
      somaRow.getCell('E').numFmt = 'R$ #,##0.00';
      somaRow.getCell('E').font = { bold: true };
      somaRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('E').style = { ...somaRow.getCell('E').style, alignment: centerMiddleAlignment, border: cellBorder };
      
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
      somaRow.getCell('H').style = { ...somaRow.getCell('H').style, alignment: centerMiddleAlignment, border: cellBorder };
      
      ['A', 'B', 'I'].forEach(col => {
        somaRow.getCell(col).border = cellBorder;
        if (!somaRow.getCell(col).fill) {
            somaRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
        }
      });
      
      currentRow++;
      
      const valorTotalRow = worksheet.getRow(currentRow);
      
      // 1. Mesclar A a F
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      
      // 2. Aplicar cor cinza claro (corTotalOM) a toda a linha
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
          valorTotalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
      });
      
      // 3. Configurar célula G (VALOR TOTAL)
      valorTotalRow.getCell('G').value = 'VALOR TOTAL';
      valorTotalRow.getCell('G').font = { bold: true };
      valorTotalRow.getCell('G').alignment = centerMiddleAlignment;
      valorTotalRow.getCell('G').border = cellBorder;
      
      // 4. Configurar célula H (Valor)
      valorTotalRow.getCell('H').value = valorTotalSolicitado;
      valorTotalRow.getCell('H').numFmt = 'R$ #,##0.00';
      valorTotalRow.getCell('H').font = { bold: true };
      valorTotalRow.getCell('H').alignment = centerMiddleAlignment;
      valorTotalRow.getCell('H').border = cellBorder;
      
      // 5. Configurar célula I (Borda fina)
      valorTotalRow.getCell('I').border = cellBorder;
      
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
        bottom: { style: 'thin' as const }, // Borda fina
        right: { style: 'thin' as const }
      };
      
      currentRow++;
      
      currentRow++;
      
      // --- RODAPÉ CENTRALIZADO ---
      const localRow = worksheet.getRow(currentRow);
      localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      localRow.getCell('A').font = { name: 'Arial', size: 10 };
      localRow.getCell('A').alignment = centerMiddleAlignment; // Centraliza
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const cmtRow = worksheet.getRow(currentRow);
      cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
      cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
      cmtRow.getCell('A').alignment = centerMiddleAlignment; // Centraliza
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      const cargoRow = worksheet.getRow(currentRow);
      cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
      cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
      cargoRow.getCell('A').alignment = centerMiddleAlignment; // Centraliza
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      // --- FIM RODAPÉ CENTRALIZADO ---
      
      const fileName = generateFileName('Excel');
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Excel gerado com sucesso!",
        description: `Arquivo exportado com formatação completa.`,
      });
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast({
        title: "Erro ao gerar Excel",
        description: "Não foi possível exportar o documento. Verifique o console para detalhes.",
        variant: "destructive",
      });
    }
  }, [ptrabData, toast, gruposPorOM, calcularTotaisPorOM, nomeRM, fileSuffix, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseVMemoriaCalculo, generateClasseVIMemoriaCalculo, generateClasseVIIMemoriaCalculo, generateClasseVIIIMemoriaCalculo, generateClasseIIIMemoriaCalculo]);

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

      {/* Ajustado o padding para simular a margem de 0.5cm (0.5cm = 0.5rem se 1rem=1cm, mas usaremos 0.5rem para ser sutil) */}
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
                if (totaisOM.total_gnd3 === 0 && grupo.linhasClasseIII.length === 0) {
                  return [];
                }
                
                // Array de todas as linhas de despesa, ordenadas pela sequência romana:
                const linhasDespesaOrdenadas = [
                    ...grupo.linhasQS,
                    ...grupo.linhasQR,
                    ...grupo.linhasClasseII,
                    ...grupo.linhasClasseIII.filter(l => l.suprimentoTipo === 'LUBRIFICANTE'), // Lubrificante (ND 30)
                    ...grupo.linhasClasseV,
                    ...grupo.linhasClasseVI,
                    ...grupo.linhasClasseVII,
                    ...grupo.linhasClasseVIII,
                    ...grupo.linhasClasseIX,
                    // Combustível (ND 30, mas com colunas Laranja) - APENAS na RM de Fornecimento
                    ...(nomeOM === nomeRM ? grupo.linhasClasseIII.filter(l => l.suprimentoTipo.startsWith('COMBUSTIVEL')) : []),
                ];
                
                return [
                  // 1. Renderizar todas as linhas de despesa (I, II, III Lub, V, VI, VII, VIII, IX)
                  ...linhasDespesaOrdenadas.map((linha) => {
                    const isClasseI = 'tipo' in linha;
                    const isClasseII_IX = 'categoria' in linha.registro;
                    const isClasseIII = 'suprimentoTipo' in linha;
                    
                    const rowData = {
                        despesasValue: '',
                        omValue: '',
                        detalhamentoValue: '',
                        valorC: 0,
                        valorD: 0,
                        valorE: 0,
                        litrosF: 0,
                        precoG: 0,
                        precoH: 0,
                        isCombustivelLine: false,
                    };
                    
                    if (isClasseI) { // Classe I (QS/QR)
                        const registro = linha.registro as ClasseIRegistro;
                        const ug_qs_formatted = formatCodug(registro.ug_qs);
                        const ug_qr_formatted = formatCodug(registro.ug);

                        if (linha.tipo === 'QS') {
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
                    } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                        const registro = linha.registro as ClasseIIRegistro;
                        const omDestinoRecurso = registro.organizacao;
                        const ugDestinoRecurso = formatCodug(registro.ug);
                        
                        let categoriaDetalhe = getClasseIILabel(registro.categoria);
                        if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                            categoriaDetalhe = `${categoriaDetalhe} - ${registro.animal_tipo}`;
                        }
                            
                        const omDetentora = registro.om_detentora || omDestinoRecurso;
                        const isDifferentOm = omDetentora !== omDestinoRecurso;
                        
                        let prefixoClasse = '';
                        if (CLASSE_V_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE V'; } 
                        else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE VI'; } 
                        else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE VII'; } 
                        else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE VIII'; } 
                        else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) { prefixoClasse = 'CLASSE IX'; } 
                        else { prefixoClasse = 'CLASSE II'; }
                        
                        rowData.despesasValue = `${prefixoClasse} - ${categoriaDetalhe ? categoriaDetalhe.toUpperCase() : 'CATEGORIA DESCONHECIDA'}`;
                        if (isDifferentOm) { rowData.despesasValue += `\n${omDetentora}`; }
                        
                        rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                        rowData.valorC = registro.valor_nd_30;
                        rowData.valorD = registro.valor_nd_39;
                        rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                        
                        rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro, prefixoClasse === 'CLASSE II');
                        
                    } else if (isClasseIII) { // Classe III (Granular)
                        const linhaClasseIII = linha as LinhaClasseIII;
                        const item = linhaClasseIII.itemEquipamento;
                        const isLub = linhaClasseIII.suprimentoTipo === 'LUBRIFICANTE';
                        
                        const omDetentoraEquipamento = linhaClasseIII.omDetentoraEquipamento;
                        const omDestinoRecurso = linhaClasseIII.omDestinoRecurso;
                        const ugDestinoRecurso = formatCodug(linhaClasseIII.ugDestinoRecurso);
                        
                        const categoriaLabel = getTipoEquipamentoLabel(item.categoria);
                        
                        // 1. Coluna A: Despesas
                        if (isLub) {
                            rowData.despesasValue = `CLASSE III - LUBRIFICANTE\n${omDetentoraEquipamento}\n${categoriaLabel} - ${item.item}`;
                        } else {
                            const tipoCombustivelLabel = getTipoCombustivelLabel(linhaClasseIII.suprimentoTipo);
                            rowData.despesasValue = `CLASSE III - COMBUSTÍVEL\n${tipoCombustivelLabel}\n${omDetentoraEquipamento}\n${categoriaLabel} - ${item.item}`;
                            rowData.isCombustivelLine = true;
                        }
                        
                        // 2. Coluna B: OM (UGE) CODUG
                        rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                        
                        // 3. Colunas C, D, E (Natureza de Despesa)
                        if (isLub) {
                            rowData.valorC = linhaClasseIII.valorTotal; // Lubrificante é ND 30
                            rowData.valorE = linhaClasseIII.valorTotal;
                        } else {
                            // Combustível: ND 30, mas só preenche se não for linha de Combustível (para evitar dupla contagem)
                            rowData.valorC = 0; 
                            rowData.valorD = 0;
                            rowData.valorE = 0;
                        }
                        
                        // 4. Colunas F, G, H (Combustível)
                        if (isLub) {
                            // Lubrificante: Litros e Preço Unitário (Preço Médio)
                            rowData.litrosF = linhaClasseIII.totalLitros;
                            rowData.precoG = linhaClasseIII.precoLitro;
                            rowData.precoH = linhaClasseIII.valorTotal;
                        } else {
                            // Combustível: Litros e Preço Unitário
                            rowData.litrosF = linhaClasseIII.totalLitros;
                            rowData.precoG = linhaClasseIII.precoLitro;
                            rowData.precoH = linhaClasseIII.valorTotal;
                        }
                        
                        // 5. Coluna I: Detalhamento (Memória Granular)
                        rowData.detalhamentoValue = generateGranularClasseIIIMemoria(linhaClasseIII);
                    }
                    
                    return (
                      <tr key={isClasseI ? `${linha.registro.id}-${linha.tipo}` : isClasseIII ? linha.id : `classe-ii-${linha.registro.id}`}>
                        <td className="col-despesas">
                          {rowData.despesasValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </td>
                        <td className="col-om">
                          {rowData.omValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorC > 0 ? formatCurrency(rowData.valorC) : ''}</td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorD > 0 ? formatCurrency(rowData.valorD) : ''}</td>
                        <td className="col-valor-natureza" style={{ backgroundColor: '#B4C7E7' }}>{rowData.valorE > 0 ? formatCurrency(rowData.valorE) : ''}</td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.litrosF > 0 ? `${formatNumber(rowData.litrosF)} L` : ''}</td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.precoG > 0 ? formatCurrency(rowData.precoG) : ''}</td>
                        <td className="col-combustivel-data-filled" style={{ backgroundColor: '#F8CBAD' }}>{rowData.precoH > 0 ? formatCurrency(rowData.precoH) : ''}</td>
                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                          <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {rowData.detalhamentoValue}
                          </pre>
                        </td>
                      </tr>
                    );
                  }),
                  
                  // Subtotal da OM (Mantido)
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
                <td colSpan={9} style={{ height: '20px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
              </tr>
              
              {(() => {
                // Totais de combustível por tipo (para exibição na parte laranja)
                const totalDiesel = gruposPorOM[nomeRM]?.linhasClasseIII
                  .filter(l => l.suprimentoTipo === 'COMBUSTIVEL_DIESEL')
                  .reduce((acc, reg) => acc + reg.totalLitros, 0) || 0;
                const totalGasolina = gruposPorOM[nomeRM]?.linhasClasseIII
                  .filter(l => l.suprimentoTipo === 'COMBUSTIVEL_GASOLINA')
                  .reduce((acc, reg) => acc + reg.totalLitros, 0) || 0;
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
                      <td colSpan={6} style={{ backgroundColor: '#E8E8E8', border: '1px solid #000', borderRight: 'none' }}></td>
                      <td className="text-center font-bold" style={{ whiteSpace: 'nowrap', backgroundColor: '#E8E8E8', border: '1px solid #000' }}>VALOR TOTAL</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ backgroundColor: '#E8E8E8', border: '1px solid #000' }}></td>
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
                      <td colSpan={7} style={{ borderLeft: 'none', borderRight: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderBottom: '1px solid #000', borderRight: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
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