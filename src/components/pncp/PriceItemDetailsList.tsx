import React from 'react';
import { PriceItemDetail } from '@/types/pncp';
import { formatCodug, formatCurrency, formatDate } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PriceItemDetailsListProps {
    items: PriceItemDetail[];
    isLoading: boolean;
    isError: boolean;
    onItemPreSelect: (item: PriceItemDetail) => void;
}

const PriceItemDetailsList: React.FC<PriceItemDetailsListProps> = ({ items, isLoading, isError, onItemPreSelect }) => {
    
    if (isLoading) {
        return (
            <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Carregando itens detalhados...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-8 text-red-500">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">Erro ao carregar detalhes de preço. Tente novamente.</p>
            </div>
        );
    }
    
    if (items.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Nenhum registro detalhado encontrado para este item.
            </div>
        );
    }

    return (
        <div className="max-h-[300px] overflow-y-auto border rounded-md mt-4">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead className="w-[10%] text-center">Data Ref.</TableHead>
                        <TableHead className="w-[15%] text-center">Cód. UASG</TableHead>
                        <TableHead className="w-[35%]">Nome UASG</TableHead>
                        <TableHead className="w-[20%]">Fonte</TableHead>
                        <TableHead className="w-[15%] text-right">Valor Unitário</TableHead>
                        <TableHead className="w-[5%] text-center">Sel.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map(item => (
                        <TableRow 
                            key={item.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => onItemPreSelect(item)}
                        >
                            <TableCell className="text-xs text-center py-2">
                                {formatDate(item.dataReferencia)}
                            </TableCell>
                            <TableCell className="text-xs text-center font-medium py-2">
                                {/* NOVO: Usando formatCodug para o código da UASG */}
                                {formatCodug(item.codigoUasg)}
                            </TableCell>
                            <TableCell className="text-xs py-2 max-w-xs whitespace-normal">
                                {/* NOVO: Exibindo o nome da UASG */}
                                {item.nomeUasg}
                            </TableCell>
                            <TableCell className="text-xs py-2">
                                {item.fonte}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-primary py-2">
                                {formatCurrency(item.valorUnitario)}
                            </TableCell>
                            <TableCell className="text-center py-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <Check className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default PriceItemDetailsList;