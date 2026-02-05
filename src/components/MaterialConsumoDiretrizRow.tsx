import React, { useState } from 'react';
import { TableCell, TableRow, Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency } from "@/lib/formatUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

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
            {/* A linha principal (TableRow) agora é o elemento que contém o CollapsibleTrigger */}
            <TableRow
                className={cn(
                    "hover:bg-muted/50 transition-colors cursor-pointer",
                    isOpen && "bg-muted/50"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {/* Coluna Nr Subitem */}
                <TableCell className="font-semibold w-[150px] text-center">
                    <div className="flex items-center justify-center gap-2">
                        {diretriz.nr_subitem}
                        {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                </TableCell>
                
                {/* Coluna Nome do Subitem */}
                <TableCell className="font-medium">
                    {diretriz.nome_subitem}
                    {!diretriz.ativo && <Badge variant="destructive" className="ml-2">Inativo</Badge>}
                </TableCell>
                
                {/* Coluna Ações */}
                <TableCell className="text-right w-[100px]" onClick={(e) => e.stopPropagation()}>
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
            
            {/* Linha de Conteúdo Colapsável */}
            <TableRow className="p-0">
                <TableCell colSpan={3} className="p-0">
                    <Collapsible open={isOpen}>
                        <CollapsibleContent>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t">
                            <h5 className="text-sm font-semibold mb-2">Itens de Aquisição ({itensAquisicao.length})</h5>
                            
                            {itensAquisicao.length > 0 ? (
                                <Table className="bg-white dark:bg-gray-800 border">
                                    <thead>
                                        <TableRow className="text-xs text-muted-foreground hover:bg-white dark:hover:bg-gray-800">
                                            <th className="px-4 py-2 text-left font-normal w-[40%]">Descrição do Item</th>
                                            <th className="px-4 py-2 text-right font-normal w-[20%]">Valor Unitário</th>
                                            <th className="px-4 py-2 text-center font-normal w-[20%]">Pregão/Ref.</th>
                                            <th className="px-4 py-2 text-center font-normal w-[20%]">UASG</th>
                                        </TableRow>
                                    </thead>
                                    <tbody>
                                        {itensAquisicao.map((item) => (
                                            <TableRow key={item.id} className="text-sm">
                                                <td className="px-4 py-2">{item.descricao_item}</td>
                                                <td className="px-4 py-2 text-right font-mono">{formatCurrency(item.valor_unitario)}</td>
                                                <td className="px-4 py-2 text-center">{item.numero_pregao || 'N/A'}</td>
                                                <td className="px-4 py-2 text-center">{item.uasg || 'N/A'}</td>
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