"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    ArrowLeft, 
    Printer, 
    FileText, 
    Loader2, 
    Download, 
    FileSpreadsheet,
    ChevronDown,
    FileCheck
} from "lucide-react";
import { toast } from "sonner";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import PageMetadata from "@/components/PageMetadata";
import { formatCurrency, formatCodug, calculateDays } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

// Tipos de relatório suportados
type ReportType = 'logistico' | 'operacional' | 'dor' | 'consolidado';

const PTrabReportManager = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const [reportType, setReportType] = useState<ReportType>('operacional');
    const [loading, setLoading] = useState(true);
    const [ptrabData, setPtrabData] = useState<any>(null);
    const [reportData, setReportData] = useState<any>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                if (isGhostMode()) {
                    setPtrabData(GHOST_DATA.p_trab_exemplo);
                    
                    // Simulação de dados para o relatório operacional
                    const ghostReport = {
                        material_consumo: [
                            {
                                id: "ghost-reg-1",
                                p_trab_id: "ghost-ptrab-123",
                                organizacao: "1º BIS",
                                ug: "160222",
                                om_detentora: "1º BIS",
                                ug_detentora: "160222",
                                dias_operacao: 15,
                                efetivo: 150,
                                fase_atividade: "Execução",
                                group_name: "MATERIAL DE CONSTRUÇÃO",
                                valor_total: 1250.50,
                                valor_nd_30: 1250.50,
                                valor_nd_39: 0,
                                // Adicionando itens_aquisicao para que a lógica de renderização funcione
                                itens_aquisicao: [
                                    {
                                        id: "ghost-item-cimento",
                                        descricao_item: "Cimento Portland CP II-Z-32, Resistência à Compressão 32 MPa, Saco 50kg",
                                        descricao_reduzida: "Cimento Portland 50kg",
                                        valor_unitario: 250.10,
                                        quantidade: 5,
                                        numero_pregao: "005/2025",
                                        uasg: "160222",
                                        codigo_catmat: "123456",
                                        nd: "30"
                                    }
                                ]
                            }
                        ],
                        // Outras categorias vazias para o tour
                        diarias: [],
                        passagens: [],
                        verba_operacional: [],
                        concessionarias: [],
                        horas_voo: [],
                        complemento_alimentacao: [],
                        servicos_terceiros: [],
                        material_permanente: []
                    };
                    
                    setReportData(ghostReport);
                } else {
                    if (!ptrabId) {
                        toast.error("P Trab não identificado.");
                        navigate('/ptrab');
                        return;
                    }

                    // Busca dados reais via RPC (ou múltiplas queries)
                    const { data: pData, error: pError } = await supabase
                        .from('p_trab')
                        .select('*')
                        .eq('id', ptrabId)
                        .single();

                    if (pError) throw pError;
                    setPtrabData(pData);

                    const { data: rData, error: rError } = await supabase
                        .rpc('get_ptrab_full_report_data', { p_ptrab_id: ptrabId });

                    if (rError) throw rError;
                    setReportData(rData);
                }
            } catch (error: any) {
                console.error("Erro ao carregar relatório:", error);
                toast.error("Falha ao carregar dados do relatório.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [ptrabId, navigate]);

    const handlePrint = () => {
        window.print();
    };

    // Helper para agrupar registros por OM e gerar as linhas da tabela operacional
    const getSortedRowsForOM = () => {
        if (!reportData) return [];
        
        const rows: any[] = [];
        const categories = [
            { key: 'material_consumo', label: 'MATERIAL DE CONSUMO' },
            { key: 'servicos_terceiros', label: 'SERVIÇOS DE TERCEIROS' },
            { key: 'material_permanente', label: 'MATERIAL PERMANENTE' },
            { key: 'diarias', label: 'DIÁRIAS' },
            { key: 'passagens', label: 'PASSAGENS' },
            { key: 'verba_operacional', label: 'VERBA OPERACIONAL' },
            { key: 'concessionarias', label: 'CONCESSIONÁRIAS' },
            { key: 'horas_voo', label: 'HORAS DE VOO' },
            { key: 'complemento_alimentacao', label: 'COMPLEMENTO ALIMENTAR' }
        ];

        categories.forEach(cat => {
            const data = reportData[cat.key] || [];
            data.forEach((reg: any) => {
                // Para Material de Consumo e outros que usam grupos de itens
                if (reg.itens_aquisicao && reg.itens_aquisicao.length > 0) {
                    const memoriaCalculo = reg.itens_aquisicao.map((item: any) => 
                        `${item.quantidade} ${item.descricao_reduzida || item.descricao_item} x ${formatCurrency(item.valor_unitario)}/unid. = ${formatCurrency(item.valor_unitario * item.quantidade)} (Pregão ${item.numero_pregao})`
                    ).join('; ');

                    rows.push({
                        categoria: `${cat.label} (${reg.group_name || 'Geral'})`,
                        om: reg.organizacao,
                        ug: reg.ug,
                        nd: reg.valor_nd_30 > 0 ? '33.90.30' : '33.90.39',
                        detalhe: `Referente a ${reg.group_name}. Fase: ${reg.fase_atividade}. Cálculo: ${memoriaCalculo}`,
                        valor: reg.valor_total
                    });
                } else if (cat.key === 'diarias') {
                   // Lógica simplificada para diárias no tour/exemplo
                   rows.push({
                       categoria: cat.label,
                       om: reg.organizacao,
                       ug: reg.ug,
                       nd: '33.90.14',
                       detalhe: reg.detalhamento_customizado || reg.detalhamento,
                       valor: reg.valor_total
                   });
                }
                // ... outras categorias ...
            });
        });

        return rows;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Gerando relatório...</p>
            </div>
        );
    }

    const rows = getSortedRowsForOM();
    const totalGeral = rows.reduce((acc, row) => acc + row.valor, 0);

    return (
        <div className="min-h-screen bg-muted/30 p-4 md:p-8 tour-report-manager-root">
            <PageMetadata title={`Relatório - ${ptrabData?.nome_operacao}`} description="Visualização e exportação de relatórios do P Trab." />
            
            <div className="max-w-6xl mx-auto space-y-6 print:space-y-0 print:p-0">
                {/* Header de Ações (Oculto na impressão) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background p-4 rounded-lg shadow-sm border print:hidden">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold">Gerenciador de Relatórios</h1>
                            <p className="text-sm text-muted-foreground">{ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                            <SelectTrigger className="w-[200px] tour-report-selector">
                                <SelectValue placeholder="Selecione o Anexo" />
                            </SelectTrigger>
                            <SelectContent className="z-tour-portal">
                                <SelectItem value="operacional">P Trab Operacional</SelectItem>
                                <SelectItem value="logistico">P Trab Logístico</SelectItem>
                                <SelectItem value="dor">DOR (Oficialização)</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="sm" onClick={handlePrint} className="btn-print">
                            <Printer className="h-4 w-4 mr-2" /> Imprimir
                        </Button>
                        <Button variant="outline" size="sm" className="btn-export-pdf">
                            <Download className="h-4 w-4 mr-2" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" className="btn-export-excel">
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                        </Button>
                    </div>
                </div>

                {/* Área do Relatório (Padrão A4) */}
                <Card className="bg-white shadow-xl mx-auto print:shadow-none print:border-none print:m-0 print:w-full overflow-hidden">
                    <CardContent className="p-8 md:p-12 print:p-0">
                        <div ref={reportRef} className="report-container font-serif text-black leading-tight">
                            
                            {/* Cabeçalho Oficial */}
                            <div className="text-center space-y-1 mb-8">
                                <p className="font-bold uppercase">Ministério da Defesa</p>
                                <p className="font-bold uppercase">Exército Brasileiro</p>
                                <p className="uppercase">{ptrabData?.comando_militar_area}</p>
                                <p className="uppercase">{ptrabData?.nome_om_extenso}</p>
                                <div className="pt-4">
                                    <h2 className="text-xl font-bold underline">PLANO DE TRABALHO OPERACIONAL</h2>
                                    <p className="font-bold">Nº {ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}</p>
                                </div>
                            </div>

                            {/* Informações Gerais */}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
                                <div><span className="font-bold">OM Amparada:</span> {ptrabData?.nome_om} ({formatCodug(ptrabData?.codug_om)})</div>
                                <div><span className="font-bold">RM Vinculação:</span> {ptrabData?.rm_vinculacao}</div>
                                <div><span className="font-bold">Período:</span> {new Date(ptrabData?.periodo_inicio).toLocaleDateString('pt-BR')} a {new Date(ptrabData?.periodo_fim).toLocaleDateString('pt-BR')} ({calculateDays(ptrabData?.periodo_inicio, ptrabData?.periodo_fim)} dias)</div>
                                <div><span className="font-bold">Efetivo:</span> {ptrabData?.efetivo_empregado}</div>
                            </div>

                            {/* Tabela de Custos (tabela 1023 style) */}
                            <div className="border-t-2 border-black pt-4">
                                <table className="w-full border-collapse border border-black text-[11px]">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black p-1 text-left w-[20%]">CATEGORIA / GRUPO</th>
                                            <th className="border border-black p-1 text-center w-[10%]">OM / UG</th>
                                            <th className="border border-black p-1 text-center w-[10%]">ND</th>
                                            <th className="border border-black p-1 text-left w-[45%]">DETALHAMENTO / MEMÓRIA DE CÁLCULO</th>
                                            <th className="border border-black p-1 text-right w-[15%]">VALOR (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length > 0 ? rows.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="border border-black p-1 align-top font-bold">{row.categoria}</td>
                                                <td className="border border-black p-1 align-top text-center">{row.om}<br/><span className="text-[9px]">{formatCodug(row.ug)}</span></td>
                                                <td className="border border-black p-1 align-top text-center">{row.nd}</td>
                                                <td className="border border-black p-1 align-top italic">{row.detalhe}</td>
                                                <td className="border border-black p-1 align-top text-right font-bold">{formatCurrency(row.valor)}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="border border-black p-4 text-center text-muted-foreground italic">Nenhum registro operacional detalhado para este Plano de Trabalho.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-200 font-bold">
                                            <td colSpan={4} className="border border-black p-2 text-right uppercase">Valor Total do Plano de Trabalho Operacional (GND 3):</td>
                                            <td className="border border-black p-2 text-right text-lg">{formatCurrency(totalGeral)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Assinaturas */}
                            <div className="mt-20 grid grid-cols-2 gap-20 text-center text-xs">
                                <div className="space-y-1">
                                    <div className="border-t border-black w-48 mx-auto pt-1"></div>
                                    <p className="font-bold">Responsável pelo Preenchimento</p>
                                    <p>Seção de Planejamento</p>
                                </div>
                                <div className="space-y-1">
                                    <div className="border-t border-black w-48 mx-auto pt-1"></div>
                                    <p className="font-bold">{ptrabData?.nome_cmt_om}</p>
                                    <p>Comandante / Ordenador de Despesas</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="text-center text-xs text-muted-foreground pb-8 print:hidden">
                    <p>Este documento é uma representação digital do Plano de Trabalho para conferência técnica.</p>
                </div>
            </div>
        </div>
    );
};

export default PTrabReportManager;