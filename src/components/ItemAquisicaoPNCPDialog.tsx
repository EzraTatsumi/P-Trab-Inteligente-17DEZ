import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs";
import { Search, DollarSign, Import, Loader2 } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from "@/types/pncp";
import { InspectionItem } from "@/types/pncpInspection";
import { fetchCatmatShortDescription, fetchCatmatFullDescription } from "@/integrations/supabase/api";
import ArpUasgSearchForm from "./pncp/ArpUasgSearchForm";
import PriceSearchForm from "./pncp/PriceSearchForm";
import PNCPInspectionDialog from "./pncp/PNCPInspectionDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[];
    onReviewItem: (item: ItemAquisicao) => void;
    selectedYear: number;
    mode: 'material' | 'servico';
}

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem,
    selectedYear,
    mode
}) => {
    const [selectedItems, setSelectedItems] = useState<ItemAquisicao[]>([]);
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectionList, setInspectionList] = useState<InspectionItem[]>([]);
    const [showInspection, setShowInspection] = useState(false);

    const handlePreSelect = (item: DetailedArpItem | ItemAquisicao) => {
        // Lógica de mapeamento conforme layout original
        const mapped: ItemAquisicao = 'id' in item && 'valor_unitario' in item ? item as ItemAquisicao : {
            id: (item as DetailedArpItem).id,
            codigo_catmat: (item as DetailedArpItem).codigoItem,
            descricao_item: (item as DetailedArpItem).descricaoItem,
            descricao_reduzida: '',
            valor_unitario: (item as DetailedArpItem).valorUnitario,
            numero_pregao: (item as DetailedArpItem).pregaoFormatado,
            uasg: (item as DetailedArpItem).uasg,
            quantidade: 0, valor_total: 0, nd: '', nr_subitem: '', nome_subitem: ''
        };
        setSelectedItems(prev => prev.some(i => i.id === mapped.id) ? prev.filter(i => i.id !== mapped.id) : [...prev, mapped]);
    };

    const startInspection = async () => {
        setIsInspecting(true);
        try {
            const list: InspectionItem[] = await Promise.all(selectedItems.map(async item => {
                const status = await fetchCatmatShortDescription(item.codigo_catmat);
                return {
                    originalPncpItem: { id: item.id } as any,
                    mappedItem: { ...item, descricao_reduzida: status.shortDescription || '' },
                    status: status.isCataloged && status.shortDescription ? 'valid' : 'needs_catmat_info',
                    isCatmatCataloged: status.isCataloged,
                    userShortDescription: status.shortDescription || '',
                    fullPncpDescription: item.descricao_item,
                    messages: []
                };
            }));
            setInspectionList(list);
            setShowInspection(true);
        } catch (error) {
            toast.error("Erro na inspeção.");
        } finally {
            setIsInspecting(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Importar via API PNCP ({mode === 'material' ? 'Material' : 'Serviço'})</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="uasg">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="uasg"><Search className="mr-2 h-4 w-4" /> Busca por UASG (ARP)</TabsTrigger>
                            <TabsTrigger value="price"><DollarSign className="mr-2 h-4 w-4" /> Preço Médio</TabsTrigger>
                        </TabsList>
                        <TabsContent value="uasg">
                            <ArpUasgSearchForm 
                                mode={mode} 
                                onItemPreSelect={handlePreSelect} 
                                onClearSelection={() => setSelectedItems([])} 
                                selectedItemIds={selectedItems.map(i => i.id)} 
                            />
                        </TabsContent>
                        <TabsContent value="price">
                            <PriceSearchForm 
                                mode={mode} 
                                onPriceSelect={handlePreSelect} 
                                isInspecting={isInspecting} 
                                onClearPriceSelection={() => setSelectedItems([])} 
                                selectedItemForInspection={selectedItems[0] || null} 
                            />
                        </TabsContent>
                    </Tabs>
                    <div className="flex justify-end gap-2 mt-4 border-t pt-4">
                        <Button onClick={startInspection} disabled={selectedItems.length === 0 || isInspecting}>
                            {isInspecting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Import className="h-4 w-4 mr-2" />}
                            Inspecionar e Importar ({selectedItems.length})
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <PNCPInspectionDialog 
                open={showInspection} 
                onOpenChange={setShowInspection} 
                inspectionList={inspectionList} 
                onFinalImport={onImport} 
                onReviewItem={onReviewItem} 
                mode={mode} 
            />
        </>
    );
};

export default ItemAquisicaoPNCPDialog;