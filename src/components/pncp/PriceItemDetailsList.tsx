import React from 'react';
import { PriceItemDetail } from '@/types/pncp';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { Loader2 } from 'lucide-react';

interface PriceItemDetailsListProps {
    items: PriceItemDetail[];
    isLoading: boolean;
    isError: boolean;
}

const PriceItemDetailsList: React.FC<PriceItemDetailsListProps> = ({ items, isLoading, isError }) => {
    if (isLoading) {
        return (
            <div className="text-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-1">Carregando itens detalhados...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-4 text-red-500 text-sm">
                Erro ao carregar a lista de itens.
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhum registro detalhado encontrado.
            </div>
        );
    }

    return (
        <div className="max-h-[300px] overflow-y-auto border rounded-md mt-4">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead className="w-[30%]">Descrição do Item</TableHead>
                        <TableHead className="w-[15%] text-center">Cód. UASG</TableHead>
                        <TableHead className="w-[35%]">Nome UASG</TableHead>
                        <TableHead className="w-[20%] text-right">Valor Unitário</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="text-sm max-w-xs whitespace-normal">
                                {item.descricaoItem}
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono">
                                {formatCodug(item.codigoUasg)}
                            </TableCell>
                            <TableCell className="text-sm">
                                {item.nomeUasg}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary text-sm">
                                {formatCurrency(item.valorUnitario)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default PriceItemDetailsList;