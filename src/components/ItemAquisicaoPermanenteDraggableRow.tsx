import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { GripVertical } from "lucide-react";
import { ItemAquisicaoPermanente } from "@/types/diretrizesMaterialPermanente";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { cn } from '@/lib/utils';

interface ItemAquisicaoPermanenteDraggableRowProps {
    item: ItemAquisicaoPermanente;
    diretrizId: string;
}

const ItemAquisicaoPermanenteDraggableRow: React.FC<ItemAquisicaoPermanenteDraggableRowProps> = ({
    item,
    diretrizId,
}) => {
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
        // Armazena os dados do item e a diretriz de origem no dataTransfer
        const data = JSON.stringify({
            item: item,
            sourceDiretrizId: diretrizId,
        });
        e.dataTransfer.setData("application/json", data);
        e.dataTransfer.effectAllowed = "move";
    };

    return (
        <TableRow 
            draggable 
            onDragStart={handleDragStart}
            className="group hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing"
        >
            <TableCell className="px-4 py-2 text-center w-[20px]">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </TableCell>
            <TableCell className="px-4 py-2">
                <div className="flex flex-col">
                    <span className="font-bold text-sm">{item.descricao_reduzida || 'N/A'}</span>
                </div>
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs">
                {item.codigo_catmat || 'N/A'}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs">
                {formatPregao(item.numero_pregao)}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs">
                {formatCodug(item.uasg)}
            </TableCell>
            <TableCell className="px-4 py-2 text-center font-bold text-sm">
                {formatCurrency(item.valor_unitario)}
            </TableCell>
        </TableRow>
    );
};

export default ItemAquisicaoPermanenteDraggableRow;