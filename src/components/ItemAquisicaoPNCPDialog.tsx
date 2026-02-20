"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, List, History, Info, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import PriceSearchForm from './pncp/PriceSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: any[]) => void;
    existingItemsInDiretriz: any[];
    onReviewItem?: (item: any) => void;
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
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleItemPreSelect = (item: DetailedArpItem, pregao: string, uasg: string) => {
        const isDuplicate = selectedItems.some(i => i.id === item.id) || 
                           existingItemsInDiretriz.some(i => i.codigo_catmat === item.codigoItem && i.uasg === uasg && i.numero_pregao === pregao);

        if (isDuplicate) {
            toast.warning("Este item já foi selecionado ou já existe nesta diretriz.");
            return;
        }

        const newItem = {
            id: item.id,
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 100),
            valor_unitario: item.valorUnitario,
            numero_pregao: pregao,
            uasg: uasg,
            codigo_catmat: item.codigoItem,
            unidade_medida: (item as any).unidade_medida || 'UN',
            nd: mode === 'material' ? '30' : '39'
        };

        setSelectedItems(prev => [...prev, newItem]);
        toast.success("Item adicionado à lista de importação.");
    };

    const handlePriceSelect = (item: ItemAquisicao) => {
        const isDuplicate = selectedItems.some(i => i.codigo_catmat === item.codigo_catmat && i.numero_pregao === item.numero_pregao);
        
        if (isDuplicate) {
            toast.warning("Este item já está na lista.");
            return;
        }

        setSelectedItems(prev => [...prev, { ...item, nd: mode === 'material' ? '30' : '39' }]);
    };

    const handleRemoveSelectedItem = (id: string) => {
        setSelectedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleConfirmImport = () => {
        if (selectedItems.length === 0) return;
        onImport(selectedItems);
        setSelectedItems([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) setSelectedItems([]);
            onOpenChange(val);
        }}>
            <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Importar Itens via API PNCP ({mode === 'material' ? 'Material' : 'Serviço'})
                    </DialogTitle>
                    <DialogDescription>
                        Pesquise itens homologados no Portal Nacional de Contratações Públicas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs defaultValue="arp_catmat" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="mx-6 grid grid-cols-3">
                            <TabsTrigger value="arp_catmat" className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                Por Código ({mode === 'material' ? 'CATMAT' : 'CATSER'})
                            </TabsTrigger>
                            <TabsTrigger value="arp_uasg" className="flex items-center gap-2">
                                <List className="h-4 w-4" />
                                Por UASG (ARP)
                            </TabsTrigger>
                            <TabsTrigger value="price_stats" className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Estatísticas de Preço
                            </TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1 px-6" ref={scrollContainerRef}>
                            <div className="py-4">
                                <TabsContent value="arp_catmat" className="mt-0 outline-none">
                                    <ArpCatmatSearchForm 
                                        onItemPreSelect={handleItemPreSelect} 
                                        selectedItemIds={selectedItems.map(i => i.id)}
                                        onClearSelection={() => {}}
                                        scrollContainerRef={scrollContainerRef}
                                        mode={mode}
                                    />
                                </TabsContent>

                                <TabsContent value="arp_uasg" className="mt-0 outline-none">
                                    <ArpUasgSearchForm 
                                        onItemPreSelect={handleItemPreSelect}
                                        selectedItemIds={selectedItems.map(i => i.id)}
                                        mode={mode}
                                    />
                                </TabsContent>

                                <TabsContent value="price_stats" className="mt-0 outline-none">
                                    <PriceSearchForm 
                                        onPriceSelect={handlePriceSelect}
                                        isInspecting={false}
                                        onClearPriceSelection={() => {}}
                                        selectedItemForInspection={null}
                                        mode={mode}
                                    />
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </div>

                {selectedItems.length > 0 && (
                    <div className="border-t bg-muted/30 p-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                Itens Selecionados ({selectedItems.length})
                            </h4>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])} className="text-xs h-7">Limpar Tudo</Button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                            {selectedItems.map(item => (
                                <Badge key={item.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                                    <span className="max-w-[200px] truncate text-[10px]">{item.descricao_item}</span>
                                    <button onClick={() => handleRemoveSelectedItem(item.id)} className="hover:bg-muted rounded-full p-0.5">
                                        <Info className="h-3 w-3 rotate-45" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter className="p-6 pt-2 border-t bg-background">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmImport} disabled={selectedItems.length === 0}>
                        Importar {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Itens'} Selecionados
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;