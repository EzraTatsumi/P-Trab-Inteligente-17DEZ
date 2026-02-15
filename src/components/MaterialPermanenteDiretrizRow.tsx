import React, { useState, useEffect } from 'react';
import { TableCell, TableRow, Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { DiretrizMaterialPermanente } from "@/types/diretrizesMaterialPermanente";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface MaterialPermanenteDiretrizRowProps {
    diretriz: DiretrizMaterialPermanente;
    onEdit: (diretriz: DiretrizMaterialPermanente) => void;
    onDelete: (id: string, nome: string) => Promise<void>;
    loading?: boolean;
    // Props para consistência com a busca e navegação
    id?: string;
    forceOpen?: boolean;
}

const MaterialPermanenteDiretrizRow: React.FC<MaterialPermanenteDiretrizRowProps> = ({
    diretriz,
    onEdit,
    onDelete,
    loading = false,
    id,
    forceOpen = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Sincroniza a abertura forçada (usada na busca)
    useEffect(() => {
        if (forceOpen && !isOpen) {
            setIsOpen(true);
        }
    }, [forceOpen]);

    const itensAquisicao = diretriz.itens_aquisicao || [];

    return (
        <React.Fragment>
            {/* Linha Principal */}
            <TableRow 
                id={id}
                className={cn(
                    "hover:bg-muted/50 transition-colors cursor-pointer",
                    isOpen && "bg-muted/50"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {/* Coluna Nr Subitem (com Chevron integrado) */}
                <TableCell className="font-semibold w-[150px] text-center">
                    <div className="flex items-center justify-center gap-2">
                        {diretriz.nr_subitem}
                        {isOpen ? (
                            <ChevronUp className="h-3 w-3 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        )}
                    </div>
                </TableCell>
                
                {/* Coluna Nome do Subitem */}
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        {diretriz.nome_subitem}
                        {!diretriz.ativo && <Badge variant="destructive">Inativo</Badge>}
                    </div>
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
                            <div className="p-4 bg-muted/50 border-t border-border">
                                {itensAquisicao.length > 0 ? (
                                    <Table className="bg-background border rounded-md overflow-hidden">
                                        <thead>
                                            <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                <th className="px-4 py-2 text-left font-normal w-[20px]"></th> {/* Espaço para manter o alinhamento com o ícone de drag de outras tabelas */}
                                                <th className="px-4 py-2 text-left font-normal w-[35%]">Descrição Reduzida</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Cód. CATMAT</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Pregão</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">UASG</th>
                                                <th className="px-4 py-2 text-center font-normal w-[15%]">Valor Unitário</th>
                                            </TableRow>
                                        </thead>
                                        <tbody>
                                            {itensAquisicao.map((item, idx) => (
                                                <TableRow key={item.id || idx} className="hover:bg-muted/30">
                                                    <TableCell className="px-4 py-2 w-[20px]"></TableCell>
                                                    <TableCell className="px-4 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-sm">{item.descricao_reduzida || 'N/A'}</span>
                                                            <span className="text-[10px] text-muted-foreground line-clamp-1">{item.descricao_item}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-2 text-center font-mono text-xs">
                                                        {item.codigo_catmat || 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-2 text-center text-xs">
                                                        {formatPregao(item.numero_pregao)}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-2 text-center text-xs">
                                                        {formatCodug(item.uasg)}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-2 text-center font-bold text-sm">
                                                        {formatCurrency(item.valor_unitario)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </tbody>
                                    </Table>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Nenhum item de aquisição detalhado para este subitem.
                                    </p>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
};

export default MaterialPermanenteDiretrizRow;