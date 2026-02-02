import React, { useMemo, useRef } from 'react';
import { ArrowLeft, Loader2, Download, Printer, Droplet, Zap, FileText, Plane } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug, formatDate } from "@/lib/formatUtils";
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro } from "@/pages/PTrabReportManager";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { 
    generateConsolidatedPassagemMemoriaCalculo,
    ConsolidatedPassagemRecord,
} from "@/lib/passagemUtils";
import { 
    ConcessionariaRegistroComDiretriz,
    generateConsolidatedConcessionariaMemoriaCalculo,
    ConsolidatedConcessionariaRecord,
} from "@/lib/concessionariaUtils";

// =================================================================
// TIPOS AUXILIARES
// =================================================================

interface PTrabOperacionalReportProps {
    ptrabData: PTrabData;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: ConcessionariaRegistroComDiretriz[];
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    fileSuffix: string;
    generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
    generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string;
    generateConcessionariaMemoriaCalculo: (registro: ConcessionariaRegistroComDiretriz) => string;
}

// =================================================================
// COMPONENTE
// =================================================================

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
    const navigate = useNavigate();
    const reportRef = useRef<HTMLDivElement>(null);

    // =================================================================
    // AGRUPAMENTO E CÁLCULOS
    // =================================================================

    // 1. Totais de Diária (ND 33.90.15 e ND 33.90.30)
    const totalDiariaND15 = registrosDiaria.reduce((sum, r) => sum + Number(r.valor_nd_15 || 0), 0);
    const totalDiariaND30 = registrosDiaria.reduce((sum, r) => sum + Number(r.valor_nd_30 || 0), 0);
    const totalDiaria = totalDiariaND15 + totalDiariaND30;
    
    // 2. Totais de Verba Operacional (ND 33.90.30 e ND 33.90.39)
    const totalVerbaOperacionalND30 = registrosVerbaOperacional.reduce((sum, r) => sum + Number(r.valor_nd_30 || 0), 0);
    const totalVerbaOperacionalND39 = registrosVerbaOperacional.reduce((sum, r) => sum + Number(r.valor_nd_39 || 0), 0);
    const totalVerbaOperacional = totalVerbaOperacionalND30 + totalVerbaOperacionalND39;
    
    // 3. Totais de Suprimento de Fundos (ND 33.90.30 e ND 33.90.39)
    const totalSuprimentoFundosND30 = registrosSuprimentoFundos.reduce((sum, r) => sum + Number(r.valor_nd_30 || 0), 0);
    const totalSuprimentoFundosND39 = registrosSuprimentoFundos.reduce((sum, r) => sum + Number(r.valor_nd_39 || 0), 0);
    const totalSuprimentoFundos = totalSuprimentoFundosND30 + totalSuprimentoFundosND39;
    
    // 4. Totais de Passagem (ND 33.90.33)
    const totalPassagemND33 = registrosPassagem.reduce((sum, r) => sum + Number(r.valor_nd_33 || 0), 0);
    
    // 5. Totais de Concessionária (ND 33.90.39)
    const totalConcessionariaND39 = registrosConcessionaria.reduce((sum, r) => sum + Number(r.valor_nd_39 || 0), 0);
    const totalConcessionariaAgua = registrosConcessionaria
        .filter(r => r.categoria === 'Água/Esgoto')
        .reduce((sum, r) => sum + Number(r.valor_nd_39 || 0), 0);
    const totalConcessionariaEnergia = registrosConcessionaria
        .filter(r => r.categoria === 'Energia Elétrica')
        .reduce((sum, r) => sum + Number(r.valor_nd_39 || 0), 0);

    // Total Geral Operacional
    const totalOperacional = totalDiaria + totalVerbaOperacional + totalSuprimentoFundos + totalPassagemND33 + totalConcessionariaND39;
    
    // Totais por ND
    const totalND30 = totalDiariaND30 + totalVerbaOperacionalND30 + totalSuprimentoFundosND30;
    const totalND33 = totalPassagemND33;
    const totalND39 = totalVerbaOperacionalND39 + totalSuprimentoFundosND39 + totalConcessionariaND39;

    // NOVO MEMO: Consolida registros de Passagem por lote de solicitação
    const consolidatedPassagemRecords = useMemo(() => {
        if (!registrosPassagem) return [];

        const groups = registrosPassagem.reduce((acc, registro) => {
            const key = [
                registro.organizacao,
                registro.ug,
                registro.om_detentora,
                registro.ug_detentora,
                registro.dias_operacao,
                registro.efetivo,
                registro.fase_atividade,
            ].join('|');

            if (!acc[key]) {
                acc[key] = {
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora,
                    ug_detentora: registro.ug_detentora,
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo || 0,
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND33: 0,
                } as ConsolidatedPassagemRecord;
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND33 += Number(registro.valor_nd_33 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedPassagemRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registrosPassagem]);
    
    // NOVO MEMO: Consolida registros de Concessionária por lote de solicitação
    const consolidatedConcessionariaRecords = useMemo(() => {
        if (!registrosConcessionaria) return [];

        const groups = registrosConcessionaria.reduce((acc, registro) => {
            // Chave de consolidação: todos os campos que definem o lote de solicitação
            const key = [
                registro.organizacao,
                registro.ug,
                registro.om_detentora,
                registro.ug_detentora,
                registro.dias_operacao,
                registro.efetivo,
                registro.fase_atividade,
            ].join('|');

            if (!acc[key]) {
                acc[key] = {
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora || '',
                    ug_detentora: registro.ug_detentora || '',
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo || 0,
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND39: 0,
                } as ConsolidatedConcessionariaRecord;
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedConcessionariaRecord>);

        // Ordenar por OM
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registrosConcessionaria]);


    // =================================================================
    // RENDERIZAÇÃO DO CONTEÚDO
    // =================================================================

    const renderReportContent = () => {
        if (totalOperacional === 0) {
            return (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum registro operacional encontrado para este P Trab.</p>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                
                {/* 1. PAGAMENTO DE DIÁRIAS (ND 33.90.15 e ND 33.90.30) */}
                {totalDiaria > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-1">
                            1. PAGAMENTO DE DIÁRIAS (ND 33.90.15 e ND 33.90.30)
                        </h3>
                        
                        {/* Tabela de Resumo */}
                        <Table className="w-full text-sm border border-gray-300">
                            <TableHeader className="bg-gray-100">
                                <TableRow>
                                    <TableHead className="w-[30%] font-bold text-gray-700">OM Favorecida</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Posto/Graduação</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Quantidade</TableHead>
                                    <TableHead className="w-[30%] text-right font-bold text-gray-700">Valor Total (R$)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrosDiaria.map((registro, index) => (
                                    <TableRow key={index} className="even:bg-gray-50">
                                        <TableCell className="font-medium">
                                            {registro.organizacao} ({formatCodug(registro.ug)})
                                        </TableCell>
                                        <TableCell className="text-center">{registro.posto_graduacao || 'Diversos'}</TableCell>
                                        <TableCell className="text-center">{registro.quantidade}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(registro.valor_total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-200 font-bold">
                                    <TableCell colSpan={3} className="text-right">TOTAL GERAL DIÁRIAS</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalDiaria)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        
                        {/* Detalhamento da Memória de Cálculo */}
                        <div className="space-y-3 pt-4">
                            <h4 className="text-base font-bold text-gray-800">Memória de Cálculo (Diárias)</h4>
                            {registrosDiaria.map((registro, index) => (
                                <div key={index} className="border p-3 rounded-md bg-white shadow-sm">
                                    <h5 className="font-semibold text-sm mb-2">
                                        {registro.organizacao} ({registro.posto_graduacao || 'Diversos'}) - {registro.destino}
                                    </h5>
                                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                                        {generateDiariaMemoriaCalculo(registro, diretrizesOperacionais)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 2. AQUISIÇÃO DE PASSAGENS (ND 33.90.33) */}
                {totalPassagemND33 > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-1">
                            2. AQUISIÇÃO DE PASSAGENS (ND 33.90.33)
                        </h3>
                        
                        {/* Tabela de Resumo */}
                        <Table className="w-full text-sm border border-gray-300">
                            <TableHeader className="bg-gray-100">
                                <TableRow>
                                    <TableHead className="w-[30%] font-bold text-gray-700">OM Favorecida</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Efetivo</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Total Passagens</TableHead>
                                    <TableHead className="w-[30%] text-right font-bold text-gray-700">Valor Total (R$)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {consolidatedPassagemRecords.map((group, index) => (
                                    <TableRow key={index} className="even:bg-gray-50">
                                        <TableCell className="font-medium">
                                            {group.organizacao} ({formatCodug(group.ug)})
                                        </TableCell>
                                        <TableCell className="text-center">{group.efetivo}</TableCell>
                                        <TableCell className="text-center">
                                            {group.records.reduce((sum, r) => sum + r.quantidade_passagens, 0)}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(group.totalGeral)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-200 font-bold">
                                    <TableCell colSpan={3} className="text-right">TOTAL GERAL PASSAGENS (ND 33.90.33)</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalPassagemND33)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        
                        {/* Detalhamento da Memória de Cálculo */}
                        <div className="space-y-3 pt-4">
                            <h4 className="text-base font-bold text-gray-800">Memória de Cálculo (Passagens)</h4>
                            {consolidatedPassagemRecords.map((group, index) => (
                                <div key={index} className="border p-3 rounded-md bg-white shadow-sm">
                                    <h5 className="font-semibold text-sm mb-2">
                                        Lote: {group.organizacao} ({formatCodug(group.ug)})
                                    </h5>
                                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                                        {generateConsolidatedPassagemMemoriaCalculo(group)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 3. VERBA OPERACIONAL (ND 33.90.30 e ND 33.90.39) */}
                {totalVerbaOperacional > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-1">
                            3. VERBA OPERACIONAL (ND 33.90.30 e ND 33.90.39)
                        </h3>
                        
                        {/* Tabela de Resumo */}
                        <Table className="w-full text-sm border border-gray-300">
                            <TableHeader className="bg-gray-100">
                                <TableRow>
                                    <TableHead className="w-[30%] font-bold text-gray-700">OM Favorecida</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Equipes</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Dias</TableHead>
                                    <TableHead className="w-[30%] text-right font-bold text-gray-700">Valor Total (R$)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrosVerbaOperacional.map((registro, index) => (
                                    <TableRow key={index} className="even:bg-gray-50">
                                        <TableCell className="font-medium">
                                            {registro.organizacao} ({formatCodug(registro.ug)})
                                        </TableCell>
                                        <TableCell className="text-center">{registro.quantidade_equipes}</TableCell>
                                        <TableCell className="text-center">{registro.dias_operacao}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(registro.valor_total_solicitado)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-200 font-bold">
                                    <TableCell colSpan={3} className="text-right">TOTAL GERAL VERBA OPERACIONAL</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalVerbaOperacional)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        
                        {/* Detalhamento da Memória de Cálculo */}
                        <div className="space-y-3 pt-4">
                            <h4 className="text-base font-bold text-gray-800">Memória de Cálculo (Verba Operacional)</h4>
                            {registrosVerbaOperacional.map((registro, index) => (
                                <div key={index} className="border p-3 rounded-md bg-white shadow-sm">
                                    <h5 className="font-semibold text-sm mb-2">
                                        {registro.organizacao} ({formatCodug(registro.ug)})
                                    </h5>
                                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                                        {generateVerbaOperacionalMemoriaCalculo(registro)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 4. SUPRIMENTO DE FUNDOS (ND 33.90.30 e ND 33.90.39) */}
                {totalSuprimentoFundos > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-1">
                            4. SUPRIMENTO DE FUNDOS (ND 33.90.30 e ND 33.90.39)
                        </h3>
                        
                        {/* Tabela de Resumo */}
                        <Table className="w-full text-sm border border-gray-300">
                            <TableHeader className="bg-gray-100">
                                <TableRow>
                                    <TableHead className="w-[30%] font-bold text-gray-700">OM Favorecida</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Efetivo</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Dias</TableHead>
                                    <TableHead className="w-[30%] text-right font-bold text-gray-700">Valor Total (R$)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrosSuprimentoFundos.map((registro, index) => (
                                    <TableRow key={index} className="even:bg-gray-50">
                                        <TableCell className="font-medium">
                                            {registro.organizacao} ({formatCodug(registro.ug)})
                                        </TableCell>
                                        <TableCell className="text-center">{registro.efetivo}</TableCell>
                                        <TableCell className="text-center">{registro.dias_operacao}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(registro.valor_total_solicitado)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-200 font-bold">
                                    <TableCell colSpan={3} className="text-right">TOTAL GERAL SUPRIMENTO DE FUNDOS</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalSuprimentoFundos)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        
                        {/* Detalhamento da Memória de Cálculo */}
                        <div className="space-y-3 pt-4">
                            <h4 className="text-base font-bold text-gray-800">Memória de Cálculo (Suprimento de Fundos)</h4>
                            {registrosSuprimentoFundos.map((registro, index) => (
                                <div key={index} className="border p-3 rounded-md bg-white shadow-sm">
                                    <h5 className="font-semibold text-sm mb-2">
                                        {registro.organizacao} ({formatCodug(registro.ug)})
                                    </h5>
                                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                                        {generateSuprimentoFundosMemoriaCalculo(registro)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 5. PAGAMENTO DE CONCESSIONÁRIAS (ND 33.90.39) */}
                {totalConcessionariaND39 > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-1">
                            5. PAGAMENTO DE CONCESSIONÁRIAS (ND 33.90.39)
                        </h3>
                        
                        {/* Tabela de Resumo */}
                        <Table className="w-full text-sm border border-gray-300">
                            <TableHeader className="bg-gray-100">
                                <TableRow>
                                    <TableHead className="w-[30%] font-bold text-gray-700">OM Favorecida</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Período (Dias)</TableHead>
                                    <TableHead className="w-[20%] text-center font-bold text-gray-700">Efetivo</TableHead>
                                    <TableHead className="w-[30%] text-right font-bold text-gray-700">Valor Total (R$)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {consolidatedConcessionariaRecords.map((group, index) => (
                                    <TableRow key={index} className="even:bg-gray-50">
                                        <TableCell className="font-medium">
                                            {group.organizacao} ({formatCodug(group.ug)})
                                        </TableCell>
                                        <TableCell className="text-center">{group.dias_operacao}</TableCell>
                                        <TableCell className="text-center">{group.efetivo}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(group.totalGeral)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-gray-200 font-bold">
                                    <TableCell colSpan={3} className="text-right">TOTAL GERAL CONCESSIONÁRIA (ND 33.90.39)</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalConcessionariaND39)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        
                        {/* Detalhamento da Memória de Cálculo */}
                        <div className="space-y-3 pt-4">
                            <h4 className="text-base font-bold text-gray-800">Memória de Cálculo (Concessionária)</h4>
                            {consolidatedConcessionariaRecords.map((group, index) => (
                                <div key={index} className="border p-3 rounded-md bg-white shadow-sm">
                                    <h5 className="font-semibold text-sm mb-2">
                                        Lote: {group.organizacao} ({formatCodug(group.ug)})
                                    </h5>
                                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                                        {generateConsolidatedConcessionariaMemoriaCalculo(group)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabela de Resumo Final */}
                <div className="pt-8">
                    <h3 className="text-lg font-bold text-gray-800 border-b pb-1 mb-4">
                        RESUMO ORÇAMENTÁRIO OPERACIONAL (GND 3)
                    </h3>
                    <Table className="w-full text-sm border border-gray-300">
                        <TableHeader className="bg-gray-100">
                            <TableRow>
                                <TableHead className="w-[40%] font-bold text-gray-700">Item</TableHead>
                                <TableHead className="w-[15%] text-center font-bold text-gray-700">ND</TableHead>
                                <TableHead className="w-[15%] text-right font-bold text-gray-700">ND 33.90.30 (R$)</TableHead>
                                <TableHead className="w-[15%] text-right font-bold text-gray-700">ND 33.90.39 (R$)</TableHead>
                                <TableHead className="w-[15%] text-right font-bold text-gray-700">Total (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Linha Diárias */}
                            <TableRow className="text-sm">
                                <TableCell className="font-medium flex items-center gap-2">
                                    Pagamento de Diárias
                                </TableCell>
                                <TableCell className="text-center">ND 33.90.15 / 30</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalDiariaND30)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalDiaria)}</TableCell>
                            </TableRow>
                            
                            {/* Linha Passagens */}
                            <TableRow className="text-sm">
                                <TableCell className="font-medium flex items-center gap-2">
                                    <Plane className="h-4 w-4 text-blue-500" />
                                    Aquisição de Passagens
                                </TableCell>
                                <TableCell className="text-center">ND 33.90.33</TableCell>
                                <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalPassagemND33)}</TableCell>
                            </TableRow>

                            {/* Linha Verba Operacional */}
                            <TableRow className="text-sm">
                                <TableCell className="font-medium flex items-center gap-2">
                                    Verba Operacional
                                </TableCell>
                                <TableCell className="text-center">ND 33.90.30 / 39</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalVerbaOperacionalND30)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalVerbaOperacionalND39)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalVerbaOperacional)}</TableCell>
                            </TableRow>
                            
                            {/* Linha Suprimento de Fundos */}
                            <TableRow className="text-sm">
                                <TableCell className="font-medium flex items-center gap-2">
                                    Suprimento de Fundos
                                </TableCell>
                                <TableCell className="text-center">ND 33.90.30 / 39</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalSuprimentoFundosND30)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalSuprimentoFundosND39)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalSuprimentoFundos)}</TableCell>
                            </TableRow>
                            
                            {/* Linha Concessionária */}
                            <TableRow className="text-sm">
                                <TableCell className="font-medium flex items-center gap-2">
                                    <Droplet className="h-4 w-4 text-blue-500" />
                                    Pagamento de Concessionárias
                                </TableCell>
                                <TableCell className="text-center">ND 33.90.39</TableCell>
                                <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalConcessionariaND39)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalConcessionariaND39)}</TableCell>
                            </TableRow>

                            {/* Linha Total */}
                            <TableRow className="bg-gray-200 font-bold text-base">
                                <TableCell colSpan={2} className="text-right">TOTAL GERAL OPERACIONAL</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalND30)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalND39)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(totalOperacional)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    };

    const handleExportPDF = async () => {
        if (!reportRef.current) return;

        const pdfToast = toast({
            title: "Gerando PDF...",
            description: "Aguarde enquanto o relatório é processado.",
        });

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            
            // A4 em Paisagem: 297mm (largura) x 210mm (altura)
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

            pdf.save(`P Trab ${ptrabData.numero_ptrab} - ${fileSuffix}.pdf`);
            pdfToast.dismiss();
            toast({
                title: "PDF Exportado!",
                description: "O relatório operacional foi salvo com sucesso.",
                duration: 3000,
            });
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            pdfToast.dismiss();
            toast({
                title: "Erro na Exportação",
                description: "Não foi possível gerar o PDF. Tente novamente.",
                variant: "destructive",
            });
        }
    };

    const handleExportExcel = async () => {
        if (totalOperacional === 0) {
            toast({ title: "Aviso", description: "Não há dados operacionais para exportar.", variant: "default" });
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resumo Operacional');

        // ... (Lógica de exportação Excel simplificada para o resumo)
        
        worksheet.columns = [
            { width: 40 }, // Item
            { width: 15 }, // ND
            { width: 20 }, // ND 30
            { width: 20 }, // ND 39
            { width: 20 }, // Total
        ];

        let currentRow = 1;
        
        const addTitle = (text: string, size: number = 11, bold: boolean = true) => {
            const row = worksheet.getRow(currentRow);
            row.getCell(1).value = text;
            row.getCell(1).font = { name: 'Arial', size, bold };
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
            currentRow++;
        };

        addTitle('PLANO DE TRABALHO OPERACIONAL', 12);
        addTitle(`${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}`, 10);
        addTitle(`OM: ${ptrabData.nome_om_extenso} (${ptrabData.nome_om})`, 9);
        addTitle(`Período: ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)}`, 9);
        currentRow++;
        
        addTitle('RESUMO ORÇAMENTÁRIO OPERACIONAL (GND 3)', 10, true);
        currentRow++;

        const headerRow = worksheet.getRow(currentRow);
        headerRow.values = ['Item', 'ND', 'ND 33.90.30 (R$)', 'ND 33.90.39 (R$)', 'Total (R$)'];
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 9, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        });
        currentRow++;

        const addDataRow = (item: string, nd: string, nd30: number, nd39: number, total: number, isTotal: boolean = false) => {
            const row = worksheet.getRow(currentRow);
            row.getCell(1).value = item;
            row.getCell(2).value = nd;
            row.getCell(3).value = total === 0 ? '' : nd30;
            row.getCell(4).value = total === 0 ? '' : nd39;
            row.getCell(5).value = total === 0 ? '' : total;

            row.eachCell((cell, colNumber) => {
                cell.font = { name: 'Arial', size: 9, bold: isTotal };
                cell.alignment = colNumber === 1 ? { horizontal: 'left', vertical: 'middle' } : { horizontal: 'right', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (colNumber >= 3 && total !== 0) {
                    cell.numFmt = 'R$ #,##0.00';
                }
                if (isTotal) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
                }
            });
            currentRow++;
        };

        // Linhas de Dados
        addDataRow('Pagamento de Diárias', 'ND 33.90.15 / 30', totalDiariaND30, 0, totalDiaria);
        addDataRow('Aquisição de Passagens', 'ND 33.90.33', 0, 0, totalPassagemND33);
        addDataRow('Verba Operacional', 'ND 33.90.30 / 39', totalVerbaOperacionalND30, totalVerbaOperacionalND39, totalVerbaOperacional);
        addDataRow('Suprimento de Fundos', 'ND 33.90.30 / 39', totalSuprimentoFundosND30, totalSuprimentoFundosND39, totalSuprimentoFundos);
        addDataRow('Pagamento de Concessionárias', 'ND 33.90.39', 0, totalConcessionariaND39, totalConcessionariaND39);

        // Linha Total
        addDataRow('TOTAL GERAL OPERACIONAL', '', totalND30, totalND39, totalOperacional, true);

        // Exportar
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `P Trab ${ptrabData.numero_ptrab} - ${fileSuffix}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        toast({
            title: "Excel Exportado!",
            description: "O resumo operacional foi salvo com sucesso.",
            duration: 3000,
        });
    };

    return (
        <Card className="shadow-lg print:shadow-none">
            <CardHeader className="print:hidden">
                <CardTitle className="text-2xl">Relatório Operacional</CardTitle>
                <p className="text-muted-foreground">
                    {ptrabData.numero_ptrab} - {ptrabData.nome_operacao}
                </p>
                <div className="flex gap-3 pt-2">
                    <Button onClick={handleExportPDF} disabled={totalOperacional === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar PDF
                    </Button>
                    <Button onClick={handleExportExcel} disabled={totalOperacional === 0} variant="outline">
                        <FileText className="mr-2 h-4 w-4" />
                        Exportar Excel
                    </Button>
                    <Button onClick={() => window.print()} variant="secondary">
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6 print:p-0">
                <div ref={reportRef} className="report-container space-y-6">
                    {/* Cabeçalho de Impressão */}
                    <div className="hidden print:block text-center mb-6">
                        <h1 className="text-xl font-bold">PLANO DE TRABALHO OPERACIONAL</h1>
                        <h2 className="text-lg font-semibold">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</h2>
                        <p className="text-sm mt-1">OM: {ptrabData.nome_om_extenso} ({ptrabData.nome_om})</p>
                        <p className="text-sm">Período: {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)}</p>
                    </div>
                    
                    {renderReportContent()}
                </div>
            </CardContent>
        </Card>
    );
};

export default PTrabOperacionalReport;