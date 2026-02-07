import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, Loader2 } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch'; // Importa o novo componente

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

// Placeholder components for future implementation
// REMOVIDO: ArpUasgSearch placeholder
const ArpCatmatSearch: React.FC<{ onSelect: (item: ItemAquisicao) => void }> = ({ onSelect }) => (
    <div className="p-4 space-y-4">
        <p className="text-muted-foreground">
            Funcionalidade de Busca de ARP por CATMAT/CATSER será implementada aqui.
        </p>
        <Button disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Buscar ARP (Em desenvolvimento)
        </Button>
    </div>
);

const AveragePriceSearch: React.FC<{ onSelect: (item: ItemAquisicao) => void }> = ({ onSelect }) => (
    <div className="p-4 space-y-4">
        <p className="text-muted-foreground">
            Funcionalidade de Pesquisa de Preço Médio será implementada aqui.
        </p>
        <Button disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Pesquisar Preço (Em desenvolvimento)
        </Button>
    </div>
);


const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [selectedTab, setSelectedTab] = useState("arp-uasg");
    
    // Função para receber um item selecionado de qualquer subcomponente de busca
    const handleItemSelect = (item: ItemAquisicao) => {
        // Por enquanto, importamos um item por vez. Se a busca retornar múltiplos, ajustaremos.
        onImport([item]);
        onOpenChange(false);
        toast.success(`Item '${item.descricao_reduzida || item.descricao_item}' importado do PNCP.`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Importação de Itens PNCP
                    </DialogTitle>
                    <DialogDescription>
                        Selecione o método de busca no Portal Nacional de Contratações Públicas (PNCP).
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="arp-uasg" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            ARP por UASG
                        </TabsTrigger>
                        <TabsTrigger value="arp-catmat" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            ARP por CATMAT/CATSER
                        </TabsTrigger>
                        <TabsTrigger value="avg-price" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Preço Médio
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="arp-uasg">
                        <ArpUasgSearch onSelect={handleItemSelect} />
                    </TabsContent>
                    
                    <TabsContent value="arp-catmat">
                        <ArpCatmatSearch onSelect={handleItemSelect} />
                    </TabsContent>
                    
                    <TabsContent value="avg-price">
                        <AveragePriceSearch onSelect={handleItemSelect} />
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;