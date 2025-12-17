import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatNumber, formatDateDDMMMAA } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PTrabData,
  ClasseIRegistro,
  calculateDays,
  formatDate,
  formatFasesParaTexto,
} from "@/pages/PTrabReportManager"; // Importar tipos e funções auxiliares do Manager

interface PTrabRacaoOperacionalReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  onExportSuccess: () => void;
}

// Interface para a linha consolidada de Ração Operacional
interface RacaoOpLinha {
    om: string;
    ug: string;
    r2_quantidade: number;
    r3_quantidade: number;
    total_unidades: number;
    fase_atividade: string;
    efetivo: number;
    dias_operacao: number;
}

// Função para gerar a memória de cálculo detalhada para Ração Operacional
const generateRacaoOpMemoriaCalculo = (linha: RacaoOpLinha): string => {
    const { om, ug, r2_quantidade, r3_quantidade, efetivo, dias_operacao, fase_atividade } = linha;
    const totalRacoes = r2_quantidade + r3_quantidade;
    const faseFormatada = formatFasesParaTexto(fase_atividade);

    // O detalhamento deve ser genérico, pois o usuário não insere a memória customizada aqui.
    // Usamos o formato do exemplo: 33.90.30 – ração operacional para atender [efetivo] militares, por até [dias] dias...
    
    // Nota: O modelo fornecido usa 12 dias como exemplo, mas o cálculo real deve usar os dias de operação do registro.
    // Para manter a fidelidade ao formato, vamos usar os dados do registro.
    
    return `33.90.30 – ração operacional para atender ${efetivo} militares, por até ${dias_operacao} dias, para ser utilizada na Operação de ${faseFormatada}, em caso de comprometimento do fluxo Cl I (QR/QS) ou de tarefas, descentralizadas, afastadas da(s) base(s) de apoio logístico.
OM de Destino: ${om} (UG: ${ug})

Quantitativo R2 (24h): ${formatNumber(r2_quantidade)} un.
Quantitativo R3 (12h): ${formatNumber(r3_quantidade)} un.

Total de Rções Operacionais: ${formatNumber(totalRacoes)} unidades.`;
};


