import React from 'react';
import { PTrabData, HorasVooRegistro } from "@/pages/PTrabReportManager";

interface PTrabHorasVooReportProps {
    ptrabData: PTrabData;
    omsOrdenadas: string[];
    gruposPorOM: Record<string, HorasVooRegistro[]>;
    fileSuffix: string;
}

const PTrabHorasVooReport: React.FC<PTrabHorasVooReportProps> = ({ ptrabData }) => {
    return (
        <div className="bg-white p-8 text-black font-serif">
            <h1 className="text-center text-xl font-bold uppercase">
                Relatório de Horas de Voo (AvEx)
            </h1>
            <p className="mt-4">Operação: {ptrabData.nome_operacao}</p>
        </div>
    );
};

export default PTrabHorasVooReport;