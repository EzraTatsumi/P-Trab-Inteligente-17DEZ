import React from 'react';
import { 
    PTrabData, 
    ClasseIRegistro, 
    ClasseIIRegistro, 
    ClasseIIIRegistro,
    GrupoOM,
    formatDate,
    calculateDays
} from "@/pages/PTrabReportManager";
import { formatCurrency } from '@/lib/formatUtils';

interface PTrabLogisticoReportProps {
    ptrabData: PTrabData;
    registrosClasseI: ClasseIRegistro[];
    registrosClasseII: ClasseIIRegistro[];
    registrosClasseIII: ClasseIIIRegistro[];
    nomeRM: string;
    omsOrdenadas: string[];
    gruposPorOM: Record<string, GrupoOM>;
    calcularTotaisPorOM: (grupo: GrupoOM, om: string) => any;
    fileSuffix: string;
    generateClasseIMemoriaCalculo: (r: any, t: 'QS' | 'QR' | 'OP') => string;
    generateClasseIIMemoriaCalculo: (r: any, b: boolean) => string;
    generateClasseVMemoriaCalculo: (r: any) => string;
    generateClasseVIMemoriaCalculo: (r: any) => string;
    generateClasseVIIMemoriaCalculo: (r: any) => string;
    generateClasseVIIIMemoriaCalculo: (r: any) => string;
}

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = (props) => {
    return (
        <div className="bg-white p-8 text-black font-serif">
            <h1 className="text-center text-xl font-bold uppercase border-b-2 border-black pb-4">
                Detalhamento Logístico do P Trab
            </h1>
            <div className="mt-4 text-sm">
                <p><strong>P Trab:</strong> {props.ptrabData.numero_ptrab}</p>
                <p><strong>Operação:</strong> {props.ptrabData.nome_operacao}</p>
            </div>
        </div>
    );
};

export default PTrabLogisticoReport;