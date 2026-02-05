import React, { useState } from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatUtils";

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
    const [isOpen, setIsOpen] = useState(false);
    const itensAquisicao = diretriz.itens_aquisicao || [];
    const hasItens = itensAquisicao.length > 0;
    
    return (
        <React.Fragment>
            <TableRow className={cn(
                "hover:bg-muted/50 transition-colors",
                isOpen && "bg-muted/50 border-b-0"
            )}>
                <TableCell className="font-medium w-[100px]">
                    <span className="font-semibold">{diretriz.nr_subitem}</span>
                </TableCell>
                <TableCell className="text-left font-medium">
                    {diretriz.nome_subitem}
                </TableCell>
                
                {/* Coluna de Ações e Toggle */}
                <TableCell className="text-center w-[100px]">
                    <div className="flex justify-end gap-1 items-center">
                        {/* Botão de Colapsar/Expandir */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => hasItens && setIsOpen(!isOpen)}
                            disabled={!hasItens}
                            className={cn("h-8 w-8", !hasItens && "opacity-50 cursor-not-allowed")}
                        >
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        
                        {/* Botão de Edição */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onEdit(diretriz)}
                            disabled={loading}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        
                        {/* Botão de Exclusão */}
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
            
            {/* Linha de Detalhes Colapsável */}
            {hasItens && (
                <TableRow className={cn(
                    "p-0 border-t-0",
                    !isOpen && "hidden"
                )}>
                    <TableCell colSpan={3} className="p-0 border-t-0">
                        <Collapsible open={isOpen}>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                <div className="p-4 bg-muted/50 border-t border-border">
                                    <h5 className="text-sm font-semibold mb-2">Itens para Aquisição ({itensAquisicao.length})</h5>
                                    <div className="space-y-2">
                                        {itensAquisicao.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between text-sm p-2 bg-background rounded-md shadow-sm border">
                                                <div className="flex items-center gap-3 font-medium">
                                                    <Package className="h-4 w-4 text-gray-500" />
                                                    <span>{item.nome}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-right">
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.quantidade} {item.unidade}
                                                    </span>
                                                    <span className="font-bold text-primary">
                                                        {formatCurrency(item.valor_unitario)} / un
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};

export default MaterialConsumoDiretrizRow;