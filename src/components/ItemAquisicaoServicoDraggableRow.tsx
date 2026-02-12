import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { GripVertical } from "lucide-react";
import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";

interface ItemAquisicaoServicoDraggableRowProps {
    item: ItemAquisicaoServico;
    diretrizId: string;
}

const ItemAquisicaoServicoDraggableRow: React.FC<ItemAquisicaoServicoDraggableRowProps> = ({ item, diretrizId }) => {
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ item, sourceDiretrizId: diretrizId }));
        e.dataTransfer.effectAllowed = "move";
    };

    // Fallback para garantir que o nome reduzido seja exibido corretamente
    const nomeExibicao = (item as any).nome_reduzido || (item as any).descricao_reduzida || item.descricao_item;

    return (
        <TableRow 
            draggable 
            onDragStart={handleDragStart}
            className="group cursor-grab active:cursor-grabbing hover:bg-muted/30"
        >
            <TableCell className="px-4 py-2 w-[20px]">
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </TableCell>
            <TableCell className="px-4 py-2 text-sm font-medium">{nomeExibicao}</TableCell>
            <TableCell className="px-4 py-2 text-sm text-center">{item.codigo_catmat || '-'}</TableCell>
            <TableCell className="px-4 py-2 text-sm text-center">{item.numero_pregao}</TableCell>
            <TableCell className="px-4 py-2 text-sm text-center">{formatCodug(item.uasg)}</TableCell>
            <TableCell className="px-4 py-2 text-sm text-right font-medium">
                {formatCurrency(item.valor_unitario)}
            </TableCell>
        </TableRow>
    );
};

export default ItemAquisicaoServicoDraggableRow;