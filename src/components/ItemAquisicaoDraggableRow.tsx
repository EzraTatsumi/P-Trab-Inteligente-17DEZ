import React from 'react';
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { TableRow, TableCell } from "@/components/ui/table";
import { GripVertical } from 'lucide-react';

interface ItemAquisicaoDraggableRowProps {
    item: ItemAquisicao;
    diretrizId: string; // ID da diretriz de origem
}

const ItemAquisicaoDraggableRow: React.FC<ItemAquisicaoDraggableRowProps> = ({ item, diretrizId }) => {
    
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
            key={item.id}
            draggable="true"
            onDragStart={handleDragStart}
            className="cursor-grab active:cursor-grabbing hover:bg-primary/5 transition-colors"
        >
            <TableCell className="w-[20px] text-center p-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </TableCell>
            <TableCell className="font-center text-xs w-[45%] p-2">{item.descricao_reduzida || item.descricao_item}</TableCell>
            <TableCell className="w-[15%] text-center text-xs p-2">{item.codigo_catmat || 'N/A'}</TableCell>
            <TableCell className="w-[10%] text-center text-xs p-2">{item.numero_pregao || 'N/A'}</TableCell>
            <TableCell className="w-[10%] text-center text-xs p-2">{formatCodug(item.uasg) || 'N/A'}</TableCell>
            <TableCell className="w-[10%] text-center font-bold text-primary p-2">
                {formatCurrency(item.valor_unitario)}
            </TableCell>
        </TableRow>
    );
};

export default ItemAquisicaoDraggableRow;