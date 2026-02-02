import React, { useMemo } from 'react';
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro, PassagemRegistro, ConcessionariaRegistro } from '@/pages/PTrabReportManager';
import { Tables } from '@/integrations/supabase/types';
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { calculateDays } from '@/pages/PTrabReportManager';
import DiariaReportSection from './DiariaReportSection';
import VerbaOperacionalReportSection from './VerbaOperacionalReportSection';
import SuprimentoFundosReportSection from './SuprimentoFundosReportSection';
import PassagemReportSection from './PassagemReportSection';
import ConcessionariaReportSection from './ConcessionariaReportSection'; // NOVO: Importar a seção de Concessionária

// Tipos para as funções de memória de cálculo (passadas via props)
type GenerateDiariaMemoriaFn = (registro: DiariaRegistro, diretrizesOp: Tables<'diretrizes_operacionais'> | null) => string;
type GenerateVerbaOperacionalMemoriaFn = (registro: VerbaOperacionalRegistro) => string;
type GeneratePassagemMemoriaFn = (registro: PassagemRegistro) => string;
type GenerateConcessionariaMemoriaFn = (registro: ConcessionariaRegistro) => string; // NOVO

interface PTrabOperacionalReportProps {
    ptrabData: PTrabData;
    registrosDiaria: DiariaRegistro[];
    registrosVerbaOperacional: VerbaOperacionalRegistro[];
    registrosSuprimentoFundos: VerbaOperacionalRegistro[];
    registrosPassagem: PassagemRegistro[];
    registrosConcessionaria: ConcessionariaRegistro[]; // NOVO
    diretrizesOperacionais: Tables<'diretrizes_operacionais'> | null;
    fileSuffix: string;
    generateDiariaMemoriaCalculo: GenerateDiariaMemoriaFn;
    generateVerbaOperacionalMemoriaCalculo: GenerateVerbaOperacionalMemoriaFn;
    generateSuprimentoFundosMemoriaCalculo: GenerateVerbaOperacionalMemoriaFn;
    generatePassagemMemoriaCalculo: GeneratePassagemMemoriaFn;
    generateConcessionariaMemoriaCalculo: GenerateConcessionariaMemoriaFn; // NOVO
}

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
    ptrabData,
    registrosDiaria,
    registrosVerbaOperacional,
    registrosSuprimentoFundos,
    registrosPassagem,
    registrosConcessionaria, // NOVO
    diretrizesOperacionais,
    fileSuffix,
    generateDiariaMemoriaCalculo,
    generateVerbaOperacionalMemoriaCalculo,
    generateSuprimentoFundosMemoriaCalculo,
    generatePassagemMemoriaCalculo,
    generateConcessionariaMemoriaCalculo, // NOVO
}) => {
    
    const totalDiaria = registrosDiaria.reduce((sum, r) => sum + (r.valor_total || 0), 0);
    const totalVerbaOperacional = registrosVerbaOperacional.reduce((sum, r) => sum + (r.valor_nd_30 || 0) + (r.valor_nd_39 || 0), 0);
    const totalSuprimentoFundos = registrosSuprimentoFundos.reduce((sum, r) => sum + (r.valor_nd_30 || 0) + (r.valor_nd_39 || 0), 0);
    const totalPassagem = registrosPassagem.reduce((sum, r) => sum + (r.valor_nd_33 || 0), 0);
    const totalConcessionaria = registrosConcessionaria.reduce((sum, r) => sum + (r.valor_nd_39 || 0), 0); // NOVO

    const totalGeralOperacional = totalDiaria + totalVerbaOperacional + totalSuprimentoFundos + totalPassagem + totalConcessionaria; // NOVO

    const headerData = useMemo(() => ({
        numero_ptrab: ptrabData.numero_ptrab,
        nome_om: ptrabData.nome_om,
        nome_om_extenso: ptrabData.nome_om_extenso,
        codug_om: ptrabData.codug_om,
        rm_vinculacao: ptrabData.rm_vinculacao,
        codug_rm_vinculacao: ptrabData.codug_rm_vinculacao,
        nome_operacao: ptrabData.nome_operacao,
        periodo_inicio: formatDate(ptrabData.periodo_inicio),
        periodo_fim: formatDate(ptrabData.periodo_fim),
        dias_operacao: calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim),
        efetivo_empregado: ptrabData.efetivo_empregado,
        acoes: ptrabData.acoes,
        nome_cmt_om: ptrabData.nome_cmt_om,
        local_om: ptrabData.local_om,
        updated_at: formatDate(ptrabData.updated_at),
    }), [ptrabData]);

    return (
        <div className="p-6 bg-white shadow-lg min-h-[297mm] print:p-0 print:shadow-none print:min-h-0">
            
            {/* Cabeçalho do Relatório (Visível apenas na impressão) */}
            <div className="hidden print:block mb-6">
                <h1 className="text-xl font-bold text-center mb-1">PLANO DE TRABALHO OPERACIONAL</h1>
                <p className="text-sm text-center text-gray-700">
                    {headerData.nome_om_extenso} ({headerData.nome_om}) - UG: {formatCodug(headerData.codug_om)}
                </p>
                <p className="text-xs text-center text-gray-600">
                    {headerData.nome_operacao} | Período: {headerData.periodo_inicio} a {headerData.periodo_fim} ({headerData.dias_operacao} dias)
                </p>
                <p className="text-xs text-center text-gray-600 mt-1">
                    Número P Trab: {headerData.numero_ptrab} | Versão: {headerData.updated_at}
                </p>
                <div className="border-b border-gray-400 mt-2" />
            </div>

            <div className="space-y-8 print:space-y-4">
                
                {/* Seção de Diárias */}
                <DiariaReportSection
                    registros={registrosDiaria}
                    diretrizesOperacionais={diretrizesOperacionais}
                    generateDiariaMemoriaCalculo={generateDiariaMemoriaCalculo}
                />

                {/* Seção de Passagens */}
                <PassagemReportSection
                    registros={registrosPassagem}
                    generatePassagemMemoriaCalculo={generatePassagemMemoriaCalculo}
                />
                
                {/* Seção de Verba Operacional */}
                <VerbaOperacionalReportSection
                    registros={registrosVerbaOperacional}
                    generateVerbaOperacionalMemoriaCalculo={generateVerbaOperacionalMemoriaCalculo}
                    title="Verba Operacional (ND 33.90.30 / 33.90.39)"
                />
                
                {/* Seção de Suprimento de Fundos */}
                <SuprimentoFundosReportSection
                    registros={registrosSuprimentoFundos}
                    generateSuprimentoFundosMemoriaCalculo={generateSuprimentoFundosMemoriaCalculo}
                    title="Suprimento de Fundos (ND 33.90.30 / 33.90.39)"
                />
                
                {/* NOVO: Seção de Concessionária */}
                <ConcessionariaReportSection
                    registros={registrosConcessionaria}
                    generateConcessionariaMemoriaCalculo={generateConcessionariaMemoriaCalculo}
                />

                {/* Total Geral Operacional */}
                <div className="mt-8 pt-4 border-t-4 border-blue-500 print:border-t-4 print:border-blue-700">
                    <div className="flex justify-between items-center">
                        <span className="text-2xl font-extrabold text-gray-800 print:text-xl">
                            TOTAL GERAL ABA OPERACIONAL
                        </span>
                        <span className="text-3xl font-extrabold text-blue-700 print:text-2xl">
                            {formatCurrency(totalGeralOperacional)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PTrabOperacionalReport;