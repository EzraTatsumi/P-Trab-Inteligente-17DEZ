"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from "@/types/pncp";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { toast } from "sonner";
import { GHOST_DATA, isGhostMode } from '@/lib/ghostStore';

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
    const [activeTab, setActiveTab] = useState("uasg");

    const handleArpItemSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        const newItem: ItemAquisicao = {
            id: item.id,
            codigo_catmat: item.codigoItem,
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50),
            valor_unitario: item.valorUnitario,
            numero_pregao: pregaoFormatado,
            uasg: uasg,
            quantidade: 0,
            valor_total: 0,
            nd: mode === 'material' ? '30' : '39',
            nr_subitem: '',
            nome_subitem: '',
        };

        if (existingItemsInDiretriz.some(i => i.codigo_catmat === newItem.codigo_catmat && i.uasg === newItem.uasg && i.numero_pregao === newItem.numero_pregao)) {
            toast.warning("Este item já existe neste subitem.");
            return;
        }

        onImport([newItem]);
        toast.success("Item importado com sucesso!");
        onOpenChange(false);
    };

    const handlePriceSelect = (item: ItemAquisicao) => {
        onReviewItem(item);
        onOpenChange(false);
    };

    // Lógica para o Ghost Mode na Missão 02
    const handleGhostItemSelect = () => {
        if (isGhostMode()) {
            const ghostItem = GHOST_DATA.missao_02.item_cimento;
            onImport([ghostItem as any]);
            toast.success("Item importado com sucesso!");
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto z-tour-portal">
                <DialogHeader>
                    <DialogTitle>Importar Dados do PNCP</DialogTitle>
                    <DialogDescription>Busque preços e especificações técnicas diretamente no Portal Nacional de Contratações Públicas.</DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="uasg">Por UASG</TabsTrigger>
                        <TabsTrigger value="catmat">Por Código</TabsTrigger>
                        <TabsTrigger value="arp" className="aba-pncp-arp">Por ARP</TabsTrigger>
                    </TabsList>

                    <TabsContent value="uasg" className="mt-4">
                        <ArpUasgSearchForm 
                            onItemPreSelect={handleArpItemSelect} 
                            selectedItemIds={existingItemsInDiretriz.map(i => i.id)} 
                            onClearSelection={() => {}} 
                            scrollContainerRef={{ current: null } as any}
                        />
                    </TabsContent>

                    <TabsContent value="catmat" className="mt-4">
                        <ArpCatmatSearchForm 
                            onItemPreSelect={handleArpItemSelect} 
                            selectedItemIds={existingItemsInDiretriz.map(i => i.id)} 
                            onClearSelection={() => {}} 
                            scrollContainerRef={{ current: null } as any}
                            mode={mode}
                        />
                    </TabsContent>

                    <TabsContent value="arp" className="mt-4">
                        {isGhostMode() ? (
                            <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30">
                                <h3 className="text-lg font-semibold mb-2">Simulação de Busca ARP</h3>
                                <p className="text-muted-foreground mb-4">Na Missão 02, simulamos a busca pela UASG 160222.</p>
                                <Button onClick={handleGhostItemSelect} className="item-resultado-ghost">
                                    Importar Cimento Portland (UASG 160222)
                                </Button>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                <p>Busca direta por número de ARP em desenvolvimento.</p>
                                <p className="text-sm">Utilize a busca por UASG ou Código para encontrar itens de Atas.</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;