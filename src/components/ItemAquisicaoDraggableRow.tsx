import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";

interface ItemAquisicaoDraggableRowProps {
    item: ItemAquisicao;
    diretrizId: string;
}

const ItemAquisicaoDraggableRow: React.FC<ItemAquisicaoDraggableRowProps> = ({ item, diretrizId }) => {
    
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
        // Armazena os dados do item e a diretriz de origem no dataTransfer
        const dragData = JSON.stringify({
            item: item,
            sourceDiretrizId: diretrizId,
        });
        e.dataTransfer.setData("application/json", dragData);
        e.dataTransfer.effectAllowed = "move";
        
        // Adiciona uma classe para feedback visual durante o arrasto
        e.currentTarget.classList.add("opacity-50", "border-2", "border-primary", "shadow-lg");
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
        // Remove a classe de feedback visual
        e.currentTarget.classList.remove("opacity-50", "border-2", "border-primary", "shadow-lg");
    };

    return (
        <TableRow 
            key={item.id} 
            className="text-sm cursor-grab hover:bg-yellow-50/50 transition-colors"
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <TableCell className="px-4 py-2">{item.descricao_item}</TableCell>
            <TableCell className="px-4 py-2 text-center">{item.codigo_catmat || 'N/A'}</TableCell>
            <TableCell className="px-4 py-2 text-center">{item.numero_pregao || 'N/A'}</TableCell>
            <TableCell className="px-4 py-2 text-center">{formatCodug(item.uasg) || 'N/A'}</TableCell>
            <TableCell className="px-4 py-2 text-right font-bold text-primary">
                {formatCurrency(item.valor_unitario)}
            </TableCell>
        </TableRow>
    );
};

export default ItemAquisicaoDraggableRow;