const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({
  ptrabData,
  registrosClasseI,
  onExportSuccess,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const racaoOperacionalConsolidada = useMemo(() => {
    const registros = registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL' && ((r.quantidade_r2 || 0) > 0 || (r.quantidade_r3 || 0) > 0));
    
    // Agrupar por OM de destino (organizacao/ug)
    const grupos: Record<string, RacaoOpLinha> = {};
    
    registros.forEach(r => {
        const key = `${r.organizacao}-${r.ug}`;
        
        if (!grupos[key]) {
            grupos[key] = {
                om: r.organizacao,
                ug: r.ug,
                r2_quantidade: 0,
                r3_quantidade: 0,
                total_unidades: 0,
                fase_atividade: r.fase_atividade || 'operação',
                efetivo: r.efetivo || 0,
                dias_operacao: r.dias_operacao,
            };
        }
        
        // Consolida as quantidades (embora o formulário atual só permita um registro por OM/Categoria,
        // esta lógica garante que se houver mais de um, eles sejam somados)
        grupos[key].r2_quantidade += (r.quantidade_r2 || 0);
        grupos[key].r3_quantidade += (r.quantidade_r3 || 0);
        grupos[key].total_unidades += (r.quantidade_r2 || 0) + (r.quantidade_r3 || 0);
        
        // Nota: Mantemos os dados de efetivo/dias/fase do último registro, assumindo que são consistentes por OM.
    });
    
    return Object.values(grupos).sort((a, b) => a.om.localeCompare(b.om));
  }, [registrosClasseI]);
  
  const totalRacoesGeral = racaoOperacionalConsolidada.reduce((sum, r) => sum + r.total_unidades, 0);
  
  // NOVO: Função para gerar o nome do arquivo
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
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

    // Força a renderização de todos os elementos antes de capturar
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
        description: "O relatório de Ração Operacional foi salvo com sucesso.",
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
  }, [ptrabData, racaoOperacionalConsolidada, onExportSuccess, toast]);

  const exportExcel = useCallback(async () => {
    if (racaoOperacionalConsolidada.length === 0) {
        toast({ title: "Aviso", description: "Não há dados de Ração Operacional para exportar.", variant: "default" });
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ração Operacional');

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

    // Cabeçalho do P Trab
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `PLANO DE TRABALHO LOGÍSTICO - CLASSE I (RAÇÃO OPERACIONAL)`;
    worksheet.getCell('A1').style = { ...headerStyle, alignment: { vertical: 'middle', horizontal: 'center' as const } };
    
    worksheet.addRow(['P Trab:', ptrabData.numero_ptrab, 'Operação:', ptrabData.nome_operacao, 'Período:', `${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} (${diasOperacao} dias)`]);
    worksheet.addRow(['OM:', ptrabData.nome_om, 'CMA:', ptrabData.comando_militar_area, 'Efetivo:', ptrabData.efetivo_empregado]);
    worksheet.addRow([]); // Linha em branco
    
    // Cabeçalho da Tabela
    const tableHeaders = [
        { header: 'OM de Destino', key: 'om', width: 30 },
        { header: 'UG', key: 'ug', width: 15 },
        { header: 'Efetivo', key: 'efetivo', width: 15 },
        { header: 'Dias Op', key: 'dias_operacao', width: 15 },
        { header: 'Ração R2 (24h)', key: 'r2_quantidade', width: 20 },
        { header: 'Ração R3 (12h)', key: 'r3_quantidade', width: 20 },
        { header: 'Total Unidades', key: 'total_unidades', width: 20 },
        { header: 'Fase da Atividade', key: 'fase_atividade', width: 30 },
    ];
    
    worksheet.columns = tableHeaders;
    
    const headerRow = worksheet.addRow(tableHeaders.map(h => h.header));
    headerRow.eachCell(cell => {
        cell.style = headerStyle;
    });

    // Dados da Tabela
    racaoOperacionalConsolidada.forEach(linha => {
        const row = worksheet.addRow([
            linha.om,
            linha.ug,
            linha.efetivo,
            linha.dias_operacao,
            linha.r2_quantidade,
            linha.r3_quantidade,
            linha.total_unidades,
            formatFasesParaTexto(linha.fase_atividade),
        ]);
        row.eachCell(cell => {
            cell.style = dataStyle;
        });
    });
    
    // Linha de Totais
    const totalRow = worksheet.addRow(['TOTAL GERAL', '', '', '', '', '', totalRacoesGeral, '']);
    totalRow.eachCell(cell => {
        cell.style = { ...headerStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } } };
    });
    worksheet.mergeCells(totalRow.number, 1, totalRow.number, 6);
    worksheet.getCell(`A${totalRow.number}`).value = 'TOTAL GERAL';
    
    // Adicionar Memórias de Cálculo
    worksheet.addRow([]);
    worksheet.addRow(['MEMÓRIAS DE CÁLCULO (RAÇÃO OPERACIONAL)']);
    worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
    
    racaoOperacionalConsolidada.forEach(linha => {
        worksheet.addRow([]);
        worksheet.addRow([`OM: ${linha.om} (UG: ${linha.ug})`]);
        worksheet.getCell(`A${worksheet.rowCount}`).style = { font: { bold: true } };
        
        const memoria = generateRacaoOpMemoriaCalculo(linha);
        memoria.split('\n').forEach(line => {
            worksheet.addRow([line]);
            worksheet.getCell(`A${worksheet.rowCount}`).style = { alignment: { wrapText: true } };
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
      description: "O relatório de Ração Operacional foi salvo com sucesso.",
      duration: 3000,
    });
  }, [racaoOperacionalConsolidada, ptrabData, diasOperacao, onExportSuccess, toast]);


  if (racaoOperacionalConsolidada.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            <Utensils className="h-5 w-5" />
            Ração Operacional (R2/R3)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum registro de Ração Operacional encontrado para este P Trab.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-3 print:hidden">
        <Button onClick={exportExcel} variant="secondary" className="gap-2">
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
          <h1 className="text-xl font-bold">PLANO DE TRABALHO LOGÍSTICO - CLASSE I (RAÇÃO OPERACIONAL)</h1>
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

        {/* Tabela de Consolidação */}
        <h2 className="text-base font-bold mb-3">1. Consolidação por Organização Militar</h2>
        <table className="w-full border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">OM de Destino (UG)</th>
              <th className="border border-gray-300 p-2 text-center">Efetivo</th>
              <th className="border border-gray-300 p-2 text-center">Dias Op</th>
              <th className="border border-gray-300 p-2 text-center">Ração R2 (24h)</th>
              <th className="border border-gray-300 p-2 text-center">Ração R3 (12h)</th>
              <th className="border border-gray-300 p-2 text-center">Total Unidades</th>
              <th className="border border-gray-300 p-2 text-left">Fase da Atividade</th>
            </tr>
          </thead>
          <tbody>
            {racaoOperacionalConsolidada.map((linha, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2 font-medium">{linha.om} ({linha.ug})</td>
                <td className="border border-gray-300 p-2 text-center">{formatNumber(linha.efetivo)}</td>
                <td className="border border-gray-300 p-2 text-center">{formatNumber(linha.dias_operacao)}</td>
                <td className="border border-gray-300 p-2 text-center">{formatNumber(linha.r2_quantidade)}</td>
                <td className="border border-gray-300 p-2 text-center">{formatNumber(linha.r3_quantidade)}</td>
                <td className="border border-gray-300 p-2 text-center font-bold">{formatNumber(linha.total_unidades)}</td>
                <td className="border border-gray-300 p-2">{formatFasesParaTexto(linha.fase_atividade)}</td>
              </tr>
            ))}
            <tr className="bg-gray-200 font-bold">
              <td className="border border-gray-300 p-2 text-right" colSpan={5}>TOTAL GERAL DE RAÇÕES OPERACIONAIS:</td>
              <td className="border border-gray-300 p-2 text-center">{formatNumber(totalRacoesGeral)}</td>
              <td className="border border-gray-300 p-2"></td>
            </tr>
          </tbody>
        </table>

        {/* Memórias de Cálculo */}
        <h2 className="text-base font-bold mb-3 mt-8">2. Memórias de Cálculo (Ração Operacional)</h2>
        <div className="space-y-4">
          {racaoOperacionalConsolidada.map((linha, index) => (
            <div key={index} className="border border-gray-300 p-3 bg-gray-50">
              <h3 className="text-sm font-semibold mb-2">OM: {linha.om} (UG: {linha.ug})</h3>
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {generateRacaoOpMemoriaCalculo(linha)}
              </pre>
            </div>
          ))}
        </div>
        
        {/* Assinatura (Placeholder) */}
        <div className="mt-16 text-center text-xs">
          <p>___________________________________________________</p>
          <p>{ptrabData.nome_cmt_om || 'Nome do Comandante da OM'}</p>
          <p>Comandante da {ptrabData.nome_om}</p>
        </div>
      </div>
    </div>
  );
};

export default PTrabRacaoOperacionalReport;