import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from '@/components/SessionContextProvider';
import { DiretrizMaterialPermanente, ItemAquisicaoMaterial } from "@/types/diretrizesMaterialPermanente";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatCodug, formatPregao } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SelectableItem extends ItemAquisicaoMaterial {
    isSelected: boolean;
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
    initialItems: ItemAquisicaoMaterial[]; 
    onSelect: (items: ItemAquisicaoMaterial[]) => void;
    onAddDiretriz: () => void;
    categoria: string;
}

const fetchDiretrizesMaterial = async (year: number, userId: string): Promise<DiretrizMaterialPermanente[]> => {
    if (!year || !userId) return [];
    
    const { data, error } = await supabase
        .from('diretrizes_material_permanente')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .eq('ativo', true)
        .order('nr_subitem', { ascending: true });
        
    if (error) throw error;
    
    return (data || []).map((d: any) => ({
        ...d,
        itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicaoMaterial[]) || [],
    })) as DiretrizMaterialPermanente[];
};

const MaterialPermanenteItemSelectorDialog: React.FC<MaterialPermanenteItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    initialItems,
    onSelect,
    onAddDiretriz,
    categoria
}) => {
    const { user } = useSession();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, ItemAquisicaoMaterial>>({});
    const [expandedSubitems, setExpandedSubitems] = useState<Record<string, boolean>>({});

    const { data: diretrizes, isLoading } = useQuery({
        queryKey: ['diretrizesMaterialSelector', selectedYear, user?.id],
        queryFn: () => fetchDiretrizesMaterial(selectedYear, user!.id),
        enabled: !!user?.id && selectedYear > 0,
        initialData: [],
    });
    
    useEffect(() => {
        if (open) {
            const initialMap: Record<string, ItemAquisicaoMaterial> = {};
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
            const filteredItems = diretriz.itens_aquisicao.filter(item => {
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
                    isSelected: !!selectedItemsMap[item.id],
                })));
            }
        });
        
        return Object.values(groups).sort((a, b) => a.nr_subitem.localeCompare(b.nr_subitem));
    }, [diretrizes, searchTerm, selectedItemsMap]);
    
    const handleToggleItem = (item: ItemAquisicaoMaterial) => {
        setSelectedItemsMap(prev => {
            const newMap = { ...prev };
            if (newMap[item.id]) delete newMap[item.id];
            else newMap[item.id] = item;
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Selecionar Itens de Material Permanente</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por material, CATMAT, pregão ou subitem..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            </div>
                        ) : groupedAndFilteredItems.length === 0 ? (
                            <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Nenhum Item Encontrado</AlertTitle></Alert>
                        ) : (
                            <TooltipProvider>
                                {groupedAndFilteredItems.map(group => (
                                    <Collapsible key={group.id} open={expandedSubitems[group.id] ?? false} onOpenChange={(open) => setExpandedSubitems(prev => ({ ...prev, [group.id]: open }))}>
                                        <CollapsibleTrigger asChild>
                                            <div className="flex justify-between items-center p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors">
                                                <span className="font-semibold text-sm">{group.nr_subitem} - {group.nome_subitem}</span>
                                                {expandedSubitems[group.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pt-2">
                                            <div className="space-y-1">
                                                {group.items.map(item => (
                                                    <Tooltip key={item.id}>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn("flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors", item.isSelected ? "bg-primary/10 border-primary/50" : "hover:bg-gray-50")} onClick={() => handleToggleItem(item)}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", item.isSelected ? "bg-primary border-primary" : "border-gray-300")}>
                                                                        {item.isSelected && <Check className="h-3 w-3 text-white" />}
                                                                    </div>
                                                                    <div className="text-sm min-w-0 flex-1">
                                                                        <p className="font-medium truncate">{item.descricao_reduzida || item.descricao_item}</p>
                                                                        <p className="text-xs text-muted-foreground">CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)} | UASG: {formatCodug(item.uasg)}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0 ml-4">
                                                                    <p className="font-semibold text-sm">{formatCurrency(item.valor_unitario)}</p>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-md"><p className="text-sm">{item.descricao_item}</p></TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                            </TooltipProvider>
                        )}
                    </div>
                </div>
                
                <DialogFooter>
                    <div className="flex justify-between items-center w-full">
                        <p className="text-sm font-medium">Selecionados: <span className="font-bold text-primary">{totalSelected}</span></p>
                        <Button onClick={handleConfirmSelection} disabled={totalSelected === 0}><Check className="mr-2 h-4 w-4" />Confirmar Seleção</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteItemSelectorDialog;