import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DetailedArpItem } from '@/types/pncp';
import { formatCodug, formatCurrency, formatDate, formatPregao, capitalizeFirstLetter } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipo para o grupo de ARPs (agrupado por Pregão)
interface ArpGroup {
    pregao: string;
    uasg: string;
    omNome: string;
    dataVigenciaInicial: string;
    dataVigenciaFinal: string;
    items: DetailedArpItem[]; // Itens detalhados que pertencem a este Pregão
}

interface ArpCatmatSearchResultsListProps {
    results: DetailedArpItem[]; 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
}

const ArpCatmatSearchResultsList: React.FC<ArpCatmatSearchResultsListProps> = ({ results, onItemPreSelect, selectedItemIds }) => {
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    
    // Ref para o cabeçalho dos resultados (âncora de rolagem)
    const resultHeaderRef = useRef<HTMLDivElement>(null);
    
    // Ref para armazenar as referências das linhas de Pregão
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    
    // Efeito para rolar para o topo dos resultados quando a lista é carregada
    useEffect(() => {
        if (results.length > 0 && resultHeaderRef.current) {
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

        results.forEach(item => {
            // A chave de agrupamento é a combinação de Pregão e UASG (para garantir unicidade do contrato)
            const pregaoKey = `${item.pregaoFormatado}-${item.uasg}`;
            
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, {
                    pregao: item.pregaoFormatado,
                    uasg: item.uasg,
                    omNome: item.omNome,
                    dataVigenciaInicial: item.dataVigenciaInicial || '',
                    dataVigenciaFinal: item.dataVigenciaFinal || '',
                    items: [], 
                });
            }

            const group = groupsMap.get(pregaoKey)!;
            group.items.push(item);
        });

        // Ordena por Pregão
        return Array.from(groupsMap.values()).sort((a, b) => a.pregao.localeCompare(b.pregao));
    }, [results]);
    
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
    
    const handlePreSelectDetailedItem = (item: DetailedArpItem) => {
        onItemPreSelect(item, item.pregaoFormatado, item.uasg);
    };

    const totalItems = results.length; 
    const catmatCode = results.length > 0 ? results[0].codigoItem : 'N/A';

    return (
        <div className="p-4 space-y-4">
            {/* CABEÇALHO DA PESQUISA (ÂNCORA DE SCROLL) */}
            <div ref={resultHeaderRef}>
                <h3 className="text-lg font-semibold flex flex-col">
                    <span>
                        Resultados para CATMAT/CATSER: {catmatCode}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground mt-1">
                        {groupedArps.length} Pregões encontrados ({totalItems} itens)
                    </span>
                </h3>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[150px]">Pregão</TableHead>
                            <TableHead className="w-[200px]">UASG</TableHead>
                            <TableHead>OM Detentora</TableHead>
                            <TableHead className="w-[150px] text-center">Vigência</TableHead>
                            <TableHead className="w-[50px]"></TableHead> 
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedArps.map(group => {
                            const pregaoKey = `${group.pregao}-${group.uasg}`;
                            const isGroupOpen = openGroups[pregaoKey];
                            
                            const displayPregao = group.pregao === 'N/A' 
                                ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                : formatPregao(group.pregao); 
                                
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
                                        <TableCell className="text-sm">
                                            {formatCodug(group.uasg)}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs whitespace-normal">
                                            {group.omNome}
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
                                        <TableCell colSpan={5} className="p-0">
                                            <Collapsible open={isGroupOpen}>
                                                <CollapsibleContent>
                                                    <div className="p-4 bg-muted/50 border-t border-border space-y-3">
                                                        <Table className="bg-background border rounded-md overflow-hidden">
                                                            <thead>
                                                                <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                                    <th className="px-4 py-2 text-left font-normal w-[10%]">ARP</th>
                                                                    <th className="px-4 py-2 text-left font-normal w-[50%]">Descrição Item</th>
                                                                    <th className="px-4 py-2 text-center font-normal w-[15%]">Qtd. Homologada</th>
                                                                    <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Unitário</th>
                                                                </TableRow>
                                                            </thead>
                                                            <TableBody>
                                                                {group.items.map(item => {
                                                                    const isSelected = selectedItemIds.includes(item.id);
                                                                    return (
                                                                        <TableRow 
                                                                            key={item.id}
                                                                            className={cn(
                                                                                "cursor-pointer transition-colors",
                                                                                isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"
                                                                            )}
                                                                            onClick={() => handlePreSelectDetailedItem(item)}
                                                                        >
                                                                            <TableCell className="text-xs font-medium py-2">{item.numeroAta}</TableCell>
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