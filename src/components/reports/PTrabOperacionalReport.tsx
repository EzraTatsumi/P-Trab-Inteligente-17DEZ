import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Download, Utensils, Briefcase, HardHat, Plane, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
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
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro, generateDiariaMemoriaCalculoUnificada, generateVerbaOperacionalMemoriaCalculada, generateSuprimentoFundosMemoriaCalculada, generatePassagemMemoriaCalculada, generateConcessionariaMemoriaCalculada } from "@/pages/PTrabReportManager";
import { Tables } from "@/integrations/supabase/types";
import { ConsolidatedPassagemReport, generateConsolidatedPassagemMemoriaCalculo } from "@/lib/passagemUtils";
import { ConsolidatedConcessionariaReport, generateConsolidatedConcessionariaMemoriaCalculo, ConcessionariaRegistroComDiretriz } from "@/lib/concessionariaUtils";
import { fetchDiretrizesConcessionaria } from "@/lib/diretrizesUtils";

// =================================================================
// TIPOS AUXILIARES
// =================================================================

interface PTrabOperacionalReportProps {
  ptrabData: PTrabData;
  registrosDiaria: DiariaRegistro[];
  registrosVerbaOperacional: VerbaOperacionalRegistro[];
  registrosSuprimentoFundos: VerbaOperacionalRegistro[];
  registrosPassagem: PassagemRegistro[];
  registrosConcessionaria: ConcessionariaRegistro[];
  diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
  fileSuffix: string;
  generateDiariaMemoriaCalculo: typeof generateDiariaMemoriaCalculoUnificada;
  generateVerbaOperacionalMemoriaCalculo: typeof generateVerbaOperacionalMemoriaCalculada;
  generateSuprimentoFundosMemoriaCalculo: typeof generateSuprimentoFundosMemoriaCalculada;
  generatePassagemMemoriaCalculo: typeof generatePassagemMemoriaCalculada;
  generateConcessionariaMemoriaCalculo: typeof generateConcessionariaMemoriaCalculada;
}

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
  ptrabData,
  registrosDiaria,
  registrosVerbaOperacional,
  registrosSuprimentoFundos,
  registrosPassagem,
  registrosConcessionaria: registrosConcessionariaRaw,
  diretrizesOperacionais,
  fileSuffix,
  generateDiariaMemoriaCalculo,
  generateVerbaOperacionalMemoriaCalculo,
  generateSuprimentoFundosMemoriaCalculo,
  generatePassagemMemoriaCalculo,
  generateConcessionariaMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const reportRef = useState<HTMLDivElement | null>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel'>('pdf');
  const [diretrizesConcessionariaMap, setDiretrizesConcessionariaMap] = useState<Record<string, Tables<'diretrizes_concessionaria'>>>({});
  
  // 1. Pré-processamento de Concessionária (para incluir dados da diretriz)
  const registrosConcessionaria = useMemo(() => {
    return registrosConcessionariaRaw.map(r => {
        const diretriz = diretrizesConcessionariaMap[r.diretriz_id];
        return {
            ...r,
            nome_concessionaria: diretriz?.nome_concessionaria || 'Diretriz Não Encontrada',
            unidade_custo: diretriz?.unidade_custo || 'unidade',
            fonte_consumo: diretriz?.fonte_consumo || null,
            fonte_custo: diretriz?.fonte_custo || null,
        } as ConcessionariaRegistroComDiretriz;
    });
  }, [registrosConcessionariaRaw, diretrizesConcessionariaMap]);

  // 2. Fetch das Diretrizes de Concessionária
  const fetchConcessionariaDiretrizes = useCallback(async () => {
    if (registrosConcessionariaRaw.length === 0) return;
    
    const diretrizIds = Array.from(new Set(registrosConcessionariaRaw.map(r => r.diretriz_id)));
    
    try {
        const diretrizes = await fetchDiretrizesConcessionaria(diretrizIds);
        const map = diretrizes.reduce((acc, d) => {
            acc[d.id] = d;
            return acc;
        }, {} as Record<string, Tables<'diretrizes_concessionaria'>>);
        setDiretrizesConcessionariaMap(map);
    } catch (error) {
        console.error("Erro ao buscar diretrizes de concessionária:", error);
        toast({ title: "Aviso", description: "Não foi possível carregar todas as diretrizes de concessionária.", variant: "warning" });
    }
  }, [registrosConcessionariaRaw, toast]);

  useState(() => {
    fetchConcessionariaDiretrizes();
  }, [fetchConcessionariaDiretrizes]);

  // 3. Agrupamento e Consolidação dos Registros
  const { sortedRegistrosAgrupadosPorOM, consolidatedPassagens, consolidatedConcessionarias } = useMemo(() => {
    const groups: Record<string, { diarias: DiariaRegistro[], verbas: VerbaOperacionalRegistro[], suprimentos: VerbaOperacionalRegistro[], passagens: PassagemRegistro[], concessionarias: ConcessionariaRegistroComDiretriz[] }> = {};
    const consolidatedPassagensMap: Record<string, ConsolidatedPassagemReport> = {};
    const consolidatedConcessionariasMap: Record<string, ConsolidatedConcessionariaReport> = {};

    const initializeGroup = (om: string, ug: string) => {
        const omKey = `${om} (${ug})`;
        if (!groups[omKey]) {
            groups[omKey] = { diarias: [], verbas: [], suprimentos: [], passagens: [], concessionarias: [] };
        }
        return groups[omKey];
    };

    // Agrupamento de Diárias, Verbas e Suprimentos (mantido)
    registrosDiaria.forEach(registro => {
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        const group = initializeGroup(omDetentora, ugDetentora);
        group.diarias.push(registro);
    });
    registrosVerbaOperacional.forEach(registro => {
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        const group = initializeGroup(omDetentora, ugDetentora);
        group.verbas.push(registro);
    });
    registrosSuprimentoFundos.forEach(registro => {
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        const group = initializeGroup(omDetentora, ugDetentora);
        group.suprimentos.push(registro);
    });
    
    // Agrupamento de Passagens (Consolidado por Lote de Solicitação)
    registrosPassagem.forEach(registro => {
        // Chave de consolidação: OM Favorecida, OM Detentora, Dias, Efetivo, Fase, Diretriz ID
        const consolidationKey = [
            registro.organizacao,
            registro.ug,
            registro.om_detentora,
            registro.ug_detentora,
            registro.dias_operacao,
            registro.efetivo,
            registro.fase_atividade,
            registro.diretriz_id, 
        ].join('|');
        
        // Chave de agrupamento no relatório (OM Detentora do Recurso)
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        const reportGroup = initializeGroup(omDetentora, ugDetentora);
        reportGroup.passagens.push(registro); 
        
        // Cria ou atualiza o registro consolidado
        if (!consolidatedPassagensMap[consolidationKey]) {
            consolidatedPassagensMap[consolidationKey] = {
                groupKey: consolidationKey,
                organizacao: registro.organizacao,
                ug: registro.ug,
                om_detentora: omDetentora,
                ug_detentora: ugDetentora,
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo || 0,
                fase_atividade: registro.fase_atividade || '',
                records: [],
                totalGeral: 0,
                totalND33: 0,
            } as ConsolidatedPassagemReport; 
        }
        
        const consolidated = consolidatedPassagensMap[consolidationKey];
        consolidated.records.push(registro);
        consolidated.totalGeral += Number(registro.valor_total || 0);
        consolidated.totalND33 += Number(registro.valor_nd_33 || 0);
    });
    
    // NOVO: Agrupamento de Concessionária (Consolidado por Lote de Solicitação)
    registrosConcessionaria.forEach(registro => {
        // Chave de consolidação: OM Favorecida, OM Detentora, Dias, Efetivo, Fase, Diretriz ID
        const consolidationKey = [
            registro.organizacao,
            registro.ug,
            registro.om_detentora,
            registro.ug_detentora,
            registro.dias_operacao,
            registro.efetivo,
            registro.fase_atividade,
            registro.diretriz_id, // Adicionar diretriz_id para garantir que lotes de contratos diferentes não se misturem
        ].join('|');
        
        // Chave de agrupamento no relatório (OM Detentora do Recurso)
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        
        const reportGroup = initializeGroup(omDetentora, ugDetentora);
        reportGroup.concessionarias.push(registro); // Adiciona ao grupo de relatório (apenas para cálculo de subtotal)
        
        // Cria ou atualiza o registro consolidado
        if (!consolidatedConcessionariasMap[consolidationKey]) {
            consolidatedConcessionariasMap[consolidationKey] = {
                groupKey: consolidationKey,
                organizacao: registro.organizacao,
                ug: registro.ug,
                om_detentora: omDetentora,
                ug_detentora: ugDetentora,
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo || 0,
                fase_atividade: registro.fase_atividade || '',
                records: [],
                totalGeral: 0,
                totalND39: 0,
            } as ConsolidatedConcessionariaReport; // Casting para garantir o tipo
        }
        
        const consolidated = consolidatedConcessionariasMap[consolidationKey];
        consolidated.records.push(registro);
        consolidated.totalGeral += Number(registro.valor_total || 0);
        consolidated.totalND39 += Number(registro.valor_nd_39 || 0);
    });
    
    // 6. Ordenar os grupos para exibição (garante que a OM apareça uma vez e em ordem)
    const sortedGroups = Object.entries(groups).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    // Ordenar os grupos consolidados para exibição
    const consolidatedPassagens = Object.values(consolidatedPassagensMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    const consolidatedConcessionarias = Object.values(consolidatedConcessionariasMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao));

    return { sortedRegistrosAgrupadosPorOM: sortedGroups, consolidatedPassagens, consolidatedConcessionarias };
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria]);

  // 4. Cálculo dos Totais Gerais
  const { totalGeral, totalND15, totalND30, totalND33, totalND39 } = useMemo(() => {
    const totalDiariaND15 = registrosDiaria.reduce((sum, r) => sum + r.valor_nd_15, 0);
    const totalDiariaND30 = registrosDiaria.reduce((sum, r) => sum + r.valor_nd_30, 0);
    
    const totalVerbaND30 = registrosVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_30, 0);
    const totalVerbaND39 = registrosVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    const totalSuprimentoND30 = registrosSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_30, 0);
    const totalSuprimentoND39 = registrosSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    const totalPassagemND33 = registrosPassagem.reduce((sum, r) => sum + r.valor_nd_33, 0);
    
    const totalConcessionariaND39 = registrosConcessionaria.reduce((sum, r) => sum + r.valor_nd_39, 0);

    const totalND15 = totalDiariaND15;
    const totalND30 = totalDiariaND30 + totalVerbaND30 + totalSuprimentoND30;
    const totalND33 = totalPassagemND33;
    const totalND39 = totalVerbaND39 + totalSuprimentoND39 + totalConcessionariaND39;
    
    const totalGeral = totalND15 + totalND30 + totalND33 + totalND39;

    return { totalGeral, totalND15, totalND30, totalND33, totalND39 };
  }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria]);

  // 5. Funções de Exportação
  const exportToPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setLoadingExport(true);

    try {
      const input = reportRef.current;
      
      // Aumentar a escala para melhor qualidade
      const canvas = await html2canvas(input, { scale: 2 });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Adicionar margem superior e inferior
      const margin = 10;
      let position = margin;
      
      // Se o conteúdo for maior que uma página, divida
      if (pdfHeight > pdf.internal.pageSize.getHeight() - 2 * margin) {
        let heightLeft = imgProps.height;
        let pageHeight = pdf.internal.pageSize.getHeight();
        let heightPerCanvas = (imgProps.height * pdfWidth) / imgProps.width;
        let currentY = 0;

        while (heightLeft > 0) {
          if (currentY > 0) {
            pdf.addPage();
          }
          
          // Calcula a altura do corte para a página atual
          let clipHeight = Math.min(heightLeft, imgProps.height * (pageHeight / heightPerCanvas));
          
          // Cria um canvas temporário para o corte
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgProps.width;
          tempCanvas.height = clipHeight * (imgProps.width / pdfWidth);
          
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            // Desenha a parte relevante da imagem original no canvas temporário
            tempCtx.drawImage(
              canvas, 
              0, 
              currentY * (imgProps.width / pdfWidth), // Posição Y no canvas original
              imgProps.width, 
              clipHeight * (imgProps.width / pdfWidth), // Altura do corte
              0, 
              0, 
              tempCanvas.width, 
              tempCanvas.height
            );
          }
          
          const tempImgData = tempCanvas.toDataURL('image/jpeg', 1.0);
          
          // Adiciona a imagem cortada ao PDF
          pdf.addImage(tempImgData, 'JPEG', margin, margin, pdfWidth - 2 * margin, (pdfWidth - 2 * margin) * (tempCanvas.height / tempCanvas.width));
          
          heightLeft -= clipHeight * (imgProps.width / pdfWidth);
          currentY += clipHeight * (imgProps.width / pdfWidth);
        }
        
      } else {
        // Conteúdo cabe em uma página
        pdf.addImage(imgData, 'JPEG', margin, position, pdfWidth - 2 * margin, pdfHeight - 2 * margin);
      }

      pdf.save(`PTrab_Operacional_${ptrabData.numero_ptrab}_${fileSuffix}.pdf`);
      toast({ title: "Sucesso", description: "Relatório exportado para PDF." });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({ title: "Erro", description: "Falha ao exportar relatório para PDF.", variant: "destructive" });
    } finally {
      setLoadingExport(false);
      setShowExportDialog(false);
    }
  }, [ptrabData, fileSuffix, toast]);

  const exportToExcel = useCallback(async () => {
    setLoadingExport(true);
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('P Trab Operacional');

        // Estilos
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } as ExcelJS.Color }, // Azul Escuro
            alignment: { vertical: 'middle', horizontal: 'center' as const },
            border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
        };
        const subHeaderStyle = {
            font: { bold: true, size: 11, color: { argb: 'FF000000' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } as ExcelJS.Color }, // Cinza Claro
            alignment: { vertical: 'middle', horizontal: 'left' as const },
            border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
        };
        const omHeaderStyle = {
            font: { bold: true, size: 11, color: { argb: 'FF000000' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBEE3F8' } as ExcelJS.Color }, // Azul Claro
            alignment: { vertical: 'middle', horizontal: 'left' as const },
            border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
        };
        const totalStyle = {
            font: { bold: true, size: 11, color: { argb: 'FF000000' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } as ExcelJS.Color }, // Amarelo
            alignment: { vertical: 'middle', horizontal: 'right' as const },
            border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
        };
        const dataStyle = {
            alignment: { vertical: 'top', horizontal: 'left' as const, wrapText: true },
            border: { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
        };
        const currencyStyle = {
            ...dataStyle,
            numFmt: 'R$ #,##0.00',
            alignment: { vertical: 'top', horizontal: 'right' as const, wrapText: true },
        };
        const numberStyle = {
            ...dataStyle,
            numFmt: '#,##0',
            alignment: { vertical: 'top', horizontal: 'right' as const, wrapText: true },
        };

        // 1. Cabeçalho do Relatório
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = `PLANO DE TRABALHO OPERACIONAL - ${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}`;
        Object.assign(worksheet.getCell('A1'), headerStyle);
        worksheet.getRow(1).height = 30;

        // 2. Tabela de Totais
        let currentRow = 3;
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = 'TOTAL GERAL (GND 3)';
        Object.assign(worksheet.getCell(`A${currentRow}`), subHeaderStyle);
        worksheet.getCell(`C${currentRow}`).value = totalGeral;
        Object.assign(worksheet.getCell(`C${currentRow}`), totalStyle, { numFmt: 'R$ #,##0.00' });
        worksheet.mergeCells(`D${currentRow}:G${currentRow}`);
        Object.assign(worksheet.getCell(`D${currentRow}`), subHeaderStyle);
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = 'ND 33.90.15 (Diárias)';
        Object.assign(worksheet.getCell(`A${currentRow}`), subHeaderStyle);
        worksheet.getCell(`C${currentRow}`).value = totalND15;
        Object.assign(worksheet.getCell(`C${currentRow}`), currencyStyle);
        worksheet.mergeCells(`D${currentRow}:G${currentRow}`);
        worksheet.getCell(`D${currentRow}`).value = 'ND 33.90.30 (Diárias, Verba Op, Suprimento)';
        Object.assign(worksheet.getCell(`D${currentRow}`), subHeaderStyle);
        worksheet.getCell(`G${currentRow}`).value = totalND30;
        Object.assign(worksheet.getCell(`G${currentRow}`), currencyStyle);
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = 'ND 33.90.33 (Passagens)';
        Object.assign(worksheet.getCell(`A${currentRow}`), subHeaderStyle);
        worksheet.getCell(`C${currentRow}`).value = totalND33;
        Object.assign(worksheet.getCell(`C${currentRow}`), currencyStyle);
        worksheet.mergeCells(`D${currentRow}:G${currentRow}`);
        worksheet.getCell(`D${currentRow}`).value = 'ND 33.90.39 (Verba Op, Suprimento, Concessionária)';
        Object.assign(worksheet.getCell(`D${currentRow}`), subHeaderStyle);
        worksheet.getCell(`G${currentRow}`).value = totalND39;
        Object.assign(worksheet.getCell(`G${currentRow}`), currencyStyle);
        currentRow++;
        currentRow++; // Espaço

        // 3. Tabela Detalhada por OM
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = 'DETALHAMENTO POR ORGANIZAÇÃO MILITAR (OM)';
        Object.assign(worksheet.getCell(`A${currentRow}`), headerStyle);
        currentRow++;

        // Colunas da Tabela Detalhada
        const detailHeaders = [
            'OM Detentora (UG)', 'Item', 'Detalhamento', 'Fase', 'Valor ND 33.90.15', 'Valor ND 33.90.30', 'Valor ND 33.90.39'
        ];
        worksheet.getRow(currentRow).values = detailHeaders;
        worksheet.getRow(currentRow).eachCell(cell => Object.assign(cell, subHeaderStyle, { alignment: { vertical: 'middle', horizontal: 'center' as const } }));
        currentRow++;

        // Dados da Tabela (Agrupados por OM)
        sortedRegistrosAgrupadosPorOM.forEach(([omKey, group]) => {
            const omName = omKey.split(' (')[0];
            
            // Cabeçalho da OM
            worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `OM: ${omName} - UG: ${omKey.split('(')[1].replace(')', '')}`;
            Object.assign(worksheet.getCell(`A${currentRow}`), omHeaderStyle);
            currentRow++;

            // Função auxiliar para adicionar linhas
            const addRow = (item: string, detalhamento: string, fase: string | null, nd15: number, nd30: number, nd39: number) => {
                const row = worksheet.getRow(currentRow);
                row.getCell(1).value = omKey;
                row.getCell(2).value = item;
                row.getCell(3).value = detalhamento;
                row.getCell(4).value = fase || '';
                row.getCell(5).value = nd15;
                row.getCell(6).value = nd30;
                row.getCell(7).value = nd39;

                row.eachCell(cell => Object.assign(cell, dataStyle));
                Object.assign(row.getCell(5), currencyStyle);
                Object.assign(row.getCell(6), currencyStyle);
                Object.assign(row.getCell(7), currencyStyle);
                currentRow++;
            };

            // 3.1. Diárias (ND 33.90.15 e 33.90.30)
            group.diarias.forEach(r => {
                const detalhamento = r.detalhamento_customizado || r.detalhamento || 'Diárias de Viagem';
                addRow('Diárias', detalhamento, r.fase_atividade, r.valor_nd_15, r.valor_nd_30, 0);
            });

            // 3.2. Verba Operacional (ND 33.90.30 e 33.90.39)
            group.verbas.forEach(r => {
                const detalhamento = r.detalhamento_customizado || r.detalhamento || 'Verba Operacional';
                addRow('Verba Operacional', detalhamento, r.fase_atividade, 0, r.valor_nd_30, r.valor_nd_39);
            });

            // 3.3. Suprimento de Fundos (ND 33.90.30 e 33.90.39)
            group.suprimentos.forEach(r => {
                const detalhamento = r.detalhamento_customizado || r.detalhamento || 'Suprimento de Fundos';
                addRow('Suprimento de Fundos', detalhamento, r.fase_atividade, 0, r.valor_nd_30, r.valor_nd_39);
            });
            
            // 3.4. Passagens (ND 33.90.33) - Consolidado
            // Nota: Passagens são consolidadas por lote, mas aqui listamos os registros individuais para detalhamento
            group.passagens.forEach(r => {
                const detalhamento = r.detalhamento_customizado || r.detalhamento || `${r.origem} > ${r.destino} (${r.tipo_transporte})`;
                addRow('Passagens', detalhamento, r.fase_atividade, 0, 0, 0); // ND 33.90.33 não é listado aqui, mas no total
            });
            
            // 3.5. Concessionária (ND 33.90.39)
            group.concessionarias.forEach(r => {
                const detalhamento = r.detalhamento_customizado || r.detalhamento || `${r.categoria} - ${r.nome_concessionaria}`;
                addRow('Concessionária', detalhamento, r.fase_atividade, 0, 0, r.valor_nd_39);
            });

            // Subtotal da OM
            const subtotalND15 = group.diarias.reduce((sum, r) => sum + r.valor_nd_15, 0);
            const subtotalND30 = group.diarias.reduce((sum, r) => sum + r.valor_nd_30, 0) + 
                                 group.verbas.reduce((sum, r) => sum + r.valor_nd_30, 0) + 
                                 group.suprimentos.reduce((sum, r) => sum + r.valor_nd_30, 0);
            const subtotalND33 = group.passagens.reduce((sum, r) => sum + r.valor_nd_33, 0);
            const subtotalND39 = group.verbas.reduce((sum, r) => sum + r.valor_nd_39, 0) + 
                                 group.suprimentos.reduce((sum, r) => sum + r.valor_nd_39, 0) +
                                 group.concessionarias.reduce((sum, r) => sum + r.valor_nd_39, 0);

            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `SUBTOTAL ${omName}`;
            Object.assign(worksheet.getCell(`A${currentRow}`), totalStyle, { alignment: { vertical: 'middle', horizontal: 'left' as const } });
            
            worksheet.getCell(`E${currentRow}`).value = subtotalND15;
            Object.assign(worksheet.getCell(`E${currentRow}`), totalStyle, { numFmt: 'R$ #,##0.00' });
            
            worksheet.getCell(`F${currentRow}`).value = subtotalND30;
            Object.assign(worksheet.getCell(`F${currentRow}`), totalStyle, { numFmt: 'R$ #,##0.00' });
            
            worksheet.getCell(`G${currentRow}`).value = subtotalND39;
            Object.assign(worksheet.getCell(`G${currentRow}`), totalStyle, { numFmt: 'R$ #,##0.00' });
            
            currentRow++;
            currentRow++; // Espaço entre OMs
        });

        // 4. Ajuste de Largura das Colunas
        worksheet.columns = [
            { width: 15 }, // OM Detentora
            { width: 20 }, // Item
            { width: 50 }, // Detalhamento
            { width: 15 }, // Fase
            { width: 18 }, // ND 15
            { width: 18 }, // ND 30
            { width: 18 }, // ND 39
        ];

        // 5. Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PTrab_Operacional_${ptrabData.numero_ptrab}_${fileSuffix}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        toast({ title: "Sucesso", description: "Relatório exportado para Excel." });
    } catch (error) {
        console.error("Erro ao exportar Excel:", error);
        toast({ title: "Erro", description: "Falha ao exportar relatório para Excel.", variant: "destructive" });
    } finally {
        setLoadingExport(false);
        setShowExportDialog(false);
    }
  }, [ptrabData, fileSuffix, totalGeral, totalND15, totalND30, totalND33, totalND39, sortedRegistrosAgrupadosPorOM, toast]); // CORRIGIDO: Usando sortedRegistrosAgrupadosPorOM

  const handleExport = () => {
    if (exportType === 'pdf') {
      exportToPDF();
    } else {
      exportToExcel();
    }
  };

  // 6. Renderização do Relatório (Visualização)
  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => setShowExportDialog(true)} disabled={loadingExport}>
          {loadingExport ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Exportar Relatório
            </>
          )}
        </Button>
      </div>

      <div ref={reportRef} className="bg-white p-6 shadow-lg print:shadow-none print:p-0">
        {/* Cabeçalho */}
        <div className="text-center mb-6 border-b pb-4">
          <h1 className="text-xl font-bold">PLANO DE TRABALHO OPERACIONAL</h1>
          <h2 className="text-lg font-semibold">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</h2>
          <p className="text-sm text-muted-foreground">Período: {ptrabData.periodo_inicio} a {ptrabData.periodo_fim}</p>
        </div>

        {/* Resumo de Totais */}
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm font-medium">
          <div className="p-3 bg-blue-50 border rounded-lg">
            <p className="text-muted-foreground">Total Geral (GND 3)</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalGeral)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-gray-50 border rounded-lg">
              <p className="text-muted-foreground text-xs">ND 33.90.15</p>
              <p className="font-semibold">{formatCurrency(totalND15)}</p>
            </div>
            <div className="p-2 bg-gray-50 border rounded-lg">
              <p className="text-muted-foreground text-xs">ND 33.90.30</p>
              <p className="font-semibold">{formatCurrency(totalND30)}</p>
            </div>
            <div className="p-2 bg-gray-50 border rounded-lg">
              <p className="text-muted-foreground text-xs">ND 33.90.33</p>
              <p className="font-semibold">{formatCurrency(totalND33)}</p>
            </div>
            <div className="p-2 bg-gray-50 border rounded-lg">
              <p className="text-muted-foreground text-xs">ND 33.90.39</p>
              <p className="font-semibold">{formatCurrency(totalND39)}</p>
            </div>
          </div>
        </div>

        {/* Tabela Detalhada por OM */}
        <h3 className="text-lg font-semibold mb-3 border-b pb-1">Detalhamento por Organização Militar (OM)</h3>
        
        <table className="w-full border-collapse text-sm">
            <thead>
                <tr className="bg-gray-100 border-b border-t">
                    <th className="p-2 text-left font-bold w-[15%]">OM Detentora (UG)</th>
                    <th className="p-2 text-left font-bold w-[15%]">Item</th>
                    <th className="p-2 text-left font-bold w-[35%]">Detalhamento</th>
                    <th className="p-2 text-center font-bold w-[10%]">Fase</th>
                    <th className="p-2 text-right font-bold w-[10%]">ND 33.90.15</th>
                    <th className="p-2 text-right font-bold w-[10%]">ND 33.90.30</th>
                    <th className="p-2 text-right font-bold w-[10%]">ND 33.90.39</th>
                </tr>
            </thead>
            <tbody>
              {sortedRegistrosAgrupadosPorOM.map(([omKey, group]) => {
                const omName = omKey.split(' (')[0];
                
                const subtotalND15 = group.diarias.reduce((sum, r) => sum + r.valor_nd_15, 0);
                const subtotalND30 = group.diarias.reduce((sum, r) => sum + r.valor_nd_30, 0) + 
                                     group.verbas.reduce((sum, r) => sum + r.valor_nd_30, 0) + 
                                     group.suprimentos.reduce((sum, r) => sum + r.valor_nd_30, 0);
                const subtotalND33 = group.passagens.reduce((sum, r) => sum + r.valor_nd_33, 0);
                const subtotalND39 = group.verbas.reduce((sum, r) => sum + r.valor_nd_39, 0) + 
                                     group.suprimentos.reduce((sum, r) => sum + r.valor_nd_39, 0) +
                                     group.concessionarias.reduce((sum, r) => sum + r.valor_nd_39, 0);

                const hasRecords = group.diarias.length > 0 || group.verbas.length > 0 || group.suprimentos.length > 0 || group.passagens.length > 0 || group.concessionarias.length > 0;

                if (!hasRecords) return null;

                return (
                  <>
                    <tr key={`header-${omKey}`} className="bg-blue-50 border-t border-b border-blue-200">
                      <td colSpan={7} className="p-2 font-semibold text-blue-800">
                        OM: {omName} - UG: {omKey.split('(')[1].replace(')', '')}
                      </td>
                    </tr>
                    
                    {/* Diárias */}
                    {group.diarias.map((r, index) => (
                      <tr key={`diaria-${r.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-left align-top">{omKey}</td>
                        <td className="p-2 text-left align-top">Diárias</td>
                        <td className="p-2 text-left align-top whitespace-pre-wrap">
                          {r.detalhamento_customizado || r.detalhamento || 'Diárias de Viagem'}
                        </td>
                        <td className="p-2 text-center align-top">{r.fase_atividade}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_15)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_30)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                      </tr>
                    ))}
                    
                    {/* Verba Operacional */}
                    {group.verbas.map((r, index) => (
                      <tr key={`verba-${r.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-left align-top">{omKey}</td>
                        <td className="p-2 text-left align-top">Verba Operacional</td>
                        <td className="p-2 text-left align-top whitespace-pre-wrap">
                          {r.detalhamento_customizado || r.detalhamento || 'Verba Operacional'}
                        </td>
                        <td className="p-2 text-center align-top">{r.fase_atividade}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_30)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_39)}</td>
                      </tr>
                    ))}
                    
                    {/* Suprimento de Fundos */}
                    {group.suprimentos.map((r, index) => (
                      <tr key={`suprimento-${r.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-left align-top">{omKey}</td>
                        <td className="p-2 text-left align-top">Suprimento de Fundos</td>
                        <td className="p-2 text-left align-top whitespace-pre-wrap">
                          {r.detalhamento_customizado || r.detalhamento || 'Suprimento de Fundos'}
                        </td>
                        <td className="p-2 text-center align-top">{r.fase_atividade}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_30)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_39)}</td>
                      </tr>
                    ))}
                    
                    {/* Passagens (ND 33.90.33) */}
                    {group.passagens.map((r, index) => (
                      <tr key={`passagem-${r.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-left align-top">{omKey}</td>
                        <td className="p-2 text-left align-top">Passagens</td>
                        <td className="p-2 text-left align-top whitespace-pre-wrap">
                          {r.detalhamento_customizado || r.detalhamento || `${r.origem} > ${r.destino} (${r.tipo_transporte})`}
                        </td>
                        <td className="p-2 text-center align-top">{r.fase_atividade}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                      </tr>
                    ))}
                    
                    {/* Concessionária (ND 33.90.39) */}
                    {group.concessionarias.map((r, index) => (
                      <tr key={`concessionaria-${r.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2 text-left align-top">{omKey}</td>
                        <td className="p-2 text-left align-top">Concessionária</td>
                        <td className="p-2 text-left align-top whitespace-pre-wrap">
                          {r.detalhamento_customizado || r.detalhamento || `${r.categoria} - ${r.nome_concessionaria}`}
                        </td>
                        <td className="p-2 text-center align-top">{r.fase_atividade}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(0)}</td>
                        <td className="p-2 text-right align-top">{formatCurrency(r.valor_nd_39)}</td>
                      </tr>
                    ))}

                    {/* Linha de Subtotal */}
                    <tr key={`subtotal-${omKey}`} className="bg-yellow-100 font-bold border-t-2 border-b-2 border-yellow-300">
                      <td colSpan={4} className="p-2 text-left">SUBTOTAL {omName}</td>
                      <td className="p-2 text-right">{formatCurrency(subtotalND15)}</td>
                      <td className="p-2 text-right">{formatCurrency(subtotalND30)}</td>
                      <td className="p-2 text-right">{formatCurrency(subtotalND39)}</td>
                    </tr>
                    
                    {/* Linha de Passagens (ND 33.90.33) - Adicionada separadamente para totalização */}
                    {subtotalND33 > 0 && (
                        <tr key={`subtotal-nd33-${omKey}`} className="bg-yellow-50 font-medium border-b border-yellow-200">
                            <td colSpan={4} className="p-2 text-left pl-4 text-sm">
                                <Plane className="h-3 w-3 inline mr-1 text-blue-600" />
                                Total ND 33.90.33 (Passagens)
                            </td>
                            <td className="p-2 text-right">{formatCurrency(0)}</td>
                            <td className="p-2 text-right">{formatCurrency(0)}</td>
                            <td className="p-2 text-right">{formatCurrency(subtotalND33)}</td>
                        </tr>
                    )}
                    
                    <tr key={`spacer-${omKey}`} className="h-4"><td colSpan={7}></td></tr>
                  </>
                );
              })}
            </tbody>
        </table>

        {/* Tabela de Memória de Cálculo (Consolidada) */}
        <h3 className="text-lg font-semibold mb-3 border-b pb-1 mt-8">Memória de Cálculo (Consolidada)</h3>
        
        <div className="space-y-6 text-sm">
            {/* Diárias */}
            {registrosDiaria.length > 0 && (
                <div>
                    <h4 className="font-bold text-base mb-2 flex items-center gap-2"><Utensils className="h-4 w-4 text-primary"/> Diárias (ND 33.90.15 e 33.90.30)</h4>
                    {registrosDiaria.map(r => (
                        <div key={r.id} className="mb-4 p-3 border rounded-md bg-gray-50 whitespace-pre-wrap">
                            <p className="font-semibold mb-1">{r.organizacao} ({r.ug}) - {r.destino}</p>
                            <p>{generateDiariaMemoriaCalculo(r, diretrizesOperacionais)}</p>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Verba Operacional */}
            {registrosVerbaOperacional.length > 0 && (
                <div>
                    <h4 className="font-bold text-base mb-2 flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary"/> Verba Operacional (ND 33.90.30 e 33.90.39)</h4>
                    {registrosVerbaOperacional.map(r => (
                        <div key={r.id} className="mb-4 p-3 border rounded-md bg-gray-50 whitespace-pre-wrap">
                            <p className="font-semibold mb-1">{r.organizacao} ({r.ug})</p>
                            <p>{generateVerbaOperacionalMemoriaCalculo(r)}</p>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Suprimento de Fundos */}
            {registrosSuprimentoFundos.length > 0 && (
                <div>
                    <h4 className="font-bold text-base mb-2 flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary"/> Suprimento de Fundos (ND 33.90.30 e 33.90.39)</h4>
                    {registrosSuprimentoFundos.map(r => (
                        <div key={r.id} className="mb-4 p-3 border rounded-md bg-gray-50 whitespace-pre-wrap">
                            <p className="font-semibold mb-1">{r.organizacao} ({r.ug})</p>
                            <p>{generateSuprimentoFundosMemoriaCalculo(r)}</p>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Passagens (Consolidado) */}
            {consolidatedPassagens.length > 0 && (
                <div>
                    <h4 className="font-bold text-base mb-2 flex items-center gap-2"><Plane className="h-4 w-4 text-primary"/> Passagens (ND 33.90.33)</h4>
                    {consolidatedPassagens.map(group => (
                        <div key={group.groupKey} className="mb-4 p-3 border rounded-md bg-gray-50 whitespace-pre-wrap">
                            <p className="font-semibold mb-1">{group.organizacao} ({group.ug}) - {group.om_detentora} ({group.ug_detentora})</p>
                            <p>{generateConsolidatedPassagemMemoriaCalculo(group)}</p>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Concessionária (Consolidado) */}
            {consolidatedConcessionarias.length > 0 && (
                <div>
                    <h4 className="font-bold text-base mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary"/> Concessionária (ND 33.90.39)</h4>
                    {consolidatedConcessionarias.map(group => (
                        <div key={group.groupKey} className="mb-4 p-3 border rounded-md bg-gray-50 whitespace-pre-wrap">
                            <p className="font-semibold mb-1">{group.organizacao} ({group.ug}) - {group.om_detentora} ({group.ug_detentora})</p>
                            <p>{generateConsolidatedConcessionariaMemoriaCalculo(group)}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>

      {/* Diálogo de Exportação */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exportar Relatório Operacional</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o formato de exportação desejado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Select value={exportType} onValueChange={(value: 'pdf' | 'excel') => setExportType(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF (Visualização para Impressão)</SelectItem>
                <SelectItem value="excel">Excel (Dados para Planilha)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport} disabled={loadingExport}>
              {loadingExport ? <Loader2 className="h-4 w-4 animate-spin" /> : "Exportar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PTrabOperacionalReport;