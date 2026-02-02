import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug, formatDate } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download, Briefcase, Loader2, Droplet, Zap, Plane, ClipboardList, Users, Calendar, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  PTrabData,
  DiariaRegistro,
  VerbaOperacionalRegistro, 
  calculateDays,
  PassagemRegistro,
} from "@/pages/PTrabReportManager"; 
import { generateConsolidatedPassagemMemoriaCalculo, ConsolidatedPassagemRecord } from "@/lib/passagemUtils";
import { ConcessionariaRegistroComDiretriz } from "@/lib/concessionariaUtils";

// Tipos de funções de memória (passadas como props)
type MemoriaDiariaFn = (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
type MemoriaVerbaFn = (registro: VerbaOperacionalRegistro) => string;
type MemoriaPassagemFn = (registro: PassagemRegistro) => string;
type MemoriaConcessionariaFn = (registro: Tables<'concessionaria_registros'> & ConcessionariaRegistroComDiretriz) => string;

interface PTrabOperacionalReportProps {
    ptrabData: PTrabData;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: Tables<'concessionaria_registros'>[]; // NEW
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    fileSuffix: string;
    generateDiariaMemoriaCalculo: MemoriaDiariaFn;
    generateVerbaOperacionalMemoriaCalculo: MemoriaVerbaFn;
    generateSuprimentoFundosMemoriaCalculo: MemoriaVerbaFn;
    generatePassagemMemoriaCalculo: MemoriaPassagemFn;
    generateConcessionariaMemoriaCalculo: MemoriaConcessionariaFn; // NEW
}

// Estrutura para agrupar registros operacionais por OM Favorecida
interface GrupoOperacional {
    organizacao: string;
    ug: string;
    fase_atividade: string;
    dias_operacao: number;
    efetivo: number;
    diarias: DiariaRegistro[];
    verbaOperacional: VerbaOperacionalRegistro[];
    suprimentoFundos: VerbaOperacionalRegistro[];
    passagens: PassagemRegistro[];
    concessionaria: Tables<'concessionaria_registros'>[];
    totalGeral: number;
    totalND15: number;
    totalND30: number;
    totalND33: number;
    totalND39: number;
}

// NOVO TIPO: Representa um lote consolidado de Passagens para o relatório
interface ConsolidatedPassagemReport extends ConsolidatedPassagemRecord {
    groupKey: string;
    diretrizDetails?: { numero_pregao: string | null, ug_referencia: string | null } | null;
}

// NOVO TIPO: Representa um lote consolidado de Concessionária para o relatório
interface ConsolidatedConcessionariaReport {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: (Tables<'concessionaria_registros'> & ConcessionariaRegistroComDiretriz)[];
    totalGeral: number;
    totalND39: number;
}


// Função auxiliar para buscar detalhes da diretriz de passagem (Pregão/UASG)
const fetchDiretrizDetails = async (diretrizId: string): Promise<{ numero_pregao: string | null, ug_referencia: string | null } | null> => {
    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('numero_pregao, ug_referencia')
        .eq('id', diretrizId)
        .single();

    if (error || !data) {
        return null;
    }
    return data;
};

// Função auxiliar para determinar o artigo (DO/DA)
const getArticleForOM = (omName: string): 'DO' | 'DA' => {
    const normalizedOmName = omName.toUpperCase().trim();

    if (normalizedOmName.includes('CMDO')) return 'DO';
    if (normalizedOmName.includes('ª')) return 'DA';
    if (normalizedOmName.includes('º')) return 'DO';
    
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
    
    return 'DA';
};


const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
    ptrabData,
    registrosDiaria,
    registrosVerbaOperacional,
    registrosSuprimentoFundos,
    registrosPassagem,
    registrosConcessionaria,
    diretrizesOperacionais,
    fileSuffix,
    generateDiariaMemoriaCalculo,
    generateVerbaOperacionalMemoriaCalculo,
    generateSuprimentoFundosMemoriaCalculo,
    generatePassagemMemoriaCalculo,
    generateConcessionariaMemoriaCalculo,
}) => {
    const { toast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    
    // Estado para armazenar os detalhes das diretrizes de passagem
    const [diretrizDetailsMap, setDiretrizDetailsMap] = useState<Record<string, { numero_pregao: string | null, ug_referencia: string | null } | null>>({});
    const [isLoadingDiretrizDetails, setIsLoadingDiretrizDetails] = useState(true);
    
    const diasTotais = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);

    // 1. Agrupamento e Consolidação dos Registros (Diária, Verba, Suprimento, Passagem, Concessionária)
    const { gruposPorOM, consolidatedPassagens, consolidatedConcessionaria } = useMemo(() => {
        const groups: Record<string, GrupoOperacional> = {};
        const consolidatedPassagensMap: Record<string, ConsolidatedPassagemReport> = {};
        const consolidatedConcessionariaMap: Record<string, ConsolidatedConcessionariaReport> = {};

        const safeRegistrosDiaria = registrosDiaria || [];
        const safeRegistrosVerbaOperacional = registrosVerbaOperacional || [];
        const safeRegistrosSuprimentoFundos = registrosSuprimentoFundos || [];
        const safeRegistrosPassagem = registrosPassagem || [];
        const safeRegistrosConcessionaria = registrosConcessionaria || [];

        const allRecords = [
            ...safeRegistrosDiaria.map(r => ({ ...r, type: 'diaria' as const })),
            ...safeRegistrosVerbaOperacional.map(r => ({ ...r, type: 'verba' as const })),
            ...safeRegistrosSuprimentoFundos.map(r => ({ ...r, type: 'suprimento' as const })),
            ...safeRegistrosPassagem.map(r => ({ ...r, type: 'passagem' as const })),
            ...safeRegistrosConcessionaria.map(r => ({ ...r, type: 'concessionaria' as const })),
        ];

        allRecords.forEach(record => {
            // A chave de agrupamento deve ser a OM Detentora do Recurso (que recebe o dinheiro)
            const omDetentora = record.om_detentora || record.organizacao;
            const ugDetentora = record.ug_detentora || record.ug;
            
            // Chave de agrupamento no relatório (OM Detentora do Recurso)
            const omKey = `${omDetentora} (${ugDetentora})`;
            
            // Chave de consolidação para Passagens/Concessionária (Lote de Solicitação)
            const consolidationKey = [
                record.organizacao, // OM Favorecida
                record.ug,
                omDetentora, // OM Detentora
                ugDetentora,
                record.dias_operacao,
                record.efetivo || 0,
                record.fase_atividade,
                // Adicionar ID da diretriz para Passagens/Concessionária
                (record as any).diretriz_id || '', 
            ].join('|');

            if (!groups[omKey]) {
                groups[omKey] = {
                    organizacao: omDetentora,
                    ug: ugDetentora,
                    fase_atividade: record.fase_atividade || 'Não Definida',
                    dias_operacao: record.dias_operacao,
                    efetivo: record.efetivo || 0,
                    diarias: [],
                    verbaOperacional: [],
                    suprimentoFundos: [],
                    passagens: [],
                    concessionaria: [],
                    totalGeral: 0,
                    totalND15: 0,
                    totalND30: 0,
                    totalND33: 0,
                    totalND39: 0,
                };
            }

            const group = groups[omKey];
            
            if (record.type === 'diaria') {
                group.diarias.push(record as DiariaRegistro);
                group.totalND15 += Number(record.valor_nd_15 || 0);
                group.totalND30 += Number(record.valor_nd_30 || 0);
            } else if (record.type === 'verba') {
                group.verbaOperacional.push(record as VerbaOperacionalRegistro);
                group.totalND30 += Number(record.valor_nd_30 || 0);
                group.totalND39 += Number(record.valor_nd_39 || 0);
            } else if (record.type === 'suprimento') {
                group.suprimentoFundos.push(record as VerbaOperacionalRegistro);
                group.totalND30 += Number(record.valor_nd_30 || 0);
                group.totalND39 += Number(record.valor_nd_39 || 0);
            } else if (record.type === 'passagem') {
                // Consolidação de Passagens
                if (!consolidatedPassagensMap[consolidationKey]) {
                    consolidatedPassagensMap[consolidationKey] = {
                        groupKey: consolidationKey,
                        organizacao: record.organizacao,
                        ug: record.ug,
                        om_detentora: omDetentora,
                        ug_detentora: ugDetentora,
                        dias_operacao: record.dias_operacao,
                        efetivo: record.efetivo || 0,
                        fase_atividade: record.fase_atividade || '',
                        records: [],
                        totalGeral: 0,
                        totalND33: 0,
                    } as ConsolidatedPassagemReport;
                }
                const consolidated = consolidatedPassagensMap[consolidationKey];
                consolidated.records.push(record as PassagemRegistro);
                consolidated.totalGeral += Number((record as PassagemRegistro).valor_total || 0);
                consolidated.totalND33 += Number((record as PassagemRegistro).valor_nd_33 || 0);
                
                group.passagens.push(record as PassagemRegistro);
                group.totalND33 += Number((record as PassagemRegistro).valor_nd_33 || 0);
            } else if (record.type === 'concessionaria') {
                // Consolidação de Concessionária
                if (!consolidatedConcessionariaMap[consolidationKey]) {
                    consolidatedConcessionariaMap[consolidationKey] = {
                        groupKey: consolidationKey,
                        organizacao: record.organizacao,
                        ug: record.ug,
                        om_detentora: omDetentora,
                        ug_detentora: ugDetentora,
                        dias_operacao: record.dias_operacao,
                        efetivo: record.efetivo || 0,
                        fase_atividade: record.fase_atividade || '',
                        records: [],
                        totalGeral: 0,
                        totalND39: 0,
                    } as ConsolidatedConcessionariaReport;
                }
                const consolidated = consolidatedConcessionariaMap[consolidationKey];
                // Nota: O registro de concessionária precisa ser enriquecido para a memória, mas aqui só o adicionamos
                consolidated.records.push(record as Tables<'concessionaria_registros'> & ConcessionariaRegistroComDiretriz);
                consolidated.totalGeral += Number((record as Tables<'concessionaria_registros'>).valor_total || 0);
                consolidated.totalND39 += Number((record as Tables<'concessionaria_registros'>).valor_nd_39 || 0);
                
                group.concessionaria.push(record as Tables<'concessionaria_registros'>);
                group.totalND39 += Number((record as Tables<'concessionaria_registros'>).valor_nd_39 || 0);
            }
            
            group.totalGeral = group.totalND15 + group.totalND30 + group.totalND33 + group.totalND39;
        });

        return { 
            gruposPorOM: Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
            consolidatedPassagens: Object.values(consolidatedPassagensMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
            consolidatedConcessionaria: Object.values(consolidatedConcessionariaMap).sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
        };
    }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria]);

    // 2. Efeito para buscar os detalhes das diretrizes de passagem
    useEffect(() => {
        const loadDiretrizDetails = async () => {
            setIsLoadingDiretrizDetails(true);
            const uniqueDiretrizIds = new Set<string>();
            
            consolidatedPassagens.forEach(group => {
                group.records.forEach(record => {
                    if (record.diretriz_id) {
                        uniqueDiretrizIds.add(record.diretriz_id);
                    }
                });
            });

            const newDetailsMap: Record<string, { numero_pregao: string | null, ug_referencia: string | null } | null> = {};
            const promises = Array.from(uniqueDiretrizIds).map(async (id) => {
                const details = await fetchDiretrizDetails(id);
                newDetailsMap[id] = details;
            });

            await Promise.all(promises);
            setDiretrizDetailsMap(newDetailsMap);
            setIsLoadingDiretrizDetails(false);
        };

        if (consolidatedPassagens.length > 0) {
            loadDiretrizDetails();
        } else if (isLoadingDiretrizDetails) {
            setIsLoadingDiretrizDetails(false);
        }
    }, [consolidatedPassagens]);
    
    // 3. Adicionar detalhes da diretriz aos registros consolidados
    const consolidatedPassagensWithDetails = useMemo(() => {
        if (isLoadingDiretrizDetails) return [];
        
        return consolidatedPassagens.map(group => {
            const firstRecord = group.records[0];
            const diretrizId = firstRecord?.diretriz_id;
            
            const details = diretrizId ? diretrizDetailsMap[diretrizId] : null;
            
            return {
                ...group,
                diretrizDetails: details,
            };
        });
    }, [consolidatedPassagens, diretrizDetailsMap, isLoadingDiretrizDetails]);
    
    // 4. Calcular Totais NDs (para o rodapé do relatório)
    const totaisND = useMemo(() => {
        return gruposPorOM.reduce((acc, group) => {
            acc.totalGeral += group.totalGeral;
            acc.nd15 += group.totalND15;
            acc.nd30 += group.totalND30;
            acc.nd33 += group.totalND33;
            acc.nd39 += group.totalND39;
            return acc;
        }, { totalGeral: 0, nd15: 0, nd30: 0, nd33: 0, nd39: 0, nd00: 0 });
    }, [gruposPorOM]);

    // --- Renderização de Memória ---
    
    const renderMemoriaCalculo = (group: GrupoOperacional) => {
        const allMemories: { title: string, content: string, nd: string, icon: React.FC<any> }[] = [];

        // 1. Diárias
        group.diarias.forEach(r => {
            const memoria = generateDiariaMemoriaCalculo(r, diretrizesOperacionais);
            allMemories.push({ 
                title: `Diárias - ${r.posto_graduacao || 'Diversos'} para ${r.destino}`, 
                content: memoria, 
                nd: `ND 33.90.15 / 33.90.30 (Taxa Embarque)`,
                icon: Briefcase,
            });
        });

        // 2. Verba Operacional
        group.verbaOperacional.forEach(r => {
            const memoria = generateVerbaOperacionalMemoriaCalculo(r);
            allMemories.push({ 
                title: `Verba Operacional - ${r.detalhamento || 'Não Detalhado'}`, 
                content: memoria, 
                nd: `ND 33.90.30 / 33.90.39`,
                icon: ClipboardList,
            });
        });
        
        // 3. Suprimento de Fundos
        group.suprimentoFundos.forEach(r => {
            const memoria = generateSuprimentoFundosMemoriaCalculo(r);
            allMemories.push({ 
                title: `Suprimento de Fundos - ${r.detalhamento || 'Não Detalhado'}`, 
                content: memoria, 
                nd: `ND 33.90.30 / 33.90.39`,
                icon: Wallet,
            });
        });
        
        // 4. Passagens (Consolidado)
        const passagensConsolidadasDesteGrupo = consolidatedPassagensWithDetails.filter(c => 
            c.om_detentora === group.organizacao && c.ug_detentora === group.ug
        );
        
        passagensConsolidadasDesteGrupo.forEach(consolidated => {
            const firstRecord = consolidated.records[0];
            let memoria = firstRecord.detalhamento_customizado;
            
            if (!memoria) {
                memoria = generateConsolidatedPassagemMemoriaCalculo(consolidated);
                if (consolidated.diretrizDetails?.numero_pregao && consolidated.diretrizDetails?.ug_referencia) {
                    memoria += `(Pregão ${consolidated.diretrizDetails.numero_pregao} - UASG ${formatCodug(consolidated.diretrizDetails.ug_referencia)})\n`;
                } else if (consolidated.diretrizDetails) {
                    memoria += `(Detalhes do contrato não disponíveis ou incompletos)\n`;
                }
            }
            
            allMemories.push({ 
                title: `Passagens - Lote OM Favorecida: ${consolidated.organizacao}`, 
                content: memoria, 
                nd: `ND 33.90.33`,
                icon: Plane,
            });
        });
        
        // 5. Concessionária (Consolidado)
        const concessionariaConsolidadasDesteGrupo = consolidatedConcessionaria.filter(c => 
            c.om_detentora === group.organizacao && c.ug_detentora === group.ug
        );
        
        concessionariaConsolidadasDesteGrupo.forEach(consolidated => {
            // Para a memória, precisamos iterar sobre os registros individuais dentro do grupo consolidado
            consolidated.records.forEach(r => {
                let memoria = r.detalhamento_customizado;
                
                if (!memoria) {
                    // Nota: A função generateConcessionariaMemoriaCalculo espera o registro enriquecido
                    memoria = generateConcessionariaMemoriaCalculo(r);
                }
                
                allMemories.push({ 
                    title: `Concessionária - ${r.categoria} (OM Favorecida: ${r.organizacao})`, 
                    content: memoria, 
                    nd: `ND 33.90.39`,
                    icon: r.categoria === 'Água/Esgoto' ? Droplet : Zap,
                });
            });
        });

        return (
            <div className="space-y-4">
                {allMemories.map((memoria, index) => (
                    <div key={index} className="border p-3 rounded-md bg-gray-50 break-inside-avoid">
                        <h5 className="font-semibold text-sm mb-1 border-b pb-1 flex items-center gap-2">
                            <memoria.icon className="h-4 w-4 text-muted-foreground" />
                            {memoria.title} ({memoria.nd})
                        </h5>
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                            {memoria.content}
                        </pre>
                    </div>
                ))}
            </div>
        );
    };
    
    // --- Exportação e Impressão ---
    
    const handleExportPDF = useCallback(async () => {
        setIsExporting(true);
        toast({ title: "Gerando PDF...", description: "Isso pode levar alguns segundos." });
        
        if (contentRef.current) {
            try {
                const canvas = await html2canvas(contentRef.current, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    windowWidth: contentRef.current.scrollWidth,
                    windowHeight: contentRef.current.scrollHeight,
                });

                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4',
                });

                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
                let heightLeft = imgHeight;
                let position = 0;
                const margin = 5;
                const contentHeight = pdfHeight - 2 * margin;

                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
                heightLeft -= contentHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= contentHeight;
                }

                pdf.save(generateFileName('PDF'));
                toast({ title: "PDF gerado com sucesso!" });
            } catch (error) {
                console.error("Erro ao gerar PDF:", error);
                toast({ title: "Falha ao gerar PDF.", variant: "destructive" });
            } finally {
                setIsExporting(false);
            }
        }
    }, [ptrabData, fileSuffix, totaisND, gruposPorOM, consolidatedPassagensWithDetails, consolidatedConcessionaria, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generatePassagemMemoriaCalculo, generateConcessionariaMemoriaCalculo, diretrizesOperacionais]);

    const exportExcel = useCallback(async () => {
        setIsExporting(true);
        toast({ title: "Gerando planilha Excel..." });
        
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('P Trab Operacional');

            // --- Definição de Estilos e Alinhamentos ---
            const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
            const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
            const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
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
            
            const headerFillGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corHeader } };
            const headerFillAzul = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corND } };
            const totalOMFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corGrandTotal } };
            const totalGeralFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSomaND } };

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
            fullTitleRow.getCell(1).value = `PLANO DE TRABALHO OPERACIONAL DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
            fullTitleRow.getCell(1).font = titleFontStyle;
            fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
            worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
            currentRow++;

            const shortTitleRow = worksheet.getRow(currentRow);
            shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO OPERACIONAL'; 
            shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
            shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
            worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
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
                worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
                currentRow++;
            };
            
            addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
            addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasTotais}`);
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
            
            headerRow1.height = 45;
            headerRow2.height = 35;

            const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
            
            headerCols.forEach(col => {
                const cell1 = headerRow1.getCell(col);
                cell1.font = headerFontStyle;
                cell1.alignment = centerMiddleAlignment;
                cell1.border = cellBorder;
                
                const cell2 = headerRow2.getCell(col);
                cell2.font = headerFontStyle;
                cell2.alignment = centerMiddleAlignment;
                cell2.border = cellBorder;

                if (col === 'A' || col === 'B' || col === 'I') {
                    cell1.fill = headerFillGray;
                    cell2.value = '';
                    cell2.fill = headerFillGray;
                } else {
                    cell1.fill = headerFillGray;
                    cell2.fill = headerFillAzul;
                }
            });
            
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
            
            currentRow += 2;

            // Dados da Tabela (Agrupados por OM Detentora do Recurso)
            gruposPorOM.forEach(group => {
                const omName = group.organizacao;
                const ug = group.ug;
                const article = getArticleForOM(omName);
                
                // Calculate subtotal for this OM (já está no objeto group)
                const subtotalOM = {
                    nd15: group.totalND15,
                    nd30: group.totalND30,
                    nd33: group.totalND33,
                    nd39: group.totalND39,
                    nd00: 0,
                    totalGND3: group.totalGeral,
                };

                // --- 1. Render Diárias ---
                group.diarias.forEach(registro => {
                    const row = worksheet.getRow(currentRow);
                    const totalLinha = registro.valor_nd_15 + registro.valor_nd_30;
                    
                    row.getCell('A').value = `DIÁRIAS`; 
                    row.getCell('A').alignment = leftMiddleAlignment; 
                    
                    row.getCell('B').value = `${registro.organizacao}\n(${formatCodug(registro.ug)})`;
                    row.getCell('B').alignment = dataCenterMiddleAlignment; 
                    
                    row.getCell('C').value = registro.valor_nd_15;
                    row.getCell('D').value = registro.valor_nd_30;
                    row.getCell('E').value = 0;
                    row.getCell('F').value = 0;
                    row.getCell('G').value = 0;
                    row.getCell('H').value = totalLinha;
                    
                    const memoria = generateDiariaMemoriaCalculo(registro, diretrizesOperacionais);
                    row.getCell('I').value = memoria;
                    row.getCell('I').alignment = leftTopAlignment; 
                    row.getCell('I').font = { name: 'Arial', size: 6.5 };
                    
                    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                        const cell = row.getCell(col);
                        cell.alignment = dataCenterMiddleAlignment;
                        cell.numFmt = 'R$ #,##0.00';
                        cell.fill = headerFillAzul;
                    });
                    
                    ['A', 'B', 'I'].forEach(col => { row.getCell(col).font = baseFontStyle; });
                    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => { row.getCell(col).border = cellBorder; });
                    currentRow++;
                });
                
                // --- 2. Render Passagens (CONSOLIDADO) ---
                const passagensConsolidadasDesteGrupo = consolidatedPassagensWithDetails.filter(c => 
                    c.om_detentora === omName && c.ug_detentora === ug
                );

                passagensConsolidadasDesteGrupo.forEach(consolidated => {
                    const row = worksheet.getRow(currentRow);
                    const totalLinha = consolidated.totalND33;
                    const firstRecord = consolidated.records[0];
                    
                    const isDifferentOm = consolidated.organizacao !== consolidated.om_detentora || consolidated.ug !== consolidated.ug_detentora;
                    
                    let despesasLabel = `PASSAGENS`;
                    if (isDifferentOm) {
                        despesasLabel += `\n${consolidated.organizacao}`;
                    }
                    row.getCell('A').value = despesasLabel; 
                    row.getCell('A').alignment = leftMiddleAlignment; 
                    
                    row.getCell('B').value = `${consolidated.om_detentora}\n(${formatCodug(consolidated.ug_detentora)})`;
                    row.getCell('B').alignment = dataCenterMiddleAlignment; 
                    
                    row.getCell('C').value = 0;
                    row.getCell('D').value = 0;
                    row.getCell('E').value = consolidated.totalND33;
                    row.getCell('F').value = 0;
                    row.getCell('G').value = 0;
                    row.getCell('H').value = totalLinha;
                    
                    let memoria = firstRecord.detalhamento_customizado;
                    if (!memoria) {
                        memoria = generateConsolidatedPassagemMemoriaCalculo(consolidated);
                        if (consolidated.diretrizDetails?.numero_pregao && consolidated.diretrizDetails?.ug_referencia) {
                            memoria += `(Pregão ${consolidated.diretrizDetails.numero_pregao} - UASG ${formatCodug(consolidated.diretrizDetails.ug_referencia)})\n`;
                        } else if (consolidated.diretrizDetails) {
                            memoria += `(Detalhes do contrato não disponíveis ou incompletos)\n`;
                        }
                    }
                    
                    row.getCell('I').value = memoria;
                    row.getCell('I').alignment = leftTopAlignment; 
                    row.getCell('I').font = { name: 'Arial', size: 6.5 };
                    
                    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                        const cell = row.getCell(col);
                        cell.alignment = dataCenterMiddleAlignment;
                        cell.numFmt = 'R$ #,##0.00';
                        cell.fill = headerFillAzul;
                    });
                    
                    ['A', 'B', 'I'].forEach(col => { row.getCell(col).font = baseFontStyle; });
                    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => { row.getCell(col).border = cellBorder; });
                    currentRow++;
                });
                
                // --- 3. Render Verba Operacional ---
                group.verbaOperacional.forEach(registro => {
                    const row = worksheet.getRow(currentRow);
                    const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
                    
                    const omDetentora = registro.om_detentora || registro.organizacao;
                    const ugDetentora = registro.ug_detentora || registro.ug;
                    
                    row.getCell('A').value = `VERBA OPERACIONAL`; 
                    row.getCell('A').alignment = leftMiddleAlignment; 
                    
                    row.getCell('B').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
                    row.getCell('B').alignment = dataCenterMiddleAlignment; 
                    
                    row.getCell('C').value = 0;
                    row.getCell('D').value = registro.valor_nd_30;
                    row.getCell('E').value = 0;
                    row.getCell('F').value = registro.valor_nd_39;
                    row.getCell('G').value = 0;
                    row.getCell('H').value = totalLinha;
                    
                    const memoria = generateVerbaOperacionalMemoriaCalculo(registro);
                    row.getCell('I').value = memoria;
                    row.getCell('I').alignment = leftTopAlignment; 
                    row.getCell('I').font = { name: 'Arial', size: 6.5 };
                    
                    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                        const cell = row.getCell(col);
                        cell.alignment = dataCenterMiddleAlignment;
                        cell.numFmt = 'R$ #,##0.00';
                        cell.fill = headerFillAzul;
                    });
                    
                    ['A', 'B', 'I'].forEach(col => { row.getCell(col).font = baseFontStyle; });
                    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => { row.getCell(col).border = cellBorder; });
                    currentRow++;
                });
                
                // --- 4. Render Suprimento de Fundos ---
                group.suprimentoFundos.forEach(registro => {
                    const row = worksheet.getRow(currentRow);
                    const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
                    
                    const omDetentora = registro.om_detentora || registro.organizacao;
                    const ugDetentora = registro.ug_detentora || registro.ug;
                    
                    row.getCell('A').value = `SUPRIMENTO DE FUNDOS`; 
                    row.getCell('A').alignment = leftMiddleAlignment; 
                    
                    row.getCell('B').value = `${omDetentora}\n(${formatCodug(ugDetentora)})`;
                    row.getCell('B').alignment = dataCenterMiddleAlignment; 
                    
                    row.getCell('C').value = 0;
                    row.getCell('D').value = registro.valor_nd_30;
                    row.getCell('E').value = 0;
                    row.getCell('F').value = registro.valor_nd_39;
                    row.getCell('G').value = 0;
                    row.getCell('H').value = totalLinha;
                    
                    const memoria = generateSuprimentoFundosMemoriaCalculo(registro);
                    row.getCell('I').value = memoria;
                    row.getCell('I').alignment = leftTopAlignment; 
                    row.getCell('I').font = { name: 'Arial', size: 6.5 };
                    
                    ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                        const cell = row.getCell(col);
                        cell.alignment = dataCenterMiddleAlignment;
                        cell.numFmt = 'R$ #,##0.00';
                        cell.fill = headerFillAzul;
                    });
                    
                    ['A', 'B', 'I'].forEach(col => { row.getCell(col).font = baseFontStyle; });
                    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => { row.getCell(col).border = cellBorder; });
                    currentRow++;
                });
                
                // --- 5. Render Concessionária (CONSOLIDADO) ---
                const concessionariaConsolidadasDesteGrupo = consolidatedConcessionaria.filter(c => 
                    c.om_detentora === omName && c.ug_detentora === ug
                );
                
                concessionariaConsolidadasDesteGrupo.forEach(consolidated => {
                    // Para o Excel, listamos cada registro individualmente para a memória, mas usamos o total consolidado
                    consolidated.records.forEach(registro => {
                        const row = worksheet.getRow(currentRow);
                        const totalLinha = registro.valor_nd_39;
                        
                        const isDifferentOm = registro.organizacao !== registro.om_detentora || registro.ug !== registro.ug_detentora;
                        
                        let despesasLabel = `CONCESSIONÁRIA - ${registro.categoria}`;
                        if (isDifferentOm) {
                            despesasLabel += `\nOM Fav: ${registro.organizacao}`;
                        }
                        row.getCell('A').value = despesasLabel; 
                        row.getCell('A').alignment = leftMiddleAlignment; 
                        
                        row.getCell('B').value = `${registro.om_detentora}\n(${formatCodug(registro.ug_detentora)})`;
                        row.getCell('B').alignment = dataCenterMiddleAlignment; 
                        
                        row.getCell('C').value = 0;
                        row.getCell('D').value = 0;
                        row.getCell('E').value = 0;
                        row.getCell('F').value = registro.valor_nd_39;
                        row.getCell('G').value = 0;
                        row.getCell('H').value = totalLinha;
                        
                        let memoria = registro.detalhamento_customizado;
                        if (!memoria) {
                            memoria = generateConcessionariaMemoriaCalculo(registro);
                        }
                        
                        row.getCell('I').value = memoria;
                        row.getCell('I').alignment = leftTopAlignment; 
                        row.getCell('I').font = { name: 'Arial', size: 6.5 };
                        
                        ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                            const cell = row.getCell(col);
                            cell.alignment = dataCenterMiddleAlignment;
                            cell.numFmt = 'R$ #,##0.00';
                            cell.fill = headerFillAzul;
                        });
                        
                        ['A', 'B', 'I'].forEach(col => { row.getCell(col).font = baseFontStyle; });
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => { row.getCell(col).border = cellBorder; });
                        currentRow++;
                    });
                });


                // Subtotal Row 1: SOMA POR ND E GP DE DESPESA
                const subtotalSomaRow = worksheet.getRow(currentRow);
                
                subtotalSomaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
                worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
                subtotalSomaRow.getCell('A').alignment = rightMiddleAlignment;
                subtotalSomaRow.getCell('A').font = headerFontStyle;
                subtotalSomaRow.getCell('A').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotalOM } };
                subtotalSomaRow.getCell('A').border = cellBorder;
                
                subtotalSomaRow.getCell('C').value = subtotalOM.nd15;
                subtotalSomaRow.getCell('D').value = subtotalOM.nd30;
                subtotalSomaRow.getCell('E').value = subtotalOM.nd33;
                subtotalSomaRow.getCell('F').value = subtotalOM.nd39;
                subtotalSomaRow.getCell('G').value = subtotalOM.nd00;
                subtotalSomaRow.getCell('H').value = subtotalOM.totalGND3;
                
                ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                    const cell = subtotalSomaRow.getCell(col);
                    cell.alignment = dataCenterMiddleAlignment;
                    cell.font = headerFontStyle;
                    cell.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotalOM } };
                    cell.border = cellBorder;
                    cell.numFmt = 'R$ #,##0.00';
                });
                
                subtotalSomaRow.getCell('I').value = '';
                subtotalSomaRow.getCell('I').alignment = centerMiddleAlignment;
                subtotalSomaRow.getCell('I').font = headerFontStyle;
                subtotalSomaRow.getCell('I').fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: corSubtotalOM } };
                subtotalSomaRow.getCell('I').border = cellBorder;

                currentRow++;

                // Subtotal Row 2: VALOR TOTAL DO(A) OM
                const subtotalFinalRow = worksheet.getRow(currentRow);
                
                worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
                subtotalFinalRow.getCell('A').value = `VALOR TOTAL ${article} ${omName}`;
                subtotalFinalRow.getCell('A').alignment = rightMiddleAlignment;
                subtotalFinalRow.getCell('A').font = headerFontStyle;
                subtotalFinalRow.getCell('A').fill = totalOMFill;
                subtotalFinalRow.getCell('A').border = cellBorder;
                
                subtotalFinalRow.getCell('H').value = subtotalOM.totalGND3;
                subtotalFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
                subtotalFinalRow.getCell('H').font = headerFontStyle;
                subtotalFinalRow.getCell('H').fill = totalOMFill;
                subtotalFinalRow.getCell('H').border = cellBorder;
                subtotalFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

                subtotalFinalRow.getCell('I').value = '';
                subtotalFinalRow.getCell('I').alignment = centerMiddleAlignment;
                subtotalFinalRow.getCell('I').font = headerFontStyle;
                subtotalFinalRow.getCell('I').fill = totalOMFill;
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
            totalGeralSomaRow.getCell('A').fill = totalGeralFill;
            totalGeralSomaRow.getCell('A').border = cellBorder;

            totalGeralSomaRow.getCell('C').value = totaisND.nd15;
            totalGeralSomaRow.getCell('D').value = totaisND.nd30;
            totalGeralSomaRow.getCell('E').value = totaisND.nd33;
            totalGeralSomaRow.getCell('F').value = totaisND.nd39;
            totalGeralSomaRow.getCell('G').value = totaisND.nd00;
            totalGeralSomaRow.getCell('H').value = totaisND.totalGeral;

            ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                const cell = totalGeralSomaRow.getCell(col);
                cell.alignment = dataCenterMiddleAlignment;
                cell.font = headerFontStyle;
                cell.fill = totalGeralFill;
                cell.border = cellBorder;
                cell.numFmt = 'R$ #,##0.00';
            });

            totalGeralSomaRow.getCell('I').value = '';
            totalGeralSomaRow.getCell('I').alignment = centerMiddleAlignment;
            totalGeralSomaRow.getCell('I').font = headerFontStyle;
            totalGeralSomaRow.getCell('I').fill = totalGeralFill;
            totalGeralSomaRow.getCell('I').border = cellBorder;

            currentRow++;
            
            // Linha 2: VALOR TOTAL
            const totalGeralFinalRow = worksheet.getRow(currentRow);
            
            worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
            totalGeralFinalRow.getCell('A').value = 'VALOR TOTAL';
            totalGeralFinalRow.getCell('A').alignment = rightMiddleAlignment;
            totalGeralFinalRow.getCell('A').font = headerFontStyle;
            totalGeralFinalRow.getCell('A').fill = totalGeralFill;
            totalGeralFinalRow.getCell('A').border = cellBorder;
            
            totalGeralFinalRow.getCell('H').value = totaisND.totalGeral;
            totalGeralFinalRow.getCell('H').alignment = dataCenterMiddleAlignment;
            totalGeralFinalRow.getCell('H').font = headerFontStyle;
            totalGeralFinalRow.getCell('H').fill = totalGeralFill;
            totalGeralFinalRow.getCell('H').border = cellBorder;
            totalGeralFinalRow.getCell('H').numFmt = 'R$ #,##0.00';

            totalGeralFinalRow.getCell('I').value = '';
            totalGeralFinalRow.getCell('I').alignment = centerMiddleAlignment;
            totalGeralFinalRow.getCell('I').font = headerFontStyle;
            totalGeralFinalRow.getCell('I').fill = totalGeralFill;
            totalGeralFinalRow.getCell('I').border = cellBorder;

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
              description: "O relatório Operacional foi salvo com sucesso.",
              duration: 3000,
            });
        } catch (error) {
            console.error("Erro ao gerar Excel:", error);
            toast({ title: "Falha ao gerar Excel.", description: "Verifique se há dados válidos.", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    }, [gruposPorOM, consolidatedPassagensWithDetails, consolidatedConcessionaria, ptrabData, totaisND, diasTotais, fileSuffix, generateDiariaMemoriaCalculo, generateVerbaOperacionalMemoriaCalculo, generateSuprimentoFundosMemoriaCalculo, generatePassagemMemoriaCalculo, generateConcessionariaMemoriaCalculo, diretrizesOperacionais]);


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

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    if (gruposPorOM.length === 0 && !isLoadingDiretrizDetails) {
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
                <p className="text-muted-foreground">Nenhum registro de Diária, Verba Operacional, Suprimento de Fundos, Passagens ou Concessionária encontrado para este P Trab.</p>
              </div>
            </CardContent>
          </Card>
        );
    }
    
    if (isLoadingDiretrizDetails) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando detalhes dos contratos...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Botões de Exportação/Impressão padronizados */}
            <div className="flex justify-end gap-2 print:hidden">
                <Button onClick={handleExportPDF} disabled={isExporting} variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar PDF
                </Button>
                <Button onClick={exportExcel} disabled={isExporting} variant="outline">
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Exportar Excel
                </Button>
                <Button onClick={handlePrint} disabled={isExporting} variant="default">
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
                    <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Operacional</p>
                </div>

                <div className="ptrab-info">
                    <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
                    <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasTotais}</p>
                    <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
                    <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
                    <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
                </div>

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
                            {gruposPorOM.map((group) => {
                                const omName = group.organizacao;
                                const ug = group.ug;
                                const article = getArticleForOM(omName);
                                
                                return (
                                    <React.Fragment key={group.organizacao + group.ug}>
                                        {/* --- 1. Render Diárias --- */}
                                        {group.diarias.map((registro) => {
                                            const totalLinha = registro.valor_nd_15 + registro.valor_nd_30;
                                            
                                            return (
                                                <tr key={`diaria-${registro.id}`} className="expense-row">
                                                    <td className="col-despesas-op"> DIÁRIAS </td>
                                                    <td className="col-om-op">
                                                        <div>{registro.organizacao}</div>
                                                        <div>({formatCodug(registro.ug)})</div>
                                                    </td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_15)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_30)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {generateDiariaMemoriaCalculo(registro, diretrizesOperacionais)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* --- 2. Render Passagens (CONSOLIDADO) --- */}
                                        {consolidatedPassagensWithDetails.filter(c => 
                                            c.om_detentora === omName && c.ug_detentora === ug
                                        ).map((consolidated) => {
                                            const totalLinha = consolidated.totalND33;
                                            const firstRecord = consolidated.records[0];
                                            
                                            const isDifferentOm = consolidated.organizacao !== consolidated.om_detentora || consolidated.ug !== consolidated.ug_detentora;
                                            
                                            let memoria = firstRecord.detalhamento_customizado;
                                            if (!memoria) {
                                                memoria = generateConsolidatedPassagemMemoriaCalculo(consolidated);
                                                if (consolidated.diretrizDetails?.numero_pregao && consolidated.diretrizDetails?.ug_referencia) {
                                                    memoria += `(Pregão ${consolidated.diretrizDetails.numero_pregao} - UASG ${formatCodug(consolidated.diretrizDetails.ug_referencia)})\n`;
                                                } else if (consolidated.diretrizDetails) {
                                                    memoria += `(Detalhes do contrato não disponíveis ou incompletos)\n`;
                                                }
                                            }
                                            
                                            let despesasLabel = `PASSAGENS`;
                                            if (isDifferentOm) {
                                                despesasLabel += `<br/>${consolidated.organizacao}`;
                                            }
                                            
                                            return (
                                                <tr key={`passagem-consolidada-${consolidated.groupKey}`} className="expense-row">
                                                    <td className="col-despesas-op"> 
                                                        <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: despesasLabel }} />
                                                    </td>
                                                    <td className="col-om-op">
                                                        <div>{consolidated.om_detentora}</div>
                                                        <div>({formatCodug(consolidated.ug_detentora)})</div>
                                                    </td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(consolidated.totalND33)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {memoria}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* --- 3. Render Verba Operacional --- */}
                                        {group.verbaOperacional.map((registro) => {
                                            const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
                                            const omDetentora = registro.om_detentora || registro.organizacao;
                                            const ugDetentora = registro.ug_detentora || registro.ug;
                                            
                                            return (
                                                <tr key={`verba-${registro.id}`} className="expense-row">
                                                    <td className="col-despesas-op"> VERBA OPERACIONAL </td>
                                                    <td className="col-om-op">
                                                        <div>{omDetentora}</div>
                                                        <div>({formatCodug(ugDetentora)})</div>
                                                    </td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_30)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_39)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {generateVerbaOperacionalMemoriaCalculo(registro)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* --- 4. Render Suprimento de Fundos --- */}
                                        {group.suprimentoFundos.map((registro) => {
                                            const totalLinha = registro.valor_nd_30 + registro.valor_nd_39;
                                            const omDetentora = registro.om_detentora || registro.organizacao;
                                            const ugDetentora = registro.ug_detentora || registro.ug;
                                            
                                            return (
                                                <tr key={`suprimento-${registro.id}`} className="expense-row">
                                                    <td className="col-despesas-op"> SUPRIMENTO DE FUNDOS </td>
                                                    <td className="col-om-op">
                                                        <div>{omDetentora}</div>
                                                        <div>({formatCodug(ugDetentora)})</div>
                                                    </td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_30)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_39)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {generateSuprimentoFundosMemoriaCalculo(registro)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* --- 5. Render Concessionária (INDIVIDUALMENTE para memória) --- */}
                                        {group.concessionaria.map((registro) => {
                                            const totalLinha = registro.valor_nd_39;
                                            const omDetentora = registro.om_detentora || registro.organizacao;
                                            const ugDetentora = registro.ug_detentora || registro.ug;
                                            
                                            // Nota: Para a memória, precisamos de um registro enriquecido.
                                            const enrichedRecord: Tables<'concessionaria_registros'> & ConcessionariaRegistroComDiretriz = {
                                                ...registro,
                                                nome_concessionaria: registro.detalhamento?.split(' - ')[1] || registro.categoria,
                                                unidade_custo: 'unidade', 
                                                fonte_consumo: null,
                                                fonte_custo: null,
                                            };
                                            
                                            return (
                                                <tr key={`concessionaria-${registro.id}`} className="expense-row">
                                                    <td className="col-despesas-op"> CONCESSIONÁRIA </td>
                                                    <td className="col-om-op">
                                                        <div>{omDetentora}</div>
                                                        <div>({formatCodug(ugDetentora)})</div>
                                                    </td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(registro.valor_nd_39)}</td>
                                                    <td className="col-nd-op-small">{formatCurrency(0)}</td>
                                                    <td className="col-nd-op-small total-gnd3-cell">{formatCurrency(totalLinha)}</td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {generateConcessionariaMemoriaCalculo(enrichedRecord)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        
                                        {/* Subtotal Row 1: SOMA POR ND E GP DE DESPESA */}
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
                                        
                                        {/* Subtotal Row 2: VALOR TOTAL DO(A) OM */}
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
                            
                            {/* Grand Total Row 1: SOMA POR ND E GP DE DESPESA */}
                            <tr className="total-geral-soma-row">
                                <td colSpan={2} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                                    SOMA POR ND E GP DE DESPESA
                                </td>
                                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd15)}</td>
                                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd30)}</td>
                                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D39' }}>{formatCurrency(totaisND.nd33)}</td>
                                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd39)}</td>
                                <td className="col-nd-op-small text-center font-bold" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.nd00)}</td>
                                <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9' }}>{formatCurrency(totaisND.totalGeral)}</td>
                                <td></td>
                            </tr>
                            
                            {/* Grand Total Row 2: VALOR TOTAL */}
                            <tr className="total-geral-final-row">
                                <td colSpan={7} className="text-right font-bold" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000', borderRight: 'none' }}>
                                    VALOR TOTAL
                                </td>
                                <td className="col-nd-op-small text-center font-bold total-gnd3-cell" style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}>
                                    {formatCurrency(totaisND.totalGeral)}
                                </td>
                                <td style={{ backgroundColor: '#D9D9D9', border: '1px solid #000' }}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

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
                    background-color: #B4C7E7 !important;
                }
                .col-detalhamento-op { width: 38%; text-align: left; vertical-align: top; }
                
                .total-gnd3-cell { background-color: #B4C7E7 !important; }
                
                /* Estilos para Subtotal OM - Linha 1 (Soma por ND) */
                .subtotal-om-soma-row { 
                    font-weight: bold; 
                    page-break-inside: avoid; 
                    background-color: #D9D9D9;
                }
                .subtotal-om-soma-row td {
                    border: 1px solid #000 !important;
                    padding: 3px 4px;
                }
                .subtotal-om-soma-row td:nth-child(1) {
                    text-align: right;
                    background-color: #D9D9D9 !important;
                }
                .subtotal-om-soma-row .col-nd-op-small {
                    background-color: #D9D9D9 !important;
                }
                
                /* Estilos para Subtotal OM - Linha 2 (Valor Total) */
                .subtotal-om-final-row {
                    font-weight: bold;
                    page-break-inside: avoid;
                    background-color: #E8E8E8;
                }
                .subtotal-om-final-row td {
                    border: 1px solid #000 !important;
                    padding: 3px 4px;
                }
                .subtotal-om-final-row td:nth-child(1) {
                    text-align: right;
                    background-color: #E8E8E8 !important;
                }
                .subtotal-om-final-row .col-nd-op-small {
                    background-color: #E8E8E8 !important;
                }
                
                /* Estilos para Total Geral */
                .total-geral-soma-row {
                    font-weight: bold;
                    page-break-inside: avoid;
                    background-color: #D9D9D9;
                }
                .total-geral-soma-row td {
                    border: 1px solid #000 !important;
                    padding: 3px 4px;
                }
                .total-geral-soma-row td:nth-child(1) {
                    text-align: right;
                    background-color: #D9D9D9 !important;
                }
                .total-geral-soma-row .col-nd-op-small {
                    background-color: #D9D9D9 !important;
                }
                
                .total-geral-final-row {
                    font-weight: bold;
                    page-break-inside: avoid;
                    background-color: #D9D9D9;
                }
                .total-geral-final-row td {
                    border: 1px solid #000 !important;
                    padding: 3px 4px;
                }
                .total-geral-final-row td:nth-child(1) {
                    text-align: right;
                    background-color: #D9D9D9 !important;
                }
                
                .total-geral-final-row .col-nd-op-small {
                    background-color: #D9D9D9 !important;
                }
                
                /* AJUSTE DE ALINHAMENTO DO RODAPÉ */
                .ptrab-footer { margin-top: 3rem; text-align: center; }
                .signature-block { margin-top: 4rem; display: inline-block; text-align: center; }
                
                /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
                @media print {
                    @page { size: A4 landscape; margin: 0.5cm; }
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                    .ptrab-table-op thead { display: table-row-group; break-inside: avoid; break-after: auto; }
                    .ptrab-table-op th, .ptrab-table-op td { border: 0.25pt solid #000 !important; } 
                    .ptrab-table-op { border: 0.25pt solid #000 !important; }
                    
                    .expense-row td:nth-child(2),
                    .expense-row td:nth-child(3),
                    .expense-row td:nth-child(4),
                    .expense-row td:nth-child(5),
                    .expense-row td:nth-child(6),
                    .expense-row td:nth-child(7),
                    .expense-row td:nth-child(8) {
                        vertical-align: middle !important;
                    }
                    
                    .expense-row .col-despesas-op {
                        vertical-align: middle !important;
                    }
                    
                    .expense-row .col-detalhamento-op {
                        vertical-align: top !important;
                    }
                    
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
                        background-color: #D9D9D9 !important;
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