import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { formatCodug, formatCurrency, formatDate, formatPregao, capitalizeFirstLetter } from '@/lib/formatUtils';
import { Card, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Import, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchArpItemsById } from '@/integrations/supabase/api';

// NOVO TIPO: Referência de uma ARP dentro de um Pregão
interface ArpReference {
    numeroControlePncpAta: string;
    numeroAta: string;
}

// Tipo para o grupo de ARPs (agrupado por Pregão)
interface ArpGroup {
    pregao: string;
    uasg: string;
    omNome: string;
    // Lista de referências de ARP que compõem este Pregão
    arpReferences: ArpReference[]; 
    objetoRepresentativo: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

interface ArpSearchResultsListProps {
    results: ArpItemResult[]; 
    // MUDANÇA: Função para alternar a seleção de um item detalhado
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedUasg: string;
    searchedOmName: string;
    // MUDANÇA: Array de IDs selecionados globalmente
    selectedItemIds: string[];
}

// Componente para buscar e exibir os itens detalhados de uma ARP
const DetailedArpItems = ({ arpReferences, pregaoFormatado, uasg, onItemPreSelect, isGroupOpen, selectedItemIds }: { 
    arpReferences: ArpReference[]; 
    pregaoFormatado: string; 
    uasg: string; 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    isGroupOpen: boolean;
    selectedItemIds: string[];
}) => {
    // Usa useQueries para disparar buscas paralelas para cada ARP
    const arpQueries = useQueries({
        queries: arpReferences.map(ref => ({
            queryKey: ['arpDetailedItems', ref.numeroControlePncpAta],
            queryFn: () => fetchArpItemsById(ref.numeroControlePncpAta),
            enabled: isGroupOpen && !!ref.numeroControlePncpAta,
            staleTime: 1000 * 60 * 5, // 5 minutos de cache
        })),
    });
    
    // Consolidação dos resultados
    const isLoading = arpQueries.some(query => query.isLoading);
    const isError = arpQueries.some(query => query.isError);
    
    const detailedItems: DetailedArpItem[] = useMemo(() => {
        if (isLoading || isError) return [];
        
        // Mapeia e achata os resultados de todas as queries
        return arpQueries.flatMap(query => query.data || []);
    }, [arpQueries, isLoading, isError]);
    
    const handlePreSelectDetailedItem = (item: DetailedArpItem) => {
        // Chama a função de alternância no componente pai
        onItemPreSelect(item, pregaoFormatado, uasg);
    };
    
    if (isLoading) {
        return (
            <div className="text-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-1">Carregando itens detalhados de {arpReferences.length} ARPs...</p>
            </div>
        );
    }
    
    if (isError) {
        // Podemos tentar extrair a mensagem de erro da primeira query que falhou
        const firstError = arpQueries.find(query => query.isError)?.error;
        const errorMessage = firstError?.message || "Erro desconhecido.";

        return (
            <div className="text-center py-4 text-red-500 text-sm">
                Erro ao carregar itens detalhados de uma ou mais ARPs: {errorMessage}
            </div>
        );
    }

    if (!detailedItems || detailedItems.length === 0) {
        return (
            <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhum item detalhado encontrado nas ARPs deste Pregão.
            </div>
        );
    }

    return (
        <div className="p-4 bg-muted/50 border-t border-border space-y-3">
            <Table className="bg-background border rounded-md overflow-hidden">
                <thead>
                    <TableRow className="text-xs text-muted-foreground hover:bg-background">
                        <th className="px-4 py-2 text-left font-normal w-[10%]">ARP</th> {/* NOVO: Coluna ARP */}
                        <th className="px-4 py-2 text-left font-normal w-[15%]">Cód. Item</th>
                        <th className="px-4 py-2 text-left font-normal w-[45%]">Descrição Item</th>
                        <th className="px-4 py-2 text-center font-normal w-[15%]">Qtd. Homologada</th>
                        <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Unitário</th>
                    </TableRow>
                </thead>
                <TableBody>
                    {detailedItems.map(item => {
                        // MUDANÇA: Verifica se o ID do item está no array de IDs selecionados
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                            <TableRow 
                                key={item.id}
                                className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                onClick={() => handlePreSelectDetailedItem(item)}
                            >
                                <TableCell className="text-sm font-medium">{item.numeroAta}</TableCell> {/* NOVO: Exibe o número da ARP */}
                                <TableCell className="text-sm font-medium">{item.codigoItem}</TableCell>
                                <TableCell className="text-[11px] max-w-lg whitespace-normal">
                                    {capitalizeFirstLetter(item.descricaoItem)}
                                </TableCell>
                                <TableCell className="text-center text-sm">
                                    {item.quantidadeHomologada.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-right text-sm font-bold text-primary">
                                    {formatCurrency(item.valorUnitario)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};


const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ results, onItemPreSelect, searchedUasg, searchedOmName, selectedItemIds }) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    
    // Ref para o cabeçalho dos resultados (âncora de rolagem)
    const resultHeaderRef = useRef<HTMLDivElement>(null);
    
    // Ref para o container de rolagem
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Efeito para rolar para o topo dos resultados quando a lista é carregada
    useEffect(() => {
        if (results.length > 0 && resultHeaderRef.current) {
            // Usamos setTimeout para garantir que o DialogContent tenha expandido
            setTimeout(() => {
                resultHeaderRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }, 100);
        }
    }, [results]);
    
    // 1. Lógica de Agrupamento
    const groupedArps = useMemo(() => {
        const groupsMap = new Map<string, ArpGroup>();

        results.forEach(arp => {
            // A chave de agrupamento é o pregaoFormatado
            const pregaoKey = arp.pregaoFormatado;
            
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, {
                    pregao: pregaoKey,
                    uasg: arp.uasg,
                    omNome: arp.omNome,
                    arpReferences: [], // Inicializa a lista de referências
                    objetoRepresentativo: arp.objeto || 'Objeto não especificado',
                    dataVigenciaInicial: arp.dataVigenciaInicial || '',
                    dataVigenciaFinal: arp.dataVigenciaFinal || '',
                });
            }

            const group = groupsMap.get(pregaoKey)!;
            
            // Adiciona a referência da ARP atual ao grupo
            group.arpReferences.push({
                numeroControlePncpAta: arp.numeroControlePncpAta,
                numeroAta: arp.numeroAta,
            });
            
            // Atualiza o objeto representativo (opcional, mas mantém a consistência)
            if (arp.objeto && arp.objeto.length > group.objetoRepresentativo.length) {
                group.objetoRepresentativo = arp.objeto;
            }
        });

        return Array.from(groupsMap.values()).sort((a, b) => a.pregao.localeCompare(b.pregao));
    }, [results]);
    
    const handleToggleGroup = (pregaoKey: string) => {
        setOpenGroups(prev => {
            const isCurrentlyOpen = prev[pregaoKey];
            const newState = {
                ...prev,
                [pregaoKey]: !isCurrentlyOpen,
            };
            
            // Se o grupo estiver sendo ABERTO, rola a linha do grupo para o topo do container
            if (!isCurrentlyOpen && scrollContainerRef.current) {
                // Usamos setTimeout para garantir que o DOM tenha tempo de renderizar a linha
                setTimeout(() => {
                    const rowElement = document.getElementById(`arp-group-row-${pregaoKey}`);
                    
                    if (rowElement) {
                        // Usa scrollIntoView no elemento da linha, alinhando-o ao topo do container de rolagem
                        rowElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }, 100);
            }
            
            return newState;
        });
    };
    
    // Lógica de exibição do nome da OM no cabeçalho:
    const omNameFromApi = groupedArps.length > 0 ? groupedArps[0].omNome : '';
    const omNameDisplay = (omNameFromApi && !omNameFromApi.startsWith('UASG ')) 
        ? omNameFromApi 
        : searchedOmName;
    
    const omUasg = searchedUasg;
    const totalArpItems = results.length; 

    return (
        <div className="p-4 space-y-4">
            {/* CABEÇALHO DA PESQUISA (ÂNCORA DE SCROLL) */}
            <div ref={resultHeaderRef}>
                <h3 className="text-lg font-semibold flex flex-col">
                    <span>
                        Resultado para {omNameDisplay} ({formatCodug(omUasg)})
                    </span>
                    <span className="text-sm font-normal text-muted-foreground mt-1">
                        {groupedArps.length} Pregões encontrados ({totalArpItems} ARPs)
                    </span>
                </h3>
            </div>
            
            <div ref={scrollContainerRef} className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[150px]">Pregão</TableHead>
                            <TableHead>Objeto</TableHead>
                            <TableHead className="w-[250px] text-center">Vigência</TableHead>
                            <TableHead className="w-[50px]"></TableHead> 
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedArps.map(group => {
                            // CORREÇÃO APLICADA AQUI: Garante que é sempre um booleano
                            const isGroupOpen = openGroups[group.pregao] ?? false; 
                            
                            const displayPregao = group.pregao === 'N/A' 
                                ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                : formatPregao(group.pregao); 
                                
                            return (
                                <React.Fragment key={group.pregao}>
                                    <TableRow 
                                        id={`arp-group-row-${group.pregao}`} /* ID para rolagem */
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleToggleGroup(group.pregao)}
                                    >
                                        <TableCell className="font-semibold">
                                            {displayPregao}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs whitespace-normal">
                                            {capitalizeFirstLetter(group.objetoRepresentativo)}
                                        </TableCell>
                                        <TableCell className="text-center text-sm whitespace-nowrap">
                                            {formatDate(group.dataVigenciaInicial)} - {formatDate(group.dataVigenciaFinal)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                        </TableCell>
                                    </TableRow>
                                    
                                    {/* Conteúdo Colapsável com a lista de ITENS DETALHADOS (Nível 2) */}
                                    <TableRow className="p-0">
                                        <TableCell colSpan={4} className="p-0">
                                            <Collapsible open={isGroupOpen}>
                                                <CollapsibleContent>
                                                    <DetailedArpItems 
                                                        arpReferences={group.arpReferences} // PASSANDO TODAS AS REFERÊNCIAS
                                                        pregaoFormatado={group.pregao}
                                                        uasg={group.uasg}
                                                        onItemPreSelect={onItemPreSelect}
                                                        isGroupOpen={isGroupOpen}
                                                        selectedItemIds={selectedItemIds}
                                                    />
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
        </div>
    );
};

export default ArpSearchResultsList;