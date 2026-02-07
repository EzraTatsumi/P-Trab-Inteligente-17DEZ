import React, { useState, useMemo } from 'react';
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
    // NOVO: Função para pré-selecionar o item detalhado (não faz a importação final)
    onItemPreSelect: (item: DetailedArpItem | null, pregaoFormatado: string, uasg: string) => void;
    searchedUasg: string;
    searchedOmName: string;
    // NOVO: ID do item selecionado globalmente para manter o destaque
    selectedItemId: string | null;
}

// Componente para buscar e exibir os itens detalhados de uma ARP
const DetailedArpItems = ({ arpReferences, pregaoFormatado, uasg, onItemPreSelect, isGroupOpen, selectedItemId }: { 
    arpReferences: ArpReference[]; 
    pregaoFormatado: string; 
    uasg: string; 
    onItemPreSelect: (item: DetailedArpItem | null, pregaoFormatado: string, uasg: string) => void;
    isGroupOpen: boolean;
    selectedItemId: string | null;
}) => {
    // Não precisamos mais de selectedDetailedItem localmente, usamos selectedItemId do pai.

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
        const isCurrentlySelected = selectedItemId === item.id;
        
        if (isCurrentlySelected) {
            // Desselecionar
            onItemPreSelect(null, '', '');
        } else {
            // Selecionar
            onItemPreSelect(item, pregaoFormatado, uasg);
        }
    };
    
    // O botão de importação foi removido daqui.

    if (isLoading) {
        return (
            <div className="text-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground mt-1">Carregando itens detalhados de {arpReferences.length} ARPs...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="text-center py-4 text-red-500 text-sm">
                Erro ao carregar itens detalhados de uma ou mais ARPs.
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
            <Table className="bg-background border rounded-md">
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
                        const isSelected = selectedItemId === item.id;
                        return (
                            <TableRow 
                                key={item.id}
                                className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                onClick={() => handlePreSelectDetailedItem(item)}
                            >
                                <TableCell className="text-sm font-medium">{item.numeroAta}</TableCell> {/* NOVO: Exibe o número da ARP */}
                                <TableCell className="text-sm font-medium">{item.codigoItem}</TableCell>
                                <TableCell className="text-sm max-w-lg whitespace-normal">
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
            
            {/* O botão de importação global foi removido daqui. */}
        </div>
    );
};


const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ results, onItemPreSelect, searchedUasg, searchedOmName, selectedItemId }) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    
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
        setOpenGroups(prev => ({
            ...prev,
            [pregaoKey]: !prev[pregaoKey],
        }));
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
            {/* CABEÇALHO DA PESQUISA */}
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
                            <TableHead className="w-[50px]"></TableHead> 
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedArps.map(group => {
                            const isGroupOpen = openGroups[group.pregao];
                            
                            const displayPregao = group.pregao === 'N/A' 
                                ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                : formatPregao(group.pregao); 
                                
                            return (
                                <React.Fragment key={group.pregao}>
                                    <TableRow 
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
                                                        selectedItemId={selectedItemId}
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
            
            {/* O botão de importação global foi removido, pois a importação agora é feita por item detalhado */}
        </div>
    );
};

export default ArpSearchResultsList;