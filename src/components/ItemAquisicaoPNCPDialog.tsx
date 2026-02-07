import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, Loader2, Import } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from '@/types/pncp';
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch'; // Importa o novo componente

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

// Placeholder components for future implementation
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

// NOVO TIPO DE ESTADO: Armazena o item detalhado selecionado e seus metadados de origem
interface SelectedItemState {
    item: DetailedArpItem;
    pregaoFormatado: string;
    uasg: string;
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [selectedTab, setSelectedTab] = useState("arp-uasg");
    const [selectedItemState, setSelectedItemState] = useState<SelectedItemState | null>(null);
    
    // Função chamada pelo ArpSearchResultsList quando um item detalhado é clicado
    const handleItemPreSelect = (item: DetailedArpItem | null, pregaoFormatado: string, uasg: string) => {
        if (item) {
            setSelectedItemState({ item, pregaoFormatado, uasg });
        } else {
            setSelectedItemState(null);
        }
    };
    
    // Função para confirmar a importação (disparada pelo botão no rodapé)
    const handleConfirmImport = () => {
        if (!selectedItemState) {
            toast.error("Selecione um item detalhado para importar.");
            return;
        }
        
        const { item, pregaoFormatado, uasg } = selectedItemState;
        
        // Mapeamento final do DetailedArpItem para ItemAquisicao
        const itemAquisicao: ItemAquisicao = {
            id: item.id, 
            descricao_item: item.descricaoItem,
            descricao_reduzida: item.descricaoItem.substring(0, 50) + (item.descricaoItem.length > 50 ? '...' : ''),
            valor_unitario: item.valorUnitario, 
            numero_pregao: pregaoFormatado, 
            uasg: uasg, 
            codigo_catmat: item.codigoItem, 
        };
        
        onImport([itemAquisicao]);
        onOpenChange(false);
        toast.success(`Item '${itemAquisicao.descricao_reduzida || itemAquisicao.descricao_item}' importado do PNCP.`);
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
                        <ArpUasgSearch 
                            onItemPreSelect={handleItemPreSelect} 
                            selectedItemId={selectedItemState?.item.id || null}
                        />
                    </TabsContent>
                    
                    <TabsContent value="arp-catmat">
                        <ArpCatmatSearch onSelect={() => {}} /> {/* onSelect vazio, pois a lógica de seleção foi elevada */}
                    </TabsContent>
                    
                    <TabsContent value="avg-price">
                        <AveragePriceSearch onSelect={() => {}} /> {/* onSelect vazio, pois a lógica de seleção foi elevada */}
                    </TabsContent>
                </Tabs>

                {/* Rodapé com o botão de importação movido */}
                <div className="flex justify-between gap-2 pt-4 border-t">
                    <div className="flex items-center text-sm text-muted-foreground">
                        {selectedItemState ? (
                            <p className="text-green-600 font-medium">
                                Item Selecionado: {selectedItemState.item.descricaoItem.substring(0, 40)}...
                            </p>
                        ) : (
                            <p>Nenhum item selecionado.</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            onClick={handleConfirmImport}
                            disabled={!selectedItemState}
                        >
                            <Import className="h-4 w-4 mr-2" />
                            Importar Item Selecionado
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Fechar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;