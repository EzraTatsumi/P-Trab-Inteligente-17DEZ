"use client";

import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Loader2, CheckCircle, List, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { DetailedArpItem } from "@/types/pncp";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isGhostMode } from '@/lib/ghostStore';

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

    const handleItemPreSelect = useCallback((item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        const isAlreadySelected = selectedItems.some(i => i.id === item.id);
        if (isAlreadySelected) {
            setSelectedItems(prev => prev.filter(i => i.id !== item.id));
            return;
        }

        const isAlreadyInDiretriz = existingItemsInDiretriz.some(i => i.codigo_catmat === item.codigoItem && i.uasg === uasg && i.numero_pregao === pregaoFormatado);
        if (isAlreadyInDiretriz) {
            toast.warning("Este item já existe nesta diretriz.");
            return;
        }

        const newItem: ItemAquisicao = {
            id: item.id,
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50),
            valor_unitario: item.valorUnitario,
            numero_pregao: pregaoFormatado,
            uasg: uasg,
            codigo_catmat: item.codigoItem,
            quantidade: 0,
            valor_total: 0,
            nd: mode === 'material' ? '30' : '39',
            nr_subitem: '',
            nome_subitem: ''
        };

        setSelectedItems(prev => [...prev, newItem]);
    }, [selectedItems, existingItemsInDiretriz, mode]);

    const handleClearSelection = useCallback(() => {
        setSelectedItems([]);
    }, []);

    const handleConfirmImport = () => {
        if (selectedItems.length === 0) {
            toast.error("Nenhum item selecionado.");
            return;
        }
        onImport(selectedItems);
        toast.success(`${selectedItems.length} itens importados com sucesso!`);
        
        if (isGhostMode()) {
            window.dispatchEvent(new CustomEvent('tour:avancar'));
        }
        
        onOpenChange(false);
        setSelectedItems([]);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden modal-importar-pncp">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Importar via API PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Busque itens diretamente no Portal Nacional de Contratações Públicas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6">
                    <Tabs defaultValue="uasg" className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="uasg">Por UASG (Atas)</TabsTrigger>
                            <TabsTrigger value="catmat">Por {mode === 'material' ? 'CATMAT' : 'CATSER'} (Atas)</TabsTrigger>
                            <TabsTrigger value="price">Pesquisa de Preços</TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1 pr-4" ref={scrollContainerRef}>
                            <TabsContent value="uasg" className="mt-0">
                                <ArpUasgSearchForm 
                                    onItemPreSelect={handleItemPreSelect} 
                                    selectedItemIds={selectedItems.map(i => i.id)}
                                    onClearSelection={handleClearSelection}
                                    scrollContainerRef={scrollContainerRef as any}
                                />
                            </TabsContent>
                            <TabsContent value="catmat" className="mt-0">
                                <ArpCatmatSearchForm 
                                    onItemPreSelect={handleItemPreSelect} 
                                    selectedItemIds={selectedItems.map(i => i.id)}
                                    onClearSelection={handleClearSelection}
                                    scrollContainerRef={scrollContainerRef as any}
                                    mode={mode}
                                />
                            </TabsContent>
                            <TabsContent value="price" className="mt-0">
                                <PriceSearchForm 
                                    onPriceSelect={(item) => setSelectedItems([item])}
                                    isInspecting={false}
                                    onClearPriceSelection={handleClearSelection}
                                    selectedItemForInspection={null}
                                    mode={mode}
                                />
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>

                <DialogFooter className="p-6 border-t bg-muted/20">
                    <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-muted-foreground">
                            {selectedItems.length > 0 ? (
                                <span className="text-primary font-medium">{selectedItems.length} item(ns) selecionado(s)</span>
                            ) : (
                                "Nenhum item selecionado"
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button onClick={handleConfirmImport} disabled={selectedItems.length === 0}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Importar Selecionados
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;