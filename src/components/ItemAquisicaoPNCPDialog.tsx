"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Info, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    selectedYear: number;
    mode?: 'material' | 'servico';
    onReviewItem?: (item: ItemAquisicao) => void;
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    selectedYear,
    mode = 'material',
    onReviewItem
}) => {
    const [selectedItems, setSelectedItems] = useState<ItemAquisicao[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const isTourActive = typeof window !== 'undefined' && localStorage.getItem('is_ghost_mode') === 'true';

    const handleItemPreSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        const isDuplicate = existingItemsInDiretriz.some(existing => 
            existing.codigo_catmat === item.codigoItem && 
            existing.numero_pregao === pregaoFormatado && 
            existing.uasg === uasg
        );

        if (isDuplicate) {
            toast.warning("Este item já existe nesta diretriz.");
            return;
        }

        const isAlreadySelected = selectedItems.some(s => 
            s.codigo_catmat === item.codigoItem && 
            s.numero_pregao === pregaoFormatado && 
            s.uasg === uasg
        );

        if (isAlreadySelected) {
            setSelectedItems(prev => prev.filter(s => 
                !(s.codigo_catmat === item.codigoItem && s.numero_pregao === pregaoFormatado && s.uasg === uasg)
            ));
        } else {
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
            setSelectedItems(prev => [...prev, newItem]);
        }
    };

    const handleConfirmImport = () => {
        if (selectedItems.length === 0) return;
        onImport(selectedItems);
        toast.success(`${selectedItems.length} itens importados com sucesso!`);
        setSelectedItems([]);
        onOpenChange(false);
    };

    return (
        <Dialog 
            open={open} 
            onOpenChange={onOpenChange}
            modal={!isTourActive}
        >
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden modal-importar-pncp">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Integração API PNCP - {mode === 'material' ? 'Materiais' : 'Serviços'}
                    </DialogTitle>
                    <DialogDescription>
                        Busque itens diretamente no Portal Nacional de Contratações Públicas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs defaultValue="uasg" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6">
                            <TabsList className="grid w-full grid-cols-3 mt-2">
                                <TabsTrigger value="uasg">Por UASG (ARP)</TabsTrigger>
                                <TabsTrigger value="catmat">Por Código {mode === 'material' ? 'CATMAT' : 'CATSER'}</TabsTrigger>
                                <TabsTrigger value="price">Pesquisa de Preços</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 px-6" ref={scrollContainerRef}>
                            <div className="py-4 space-y-6">
                                <TabsContent value="uasg" className="mt-0 focus-visible:outline-none">
                                    <div className="form-busca-uasg-tour">
                                        <ArpUasgSearchForm 
                                            onItemPreSelect={handleItemPreSelect}
                                            selectedItemIds={selectedItems.map(i => `${i.codigo_catmat}-${i.numero_pregao}-${i.uasg}`)}
                                            onClearSelection={() => setSelectedItems([])}
                                            scrollContainerRef={scrollContainerRef}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="catmat" className="mt-0 focus-visible:outline-none">
                                    <ArpCatmatSearchForm 
                                        onItemPreSelect={handleItemPreSelect}
                                        selectedItemIds={selectedItems.map(i => `${i.codigo_catmat}-${i.numero_pregao}-${i.uasg}`)}
                                        onClearSelection={() => setSelectedItems([])}
                                        scrollContainerRef={scrollContainerRef}
                                        mode={mode}
                                    />
                                </TabsContent>

                                <TabsContent value="price" className="mt-0 focus-visible:outline-none">
                                    <PriceSearchForm 
                                        onPriceSelect={(item) => {
                                            setSelectedItems([item]);
                                            if (onReviewItem) onReviewItem(item);
                                        }}
                                        isInspecting={false}
                                        onClearPriceSelection={() => setSelectedItems([])}
                                        selectedItemForInspection={null}
                                        mode={mode}
                                    />
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </div>

                <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {selectedItems.length > 0 ? (
                            <Badge variant="default" className="h-8 px-3 gap-2">
                                <CheckCircle className="h-4 w-4" />
                                {selectedItems.length} item(ns) selecionado(s)
                            </Badge>
                        ) : (
                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Selecione os itens nos resultados acima
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleConfirmImport} 
                            disabled={selectedItems.length === 0}
                            className="gap-2"
                        >
                            Importar Selecionados
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;