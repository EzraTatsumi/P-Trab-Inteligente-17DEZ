import React, { useMemo } from 'react';
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro, formatDate, calculateDays } from "@/pages/PTrabReportManager";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatNumber } from "@/lib/formatUtils";
import { Droplet, Zap, Plane, Briefcase, ClipboardList, Users, Calendar, MapPin, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConcessionariaRegistroComDiretriz } from "@/lib/concessionariaUtils";

// Tipos de funções de memória (passadas como props)
type MemoriaDiariaFn = (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
type MemoriaVerbaFn = (registro: VerbaOperacionalRegistro) => string;
type MemoriaPassagemFn = (registro: PassagemRegistro) => string;
type MemoriaConcessionariaFn = (registro: ConcessionariaRegistro & ConcessionariaRegistroComDiretriz) => string;

interface PTrabOperacionalReportProps {
    ptrabData: PTrabData;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: ConcessionariaRegistro[]; // NEW PROP
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    fileSuffix: string;
    generateDiariaMemoriaCalculo: MemoriaDiariaFn;
    generateVerbaOperacionalMemoriaCalculo: MemoriaVerbaFn;
    generateSuprimentoFundosMemoriaCalculo: MemoriaVerbaFn;
    generatePassagemMemoriaCalculo: MemoriaPassagemFn;
    generateConcessionariaMemoriaCalculo: MemoriaConcessionariaFn; // NEW PROP
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
    concessionaria: ConcessionariaRegistro[]; // NEW
    totalGeral: number;
    totalND15: number;
    totalND30: number;
    totalND33: number;
    totalND39: number;
}

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
    ptrabData,
    registrosDiaria,
    registrosVerbaOperacional,
    registrosSuprimentoFundos,
    registrosPassagem,
    registrosConcessionaria, // NEW
    diretrizesOperacionais,
    generateDiariaMemoriaCalculo,
    generateVerbaOperacionalMemoriaCalculo,
    generateSuprimentoFundosMemoriaCalculo,
    generatePassagemMemoriaCalculo,
    generateConcessionariaMemoriaCalculo, // NEW
}) => {
    
    const diasTotais = useMemo(() => calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim), [ptrabData]);

    const gruposPorOM = useMemo(() => {
        // Garantir que todas as props de registros sejam arrays antes de usar o spread
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
            ...safeRegistrosConcessionaria.map(r => ({ ...r, type: 'concessionaria' as const })), // NEW
        ];

        const groups: Record<string, GrupoOperacional> = {};

        allRecords.forEach(record => {
            // A chave de agrupamento deve ser a OM Favorecida, UG, Fase, Dias e Efetivo
            const key = `${record.organizacao}|${record.ug}|${record.fase_atividade}|${record.dias_operacao}|${record.efetivo || 0}`;
            
            if (!groups[key]) {
                groups[key] = {
                    organizacao: record.organizacao,
                    ug: record.ug,
                    fase_atividade: record.fase_atividade || 'Não Definida',
                    dias_operacao: record.dias_operacao,
                    efetivo: record.efetivo || 0,
                    diarias: [],
                    verbaOperacional: [],
                    suprimentoFundos: [],
                    passagens: [],
                    concessionaria: [], // NEW
                    totalGeral: 0,
                    totalND15: 0,
                    totalND30: 0,
                    totalND33: 0,
                    totalND39: 0,
                };
            }

            const group = groups[key];
            
            if (record.type === 'diaria') {
                group.diarias.push(record as DiariaRegistro);
                group.totalND15 += Number(record.valor_nd_15 || 0);
                group.totalND30 += Number(record.valor_nd_30 || 0); // Taxa de Embarque
            } else if (record.type === 'verba') {
                group.verbaOperacional.push(record as VerbaOperacionalRegistro);
                group.totalND30 += Number(record.valor_nd_30 || 0);
                group.totalND39 += Number(record.valor_nd_39 || 0);
            } else if (record.type === 'suprimento') {
                group.suprimentoFundos.push(record as VerbaOperacionalRegistro);
                group.totalND30 += Number(record.valor_nd_30 || 0);
                group.totalND39 += Number(record.valor_nd_39 || 0);
            } else if (record.type === 'passagem') {
                group.passagens.push(record as PassagemRegistro);
                group.totalND33 += Number(record.valor_nd_33 || 0);
            } else if (record.type === 'concessionaria') { // NEW
                group.concessionaria.push(record as ConcessionariaRegistro);
                group.totalND39 += Number(record.valor_nd_39 || 0);
            }
            
            group.totalGeral = group.totalND15 + group.totalND30 + group.totalND33 + group.totalND39;
        });

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registrosDiaria, registrosVerbaOperacional, registrosSuprimentoFundos, registrosPassagem, registrosConcessionaria]); // NEW dependency

    const totaisGerais = useMemo(() => {
        return gruposPorOM.reduce((acc, group) => {
            acc.totalGeral += group.totalGeral;
            acc.totalND15 += group.totalND15;
            acc.totalND30 += group.totalND30;
            acc.totalND33 += group.totalND33;
            acc.totalND39 += group.totalND39;
            return acc;
        }, { totalGeral: 0, totalND15: 0, totalND30: 0, totalND33: 0, totalND39: 0 });
    }, [gruposPorOM]);

    const renderHeader = () => (
        <div className="mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-center">PLANO DE TRABALHO OPERACIONAL</h1>
            <h2 className="text-lg font-semibold text-center mt-1">{ptrabData.nome_operacao}</h2>
            <div className="text-sm text-center mt-2">
                <p>OM: {ptrabData.nome_om_extenso} ({ptrabData.nome_om})</p>
                <p>Período: {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} ({diasTotais} dias)</p>
                <p>Efetivo Empregado: {ptrabData.efetivo_empregado}</p>
            </div>
        </div>
    );

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
        
        // 4. Passagens
        group.passagens.forEach(r => {
            const memoria = generatePassagemMemoriaCalculo(r);
            allMemories.push({ 
                title: `Passagens - ${r.origem} -> ${r.destino}`, 
                content: memoria, 
                nd: `ND 33.90.33`,
                icon: Plane,
            });
        });
        
        // 5. Concessionária (NEW)
        group.concessionaria.forEach(r => {
            // Para gerar a memória, precisamos enriquecer o registro com os detalhes da diretriz
            // Como não temos acesso fácil às diretrizes aqui, vamos usar um objeto mockado/cast para satisfazer a interface
            const enrichedRecord: ConcessionariaRegistro & ConcessionariaRegistroComDiretriz = {
                ...r,
                // Estes campos são necessários para a função de memória, mas não estão no registro DB.
                // No contexto real, eles seriam buscados ou passados. Aqui, usamos placeholders/inferência.
                nome_concessionaria: r.detalhamento?.split(' - ')[1] || r.categoria,
                unidade_custo: 'unidade', 
                fonte_consumo: null,
                fonte_custo: null,
            };
            
            const memoria = generateConcessionariaMemoriaCalculo(enrichedRecord);
            allMemories.push({ 
                title: `Concessionária - ${r.categoria}`, 
                content: memoria, 
                nd: `ND 33.90.39`,
                icon: r.categoria === 'Água/Esgoto' ? Droplet : Zap,
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

    return (
        <div className="space-y-8">
            {renderHeader()}

            {/* TABELA DE RESUMO POR OM */}
            <section className="break-inside-avoid">
                <h3 className="text-xl font-bold mb-4 border-b pb-2">1. Resumo de Custos Operacionais por OM Favorecida</h3>
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100 border-b border-t font-semibold">
                            <th className="p-2 text-left w-[20%]">OM Favorecida (UG)</th>
                            <th className="p-2 text-center w-[10%]">Fase / Dias / Efetivo</th>
                            <th className="p-2 text-right w-[15%]">ND 33.90.15 (Diárias)</th>
                            <th className="p-2 text-right w-[15%]">ND 33.90.30 (Diversos)</th>
                            <th className="p-2 text-right w-[15%]">ND 33.90.33 (Passagens)</th>
                            <th className="p-2 text-right w-[15%]">ND 33.90.39 (Serv. Terceiros)</th>
                            <th className="p-2 text-right w-[10%]">TOTAL GERAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gruposPorOM.map((group, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">
                                    {group.organizacao} ({formatCodug(group.ug)})
                                </td>
                                <td className="p-2 text-center text-xs">
                                    {group.fase_atividade} / {group.dias_operacao} dias / {group.efetivo} mil
                                </td>
                                <td className="p-2 text-right text-blue-600 font-medium">
                                    {formatCurrency(group.totalND15)}
                                </td>
                                <td className="p-2 text-right text-green-600 font-medium">
                                    {formatCurrency(group.totalND30)}
                                </td>
                                <td className="p-2 text-right text-purple-600 font-medium">
                                    {formatCurrency(group.totalND33)}
                                </td>
                                <td className="p-2 text-right text-red-600 font-medium">
                                    {formatCurrency(group.totalND39)}
                                </td>
                                <td className="p-2 text-right font-bold">
                                    {formatCurrency(group.totalGeral)}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-gray-200 font-bold border-t-2 border-black">
                            <td className="p-2" colSpan={2}>TOTAL GERAL DO P TRAB</td>
                            <td className="p-2 text-right text-blue-600">{formatCurrency(totaisGerais.totalND15)}</td>
                            <td className="p-2 text-right text-green-600">{formatCurrency(totaisGerais.totalND30)}</td>
                            <td className="p-2 text-right text-purple-600">{formatCurrency(totaisGerais.totalND33)}</td>
                            <td className="p-2 text-right text-red-600">{formatCurrency(totaisGerais.totalND39)}</td>
                            <td className="p-2 text-right">{formatCurrency(totaisGerais.totalGeral)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* MEMÓRIAS DE CÁLCULO */}
            <section className="mt-8">
                <h3 className="text-xl font-bold mb-4 border-b pb-2">2. Memórias de Cálculo Detalhadas</h3>
                <div className="space-y-8">
                    {gruposPorOM.map((group, index) => (
                        <div key={index} className="border p-4 rounded-lg shadow-sm break-inside-avoid">
                            <h4 className="text-lg font-bold mb-3 flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                {group.organizacao} (UG: {formatCodug(group.ug)})
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Período: {group.dias_operacao} dias</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Fase: {group.fase_atividade}</span>
                                </div>
                            </div>
                            {renderMemoriaCalculo(group)}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default PTrabOperacionalReport;