"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { fetchPTrabData } from "@/lib/ptrabUtils";
import PageMetadata from "@/components/PageMetadata";
import { isGhostMode, GHOST_DATA } from "@/lib/ghostStore";

const PTrabReportManager = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    
    const [loading, setLoading] = useState(true);
    const [ptrab, setPtrab] = useState<any>(null);
    const [selectedReport, setSelectedReport] = useState("operacional");

    const loadData = useCallback(async () => {
        if (!ptrabId && !isGhostMode()) {
            toast.error("P Trab não identificado.");
            navigate('/ptrab');
            return;
        }

        setLoading(true);
        try {
            if (isGhostMode()) {
                setPtrab(GHOST_DATA.p_trab_exemplo);
            } else {
                const data = await fetchPTrabData(ptrabId!);
                setPtrab(data);
            }
        } catch (error) {
            console.error("Erro ao carregar relatório:", error);
            toast.error("Falha ao carregar dados do P Trab.");
        } finally {
            setLoading(false);
        }
    }, [ptrabId, navigate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const handleExportPDF = useCallback(() => {
        toast.info("Exportação para PDF em processamento...");
    }, []);

    const handleExportExcel = useCallback(() => {
        toast.info("Exportação para Excel em processamento...");
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Gerando relatórios...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 tour-report-manager-root">
            <PageMetadata 
                title="Central de Relatórios" 
                description="Visualize e exporte os anexos e documentos do seu Plano de Trabalho."
            />
            
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                    <Button variant="ghost" onClick={() => navigate(-1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>

                    <div className="flex items-center gap-2">
                        <Select value={selectedReport} onValueChange={setSelectedReport}>
                            <SelectTrigger className="w-[250px] tour-report-selector">
                                <SelectValue placeholder="Selecione o Relatório" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="operacional">Relatório Operacional</SelectItem>
                                <SelectItem value="logistico">Relatório Logístico</SelectItem>
                                <SelectItem value="dor">DOR - Ofício de Requisição</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="icon" onClick={handleExportPDF} className="btn-export-pdf" title="Exportar PDF">
                            <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleExportExcel} className="btn-export-excel" title="Exportar Excel">
                            <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button variant="default" onClick={handlePrint} className="btn-print">
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir
                        </Button>
                    </div>
                </div>

                <Card className="shadow-lg print:shadow-none print:border-none">
                    <CardHeader className="border-b bg-muted/30">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl">{ptrab?.numero_ptrab || "P Trab"}</CardTitle>
                                <p className="text-sm text-muted-foreground uppercase font-bold mt-1">
                                    {selectedReport === 'operacional' ? 'Anexo Operacional' : 
                                     selectedReport === 'logistico' ? 'Anexo Logístico' : 'DOR'}
                                </p>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                                <p>{ptrab?.nome_om}</p>
                                <p>{ptrab?.comando_militar_area}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="space-y-8">
                            <div className="text-center space-y-2">
                                <h2 className="text-lg font-bold uppercase">Plano de Trabalho - {ptrab?.nome_operacao}</h2>
                                <p className="text-sm">Período: {ptrab?.periodo_inicio} a {ptrab?.periodo_fim}</p>
                            </div>

                            <div className="border rounded-md p-4 bg-yellow-50/50 border-yellow-200 no-print">
                                <p className="text-sm text-yellow-800 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Visualização prévia do relatório. Use os botões acima para exportar a versão final.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold border-b pb-1">1. Resumo de Custos</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-right">Valor Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Logística (Classes I a IX)</TableCell>
                                            <TableCell className="text-right font-medium">R$ 0,00</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Operacional (Diárias, Passagens, etc)</TableCell>
                                            <TableCell className="text-right font-medium">R$ 0,00</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-muted/50 font-bold">
                                            <TableCell>TOTAL GERAL</TableCell>
                                            <TableCell className="text-right text-primary">R$ 0,00</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PTrabReportManager;