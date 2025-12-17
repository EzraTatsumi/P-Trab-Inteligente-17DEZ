import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA } from "@/lib/formatUtils";
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
  
  // NOVO: Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    
    // 1. Usar a sigla da OM diretamente (sem forçar caixa alta)
    const omSigla = ptrabData.nome_om;
    
    // 2. Construir o nome base com a OM em posição padronizada:
    // P Trab Nr [NUMERO] - [OM_SIGLA] - [NOME_OPERACAO]
    let nomeBase = `P Trab Nr ${numeroPTrab} - ${omSigla} - ${ptrabData.nome_operacao}`;
    
    // 3. Adicionar a data de atualização
    nomeBase += ` - Atz ${dataAtz}`;
    
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  const handlePrint = useCallback(() => {
    if (!contentRef.current) return;

    toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto o relatório é processado.",
    });

    html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(generateFileName('PDF'));
      onExportSuccess();
      toast.dismiss();
      toast({
        title: "PDF Exportado!",
        description: "O P Trab Logístico foi salvo com sucesso.",
        duration: 3000,
      });
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      toast.dismiss();
      toast({
        title: "Erro na Exportação",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    });
  }, [ptrabData, onExportSuccess, toast, diasOperacao, totalGeral_GND3_ND, totalValorCombustivel, totalGeral_33_90_30, totalGeral_33_90_39, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);

  const handleExportExcel = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('P Trab Logístico');

    // Estilos
    const headerStyle = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } },
        font: { bold: true, color: { argb: 'FF000000' } },
        border: {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        },
        alignment: { vertical: 'middle', horizontal: 'center' as const }
    };
    
    const dataStyle = {
        border: {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        },
        alignment: { vertical: 'middle', horizontal: 'left' as const }
    };
    
    const currencyStyle = {
        ...dataStyle,
        numFmt: 'R$ #,##0.00',
        alignment: { vertical: 'middle', horizontal: 'right' as const }
    };
    
    const numberStyle = {
        ...dataStyle,
        numFmt: '#,##0',
        alignment: { vertical: 'middle', horizontal: 'right' as const }
    };

    // Cabeçalho do P Trab
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `PLANO DE TRABALHO LOGÍSTICO`;
    worksheet.getCell('A1').style = { ...headerStyle, alignment: { vertical: 'middle', horizontal: 'center' as const } };
    
    worksheet.addRow(['P Trab:', ptrabData.numero_ptrab, 'Operação:', ptrabData.nome_operacao, 'Período:', `${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} (${diasOperacao} dias)`]);
    worksheet.addRow(['OM:', ptrabData.nome_om, 'CMA:', ptrabData.comando_militar_area, 'Efetivo:', ptrabData.efetivo_empregado]);
    worksheet.addRow([]); // Linha em branco

    // 1. Tabela de Totais por OM
    worksheet.addRow(['1. CONSOLIDAÇÃO DE CUSTOS POR OM DE DESTINO']);
    worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
    worksheet.addRow([]);

    const totalHeaders = [
        { header: 'OM de Destino', key: 'om', width: 30 },
        { header: 'UG', key: 'ug', width: 15 },
        { header: 'ND 33.90.30 (Material)', key: 'nd30', width: 20 },
        { header: 'ND 33.90.39 (Serviço)', key: 'nd39', width: 20 },
        { header: 'Total ND (30+39)', key: 'total_nd', width: 20 },
        { header: 'Combustível (ND 30)', key: 'combustivel', width: 20 },
        { header: 'TOTAL GERAL (GND 3)', key: 'total_gnd3', width: 25 },
    ];
    
    worksheet.columns = totalHeaders;
    
    const totalHeaderRow = worksheet.addRow(totalHeaders.map(h => h.header));
    totalHeaderRow.eachCell(cell => {
        cell.style = headerStyle;
    });

    let totalGeralGND3 = 0;

    omsOrdenadas.forEach(omName => {
        const grupo = gruposPorOM[omName];
        if (!grupo) return;

        const totais = calcularTotaisPorOM(grupo, omName);
        totalGeralGND3 += totais.total_gnd3;

        const ug = grupo.linhasQS[0]?.registro.ug_qs || grupo.linhasQR[0]?.registro.ug || grupo.linhasClasseII[0]?.registro.ug || grupo.linhasLubrificante[0]?.registro.ug || '';

        const row = worksheet.addRow([
            omName,
            ug,
            totais.total_33_90_30,
            totais.total_33_90_39,
            totais.total_parte_azul,
            totais.total_combustivel,
            totais.total_gnd3,
        ]);
        
        row.eachCell((cell, colNumber) => {
            if (colNumber >= 3) {
                cell.style = currencyStyle;
            } else {
                cell.style = dataStyle;
            }
        });
    });
    
    // Linha de Totais Gerais
    const totalRow = worksheet.addRow(['TOTAL GERAL', '', totalGeral_33_90_30, totalGeral_33_90_39, totalGeral_GND3_ND, totalValorCombustivel, valorTotalSolicitado]);
    totalRow.eachCell(cell => {
        cell.style = { ...headerStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } } };
    });
    worksheet.mergeCells(totalRow.number, 1, totalRow.number, 2);
    worksheet.getCell(`A${totalRow.number}`).value = 'TOTAL GERAL';
    worksheet.getCell(`C${totalRow.number}`).style = currencyStyle;
    worksheet.getCell(`D${totalRow.number}`).style = currencyStyle;
    worksheet.getCell(`E${totalRow.number}`).style = currencyStyle;
    worksheet.getCell(`F${totalRow.number}`).style = currencyStyle;
    worksheet.getCell(`G${totalRow.number}`).style = currencyStyle;


    // 2. Tabela de Detalhamento de Combustível (Apenas para a RM)
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow(['2. DETALHAMENTO DE COMBUSTÍVEL (CLASSE III)']);
    worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
    worksheet.addRow([]);
    
    const combustivelHeaders = [
        { header: 'Tipo Equipamento', key: 'tipo_equipamento', width: 30 },
        { header: 'OM', key: 'organizacao', width: 20 },
        { header: 'UG', key: 'ug', width: 15 },
        { header: 'Qtd', key: 'quantidade', width: 10 },
        { header: 'Consumo', key: 'consumo', width: 15 },
        { header: 'Unidade', key: 'unidade', width: 10 },
        { header: 'Dias Op', key: 'dias_operacao', width: 10 },
        { header: 'Total Litros', key: 'total_litros', width: 15 },
        { header: 'Preço Litro', key: 'preco_litro', width: 15 },
        { header: 'Valor Total (R$)', key: 'valor_total', width: 20 },
    ];
    
    worksheet.columns = combustivelHeaders;
    
    const combustivelHeaderRow = worksheet.addRow(combustivelHeaders.map(h => h.header));
    combustivelHeaderRow.eachCell(cell => {
        cell.style = headerStyle;
    });

    registrosClasseIII.filter(isCombustivel).forEach(reg => {
        const row = worksheet.addRow([
            reg.tipo_equipamento_detalhe || reg.tipo_equipamento,
            reg.organizacao,
            reg.ug,
            reg.quantidade,
            reg.consumo_hora || reg.consumo_km_litro,
            reg.consumo_hora ? 'L/h' : 'km/L',
            reg.dias_operacao,
            reg.total_litros,
            reg.preco_litro,
            reg.valor_total,
        ]);
        
        row.eachCell((cell, colNumber) => {
            if (colNumber === 10) { // Valor Total
                cell.style = currencyStyle;
            } else if (colNumber === 8) { // Total Litros
                cell.style = numberStyle;
            } else if (colNumber === 9) { // Preço Litro
                cell.style = currencyStyle;
            } else {
                cell.style = dataStyle;
            }
        });
    });
    
    // 3. Memórias de Cálculo (Classe I e Classes Diversas)
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow(['3. MEMÓRIAS DE CÁLCULO']);
    worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
    
    omsOrdenadas.forEach(omName => {
        const grupo = gruposPorOM[omName];
        if (!grupo) return;

        // Memórias de Classe I (QS/QR)
        grupo.linhasQS.forEach(linha => {
            const { qs, qr } = generateClasseIMemoriaCalculo(linha.registro);
            
            worksheet.addRow([]);
            worksheet.addRow([`OM: ${linha.registro.organizacao} (UG: ${linha.registro.ug}) - CLASSE I (RAÇÃO QUENTE)`]);
            worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
            
            worksheet.addRow(['QS - Quantitativo de Subsistência']);
            qs.split('\n').forEach(line => {
                worksheet.addRow([line]);
                worksheet.getCell(`A${worksheet.rowCount}`).style = { alignment: { wrapText: true } };
            });
            
            worksheet.addRow(['QR - Quantitativo de Reforço']);
            qr.split('\n').forEach(line => {
                worksheet.addRow([line]);
                worksheet.getCell(`A${worksheet.rowCount}`).style = { alignment: { wrapText: true } };
            });
        });
        
        // Memórias de Classes II, V, VI, VII, VIII, IX
        const allClasseIIRegistros = [
            ...grupo.linhasClasseII, 
            ...grupo.linhasClasseV, 
            ...grupo.linhasClasseVI, 
            ...grupo.linhasClasseVII, 
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX,
        ];
        
        allClasseIIRegistros.forEach(linha => {
            const memoria = generateClasseIIMemoriaCalculo(linha.registro);
            const classeLabel = getClasseIILabel(linha.registro.categoria);
            
            worksheet.addRow([]);
            worksheet.addRow([`OM: ${linha.registro.organizacao} (UG: ${linha.registro.ug}) - ${classeLabel}`]);
            worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
            
            memoria.split('\n').forEach(line => {
                worksheet.addRow([line]);
                worksheet.getCell(`A${worksheet.rowCount}`).style = { alignment: { wrapText: true } };
            });
        });
    });

    // Exportar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFileName('Excel');
    a.click();
    window.URL.revokeObjectURL(url);

    onExportSuccess();
    toast({
      title: "Excel Exportado!",
      description: "O P Trab Logístico foi salvo com sucesso.",
      duration: 3000,
    });
  }, [ptrabData, diasOperacao, totalGeral_33_90_30, totalGeral_33_90_39, totalValorCombustivel, valorTotalSolicitado, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, registrosClasseIII, onExportSuccess, toast]);


  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3 print:hidden">
        <Button onClick={handleExportExcel} variant="secondary" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </Button>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir / Exportar PDF
        </Button>
      </div>

      {/* Conteúdo do Relatório (para impressão) */}
      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">PLANO DE TRABALHO LOGÍSTICO</h1>
          <p className="text-sm text-gray-600">
            {ptrabData.nome_om_extenso} ({ptrabData.nome_om})
          </p>
        </div>

        {/* Dados do P Trab */}
        <div className="text-xs border border-gray-300 p-3 mb-6">
          <div className="grid grid-cols-3 gap-x-4 gap-y-1">
            <p><strong>P Trab Nr:</strong> {ptrabData.numero_ptrab}</p>
            <p><strong>Operação:</strong> {ptrabData.nome_operacao}</p>
            <p><strong>Período:</strong> {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} ({diasOperacao} dias)</p>
            <p><strong>OM:</strong> {ptrabData.nome_om}</p>
            <p><strong>CMA:</strong> {ptrabData.comando_militar_area}</p>
            <p><strong>Efetivo Empregado:</strong> {ptrabData.efetivo_empregado}</p>
          </div>
        </div>

        {/* Tabela de Totais por OM */}
        <h2 className="text-base font-bold mb-3">1. Consolidação de Custos por OM de Destino</h2>
        <table className="w-full border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">OM de Destino (UG)</th>
              <th className="border border-gray-300 p-2 text-right">ND 33.90.30 (Material)</th>
              <th className="border border-gray-300 p-2 text-right">ND 33.90.39 (Serviço)</th>
              <th className="border border-gray-300 p-2 text-right">Total ND (30+39)</th>
              <th className="border border-gray-300 p-2 text-right">Combustível (ND 30)</th>
              <th className="border border-gray-300 p-2 text-right">TOTAL GERAL (GND 3)</th>
            </tr>
          </thead>
          <tbody>
            {omsOrdenadas.map((omName) => {
              const grupo = gruposPorOM[omName];
              if (!grupo) return null;

              const totais = calcularTotaisPorOM(grupo, omName);
              const ug = grupo.linhasQS[0]?.registro.ug_qs || grupo.linhasQR[0]?.registro.ug || grupo.linhasClasseII[0]?.registro.ug || grupo.linhasLubrificante[0]?.registro.ug || '';

              return (
                <tr key={omName} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 font-medium">{omName} ({ug})</td>
                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(totais.total_33_90_30)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(totais.total_33_90_39)}</td>
                  <td className="border border-gray-300 p-2 text-right font-bold">{formatCurrency(totais.total_parte_azul)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(totais.total_combustivel)}</td>
                  <td className="border border-gray-300 p-2 text-right font-extrabold text-primary">{formatCurrency(totais.total_gnd3)}</td>
                </tr>
              );
            })}
            <tr className="bg-gray-200 font-bold">
              <td className="border border-gray-300 p-2 text-right">TOTAL GERAL SOLICITADO:</td>
              <td className="border border-gray-300 p-2 text-right">{formatCurrency(totalGeral_33_90_30)}</td>
              <td className="border border-gray-300 p-2 text-right">{formatCurrency(totalGeral_33_90_39)}</td>
              <td className="border border-gray-300 p-2 text-right">{formatCurrency(totalGeral_GND3_ND)}</td>
              <td className="border border-gray-300 p-2 text-right">{formatCurrency(totalValorCombustivel)}</td>
              <td className="border border-gray-300 p-2 text-right text-primary">{formatCurrency(valorTotalSolicitado)}</td>
            </tr>
          </tbody>
        </table>

        {/* Detalhamento de Combustível (Classe III) */}
        <h2 className="text-base font-bold mb-3 mt-8">2. Detalhamento de Combustível (Classe III)</h2>
        <table className="w-full border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">Tipo Equipamento</th>
              <th className="border border-gray-300 p-2 text-left">OM</th>
              <th className="border border-gray-300 p-2 text-left">UG</th>
              <th className="border border-gray-300 p-2 text-center">Qtd</th>
              <th className="border border-gray-300 p-2 text-right">Consumo</th>
              <th className="border border-gray-300 p-2 text-center">Unidade</th>
              <th className="border border-gray-300 p-2 text-center">Dias Op</th>
              <th className="border border-gray-300 p-2 text-right">Total Litros</th>
              <th className="border border-gray-300 p-2 text-right">Preço Litro</th>
              <th className="border border-gray-300 p-2 text-right">Valor Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            {registrosClasseIII.filter(isCombustivel).map((reg, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2">{reg.tipo_equipamento_detalhe || reg.tipo_equipamento}</td>
                <td className="border border-gray-300 p-2">{reg.organizacao}</td>
                <td className="border border-gray-300 p-2">{reg.ug}</td>
                <td className="border border-gray-300 p-2 text-center">{formatNumber(reg.quantidade)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatNumber(reg.consumo_hora || reg.consumo_km_litro || 0, 2)}</td>
                <td className="border border-gray-300 p-2 text-center">{reg.consumo_hora ? 'L/h' : 'km/L'}</td>
                <td className="border border-gray-300 p-2 text-center">{formatNumber(reg.dias_operacao)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatNumber(reg.total_litros, 2)}</td>
                <td className="border border-gray-300 p-2 text-right">{formatCurrency(reg.preco_litro)}</td>
                <td className="border border-gray-300 p-2 text-right font-bold">{formatCurrency(reg.valor_total)}</td>
              </tr>
            ))}
            <tr className="bg-gray-200 font-bold">
              <td className="border border-gray-300 p-2 text-right" colSpan={9}>TOTAL CLASSE III (COMBUSTÍVEL):</td>
              <td className="border border-gray-300 p-2 text-right text-primary">{formatCurrency(totalValorCombustivel)}</td>
            </tr>
          </tbody>
        </table>

        {/* Memórias de Cálculo */}
        <h2 className="text-base font-bold mb-3 mt-8">3. Memórias de Cálculo</h2>
        <div className="space-y-6">
          {omsOrdenadas.map((omName) => {
            const grupo = gruposPorOM[omName];
            if (!grupo) return null;

            const allClasseIIRegistros = [
                ...grupo.linhasClasseII, 
                ...grupo.linhasClasseV, 
                ...grupo.linhasClasseVI, 
                ...grupo.linhasClasseVII, 
                ...grupo.linhasClasseVIII,
                ...grupo.linhasClasseIX,
            ];

            if (grupo.linhasQS.length === 0 && allClasseIIRegistros.length === 0) return null;

            return (
              <div key={omName} className="border border-gray-300 p-4 bg-gray-50">
                <h3 className="text-sm font-semibold mb-3">OM: {omName}</h3>

                {/* Memórias de Classe I (QS/QR) */}
                {grupo.linhasQS.map((linha, index) => {
                  const { qs, qr } = generateClasseIMemoriaCalculo(linha.registro);
                  const hasCustomQS = !!linha.registro.memoria_calculo_qs_customizada;
                  const hasCustomQR = !!linha.registro.memoria_calculo_qr_customizada;

                  return (
                    <div key={`classe-i-${index}`} className="space-y-3 mb-4">
                      <h4 className="text-xs font-bold text-blue-600">CLASSE I - RAÇÃO QUENTE (QS/QR)</h4>
                      
                      {/* QS */}
                      <div className="border border-gray-200 p-3 bg-white">
                        <p className="text-[10px] font-semibold mb-1">QS - Quantitativo de Subsistência {hasCustomQS && "(Customizada)"}</p>
                        <pre className="text-[10px] whitespace-pre-wrap font-mono">
                          {hasCustomQS ? linha.registro.memoria_calculo_qs_customizada : qs}
                        </pre>
                      </div>
                      
                      {/* QR */}
                      <div className="border border-gray-200 p-3 bg-white">
                        <p className="text-[10px] font-semibold mb-1">QR - Quantitativo de Reforço {hasCustomQR && "(Customizada)"}</p>
                        <pre className="text-[10px] whitespace-pre-wrap font-mono">
                          {hasCustomQR ? linha.registro.memoria_calculo_qr_customizada : qr}
                        </pre>
                      </div>
                    </div>
                  );
                })}

                {/* Memórias de Classes II, V, VI, VII, VIII, IX */}
                {allClasseIIRegistros.map((linha, index) => {
                  const memoria = generateClasseIIMemoriaCalculo(linha.registro);
                  const classeLabel = getClasseIILabel(linha.registro.categoria);
                  const hasCustomMemoria = !!linha.registro.detalhamento_customizado;

                  return (
                    <div key={`classe-ii-${index}`} className="space-y-3 mb-4">
                      <h4 className="text-xs font-bold text-green-600">{classeLabel} - {linha.registro.categoria}</h4>
                      <div className="border border-gray-200 p-3 bg-white">
                        <p className="text-[10px] font-semibold mb-1">Memória de Cálculo {hasCustomMemoria && "(Customizada)"}</p>
                        <pre className="text-[10px] whitespace-pre-wrap font-mono">
                          {memoria}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Assinatura (Placeholder) */}
        <div className="mt-16 text-center text-xs">
          <p>___________________________________________________</p>
          <p>{ptrabData.nome_cmt_om || 'Nome do Comandante da OM'}</p>
          <p>Comandante da {ptrabData.nome_om}</p>
        </div>
      </div>
      
      {/* Diálogo de Confirmação de Status (Mantido aqui) */}
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