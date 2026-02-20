"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, FileText, BarChart3, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch';
import ArpCatmatSearch from './pncp/ArpCatmatSearch';
import PriceSearchForm from './pncp/PriceSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { ItemAquisicaoServico } from '@/types/diretrizesServicosTerceiros';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { Badge } from './ui/badge';
import { fetchCatalogEntry, saveNewCatalogEntry, fetchCatalogFullDescription } from '@/integrations/supabase/api';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: any[]) => void;
    existingItemsInDiretriz: any[];
    onReviewItem: (item: any) => void;
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
    const [selectedTab, setSelectedTab] = useState("arp-uasg");
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const dialogContentRef = useRef<HTMLDivElement>(null);

    // Mapeia o modo do diálogo para o modo aceito pelas APIs do PNCP
    const apiMode = mode === 'servico' ? 'servico' : 'material';

    const handleItemPreSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        setSelectedItem({
            ...item,
            pregaoFormatado,
            uasg,
            source: 'PNCP_ARP'
        });
    };

    const handlePriceSelect = (item: ItemAquisicao) => {
        setSelectedItem({
            ...item,
            source: 'PNCP_STATS'
        });
    };

    const handleClearSelection = () => {
        setSelectedItem(null);
    };

    const handleConfirmImport = async () => {
        if (!selectedItem) return;

        setIsImporting(true);
        try {
            let itemToImport: any;

            if (selectedItem.source === 'PNCP_ARP') {
                const catalogStatus = await fetchCatalogEntry(selectedItem.codigoItem, apiMode);
                
                if (!catalogStatus.isCataloged) {
                    const details = await fetchCatalogFullDescription(selectedItem.codigoItem, apiMode);
                    const description = details.fullDescription || selectedItem.descricaoItem;
                    const shortDescription = details.nomePdm || selectedItem.descricaoItem.substring(0, 50);
                    
                    await saveNewCatalogEntry(
                        selectedItem.codigoItem,
                        description,
                        shortDescription,
                        apiMode
                    );
                }

                itemToImport = {
                    id: Math.random().toString(36).substring(2, 9),
                    descricao_item: selectedItem.descricaoItem,
                    descricao_reduzida: selectedItem.descricaoItem.substring(0, 50),
                    valor_unitario: selectedItem.valorUnitario,
                    numero_pregao: selectedItem.pregaoFormatado,
                    uasg: selectedItem.uasg,
                    codigo_catmat: selectedItem.codigoItem,
                    unidade_medida: 'UN',
                    nd: apiMode === 'servico' ? '39' : '30'
                };
            } else {
                itemToImport = {
                    ...selectedItem,
                    nd: apiMode === 'servico' ? '39' : '30'
                };
            }

            onImport([itemToImport]);
            toast.success("Item importado com sucesso!");
            onOpenChange(false);
            setSelectedItem(null);
        } catch (error) {
            console.error("Erro ao importar item:", error);
            toast.error("Falha ao processar importação do item.");
        } finally {
            setIsImporting(false);
        }
    };

    const selectedItemIds = selectedItem ? [selectedItem.id || selectedItem.codigoItem] : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Importar Itens do PNCP ({mode === 'servico' ? 'Serviços' : 'Materiais'})
                    </DialogTitle>
                    <DialogDescription>
                        Pesquise atas de registro de preços ou estatísticas de preços públicos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b">
                            <TabsList className="grid w-full grid-cols-3 mb-2">
                                <TabsTrigger value="arp-uasg" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    ARP por UASG
                                </TabsTrigger>
                                <TabsTrigger value="arp-catmat" className="flex items-center gap-2">
                                    <Search className="h-4 w-4" />
                                    ARP por Código
                                </TabsTrigger>
                                <TabsTrigger value="avg-price" className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    Preço Médio
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6" ref={dialogContentRef}>
                            <TabsContent value="arp-uasg" className="mt-0 outline-none">
                                <ArpUasgSearch 
                                    onItemPreSelect={handleItemPreSelect} 
                                    selectedItemIds={selectedItemIds} 
                                    onClearSelection={handleClearSelection} 
                                    scrollContainerRef={dialogContentRef} 
                                    mode={apiMode} 
                                />
                            </TabsContent>

                            <TabsContent value="arp-catmat" className="mt-0 outline-none">
                                <ArpCatmatSearch 
                                    onItemPreSelect={handleItemPreSelect} 
                                    selectedItemIds={selectedItemIds} 
                                    onClearSelection={handleClearSelection} 
                                    scrollContainerRef={dialogContentRef} 
                                    mode={apiMode} 
                                />
                            </TabsContent>

                            <TabsContent value="avg-price" className="mt-0 outline-none">
                                <PriceSearchForm 
                                    onPriceSelect={handlePriceSelect} 
                                    isInspecting={false} 
                                    onClearPriceSelection={handleClearSelection} 
                                    selectedItemForInspection={null} 
                                    mode={apiMode} 
                                />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                <DialogFooter className="p-6 border-t bg-muted/30">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex-1 mr-4">
                            {selectedItem ? (
                                <div className="flex items-center gap-2 text-sm text-green-600 font-medium animate-in fade-in slide-in-from-left-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Item selecionado: {selectedItem.descricaoItem || selectedItem.descricao_item}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <AlertCircle className="h-4 w-4" />
                                    Selecione um item para importar
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button 
                                onClick={handleConfirmImport} 
                                disabled={!selectedItem || isImporting}
                                className="min-w-[120px]"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    "Importar Item"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;