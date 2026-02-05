import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaterialConsumoDiretrizRowProps {
    diretriz: DiretrizMaterialConsumo;
    onEdit: (diretriz: DiretrizMaterialConsumo) => void;
    onDelete: (id: string, nome: string) => Promise<void>;
    loading: boolean;
}

const MaterialConsumoDiretrizRow: React.FC<MaterialConsumoDiretrizRowRowProps> = ({
    diretriz,
    onEdit,
    onDelete,
    loading,
}) => {
    const totalItens = diretriz.itens_aquisicao.length;
    
    return (
        <TableRow>
            <TableCell className="font-medium">
                <div className="flex flex-col">
                    <span className="font-semibold">{diretriz.nr_subitem}</span>
                    <span className="text-sm text-muted-foreground">{diretriz.nome_subitem}</span>
                </div>
            </TableCell>
            <TableCell className="text-left max-w-[300px] truncate">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="truncate block">{diretriz.descricao_subitem || 'N/A'}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-xs">{diretriz.descricao_subitem || 'N/A'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell className="text-center font-medium">
                {totalItens} {totalItens === 1 ? 'Item' : 'Itens'}
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