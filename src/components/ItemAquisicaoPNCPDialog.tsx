import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, Loader2, Import } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from '@/types/pncp';
import { InspectionItem, InspectionStatus } from '@/types/pncpInspection'; 
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch'; 
import ArpCatmatSearch from './pncp/ArpCatmatSearch'; 
import PriceSearchForm from './pncp/PriceSearchForm'; 
import { fetchCatalogEntry, fetchCatalogFullDescription, fetchAllExistingAcquisitionItems } from '@/integrations/supabase/api'; 
import PNCPInspectionDialog from './pncp/PNCPInspectionDialog'; 
import ServicoUnitMeasureDialog from './pncp/ServicoUnitMeasureDialog'; 
import { supabase } from '@/integrations/supabase/client'; 

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    existingItemsInDiretriz: ItemAquisicao[]; 
    onReviewItem: (item: ItemAquisicao) => void;
    selectedYear: number; 
    mode?: 'material' | 'servico' | 'permanente'; // ATUALIZADO: Adicionado 'permanente'
}

interface SelectedItemState {
    item: DetailedArpItem | ItemAquisicao; 
    pregaoFormatado: string;
    uasg: string;
    isPriceReference: boolean; 
}

const normalizeString = (str: string | number | null | undefined): string => {
    const s = String(str || '').trim();
    const normalized = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalized.toUpperCase().replace(/\s+/g, ' ');
};

const normalizeDigits = (value: string | number | null | undefined) =>
    normalizeString(value).replace(/[^\d]/g, "");

const normalizePregao = (value: string | number | null | undefined): string => {
    const s = normalizeString(value); 
    let digits = s.replace(/[^\d]/g, ''); 
    if (digits.length < 3) return digits; 
    let yearPart = '';
    let numberPart = digits;
    if (digits.length >= 4 && digits.slice(-4).startsWith('20')) {
        yearPart = digits.slice(-4).slice(-2); 
        numberPart = digits.slice(0, -4); 
    } else if (digits.length >= 2) {
        yearPart = digits.slice(-2); 
        numberPart = digits.slice(0, -2); 
    }
    return `${numberPart.replace(/^0+/, '')}${yearPart}`; 
};

interface DuplicateCheckResult {
    isDuplicate: boolean;
    matchingKeys: string[];
}

const isFlexibleDuplicate = (newItem: ItemAquisicao, existingItem: ItemAquisicao): DuplicateCheckResult => {
    const result: DuplicateCheckResult = { isDuplicate: false, matchingKeys: [] };
    const pregaoMatch = normalizePregao(newItem.numero_pregao) === normalizePregao(existingItem.numero_pregao);
    const uasgMatch = normalizeDigits(newItem.uasg).slice(0, 6) === normalizeDigits(existingItem.uasg).slice(0, 6);
    const valorMatch = Math.round(newItem.valor_unitario * 100) === Math.round(existingItem.valor_unitario * 100);
    if (!pregaoMatch || !uasgMatch || !valorMatch) return result; 
    const catmatMatch = normalizeDigits(newItem.codigo_catmat) === normalizeDigits(existingItem.codigo_catmat);
    const descCompletaMatch = normalizeString(newItem.descricao_item) === normalizeString(existingItem.descricao_item);
    const descReduzidaMatch = normalizeString(newItem.descricao_reduzida) === normalizeString(existingItem.descricao_reduzida);
    if (catmatMatch) result.matchingKeys.push('Código');
    if (descCompletaMatch) result.matchingKeys.push('Descrição Completa');
    if (descReduzidaMatch && normalizeString(newItem.descricao_reduzida).length > 0) result.matchingKeys.push('Nome Reduzido');
    if (result.matchingKeys.length > 0) result.isDuplicate = true;
    return result;
};

