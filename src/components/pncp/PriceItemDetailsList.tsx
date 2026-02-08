import React from 'react';
import { PriceItemDetail } from '@/types/pncp';
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PriceItemDetailsListProps {
    items: PriceItemDetail[];
    // Função para alternar a seleção de um item
    onItemSelect: (item: PriceItemDetail) => void;
    // Array de IDs selecionados
    selectedItemIds: string[];
}

const PriceItemDetailsList: React.FC<PriceItemDetailsListProps> = ({ items, onItemSelect, selectedItemIds }) => {
    
    if (items.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Nenhum registro de preço detalhado encontrado.
            </div>
        );
    }

    return (
        <div className="max-h-[40vh] overflow-y-auto border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead className="w-[10%] text-center">Data Ref.</TableHead>
                        <TableHead className="w-[15%] text-center">UASG</TableHead>
                        <TableHead className="w-[40%]">Descrição Item</TableHead>
                        <TableHead className="w-[15%] text-right">Valor Unitário</TableHead>
                        <TableHead className="w-[10%] text-center">Fonte</TableHead>
                        <TableHead className="w-[10%] text-center">Selecionar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                            <TableRow 
                                key={item.id}
                                className={cn(
                                    "cursor-pointer transition-colors",
                                    isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"
                                )}
                                onClick={() => onItemSelect(item)}
                            >
                                <TableCell className="text-xs text-center py-2">{formatDate(item.dataReferencia)}</TableCell>
                                <TableCell className="text-xs text-center py-2">
                                    <span className="font-medium">{formatCodug(item.codigoUasg)}</span>
                                    <p className="text-[0.65rem] text-muted-foreground truncate">{item.nomeUasg}</p>
                                </TableCell>
                                <TableCell className="text-xs max-w-xs whitespace-normal py-2">
                                    {item.descricaoItem}
                                </TableCell>
                                <TableCell className="text-right text-sm font-bold text-primary py-2">
                                    {formatCurrency(item.valorUnitario)}
                                </TableCell>
                                <TableCell className="text-center text-xs py-2">{item.fonte}</TableCell>
                                <TableCell className="text-center py-2">
                                    <Check className={cn("h-4 w-4 mx-auto", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

export default PriceItemDetailsList;