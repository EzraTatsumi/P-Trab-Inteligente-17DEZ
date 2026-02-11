import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Building2, Hash, Info } from "lucide-react";
import ArpUasgSearchForm from './ArpUasgSearchForm';
import ArpCatmatSearchForm from './ArpCatmatSearchForm';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onReviewItem?: (item: ItemAquisicao) => void;
    selectedYear: number;
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem,
    selectedYear,
}) => {
    const [activeTab, setActiveTab] = useState<string>("uasg");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-primary" />
                        Importar Itens do PNCP (Governo Federal)
                    </DialogTitle>
                    <DialogDescription>
                        Pesquise Atas de Registro de Preços (ARP) vigentes para importar itens diretamente para sua diretriz.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 rounded-md flex gap-3 items-start mb-4">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-semibold">Dica de Busca:</p>
                        <p>Você pode buscar por uma <strong>UASG específica</strong> para ver todas as suas atas, ou pesquisar por um código <strong>CATMAT/CATSER</strong> para encontrar atas de qualquer órgão que contenham aquele item.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="uasg" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Busca por UASG (Órgão)
                        </TabsTrigger>
                        <TabsTrigger value="catmat" className="flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            Busca por CATMAT/CATSER
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="uasg" className="space-y-4">
                        <ArpUasgSearchForm 
                            onImport={onImport}
                            existingItemsInDiretriz={existingItemsInDiretriz}
                            onClose={() => onOpenChange(false)}
                        />
                    </TabsContent>

                    <TabsContent value="catmat" className="space-y-4">
                        <ArpCatmatSearchForm 
                            onImport={onImport}
                            existingItemsInDiretriz={existingItemsInDiretriz}
                            onClose={() => onOpenChange(false)}
                            onReviewItem={onReviewItem}
                            selectedYear={selectedYear}
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;