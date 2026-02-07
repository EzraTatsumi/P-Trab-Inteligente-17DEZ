import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, Loader2, Import } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from '@/types/pncp';
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch'; // Importa o novo componente
import { fetchCatmatShortDescription } from '@/integrations/supabase/api'; // NOVO: Importa a função de busca CATMAT

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
    // MUDANÇA: selectedItemState agora é um array
    const [selectedItemsState, setSelectedItemsState] = useState<SelectedItemState[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    
    // MUDANÇA: Função para alternar a seleção de um item detalhado
    const handleItemPreSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        setSelectedItemsState(prev => {
            const existingIndex = prev.findIndex(s => s.item.id === item.id);
            
            if (existingIndex !== -1) {
                // Remover item (desselecionar)
                return prev.filter((_, index) => index !== existingIndex);
            } else {
                // Adicionar item (selecionar)
                return [...prev, { item, pregaoFormatado, uasg }];
            }
        });
    };
    
    // Mapeia apenas os IDs para passar para os componentes de busca
    const selectedItemIds = selectedItemsState.map(s => s.item.id);

    // Função para confirmar a importação (disparada pelo botão no rodapé)
    const handleConfirmImport = async () => {
        if (selectedItemsState.length === 0) {
            toast.error("Selecione pelo menos um item detalhado para importar.");
            return;
        }
        
        setIsImporting(true);
        
        try {
            const importPromises = selectedItemsState.map(async ({ item, pregaoFormatado, uasg }) => {
                // 1. Buscar a descrição reduzida no catálogo CATMAT
                const shortDescription = await fetchCatmatShortDescription(item.codigoItem);
                
                // 2. Mapeamento final do DetailedArpItem para ItemAquisicao
                const itemAquisicao: ItemAquisicao = {
                    // Usamos o ID do item detalhado do PNCP como ID local
                    id: item.id, 
                    descricao_item: item.descricaoItem,
                    // Usa a descrição reduzida do CATMAT, ou um fallback
                    descricao_reduzida: shortDescription || item.descricaoItem.substring(0, 50) + (item.descricaoItem.length > 50 ? '...' : ''),
                    valor_unitario: item.valorUnitario, 
                    numero_pregao: pregaoFormatado, 
                    uasg: uasg, 
                    codigo_catmat: item.codigoItem, 
                };
                return itemAquisicao;
            });
            
            const importedItems = await Promise.all(importPromises);
            
            onImport(importedItems);
            onOpenChange(false);
            toast.success(`${importedItems.length} itens importados do PNCP com sucesso.`);
            
        } catch (error) {
            console.error("Erro durante a importação PNCP:", error);
            toast.error("Falha ao importar itens. Tente novamente.");
        } finally {
            setIsImporting(false);
        }
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
                            selectedItemIds={selectedItemIds}
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
                        {/* MUDANÇA: Removido o indicador de item único */}
                        {selectedItemsState.length > 0 ? (
                            <p className="text-green-600 font-medium">
                                {selectedItemsState.length} item(ns) selecionado(s) para importação.
                            </p>
                        ) : (
                            <p>Nenhum item selecionado.</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            onClick={handleConfirmImport}
                            disabled={selectedItemsState.length === 0 || isImporting}
                        >
                            {isImporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Import className="h-4 w-4 mr-2" />
                            )}
                            Importar Item Selecionado ({selectedItemsState.length})
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                            Fechar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;