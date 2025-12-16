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
    // Use a nova função de formatação
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const nomeBase = `P Trab Nr ${ptrabData.numero_ptrab} (Racao Op) - ${ptrabData.nome_operacao} - ${ptrabData.nome_om} - Atz ${dataAtz}`;
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

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
        orientation: 'landscape', // Usar landscape para acomodar a tabela
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

      const fileName = generateFileName('PDF');
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
  }, [ptrabData, onExportSuccess, toast]);

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // --- Definição de Estilos e Alinhamentos ---
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    
    // Cores ARGB corrigidas
    const corTotalCinza = 'FFE8E8E8'; // Cinza claro (E8E8E8)
    const corTotalAzul = 'FFB4C7E7'; // Azul claro (B4C7E7)
    // -------------------------------------------

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ração Operacional');
      
      worksheet.columns = [
        { width: 35 }, // A - DESPESAS CLASSE I
        { width: 20 }, // B - OM (UGE) CODUG
        { width: 15 }, // C - QUANTIDADE
        { width: 70 }, // D - DETALHAMENTO
      ];
      
      let currentRow = 1;
      
      // Função auxiliar corrigida para aceitar apenas 3 argumentos (texto, mergeCols, font)
      const addHeaderRow = (text: string, mergeCols: string = 'A:D', font = titleFontStyle) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = font;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(mergeCols);
        currentRow++;
      };
      
      addHeaderRow('MINISTÉRIO DA DEFESA');
      addHeaderRow('EXÉRCITO BRASILEIRO');
      addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
      addHeaderRow((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase());
      
      const fullTitleRow = worksheet.getRow(currentRow);
      fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
      fullTitleRow.getCell(1).font = titleFontStyle;
      fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      currentRow++;

      addHeaderRow('PLANO DE TRABALHO LOGÍSTICO - Ração Operacional', 'A:D', { ...titleFontStyle, underline: true });
      
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
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        currentRow++;
      };
      
      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares`);
      addInfoRow('4. AÇÕES REALIZADAS OU A REALIZAR:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell('A').value = '5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:';
      despesasRow.getCell('A').font = titleFontStyle;
      currentRow++;
      
      const headerRow = worksheet.getRow(currentRow);
      headerRow.getCell('A').value = 'DESPESAS CLASSE I (SUBSISTÊNCIA)';
      headerRow.getCell('B').value = 'OM (UGE)\nCODUG';
      headerRow.getCell('C').value = 'QUANTIDADE';
      headerRow.getCell('D').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
      
      headerRow.getCell('A').style = { font: headerFontStyle, alignment: centerMiddleAlignment, border: cellBorder };
      headerRow.getCell('B').style = { font: headerFontStyle, alignment: centerMiddleAlignment, border: cellBorder };
      headerRow.getCell('C').style = { font: headerFontStyle, alignment: centerMiddleAlignment, border: cellBorder };
      headerRow.getCell('D').style = { font: headerFontStyle, alignment: centerMiddleAlignment, border: cellBorder };
      
      currentRow++;
      
      // --- Linhas de Dados ---
      racaoOperacionalConsolidada.forEach((linha) => {
        const row = worksheet.getRow(currentRow);
        
        // A - DESPESAS CLASSE I
        row.getCell('A').value = `Ração Operacional de Combate (R2/R3)`;
        row.getCell('A').alignment = leftTopAlignment;
        
        // B - OM (UGE) CODUG
        row.getCell('B').value = `${linha.om}\n(${linha.ug})`;
        row.getCell('B').alignment = centerTopAlignment;
        
        // C - QUANTIDADE
        row.getCell('C').value = linha.total_unidades;
        row.getCell('C').numFmt = '#,##0';
        row.getCell('C').alignment = centerTopAlignment;
        
        // D - DETALHAMENTO
        row.getCell('D').value = generateRacaoOpMemoriaCalculo(linha);
        row.getCell('D').font = { name: 'Arial', size: 6.5 };
        row.getCell('D').alignment = leftTopAlignment;
        
        ['A', 'B', 'C', 'D'].forEach(col => {
          row.getCell(col).border = cellBorder;
          row.getCell(col).font = baseFontStyle;
        });
        
        currentRow++;
      });
      
      // --- Linha Total ---
      const totalRow = worksheet.getRow(currentRow);
      
      // Mescla A e B
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      
      // Célula A (Mesclada A:B) - TOTAL - Cinza
      totalRow.getCell('A').value = 'TOTAL';
      totalRow.getCell('A').alignment = centerMiddleAlignment;
      totalRow.getCell('A').font = { name: 'Arial', size: 9, bold: true };
      totalRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalCinza } };
      totalRow.getCell('A').border = cellBorder;
      
      // Célula B (Mesclada A:B) - Precisa de borda, mas é coberta pela mesclagem.
      // Garantimos que a célula B tenha borda para o caso de desmesclagem, mas a mesclagem já define a borda externa.
      
      // Célula C (QUANTIDADE) - Azul
      totalRow.getCell('C').value = totalRacoesGeral;
      totalRow.getCell('C').numFmt = '#,##0';
      totalRow.getCell('C').font = { name: 'Arial', size: 9, bold: true };
      totalRow.getCell('C').alignment = centerMiddleAlignment;
      totalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalAzul } };
      totalRow.getCell('C').border = cellBorder;
      
      // Célula D (DETALHAMENTO) - Branco (padrão)
      totalRow.getCell('D').value = '-';
      totalRow.getCell('D').alignment = centerMiddleAlignment;
      totalRow.getCell('D').font = { name: 'Arial', size: 9, bold: true };
      totalRow.getCell('D').border = cellBorder;
      
      currentRow++;
      currentRow++;
      
      // --- Rodapé ---
      const localRow = worksheet.getRow(currentRow);
      localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      localRow.getCell('A').font = { name: 'Arial', size: 10 };
      localRow.getCell('A').alignment = centerMiddleAlignment; // Centraliza
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const cmtRow = worksheet.getRow(currentRow);
      cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
      cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
      cmtRow.getCell('A').alignment = centerMiddleAlignment; // Centraliza
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      currentRow++;
      
      const cargoRow = worksheet.getRow(currentRow);
      cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
      cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
      cargoRow.getCell('A').alignment = centerMiddleAlignment; // Centraliza
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      
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
        description: `Arquivo exportado com quantitativos de Ração Operacional.`,
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
  }, [ptrabData, racaoOperacionalConsolidada, totalRacoesGeral, onExportSuccess, toast]);


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
            PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">PLANO DE TRABALHO LOGÍSTICO - Ração Operacional</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        {racaoOperacionalConsolidada.length > 0 ? (
            <div className="ptrab-table-wrapper">
              <table className="ptrab-table">
                <thead>
                  <tr>
                    <th className="col-despesas-op">DESPESAS CLASSE I (SUBSISTÊNCIA)</th>
                    <th className="col-om-op">OM (UGE)<br/>CODUG</th>
                    <th className="col-quantidade-op">QUANTIDADE</th>
                    <th className="col-detalhamento-op">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                  </tr>
                </thead>
                <tbody>
                  {racaoOperacionalConsolidada.map((linha, index) => (
                    <tr key={index}>
                      <td className="col-despesas-op">
                        Ração Operacional de Combate (R2/R3)
                      </td>
                      <td className="col-om-op">
                        <div>{linha.om}</div>
                        <div>({linha.ug})</div>
                      </td>
                      <td className="col-quantidade-op">
                        {formatNumber(linha.total_unidades)}
                      </td>
                      <td className="col-detalhamento-op" style={{ fontSize: '6.5pt' }}>
                        <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {generateRacaoOpMemoriaCalculo(linha)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  
                  <tr className="total-row-op">
                    <td colSpan={2} className="text-right font-bold total-cell-cinza">TOTAL</td>
                    <td className="text-center font-bold total-cell-azul">{formatNumber(totalRacoesGeral)}</td>
                    <td className="total-cell-branco"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum registro de Ração Operacional cadastrado.</p>
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
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-print-container { padding: 0 !important; margin: 0 !important; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table thead tr { page-break-inside: avoid; page-break-after: auto; }
          .ptrab-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
          .ptrab-table tr { page-break-inside: avoid; break-inside: avoid; }
          
          /* FORÇA BORDAS FINAS NA IMPRESSÃO */
          .ptrab-table { border: 0.25pt solid #000 !important; }
          .ptrab-table th, .ptrab-table td { border: 0.25pt solid #000 !important; }
          
          /* NOVO: Evita quebra de página antes do rodapé */
          .print-avoid-break {
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        .ptrab-print-container { max-width: 100%; margin: 0 auto; padding: 2rem 1rem; font-family: Arial, sans-serif; }
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; } /* ALTERADO: Borda externa para 1px */
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; }
        .ptrab-table thead th { background-color: #E8E8E8; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* Estilos específicos para Ração Operacional */
        .col-despesas-op { width: 20%; text-align: left; }
        .col-om-op { width: 15%; text-align: center; }
        .col-quantidade-op { width: 10%; text-align: center; }
        .col-detalhamento-op { width: 55%; text-align: left; }
        
        /* Estilos da linha de total */
        .total-row-op td {
            font-weight: bold; 
            border-top: 1px solid #000; /* ALTERADO: Borda fina */
            color: #000000;
        }
        
        .total-cell-cinza { 
            background-color: #E8E8E8 !important; /* Cinza claro */
        }
        
        .total-cell-azul { 
            background-color: #B4C7E7 !important; /* Azul claro */
        }
        
        .total-cell-branco {
            background-color: white !important; /* Branco */
        }
        
        /* Reset de estilos da tabela principal para evitar conflitos */
        .ptrab-table th { background-color: #E8E8E8; }
        .ptrab-table td { background-color: white; }
        
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
      `}</style>
    </div>
  );
};

export default PTrabRacaoOperacionalReport;