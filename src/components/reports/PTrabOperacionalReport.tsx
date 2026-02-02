import React, { useMemo } from "react";
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro, generateDiariaMemoriaCalculoUnificada, generateVerbaOperacionalMemoriaCalculada, generateSuprimentoFundosMemoriaCalculada, generatePassagemMemoriaCalculada, generateConcessionariaMemoriaCalculada } from "@/pages/PTrabReportManager";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, isRegiaoMilitar } from "@/lib/formatUtils";
import { Separator } from "@/components/ui/separator";
import { FileText, Briefcase, Plane, Utensils } from "lucide-react";

// =================================================================
// TIPOS INTERNOS
// =================================================================

interface ConsolidatedDiariaRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    fase_atividade: string;
    records: DiariaRegistro[];
    totalGeral: number;
    totalND15: number;
    totalND30: number;
}

interface ConsolidatedVerbaRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    fase_atividade: string;
    records: VerbaOperacionalRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

interface ConsolidatedPassagemRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    fase_atividade: string;
    records: PassagemRegistro[];
    totalGeral: number;
    totalND33: number;
}

interface ConsolidatedConcessionariaRecord {
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    records: ConcessionariaRegistro[];
    totalGeral: number;
    totalND39: number;
}

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
    
    const nomeRM = ptrabData.rm_vinculacao || '';

    // 1. Agrupamento dos Registros por OM Detentora (OM/UG)
    const registrosAgrupadosPorOM = useMemo(() => {
        const grupos: Record<string, {
            diarias: ConsolidatedDiariaRecord;
            verbaOperacional: ConsolidatedVerbaRecord;
            suprimentoFundos: ConsolidatedVerbaRecord;
            passagens: ConsolidatedPassagemRecord;
            concessionarias: ConsolidatedConcessionariaRecord;
        }> = {};

        const initializeGroup = (key: string, om: string, ug: string, omDetentora: string, ugDetentora: string, dias: number, efetivo: number, fase: string) => {
            if (!grupos[key]) {
                grupos[key] = {
                    diarias: { organizacao: om, ug: ug, om_detentora: omDetentora, ug_detentora: ugDetentora, dias_operacao: dias, fase_atividade: fase, records: [], totalGeral: 0, totalND15: 0, totalND30: 0 },
                    verbaOperacional: { organizacao: om, ug: ug, om_detentora: omDetentora, ug_detentora: ugDetentora, dias_operacao: dias, fase_atividade: fase, records: [], totalGeral: 0, totalND30: 0, totalND39: 0 },
                    suprimentoFundos: { organizacao: om, ug: ug, om_detentora: omDetentora, ug_detentora: ugDetentora, dias_operacao: dias, fase_atividade: fase, records: [], totalGeral: 0, totalND30: 0, totalND39: 0 },
                    passagens: { organizacao: om, ug: ug, om_detentora: omDetentora, ug_detentora: ugDetentora, dias_operacao: dias, fase_atividade: fase, records: [], totalGeral: 0, totalND33: 0 },
                    concessionarias: { organizacao: om, ug: ug, om_detentora: omDetentora, ug_detentora: ugDetentora, dias_operacao: dias, efetivo: efetivo, fase_atividade: fase, records: [], totalGeral: 0, totalND39: 0 },
                };
            }
            return grupos[key];
        };

        // Diárias (ND 33.90.15 e 33.90.30)
        registrosDiaria.forEach(r => {
            const key = `${r.om_detentora} (${formatCodug(r.ug_detentora)})`;
            const group = initializeGroup(key, r.organizacao, r.ug, r.om_detentora || r.organizacao, r.ug_detentora || r.ug, r.dias_operacao, 0, r.fase_atividade || 'operação');
            group.diarias.records.push(r);
            group.diarias.totalGeral += r.valor_total;
            group.diarias.totalND15 += r.valor_nd_15;
            group.diarias.totalND30 += r.valor_nd_30;
        });

        // Verba Operacional (ND 33.90.30 e 33.90.39)
        registrosVerbaOperacional.forEach(r => {
            const key = `${r.om_detentora} (${formatCodug(r.ug_detentora)})`;
            const group = initializeGroup(key, r.organizacao, r.ug, r.om_detentora || r.organizacao, r.ug_detentora || r.ug, r.dias_operacao, r.efetivo || 0, r.fase_atividade || 'operação');
            group.verbaOperacional.records.push(r);
            group.verbaOperacional.totalGeral += r.valor_total_solicitado;
            group.verbaOperacional.totalND30 += r.valor_nd_30;
            group.verbaOperacional.totalND39 += r.valor_nd_39;
        });
        
        // Suprimento de Fundos (ND 33.90.30 e 33.90.39)
        registrosSuprimentoFundos.forEach(r => {
            const key = `${r.om_detentora} (${formatCodug(r.ug_detentora)})`;
            const group = initializeGroup(key, r.organizacao, r.ug, r.om_detentora || r.organizacao, r.ug_detentora || r.ug, r.dias_operacao, r.efetivo || 0, r.fase_atividade || 'operação');
            group.suprimentoFundos.records.push(r);
            group.suprimentoFundos.totalGeral += r.valor_total_solicitado;
            group.suprimentoFundos.totalND30 += r.valor_nd_30;
            group.suprimentoFundos.totalND39 += r.valor_nd_39;
        });

        // Passagens (ND 33.90.33)
        registrosPassagem.forEach(r => {
            const key = `${r.om_detentora} (${formatCodug(r.ug_detentora)})`;
            const group = initializeGroup(key, r.organizacao, r.ug, r.om_detentora, r.ug_detentora, r.dias_operacao, r.efetivo || 0, r.fase_atividade || 'operação');
            group.passagens.records.push(r);
            group.passagens.totalGeral += r.valor_total;
            group.passagens.totalND33 += r.valor_nd_33;
        });
        
        // Concessionárias (ND 33.90.39)
        registrosConcessionaria.forEach(r => {
            const omDetentora = r.om_detentora || r.organizacao;
            const ugDetentora = r.ug_detentora || r.ug;
            const key = `${omDetentora} (${formatCodug(ugDetentora)})`;
            const group = initializeGroup(key, r.organizacao, r.ug, omDetentora, ugDetentora, r.dias_operacao, r.efetivo, r.fase_atividade || 'operação');
            group.concessionarias.records.push(r);
            group.concessionarias.totalGeral += r.valor_total;
            group.concessionarias.totalND39 += r.valor_nd_39;
        });

        return grupos;
    }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria]);

    // 2. Ordenação das OM (RM primeiro)
    const omsOrdenadas = useMemo(() => {
        const oms = Object.keys(registrosAgrupadosPorOM);
        
        return oms.sort((a, b) => {
            // Extrai apenas o nome da OM (antes do parênteses)
            const nomeOM_A = a.split(' (')[0];
            const nomeOM_B = b.split(' (')[0];
            
            const aIsRM = isRegiaoMilitar(nomeOM_A, nomeRM);
            const bIsRM = isRegiaoMilitar(nomeOM_B, nomeRM);
            
            if (aIsRM && !bIsRM) return -1;
            if (!aIsRM && bIsRM) return 1;
            
            return a.localeCompare(b);
        });
    }, [registrosAgrupadosPorOM, nomeRM]);

    // 3. Cálculo dos Totais Gerais
    const totaisGerais = useMemo(() => {
        let totalND15 = 0;
        let totalND30 = 0;
        let totalND33 = 0;
        let totalND39 = 0;
        
        Object.values(registrosAgrupadosPorOM).forEach(grupo => {
            totalND15 += grupo.diarias.totalND15;
            totalND30 += grupo.diarias.totalND30 + grupo.verbaOperacional.totalND30 + grupo.suprimentoFundos.totalND30;
            totalND33 += grupo.passagens.totalND33;
            totalND39 += grupo.verbaOperacional.totalND39 + grupo.suprimentoFundos.totalND39 + grupo.concessionarias.totalND39;
        });
        
        const totalGeral = totalND15 + totalND30 + totalND33 + totalND39;
        
        return { totalND15, totalND30, totalND33, totalND39, totalGeral };
    }, [registrosAgrupadosPorOM]);

    if (omsOrdenadas.length === 0) {
        return (
            <div className="text-center py-12">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Nenhum Registro Operacional Encontrado</h3>
                <p className="text-muted-foreground mt-2">
                    Adicione registros de Diárias, Passagens, Verba Operacional ou Concessionárias.
                </p>
            </div>
        );
    }

    return (
        <div className="report-container p-4 print:p-0">
            {/* Cabeçalho do Relatório */}
            <div className="report-header text-center mb-6">
                <h2 className="text-lg font-bold">PLANO DE TRABALHO OPERACIONAL</h2>
                <h3 className="text-md font-semibold">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</h3>
                <p className="text-sm text-muted-foreground">
                    Período: {ptrabData.periodo_inicio} a {ptrabData.periodo_fim} | OM: {ptrabData.nome_om_extenso}
                </p>
            </div>

            {/* Tabela de Totais Gerais */}
            <div className="mb-6 border border-gray-300 p-3 rounded-md print:border-none print:p-0">
                <h4 className="text-sm font-bold mb-2 flex items-center gap-1 text-blue-600">
                    <Briefcase className="h-4 w-4" />
                    RESUMO GERAL DE CUSTOS OPERACIONAIS
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="font-medium">
                        <span className="text-muted-foreground block">ND 33.90.15 (Diárias):</span>
                        <span className="text-blue-700">{formatCurrency(totaisGerais.totalND15)}</span>
                    </div>
                    <div className="font-medium">
                        <span className="text-muted-foreground block">ND 33.90.30 (Diversos):</span>
                        <span className="text-blue-700">{formatCurrency(totaisGerais.totalND30)}</span>
                    </div>
                    <div className="font-medium">
                        <span className="text-muted-foreground block">ND 33.90.33 (Passagens):</span>
                        <span className="text-blue-700">{formatCurrency(totaisGerais.totalND33)}</span>
                    </div>
                    <div className="font-medium">
                        <span className="text-muted-foreground block">ND 33.90.39 (Serviços):</span>
                        <span className="text-blue-700">{formatCurrency(totaisGerais.totalND39)}</span>
                    </div>
                    <div className="col-span-full pt-2 border-t border-dashed border-gray-300">
                        <span className="text-lg font-bold block">TOTAL OPERACIONAL: {formatCurrency(totaisGerais.totalGeral)}</span>
                    </div>
                </div>
            </div>

            {/* Seção de Detalhamento por OM */}
            <div className="space-y-8">
                {omsOrdenadas.map((omKey) => {
                    const grupo = registrosAgrupadosPorOM[omKey];
                    const omNome = omKey.split(' (')[0];
                    const ugCodug = omKey.split(' (')[1].replace(')', '');
                    
                    const totalGrupoND15 = grupo.diarias.totalND15;
                    const totalGrupoND30 = grupo.diarias.totalND30 + grupo.verbaOperacional.totalND30 + grupo.suprimentoFundos.totalND30;
                    const totalGrupoND33 = grupo.passagens.totalND33;
                    const totalGrupoND39 = grupo.verbaOperacional.totalND39 + grupo.suprimentoFundos.totalND39 + grupo.concessionarias.totalND39;
                    const totalGrupoGeral = totalGrupoND15 + totalGrupoND30 + totalGrupoND33 + totalGrupoND39;

                    if (totalGrupoGeral === 0) return null;

                    return (
                        <React.Fragment key={omKey}>
                            <div className="border border-gray-300 p-3 bg-gray-50 rounded-md print:border-none print:p-0 print:bg-white">
                                <h4 className="text-sm font-bold text-gray-800">
                                    OM DETENTORA DO RECURSO: {omNome} (UG: {ugCodug})
                                </h4>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Total de Recursos Solicitados para esta OM: <span className="font-bold text-blue-600">{formatCurrency(totalGrupoGeral)}</span>
                                </div>
                            </div>

                            {/* Tabela de Detalhamento */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[7pt] table-fixed">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-t border-gray-300 print:bg-white">
                                            <th className="w-[10%] text-left p-1 font-bold">OM/UG Favorecida</th>
                                            <th className="w-[5%] text-center p-1 font-bold">Dias</th>
                                            <th className="w-[10%] text-center p-1 font-bold">Fase</th>
                                            <th className="w-[5%] text-center p-1 font-bold">ND</th>
                                            <th className="w-[10%] text-right p-1 font-bold">Valor Total</th>
                                            <th className="w-[60%] text-left p-1 font-bold">Memória de Cálculo / Detalhamento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 1. DIÁRIAS (ND 33.90.15 e 33.90.30) */}
                                        {grupo.diarias.records.map((r, index) => {
                                            const memoria = generateDiariaMemoriaCalculo(r, diretrizesOperacionais);
                                            return (
                                                <tr key={`diaria-${r.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50 print:border-gray-300">
                                                    <td className="p-1 align-top">
                                                        {r.organizacao} ({formatCodug(r.ug)})
                                                    </td>
                                                    <td className="text-center p-1 align-top">{r.dias_operacao}</td>
                                                    <td className="text-center p-1 align-top">{r.fase_atividade || 'operação'}</td>
                                                    <td className="text-center p-1 align-top">
                                                        {r.valor_nd_15 > 0 && <span className="block">33.90.15</span>}
                                                        {r.valor_nd_30 > 0 && <span className="block">33.90.30</span>}
                                                    </td>
                                                    <td className="text-right p-1 align-top font-medium">
                                                        {formatCurrency(r.valor_total)}
                                                    </td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {memoria}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* 2. PASSAGENS (ND 33.90.33) */}
                                        {grupo.passagens.records.map((r, index) => {
                                            const memoria = generatePassagemMemoriaCalculo(r);
                                            return (
                                                <tr key={`passagem-${r.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50 print:border-gray-300">
                                                    <td className="p-1 align-top">
                                                        {r.organizacao} ({formatCodug(r.ug)})
                                                    </td>
                                                    <td className="text-center p-1 align-top">{r.dias_operacao}</td>
                                                    <td className="text-center p-1 align-top">{r.fase_atividade || 'operação'}</td>
                                                    <td className="text-center p-1 align-top">33.90.33</td>
                                                    <td className="text-right p-1 align-top font-medium">
                                                        {formatCurrency(r.valor_total)}
                                                    </td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {memoria}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* 3. VERBA OPERACIONAL (ND 33.90.30 e 33.90.39) */}
                                        {grupo.verbaOperacional.records.map((r, index) => {
                                            const memoria = generateVerbaOperacionalMemoriaCalculo(r);
                                            return (
                                                <tr key={`verba-${r.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50 print:border-gray-300">
                                                    <td className="p-1 align-top">
                                                        {r.organizacao} ({formatCodug(r.ug)})
                                                    </td>
                                                    <td className="text-center p-1 align-top">{r.dias_operacao}</td>
                                                    <td className="text-center p-1 align-top">{r.fase_atividade || 'operação'}</td>
                                                    <td className="text-center p-1 align-top">
                                                        {r.valor_nd_30 > 0 && <span className="block">33.90.30</span>}
                                                        {r.valor_nd_39 > 0 && <span className="block">33.90.39</span>}
                                                    </td>
                                                    <td className="text-right p-1 align-top font-medium">
                                                        {formatCurrency(r.valor_total_solicitado)}
                                                    </td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {memoria}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* 4. SUPRIMENTO DE FUNDOS (ND 33.90.30 e 33.90.39) */}
                                        {grupo.suprimentoFundos.records.map((r, index) => {
                                            const memoria = generateSuprimentoFundosMemoriaCalculada(r);
                                            return (
                                                <tr key={`suprimento-${r.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50 print:border-gray-300">
                                                    <td className="p-1 align-top">
                                                        {r.organizacao} ({formatCodug(r.ug)})
                                                    </td>
                                                    <td className="text-center p-1 align-top">{r.dias_operacao}</td>
                                                    <td className="text-center p-1 align-top">{r.fase_atividade || 'operação'}</td>
                                                    <td className="text-center p-1 align-top">
                                                        {r.valor_nd_30 > 0 && <span className="block">33.90.30</span>}
                                                        {r.valor_nd_39 > 0 && <span className="block">33.90.39</span>}
                                                    </td>
                                                    <td className="text-right p-1 align-top font-medium">
                                                        {formatCurrency(r.valor_total_solicitado)}
                                                    </td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {memoria}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        
                                        {/* 5. CONCESSIONÁRIAS (ND 33.90.39) */}
                                        {grupo.concessionarias.records.map((r, index) => {
                                            // CORREÇÃO: O registro de concessionária precisa ser estendido com os dados da diretriz
                                            // Como o PTrabReportManager não faz o join, precisamos garantir que o generateConcessionariaMemoriaCalculo
                                            // consiga funcionar apenas com os dados do registro (que já contém nome_concessionaria, unidade_custo, etc.)
                                            const memoria = generateConcessionariaMemoriaCalculo(r as any); 
                                            return (
                                                <tr key={`concessionaria-${r.id}-${index}`} className="border-b border-gray-200 hover:bg-gray-50 print:border-gray-300">
                                                    <td className="p-1 align-top">
                                                        {r.organizacao} ({formatCodug(r.ug)})
                                                    </td>
                                                    <td className="text-center p-1 align-top">{r.dias_operacao}</td>
                                                    <td className="text-center p-1 align-top">{r.fase_atividade || 'operação'}</td>
                                                    <td className="text-center p-1 align-top">33.90.39</td>
                                                    <td className="text-right p-1 align-top font-medium">
                                                        {formatCurrency(r.valor_total)}
                                                    </td>
                                                    <td className="col-detalhamento-op">
                                                        <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                                            {memoria}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Linha de Subtotal do Grupo */}
                                        <tr className="bg-gray-200 font-bold print:bg-gray-100">
                                            <td colSpan={3} className="text-right p-1">SUBTOTAL OM {omNome}:</td>
                                            <td className="text-center p-1">
                                                {totalGrupoND15 > 0 && <span className="block">33.90.15</span>}
                                                {totalGrupoND30 > 0 && <span className="block">33.90.30</span>}
                                                {totalGrupoND33 > 0 && <span className="block">33.90.33</span>}
                                                {totalGrupoND39 > 0 && <span className="block">33.90.39</span>}
                                            </td>
                                            <td className="text-right p-1">{formatCurrency(totalGrupoGeral)}</td>
                                            <td className="p-1"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
            
            {/* Rodapé de Totais Finais */}
            <div className="mt-8 pt-4 border-t-2 border-black print:border-t print:border-gray-500">
                <h4 className="text-md font-bold mb-2">TOTAL GERAL DO PLANO DE TRABALHO OPERACIONAL</h4>
                <div className="grid grid-cols-4 gap-4 text-sm font-bold">
                    <div>ND 33.90.15: {formatCurrency(totaisGerais.totalND15)}</div>
                    <div>ND 33.90.30: {formatCurrency(totaisGerais.totalND30)}</div>
                    <div>ND 33.90.33: {formatCurrency(totaisGerais.totalND33)}</div>
                    <div>ND 33.90.39: {formatCurrency(totaisGerais.totalND39)}</div>
                </div>
                <p className="text-xl font-extrabold mt-2">TOTAL GERAL: {formatCurrency(totaisGerais.totalGeral)}</p>
            </div>
        </div>
    );
};

export default PTrabOperacionalReport;