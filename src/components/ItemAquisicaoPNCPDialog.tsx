"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Globe, FileText, ListChecks, Info } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { Badge } from './ui/badge';
import { formatCurrency } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { isGhostMode, GHOST_DATA } from '@/lib/ghostStore';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onReviewItem: (item: ItemAquisicao) => void;
    selectedYear: number;
    mode?: 'material' | 'servico' | 'permanente';
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
    const ghost = isGhostMode();

    const handleItemPreSelect = (item: DetailedArpItem, pregao: string, uasg: string) => {
        const newItem: ItemAquisicao = {
            id: item.id,
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50),
            unidade_medida: 'UN',
            valor_unitario: item.valorUnitario,
            numero_pregao: pregao,
            uasg: uasg,
            codigo_catmat: item.codigoItem,
            quantidade: 0,
            valor_total: 0,
            nd: mode === 'material' ? '30' : mode === 'servico' ? '39' : '52',
            nr_subitem: '',
            nome_subitem: '',
        };
        
        if (selectedItems.find(i => i.id === newItem.id)) {
            setSelectedItems(prev => prev.filter(i => i.id !== newItem.id));
        } else {
            setSelectedItems(prev => [...prev, newItem]);
        }
    };

    const handleConfirmImport = () => {
        onImport(selectedItems);
        setSelectedItems([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto z-tour-portal modal-importar-pncp">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Importar Dados do PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Busque preços e itens diretamente no Portal Nacional de Contratações Públicas.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="arp-uasg" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="arp-uasg" className="flex items-center gap-2">
                            <Search className="h-4 w-4" /> Por UASG
                        </TabsTrigger>
                        <TabsTrigger value="arp-catmat" className="flex items-center gap-2 aba-pncp-arp">
                            <FileText className="h-4 w-4" /> Por Cód. Item
                        </TabsTrigger>
                        <TabsTrigger value="price-stats" className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4" /> Média de Preços
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-4 border rounded-lg bg-background min-h-[400px]">
                        <TabsContent value="arp-uasg" className="m-0">
                            <ArpUasgSearchForm 
                                onItemPreSelect={handleItemPreSelect} 
                                selectedItemIds={selectedItems.map(i => i.id)}
                                onClearSelection={() => setSelectedItems([])}
                                scrollContainerRef={{ current: null } as any}
                            />
                        </TabsContent>
                        <TabsContent value="arp-catmat" className="m-0">
                            {ghost ? (
                                <div className="p-8 text-center space-y-4">
                                    <div className="p-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 item-resultado-ghost">
                                        <h4 className="font-bold text-primary">Item Encontrado (Simulação)</h4>
                                        <p className="text-sm text-muted-foreground">{GHOST_DATA.missao_02.item_cimento.descricao_item}</p>
                                        <div className="flex justify-center gap-4 mt-2">
                                            <Badge variant="outline">UASG: {GHOST_DATA.missao_02.item_cimento.uasg}</Badge>
                                            <Badge variant="secondary">{formatCurrency(GHOST_DATA.missao_02.item_cimento.valor_unitario)}</Badge>
                                        </div>
                                        <Button 
                                            className="mt-4" 
                                            onClick={() => setSelectedItems([GHOST_DATA.missao_02.item_cimento as any])}
                                        >
                                            Selecionar para Importação
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <ArpCatmatSearchForm 
                                    onItemPreSelect={handleItemPreSelect}
                                    selectedItemIds={selectedItems.map(i => i.id)}
                                    onClearSelection={() => setSelectedItems([])}
                                    scrollContainerRef={{ current: null } as any}
                                    mode={mode === 'material' ? 'material' : 'servico'}
                                />
                            )}
                        </TabsContent>
                        <TabsContent value="price-stats" className="m-0">
                            <PriceSearchForm 
                                onPriceSelect={(item) => setSelectedItems([item])}
                                isInspecting={false}
                                onClearPriceSelection={() => setSelectedItems([])}
                                selectedItemForInspection={null}
                                mode={mode === 'material' ? 'material' : 'servico'}
                            />
                        </TabsContent>
                    </div>
                </Tabs>

                {selectedItems.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg mt-4">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{selectedItems.length} item(ns) selecionado(s)</span>
                        </div>
                        <Button onClick={handleConfirmImport}>Confirmar Importação</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;