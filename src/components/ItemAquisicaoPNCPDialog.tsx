"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, List, CheckCircle2, Loader2, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { DetailedArpItem } from '@/types/pncp';
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug, formatPregao } from '@/lib/formatUtils';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onReviewItem: (item: ItemAquisicao) => void;
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleItemPreSelect = (item: DetailedArpItem | ItemAquisicao, pregaoFormatado?: string, uasg?: string) => {
        const isDetailed = 'numeroControlePncpAta' in item;
        const itemId = isDetailed ? (item as DetailedArpItem).id : (item as ItemAquisicao).id;
        
        if (selectedItems.find(i => i.id === itemId)) {
            setSelectedItems(prev => prev.filter(i => i.id !== itemId));
            return;
        }

        const newItem: ItemAquisicao = isDetailed 
            ? {
                id: (item as DetailedArpItem).id,
                codigo_catmat: (item as DetailedArpItem).codigoItem,
                descricao_item: (item as DetailedArpItem).descricaoItem,
                descricao_reduzida: (item as DetailedArpItem).descricaoItem.substring(0, 50),
                valor_unitario: (item as DetailedArpItem).valorUnitario,
                numero_pregao: pregaoFormatado || 'N/A',
                uasg: uasg || '',
                nd: mode === 'material' ? '30' : '39',
            }
            : (item as ItemAquisicao);

        setSelectedItems(prev => [...prev, newItem]);
    };

    const handleConfirmImport = () => {
        if (selectedItems.length === 0) return;
        onImport(selectedItems);
        toast.success(`${selectedItems.length} itens importados com sucesso!`);
        setSelectedItems([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden modal-importar-pncp z-tour-portal">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Importar Dados do PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Busque preços e itens diretamente no Portal Nacional de Contratações Públicas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs defaultValue="uasg" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="mx-6 mt-4 grid grid-cols-3">
                            <TabsTrigger value="uasg" className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                Por UASG
                            </TabsTrigger>
                            <TabsTrigger value="catmat" className="flex items-center gap-2">
                                <List className="h-4 w-4" />
                                Por Cód. Item
                            </TabsTrigger>
                            <TabsTrigger value="stats" className="flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Média de Preços
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-hidden relative">
                            <ScrollArea className="h-full" ref={scrollContainerRef}>
                                <div className="p-6 pt-4">
                                    <TabsContent value="uasg" className="mt-0 outline-none">
                                        <ArpUasgSearchForm 
                                            onItemPreSelect={handleItemPreSelect} 
                                            selectedItemIds={selectedItems.map(i => i.id)}
                                            onClearSelection={() => setSelectedItems([])}
                                            scrollContainerRef={scrollContainerRef as any}
                                        />
                                    </TabsContent>
                                    <TabsContent value="catmat" className="mt-0 outline-none">
                                        <ArpCatmatSearchForm 
                                            onItemPreSelect={handleItemPreSelect} 
                                            selectedItemIds={selectedItems.map(i => i.id)}
                                            onClearSelection={() => setSelectedItems([])}
                                            scrollContainerRef={scrollContainerRef as any}
                                            mode={mode}
                                        />
                                    </TabsContent>
                                    <TabsContent value="stats" className="mt-0 outline-none">
                                        <PriceSearchForm 
                                            onPriceSelect={(item) => handleItemPreSelect(item)}
                                            isInspecting={false}
                                            onClearPriceSelection={() => setSelectedItems([])}
                                            selectedItemForInspection={null}
                                            mode={mode}
                                        />
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </div>
                    </Tabs>
                </div>

                {selectedItems.length > 0 && (
                    <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="h-8 px-3">
                                {selectedItems.length} item(ns) selecionado(s)
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])} className="text-xs text-muted-foreground hover:text-destructive">
                                Limpar Seleção
                            </Button>
                        </div>
                        <Button onClick={handleConfirmImport} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Confirmar Importação
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;