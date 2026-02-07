import React, { useState, useMemo, useCallback } from 'react';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { formatCodug, formatCurrency, formatDate, formatPregao, capitalizeFirstLetter } from '@/lib/formatUtils';
import { Card, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Import, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fetchDetailedArpItems } from '@/integrations/supabase/api'; // Importa a nova função

// Tipo para o grupo de ARPs (agrupado por Pregão)
interface ArpGroup {
    pregao: string;
    uasg: string;
    omNome: string;
    itens: ArpItemResult[];
    objetoRepresentativo: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

interface ArpSearchResultsListProps {
    results: ArpItemResult[];
    // MUDANÇA: onSelect agora é onItemPreSelect, que lida com DetailedArpItem
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedUasg: string;
    searchedOmName: string;
    selectedItemIds: string[]; // IDs dos itens detalhados selecionados
}

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ 
    results, 
    onItemPreSelect, 
    searchedUasg, 
    searchedOmName,
    selectedItemIds,
}) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    // NOVO ESTADO: Armazena os itens detalhados carregados por idCompra
    const [detailedItemsCache, setDetailedItemsCache] = useState<Record<string, DetailedArpItem[]>>({});
    const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

    // 1. Lógica de Agrupamento
    const groupedArps = useMemo(() => {
        const groupsMap = new Map<string, ArpGroup>();

        results.forEach(arp => {
            const pregaoKey = arp.pregaoFormatado;
            
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, {
                    pregao: pregaoKey,
                    uasg: arp.uasg,
                    omNome: arp.omNome,
                    itens: [],
                    objetoRepresentativo: arp.objeto || 'Objeto não especificado',
                    dataVigenciaInicial: arp.dataVigenciaInicial || '',
                    dataVigenciaFinal: arp.dataVigenciaFinal || '',
                });
            }

            const group = groupsMap.get(pregaoKey)!;
            group.itens.push(arp);
        });

        return Array.from(groupsMap.values()).sort((a, b) => a.pregao.localeCompare(b.pregao));
    }, [results]);
    
    // 2. Função para buscar detalhes da ARP
    const loadArpDetails = useCallback(async (arp: ArpItemResult) => {
        const idCompra = arp.id;
        
        if (detailedItemsCache[idCompra]) return; // Já carregado
        if (loadingDetails[idCompra]) return; // Já está carregando

        setLoadingDetails(prev => ({ ...prev, [idCompra]: true }));
        
        try {
            const items = await fetchDetailedArpItems(idCompra);
            
            if (items.length === 0) {
                toast.warning(`Nenhum item detalhado encontrado para a ARP ${arp.numeroAta}.`);
            }
            
            setDetailedItemsCache(prev => ({ ...prev, [idCompra]: items }));
            
        } catch (error: any) {
            console.error(`Erro ao carregar detalhes da ARP ${arp.numeroAta}:`, error);
            toast.error(error.message || "Falha ao carregar detalhes da ARP.");
        } finally {
            setLoadingDetails(prev => ({ ...prev, [idCompra]: false }));
        }
    }, [detailedItemsCache, loadingDetails]);
    
    // 3. Função para alternar a expansão e carregar detalhes
    const handleToggleGroup = (pregaoKey: string) => {
        setOpenGroups(prev => ({
            ...prev,
            [pregaoKey]: !prev[pregaoKey],
        }));
    };
    
    // 4. Função para alternar a expansão da ARP individual e carregar detalhes
    const handleToggleArp = (arp: ArpItemResult) => {
        const idCompra = arp.id;
        
        // 1. Alterna o estado de expansão
        setOpenGroups(prev => ({
            ...prev,
            [idCompra]: !prev[idCompra],
        }));
        
        // 2. Se estiver abrindo, carrega os detalhes
        if (!openGroups[idCompra]) {
            loadArpDetails(arp);
        }
    };
    
    // 5. Função para pré-selecionar um item detalhado
    const handlePreSelectDetailedItem = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        onItemPreSelect(item, pregaoFormatado, uasg);
    };
    
    // A função de importação foi movida para o ItemAquisicaoPNCPDialog, 
    // pois ele gerencia o estado de seleção de múltiplos itens.
    // Aqui, apenas chamamos a função de pré-seleção.

    if (results.length === 0) {
        return (
            <Card className="p-4 text-center text-muted-foreground">
                Nenhuma Ata de Registro de Preços encontrada para os critérios informados.
            </Card>
        );
    }
    
    const omNameFromApi = groupedArps.length > 0 ? groupedArps[0].omNome : '';
    const omNameDisplay = (omNameFromApi && !omNameFromApi.startsWith('UASG ')) 
        ? omNameFromApi 
        : searchedOmName;
    
    const omUasg = searchedUasg;
    const totalArpItems = results.length;

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold flex flex-col">
                <span>
                    Resultado para {omNameDisplay} ({formatCodug(omUasg)})
                </span>
                <span className="text-sm font-normal text-muted-foreground mt-1">
                    {groupedArps.length} Pregões encontrados ({totalArpItems} ARPs)
                </span>
            </h3>
            
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[150px]">Pregão</TableHead>
                            <TableHead>Objeto</TableHead>
                            <TableHead className="w-[250px] text-center">Vigência</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedArps.map(group => {
                            const isGroupOpen = openGroups[group.pregao];
                            
                            const displayPregao = group.pregao === 'DADOS_INCOMPLETOS' 
                                ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                : formatPregao(group.pregao);
                                
                            return (
                                <React.Fragment key={group.pregao}>
                                    <TableRow 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleToggleGroup(group.pregao)}
                                    >
                                        {/* Célula do Pregão (Nível 1) */}
                                        <TableCell className="font-semibold flex justify-between items-center">
                                            {displayPregao}
                                            {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-2" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-2" />}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs whitespace-normal">
                                            {capitalizeFirstLetter(group.objetoRepresentativo)}
                                        </TableCell>
                                        <TableCell className="text-center text-sm whitespace-nowrap">
                                            {formatDate(group.dataVigenciaInicial)} - {formatDate(group.dataVigenciaFinal)}
                                        </TableCell>
                                    </TableRow>
                                    
                                    {/* Conteúdo Colapsável com a lista de ARPs individuais (Nível 2) */}
                                    <TableRow className="p-0">
                                        <TableCell colSpan={3} className="p-0">
                                            <Collapsible open={isGroupOpen}>
                                                <CollapsibleContent>
                                                    <div className="p-4 bg-muted/50 border-t border-border">
                                                        {/* Tabela de ARPs Individuais dentro do Pregão */}
                                                        <Table className="bg-background border rounded-md">
                                                            <thead>
                                                                <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                                    <th className="px-4 py-2 text-left font-normal w-[30%]">Número da ARP</th>
                                                                    <th className="px-4 py-2 text-left font-normal w-[50%]">Objeto</th>
                                                                    <th className="px-4 py-2 text-center font-normal w-[20%]">Qtd. Itens</th>
                                                                </TableRow>
                                                            </thead>
                                                            <TableBody>
                                                                {group.itens.map(arp => {
                                                                    const isArpOpen = openGroups[arp.id];
                                                                    const isLoading = loadingDetails[arp.id];
                                                                    const detailedItems = detailedItemsCache[arp.id] || [];
                                                                    
                                                                    return (
                                                                        <React.Fragment key={arp.id}>
                                                                            <TableRow 
                                                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                                                onClick={() => handleToggleArp(arp)}
                                                                            >
                                                                                <TableCell className="text-sm font-medium flex justify-between items-center">
                                                                                    {arp.numeroAta || 'N/A'}
                                                                                    {isArpOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-2" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-2" />}
                                                                                </TableCell>
                                                                                <TableCell className="text-sm max-w-xs whitespace-normal">
                                                                                    {capitalizeFirstLetter(arp.objeto)}
                                                                                </TableCell>
                                                                                <TableCell className="text-center text-sm">
                                                                                    {arp.quantidadeItens || 0}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                            
                                                                            {/* Conteúdo Colapsável com os Itens Detalhados (Nível 3) */}
                                                                            <TableRow className="p-0">
                                                                                <TableCell colSpan={3} className="p-0">
                                                                                    <Collapsible open={isArpOpen}>
                                                                                        <CollapsibleContent>
                                                                                            <div className="p-4 bg-background border-t border-border">
                                                                                                {isLoading ? (
                                                                                                    <div className="text-center py-4">
                                                                                                        <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                                                                                                        <p className="text-xs text-muted-foreground mt-1">Carregando itens detalhados...</p>
                                                                                                    </div>
                                                                                                ) : detailedItems.length > 0 ? (
                                                                                                    <Table className="border">
                                                                                                        <thead>
                                                                                                            <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                                                                                <th className="px-4 py-2 text-left font-normal w-[15%]">Cód. Item</th>
                                                                                                                <th className="px-4 py-2 text-left font-normal w-[45%]">Descrição</th>
                                                                                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Unid.</th>
                                                                                                                <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Unitário</th>
                                                                                                                <th className="px-4 py-2 text-center font-normal w-[15%]">Ação</th>
                                                                                                            </TableRow>
                                                                                                        </thead>
                                                                                                        <TableBody>
                                                                                                            {detailedItems.map(item => {
                                                                                                                const isSelected = selectedItemIds.includes(item.id);
                                                                                                                return (
                                                                                                                    <TableRow 
                                                                                                                        key={item.id}
                                                                                                                        className={`transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                                                                                                    >
                                                                                                                        <TableCell className="text-xs font-medium">{item.codigoItem}</TableCell>
                                                                                                                        <TableCell className="text-xs max-w-xs whitespace-normal">{item.descricaoItem}</TableCell>
                                                                                                                        <TableCell className="text-center text-xs">{item.unidadeMedida}</TableCell>
                                                                                                                        <TableCell className="text-right text-xs font-bold text-primary">
                                                                                                                            {formatCurrency(item.valorUnitario)}
                                                                                                                        </TableCell>
                                                                                                                        <TableCell className="text-center">
                                                                                                                            <Button
                                                                                                                                variant={isSelected ? "default" : "outline"}
                                                                                                                                size="sm"
                                                                                                                                onClick={() => handlePreSelectDetailedItem(item, group.pregao, group.uasg)}
                                                                                                                            >
                                                                                                                                {isSelected ? <Check className="h-4 w-4" /> : <Import className="h-4 w-4" />}
                                                                                                                            </Button>
                                                                                                                        </TableCell>
                                                                                                                    </TableRow>
                                                                                                                );
                                                                                                            })}
                                                                                                        </TableBody>
                                                                                                    </Table>
                                                                                                ) : (
                                                                                                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item detalhado encontrado para esta ARP.</p>
                                                                                                )}
                                                                                            </div>
                                                                                        </CollapsibleContent>
                                                                                    </Collapsible>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        </React.Fragment>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            
            {/* O botão de importação foi movido para o ItemAquisicaoPNCPDialog */}
            <div className="hidden">
                {/* Este div é mantido para evitar que o rodapé do diálogo PNCP fique vazio, mas o botão principal está no pai */}
            </div>
        </div>
    );
};

export default ArpSearchResultsList;