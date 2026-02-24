"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, History, BarChart3, Info } from "lucide-react";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug, formatPregao } from '@/lib/formatUtils';
import { toast } from 'sonner';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: any[]) => void;
    existingItemsInDiretriz: any[];
    onReviewItem: (item: any) => void;
    selectedYear: number;
    mode: 'material' | 'servico' | 'permanente';
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem,
    selectedYear,
    mode
}) => {
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleItemPreSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        const isAlreadySelected = selectedItems.find(i => i.id === item.id);
        if (isAlreadySelected) {
            setSelectedItems(prev => prev.filter(i => i.id !== item.id));
            return;
        }

        const newItem = {
            id: item.id,
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50),
            valor_unitario: item.valorUnitario,
            numero_pregao: pregaoFormatado,
            uasg: uasg,
            codigo_catmat: item.codigoItem,
            unidade_medida: (item as any).unidadeMedida || 'UN',
            nd: mode === 'servico' ? '39' : '30'
        };

        setSelectedItems(prev => [...prev, newItem]);
    };

    const handlePriceSelect = (item: ItemAquisicao) => {
        setSelectedItems([item]);
    };

    const handleConfirmImport = () => {
        if (selectedItems.length === 0) {
            toast.error("Selecione pelo menos um item para importar.");
            return;
        }
        onImport(selectedItems);
        setSelectedItems([]);
        onOpenChange(false);
        toast.success(`${selectedItems.length} item(ns) importado(s) para a lista!`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col modal-importar-pncp">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Importar do PNCP (API)
                    </DialogTitle>
                    <DialogDescription>
                        Pesquise itens em Atas de Registro de Preços vigentes ou consulte estatísticas de preços.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="uasg" className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="uasg" className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Busca por UASG
                        </TabsTrigger>
                        <TabsTrigger value="catmat" className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            Busca por Código
                        </TabsTrigger>
                        <TabsTrigger value="price" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Preço Médio
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto mt-4 pr-2" ref={scrollContainerRef}>
                        <TabsContent value="uasg" className="mt-0 outline-none">
                            <ArpUasgSearchForm 
                                onItemPreSelect={handleItemPreSelect} 
                                selectedItemIds={selectedItems.map(i => i.id)}
                                onClearSelection={() => setSelectedItems([])}
                                scrollContainerRef={scrollContainerRef}
                            />
                        </TabsContent>
                        <TabsContent value="catmat" className="mt-0 outline-none">
                            <ArpCatmatSearchForm 
                                onItemPreSelect={handleItemPreSelect} 
                                selectedItemIds={selectedItems.map(i => i.id)}
                                onClearSelection={() => setSelectedItems([])}
                                scrollContainerRef={scrollContainerRef}
                                mode={mode}
                            />
                        </TabsContent>
                        <TabsContent value="price" className="mt-0 outline-none">
                            <PriceSearchForm 
                                onPriceSelect={handlePriceSelect}
                                isInspecting={false}
                                onClearPriceSelection={() => setSelectedItems([])}
                                selectedItemForInspection={null}
                                mode={mode}
                            />
                        </TabsContent>
                    </div>
                </Tabs>

                {selectedItems.length > 0 && (
                    <div className="border-t pt-4 mt-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Itens Selecionados ({selectedItems.length})</h3>
                            <Button size="sm" onClick={handleConfirmImport}>Confirmar Importação</Button>
                        </div>
                        <div className="max-h-32 overflow-y-auto border rounded-md">
                            <Table>
                                <TableBody>
                                    {selectedItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-xs py-2">{item.descricao_item}</TableCell>
                                            <TableCell className="text-xs py-2 text-right font-bold">{formatCurrency(item.valor_unitario)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;