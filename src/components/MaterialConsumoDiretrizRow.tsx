import React, { useState } from 'react';
import { TableCell, TableRow, Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency } from "@/lib/formatUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

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

    return (
        <React.Fragment>
            <Collapsible asChild open={isOpen} onOpenChange={setIsOpen}>
                <TableRow className="hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/50">
                    <CollapsibleTrigger asChild>
                        <TableCell className="font-semibold w-[150px] text-center cursor-pointer">
                            <div className="flex items-center justify-center gap-2">
                                {diretriz.nr_subitem}
                                {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            </div>
                        </TableCell>
                    </CollapsibleTrigger>
                    
                    <TableCell className="font-medium">
                        {diretriz.nome_subitem}
                        {!diretriz.ativo && <Badge variant="destructive" className="ml-2">Inativo</Badge>}
                    </TableCell>
                    
                    <TableCell className="text-right w-[100px]">
                        <div className="flex justify-end gap-1">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); onEdit(diretriz); }}
                                disabled={loading}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); onDelete(diretriz.id, diretriz.nome_subitem); }} 
                                disabled={loading}
                                className="text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
            </Collapsible>
            
            <TableRow className="p-0">
                <TableCell colSpan={3} className="p-0">
                    <CollapsibleContent>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t">
                            <h5 className="text-sm font-semibold mb-2">Itens de Aquisição ({itensAquisicao.length})</h5>
                            
                            {itensAquisicao.length > 0 ? (
                                <Table className="bg-white dark:bg-gray-800 border">
                                    <thead>
                                        <TableRow className="text-xs text-muted-foreground hover:bg-white dark:hover:bg-gray-800">
                                            <th className="px-4 py-2 text-left font-normal w-[50%]">Descrição</th>
                                            <th className="px-4 py-2 text-center font-normal w-[15%]">Unidade</th>
                                            <th className="px-4 py-2 text-right font-normal w-[15%]">Preço Unitário</th>
                                            <th className="px-4 py-2 text-right font-normal w-[15%]">Fator Mnt</th>
                                        </TableRow>
                                    </thead>
                                    <tbody>
                                        {itensAquisicao.map((item, index) => (
                                            <TableRow key={index} className="text-sm">
                                                <td className="px-4 py-2">{item.descricao}</td>
                                                <td className="px-4 py-2 text-center">{item.unidade}</td>
                                                <td className="px-4 py-2 text-right font-mono">{formatCurrency(item.preco_unitario)}</td>
                                                <td className="px-4 py-2 text-right font-mono">{item.fator_manutencao}</td>
                                            </TableRow>
                                        ))}
                                    </tbody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground">Nenhum item de aquisição detalhado para este subitem.</p>
                            )}
                        </div>
                    </CollapsibleContent>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
};

export default MaterialConsumoDiretrizRow;