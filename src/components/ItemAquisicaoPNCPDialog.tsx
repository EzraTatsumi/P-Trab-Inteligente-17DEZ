import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, DollarSign, Loader2, Import } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { DetailedArpItem } from '@/types/pncp';
import { InspectionItem, InspectionStatus } from '@/types/pncpInspection'; // NOVO: Importar tipos de inspeção
import { toast } from "sonner";
import ArpUasgSearch from './pncp/ArpUasgSearch'; // Importa o novo componente
import { fetchCatmatShortDescription, fetchCatmatFullDescription, fetchAllExistingAcquisitionItems } from '@/integrations/supabase/api'; // Importa as funções de busca CATMAT e a nova função de busca de itens
import PNCPInspectionDialog from './pncp/PNCPInspectionDialog'; // NOVO: Importar o diálogo de inspeção
import { supabase } from '@/integrations/supabase/client'; // Importar o cliente Supabase para obter o user ID

interface ItemAquisicaoPNCPDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
    // NOVO: Lista de itens já existentes na diretriz de destino
    existingItemsInDiretriz: ItemAquisicao[]; 
    // NOVO: Função para iniciar a edição de um item no formulário principal
    onReviewItem: (item: ItemAquisicao) => void;
    // NOVO: Ano de referência para a busca de duplicidade global
    selectedYear: number; 
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

// Função auxiliar para normalizar strings para comparação
const normalizeString = (str: string | number | null | undefined): string =>
    (String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9]/g, '')); // Remove caracteres especiais para comparação mais robusta

/**
 * Implementa a nova lógica de verificação de duplicidade flexível (4 de 6).
 * 
 * Um item é considerado duplicado se:
 * 1. Chave de Contrato (Obrigatória): numero_pregao, uasg, valor_unitario são idênticos.
 * 2. Chave de Item (Pelo menos uma): codigo_catmat OU descricao_item OU descricao_reduzida é idêntica.
 * 
 * @param newItem O item que está sendo importado (PNCP).
 * @param existingItem O item já existente no banco de dados.
 * @returns true se for considerado duplicado.
 */
const isFlexibleDuplicate = (newItem: ItemAquisicao, existingItem: ItemAquisicao): boolean => {
    // 1. Critérios Obrigatórios (Chave de Contrato)
    const pregaoMatch = normalizeString(newItem.numero_pregao) === normalizeString(existingItem.numero_pregao);
    const uasgMatch = normalizeString(newItem.uasg) === normalizeString(existingItem.uasg);
    // Comparação numérica exata para valor unitário
    const valorMatch = newItem.valor_unitario === existingItem.valor_unitario; 

    if (!pregaoMatch || !uasgMatch || !valorMatch) {
        return false; // Falha na Chave de Contrato
    }

    // 2. Critérios Opcionais (Pelo menos um deve ser igual)
    const catmatMatch = normalizeString(newItem.codigo_catmat) === normalizeString(existingItem.codigo_catmat);
    const descCompletaMatch = normalizeString(newItem.descricao_item) === normalizeString(existingItem.descricao_item);
    const descReduzidaMatch = normalizeString(newItem.descricao_reduzida) === normalizeString(existingItem.descricao_reduzida);

    // Se a Chave de Contrato for idêntica, verifica se pelo menos uma Chave de Item é idêntica.
    const optionalMatch = catmatMatch || descCompletaMatch || descReduzidaMatch;

    return optionalMatch;
};