const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem, 
    selectedYear, 
    mode = 'material', 
}) => {
    const [selectedTab, setSelectedTab] = useState("arp-uasg");
    const [selectedItemsState, setSelectedItemsState] = useState<SelectedItemState[]>([]);
    const [isInspecting, setIsInspecting] = useState(false);
    const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);
    const [inspectionList, setInspectionList] = useState<InspectionItem[]>([]);
    
    const [isUnitMeasureDialogOpen, setIsUnitMeasureDialogOpen] = useState(false);
    const [itemsPendingUnitMeasure, setItemsPendingUnitMeasure] = useState<ItemAquisicao[]>([]);

    const dialogContentRef = useRef<HTMLDivElement>(null);

    // Mapeia o modo para o tipo de catálogo (material ou servico) para chamadas de API
    const apiMode = mode === 'permanente' ? 'material' : mode;

    const scrollToTop = () => {
        if (dialogContentRef.current) dialogContentRef.current.scrollTo(0, 0);
    };

    useEffect(() => {
        if (open) {
            setSelectedItemsState([]);
            setInspectionList([]);
            setIsInspectionDialogOpen(false);
            setIsUnitMeasureDialogOpen(false);
            scrollToTop(); 
        }
    }, [open]);
    
    const handleClearSelection = () => setSelectedItemsState([]);
    const handleClearPriceSelection = () => setSelectedItemsState(prev => prev.filter(s => !s.isPriceReference));
    
    const handleItemPreSelect = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        handleClearPriceSelection();
        setSelectedItemsState(prev => {
            const id = item.id;
            const existingIndex = prev.findIndex(s => s.item.id === id && !s.isPriceReference);
            if (existingIndex !== -1) return prev.filter((_, index) => index !== existingIndex);
            return [...prev, { item, pregaoFormatado, uasg, isPriceReference: false }];
        });
    };
    
    const handlePriceSelect = (item: ItemAquisicao) => {
        const newSelection = selectedItemsState.filter(s => !s.isPriceReference);
        setSelectedItemsState([...newSelection, { item, pregaoFormatado: item.numero_pregao, uasg: item.uasg, isPriceReference: true }]);
    };
    
    const selectedItemIds = selectedItemsState.map(s => s.item.id);
    const selectedArpItems = selectedItemsState.filter(s => !s.isPriceReference);
    const selectedPriceItems = selectedItemsState.filter(s => s.isPriceReference);
    const isPriceFlowActive = selectedPriceItems.length > 0;
    const selectedItemForInspection = isPriceFlowActive ? selectedPriceItems[0].item as ItemAquisicao : null;

    const handleStartInspection = async (isPriceReferenceFlow: boolean = false) => {
        const itemsToInspect = isPriceReferenceFlow ? selectedPriceItems : selectedArpItems;
        if (itemsToInspect.length === 0) {
            toast.error("Selecione pelo menos um item detalhado para importar.");
            return;
        }
        setIsInspecting(true);
        toast.info("Iniciando inspeção e validação dos itens selecionados...");
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Sessão expirada.");
                setIsInspecting(false);
                return;
            }
            const allExistingItems = await fetchAllExistingAcquisitionItems(selectedYear, user.id, apiMode);
            const combinedExistingItems = [...allExistingItems, ...existingItemsInDiretriz];
            const inspectionPromises = itemsToInspect.map(async ({ item: selectedItem, pregaoFormatado, uasg, isPriceReference }) => {
                let initialMappedItem: ItemAquisicao;
                let originalPncpItem: DetailedArpItem;
                if (isPriceReference) {
                    initialMappedItem = selectedItem as ItemAquisicao;
                    originalPncpItem = {
                        id: initialMappedItem.id,
                        numeroAta: 'REF. PREÇO',
                        codigoItem: initialMappedItem.codigo_catmat,
                        descricaoItem: initialMappedItem.descricao_item,
                        valorUnitario: initialMappedItem.valor_unitario,
                        quantidadeHomologada: 1,
                        numeroControlePncpAta: 'REF_PRECO',
                        pregaoFormatado: initialMappedItem.numero_pregao,
                        uasg: initialMappedItem.uasg,
                        omNome: 'PNCP - Preço Médio',
                        dataVigenciaInicial: new Date().toISOString().split('T')[0],
                        dataVigenciaFinal: new Date().toISOString().split('T')[0],
                    };
                } else {
                    const arpItem = selectedItem as DetailedArpItem;
                    originalPncpItem = arpItem;
                    initialMappedItem = {
                        id: arpItem.id, 
                        descricao_item: arpItem.descricaoItem || '',
                        descricao_reduzida: '', 
                        valor_unitario: arpItem.valorUnitario, 
                        numero_pregao: pregaoFormatado, 
                        uasg: uasg, 
                        codigo_catmat: arpItem.codigoItem, 
                        quantidade: 0,
                        valor_total: 0,
                        nd: '',
                        nr_subitem: '',
                        nome_subitem: '',
                    };
                }
                let status: InspectionStatus = 'pending';
                let messages: string[] = [];
                
                const catalogEntry = await fetchCatalogEntry(initialMappedItem.codigo_catmat, apiMode);
                
                let fullPncpDescription = 'Descrição completa não encontrada no PNCP.';
                let nomePdm = null;

                if (catalogEntry.isCataloged && catalogEntry.description) {
                    fullPncpDescription = catalogEntry.description;
                    if (catalogEntry.shortDescription) initialMappedItem.descricao_reduzida = catalogEntry.shortDescription;
                } else {
                    const pncpDetails = await fetchCatalogFullDescription(initialMappedItem.codigo_catmat, apiMode);
                    fullPncpDescription = pncpDetails.fullDescription || fullPncpDescription;
                    nomePdm = pncpDetails.nomePdm;
                    
                    if (catalogEntry.shortDescription) initialMappedItem.descricao_reduzida = catalogEntry.shortDescription;
                    else {
                        const itemDescription = initialMappedItem.descricao_item || fullPncpDescription || '';
                        initialMappedItem.descricao_reduzida = itemDescription.substring(0, 50) + (itemDescription.length > 50 ? '...' : '');
                    }
                }

                let duplicateResult: DuplicateCheckResult = { isDuplicate: false, matchingKeys: [] };
                for (const existingItem of combinedExistingItems) {
                    duplicateResult = isFlexibleDuplicate(initialMappedItem, existingItem);
                    if (duplicateResult.isDuplicate) break;
                }
                if (duplicateResult.isDuplicate) {
                    status = 'duplicate';
                    messages.push(`Chaves de Item idênticas: ${duplicateResult.matchingKeys.join(', ')}`);
                } else {
                    if (catalogEntry.isCataloged && catalogEntry.shortDescription) { 
                        status = 'valid';
                        messages.push('Pronto para importação.');
                    } else {
                        status = 'needs_catmat_info';
                        if (isPriceReference) messages.push('Item de referência de preço. Requer preenchimento de Pregão/UASG e descrição reduzida.');
                        else if (catalogEntry.isCataloged && !catalogEntry.shortDescription) messages.push('Item catalogado localmente, mas requer descrição reduzida.');
                        else messages.push(`Requer descrição reduzida para o catálogo ${apiMode === 'material' ? 'CATMAT' : 'CATSER'}.`);
                    }
                }
                return {
                    originalPncpItem: originalPncpItem,
                    mappedItem: initialMappedItem,
                    status: status,
                    messages: messages,
                    userShortDescription: catalogEntry.shortDescription || '', 
                    fullPncpDescription: fullPncpDescription, 
                    nomePdm: nomePdm, 
                    isCatmatCataloged: catalogEntry.isCataloged, 
                } as InspectionItem;
            });
            const results = await Promise.all(inspectionPromises);
            setInspectionList(results);
            setIsInspectionDialogOpen(true);
        } catch (error) {
            console.error("Erro durante a inspeção PNCP:", error);
            toast.error("Falha ao inspecionar itens.");
        } finally {
            setIsInspecting(false);
        }
    };
    
    const handleReviewItemCallback = (item: ItemAquisicao) => {
        setIsInspectionDialogOpen(false);
        scrollToTop();
        onReviewItem(item);
        onOpenChange(false);
    };
    
    const handleFinalImportCallback = (items: ItemAquisicao[]) => {
        if (mode === 'servico') {
            setItemsPendingUnitMeasure(items);
            setIsInspectionDialogOpen(false);
            setIsUnitMeasureDialogOpen(true);
        } else {
            onImport(items);
            setSelectedItemsState([]);
            setInspectionList([]);
            setIsInspectionDialogOpen(false);
            scrollToTop();
            onOpenChange(false);
        }
    };
    
    const handleConfirmUnitsAndImport = (itemsWithUnits: ItemAquisicao[]) => {
        onImport(itemsWithUnits);
        setSelectedItemsState([]);
        setInspectionList([]);
        setItemsPendingUnitMeasure([]);
        setIsUnitMeasureDialogOpen(false);
        scrollToTop();
        onOpenChange(false);
    };
    
    const isAnyItemSelected = isPriceFlowActive || selectedArpItems.length > 0;
    const buttonText = isPriceFlowActive ? `Inspecionar Preço Médio (${selectedPriceItems.length})` : `Inspecionar e Importar (${selectedArpItems.length})`;
        
    const getModeLabel = () => {
        if (mode === 'permanente') return 'Material Permanente';
        if (mode === 'servico') return 'Serviços de Terceiros';
        return 'Material de Consumo';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent ref={dialogContentRef} className="max-w-7xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Importação de Itens PNCP ({getModeLabel()})
                    </DialogTitle>
                    <DialogDescription>
                        Selecione o método de busca no Portal Nacional de Contratações Públicas (PNCP).
                    </DialogDescription>
                </DialogHeader>
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="arp-uasg" className="flex items-center gap-2"><FileText className="h-4 w-4" />ARP por UASG</TabsTrigger>
                        <TabsTrigger value="arp-catmat" className="flex items-center gap-2"><FileText className="h-4 w-4" />ARP por Cód. Item</TabsTrigger>
                        <TabsTrigger value="avg-price" className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Pesquisa de Preço</TabsTrigger>
                    </TabsList>
                    <TabsContent value="arp-uasg">
                        <ArpUasgSearch onItemPreSelect={handleItemPreSelect} selectedItemIds={selectedItemIds} onClearSelection={handleClearSelection} scrollContainerRef={dialogContentRef} mode={apiMode} />
                    </TabsContent>
                    <TabsContent value="arp-catmat">
                        <ArpCatmatSearch onItemPreSelect= {handleItemPreSelect} selectedItemIds={selectedItemIds} onClearSelection= {handleClearSelection} scrollContainerRef= {dialogContentRef} mode: {apiMode} />
                    </TabsContent>
                    <TabsContent value="avg-price">
                        <PriceSearchForm onPriceSelect={handlePriceSelect} isInspecting={isInspecting} onClearPriceSelection={handleClearPriceSelection} selectedItemForInspection={selectedItemForInspection} mode={apiMode} />
                    </TabsContent>
                </Tabs>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" onClick={() => handleStartInspection(isPriceFlowActive)} disabled={isInspecting || !isAnyItemSelected}>
                        {isInspecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Import className="h-4 w-4 mr-2" />}
                        {buttonText}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isInspecting}>Fechar</Button>
                </div>
            </DialogContent>
            
            {isInspectionDialogOpen && (
                <PNCPInspectionDialog 
                    open={isInspectionDialogOpen} 
                    onOpenChange={setIsInspectionDialogOpen} 
                    inspectionList={inspectionList} 
                    onFinalImport={handleFinalImportCallback} 
                    onReviewItem={handleReviewItemCallback} 
                    mode={apiMode} 
                />
            )}

            {isUnitMeasureDialogOpen && (
                <ServicoUnitMeasureDialog
                    open={isUnitMeasureDialogOpen}
                    onOpenChange={setIsUnitMeasureDialogOpen}
                    items={itemsPendingUnitMeasure}
                    onConfirm={handleConfirmUnitsAndImport}
                />
            )}
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;