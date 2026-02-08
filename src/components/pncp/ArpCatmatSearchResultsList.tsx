import React, { useState, useMemo, useRef } from 'react';
import { DetailedArpItem } from '@/types/pncp';
import { capitalizeFirstLetter, formatCodug, formatDate, formatCurrency, formatPregao } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ArpCatmatSearchResultsListProps {
    results: DetailedArpItem[]; 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    searchedDescription: string;
    searchedCode: string;
    selectedItemIds: string[];
}

// Componente interno para renderizar os itens detalhados
const DetailedCatmatItems = ({ items, pregaoFormatado, selectedItemIds, onItemPreSelect }: { 
    items: DetailedArpItem[]; 
    pregaoFormatado: string; 
    selectedItemIds: string[];
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
}) => {
    
    const handlePreSelectDetailedItem = (item: DetailedArpItem) => {
        // Chama a função de alternância no componente pai
        onItemPreSelect(item, pregaoFormatado, item.uasg);
    };
    
    return (
        <div className="p-4 bg-muted/50 border-t border-border space-y-3">
            <Table className="bg-background border rounded-md overflow-hidden">
                <thead>
                    <TableRow className="text-xs text-muted-foreground hover:bg-background">
                        <th className="px-4 py-2 text-left font-normal w-[10%]">ARP</th>
                        <th className="px-4 py-2 text-left font-normal w-[15%]">UASG</th>
                        <th className="px-4 py-2 text-left font-normal w-[45%]">Descrição Item</th>
                        <th className="px-4 py-2 text-center font-normal w-[15%]">Qtd. Homologada</th>
                        <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Unitário</th>
                    </TableRow>
                </thead>
                <TableBody>
                    {items.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        return (
                            <TableRow 
                                key={item.id}
                                className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                onClick={() => handlePreSelectDetailedItem(item)}
                            >
                                <TableCell className="text-xs font-medium py-2">{item.numeroAta}</TableCell>
                                <TableCell className="text-xs font-medium py-2">{item.uasg}</TableCell>
                                <TableCell className="text-[0.7rem] max-w-lg whitespace-normal py-2">
                                    {capitalizeFirstLetter(item.descricaoItem)}
                                </TableCell>
                                <TableCell className="text-center text-xs py-2">
                                    {item.quantidadeHomologada.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-right text-xs font-bold text-primary py-2">
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


const ArpCatmatSearchResultsList: React.FC<ArpCatmatSearchResultsListProps> = ({ 
    results, 
    onItemPreSelect, 
    searchedDescription, 
    searchedCode, 
    selectedItemIds 
}) => {
    
    // Agrupamento por Pregão e UASG
    const groupedByPregao = useMemo(() => {
        const groupsMap = new Map<string, DetailedArpItem[]>();
        results.forEach(item => {
            // Chave de agrupamento: Pregão + UASG
            const pregaoKey = `${item.pregaoFormatado}-${item.uasg}`;
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, []);
            }
            groupsMap.get(pregaoKey)!.push(item);
        });
        return Array.from(groupsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [results]);
    
    // ESTADO LOCAL DE EXPANSÃO
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    
    const handleToggleGroup = (pregaoKey: string) => {
        const isCurrentlyOpen = openGroups[pregaoKey];
        
        if (isCurrentlyOpen) {
            setOpenGroups({});
        } else {
            setOpenGroups({ [pregaoKey]: true });
            setTimeout(() => {
                const rowElement = rowRefs.current[pregaoKey];
                if (rowElement) {
                    rowElement.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                }
            }, 100); 
        }
    };

    return (
        <div className="p-4 space-y-4">
            {/* CABEÇALHO DA PESQUISA */}
            <div>
                <h3 className="text-lg font-semibold flex flex-col">
                    <span>
                        Resultado para {capitalizeFirstLetter(searchedDescription)} (Cód. {searchedCode})
                    </span>
                    <span className="text-sm font-normal text-muted-foreground mt-1">
                        {groupedByPregao.length} Pregões encontrados ({results.length} itens de ARP)
                    </span>
                </h3>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[150px]">Pregão</TableHead>
                            <TableHead className="w-[200px]">OM Gerenciadora</TableHead>
                            <TableHead className="w-[100px]">UASG</TableHead>
                            <TableHead className="w-[200px] text-center">Vigência</TableHead>
                            <TableHead className="w-[50px]"></TableHead> 
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedByPregao.map(([pregaoKey, items]) => {
                            const isGroupOpen = openGroups[pregaoKey];
                            const representativeItem = items[0];
                            
                            const displayPregao = representativeItem.pregaoFormatado === 'N/A' 
                                ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                : formatPregao(representativeItem.pregaoFormatado); 
                                
                            return (
                                <React.Fragment key={pregaoKey}>
                                    <TableRow 
                                        ref={el => rowRefs.current[pregaoKey] = el}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleToggleGroup(pregaoKey)}
                                    >
                                        <TableCell className="font-semibold">
                                            {displayPregao}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs whitespace-normal">
                                            {representativeItem.omNome || 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">
                                            {formatCodug(representativeItem.uasg)}
                                        </TableCell>
                                        <TableCell className="text-center text-sm whitespace-nowrap">
                                            {formatDate(representativeItem.dataVigenciaInicial)} - {formatDate(representativeItem.dataVigenciaFinal)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-4 w-4" />}
                                        </TableCell>
                                    </TableRow>
                                    
                                    <TableRow className="p-0">
                                        <TableCell colSpan={5} className="p-0">
                                            <Collapsible open={isGroupOpen}>
                                                <CollapsibleContent>
                                                    <DetailedCatmatItems 
                                                        items={items}
                                                        pregaoFormatado={representativeItem.pregaoFormatado}
                                                        selectedItemIds={selectedItemIds}
                                                        onItemPreSelect={onItemPreSelect}
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

export default ArpCatmatSearchResultsList;