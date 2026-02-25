import React, { useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { 
    PTrabData, 
    DiariaRegistro, 
    VerbaOperacionalRegistro, 
    PassagemRegistro, 
    ConcessionariaRegistro,
    HorasVooRegistro,
    MaterialConsumoRegistro,
    ComplementoAlimentacaoRegistro,
    ServicoTerceiroRegistro,
    GrupoOMOperacional,
    formatDate,
    calculateDays
} from "@/pages/PTrabReportManager";
import { formatCurrency, formatCodug } from '@/lib/formatUtils';

interface PTrabOperacionalReportProps {
    ptrab: PTrabData;
    diarias: DiariaRegistro[];
    passagens: PassagemRegistro[];
    verbaOperacional: VerbaOperacionalRegistro[];
    concessionarias: ConcessionariaRegistro[];
    horasVoo: HorasVooRegistro[];
    materialConsumo: MaterialConsumoRegistro[];
    complementoAlimentacao: ComplementoAlimentacaoRegistro[];
    servicosTerceiros: ServicoTerceiroRegistro[];
    materialPermanente: any[];
}

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
    ptrab,
    diarias,
    passagens,
    verbaOperacional,
    concessionarias,
    horasVoo,
    materialConsumo,
    complementoAlimentacao,
    servicosTerceiros,
    materialPermanente
}) => {
    // Correção cirúrgica: Cast para 'any' na chamada do supabase.from para evitar erro de tipagem
    const fetchRegistrosServicos = async () => {
        const { data, error } = await (supabase.from('servicos_terceiros_registros' as any)).select('*');
        if (error) throw error;
        return data;
    };

    return (
        <div className="bg-white p-8 text-black print:p-0 font-serif">
            <div className="text-center mb-6 border-b-2 border-black pb-4">
                <h1 className="text-xl font-bold uppercase">Plano de Trabalho - Aba Operacional</h1>
                <p className="text-sm font-bold mt-2">P TRAB Nº {ptrab.numero_ptrab} - {ptrab.nome_operacao}</p>
                <p className="text-xs mt-1">OM: {ptrab.nome_om_extenso || ptrab.nome_om}</p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="border p-2">
                        <p className="font-bold uppercase bg-gray-100 p-1 mb-2">Dados da Operação</p>
                        <p><strong>Período:</strong> {formatDate(ptrab.periodo_inicio)} a {formatDate(ptrab.periodo_fim)} ({calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias)</p>
                        <p><strong>Efetivo:</strong> {ptrab.efetivo_empregado}</p>
                    </div>
                </div>
            </div>
            
            <div id="tour-mat-consumo-row" className="mt-8 border p-4">
                <p className="text-sm italic text-gray-600">Conteúdo do relatório operacional consolidado...</p>
            </div>
        </div>
    );
};

export default PTrabOperacionalReport;