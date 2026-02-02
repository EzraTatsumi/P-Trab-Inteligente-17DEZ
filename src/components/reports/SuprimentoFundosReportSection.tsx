import React, { useMemo } from 'react';
import { Wallet, AlertCircle } from 'lucide-react';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { VerbaOperacionalRegistro } from '@/pages/PTrabReportManager';
import { formatFasesParaTexto } from '@/pages/PTrabReportManager';
import { cn } from '@/lib/utils';

// Tipo para a função de memória de cálculo (passada via props)
type GenerateMemoriaFn = (registro: VerbaOperacionalRegistro) => string;

interface SuprimentoFundosReportSectionProps {
    registros: VerbaOperacionalRegistro[];
    generateSuprimentoFundosMemoriaCalculo: GenerateMemoriaFn;
    title: string;
}

interface ConsolidatedGroup {
    groupKey: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number; // Usamos 'efetivo' para Suprimento de Fundos
    fase_atividade: string;
    records: VerbaOperacionalRegistro[];
    totalGeral: number;
    totalND30: number;
    totalND39: number;
}

const SuprimentoFundosReportSection: React.FC<SuprimentoFundosReportSectionProps> = ({
    registros,
    generateSuprimentoFundosMemoriaCalculo,
    title,
}) => {

    // 1. Consolidação dos registros por lote de solicitação
    const consolidatedGroups = useMemo(() => {
        if (!registros || registros.length === 0) return [];

        const groups = registros.reduce((acc, registro) => {
            // Chave de consolidação: todos os campos que definem o lote de solicitação
            const key = [
                registro.organizacao,
                registro.ug,
                registro.om_detentora,
                registro.ug_detentora,
                registro.dias_operacao,
                registro.efetivo, // Usando efetivo
                registro.fase_atividade,
            ].join('|');

            if (!acc[key]) {
                acc[key] = {
                    groupKey: key,
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora || '',
                    ug_detentora: registro.ug_detentora || '',
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo || 0, // Usando efetivo
                    fase_atividade: registro.fase_atividade || 'operação',
                    records: [],
                    totalGeral: 0,
                    totalND30: 0,
                    totalND39: 0,
                };
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total_solicitado || 0);
            acc[key].totalND30 += Number(registro.valor_nd_30 || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedGroup>);

        // Ordenar por OM
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    if (consolidatedGroups.length === 0) {
        return null;
    }

    // 2. Cálculo do Total Geral da Seção
    const totalGeralSecao = consolidatedGroups.reduce((sum, group) => sum + group.totalGeral, 0);

    // 3. Renderização
    return (
        <div className="space-y-6 print:space-y-4">
            <h2 className="text-xl font-bold border-b-2 border-gray-300 pb-1 flex items-center gap-2 print:text-lg">
                <Wallet className="h-5 w-5 text-blue-600" />
                {title}
            </h2>

            {consolidatedGroups.map((group) => {
                const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                const diasText = group.dias_operacao === 1 ? 'dia' : 'dias';
                const efetivoText = group.efetivo === 1 ? 'militar' : 'militares';

                return (
                    <div key={group.groupKey} className="border p-4 rounded-lg bg-white shadow-sm print:border-none print:p-0 print:shadow-none print:mb-4">
                        
                        {/* Cabeçalho do Grupo Consolidado */}
                        <div className="flex justify-between items-start border-b pb-2 mb-3 print:border-b print:pb-1 print:mb-1">
                            <div className="flex flex-col">
                                <h3 className="font-bold text-lg text-gray-800 print:text-base">
                                    {group.organizacao} (UG: {formatCodug(group.ug)})
                                </h3>
                                <p className="text-sm text-muted-foreground print:text-xs">
                                    Período: {group.dias_operacao} {diasText} | Efetivo: {group.efetivo} {efetivoText} | Fase: {formatFasesParaTexto(group.fase_atividade)}
                                </p>
                                {isDifferentOm && (
                                    <p className="text-sm font-medium text-red-600 flex items-center gap-1 mt-1 print:text-xs print:text-red-800">
                                        <AlertCircle className="h-4 w-4 print:h-3 print:w-3" />
                                        Recurso Destino: {group.om_detentora} ({formatCodug(group.ug_detentora)})
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="font-extrabold text-xl text-blue-600 print:text-lg">
                                    {formatCurrency(group.totalGeral)}
                                </span>
                                <p className="text-xs text-muted-foreground print:text-[10px]">Total ND 30/39</p>
                            </div>
                        </div>

                        {/* Detalhes ND */}
                        <div className="flex justify-end gap-4 text-sm mt-2 print:text-xs">
                            <span className="font-medium text-green-600">ND 33.90.30 (Material Consumo): {formatCurrency(group.totalND30)}</span>
                            <span className="font-medium text-blue-600">ND 33.90.39 (Serviços Terceiros): {formatCurrency(group.totalND39)}</span>
                        </div>

                        {/* Memória de Cálculo Consolidada (para o grupo) */}
                        <div className="mt-4 pt-3 border-t border-gray-200 print:border-gray-400">
                            <h4 className="font-semibold text-sm mb-1 print:text-xs">Memória de Cálculo:</h4>
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded print:bg-white print:p-0 print:text-[10px] print:border-none">
                                {generateSuprimentoFundosMemoriaCalculo(group.records[0])}
                            </pre>
                        </div>
                    </div>
                );
            })}

            {/* Total da Seção */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-300 print:border-gray-500">
                <span className="text-lg font-bold print:text-base">TOTAL GERAL {title.toUpperCase()}</span>
                <span className="text-xl font-extrabold text-blue-700 print:text-lg">
                    {formatCurrency(totalGeralSecao)}
                </span>
            </div>
        </div>
    );
};

export default SuprimentoFundosReportSection;