"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Package, Filter } from "lucide-react";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { MaterialConsumoItem } from "@/types/materialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MaterialConsumoItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    diretrizes: DiretrizMaterialConsumo[];
    initialSelection: MaterialConsumoItem[];
    onConfirm: (selectedItens: MaterialConsumoItem[]) => void;
}

const MaterialConsumoItemSelectorDialog: React.FC<MaterialConsumoItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    diretrizes,
    initialSelection,
    onConfirm,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(initialSelection.map(item => item.id))
    );

    // Aplana todos os itens de todas as diretrizes para facilitar a busca e seleção
    const allAvailableItems = useMemo(() => {
        return diretrizes.flatMap(diretriz => 
            (diretriz.itens_aquisicao || []).map(item => ({
                ...item,
                nr_subitem: diretriz.nr_subitem,
                nome_subitem: diretriz.nome_subitem
            }))
        );
    }, [diretrizes]);

    const filteredItems = useMemo(() => {
        if (!searchTerm) return allAvailableItems;
        const lowerSearch = searchTerm.toLowerCase();
        return allAvailableItems.filter(item => 
            item.descricao_item.toLowerCase().includes(lowerSearch) ||
            item.codigo_catmat.toLowerCase().includes(lowerSearch) ||
            item.nr_subitem.includes(lowerSearch)
        );
    }, [searchTerm, allAvailableItems]);

    const handleToggleItem = (item: ItemAquisicao) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(item.id)) {
            newSelected.delete(item.id);
        } else {
            newSelected.add(item.id);
        }
        setSelectedIds(newSelected);
    };

    const handleConfirm = () => {
        const selectedItens: MaterialConsumoItem[] = allAvailableItems
            .filter(item => selectedIds.has(item.id))
            .map(item => {
                // Mantém a quantidade se o item já estava selecionado anteriormente
                const existing = initialSelection.find(i => i.id === item.id);
                return {
                    id: item.id,
                    descricao_item: item.descricao_item,
                    valor_unitario: item.valor_unitario,
                    quantidade: existing?.quantidade || 0,
                    valor_total: (existing?.quantidade || 0) * item.valor_unitario,
                    codigo_catmat: item.codigo_catmat,
                    numero_pregao: item.numero_pregao,
                    uasg: item.uasg,
                    nr_subitem: item.nr_subitem,
                    nome_subitem: item.nome_subitem,
                    unidade_medida: (item as any).unidade_medida || 'UN'
                };
            });
        
        onConfirm(selectedItens);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col tour-item-selector-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Selecionar Itens do Catálogo
                    </DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-2 py-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por descrição, CATMAT ou subitem..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-hidden border rounded-md">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-center">Subitem</TableHead>
                                    <TableHead className="text-center">UASG</TableHead>
                                    <TableHead className="text-right">Vlr. Unitário</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Nenhum item encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredItems.map((item) => (
                                        <TableRow 
                                            key={item.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleToggleItem(item)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox 
                                                    checked={selectedIds.has(item.id)}
                                                    onCheckedChange={() => handleToggleItem(item)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm">{item.descricao_item}</div>
                                                <div className="text-[10px] text-muted-foreground">CATMAT: {item.codigo_catmat}</div>
                                            </TableCell>
                                            <TableCell className="text-center text-xs">
                                                {item.nr_subitem}
                                            </TableCell>
                                            <TableCell className="text-center text-xs">
                                                {formatCodug(item.uasg)}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                {formatCurrency(item.valor_unitario)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                <DialogFooter className="pt-4">
                    <div className="flex-1 text-sm text-muted-foreground flex items-center">
                        {selectedIds.size} item(ns) selecionado(s)
                    </div>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm}>
                        Confirmar Seleção
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoItemSelectorDialog;