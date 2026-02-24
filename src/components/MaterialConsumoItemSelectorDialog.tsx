"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Package, Check, Loader2 } from "lucide-react";
import { useMaterialConsumoDiretrizes } from "@/hooks/useMaterialConsumoDiretrizes";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface MaterialConsumoItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    onSelect: (item: ItemAquisicao) => void;
    selectedItemIds?: string[];
}

const MaterialConsumoItemSelectorDialog: React.FC<MaterialConsumoItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    onSelect,
    selectedItemIds = [],
}) => {
    const { diretrizes, isLoading } = useMaterialConsumoDiretrizes(selectedYear);
    const [searchTerm, setSearchTerm] = useState("");

    const allItems = React.useMemo(() => {
        if (!diretrizes) return [];
        return diretrizes.flatMap(d => 
            ((d.itens_aquisicao as unknown as ItemAquisicao[]) || []).map(item => ({
                ...item,
                subitemNr: d.nr_subitem,
                subitemNome: d.nome_subitem
            }))
        );
    }, [diretrizes]);

    const filteredItems = allItems.filter(item => 
        item.descricao_item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codigo_catmat.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subitemNr.includes(searchTerm)
    );

    const handleSelect = (item: any) => {
        // Remove as propriedades extras de exibição antes de retornar
        const { subitemNr, subitemNome, ...cleanItem } = item;
        onSelect(cleanItem as ItemAquisicao);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col tour-item-selector-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Selecionar Item de Material de Consumo
                    </DialogTitle>
                    <DialogDescription>
                        Busque no catálogo de diretrizes do ano {selectedYear} para importar para o P Trab.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative my-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por descrição, CATMAT ou número do subitem..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex-1 overflow-hidden border rounded-md mt-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Carregando catálogo de itens...</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[80px] text-center">Subitem</TableHead>
                                        <TableHead>Descrição do Item</TableHead>
                                        <TableHead className="text-right">Valor Unit.</TableHead>
                                        <TableHead className="w-[100px] text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                Nenhum item encontrado no catálogo.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item, idx) => {
                                            const isSelected = selectedItemIds.includes(item.id);
                                            return (
                                                <TableRow key={`${item.id}-${idx}`} className={isSelected ? "bg-muted/50" : ""}>
                                                    <TableCell className="text-center font-bold">{item.subitemNr}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">{item.descricao_item}</span>
                                                            <div className="flex gap-2 mt-1">
                                                                <Badge variant="outline" className="text-[10px] h-4">CATMAT: {item.codigo_catmat}</Badge>
                                                                <Badge variant="outline" className="text-[10px] h-4">UASG: {formatCodug(item.uasg)}</Badge>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(item.valor_unitario)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button 
                                                            size="sm" 
                                                            variant={isSelected ? "ghost" : "outline"}
                                                            onClick={() => handleSelect(item)}
                                                            disabled={isSelected}
                                                        >
                                                            {isSelected ? <Check className="h-4 w-4 text-green-600" /> : "Selecionar"}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>

                <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoItemSelectorDialog;