import React from 'react';
import { PTrabData, ClasseIRegistro } from "@/pages/PTrabReportManager";

interface PTrabRacaoOperacionalReportProps {
    ptrabData: PTrabData;
    registrosClasseI: ClasseIRegistro[];
    fileSuffix: string;
    generateClasseIMemoriaCalculo: (r: any, t: 'QS' | 'QR' | 'OP') => string;
}

const PTrabRacaoOperacionalReport: React.FC<PTrabRacaoOperacionalReportProps> = ({ ptrabData }) => {
    return (
        <div className="bg-white p-8 text-black font-serif">
            <h1 className="text-center text-xl font-bold uppercase underline">
                Relatório de Ração Operacional
            </h1>
            <p className="mt-4">Plano de Trabalho: {ptrabData.numero_ptrab}</p>
        </div>
    );
};

export default PTrabRacaoOperacionalReport;