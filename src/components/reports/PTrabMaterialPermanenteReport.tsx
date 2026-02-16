import React from 'react';
import { PTrabData, MaterialPermanenteRegistro } from '@/pages/PTrabReportManager';
import { formatCurrency, formatNumber, calculateDays, formatDate } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PTrabMaterialPermanenteReportProps {
    ptrabData: PTrabData;
    registrosMaterialPermanente: MaterialPermanenteRegistro[];
    fileSuffix: string;
}

const PTrabMaterialPermanenteReport: React.FC<PTrabMaterialPermanenteReportProps> = ({
    ptrabData,
    registrosMaterialPermanente,
}) => {
    const totalGeral = registrosMaterialPermanente.reduce((acc, r) => acc + (r.valor_total || 0), 0);

    return (
        <div className="bg-white p-8 text-black font-serif max-w-[21cm] mx-auto shadow-sm print:shadow-none print:p-0">
            {/* Cabeçalho com espaçamento reduzido */}
            <div className="text-center uppercase font-bold text-[12pt] leading-tight space-y-0.5 mb-8">
                <p>MINISTÉRIO DA DEFESA</p>
                <p>EXÉRCITO BRASILEIRO</p>
                <p>{ptrabData.comando_militar_area}</p>
                <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
                
                {/* Linhas de título ajustadas */}
                <div className="pt-4 space-y-1">
                    <p className="text-[11pt]">
                        PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO {ptrabData.nome_operacao}
                    </p>
                    <p className="text-[11pt] underline underline-offset-4">
                        PLANO DE TRABALHO DE MATERIAL PERMANENTE
                    </p>
                </div>
            </div>

            {/* Dados da Operação */}
            <div className="space-y-2 mb-6 text-[11pt]">
                <p><strong>1. NOME DA OPERAÇÃO:</strong> {ptrabData.nome_operacao}</p>
                <p>
                    <strong>2. PERÍODO:</strong> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - 
                    Nr Dias: {calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim)}
                </p>
                <p><strong>3. EFETIVO EMPREGADO:</strong> {ptrabData.efetivo_empregado}</p>
                <p><strong>4. AÇÕES REALIZADAS OU A REALIZAR:</strong> {ptrabData.acoes}</p>
                <p><strong>5. DESPESAS DE MATERIAL PERMANENTE REALIZADAS OU A REALIZAR:</strong></p>
            </div>

            {/* Tabela de Registros */}
            <div className="border rounded-md overflow-hidden mb-8">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20 border-b-2 border-black">
                            <TableHead className="text-black font-bold text-center border-r">OM / UG</TableHead>
                            <TableHead className="text-black font-bold text-center border-r">Categoria</TableHead>
                            <TableHead className="text-black font-bold text-center border-r">Fase</TableHead>
                            <TableHead className="text-black font-bold text-right">Valor Total (ND 52)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {registrosMaterialPermanente.map((reg) => (
                            <TableRow key={reg.id} className="border-b border-black/20 hover:bg-transparent">
                                <TableCell className="text-center border-r py-2">
                                    <div className="font-bold">{reg.organizacao}</div>
                                    <div className="text-xs text-muted-foreground">{reg.ug}</div>
                                </TableCell>
                                <TableCell className="text-center border-r py-2">{reg.categoria}</TableCell>
                                <TableCell className="text-center border-r py-2">{reg.fase_atividade || '-'}</TableCell>
                                <TableCell className="text-right font-bold py-2">{formatCurrency(reg.valor_total || 0)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-muted/10 hover:bg-muted/10 font-bold border-t-2 border-black">
                            <TableCell colSpan={3} className="text-right uppercase py-3">Total Geral Material Permanente:</TableCell>
                            <TableCell className="text-right text-lg py-3">{formatCurrency(totalGeral)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            {/* Assinatura */}
            <div className="mt-16 text-center space-y-1 max-w-[300px] mx-auto border-t border-black pt-2">
                <p className="font-bold uppercase">{ptrabData.nome_cmt_om}</p>
                <p className="text-sm">Comandante da OM</p>
            </div>
        </div>
    );
};

export default PTrabMaterialPermanenteReport;