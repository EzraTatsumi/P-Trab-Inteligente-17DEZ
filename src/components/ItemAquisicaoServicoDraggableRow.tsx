import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { GripVertical } from "lucide-react";
import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { cn } from '@/lib/utils';

interface ItemAquisicaoServicoDraggableRowProps {
    item: ItemAquisicaoServico;
    diretrizId: string;
}

const ItemAquisicaoServicoDraggableRow: React.FC<ItemAquisicaoServicoDraggableRowProps> = ({
    item,
    diretrizId,
}) => {
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ item, sourceDiretrizId: diretrizId }));
        e.dataTransfer.effectAllowed = "move";
    };

    return (
        <TableRow 
            draggable 
            onDragStart={handleDragStart}
            className="group hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing"
        >
            <TableCell className="px-4 py-2 text-center">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </TableCell>
            <TableCell className="px-4 py-2 text-xs font-medium">
                {item.descricao_reduzida || (item as any).nome_reduzido || 'N/A'}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs">
                {item.codigo_catser || item.codigo_catmat || 'N/A'}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs text-muted-foreground">
                {(item as any).unidade_medida || 'UN'}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs">
                {formatPregao(item.numero_pregao)}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs">
                {formatCodug(item.uasg)}
            </TableCell>
            <TableCell className="px-4 py-2 text-center text-xs font-bold">
                {formatCurrency(item.valor_unitario)}
            </TableCell>
        </TableRow>
    );
};

export default ItemAquisicaoServicoDraggableRow;