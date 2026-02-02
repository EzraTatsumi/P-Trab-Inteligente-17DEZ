import React, { useMemo } from 'react';
import { 
    PTrabData, 
    DiariaRegistro, 
    VerbaOperacionalRegistro, 
    PassagemRegistro, 
    ConcessionariaRegistro, 
    GrupoOM, 
    formatDate, 
    calculateDays, 
    formatFasesParaTexto,
    generateDiariaMemoriaCalculoUnificada,
    generateVerbaOperacionalMemoriaCalculada,
    generateSuprimentoFundosMemoriaCalculada,
    generatePassagemMemoriaCalculada,
    generateConcessionariaMemoriaCalculada,
} from '@/pages/PTrabReportManager';
import { Tables } from '@/integrations/supabase/types';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';

// =================================================================
// TIPOS DE PROPS
// =================================================================

interface PTrabOperacionalPrintReportProps {
    ptrabData: PTrabData;
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    fileSuffix: string;
    omsOrdenadas: string[];
    gruposPorOM: Record<string, GrupoOM>;
}

// =================================================================
// FUNÇÕES AUXILIARES DE CÁLCULO E FORMATAÇÃO
// =================================================================

const calculateOMTotals = (grupo: GrupoOM) => {
    // Diárias
    const totalDiariaND15 = grupo.linhasDiaria.reduce((sum, r) => sum + r.valor_nd_15, 0);
    const totalDiariaND30 = grupo.linhasDiaria.reduce((sum, r) => sum + r.valor_nd_30, 0);
    
    // Verba Operacional
    const totalVerbaND30 = grupo.linhasVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_30, 0);
    const totalVerbaND39 = grupo.linhasVerbaOperacional.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    // Suprimento de Fundos
    const totalSuprimentoND30 = grupo.linhasSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_30, 0);
    const totalSuprimentoND39 = grupo.linhasSuprimentoFundos.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    // Passagens
    const totalPassagemND33 = grupo.linhasPassagem.reduce((sum, r) => sum + r.valor_nd_33, 0);
    
    // Concessionária
    const totalConcessionariaND39 = grupo.linhasConcessionaria.reduce((sum, r) => sum + r.valor_nd_39, 0);
    
    // Totais por ND
    const totalND15 = totalDiariaND15;
    const totalND30 = totalDiariaND30 + totalVerbaND30 + totalSuprimentoND30;
    const totalND33 = totalPassagemND33;
    const totalND39 = totalVerbaND39 + totalSuprimentoND39 + totalConcessionariaND39;
    
    const totalGND3 = totalND15 + totalND30 + totalND33 + totalND39;

    return {
        totalND15,
        totalND30,
        totalND33,
        totalND39,
        totalGND3,
    };
};

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabOperacionalPrintReport: React.FC<PTrabOperacionalPrintReportProps> = ({
    ptrabData,
    diretrizesOperacionais,
    omsOrdenadas,
    gruposPorOM,
}) => {
    const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
    const anoReferencia = new Date(ptrabData.periodo_inicio).getFullYear();

    const gruposOperacionais = useMemo(() => {
        return omsOrdenadas
            .map(omName => ({
                omName,
                grupo: gruposPorOM[omName],
                totals: calculateOMTotals(gruposPorOM[omName]),
            }))
            .filter(item => item.totals.totalGND3 > 0);
    }, [omsOrdenadas, gruposPorOM]);
    
    const totalGeral = gruposOperacionais.reduce((sum, item) => sum + item.totals.totalGND3, 0);
    const totalGeralND15 = gruposOperacionais.reduce((sum, item) => sum + item.totals.totalND15, 0);
    const totalGeralND30 = gruposOperacionais.reduce((sum, item) => sum + item.totals.totalND30, 0);
    const totalGeralND33 = gruposOperacionais.reduce((sum, item) => sum + item.totals.totalND33, 0);
    const totalGeralND39 = gruposOperacionais.reduce((sum, item) => sum + item.totals.totalND39, 0);

    const renderDiariaRows = (registros: DiariaRegistro[]) => {
        return registros.map((r, index) => {
            const memoria = generateDiariaMemoriaCalculoUnificada(r, diretrizesOperacionais);
            const total = r.valor_nd_15 + r.valor_nd_30;
            
            return (
                <tr key={`diaria-${r.id}-${index}`} className="border-b border-gray-400">
                    <td className="p-1 text-xs font-semibold border-r border-gray-400 bg-gray-100 print:bg-gray-100" colSpan={1}>
                        DIÁRIAS
                    </td>
                    <td className="p-1 text-xs border-r border-gray-400 w-[100px]">
                        {r.organizacao}
                        <br />
                        <span className="text-[10px] text-gray-600">({formatCodug(r.ug)})</span>
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_15)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_30)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(total)}
                    </td>
                    <td className="p-1 text-xs whitespace-pre-wrap text-gray-700 w-[300px] print:text-[9px]">
                        {memoria}
                    </td>
                </tr>
            );
        });
    };
    
    const renderPassagemRows = (registros: PassagemRegistro[]) => {
        return registros.map((r, index) => {
            const memoria = generatePassagemMemoriaCalculada(r);
            
            return (
                <tr key={`passagem-${r.id}-${index}`} className="border-b border-gray-400">
                    <td className="p-1 text-xs font-semibold border-r border-gray-400 bg-gray-100 print:bg-gray-100" colSpan={1}>
                        PASSAGENS
                    </td>
                    <td className="p-1 text-xs border-r border-gray-400 w-[100px]">
                        {r.organizacao}
                        <br />
                        <span className="text-[10px] text-gray-600">({formatCodug(r.ug)})</span>
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_33)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_33)}
                    </td>
                    <td className="p-1 text-xs whitespace-pre-wrap text-gray-700 w-[300px] print:text-[9px]">
                        {memoria}
                    </td>
                </tr>
            );
        });
    };
    
    const renderVerbaRows = (registros: VerbaOperacionalRegistro[], tipo: 'VERBA' | 'SUPRIMENTO') => {
        return registros.map((r, index) => {
            const memoria = tipo === 'VERBA' 
                ? generateVerbaOperacionalMemoriaCalculada(r) 
                : generateSuprimentoFundosMemoriaCalculada(r);
            
            const total = r.valor_nd_30 + r.valor_nd_39;
            
            return (
                <tr key={`${tipo}-${r.id}-${index}`} className="border-b border-gray-400">
                    <td className="p-1 text-xs font-semibold border-r border-gray-400 bg-gray-100 print:bg-gray-100" colSpan={1}>
                        {tipo === 'VERBA' ? 'VERBA OPERACIONAL' : 'SUPRIMENTO DE FUNDOS'}
                    </td>
                    <td className="p-1 text-xs border-r border-gray-400 w-[100px]">
                        {r.organizacao}
                        <br />
                        <span className="text-[10px] text-gray-600">({formatCodug(r.ug)})</span>
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_30)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_39)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(total)}
                    </td>
                    <td className="p-1 text-xs whitespace-pre-wrap text-gray-700 w-[300px] print:text-[9px]">
                        {memoria}
                    </td>
                </tr>
            );
        });
    };
    
    const renderConcessionariaRows = (registros: ConcessionariaRegistro[]) => {
        return registros.map((r, index) => {
            const memoria = generateConcessionariaMemoriaCalculada(r);
            
            return (
                <tr key={`concessionaria-${r.id}-${index}`} className="border-b border-gray-400">
                    <td className="p-1 text-xs font-semibold border-r border-gray-400 bg-gray-100 print:bg-gray-100" colSpan={1}>
                        CONCESSIONÁRIA
                    </td>
                    <td className="p-1 text-xs border-r border-gray-400 w-[100px]">
                        {r.organizacao}
                        <br />
                        <span className="text-[10px] text-gray-600">({formatCodug(r.ug)})</span>
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_39)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400">
                        {formatCurrency(0)}
                    </td>
                    <td className="p-1 text-xs text-right border-r border-gray-400 bg-blue-50 print:bg-blue-50">
                        {formatCurrency(r.valor_nd_39)}
                    </td>
                    <td className="p-1 text-xs whitespace-pre-wrap text-gray-700 w-[300px] print:text-[9px]">
                        {memoria}
                    </td>
                </tr>
            );
        });
    };

    return (
        <div className="p-4 print:p-0">
            {/* Cabeçalho do Documento */}
            <div className="text-center mb-6 print:mb-3 print:text-xs">
                <p className="font-bold">MINISTÉRIO DA DEFESA</p>
                <p className="font-bold">EXÉRCITO BRASILEIRO</p>
                <p className="font-bold">{ptrabData.comando_militar_area.toUpperCase()}</p>
                <p className="font-bold">{ptrabData.nome_om_extenso?.toUpperCase()}</p>
                <h1 className="text-xl font-extrabold mt-2 print:text-base">PLANO DE TRABALHO OPERACIONAL</h1>
                <h2 className="text-lg font-semibold print:text-sm">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao.toUpperCase()}</h2>
            </div>

            {/* Dados Principais */}
            <div className="mb-6 text-sm print:text-[11px] font-medium space-y-1">
                <p>1. NOME DA OPERAÇÃO: {ptrabData.nome_operacao.toUpperCase()}</p>
                <p>2. PERÍODO: DE {formatDate(ptrabData.periodo_inicio)} A {formatDate(ptrabData.periodo_fim)} | Nr Dias: {diasOperacao}</p>
                <p>3. EFETIVO EMPREGADO: {ptrabData.efetivo_empregado}</p>
                <p>4. AÇÕES REALIZADAS OU A REALIZAR: {ptrabData.acoes}</p>
                <p>5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
            </div>

            {/* Tabela Principal */}
            <table className="w-full border-collapse border border-gray-400 text-left table-fixed">
                <thead>
                    <tr className="bg-gray-200 print:bg-gray-200">
                        <th className="p-1 text-xs font-bold border-r border-gray-400 w-[15%] print:text-[10px]">DESPESAS</th>
                        <th className="p-1 text-xs font-bold border-r border-gray-400 w-[10%] print:text-[10px]">OM (UG/CODUG)</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 w-[7%] print:text-[10px]" colSpan={5}>NATUREZA DE DESPESA</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 w-[7%] print:text-[10px]">GND 3</th>
                        <th className="p-1 text-xs font-bold border-gray-400 w-[30%] print:text-[10px]">DETALHAMENTO / MEMÓRIA DE CÁLCULO (DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)</th>
                    </tr>
                    <tr className="bg-gray-200 print:bg-gray-200">
                        <th className="p-1 text-xs font-bold border-r border-gray-400 print:text-[10px]"></th>
                        <th className="p-1 text-xs font-bold border-r border-gray-400 print:text-[10px]"></th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 print:text-[10px]">33.90.15</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 print:text-[10px]">33.90.30</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 print:text-[10px]">33.90.33</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 print:text-[10px]">33.90.39</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 print:text-[10px]">33.90.00</th>
                        <th className="p-1 text-xs font-bold text-center border-r border-gray-400 print:text-[10px]"></th>
                        <th className="p-1 text-xs font-bold border-gray-400 print:text-[10px]"></th>
                    </tr>
                </thead>
                <tbody>
                    {gruposOperacionais.map(({ omName, grupo, totals }) => (
                        <React.Fragment key={omName}>
                            {/* Linha de Título da OM */}
                            <tr className="bg-blue-100/50 border-y border-gray-400">
                                <td className="p-1 text-sm font-extrabold text-blue-800" colSpan={9}>
                                    VALOR TOTAL DA OM: {omName}
                                </td>
                            </tr>

                            {/* Registros de Diárias */}
                            {renderDiariaRows(grupo.linhasDiaria)}
                            
                            {/* Registros de Passagens */}
                            {renderPassagemRows(grupo.linhasPassagem)}
                            
                            {/* Registros de Verba Operacional */}
                            {renderVerbaRows(grupo.linhasVerbaOperacional, 'VERBA')}
                            
                            {/* Registros de Suprimento de Fundos */}
                            {renderVerbaRows(grupo.linhasSuprimentoFundos, 'SUPRIMENTO')}
                            
                            {/* Registros de Concessionária */}
                            {renderConcessionariaRows(grupo.linhasConcessionaria)}

                            {/* Linha de Soma por OM */}
                            <tr className="bg-blue-100 border-y border-gray-400 font-bold">
                                <td className="p-1 text-xs border-r border-gray-400" colSpan={2}>
                                    SOMA POR ND E GP DE DESPESA
                                </td>
                                <td className="p-1 text-xs text-right border-r border-gray-400">
                                    {formatCurrency(totals.totalND15)}
                                </td>
                                <td className="p-1 text-xs text-right border-r border-gray-400">
                                    {formatCurrency(totals.totalND30)}
                                </td>
                                <td className="p-1 text-xs text-right border-r border-gray-400">
                                    {formatCurrency(totals.totalND33)}
                                </td>
                                <td className="p-1 text-xs text-right border-r border-gray-400">
                                    {formatCurrency(totals.totalND39)}
                                </td>
                                <td className="p-1 text-xs text-right border-r border-gray-400">
                                    {formatCurrency(0)}
                                </td>
                                <td className="p-1 text-xs text-right border-r border-gray-400">
                                    {formatCurrency(totals.totalGND3)}
                                </td>
                                <td className="p-1 text-xs"></td>
                            </tr>
                        </React.Fragment>
                    ))}
                    
                    {/* Linha de Total Geral */}
                    <tr className="bg-gray-300 border-y-2 border-gray-800 font-extrabold">
                        <td className="p-1 text-sm border-r border-gray-800" colSpan={2}>
                            VALOR TOTAL DO P TRAB OPERACIONAL
                        </td>
                        <td className="p-1 text-sm text-right border-r border-gray-800">
                            {formatCurrency(totalGeralND15)}
                        </td>
                        <td className="p-1 text-sm text-right border-r border-gray-800">
                            {formatCurrency(totalGeralND30)}
                        </td>
                        <td className="p-1 text-sm text-right border-r border-gray-800">
                            {formatCurrency(totalGeralND33)}
                        </td>
                        <td className="p-1 text-sm text-right border-r border-gray-800">
                            {formatCurrency(totalGeralND39)}
                        </td>
                        <td className="p-1 text-sm text-right border-r border-gray-800">
                            {formatCurrency(0)}
                        </td>
                        <td className="p-1 text-sm text-right border-r border-gray-800">
                            {formatCurrency(totalGeral)}
                        </td>
                        <td className="p-1 text-sm"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default PTrabOperacionalPrintReport;