import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import { formatCodug, formatCurrency, formatDate, formatPregao, capitalizeFirstLetter } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { fetchArpItemsById } from '@/integrations/supabase/api';

interface ArpReference {
    numeroControlePncpAta: string;
    numeroAta: string;
}

interface ArpGroup {
    pregao: string;
    uasg: string;
    omNome: string;
    arpReferences: ArpReference[]; 
    objetoRepresentativo: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
}

interface ArpSearchResultsListProps {
    results: ArpItemResult[]; 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedUasg: string;
    searchedOmName: string;
    selectedItemIds: string[];
    mode?: 'material' | 'servico'; // NOVO
}

const DetailedArpItems = ({ arpReferences, pregaoFormatado, uasg, onItemPreSelect, isGroupOpen, selectedItemIds, mode }: { 
    arpReferences: ArpReference[]; 
    pregaoFormatado: string; 
    uasg: string; 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    isGroupOpen: boolean;
    selectedItemIds: string[];
    mode: 'material' | 'servico';
}) => {
    const arpQueries = useQueries({
        queries: arpReferences.map(ref => ({
            queryKey: ['arpDetailedItems', ref.numeroControlePncpAta],
            queryFn: () => fetchArpItemsById(ref.numeroControlePncpAta),
            enabled: isGroupOpen && !!ref.numeroControlePncpAta,
            staleTime: 1000 * 60 * 5,
        })),
    });
    
    const isLoading = arpQueries.some(query => query.isLoading);
    const isError = arpQueries.some(query => query.isError);
    
    const detailedItems: DetailedArpItem[] = useMemo(() => {
        if (isLoading || isError) return [];
        return arpQueries.flatMap(query => query.data || []);
    }, [arpQueries, isLoading, isError]);
    
    if (isLoading) return <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /><p className="text-sm text-muted-foreground mt-1">Carregando itens...</p></div>;
    if (isError) return <div className="text-center py-4 text-red-500 text-sm">Erro ao carregar itens detalhados.</div>;
    if (!detailedItems || detailedItems.length === 0) return <div className="text-center py-4 text-muted-foreground text-sm">Nenhum item detalhado encontrado.</div>;

    const codeLabel = mode === 'material' ? 'Cód. CATMAT' : 'Cód. CATSER';

    return (
        <div className="p-4 bg-muted/50 border-t border-border space-y-3">
            <Table className="bg-background border rounded-md overflow-hidden">
                <thead>
                    <TableRow className="text-xs text-muted-foreground hover:bg-background">
                        <th className="px-4 py-2 text-left font-normal w-[10%]">ARP</th>
                        <th className="px-4 py-2 text-left font-normal w-[15%]">{codeLabel}</th>
                        <th className="px-4 py-2 text-left font-normal w-[45%]">Descrição Item</th>
                        <th className="px-4 py-2 text-center font-normal w-[15%]">Qtd. Homologada</th>
                        <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Unitário</th>
                    </TableRow>
                </thead>
                <TableBody>
                    {detailedItems.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                            <TableRow key={item.id} className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`} onClick={() => onItemPreSelect(item, pregaoFormatado, uasg)}>
                                <TableCell className="text-xs font-medium py-2">{item.numeroAta}</TableCell>
                                <TableCell className="text-xs font-medium py-2">{item.codigoItem}</TableCell>
                                <TableCell className="text-[0.7rem] max-w-lg whitespace-normal py-2">{capitalizeFirstLetter(item.descricaoItem)}</TableCell>
                                <TableCell className="text-center text-xs py-2">{item.quantidadeHomologada.toLocaleString('pt-BR')}</TableCell>
                                <TableCell className="text-right text-xs font-bold text-primary py-2">{formatCurrency(item.valorUnitario)}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

const ArpSearchResultsList: React.FC<ArpSearchResultsListProps> = ({ results, onItemPreSelect, searchedUasg, searchedOmName, selectedItemIds, mode = 'material' }) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const resultHeaderRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    
    useEffect(() => {
        if (results.length > 0 && resultHeaderRef.current) {
            setTimeout(() => { resultHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
        }
    }, [results]);
    
    const groupedArps = useMemo(() => {
        const groupsMap = new Map<string, ArpGroup>();
        results.forEach(arp => {
            const pregaoKey = arp.pregaoFormatado;
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, { pregao: pregaoKey, uasg: arp.uasg, omNome: arp.omNome, arpReferences: [], objetoRepresentativo: arp.objeto || 'Objeto não especificado', dataVigenciaInicial: arp.dataVigenciaInicial || '', dataVigenciaFinal: arp.dataVigenciaFinal || '' });
            }
            const group = groupsMap.get(pregaoKey)!;
            group.arpReferences.push({ numeroControlePncpAta: arp.numeroControlePncpAta, numeroAta: arp.numeroAta });
            if (arp.objeto && arp.objeto.length > group.objetoRepresentativo.length) group.objetoRepresentativo = arp.objeto;
        });
        return Array.from(groupsMap.values()).sort((a, b) => a.pregao.localeCompare(b.pregao));
    }, [results]);
    
    const handleToggleGroup = (pregaoKey: string) => {
        const isCurrentlyOpen = openGroups[pregaoKey];
        if (isCurrentlyOpen) setOpenGroups({});
        else {
            setOpenGroups({ [pregaoKey]: true });
            setTimeout(() => {
                const rowElement = rowRefs.current[pregaoKey];
                if (rowElement) rowElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100); 
        }
    };
    
    const omNameFromApi = groupedArps.length > 0 ? groupedArps[0].omNome : '';
    const omNameDisplay = (omNameFromApi && !omNameFromApi.startsWith('UASG ')) ? omNameFromApi : searchedOmName;

    return (
        <div className="p-4 space-y-4">
            <div ref={resultHeaderRef}>
                <h3 className="text-lg font-semibold flex flex-col">
                    <span>Resultado para {omNameDisplay} ({formatCodug(searchedUasg)})</span>
                    <span className="text-sm font-normal text-muted-foreground mt-1">{groupedArps.length} Pregões encontrados ({results.length} ARPs)</span>
                </h3>
            </div>
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
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
                        {groupedArps.map(group => (
                            <React.Fragment key={group.pregao}>
                                <TableRow ref={el => rowRefs.current[group.pregao] = el} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleToggleGroup(group.pregao)}>
                                    <TableCell className="font-semibold">{group.pregao === 'N/A' ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> : formatPregao(group.pregao)}</TableCell>
                                    <TableCell className="text-sm max-w-xs whitespace-normal">{capitalizeFirstLetter(group.objetoRepresentativo)}</TableCell>
                                    <TableCell className="text-center text-sm whitespace-nowrap">{formatDate(group.dataVigenciaInicial)} - {formatDate(group.dataVigenciaFinal)}</TableCell>
                                    <TableCell className="text-center">{openGroups[group.pregao] ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}</TableCell>
                                </TableRow>
                                <TableRow className="p-0">
                                    <TableCell colSpan={4} className="p-0">
                                        <Collapsible open={openGroups[group.pregao]}>
                                            <CollapsibleContent>
                                                <DetailedArpItems arpReferences={group.arpReferences} pregaoFormatado={group.pregao} uasg={group.uasg} onItemPreSelect={onItemPreSelect} isGroupOpen={openGroups[group.pregao]} selectedItemIds={selectedItemIds} mode={mode} />
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default ArpSearchResultsList;