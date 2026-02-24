"use client";

import React from 'react';
import { PTrabData } from '@/pages/PTrabReportManager';

interface ReportHeaderProps {
    ptrabData: PTrabData;
    reportTitle: string;
    fileSuffix?: string;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ ptrabData, reportTitle }) => {
    return (
        <div className="report-header space-y-4 mb-6">
            <div className="flex justify-between items-start border-b-2 border-black pb-4">
                <div className="space-y-1">
                    <h1 className="text-xl font-black uppercase tracking-tight">MINISTÉRIO DA DEFESA</h1>
                    <h2 className="text-lg font-bold uppercase">{ptrabData.comando_militar_area}</h2>
                    <h3 className="text-md font-semibold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</h3>
                </div>
                <div className="text-right space-y-1">
                    <div className="inline-block border-2 border-black px-4 py-1 font-bold text-lg">
                        {ptrabData.numero_ptrab}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                        Plano de Trabalho Inteligente
                    </p>
                </div>
            </div>
            
            <div className="text-center py-4 bg-muted/20 border-y border-black/10">
                <h2 className="text-2xl font-black uppercase tracking-widest">{reportTitle}</h2>
                <p className="text-sm font-bold mt-1 uppercase">OPERAÇÃO: {ptrabData.nome_operacao}</p>
            </div>
        </div>
    );
};

export default ReportHeader;