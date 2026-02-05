import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaterialConsumoDiretrizRowProps {
    diretriz: DiretrizMaterialConsumo;
    onEdit: (diretriz: DiretrizMaterialConsumo) => void;
    onDelete: (id: string, nome: string) => Promise<void>;
    loading: boolean;
}

const MaterialConsumoDiretrizRow: React.FC<MaterialConsumoDiretrizRowProps> = ({
    diretriz,
    onEdit,
    onDelete,
    loading,
}) => {
    // Removido totalItens
    
    return (
        <TableRow>
            <TableCell className="font-medium w-[100px]">
                <span className="font-semibold">{diretriz.nr_subitem}</span>
            </TableCell>
            <TableCell className="text-left font-medium">
                {diretriz.nome_subitem}
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEdit(diretriz)}
                        disabled={loading}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onDelete(diretriz.id, diretriz.nome_subitem)} 
                        disabled={loading}
                        className="text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};

export default MaterialConsumoDiretrizRow;