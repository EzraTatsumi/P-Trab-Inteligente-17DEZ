"use client";

import React from 'react';
import { PTrabData } from '@/pages/PTrabReportManager';

interface ReportFooterProps {
    ptrabData: PTrabData;
}

const ReportFooter: React.FC<ReportFooterProps> = ({ ptrabData }) => {
    const today = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div className="report-footer mt-12 space-y-12 pb-8">
            <div className="flex flex-col items-center justify-center text-center space-y-1">
                <p className="font-medium">{ptrabData.local_om || 'Local não informado'}, {today}.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16">
                <div className="flex flex-col items-center text-center">
                    <div className="w-64 border-t border-black mb-2"></div>
                    <p className="font-bold text-sm uppercase">{ptrabData.nome_cmt_om || 'Comandante da OM'}</p>
                    <p className="text-xs uppercase">Ordenador de Despesas</p>
                </div>
                
                <div className="flex flex-col items-center text-center">
                    <div className="w-64 border-t border-black mb-2"></div>
                    <p className="font-bold text-sm uppercase">Oficial de Logística / Operações</p>
                    <p className="text-xs uppercase">Encarregado do P Trab</p>
                </div>
            </div>
            
            <div className="pt-8 border-t border-dashed border-gray-300 text-[10px] text-center text-gray-400 print:hidden">
                Documento gerado eletronicamente pelo Sistema P Trab Inteligente em {new Date().toLocaleString('pt-BR')}.
            </div>
        </div>
    );
};

export default ReportFooter;