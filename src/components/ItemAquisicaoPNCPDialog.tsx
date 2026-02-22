"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, CheckCircle, Package, List } from "lucide-react";
import { toast } from "sonner";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';

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
    const [preSelectedItems, setPreSelectedItems] = useState<ItemAquisicao[]>([]);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const handleItemPreSelect = (item: DetailedArpItem, pregao: string, uasg: string) => {
        const isAlreadySelected = preSelectedItems.some(i => i.id === item.id);
        if (isAlreadySelected) {
            setPreSelectedItems(prev => prev.filter(i => i.id !== item.id));
            return;
        }

        const newItem: ItemAquisicao = {
            id: item.id,
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50),
            valor_unitario: item.valorUnitario,
            numero_pregao: pregao,
            uasg: uasg,
            codigo_catmat: item.codigoItem,
            quantidade: 0,
            valor_total: 0,
            nd: mode === 'material' ? '30' : '39',
            nr_subitem: '',
            nome_subitem: '',
        };
        setPreSelectedItems(prev => [...prev, newItem]);
    };

    const handleConfirmImport = () => {
        if (preSelectedItems.length === 0) return;
        onImport(preSelectedItems);
        setPreSelectedItems([]);
        onOpenChange(false);
        toast.success(`${preSelectedItems.length} itens importados com sucesso!`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col modal-importar-pncp">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Importar via API PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Busque itens diretamente no Portal Nacional de Contratações Públicas.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="uasg" className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="uasg">Por UASG (Atas)</TabsTrigger>
                        <TabsTrigger value="catmat">Por {mode === 'material' ? 'CATMAT' : 'CATSER'} (Atas)</TabsTrigger>
                        <TabsTrigger value="price">Pesquisa de Preços</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1 mt-4 pr-4" ref={scrollRef}>
                        <TabsContent value="uasg" className="m-0">
                            <ArpUasgSearchForm 
                                onItemPreSelect={handleItemPreSelect}
                                selectedItemIds={preSelectedItems.map(i => i.id)}
                                onClearSelection={() => setPreSelectedItems([])}
                                scrollContainerRef={scrollRef}
                            />
                        </TabsContent>
                        <TabsContent value="catmat" className="m-0">
                            <ArpCatmatSearchForm 
                                onItemPreSelect={handleItemPreSelect}
                                selectedItemIds={preSelectedItems.map(i => i.id)}
                                onClearSelection={() => setPreSelectedItems([])}
                                scrollContainerRef={scrollRef}
                                mode={mode}
                            />
                        </TabsContent>
                        <TabsContent value="price" className="m-0">
                            <PriceSearchForm 
                                onPriceSelect={(item) => onImport([item])}
                                isInspecting={false}
                                onClearPriceSelection={() => {}}
                                selectedItemForInspection={null}
                                mode={mode}
                            />
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className="border-t pt-4 mt-4 flex items-center justify-between bg-muted/30 p-4 rounded-lg">
                    <div className="text-sm">
                        {preSelectedItems.length === 0 ? (
                            <span className="text-muted-foreground">Nenhum item selecionado</span>
                        ) : (
                            <span className="font-semibold text-primary">{preSelectedItems.length} item(ns) selecionado(s)</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleConfirmImport} 
                            disabled={preSelectedItems.length === 0}
                            className="btn-confirmar-importacao-pncp"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Importar Selecionados
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;