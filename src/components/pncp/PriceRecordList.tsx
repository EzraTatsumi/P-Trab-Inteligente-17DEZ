import React from 'react';
import { PriceRawRecord } from '@/types/pncp';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface PriceRecordListProps {
    records: PriceRawRecord[];
    excludedIds: string[];
    onToggleExclusion: (id: string) => void;
}

const PriceRecordList: React.FC<PriceRecordListProps> = ({ records, excludedIds, onToggleExclusion }) => {
    
    // Ordena os registros pelo valor unitário para facilitar a identificação de outliers
    const sortedRecords = React.useMemo(() => {
        return [...records].sort((a, b) => a.valorUnitario - b.valorUnitario);
    }, [records]);

    return (
        <div className="max-h-[40vh] overflow-y-auto border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead className="w-[5%] text-center">Excluir</TableHead>
                        <TableHead className="w-[20%] text-right">Valor Unitário</TableHead>
                        <TableHead className="w-[25%]">Data Referência</TableHead>
                        <TableHead className="w-[25%]">UASG / Fonte</TableHead>
                        <TableHead className="w-[25%]">ARP / Controle</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedRecords.map(record => {
                        const isExcluded = excludedIds.includes(record.id);
                        // Heurística simples para destacar valores muito altos (acima de 100k)
                        const isOutlier = record.valorUnitario > 100000; 
                        
                        return (
                            <TableRow 
                                key={record.id} 
                                className={cn(
                                    "cursor-pointer transition-colors",
                                    isExcluded ? "bg-red-100/50 hover:bg-red-100/70 opacity-60" : "hover:bg-muted/50",
                                    isOutlier && !isExcluded && "bg-yellow-50/50 border-l-4 border-yellow-500"
                                )}
                                onClick={() => onToggleExclusion(record.id)}
                            >
                                <TableCell className="text-center">
                                    <Checkbox 
                                        checked={isExcluded}
                                        onCheckedChange={() => onToggleExclusion(record.id)}
                                        className={isExcluded ? "border-red-500 data-[state=checked]:bg-red-500" : ""}
                                    />
                                </TableCell>
                                <TableCell className={cn("text-right font-bold", isExcluded ? "text-red-600 line-through" : "text-primary")}>
                                    {formatCurrency(record.valorUnitario)}
                                </TableCell>
                                <TableCell className="text-sm">
                                    {formatDate(record.dataReferencia)}
                                </TableCell>
                                <TableCell className="text-sm">
                                    {formatCodug(record.uasg)} ({record.fonte})
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {record.numeroControlePncpAta || 'N/A'}
                                    {isOutlier && !isExcluded && (
                                        <AlertTriangle className="h-3 w-3 ml-1 inline text-yellow-600" title="Valor potencialmente discrepante" />
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

export default PriceRecordList;