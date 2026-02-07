import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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

// Função auxiliar para normalizar strings para comparação (Incluindo normalização Unicode)
const normalizeString = (str: string | number | null | undefined): string => {
    // 1. Converte para string, trata null/undefined como string vazia
    const s = String(str || '').trim();
    
    // 2. Normaliza caracteres Unicode (NFD) e remove diacríticos (acentos)
    const normalized = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // 3. Converte para maiúsculas e colapsa múltiplos espaços internos em um único espaço
    return normalized.toUpperCase().replace(/\s+/g, ' ');
};

// Função para normalizar strings removendo todos os caracteres não-dígitos (para CATMAT e UASG)
const normalizeDigits = (value: string | number | null | undefined) =>
    normalizeString(value).replace(/[^\d]/g, "");

// Função para normalizar o Pregão, padronizando o ano para 2 dígitos
const normalizePregao = (value: string | number | null | undefined): string => {
    const s = normalizeString(value); 
    
    // Remove todos os caracteres não-dígitos
    let digits = s.replace(/[^\d]/g, ''); 
    
    if (digits.length < 3) return digits; 

    // Heurística para separar o ano (assume que os últimos 2 ou 4 dígitos são o ano)
    let yearPart = '';
    let numberPart = digits;

    // Tenta extrair 4 dígitos de ano (Ex: 2025)
    if (digits.length >= 4 && digits.slice(-4).startsWith('20')) {
        yearPart = digits.slice(-4).slice(-2); // "25"
        numberPart = digits.slice(0, -4); // "90001"
    } 
    // Tenta extrai 2 dígitos de ano (Ex: 25)
    else if (digits.length >= 2) {
        yearPart = digits.slice(-2); // "25"
        numberPart = digits.slice(0, -2); // "90001"
    }
    
    // Retorna o número sem zeros à esquerda + ano de 2 dígitos
    return `${numberPart.replace(/^0+/, '')}${yearPart}`; // Ex: "9000125"
};

