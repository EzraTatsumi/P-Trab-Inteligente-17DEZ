import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, Loader2, Import } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from '@/types/pncp';
import { InspectionItem, InspectionStatus } from '@/types/pncpInspection'; // NOVO: Importar tipos de inspeção
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch'; // Importa o novo componente
import { fetchCatmatShortDescription, fetchPncpCatmatDetails } from '@/integrations/supabase/api'; // Importa as funções de busca CATMAT e detalhes PNCP
import PNCPInspectionDialog from './pncp/PNCPInspectionDialog'; // NOVO: Importar o diálogo de inspeção
import { normalizeTextForComparison } from '@/lib/formatUtils'; // <-- NOVO IMPORT
import { supabase } from '@/integrations/supabase/client'; // <-- IMPORT CORRIGIDO

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    // NOVO: Lista de itens já existentes na diretriz de destino
    existingItemsInDiretriz: ItemAquisicao[]; 
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

// Função auxiliar para gerar a chave de unicidade de um item (copiada de MaterialConsumoDiretrizFormDialog.tsx)
const generateItemKey = (item: ItemAquisicao): string => {
    const normalize = (str: string) => 
        (str || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
        
    // CRITÉRIO DE DUPLICIDADE SIMPLIFICADO: CATMAT, Pregão e UASG
    const catmat = normalize(item.codigo_catmat);
    const pregao = normalize(item.numero_pregao);
    const uasg = normalize(item.uasg);
    
    return `${catmat}|${pregao}|${uasg}`;
};


const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz, // NOVO
}) => {
    const [selectedTab, setSelectedTab] = useState("arp-uasg");
    const [selectedItemsState, setSelectedItemsState] = useState<SelectedItemState[]>([]);
    const [isInspecting, setIsInspecting] = useState(false); // Mudança de isImporting para isInspecting
    
    // NOVO ESTADO: Gerencia a lista de itens para inspeção
    const [inspectionList, setInspectionList] = useState<InspectionItem[]>([]);
    const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);

    // Limpa o estado de seleção sempre que o diálogo é aberto
    useEffect(() => {
        if (open) {
            setSelectedItemsState([]);
            setInspectionList([]);
            setIsInspectionDialogOpen(false);
        }
    }, [open]);
    
    // Função para limpar explicitamente a seleção
    const handleClearSelection = () => {
        setSelectedItemsState([]);
    };
    
    // Função para alternar a seleção de um item detalhado
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

    // NOVO: Função para iniciar a inspeção
    const handleStartInspection = async () => {
        if (selectedItemsState.length === 0) {
            toast.error("Selecione pelo menos um item detalhado para importar.");
            return;
        }
        
        setIsInspecting(true);
        toast.info("Iniciando inspeção e validação dos itens selecionados...");
        
        try {
            const inspectionPromises = selectedItemsState.map(async ({ item, pregaoFormatado, uasg }) => {
                
                // 1. Mapeamento inicial para ItemAquisicao (usando dados da ARP)
                const itemDescription = item.descricaoItem || ''; 
                const initialMappedItem: ItemAquisicao = {
                    id: item.id, 
                    descricao_item: itemDescription,
                    descricao_reduzida: '', 
                    valor_unitario: item.valorUnitario, 
                    numero_pregao: pregaoFormatado, 
                    uasg: uasg, 
                    codigo_catmat: item.codigoItem, 
                };
                
                let status: InspectionStatus = 'pending';
                let messages: string[] = [];
                
                // 2. Verificação de Duplicidade Local (Critério: CATMAT, Pregão, UASG)
                const itemKey = generateItemKey(initialMappedItem);
                const isDuplicate = existingItemsInDiretriz.some(existingItem => generateItemKey(existingItem) === itemKey);
                
                if (isDuplicate) {
                    // HIPÓTESE 3: DUPLICADO
                    status = 'duplicate';
                    messages.push('Item duplicado na diretriz de destino.');
                    
                    return {
                        originalPncpItem: item,
                        mappedItem: initialMappedItem,
                        status: status,
                        messages: messages,
                        userShortDescription: '',
                        officialPncpDescription: null,
                        pdmSuggestion: null,
                        descriptionMismatch: false,
                    } as InspectionItem;
                }
                
                // 3. Busca da Descrição Reduzida e Completa no Catálogo Local
                const catmatCodePadded = item.codigoItem.replace(/\D/g, '').padStart(9, '0');
                
                const { data: catmatData, error: catmatError } = await supabase
                    .from('catalogo_catmat')
                    .select('description, short_description')
                    .eq('code', catmatCodePadded) // Busca com padding
                    .maybeSingle();
                
                // 4. Busca de Detalhes do Catálogo de Material do PNCP (para descrição oficial e PDM)
                const catmatDetails = await fetchPncpCatmatDetails(item.codigoItem);
                const officialDescription = catmatDetails.descricaoItem;
                const pdmSuggestion = catmatDetails.nomePdm;
                
                // 5. Comparação de Descrição (ARP vs Catálogo Oficial)
                const normalizedOfficial = normalizeTextForComparison(officialDescription);
                const normalizedArp = normalizeTextForComparison(itemDescription);
                
                const descriptionMismatch = officialDescription && 
                                            officialDescription !== "Falha ao carregar descrição oficial." && 
                                            normalizedOfficial !== normalizedArp;
                
                // --- LÓGICA CORRIGIDA PARA A HIPÓTESE 1 ---
                if (catmatData) {
                    // HIPÓTESE 1: CATMAT EXISTE NO CATÁLOGO LOCAL (PRONTO PARA IMPORTAR)
                    status = 'valid';
                    messages.push('Pronto para importação.');
                    
                    // Mapeia o item para usar os dados padronizados do catálogo local
                    // Usa a descrição padronizada do BD se existir, senão usa a descrição da ARP
                    initialMappedItem.descricao_reduzida = catmatData.short_description || '';
                    initialMappedItem.descricao_item = catmatData.description || itemDescription; 
                    
                    if (descriptionMismatch) {
                        messages.push('Divergência: Descrição da ARP difere da descrição oficial do PNCP.');
                    }
                    
                    return {
                        originalPncpItem: item,
                        mappedItem: initialMappedItem,
                        status: status,
                        messages: messages,
                        // userShortDescription é o valor inicial para o caso de o usuário querer revisar
                        userShortDescription: catmatData.short_description || '', 
                        officialPncpDescription: officialDescription,
                        pdmSuggestion: pdmSuggestion,
                        descriptionMismatch: descriptionMismatch,
                    } as InspectionItem;
                    
                } else {
                    // HIPÓTESE 2: CATMAT AUSENTE (REQUER REVISÃO)
                    status = 'needs_catmat_info';
                    messages.push('Requer descrição reduzida para o catálogo CATMAT.');
                    
                    // Valor inicial para Descrição Reduzida: Sugestão PDM (bruta) ou Descrição da ARP (truncada)
                    const initialShortDesc = pdmSuggestion || itemDescription.substring(0, 50) + (itemDescription.length > 50 ? '...' : '');
                    
                    return {
                        originalPncpItem: item,
                        mappedItem: initialMappedItem, // Mantém a descrição da ARP como descrição completa inicial
                        status: status,
                        messages: messages,
                        userShortDescription: initialShortDesc,
                        officialPncpDescription: officialDescription,
                        pdmSuggestion: pdmSuggestion,
                        descriptionMismatch: descriptionMismatch,
                    } as InspectionItem;
                }
            });
            
            const results = await Promise.all(inspectionPromises);
            setInspectionList(results);
            
            // 6. Abrir o diálogo de inspeção
            setIsInspectionDialogOpen(true);
            
        } catch (error) {
            console.error("Erro durante a inspeção PNCP:", error);
            toast.error("Falha ao inspecionar itens. Tente novamente.");
        } finally {
            setIsInspecting(false);
        }
    };
    
    // Função chamada pelo PNCPInspectionDialog após a validação/resolução
    const handleFinalImport = (items: ItemAquisicao[]) => {
        onImport(items);
        // Fechar o diálogo principal
        onOpenChange(false);
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
                            onClearSelection={handleClearSelection} 
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
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                        type="button" 
                        onClick={handleStartInspection}
                        disabled={selectedItemsState.length === 0 || isInspecting}
                    >
                        {isInspecting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Import className="h-4 w-4 mr-2" />
                        )}
                        Inspecionar e Importar ({selectedItemsState.length})
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isInspecting}>
                        Fechar
                    </Button>
                </div>
            </DialogContent>
            
            {/* Diálogo de Inspeção */}
            {isInspectionDialogOpen && (
                <PNCPInspectionDialog
                    open={isInspectionDialogOpen}
                    onOpenChange={setIsInspectionDialogOpen}
                    inspectionList={inspectionList}
                    onFinalImport={handleFinalImport}
                />
            )}
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;