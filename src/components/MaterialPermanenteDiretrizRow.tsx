import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { DiretrizMaterialPermanente } from "@/types/diretrizesMaterialPermanente";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { Badge } from "@/components/ui/badge";

interface MaterialPermanenteDiretrizRowProps {
    diretriz: DiretrizMaterialPermanente;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit: (diretriz: DiretrizMaterialPermanente) => void;
    onDelete: (id: string) => void;
}

const MaterialPermanenteDiretrizRow: React.FC<MaterialPermanenteDiretrizRowProps> = ({
    diretriz,
    isExpanded,
    onToggleExpand,
    onEdit,
    onDelete,
}) => {
    return (
        <>
            <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={onToggleExpand}>
                <TableCell className="w-[40px]">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </TableCell>
                <TableCell className="font-bold text-center">{diretriz.nr_subitem}</TableCell>
                <TableCell className="font-medium">{diretriz.nome_subitem}</TableCell>
                <TableCell className="text-center">
                    <Badge variant="secondary" className="font-semibold">
                        {diretriz.itens_aquisicao.length} Itens
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(diretriz)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(diretriz.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {isExpanded && (
                <TableRow className="bg-muted/30">
                    <TableCell colSpan={5} className="p-0">
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground border-b pb-2">
                                <Package className="h-4 w-4" />
                                Itens de Aquisição Permanente Cadastrados
                            </div>
                            <div className="border rounded-md bg-background overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-2 text-left font-medium">Nome Reduzido</th>
                                            <th className="p-2 text-left font-medium">Descrição Completa</th>
                                            <th className="p-2 text-center font-medium">CATMAT</th>
                                            <th className="p-2 text-center font-medium">Pregão</th>
                                            <th className="p-2 text-center font-medium">UASG</th>
                                            <th className="p-2 text-right font-medium">Valor Unitário</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diretriz.itens_aquisicao.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                                                <td className="p-2 font-medium">{item.descricao_reduzida || 'N/A'}</td>
                                                <td className="p-2 text-xs text-muted-foreground max-w-md">{item.descricao_item}</td>
                                                <td className="p-2 text-center font-mono text-xs">{item.codigo_catmat || 'N/A'}</td>
                                                <td className="p-2 text-center text-xs">{formatPregao(item.numero_pregao)}</td>
                                                <td className="p-2 text-center text-xs">{formatCodug(item.uasg)}</td>
                                                <td className="p-2 text-right font-bold text-primary">{formatCurrency(item.valor_unitario)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

export default MaterialPermanenteDiretrizRow;