// Função para parsear valores monetários de forma robusta
const parseMoney = (value: any): number => {
    if (typeof value === "number") return value;

    if (typeof value === "string") {
        // Remove separador de milhar (ponto) e converte vírgula decimal para ponto
        const cleaned = value.replace(/\./g, "").replace(",", ".");
        const parsed = Number(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
};

interface DuplicateCheckResult {
    isDuplicate: boolean;
    matchingKeys: string[];
}

/**
 * Implementa a lógica de verificação de duplicidade flexível (4 de 6).
 * 
 * @param newItem O item que está sendo importado (PNCP).
 * @param existingItem O item já existente no banco de dados.
 * @returns Objeto com status de duplicidade e chaves correspondentes.
 */
const isFlexibleDuplicate = (newItem: ItemAquisicao, existingItem: ItemAquisicao): DuplicateCheckResult => {
    const result: DuplicateCheckResult = {
        isDuplicate: false,
        matchingKeys: [],
    };
    
    // --- 1. Critérios Obrigatórios (Chave de Contrato) ---
    
    // Comparação de Pregão (Normalizada para dígitos e ano de 2 dígitos)
    const pregaoMatch =
        normalizePregao(newItem.numero_pregao) ===
        normalizePregao(existingItem.numero_pregao);
    
    // Comparação de UASG (Normalizada para 6 dígitos brutos)
    const uasgMatch =
        normalizeDigits(newItem.uasg).slice(0, 6) ===
        normalizeDigits(existingItem.uasg).slice(0, 6);
    
    // Comparação numérica exata para valor unitário (após parse e arredondamento)
    const newValue = parseMoney(newItem.valor_unitario);
    const existingValue = parseMoney(existingItem.valor_unitario);

    // Arredondar para 2 casas decimais antes de comparar para evitar erros de ponto flutuante.
    const valorMatch =
        Math.round(newValue * 100) === Math.round(existingValue * 100);

    if (!pregaoMatch || !uasgMatch || !valorMatch) {
        return result; // Falha na Chave de Contrato
    }

    // --- 2. Critérios Opcionais (Pelo menos um deve ser igual) ---
    
    // Comparação de CATMAT (Normalizada para dígitos)
    const catmatMatch =
        normalizeDigits(newItem.codigo_catmat) ===
        normalizeDigits(existingItem.codigo_catmat);
    
    // Comparação de Descrição Completa (Normalizada)
    const descCompletaMatch =
        normalizeString(newItem.descricao_item) ===
        normalizeString(existingItem.descricao_item);
    
    // Comparação de Descrição Reduzida (Normalizada)
    const descReduzidaMatch =
        normalizeString(newItem.descricao_reduzida) ===
        normalizeString(existingItem.descricao_reduzida);

    if (catmatMatch) result.matchingKeys.push('CATMAT');
    if (descCompletaMatch) result.matchingKeys.push('Descrição Completa');
    if (descReduzidaMatch && normalizeString(newItem.descricao_reduzida).length > 0) {
        // Só considera a descrição reduzida se ela não for vazia (ou seja, se foi preenchida/encontrada)
        result.matchingKeys.push('Nome Reduzido');
    }

    // Se a Chave de Contrato for idêntica, verifica se pelo menos uma Chave de Item é idêntica.
    const optionalMatch = result.matchingKeys.length > 0;

    if (optionalMatch) {
        result.isDuplicate = true;
    }

    return result;
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

            // 2. Buscar todos os itens existentes do usuário para o ano selecionado (outras diretrizes)
            const allExistingItems = await fetchAllExistingAcquisitionItems(selectedYear, userId);
            
            // LOG DE DEBUG: Verificar itens existentes no banco
            console.log("--- INÍCIO DA INSPEÇÃO PNCP ---");
            console.log("ANO SELECIONADO:", selectedYear);
            console.log("USER ID:", userId);
            console.log("ITENS EXISTENTES NO BANCO (OUTRAS DIRETRIZES):", allExistingItems.length);
            
            // 3. COMBINAR ITENS: Itens do banco + Itens da diretriz atual (estado local)
            const combinedExistingItems = [
                ...allExistingItems,
                ...existingItemsInDiretriz
            ];
            
            console.log("ITENS EXISTENTES COMBINADOS (DB + LOCAL):", combinedExistingItems.length);
            
            const inspectionPromises = selectedItemsState.map(async ({ item, pregaoFormatado, uasg }) => {
                
                // 4. Mapeamento inicial para ItemAquisicao
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
                
                // --- BUSCAS DE DADOS INDEPENDENTES DO STATUS ---
                
                // 5. Busca da Descrição Completa e PDM no PNCP (API externa)
                const pncpDetails = await fetchCatmatFullDescription(item.codigoItem);
                fullPncpDescription = pncpDetails.fullDescription;
                nomePdm = pncpDetails.nomePdm; 
                
                // 6. Busca da Descrição Reduzida no Catálogo CATMAT (DB local)
                shortDescription = await fetchCatmatShortDescription(item.codigoItem);
                
                // Se encontrado no catálogo local, preenche a descrição reduzida no item mapeado
                if (shortDescription) {
                    initialMappedItem.descricao_reduzida = shortDescription;
                } else {
                    // Fallback seguro para descrição reduzida (primeiras 50 letras da descrição completa)
                    initialMappedItem.descricao_reduzida = itemDescription.substring(0, 50) + (itemDescription.length > 50 ? '...' : '');
                }
                
                // --- VERIFICAÇÃO DE DUPLICIDADE E STATUS FINAL ---
                
                // 7. Verificação de Duplicidade Global (Nova Lógica)
                let duplicateResult: DuplicateCheckResult = { isDuplicate: false, matchingKeys: [] };
                
                // Itera sobre todos os itens existentes para encontrar a primeira duplicidade
                for (const existingItem of combinedExistingItems) {
                    duplicateResult = isFlexibleDuplicate(initialMappedItem, existingItem);
                    if (duplicateResult.isDuplicate) {
                        break; // Encontrou duplicidade, pode parar
                    }
                }
                
                if (duplicateResult.isDuplicate) {
                    status = 'duplicate';
                    // Formata a mensagem com as chaves correspondentes
                    const keys = duplicateResult.matchingKeys.join(', ');
                    messages.push(`Chaves de Item idênticas: ${keys}`);
                } else {
                    // 8. Determinação do Status para itens NÃO duplicados
                    if (shortDescription) {
                        // CATMAT encontrado e tem descrição reduzida
                        status = 'valid';
                        messages.push('Pronto para importação.');
                    } else {
                        // CATMAT não encontrado ou não tem descrição reduzida
                        status = 'needs_catmat_info';
                        messages.push('Requer descrição reduzida para o catálogo CATMAT.');
                    }
                }
                
                return {
                    originalPncpItem: item,
                    mappedItem: initialMappedItem,
                    status: status,
                    messages: messages,
                    userShortDescription: shortDescription || '', // Campo para preenchimento do usuário
                    fullPncpDescription: fullPncpDescription || 'Descrição completa não encontrada no PNCP.', 
                    nomePdm: nomePdm, 
                } as InspectionItem;
            });
            
            const results = await Promise.all(inspectionPromises);
            setInspectionList(results);
            
            // 9. Abrir o diálogo de inspeção
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
        // 2. NÃO FECHA o diálogo principal de PNCP, permitindo que o usuário volte para a busca
        // onOpenChange(false); // <-- REMOVIDO
        // 3. Chama a função de revisão do componente pai (MaterialConsumoDiretrizFormDialog)
        onReviewItem(item);
    };
    
    // Função chamada pelo PNCPInspectionDialog após a validação/resolução
    const handleFinalImport = (items: ItemAquisicao[]) => {
        // 1. Chama a importação no componente pai (MaterialConsumoDiretrizFormDialog)
        onImport(items);
        
        // 2. Reseta o estado interno para a tela de busca
        setSelectedItemsState([]);
        setInspectionList([]);
        setIsInspectionDialogOpen(false);
        // Não fecha o diálogo principal, apenas reseta a visualização
        
        toast.success(`Importação de ${items.length} itens concluída. Pronto para nova busca.`);
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