import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Check, Package, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from '@/components/SessionContextProvider';
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatNumber, formatCodug, formatPregao } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 

// Tipo para o item de aquisição com status de seleção
interface SelectableItem extends ItemAquisicao {
    isSelected: boolean;
}

// Tipo para o grupo de subitem na UI
interface SubitemGroup {
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    items: SelectableItem[];
}

interface AcquisitionItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    initialItems: ItemAquisicao[]; 
    onSelect: (items: ItemAquisicao[]) => void;
    onAddDiretriz: () => void;
}

// --- Data Fetching ---
const fetchDiretrizesMaterialConsumo = async (year: number, userId: string): Promise<DiretrizMaterialConsumo[]> => {
    if (!year || !userId) return [];
    
    const { data, error } = await supabase
        .from('diretrizes_material_consumo')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .eq('ativo', true)
        .order('nr_subitem', { ascending: true });
        
    if (error) throw error;
    
    return (data || []).map(d => ({
        ...d,
        itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicao[]) || [],
    })) as DiretrizMaterialConsumo[];
};

const AcquisitionItemSelectorDialog: React.FC<AcquisitionItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    initialItems,
    onSelect,
    onAddDiretriz,
}) => {
    const { user } = useSession();
    const userId = user?.id;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, ItemAquisicao>>({});
    const [expandedSubitems, setExpandedSubitems] = useState<Record<string, boolean>>({});

    const { data: diretrizes, isLoading, error } = useQuery({
        queryKey: ['diretrizesMaterialConsumoSelector', selectedYear, userId],
        queryFn: () => fetchDiretrizesMaterialConsumo(selectedYear, userId!),
        enabled: !!userId && selectedYear > 0,
        initialData: [],
    });
    
    useEffect(() => {
        if (open) {
            const initialMap: Record<string, ItemAquisicao> = {};
            initialItems.forEach(item => {
                initialMap[item.id] = item;
            });
            setSelectedItemsMap(initialMap);
            setSearchTerm('');
        }
    }, [open, initialItems]);

    const groupedAndFilteredItems = useMemo<SubitemGroup[]>(() => {
        if (!diretrizes || diretrizes.length === 0) return [];

        const groups: Record<string, SubitemGroup> = {};
        const lowerCaseSearch = searchTerm.toLowerCase().trim();

        diretrizes.forEach(diretriz => {
            const subitemKey = diretriz.nr_subitem;
            
            const filteredItems = diretriz.itens_aquisicao.filter(item => {
                const searchString = [
                    item.descricao_item,
                    item.descricao_reduzida, 
                    item.codigo_catmat,
                    item.numero_pregao,
                    item.uasg,
                    diretriz.nr_subitem,
                    diretriz.nome_subitem,
                ].join(' ').toLowerCase();
                
                return searchString.includes(lowerCaseSearch);
            });
            
            if (filteredItems.length > 0) {
                if (!groups[subitemKey]) {
                    groups[subitemKey] = {
                        nr_subitem: diretriz.nr_subitem,
                        nome_subitem: diretriz.nome_subitem,
                        descricao_subitem: diretriz.descricao_subitem,
                        items: [],
                    };
                }
                
                groups[subitemKey].items.push(...filteredItems.map(item => ({
                    ...item,
                    nr_subitem: diretriz.nr_subitem,
                    nome_subitem: diretriz.nome_subitem,
                    isSelected: !!selectedItemsMap[item.id],
                })));
            }
        });

        return Object.values(groups).sort((a, b) => a.nr_subitem.localeCompare(b.nr_subitem));
    }, [diretrizes, searchTerm, selectedItemsMap]);
    
    const handleToggleItem = (item: ItemAquisicao) => {
        setSelectedItemsMap(prev => {
            const newMap = { ...prev };
            if (newMap[item.id]) {
                delete newMap[item.id];
            } else {
                newMap[item.id] = item;
            }
            return newMap;
        });
    };
    
    const handleConfirmSelection = () => {
        const selectedItems = Object.values(selectedItemsMap);
        onSelect(selectedItems);
        onOpenChange(false);
    };
    
    const totalSelected = Object.keys(selectedItemsMap).length;
    
    if (!isLoading && diretrizes.length === 0) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Selecionar Itens de Aquisição</DialogTitle>
                    </DialogHeader>
                    <Alert variant="default" className="border-l-4 border-yellow-500">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <AlertTitle>Diretrizes Não Encontradas</AlertTitle>
                        <AlertDescription>
                            Não há diretrizes de Material de Consumo cadastradas para o ano {selectedYear}. Por favor, cadastre-as em Configurações.
                        </AlertDescription>
                    </Alert>
                    <DialogFooter>
                        <Button onClick={onAddDiretriz} variant="secondary">
                            <Package className="mr-2 h-4 w-4" />
                            Ir para Configurações
                        </Button>
                        <Button onClick={() => onOpenChange(false)} variant="outline">
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto tour-item-selector-dialog">
                <DialogHeader>
                    <DialogTitle>Selecionar Itens de Aquisição (Ano {selectedYear})</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por item, CATMAT, pregão ou subitem..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={isLoading}
                            className="pl-10"
                        />
                    </div>
                    
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                <p className="text-sm text-muted-foreground mt-2">Carregando diretrizes...</p>
                            </div>
                        ) : groupedAndFilteredItems.length === 0 ? (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Nenhum Item Encontrado</AlertTitle>
                                <AlertDescription>
                                    A busca não retornou resultados ou não há itens de aquisição cadastrados nas diretrizes ativas.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <TooltipProvider>
                                {groupedAndFilteredItems.map(group => {
                                    const selectedCount = group.items.filter(item => item.isSelected).length;
                                    const totalCount = group.items.length;
                                    
                                    return (
                                    <Collapsible 
                                        key={group.nr_subitem}
                                        open={expandedSubitems[group.nr_subitem] ?? false}
                                        onOpenChange={(open) => setExpandedSubitems(prev => ({ ...prev, [group.nr_subitem]: open }))}
                                    >
                                        <CollapsibleTrigger asChild>
                                            <div className="flex justify-between items-center p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-sm">
                                                        {group.nr_subitem} - {group.nome_subitem} 
                                                    </span>
                                                    <span className="text-xs font-normal text-primary">
                                                        ({selectedCount} / {totalCount} itens selecionados)
                                                    </span>
                                                </div>
                                                {expandedSubitems[group.nr_subitem] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pt-2">
                                            <div className="space-y-1">
                                                {group.items.map(item => (
                                                    <Tooltip key={item.id}>
                                                        <TooltipTrigger asChild>
                                                            <div 
                                                                className={cn(
                                                                    "flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors",
                                                                    item.isSelected ? "bg-primary/10 border-primary/50" : "hover:bg-gray-50"
                                                                )}
                                                                onClick={() => handleToggleItem(item)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                                                        item.isSelected ? "bg-primary border-primary" : "border-gray-300"
                                                                    )}>
                                                                        {item.isSelected && <Check className="h-3 w-3 text-white" />}
                                                                    </div>
                                                                    <div className="text-sm min-w-0 flex-1">
                                                                        <p className="font-medium truncate">
                                                                            {item.descricao_reduzida || item.descricao_item}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)} ({formatCodug(item.uasg)})
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0 ml-4">
                                                                    <p className="font-semibold text-sm">{formatCurrency(item.valor_unitario)}</p>
                                                                </div>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-md">
                                                            <p className="font-bold mb-1">Descrição Completa:</p>
                                                            <p className="text-sm whitespace-normal">{item.descricao_item}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                    );
                                })}
                            </TooltipProvider>
                        )}
                    </div>
                </div>
                
                <DialogFooter className="mt-4">
                    <div className="flex justify-between items-center w-full">
                        <p className="text-sm font-medium">
                            Itens Selecionados: <span className="font-bold text-primary">{totalSelected}</span>
                        </p>
                        <Button 
                            onClick={handleConfirmSelection} 
                            disabled={totalSelected === 0}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Confirmar Seleção ({totalSelected})
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AcquisitionItemSelectorDialog;