"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BarChart3, History, Loader2 } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from "@/types/pncp";
import ArpUasgSearchForm from "./pncp/ArpUasgSearchForm";
import ArpCatmatSearchForm from "./pncp/ArpCatmatSearchForm";
import PriceSearchForm from "./pncp/PriceSearchForm";
import ArpItemInspection from "./pncp/ArpItemInspection";

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
    mode = 'material',
}) => {
    const [activeTab, setActiveTab] = useState<string>("arp_uasg");
    const [selectedItemForInspection, setSelectedItemForInspection] = useState<DetailedArpItem | null>(null);
    const [inspectionPregao, setInspectionPregao] = useState("");
    const [inspectionUasg, setInspectionUasg] = useState("");
    const [isInspecting, setIsInspecting] = useState(false);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleItemPreSelect = (item: DetailedArpItem, pregao: string, uasg: string) => {
        setSelectedItemForInspection(item);
        setInspectionPregao(pregao);
        setInspectionUasg(uasg);
        setIsInspecting(true);
    };

    const handleConfirmImport = (item: ItemAquisicao) => {
        onImport([item]);
        onOpenChange(false);
        setSelectedItemForInspection(null);
        setIsInspecting(false);
    };

    const handleCancelInspection = () => {
        setSelectedItemForInspection(null);
        setIsInspecting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Importar do PNCP ({mode === 'material' ? 'Material' : 'Serviço'})
                    </DialogTitle>
                    <DialogDescription>
                        Pesquise itens em Atas de Registro de Preços ou consulte estatísticas de preços públicos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {isInspecting && selectedItemForInspection ? (
                        <ArpItemInspection 
                            item={selectedItemForInspection}
                            pregaoFormatado={inspectionPregao}
                            uasg={inspectionUasg}
                            onConfirm={handleConfirmImport}
                            onCancel={handleCancelInspection}
                        />
                    ) : (
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="mx-6 grid grid-cols-3">
                                <TabsTrigger value="arp_uasg" className="flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    ARP por UASG
                                </TabsTrigger>
                                <TabsTrigger value="arp_catmat" className="flex items-center gap-2">
                                    <Search className="h-4 w-4" />
                                    ARP por Código
                                </TabsTrigger>
                                <TabsTrigger value="price_stats" className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    Estatísticas
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex-1 overflow-y-auto p-2" ref={scrollContainerRef}>
                                <TabsContent value="arp_uasg" className="mt-0 outline-none">
                                    <ArpUasgSearchForm 
                                        onItemPreSelect={handleItemPreSelect}
                                        selectedItemIds={[]}
                                        onClearSelection={() => {}}
                                        scrollContainerRef={scrollContainerRef}
                                    />
                                </TabsContent>

                                <TabsContent value="arp_catmat" className="mt-0 outline-none">
                                    <ArpCatmatSearchForm 
                                        onItemPreSelect={handleItemPreSelect}
                                        selectedItemIds={[]}
                                        onClearSelection={() => {}}
                                        scrollContainerRef={scrollContainerRef}
                                        mode={mode}
                                    />
                                </TabsContent>

                                <TabsContent value="price_stats" className="mt-0 outline-none">
                                    <PriceSearchForm 
                                        onPriceSelect={handleConfirmImport}
                                        isInspecting={false}
                                        onClearPriceSelection={() => {}}
                                        selectedItemForInspection={null}
                                        mode={mode}
                                    />
                                </TabsContent>
                            </div>
                        </Tabs>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;