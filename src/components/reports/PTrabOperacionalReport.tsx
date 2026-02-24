"use client";

import React from 'react';
import { PTrabOperacionalReportProps, formatFasesParaTexto } from '@/pages/PTrabReportManager';
import { formatCurrency } from '@/lib/formatUtils';
import ReportHeader from './ReportHeader';
import ReportFooter from './ReportFooter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
    ptrabData,
    omsOrdenadas,
    gruposPorOM,
    diretrizesOperacionais,
    fileSuffix,
    generateDiariaMemoriaCalculo,
    generateVerbaOperacionalMemoriaCalculo,
    generateSuprimentoFundosMemoriaCalculo,
    generatePassagemMemoriaCalculo,
    generateConcessionariaMemoriaCalculo,
    generateMaterialConsumoMemoriaCalculo,
    generateComplementoMemoriaCalculo,
    generateServicoMemoriaCalculo,
}) => {
    const totalGeralOperacional = omsOrdenadas.reduce((acc, om) => {
        const grupo = gruposPorOM[om];
        const subtotal = 
            grupo.diarias.reduce((s, r) => s + r.valor_total, 0) +
            grupo.verbaOperacional.reduce((s, r) => s + r.valor_total_solicitado, 0) +
            grupo.suprimentoFundos.reduce((s, r) => s + r.valor_total_solicitado, 0) +
            grupo.passagens.reduce((s, r) => s + r.valor_total, 0) +
            grupo.concessionarias.reduce((s, r) => s + r.valor_total, 0) +
            grupo.materialConsumo.reduce((s, r) => s + r.valor_total, 0) +
            grupo.complementoAlimentacao.reduce((s, r) => s + r.registro.valor_total, 0) +
            grupo.servicosTerceiros.reduce((s, r) => s + r.valor_total, 0);
        return acc + subtotal;
    }, 0);

    return (
        <div className="report-container bg-white p-8 shadow-sm print:shadow-none min-h-[29.7cm]">
            <ReportHeader ptrabData={ptrabData} reportTitle="PLANEJAMENTO DE CUSTOS OPERACIONAIS (GND 3 E GND 4)" fileSuffix={fileSuffix} />

            <div className="mt-6 space-y-8">
                {omsOrdenadas.map((om, omIdx) => {
                    const grupo = gruposPorOM[om];
                    const subtotalOM = 
                        grupo.diarias.reduce((s, r) => s + r.valor_total, 0) +
                        grupo.verbaOperacional.reduce((s, r) => s + r.valor_total_solicitado, 0) +
                        grupo.suprimentoFundos.reduce((s, r) => s + r.valor_total_solicitado, 0) +
                        grupo.passagens.reduce((s, r) => s + r.valor_total, 0) +
                        grupo.concessionarias.reduce((s, r) => s + r.valor_total, 0) +
                        grupo.materialConsumo.reduce((s, r) => s + r.valor_total, 0) +
                        grupo.complementoAlimentacao.reduce((s, r) => s + r.registro.valor_total, 0) +
                        grupo.servicosTerceiros.reduce((s, r) => s + r.valor_total, 0);

                    return (
                        <div key={om} className="om-section break-inside-avoid">
                            <h3 className="text-lg font-bold border-b-2 border-primary mb-3 py-1">
                                {omIdx + 1}. {om}
                            </h3>
                            <Table className="report-table border-collapse w-full">
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="w-[15%] font-bold text-black border">Despesa</TableHead>
                                        <TableHead className="w-[45%] font-bold text-black border">Memória de Cálculo / Detalhamento</TableHead>
                                        <TableHead className="w-[10%] font-bold text-black text-center border">ND</TableHead>
                                        <TableHead className="w-[10%] font-bold text-black text-right border">GND 3 (30)</TableHead>
                                        <TableHead className="w-[10%] font-bold text-black text-right border">GND 3 (39/33)</TableHead>
                                        <TableHead className="w-[10%] font-bold text-black text-right border">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Diárias */}
                                    {grupo.diarias.map(r => (
                                        <TableRow key={r.id}>
                                            <TableCell className="border text-xs font-medium">Diárias</TableCell>
                                            <TableCell className="border text-xs whitespace-pre-wrap">{generateDiariaMemoriaCalculo(r, diretrizesOperacionais)}</TableCell>
                                            <TableCell className="border text-xs text-center">{r.is_aereo ? '33.90.15' : '33.90.14'}</TableCell>
                                            <TableCell className="border text-xs text-right">{formatCurrency(r.valor_nd_30)}</TableCell>
                                            <TableCell className="border text-xs text-right">{formatCurrency(r.valor_nd_15)}</TableCell>
                                            <TableCell className="border text-xs text-right font-bold">{formatCurrency(r.valor_total)}</TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Material de Consumo */}
                                    {grupo.materialConsumo.map(r => (
                                        <TableRow key={r.id} id={r.id === 'ghost-mat' ? 'tour-mat-consumo-row' : undefined}>
                                            <TableCell className="border text-xs font-medium">Material de Consumo</TableCell>
                                            <TableCell className="border text-xs whitespace-pre-wrap">
                                                <div className="font-bold mb-1">{(r as any).nome_grupo || (r as any).group_name}</div>
                                                {generateMaterialConsumoMemoriaCalculo(r)}
                                            </TableCell>
                                            <TableCell className="border text-xs text-center">33.90.30</TableCell>
                                            <TableCell className="border text-xs text-right">{formatCurrency(r.valor_nd_30)}</TableCell>
                                            <TableCell className="border text-xs text-right">{formatCurrency(r.valor_nd_39)}</TableCell>
                                            <TableCell className="border text-xs text-right font-bold">{formatCurrency(r.valor_total)}</TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Passagens */}
                                    {grupo.passagens.map(r => (
                                        <TableRow key={r.id}>
                                            <TableCell className="border text-xs font-medium">Passagens</TableCell>
                                            <TableCell className="border text-xs whitespace-pre-wrap">{generatePassagemMemoriaCalculo(r)}</TableCell>
                                            <TableCell className="border text-xs text-center">33.90.33</TableCell>
                                            <TableCell className="border text-xs text-right">R$ 0,00</TableCell>
                                            <TableCell className="border text-xs text-right">{formatCurrency(r.valor_nd_33)}</TableCell>
                                            <TableCell className="border text-xs text-right font-bold">{formatCurrency(r.valor_total)}</TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Outras despesas podem ser adicionadas aqui da mesma forma... */}
                                    
                                    <TableRow className="bg-muted/20 font-bold">
                                        <TableCell colSpan={5} className="border text-right text-xs">Subtotal {om}:</TableCell>
                                        <TableCell className="border text-right text-xs">{formatCurrency(subtotalOM)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    );
                })}

                <div className="total-geral-section pt-4 border-t-4 border-black flex justify-between items-center">
                    <span className="text-xl font-black uppercase">Valor Total Operacional Planejado:</span>
                    <span className="text-2xl font-black">{formatCurrency(totalGeralOperacional)}</span>
                </div>
            </div>

            <ReportFooter ptrabData={ptrabData} />
        </div>
    );
};

export default PTrabOperacionalReport;