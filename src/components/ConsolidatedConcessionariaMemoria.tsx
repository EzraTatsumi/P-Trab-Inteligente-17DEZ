import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from '@/lib/utils';
import { ConsolidatedConcessionariaRecord } from '@/types/concessionaria';
import { Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsolidatedConcessionariaMemoriaProps {
    consolidatedRecords: ConsolidatedConcessionariaRecord[];
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ConsolidatedConcessionariaMemoria: React.FC<ConsolidatedConcessionariaMemoriaProps> = ({
    consolidatedRecords,
    onEdit,
    onDelete,
}) => {
    const totalGeral = consolidatedRecords.reduce((sum, record) => sum + record.valor_total, 0);

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg">Registros de Custos de Concessionárias</CardTitle>
            </CardHeader>
            <CardContent>
                {consolidatedRecords.length === 0 ? (
                    <p className="text-center text-muted-foreground">Nenhum registro de concessionária adicionado.</p>
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Concessionária</TableHead>
                                    <TableHead>OM/UG Detentora</TableHead>
                                    <TableHead className="text-center">Efetivo</TableHead>
                                    <TableHead className="text-center">Dias</TableHead>
                                    <TableHead className="text-right">Custo Total (ND 39)</TableHead>
                                    <TableHead className="w-[100px] text-center">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {consolidatedRecords.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                            {record.categoria === 'AGUA_ESGOTO' ? 'Água/Esgoto' : 'Energia Elétrica'}
                                        </TableCell>
                                        <TableCell>{record.nome_concessionaria}</TableCell>
                                        <TableCell>{record.om_detentora} / {record.ug_detentora}</TableCell>
                                        <TableCell className="text-center">{record.efetivo}</TableCell>
                                        <TableCell className="text-center">{record.dias_operacao}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCurrency(record.valor_total)}
                                        </TableCell>
                                        <TableCell className="flex justify-center space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => onEdit(record.id)} title="Editar">
                                                <Edit className="h-4 w-4 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => onDelete(record.id)} title="Excluir">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="mt-4 pt-2 border-t flex justify-between items-center">
                            <span className="text-lg font-bold">Total Geral:</span>
                            <span className="text-xl font-bold text-primary">{formatCurrency(totalGeral)}</span>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};