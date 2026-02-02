import React, { useMemo } from 'react';
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro, GrupoOM } from '@/pages/PTrabReportManager';
import { Tables } from '@/integrations/supabase/types';
import { formatCurrency, formatNumber } from '@/lib/formatUtils';
import { Briefcase, Plane, Utensils, MessageSquare, Users, DollarSign } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// =================================================================
// TIPOS DE PROPS
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
    generateDiariaMemoriaCalculo: (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
    generateVerbaOperacionalMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generateSuprimentoFundosMemoriaCalculo: (registro: VerbaOperacionalRegistro) => string;
    generatePassagemMemoriaCalculo: (registro: PassagemRegistro) => string;
    generateConcessionariaMemoriaCalculo: (registro: ConcessionariaRegistro) => string;
    // PROPS PARA AGRUPAMENTO E ORDENAÇÃO
    omsOrdenadas: string[];
    gruposPorOM: Record<string, GrupoOM>;
}

// =================================================================
// COMPONENTES AUXILIARES DE RENDERIZAÇÃO DE TABELA
// =================================================================

interface TableSectionProps {
    title: string;
    icon: React.FC<any>;
    data: any[];
    columns: { key: string; label: string; className?: string }[];
    renderRow: (item: any, index: number) => React.ReactNode;
    totalND15?: number;
    totalND30?: number;
    totalND33?: number;
    totalND39?: number;
    totalGeral: number;
}

const TableSection: React.FC<TableSectionProps> = ({ title, icon: Icon, data, columns, renderRow, totalND15 = 0, totalND30 = 0, totalND33 = 0, totalND39 = 0, totalGeral }) => {
    if (data.length === 0) return null;

    return (
        <div className="mb-6 print:mb-3">
            <h4 className="text-base font-semibold mb-2 flex items-center gap-2 text-blue-700 print:text-sm print:font-bold">
                <Icon className="h-4 w-4" />
                {title}
            </h4>
            <Table className="w-full border-collapse border border-gray-300 print:border-gray-300">
                <TableHeader className="bg-gray-100 print:bg-gray-100">
                    <TableRow className="border-b border-gray-300 print:border-gray-300">
                        {columns.map(col => (
                            <TableHead key={col.key} className={`text-xs font-bold text-gray-600 uppercase py-2 px-2 print:text-[10px] print:py-1 ${col.className}`}>
                                {col.label}
                            </TableHead>
                        ))}
                        <TableHead className="text-xs font-bold text-gray-600 uppercase text-center w-[100px] print:text-[10px] print:py-1">Memória</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(renderRow)}
                    <TableRow className="bg-blue-50/50 font-bold border-t border-blue-200 print:bg-blue-50 print:border-blue-200">
                        <TableCell colSpan={columns.length} className="text-right text-sm py-2 px-2 print:text-[10px] print:py-1">
                            Total da Seção:
                        </TableCell>
                        <TableCell className="text-right text-sm py-2 px-2 print:text-[10px] print:py-1">
                            {formatCurrency(totalGeral)}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
            <div className="mt-1 text-xs text-right text-gray-600 print:text-[9px] print:mt-0">
                {totalND15 > 0 && <span className="mr-4">ND 33.90.15: {formatCurrency(totalND15)}</span>}
                {totalND30 > 0 && <span className="mr-4">ND 33.90.30: {formatCurrency(totalND30)}</span>}
                {totalND33 > 0 && <span className="mr-4">ND 33.90.33: {formatCurrency(totalND33)}</span>}
                {totalND39 > 0 && <span>ND 33.90.39: {formatCurrency(totalND39)}</span>}
            </div>
        </div>
    );
};

// =================================================================
// COMPONENTE PRINCIPAL
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
    omsOrdenadas,
    gruposPorOM,
}) => {
    
    // 1. CÁLCULO DOS TOTAIS GERAIS
    const totalDiariaND15 = registrosDiaria.reduce((sum, r) => sum + r.valor_nd_15, 0);
    const totalDiariaND30 = registrosDiaria.reduce((sum, r) => sum + r.valor_nd_30, 0);
    
    const totalVerbaND30 = registrosVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_30, 0);
    const totalVerbaND39 = registrosVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    const totalSuprimentoND30 = registrosSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_30, 0);
    const totalSuprimentoND39 = registrosSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    const totalPassagemND33 = registrosPassagem.reduce((sum, r) => sum + r.valor_nd_33, 0);
    
    const totalConcessionariaND39 = registrosConcessionaria.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    const totalGeralOperacional = 
        totalDiariaND15 + totalDiariaND30 + 
        totalVerbaND30 + totalVerbaND39 + 
        totalSuprimentoND30 + totalSuprimentoND39 + 
        totalPassagemND33 + 
        totalConcessionariaND39;

    // 2. AGRUPAMENTO POR OM (já feito no Manager, apenas acessamos)
    const gruposOperacionais = useMemo(() => {
        return omsOrdenadas
            .map(omName => ({
                omName,
                grupo: gruposPorOM[omName],
            }))
            .filter(item => 
                item.grupo.linhasDiaria.length > 0 ||
                item.grupo.linhasVerbaOperacional.length > 0 ||
                item.grupo.linhasSuprimentoFundos.length > 0 ||
                item.grupo.linhasPassagem.length > 0 ||
                item.grupo.linhasConcessionaria.length > 0
            );
    }, [omsOrdenadas, gruposPorOM]);
    
    // 3. FUNÇÕES DE RENDERIZAÇÃO DE LINHA
    
    const renderDiariaRow = (registro: DiariaRegistro, index: number) => {
        const memoria = generateDiariaMemoriaCalculo(registro, diretrizesOperacionais);
        const total = registro.valor_nd_15 + registro.valor_nd_30;
        
        return (
            <TableRow key={index} className="border-b border-gray-200 print:border-gray-200">
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.organizacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.ug}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.om_detentora || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.posto_graduacao || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.quantidade}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.dias_operacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.destino}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-right">{formatCurrency(total)}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center w-[100px]">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-gray-500 mx-auto cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-lg whitespace-pre-wrap">
                                <p className="font-bold mb-1">Memória de Cálculo:</p>
                                <p>{memoria}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>
            </TableRow>
        );
    };
    
    const renderVerbaRow = (registro: VerbaOperacionalRegistro, index: number) => {
        const memoria = generateVerbaOperacionalMemoriaCalculo(registro);
        const total = registro.valor_nd_30 + registro.valor_nd_39;
        
        return (
            <TableRow key={index} className="border-b border-gray-200 print:border-gray-200">
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.organizacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.ug}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.om_detentora || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.objeto_aquisicao || registro.objeto_contratacao || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.quantidade_equipes}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.dias_operacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-right">{formatCurrency(total)}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center w-[100px]">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-gray-500 mx-auto cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-lg whitespace-pre-wrap">
                                <p className="font-bold mb-1">Memória de Cálculo:</p>
                                <p>{memoria}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>
            </TableRow>
        );
    };
    
    const renderSuprimentoRow = (registro: VerbaOperacionalRegistro, index: number) => {
        const memoria = generateSuprimentoFundosMemoriaCalculo(registro);
        const total = registro.valor_nd_30 + registro.valor_nd_39;
        
        return (
            <TableRow key={index} className="border-b border-gray-200 print:border-gray-200">
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.organizacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.ug}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.om_detentora || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.objeto_aquisicao || registro.objeto_contratacao || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.quantidade_equipes}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.dias_operacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-right">{formatCurrency(total)}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center w-[100px]">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-gray-500 mx-auto cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-lg whitespace-pre-wrap">
                                <p className="font-bold mb-1">Memória de Cálculo:</p>
                                <p>{memoria}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>
            </TableRow>
        );
    };
    
    const renderPassagemRow = (registro: PassagemRegistro, index: number) => {
        const memoria = generatePassagemMemoriaCalculo(registro);
        
        return (
            <TableRow key={index} className="border-b border-gray-200 print:border-gray-200">
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.organizacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.ug}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.om_detentora || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.origem} - {registro.destino}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.quantidade_passagens}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.dias_operacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-right">{formatCurrency(registro.valor_total)}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center w-[100px]">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-gray-500 mx-auto cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-lg whitespace-pre-wrap">
                                <p className="font-bold mb-1">Memória de Cálculo:</p>
                                <p>{memoria}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>
            </TableRow>
        );
    };
    
    const renderConcessionariaRow = (registro: ConcessionariaRegistro, index: number) => {
        const memoria = generateConcessionariaMemoriaCalculo(registro);
        
        return (
            <TableRow key={index} className="border-b border-gray-200 print:border-gray-200">
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.organizacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.ug}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.om_detentora || '-'}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px]">{registro.categoria}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.efetivo}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center">{registro.dias_operacao}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-right">{formatCurrency(registro.valor_total)}</TableCell>
                <TableCell className="py-1 px-2 text-xs print:text-[10px] text-center w-[100px]">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-gray-500 mx-auto cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-lg whitespace-pre-wrap">
                                <p className="font-bold mb-1">Memória de Cálculo:</p>
                                <p>{memoria}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>
            </TableRow>
        );
    };

    // 4. DEFINIÇÃO DAS COLUNAS
    const diariaColumns = [
        { key: 'organizacao', label: 'OM Favorecida' },
        { key: 'ug', label: 'UG Favorecida' },
        { key: 'om_detentora', label: 'OM Detentora' },
        { key: 'posto_graduacao', label: 'Posto/Grad' },
        { key: 'quantidade', label: 'Qtd', className: 'text-center w-[50px]' },
        { key: 'dias_operacao', label: 'Dias', className: 'text-center w-[50px]' },
        { key: 'destino', label: 'Destino' },
        { key: 'valor_total', label: 'Total', className: 'text-right w-[100px]' },
    ];
    
    const verbaSuprimentoColumns = [
        { key: 'organizacao', label: 'OM Favorecida' },
        { key: 'ug', label: 'UG Favorecida' },
        { key: 'om_detentora', label: 'OM Detentora' },
        { key: 'objeto', label: 'Objeto' },
        { key: 'quantidade_equipes', label: 'Qtd Eqp', className: 'text-center w-[50px]' },
        { key: 'dias_operacao', label: 'Dias', className: 'text-center w-[50px]' },
        { key: 'valor_total', label: 'Total', className: 'text-right w-[100px]' },
    ];
    
    const passagemColumns = [
        { key: 'organizacao', label: 'OM Favorecida' },
        { key: 'ug', label: 'UG Favorecida' },
        { key: 'om_detentora', label: 'OM Detentora' },
        { key: 'trecho', label: 'Trecho' },
        { key: 'quantidade_passagens', label: 'Qtd', className: 'text-center w-[50px]' },
        { key: 'dias_operacao', label: 'Dias', className: 'text-center w-[50px]' },
        { key: 'valor_total', label: 'Total', className: 'text-right w-[100px]' },
    ];
    
    const concessionariaColumns = [
        { key: 'organizacao', label: 'OM Favorecida' },
        { key: 'ug', label: 'UG Favorecida' },
        { key: 'om_detentora', label: 'OM Detentora' },
        { key: 'categoria', label: 'Categoria' },
        { key: 'efetivo', label: 'Efetivo', className: 'text-center w-[50px]' },
        { key: 'dias_operacao', label: 'Dias', className: 'text-center w-[50px]' },
        { key: 'valor_total', label: 'Total', className: 'text-right w-[100px]' },
    ];

    return (
        <div className="space-y-6 print:space-y-3">
            {/* Cabeçalho do Relatório */}
            <div className="text-center mb-6 print:mb-3">
                <h1 className="text-2xl font-bold print:text-lg">PLANO DE TRABALHO OPERACIONAL</h1>
                <h2 className="text-xl font-semibold text-primary print:text-base">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</h2>
                <p className="text-sm text-muted-foreground print:text-xs">
                    Período: {ptrabData.periodo_inicio} a {ptrabData.periodo_fim} | OM: {ptrabData.nome_om_extenso}
                </p>
                <p className="text-xs text-muted-foreground print:text-[10px]">
                    Relatório gerado em: {new Date().toLocaleDateString('pt-BR')} | Arquivo: {fileSuffix}
                </p>
            </div>
            
            {/* Resumo Geral */}
            <div className="p-4 border rounded-lg shadow-lg bg-blue-50 print:shadow-none print:border print:border-gray-300 print:bg-white">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-blue-700 print:text-base">
                    <DollarSign className="h-5 w-5" />
                    Resumo de Custos Operacionais (GND 3)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm print:text-xs">
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Diárias (ND 15)</p>
                        <p className="font-bold text-lg text-green-600 print:text-base">{formatCurrency(totalDiariaND15)}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Diárias (ND 30)</p>
                        <p className="font-bold text-lg text-green-600 print:text-base">{formatCurrency(totalDiariaND30)}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Passagens (ND 33)</p>
                        <p className="font-bold text-lg text-green-600 print:text-base">{formatCurrency(totalPassagemND33)}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Verba/Suprimento/Conc. (ND 30/39)</p>
                        <p className="font-bold text-lg text-green-600 print:text-base">{formatCurrency(totalVerbaND30 + totalVerbaND39 + totalSuprimentoND30 + totalSuprimentoND39 + totalConcessionariaND39)}</p>
                    </div>
                    <div className="col-span-2 md:col-span-4 pt-2 border-t border-dashed border-blue-200">
                        <p className="text-muted-foreground">Total Geral Operacional</p>
                        <p className="font-extrabold text-xl text-blue-700 print:text-lg">{formatCurrency(totalGeralOperacional)}</p>
                    </div>
                </div>
            </div>

            <h2 className="text-xl font-bold mt-8 mb-4 text-gray-800 print:text-base print:mt-4">DETALHAMENTO POR ORGANIZAÇÃO MILITAR</h2>
            <Separator className="mb-6 print:mb-3" />

            {gruposOperacionais.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    Nenhum registro operacional encontrado para este P Trab.
                </div>
            ) : (
                gruposOperacionais.map(({ omName, grupo }) => {
                    
                    // 5. CÁLCULO DOS TOTAIS POR OM
                    const totalDiariaOM = grupo.linhasDiaria.reduce((sum, r) => sum + r.valor_nd_15 + r.valor_nd_30, 0);
                    const totalVerbaOM = grupo.linhasVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_30 + r.valor_nd_39, 0);
                    const totalSuprimentoOM = grupo.linhasSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_30 + r.valor_nd_39, 0);
                    const totalPassagemOM = grupo.linhasPassagem.reduce((sum, r) => sum + r.valor_nd_33, 0);
                    const totalConcessionariaOM = grupo.linhasConcessionaria.reduce((sum, r) => sum + r.valor_nd_39, 0);
                    
                    const totalGeralOM = totalDiariaOM + totalVerbaOM + totalSuprimentoOM + totalPassagemOM + totalConcessionariaOM;

                    return (
                        <div key={omName} className="mb-8 p-4 border rounded-lg shadow-md bg-white print:shadow-none print:border print:border-gray-300 print:p-0">
                            <div className="bg-gray-100 p-3 border-b print:bg-gray-100 print:p-2 print:border-gray-300">
                                <h3 className="text-lg font-bold text-gray-800 print:text-sm">
                                    OM: {omName}
                                </h3>
                                <p className="text-sm text-blue-600 font-medium print:text-xs">
                                    Total Operacional da OM: {formatCurrency(totalGeralOM)}
                                </p>
                            </div>
                            <div className="pt-4 px-2 space-y-6 print:pt-2 print:px-0 print:space-y-3">
                                
                                {/* Seção de Diárias */}
                                <TableSection
                                    title="Pagamento de Diárias"
                                    icon={Users}
                                    data={grupo.linhasDiaria}
                                    renderRow={renderDiariaRow}
                                    totalND15={grupo.linhasDiaria.reduce((sum, r) => sum + r.valor_nd_15, 0)}
                                    totalND30={grupo.linhasDiaria.reduce((sum, r) => sum + r.valor_nd_30, 0)}
                                    totalGeral={totalDiariaOM}
                                    columns={diariaColumns}
                                />
                                
                                {/* Seção de Passagens */}
                                <TableSection
                                    title="Passagens Aéreas/Terrestres"
                                    icon={Plane}
                                    data={grupo.linhasPassagem}
                                    renderRow={renderPassagemRow}
                                    totalND33={grupo.linhasPassagem.reduce((sum, r) => sum + r.valor_nd_33, 0)}
                                    totalGeral={totalPassagemOM}
                                    columns={passagemColumns}
                                />
                                
                                {/* Seção de Verba Operacional */}
                                <TableSection
                                    title="Verba Operacional"
                                    icon={Briefcase}
                                    data={grupo.linhasVerbaOperacional}
                                    renderRow={renderVerbaRow}
                                    totalND30={grupo.linhasVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_30, 0)}
                                    totalND39={grupo.linhasVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_39, 0)}
                                    totalGeral={totalVerbaOM}
                                    columns={verbaSuprimentoColumns}
                                />
                                
                                {/* Seção de Suprimento de Fundos */}
                                <TableSection
                                    title="Suprimento de Fundos"
                                    icon={DollarSign}
                                    data={grupo.linhasSuprimentoFundos}
                                    renderRow={renderSuprimentoRow}
                                    totalND30={grupo.linhasSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_30, 0)}
                                    totalND39={grupo.linhasSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_39, 0)}
                                    totalGeral={totalSuprimentoOM}
                                    columns={verbaSuprimentoColumns}
                                />
                                
                                {/* Seção de Concessionária */}
                                <TableSection
                                    title="Pagamento de Concessionárias"
                                    icon={Utensils}
                                    data={grupo.linhasConcessionaria}
                                    renderRow={renderConcessionariaRow}
                                    totalND39={grupo.linhasConcessionaria.reduce((sum, r) => sum + r.valor_nd_39, 0)}
                                    totalGeral={totalConcessionariaOM}
                                    columns={concessionariaColumns}
                                />
                                
                            </div>
                        </div>
                    );
                })
            )}
            
            {/* Total Geral Final */}
            <div className="mt-8 p-4 border rounded-lg shadow-xl bg-blue-100 print:shadow-none print:border print:border-gray-400 print:bg-blue-50">
                <h3 className="text-xl font-bold text-blue-900 print:text-base">TOTAL GERAL OPERACIONAL DO P TRAB</h3>
                <p className="text-2xl font-extrabold text-blue-900 print:text-lg">{formatCurrency(totalGeralOperacional)}</p>
                <div className="mt-2 text-sm text-gray-700 print:text-xs">
                    <p>ND 33.90.15 (Diárias): {formatCurrency(totalDiariaND15)}</p>
                    <p>ND 33.90.30 (Diárias, Verba, Suprimento): {formatCurrency(totalDiariaND30 + totalVerbaND30 + totalSuprimentoND30)}</p>
                    <p>ND 33.90.33 (Passagens): {formatCurrency(totalPassagemND33)}</p>
                    <p>ND 33.90.39 (Verba, Suprimento, Concessionária): {formatCurrency(totalVerbaND39 + totalSuprimentoND39 + totalConcessionariaND39)}</p>
                </div>
            </div>
        </div>
    );
};

export default PTrabOperacionalReport;