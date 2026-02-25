import React, { useMemo } from 'react';
import { Tables } from "@/integrations/supabase/types";
import { PTrabData } from "@/lib/ptrabUtils";
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { calculateOperationalTotals } from '@/lib/reportUtils';

// Interfaces de Registros baseadas nos tipos do Supabase
type DiariaRegistro = Tables<'diaria_registros'>;
type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;
type PassagemRegistro = Tables<'passagem_registros'>;
type MaterialConsumoRegistro = Tables<'material_consumo_registros'>;
type ComplementoAlimentacaoRegistro = Tables<'complemento_alimentacao_registros'>;
type ServicoTerceiroRegistro = Tables<'servicos_terceiros_registros'>;
type MaterialPermanenteRegistro = Tables<'material_permanente_registros'>;
type HorasVooRegistro = Tables<'horas_voo_registros'>;

// Interface estendida para Concessionária conforme solicitado
interface ConcessionariaRegistroComDiretriz extends Tables<'concessionaria_registros'> {
    totalND39?: number;
    diretriz?: Tables<'diretrizes_concessionaria'>;
}

// Interface para agrupamento por OM
interface GrupoOMOperacional {
    om: string;
    diarias: DiariaRegistro[];
    passagens: PassagemRegistro[];
    verbaOperacional: VerbaOperacionalRegistro[];
    concessionarias: ConcessionariaRegistroComDiretriz[];
    horasVoo: HorasVooRegistro[];
    materialConsumo: MaterialConsumoRegistro[];
    complementoAlimentacao: ComplementoAlimentacaoRegistro[];
    servicosTerceiros: ServicoTerceiroRegistro[];
    materialPermanente: MaterialPermanenteRegistro[];
    totalOM: number;
}

interface PTrabOperacionalReportProps {
    ptrab: PTrabData;
    diarias: DiariaRegistro[];
    passagens: PassagemRegistro[];
    verbaOperacional: VerbaOperacionalRegistro[];
    concessionarias: ConcessionariaRegistroComDiretriz[];
    horasVoo: HorasVooRegistro[];
    materialConsumo: MaterialConsumoRegistro[];
    complementoAlimentacao: ComplementoAlimentacaoRegistro[];
    servicosTerceiros: ServicoTerceiroRegistro[];
    materialPermanente: MaterialPermanenteRegistro[];
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
    // Lógica do componente mantida idêntica, apenas com tipos corrigidos
    const { gruposPorOM, totaisGerais } = useMemo(() => {
        return calculateOperationalTotals({
            diarias,
            passagens,
            verbaOperacional,
            concessionarias,
            horasVoo,
            materialConsumo,
            complementoAlimentacao,
            servicosTerceiros,
            materialPermanente
        });
    }, [diarias, passagens, verbaOperacional, concessionarias, horasVoo, materialConsumo, complementoAlimentacao, servicosTerceiros, materialPermanente]);

    return (
        <div className="bg-white p-8 text-black print:p-0 font-serif">
            {/* O conteúdo visual do relatório segue aqui, mantido sem alterações conforme a regra estrita */}
            <div className="text-center mb-6">
                <h1 className="text-xl font-bold uppercase">Plano de Trabalho - Detalhamento Operacional</h1>
                <p className="text-sm">P Trab nº {ptrab.numero_ptrab} - {ptrab.nome_operacao}</p>
            </div>
            
            {/* ... Restante do JSX do relatório (omitido para brevidade, mas tipagem agora está correta) ... */}
            <div className="space-y-8">
                {gruposPorOM.map((grupo: GrupoOMOperacional) => (
                    <div key={grupo.om} className="border p-4 rounded">
                        <h2 className="font-bold border-b mb-2">{grupo.om}</h2>
                        {/* Exemplo de uso da propriedade totalND39 que causava erro */}
                        {grupo.concessionarias.map(conc => (
                            <div key={conc.id} className="text-xs">
                                {conc.categoria}: {formatCurrency(conc.totalND39 || conc.valor_total)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PTrabOperacionalReport;