import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug, formatNumber, formatDate } from "@/lib/formatUtils";
import { FileText, Briefcase, DollarSign, MapPin, Users, Calendar } from "lucide-react";
import { PTrabOperacionalReportProps, GrupoOMOperacional, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro } from "@/types/reportTypes";
import { formatFasesParaTexto } from "@/pages/PTrabReportManager"; // Importar helper de formatação de fases

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
    ptrabData,
    omsOrdenadas,
    gruposPorOM,
    diretrizesOperacionais,
    diretrizesPassagens,
    fileSuffix,
    generateDiariaMemoriaCalculo,
    generateVerbaOperacionalMemoriaCalculo,
    generateSuprimentoFundosMemoriaCalculo,
    generatePassagemMemoriaCalculo,
    generateConcessionariaMemoriaCalculo,
}) => {
    
    const calculateTotal = (group: GrupoOMOperacional) => {
        const totalDiarias = group.diarias.reduce((sum, r) => sum + r.valor_total, 0);
        const totalVerba = group.verbaOperacional.reduce((sum, r) => sum + r.valor_total_solicitado, 0);
        const totalSuprimento = group.suprimentoFundos.reduce((sum, r) => sum + r.valor_total_solicitado, 0);
        const totalPassagens = group.passagens.reduce((sum, r) => sum + r.valor_total, 0);
        const totalConcessionarias = group.concessionarias.reduce((sum, r) => sum + r.valor_total, 0);
        return totalDiarias + totalVerba + totalSuprimento + totalPassagens + totalConcessionarias;
    };

    const grandTotal = useMemo(() => {
        return omsOrdenadas.reduce((sum, om) => sum + calculateTotal(gruposPorOM[om]), 0);
    }, [omsOrdenadas, gruposPorOM]);

    const renderDiarias = (diarias: DiariaRegistro[]) => {
        if (diarias.length === 0) return null;
        
        const totalDiarias = diarias.reduce((sum, r) => sum + r.valor_total, 0);
        
        return (
            <div className="space-y-2">
                <h5 className="font-semibold text-sm mt-4 mb-2 border-b pb-1">Diárias ({formatCurrency(totalDiarias)})</h5>
                {diarias.map((r, index) => (
                    <div key={r.id} className="border p-3 rounded-md text-xs bg-gray-50">
                        <div className="flex justify-between font-medium">
                            <span>{r.posto_graduacao} ({r.quantidade} Militares)</span>
                            <span>{formatCurrency(r.valor_total)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Destino: {r.destino} | Dias: {r.dias_operacao} | Viagens: {r.nr_viagens}
                        </p>
                        <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-primary font-medium">Memória de Cálculo</summary>
                            <pre className="whitespace-pre-wrap text-[10px] bg-white p-2 rounded mt-1 border">
                                {generateDiariaMemoriaCalculo(r, diretrizesOperacionais)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        );
    };
    
    const renderVerbaOperacional = (registros: VerbaOperacionalRegistro[], title: string, generator: (r: VerbaOperacionalRegistro) => string) => {
        if (registros.length === 0) return null;
        
        const total = registros.reduce((sum, r) => sum + r.valor_total_solicitado, 0);
        
        return (
            <div className="space-y-2">
                <h5 className="font-semibold text-sm mt-4 mb-2 border-b pb-1">{title} ({formatCurrency(total)})</h5>
                {registros.map((r, index) => (
                    <div key={r.id} className="border p-3 rounded-md text-xs bg-gray-50">
                        <div className="flex justify-between font-medium">
                            <span>{r.detalhamento}</span>
                            <span>{formatCurrency(r.valor_total_solicitado)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Equipes: {r.quantidade_equipes} | Dias: {r.dias_operacao} | Fase: {r.fase_atividade}
                        </p>
                        <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-primary font-medium">Memória de Cálculo</summary>
                            <pre className="whitespace-pre-wrap text-[10px] bg-white p-2 rounded mt-1 border">
                                {generator(r)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        );
    };
    
    const renderPassagens = (passagens: PassagemRegistro[]) => {
        if (passagens.length === 0) return null;
        
        const total = passagens.reduce((sum, r) => sum + r.valor_total, 0);
        
        return (
            <div className="space-y-2">
                <h5 className="font-semibold text-sm mt-4 mb-2 border-b pb-1">Passagens ({formatCurrency(total)})</h5>
                {passagens.map((r, index) => (
                    <div key={r.id} className="border p-3 rounded-md text-xs bg-gray-50">
                        <div className="flex justify-between font-medium">
                            <span>{r.origem} &rarr; {r.destino} ({r.quantidade_passagens} passagens)</span>
                            <span>{formatCurrency(r.valor_total)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Transporte: {r.tipo_transporte} | Ida/Volta: {r.is_ida_volta ? 'Sim' : 'Não'} | Efetivo: {r.efetivo}
                        </p>
                        <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-primary font-medium">Memória de Cálculo</summary>
                            <pre className="whitespace-pre-wrap text-[10px] bg-white p-2 rounded mt-1 border">
                                {generatePassagemMemoriaCalculo(r)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        );
    };
    
    const renderConcessionarias = (concessionarias: ConcessionariaRegistro[]) => {
        if (concessionarias.length === 0) return null;
        
        const total = concessionarias.reduce((sum, r) => sum + r.valor_total, 0);
        
        return (
            <div className="space-y-2">
                <h5 className="font-semibold text-sm mt-4 mb-2 border-b pb-1">Pagamento de Concessionárias ({formatCurrency(total)})</h5>
                {concessionarias.map((r, index) => (
                    <div key={r.id} className="border p-3 rounded-md text-xs bg-gray-50">
                        <div className="flex justify-between font-medium">
                            <span>{r.nome_concessionaria} ({r.categoria})</span>
                            <span>{formatCurrency(r.valor_total)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Efetivo: {r.efetivo} | Consumo/Dia: {formatNumber(r.consumo_pessoa_dia, 2)} {r.unidade_custo}
                        </p>
                        <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-primary font-medium">Memória de Cálculo</summary>
                            <pre className="whitespace-pre-wrap text-[10px] bg-white p-2 rounded mt-1 border">
                                {generateConcessionariaMemoriaCalculo(r)}
                            </pre>
                        </details>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 print:p-0" id={`ptrab-report-${fileSuffix}`}>
            <Card className="print:border-none print:shadow-none">
                <CardHeader className="print:p-0 print:pt-4">
                    <CardTitle className="text-2xl flex items-center gap-2 print:text-xl">
                        <Briefcase className="h-6 w-6 text-blue-500 print:hidden" />
                        Relatório Operacional
                    </CardTitle>
                    <p className="text-muted-foreground print:text-sm">
                        {ptrabData.numero_ptrab} - {ptrabData.nome_operacao}
                    </p>
                </CardHeader>
                <CardContent className="pt-4 print:p-0 print:pt-2">
                    
                    {/* Resumo Geral */}
                    <div className="mb-6 p-4 border rounded-lg bg-blue-50 print:border print:p-2">
                        <h4 className="font-bold text-lg mb-2 flex items-center gap-2 text-blue-700 print:text-base">
                            <DollarSign className="h-4 w-4" />
                            Resumo Financeiro Operacional
                        </h4>
                        <div className="flex justify-between items-center border-t pt-2">
                            <span className="font-bold text-xl text-blue-800 print:text-lg">TOTAL GERAL OPERACIONAL:</span>
                            <span className="font-extrabold text-2xl text-blue-800 print:text-xl">{formatCurrency(grandTotal)}</span>
                        </div>
                    </div>

                    {/* Detalhamento por OM */}
                    <div className="space-y-8">
                        {omsOrdenadas.map(omName => {
                            const group = gruposPorOM[omName];
                            const totalOM = calculateTotal(group);
                            
                            if (totalOM === 0 && group.diarias.length === 0 && group.verbaOperacional.length === 0 && group.suprimentoFundos.length === 0 && group.passagens.length === 0 && group.concessionarias.length === 0) {
                                return null;
                            }

                            return (
                                <div key={omName} className="border p-4 rounded-lg shadow-sm bg-white print:border print:p-2 print:break-inside-avoid">
                                    <div className="flex justify-between items-center border-b pb-2 mb-3">
                                        <h3 className="font-bold text-lg text-foreground print:text-base">
                                            OM: {omName}
                                        </h3>
                                        <span className="font-extrabold text-xl text-blue-600 print:text-lg">
                                            {formatCurrency(totalOM)}
                                        </span>
                                    </div>
                                    
                                    {renderDiarias(group.diarias)}
                                    {renderVerbaOperacional(group.verbaOperacional, "Verba Operacional", generateVerbaOperacionalMemoriaCalculo)}
                                    {renderVerbaOperacional(group.suprimentoFundos, "Suprimento de Fundos", generateSuprimentoFundosMemoriaCalculado)}
                                    {renderPassagens(group.passagens)}
                                    {renderConcessionarias(group.concessionarias)}
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Dados do PTrab (Rodapé) */}
                    <div className="mt-8 pt-4 border-t print:mt-4 print:pt-2">
                        <h4 className="font-bold text-lg mb-2 print:text-base">Dados do Plano de Trabalho</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm print:text-xs">
                            <p><span className="font-medium">Operação:</span> {ptrabData.nome_operacao}</p>
                            <p><span className="font-medium">Período:</span> {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)}</p>
                            <p><span className="font-medium">Efetivo:</span> {ptrabData.efetivo_empregado}</p>
                            <p><span className="font-medium">Última Atualização:</span> {new Date(ptrabData.updated_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PTrabOperacionalReport;