"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileSearch, ListChecks, Loader2, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from "@/types/pncp";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onReviewItem?: (item: ItemAquisicao) => void;
    selectedYear: number;
    mode?: 'material' | 'servico';
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem,
    selectedYear,
    mode = 'material'
}) => {
    const [selectedItems, setSelectedItems] = useState<ItemAquisicao[]>([]);
    const [activeTab, setActiveTab] = useState<string>("uasg");
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleItemPreSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        const isDuplicate = existingItemsInDiretriz.some(existing => 
            existing.codigo_catmat === item.codigoItem && 
            existing.numero_pregao === pregaoFormatado && 
            existing.uasg === uasg
        );

        if (isDuplicate) {
            toast.warning("Este item já existe nesta diretriz (mesmo CATMAT, Pregão e UASG).");
            return;
        }

        const newItem: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50),
            valor_unitario: item.valorUnitario,
            numero_pregao: pregaoFormatado,
            uasg: uasg,
            codigo_catmat: item.codigoItem,
            nd: mode === 'material' ? '30' : '39',
        };

        setSelectedItems(prev => {
            const alreadySelected = prev.some(s => s.codigo_catmat === newItem.codigo_catmat && s.numero_pregao === newItem.numero_pregao && s.uasg === newItem.uasg);
            if (alreadySelected) {
                toast.info("Item já está na lista de importação.");
                return prev;
            }
            toast.success("Item adicionado à lista de importação.");
            return [...prev, newItem];
        });
    };

    const handlePriceSelect = (item: ItemAquisicao) => {
        setSelectedItems(prev => {
            const alreadySelected = prev.some(s => s.codigo_catmat === item.codigo_catmat && s.valor_unitario === item.valor_unitario);
            if (alreadySelected) return prev;
            return [...prev, item];
        });
    };

    const handleConfirmImport = () => {
        if (selectedItems.length === 0) {
            toast.error("Nenhum item selecionado para importação.");
            return;
        }
        onImport(selectedItems);
        setSelectedItems([]);
        onOpenChange(false);
        toast.success(`${selectedItems.length} itens importados com sucesso!`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col modal-importar-pncp z-tour-portal">
                <DialogHeader className="flex-none">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Importar Itens via API PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Busque itens diretamente no Portal Nacional de Contratações Públicas para garantir preços oficiais.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-3 flex-none">
                        <TabsTrigger value="uasg" className="flex items-center gap-2 aba-pncp-uasg">
                            <FileSearch className="h-4 w-4" />
                            Busca por UASG
                        </TabsTrigger>
                        <TabsTrigger value="catmat" className="flex items-center gap-2 aba-pncp-arp">
                            <Search className="h-4 w-4" />
                            Busca por {mode === 'material' ? 'CATMAT' : 'CATSER'}
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="flex items-center gap-2 aba-pncp-stats">
                            <ListChecks className="h-4 w-4" />
                            Estatísticas de Preço
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-hidden mt-4 border rounded-md bg-muted/30">
                        <ScrollArea className="h-full" ref={scrollContainerRef}>
                            <TabsContent value="uasg" className="m-0 p-0 outline-none">
                                <ArpUasgSearchForm 
                                    onItemPreSelect={handleItemPreSelect} 
                                    selectedItemIds={selectedItems.map(i => i.id)}
                                    onClearSelection={() => setSelectedItems([])}
                                    scrollContainerRef={scrollContainerRef}
                                />
                            </TabsContent>
                            <TabsContent value="catmat" className="m-0 p-0 outline-none">
                                <ArpCatmatSearchForm 
                                    onItemPreSelect={handleItemPreSelect} 
                                    selectedItemIds={selectedItems.map(i => i.id)}
                                    onClearSelection={() => setSelectedItems([])}
                                    scrollContainerRef={scrollContainerRef}
                                    mode={mode}
                                />
                            </TabsContent>
                            <TabsContent value="stats" className="m-0 p-0 outline-none">
                                <PriceSearchForm 
                                    onPriceSelect={handlePriceSelect}
                                    isInspecting={false}
                                    onClearPriceSelection={() => {}}
                                    selectedItemForInspection={null}
                                    mode={mode}
                                />
                            </TabsContent>
                        </ScrollArea>
                    </div>
                </Tabs>

                {selectedItems.length > 0 && (
                    <div className="mt-4 p-3 border rounded-lg bg-primary/5 flex-none">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <ListChecks className="h-4 w-4 text-primary" />
                                Itens para Importação ({selectedItems.length})
                            </h4>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])} className="h-7 text-xs text-destructive">Limpar Lista</Button>
                        </div>
                        <ScrollArea className="max-h-32">
                            <Table>
                                <TableBody>
                                    {selectedItems.map((item, idx) => (
                                        <TableRow key={idx} className="hover:bg-transparent">
                                            <TableCell className="py-1 px-2 text-xs font-medium max-w-[300px] truncate">{item.descricao_item}</TableCell>
                                            <TableCell className="py-1 px-2 text-xs text-center">{formatCodug(item.uasg)}</TableCell>
                                            <TableCell className="py-1 px-2 text-xs text-right font-bold">{formatCurrency(item.valor_unitario)}</TableCell>
                                            <TableCell className="py-1 px-2 text-right">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setSelectedItems(prev => prev.filter((_, i) => i !== idx))}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                )}

                <DialogFooter className="mt-4 flex-none">
                    <div className="flex items-center gap-2 mr-auto text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        Os itens serão adicionados à diretriz atual.
                    </div>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmImport} disabled={selectedItems.length === 0} className="bg-green-600 hover:bg-green-700">
                        Confirmar Importação ({selectedItems.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;