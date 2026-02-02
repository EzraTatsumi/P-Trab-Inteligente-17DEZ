import React, { useMemo } from 'react';
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro, generateDiariaMemoriaCalculoUnificada, generateVerbaOperacionalMemoriaCalculada, generateSuprimentoFundosMemoriaCalculada, generatePassagemMemoriaCalculada, generateConcessionariaMemoriaCalculada, calculateDays, formatDate, formatFasesParaTexto } from '@/pages/PTrabReportManager';
import { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { Printer, Briefcase, FileText, Users, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OperacionalReportProps {
    ptrabData: PTrabData;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: ConcessionariaRegistro[];
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    fileSuffix: string;
    generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
    generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string;
    generateConcessionariaMemoriaCalculo: (registro: ConcessionariaRegistro) => string;
}

const PTrabOperacionalReport: React.FC<OperacionalReportProps> = ({
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
    const totalGND3 = useMemo(() => {
        const totalDiariaND30 = registrosDiaria.reduce((sum, r) => sum + r.valor_nd_30, 0);
        const totalVerbaND30 = registrosVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_30, 0);
        const totalSuprimentoND30 = registrosSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_30, 0);
        return totalDiariaND30 + totalVerbaND30 + totalSuprimentoND30;
    }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos]);

    const totalGND4 = useMemo(() => {
        const totalDiariaND15 = registrosDiaria.reduce((sum, r) => sum + r.valor_nd_15, 0);
        return totalDiariaND15;
    }, [registrosDiaria]);

    const totalGND39 = useMemo(() => {
        const totalVerbaND39 = registrosVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_39, 0);
        const totalSuprimentoND39 = registrosSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_39, 0);
        const totalConcessionariaND39 = registrosConcessionaria.reduce((sum, r) => sum + r.valor_nd_39, 0);
        return totalVerbaND39 + totalSuprimentoND39 + totalConcessionariaND39;
    }, [registrosVerbaOperacional, registrosSuprimentoFundos, registrosConcessionaria]);

    const totalGND33 = useMemo(() => {
        return registrosPassagem.reduce((sum, r) => sum + r.valor_nd_33, 0);
    }, [registrosPassagem]);

    const totalGeral = totalGND3 + totalGND4 + totalGND39 + totalGND33;

    const handlePrint = () => {
        window.print();
    };

    const renderRegistros = (
        registros: (DiariaRegistro | VerbaOperacionalRegistro | PassagemRegistro | ConcessionariaRegistro)[],
        title: string,
        ndField: 'valor_nd_15' | 'valor_nd_30' | 'valor_nd_33' | 'valor_nd_39',
        memoriaGenerator: (registro: any, diretrizesOp?: Tables<'diretrizes_operacionais'> | null) => string,
        isDiaria: boolean = false
    ) => {
        if (registros.length === 0) return null;

        const totalND = registros.reduce((sum, r) => sum + (r as any)[ndField], 0);

        return (
            <div className="space-y-4 break-inside-avoid-page">
                <h3 className="text-xl font-bold text-primary border-b pb-2 mt-6">{title}</h3>
                
                {registros.map((registro, index) => {
                    const omDetentora = (registro as any).om_detentora || registro.organizacao;
                    const ugDetentora = (registro as any).ug_detentora || registro.ug;
                    const valorTotal = (registro as any).valor_total_solicitado !== undefined 
                        ? (registro as VerbaOperacionalRegistro).valor_total_solicitado
                        : (registro as any).valor_total;
                    
                    const memoria = isDiaria 
                        ? memoriaGenerator(registro, diretrizesOperacionais)
                        : memoriaGenerator(registro);

                    return (
                        <Card key={index} className="shadow-sm border-l-4 border-blue-500">
                            <CardHeader className="p-3 pb-1">
                                <CardTitle className="text-base font-semibold flex justify-between items-center">
                                    <span>{omDetentora} (UG: {formatCodug(ugDetentora)})</span>
                                    <span className="text-sm text-muted-foreground">
                                        {registro.fase_atividade ? `Fase: ${registro.fase_atividade}` : 'Fase: Operação'}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-1">
                                <div className="text-sm font-medium mb-2">
                                    Valor Total: <span className="text-blue-600">{formatCurrency(valorTotal)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mb-2">
                                    ND {ndField.split('_')[2]}: {formatCurrency((registro as any)[ndField])}
                                </div>
                                <Separator className="my-2" />
                                <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border border-dashed">
                                    {memoria}
                                </pre>
                            </CardContent>
                        </Card>
                    );
                })}

                <div className="flex justify-end font-bold text-lg pt-2 border-t border-dashed">
                    Total {title} (ND {ndField.split('_')[2]}): {formatCurrency(totalND)}
                </div>
            </div>
        );
    };

    return (
        <div className="report-container space-y-6">
            <div className="print:hidden flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Briefcase className="h-6 w-6 text-blue-500" />
                    Relatório Operacional
                </h2>
                <Button onClick={handlePrint} className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Imprimir/Exportar PDF
                </Button>
            </div>

            {/* Cabeçalho do P Trab */}
            <Card className="shadow-lg print:shadow-none print:border-2">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{ptrabData.nome_operacao}</CardTitle>
                    <p className="text-lg font-medium">{ptrabData.numero_ptrab}</p>
                    <p className="text-sm text-muted-foreground">
                        {ptrabData.nome_om_extenso} ({ptrabData.nome_om})
                    </p>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Período: {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} ({calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim)} dias)
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Efetivo: {ptrabData.efetivo_empregado}
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Local: {ptrabData.local_om}
                    </div>
                </CardContent>
            </Card>

            <h2 className="text-2xl font-bold border-b pb-2 mt-8">Resumo Financeiro Operacional</h2>
            <div className="grid grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-500 border-l-4">
                    <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-sm font-medium">ND 33.90.15 (Diárias)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalGND4)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-500 border-l-4">
                    <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-sm font-medium">ND 33.90.30 (Custeio)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalGND3)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-500 border-l-4">
                    <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-sm font-medium">ND 33.90.33 (Passagens)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalGND33)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-500 border-l-4">
                    <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-1">
                        <CardTitle className="text-sm font-medium">ND 33.90.39 (Serviços)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalGND39)}</div>
                    </CardContent>
                </Card>
            </div>
            <div className="flex justify-end font-bold text-2xl pt-4 border-t-2 border-primary">
                Total Geral Operacional: {formatCurrency(totalGeral)}
            </div>

            <h2 className="text-2xl font-bold border-b pb-2 mt-8">Memória de Cálculo Detalhada</h2>

            {/* 1. Diárias (ND 33.90.15 e 33.90.30) */}
            {renderRegistros(
                registrosDiaria,
                "Diárias (ND 33.90.15 e 33.90.30)",
                'valor_total' as any, // Usamos valor_total aqui, mas a memória detalha as NDs
                generateDiariaMemoriaCalculo as any,
                true
            )}

            {/* 2. Passagens (ND 33.90.33) */}
            {renderRegistros(
                registrosPassagem,
                "Passagens (ND 33.90.33)",
                'valor_nd_33',
                generatePassagemMemoriaCalculo as any
            )}

            {/* 3. Verba Operacional (ND 33.90.30 e 33.90.39) */}
            {renderRegistros(
                registrosVerbaOperacional,
                "Verba Operacional (ND 33.90.30 e 33.90.39)",
                'valor_total_solicitado' as any,
                generateVerbaOperacionalMemoriaCalculo as any
            )}

            {/* 4. Suprimento de Fundos (ND 33.90.30 e 33.90.39) */}
            {renderRegistros(
                registrosSuprimentoFundos,
                "Suprimento de Fundos (ND 33.90.30 e 33.90.39)",
                'valor_total_solicitado' as any,
                generateSuprimentoFundosMemoriaCalculo as any
            )}
            
            {/* 5. Concessionárias (ND 33.90.39) - USANDO MEMÓRIA INDIVIDUAL */}
            {renderRegistros(
                registrosConcessionaria,
                "Pagamento de Concessionárias (ND 33.90.39)",
                'valor_nd_39',
                generateConcessionariaMemoriaCalculo as any
            )}

            {/* Espaço para quebra de página no final */}
            <div className="h-16 print:h-0"></div>
        </div>
    );
};

export default PTrabOperacionalReport;