const ItemAquisicaoPNCPDialog: React.FC<ItemAquisicaoPNCPDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    onReviewItem, // NOVO
    selectedYear, // NOVO
}) => {
    const [selectedTab, setSelectedTab] = useState("arp-uasg");
    const [selectedItemsState, setSelectedItemsState] = useState<SelectedItemState[]>([]);
    const [isInspecting, setIsInspecting] = useState(false);
    
    // NOVO ESTADO: Gerencia a lista de itens para inspeção
    const [inspectionList, setInspectionList] = useState<InspectionItem[]>([]);
    const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);
    
    // NOVO: Ref para o DialogContent (o container de rolagem)
    const dialogContentRef = useRef<HTMLDivElement>(null);

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
            // 1. Obter o ID do usuário
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Sessão expirada. Por favor, faça login novamente.");
                setIsInspecting(false);
                return;
            }
            const userId = user.id;

            // 2. Buscar todos os itens existentes do usuário para o ano selecionado
            // Esta lista inclui itens de TODAS as diretrizes do usuário para o ano.
            const allExistingItems = await fetchAllExistingAcquisitionItems(selectedYear, userId);
            
            const inspectionPromises = selectedItemsState.map(async ({ item, pregaoFormatado, uasg }) => {
                
                // 3. Mapeamento inicial para ItemAquisicao
                const itemDescription = item.descricaoItem || ''; 
                const initialMappedItem: ItemAquisicao = {
                    id: item.id, 
                    descricao_item: itemDescription,
                    descricao_reduzida: '', // Será preenchido na inspeção ou busca CATMAT
                    valor_unitario: item.valorUnitario, 
                    numero_pregao: pregaoFormatado, 
                    uasg: uasg, 
                    codigo_catmat: item.codigoItem, 
                };
                
                let status: InspectionStatus = 'pending';
                let messages: string[] = [];
                let shortDescription: string | null = null;
                
                let fullPncpDescription: string | null = null; 
                let nomePdm: string | null = null; 
                
                // 4. Verificação de Duplicidade Global (Nova Lógica)
                // Verifica se o item PNCP é duplicado em relação a QUALQUER item existente no DB do usuário para o ano.
                const isDuplicate = allExistingItems.some(existingItem => isFlexibleDuplicate(initialMappedItem, existingItem));
                
                if (isDuplicate) {
                    status = 'duplicate';
                    messages.push('Item duplicado em uma diretriz existente para o ano selecionado.');
                } else {
                    // 5. Busca da Descrição Reduzida no Catálogo CATMAT (DB local)
                    shortDescription = await fetchCatmatShortDescription(item.codigoItem);
                    
                    // 6. Busca da Descrição Completa e PDM no PNCP (API externa)
                    const pncpDetails = await fetchCatmatFullDescription(item.codigoItem);
                    fullPncpDescription = pncpDetails.fullDescription;
                    nomePdm = pncpDetails.nomePdm; 
                    
                    if (shortDescription) {
                        // CATMAT encontrado e tem descrição reduzida
                        status = 'valid';
                        messages.push('Pronto para importação.');
                        initialMappedItem.descricao_reduzida = shortDescription;
                    } else {
                        // CATMAT não encontrado ou não tem descrição reduzida
                        status = 'needs_catmat_info';
                        messages.push('Requer descrição reduzida para o catálogo CATMAT.');
                        // Fallback seguro para descrição reduzida (primeiras 50 letras da descrição completa)
                        initialMappedItem.descricao_reduzida = itemDescription.substring(0, 50) + (itemDescription.length > 50 ? '...' : '');
                    }
                }
                
                return {
                    originalPncpItem: item,
                    mappedItem: initialMappedItem,
                    status: status,
                    messages: messages,
                    userShortDescription: shortDescription || '', // Campo para preenchimento do usuário
                    fullPncpDescription: fullPncpDescription || 'Descrição completa não encontrada no PNCP.', 
                    nomePdm: nomePdm, // NOVO: Adiciona nomePdm ao objeto de inspeção
                } as InspectionItem;
            });
            
            const results = await Promise.all(inspectionPromises);
            setInspectionList(results);
            
            // 7. Abrir o diálogo de inspeção
            setIsInspectionDialogOpen(true);
            
        } catch (error) {
            console.error("Erro durante a inspeção PNCP:", error);
            toast.error("Falha ao inspecionar itens. Tente novamente.");
        } finally {
            setIsInspecting(false);
        }
    };
    
    // Função chamada pelo PNCPInspectionDialog para iniciar a edição no formulário principal
    const handleReviewItem = (item: ItemAquisicao) => {
        // 1. Fecha o diálogo de inspeção
        setIsInspectionDialogOpen(false);
        // 2. Fecha o diálogo principal de PNCP
        onOpenChange(false);
        // 3. Chama a função de revisão do componente pai (MaterialConsumoDiretrizFormDialog)
        onReviewItem(item);
    };
    
    // Função chamada pelo PNCPInspectionDialog após a validação/resolução
    const handleFinalImport = (items: ItemAquisicao[]) => {
        onImport(items);
        // Fecha o diálogo principal após a importação
        onOpenChange(false); 
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Adiciona a ref ao DialogContent */}
            <DialogContent ref={dialogContentRef} className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                            // NOVO: Passa a ref do container de rolagem
                            scrollContainerRef={dialogContentRef}
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
                    onReviewItem={handleReviewItem} // NOVO: Passando a função de revisão
                />
            )}
        </Dialog>
    );
};

export default ItemAquisicaoPNCPDialog;