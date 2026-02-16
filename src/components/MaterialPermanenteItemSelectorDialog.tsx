"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Search, 
    Check, 
    Package, 
    ChevronDown, 
    ChevronUp, 
    AlertCircle, 
    Loader2 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/SessionContextProvider";
import { 
    Collapsible, 
    CollapsibleContent, 
    CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from "@/components/ui/tooltip";

interface SelectableItem extends ItemAquisicao {
    isSelected: boolean;
    subitem_nr?: string;
    subitem_nome?: string;
}

interface SubitemGroup {
    id: string;
    nr_subitem: string;
    nome_subitem: string;
    items: SelectableItem[];
}

interface MaterialPermanenteItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    initialItems: ItemAquisicao[];
    onSelect: (items: ItemAquisicao[]) => void;
    onAddDiretriz: () => void;
    categoria: string;
}

const MaterialPermanenteItemSelectorDialog: React.FC<MaterialPermanenteItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    initialItems,
    onSelect,
    onAddDiretriz,
}) => {
    const { user } = useSession();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, ItemAquisicao>>({});
    const [expandedSubitems, setExpandedSubitems] = useState<Record<string, boolean>>({});

    const { data: diretrizes, isLoading } = useQuery({
        queryKey: ['diretrizesMaterialPermanenteSelector', selectedYear, user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('diretrizes_material_permanente' as any)
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', selectedYear)
                .eq('ativo', true)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: open && !!user?.id
    });

    useEffect(() => {
        if (open) {
            const initialMap: Record<string, ItemAquisicao> = {};
            initialItems.forEach(item => { initialMap[item.id] = item; });
            setSelectedItemsMap(initialMap);
            setSearchTerm('');
            setExpandedSubitems({});
        }
    }, [open, initialItems]);

    const groupedAndFilteredItems = useMemo<SubitemGroup[]>(() => {
        if (!diretrizes) return [];
        const groups: Record<string, SubitemGroup> = {};
        const lowerCaseSearch = searchTerm.toLowerCase().trim();

        diretrizes.forEach(diretriz => {
            const items = Array.isArray(diretriz.itens_aquisicao) ? (diretriz.itens_aquisicao as any[]) : [];
            
            const filteredItems = items.filter(item => {
                const searchString = [
                    item.descricao_item,
                    item.descricao_reduzida, 
                    item.codigo_catmat,
                    item.numero_pregao,
                    diretriz.nr_subitem,
                    diretriz.nome_subitem,
                ].join(' ').toLowerCase();
                return searchString.includes(lowerCaseSearch);
            });
            
            if (filteredItems.length > 0) {
                const groupKey = diretriz.id;
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        id: diretriz.id,
                        nr_subitem: diretriz.nr_subitem,
                        nome_subitem: diretriz.nome_subitem,
                        items: [],
                    };
                }
                groups[groupKey].items.push(...filteredItems.map(item => ({
                    ...item,
                    subitem_nr: diretriz.nr_subitem,
                    subitem_nome: diretriz.nome_subitem,
                    isSelected: !!selectedItemsMap[item.id],
                })));
            }
        });
        
        return Object.values(groups).sort((a, b) => {
            const numCompare = a.nr_subitem.localeCompare(b.nr_subitem);
            if (numCompare !== 0) return numCompare;
            return a.nome_subitem.localeCompare(b.nome_subitem);
        });
    }, [diretrizes, searchTerm, selectedItemsMap]);

    const handleToggleItem = (item: ItemAquisicao) => {
        setSelectedItemsMap(prev => {
            const newMap = { ...prev };
            if (newMap[item.id]) delete newMap[item.id];
            else newMap[item.id] = { ...item, quantidade: 1 };
            return newMap;
        });
    };

    const handleConfirmSelection = () => {
        onSelect(Object.values(selectedItemsMap));
        onOpenChange(false);
    };

    const totalSelected = Object.keys(selectedItemsMap).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Selecionar Itens de Material Permanente ({selectedYear})
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-2 space-y-4 flex-1 flex flex-col min-h-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por descrição, CATMAT, pregão ou subitem..." 
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="flex-1 border rounded-md bg-muted/20">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : groupedAndFilteredItems.length === 0 ? (
                            <div className="p-4">
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Nenhum Item Encontrado</AlertTitle>
                                    <AlertDescription>
                                        Não encontramos diretrizes para o ano {selectedYear}.
                                        <Button variant="link" className="p-0 h-auto ml-1" onClick={onAddDiretriz}>Cadastrar Diretriz</Button>
                                    </AlertDescription>
                                </Alert>
                            </div>
                        ) : (
                            <TooltipProvider>
                                <div className="p-4 space-y-3">
                                    {groupedAndFilteredItems.map(group => (
                                        <Collapsible 
                                            key={group.id} 
                                            open={expandedSubitems[group.id] ?? false} 
                                            onOpenChange={(isOpen) => setExpandedSubitems(prev => ({ ...prev, [group.id]: isOpen }))}
                                        >
                                            <CollapsibleTrigger asChild>
                                                <div className="flex justify-between items-center p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors">
                                                    <span className="font-semibold text-sm">{group.nr_subitem} - {group.nome_subitem}</span>
                                                    {expandedSubitems[group.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </div>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="pt-2 space-y-1">
                                                {group.items.map(item => (
                                                    <Tooltip key={item.id}>
                                                        <TooltipTrigger asChild>
                                                            <div 
                                                                className={cn(
                                                                    "flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors", 
                                                                    item.isSelected ? "bg-primary/10 border-primary/50" : "bg-background hover:bg-gray-50"
                                                                )} 
                                                                onClick={() => handleToggleItem(item)}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <div className={cn(
                                                                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", 
                                                                        item.isSelected ? "bg-primary border-primary" : "border-gray-300"
                                                                    )}>
                                                                        {item.isSelected && <Check className="h-3 w-3 text-white" />}
                                                                    </div>
                                                                    <div className="text-sm min-w-0 flex-1">
                                                                        <p className="font-medium truncate">{item.descricao_reduzida || item.descricao_item}</p>
                                                                        <p className="text-[10px] text-muted-foreground">
                                                                            CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)} | UASG: {formatCodug(item.uasg)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0 ml-4">
                                                                    <p className="font-bold text-sm text-primary">{formatCurrency(item.valor_unitario)}</p>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-md">
                                                            <p className="text-sm">{item.descricao_item}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </div>
                            </TooltipProvider>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                    <div className="flex justify-between items-center w-full">
                        <p className="text-sm font-medium">
                            Selecionados: <span className="font-bold text-primary">{totalSelected}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={handleConfirmSelection} disabled={totalSelected === 0}>
                                <Check className="mr-2 h-4 w-4" /> Confirmar Seleção
                            </Button>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteItemSelectorDialog;