"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ArpUasgSearchForm from './pncp/ArpUasgSearchForm';
import ArpCatmatSearchForm from './pncp/ArpCatmatSearchForm';
import PriceSearchForm from './pncp/PriceSearchForm';
import { DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isGhostMode } from '@/lib/ghostStore';
import PNCPInspectionDialog from '@/components/pncp/PNCPInspectionDialog';
import ServicoUnitMeasureDialog from '@/components/pncp/ServicoUnitMeasureDialog';
import { InspectionItem } from '@/types/pncpInspection';
import { supabase } from "@/integrations/supabase/client";

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
    const scrollRef = React.useRef(null);

    // Estados da Esteira de Inspeção
    const [isInspectionOpen, setIsInspectionOpen] = useState(false);
    const [inspectionList, setInspectionList] = useState<InspectionItem[]>([]);
    const [isUnitMeasureOpen, setIsUnitMeasureOpen] = useState(false);
    const [itemsForUnitMeasure, setItemsForUnitMeasure] = useState<ItemAquisicao[]>([]);
    const [isCheckingDB, setIsCheckingDB] = useState(false);

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

    // PASSO 1: Intercepta a importação, varre o BD e prepara a Inspeção
    const handleConfirmImport = async () => {
        if (preSelectedItems.length === 0) return;
        
        setIsCheckingDB(true);
        try {
            const tableName = mode === 'material' ? 'catalogo_catmat' : 'catalogo_catser';
            const itemCodes = preSelectedItems.map(i => i.codigo_catmat);
            
            // Varredura no Banco de Dados
            const { data: catalogData, error } = await supabase
                .from(tableName as any)
                .select('code, short_description')
                .in('code', itemCodes);
            
            if (error) throw error;
            
            const listToInspect: InspectionItem[] = preSelectedItems.map(item => {
                const isDuplicate = existingItemsInDiretriz.some(existing => 
                    existing.numero_pregao === item.numero_pregao && 
                    existing.codigo_catmat === item.codigo_catmat &&
                    existing.uasg === item.uasg
                );

                // Força a tipagem do retorno para evitar erros de SelectQueryError
                const entries = (catalogData as any[]) || [];
                const catalogEntry = entries.find(c => c.code === item.codigo_catmat);
                const hasCatalogShortDesc = !!(catalogEntry && catalogEntry.short_description && catalogEntry.short_description.trim() !== '');
                
                let finalShortDesc = '';
                let isCataloged = false;
                let needsInfo = false;
                
                if (hasCatalogShortDesc) {
                    finalShortDesc = catalogEntry.short_description;
                    isCataloged = true;
                    needsInfo = false;
                } else {
                    finalShortDesc = item.descricao_item.substring(0, 50);
                    needsInfo = true;
                }

                return {
                    originalPncpItem: { id: item.id } as any, 
                    mappedItem: { ...item, descricao_reduzida: finalShortDesc },
                    fullPncpDescription: item.descricao_item,
                    userShortDescription: hasCatalogShortDesc ? finalShortDesc : '',
                    status: isDuplicate ? 'duplicate' : (needsInfo ? 'needs_catmat_info' : 'valid'),
                    messages: isDuplicate ? ['Chave de contrato duplicada'] : [],
                    isCatmatCataloged: isCataloged,
                    nomePdm: item.descricao_item.substring(0, 30), // Adicionado para cumprir a interface
                };
            });
            setInspectionList(listToInspect);
            setIsInspectionOpen(true);
        } catch (error) {
            console.error("Erro ao verificar catálogo:", error);
            toast.error("Erro ao verificar catálogo no banco de dados.");
        } finally {
            setIsCheckingDB(false);
        }
    };

    // PASSO 2: Retorno da Inspeção (Joga para Unidade de Medida ou Finaliza)
    const handleInspectionFinalImport = (items: ItemAquisicao[]) => {
        setIsInspectionOpen(false);
        if (mode === 'servico') {
            setItemsForUnitMeasure(items);
            setIsUnitMeasureOpen(true);
        } else {
            finishImport(items);
        }
    };

    // PASSO 3: Finaliza e envia para a Diretriz
    const finishImport = (items: ItemAquisicao[]) => {
        onImport(items);
        setPreSelectedItems([]);
        setItemsForUnitMeasure([]);
        setIsUnitMeasureOpen(false);
        onOpenChange(false);
        toast.success(`${items.length} itens importados com sucesso!`);
        
        if (isGhostMode()) {
            window.dispatchEvent(new CustomEvent('tour:avancar'));
        }
    };

    return (
        <>
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
                                disabled={preSelectedItems.length === 0 || isCheckingDB}
                                className="btn-confirmar-importacao-pncp"
                            >
                                {isCheckingDB ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                {isCheckingDB ? "Verificando BD..." : "Preparar Importação"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Modais da Esteira de Produção */}
            {isInspectionOpen && (
                <PNCPInspectionDialog 
                    open={isInspectionOpen}
                    onOpenChange={setIsInspectionOpen}
                    inspectionList={inspectionList}
                    onFinalImport={handleInspectionFinalImport}
                    onReviewItem={onReviewItem || (() => {})}
                    mode={mode}
                />
            )}
            {isUnitMeasureOpen && mode === 'servico' && (
                <ServicoUnitMeasureDialog 
                    open={isUnitMeasureOpen}
                    onOpenChange={setIsUnitMeasureOpen}
                    items={itemsForUnitMeasure}
                    onConfirm={finishImport}
                />
            )}
        </>
    );
};

export default ItemAquisicaoPNCPDialog;