import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Search, Check, Plus, XCircle, AlertCircle, ChevronDown, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { SelectedItemAquisicao } from "@/lib/materialConsumoUtils";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Importando Collapsible

// Tipos de estado
interface SubitemSelection {
    diretriz_id: string;
    nr_subitem: string;
    nome_subitem: string;
    itens_aquisicao: ItemAquisicao[];
}

interface MaterialConsumoSubitemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    initialSelections: SelectedItemAquisicao[];
    onSelect: (selectedItems: ItemAquisicao[], diretriz: { diretriz_id: string, nr_subitem: string, nome_subitem: string }) => void;
    onAddSubitem: () => void;
}

const MaterialConsumoSubitemSelectorDialog: React.FC<MaterialConsumoSubitemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    initialSelections,
    onSelect,
    onAddSubitem,
}) => {
    const { user } = useSession();
    const userId = user?.id;
    
    // Estado de busca e seleção
    const [searchTerm, setSearchTerm] = useState("");
    
    // Armazena os IDs dos itens de aquisição selecionados (chave: item.id, valor: boolean)
    const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
    
    // Armazena o ID do Subitem que está atualmente aberto (para controle do Collapsible)
    const [openSubitemId, setOpenSubitemId] = useState<string | null>(null);

    // --- Data Fetching ---
    const { data: diretrizes, isLoading: isLoadingDiretrizes } = useQuery<DiretrizMaterialConsumo[]>({
        queryKey: ['diretrizesMaterialConsumo', selectedYear, userId],
        queryFn: async () => {
            if (!userId || selectedYear <= 0) return [];
            
            const { data, error } = await supabase
                .from('diretrizes_material_consumo')
                .select('*')
                .eq('user_id', userId)
                .eq('ano_referencia', selectedYear)
                .eq('ativo', true)
                .order('nr_subitem', { ascending: true });
                
            if (error) throw error;
            
            return (data || []).map(d => ({
                ...d,
                itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicao[]) || [],
            })) as DiretrizMaterialConsumo[];
        },
        enabled: !!userId && selectedYear > 0,
        initialData: [],
    });
    
    // --- Efeitos e Handlers de Estado ---
    
    // Efeito para inicializar a seleção ao abrir o diálogo ou mudar a seleção inicial
    useEffect(() => {
        if (open) {
            const initialIds: Record<string, boolean> = {};
            
            if (initialSelections.length > 0) {
                initialSelections.forEach(item => {
                    initialIds[item.id] = true;
                });
                
                // Abre o primeiro subitem selecionado para facilitar a edição
                const firstItem = initialSelections[0];
                if (firstItem) {
                    setOpenSubitemId(firstItem.diretriz_id);
                }
            }
            
            setSelectedItemIds(initialIds);
            setSearchTerm("");
        }
    }, [open, initialSelections]);
    
    // Filtra as diretrizes (Subitens) e seus itens com base no termo de busca
    const filteredDiretrizes = useMemo(() => {
        if (!diretrizes) return [];
        
        if (!searchTerm) {
            return diretrizes;
        }
        
        const lowerCaseSearch = searchTerm.toLowerCase();
        
        return diretrizes.filter(d => {
            // 1. Busca no Subitem (Nr, Nome, Descrição)
            const subitemMatch = 
                d.nr_subitem.toLowerCase().includes(lowerCaseSearch) ||
                d.nome_subitem.toLowerCase().includes(lowerCaseSearch) ||
                d.descricao_subitem?.toLowerCase().includes(lowerCaseSearch);
                
            if (subitemMatch) return true;
            
            // 2. Busca nos Itens de Aquisição
            const itemMatch = d.itens_aquisicao.some(item => 
                item.codigo_catmat.toLowerCase().includes(lowerCaseSearch) ||
                item.descricao_item.toLowerCase().includes(lowerCaseSearch) ||
                item.numero_pregao.toLowerCase().includes(lowerCaseSearch) ||
                item.om_nome.toLowerCase().includes(lowerCaseSearch)
            );
            
            return itemMatch;
        });
    }, [diretrizes, searchTerm]);
    
    // Calcula o total de itens selecionados
    const totalSelectedItems = useMemo(() => {
        return Object.values(selectedItemIds).filter(isTrue => isTrue).length;
    }, [selectedItemIds]);
    
    // --- Handlers de Ação ---
    
    const handleItemToggle = (itemId: string, isChecked: boolean) => {
        setSelectedItemIds(prev => ({
            ...prev,
            [itemId]: isChecked,
        }));
    };
    
    const handleConfirmSelection = () => {
        if (!diretrizes || diretrizes.length === 0) {
            toast.error("Nenhuma diretriz de Subitem disponível.");
            return;
        }
        
        const finalSelection: ItemAquisicao[] = [];
        let selectedDiretriz: SubitemSelection | null = null;
        
        // Itera sobre todas as diretrizes para encontrar os itens selecionados
        for (const diretriz of diretrizes) {
            const selectedItemsInDiretriz = diretriz.itens_aquisicao.filter(item => selectedItemIds[item.id]);
            
            if (selectedItemsInDiretriz.length > 0) {
                // Se houver itens selecionados, eles devem pertencer ao MESMO Subitem.
                // Se o usuário selecionar itens de dois subitens diferentes, isso é um erro lógico
                // para o fluxo de Material de Consumo (que só permite 1 Subitem por registro).
                
                if (selectedDiretriz && selectedDiretriz.diretriz_id !== diretriz.id) {
                    toast.error("Erro: Você selecionou itens de mais de um Subitem da ND. Por favor, selecione itens de apenas um Subitem por vez.");
                    return;
                }
                
                selectedDiretriz = {
                    diretriz_id: diretriz.id,
                    nr_subitem: diretriz.nr_subitem,
                    nome_subitem: diretriz.nome_subitem,
                    itens_aquisicao: diretriz.itens_aquisicao,
                };
                
                finalSelection.push(...selectedItemsInDiretriz);
            }
        }
        
        if (finalSelection.length === 0) {
            toast.error("Selecione pelo menos um item de aquisição.");
            return;
        }
        
        if (!selectedDiretriz) {
             // Isso não deve acontecer se finalSelection.length > 0, mas é um fallback de segurança
             toast.error("Erro interno: Subitem de origem não identificado.");
             return;
        }
        
        // Passa a lista de ItemAquisicao e os dados do Subitem
        onSelect(finalSelection, selectedDiretriz);
        onOpenChange(false);
    };
    
    const handleToggleSubitem = (diretrizId: string) => {
        setOpenSubitemId(prev => prev === diretrizId ? null : diretrizId);
    };
    
    const handleSelectAllItemsInSubitem = (diretriz: DiretrizMaterialConsumo) => {
        const allItems = diretriz.itens_aquisicao;
        const allSelected = allItems.every(item => selectedItemIds[item.id]);
        
        setSelectedItemIds(prev => {
            const newSelections = { ...prev };
            allItems.forEach(item => {
                newSelections[item.id] = !allSelected;
            });
            return newSelections;
        });
        
        toast.info(allSelected ? "Itens desmarcados." : "Todos os itens marcados.");
    };
    
    // --- Renderização ---
    
    const isDataLoading = isLoadingDiretrizes;
    
    const renderSubitemList = () => (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por Subitem, CATMAT, Pregão ou Descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isDataLoading}
                    className="pl-10"
                />
            </div>
            
            {isDataLoading ? (
                <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando diretrizes...</p>
                </div>
            ) : filteredDiretrizes.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/50">
                    <AlertCircle className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                        Nenhum Subitem da ND encontrado para o ano {selectedYear} ou correspondente à busca.
                    </p>
                    <Button 
                        type="button" 
                        onClick={onAddSubitem}
                        variant="link" 
                        className="mt-1"
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Cadastrar Novo Subitem
                    </Button>
                </div>
            ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
                    {filteredDiretrizes.map(d => {
                        const isSelected = d.itens_aquisicao.some(item => selectedItemIds[item.id]);
                        const isSubitemOpen = openSubitemId === d.id;
                        
                        return (
                            <Collapsible 
                                key={d.id}
                                open={isSubitemOpen}
                                onOpenChange={() => handleToggleSubitem(d.id)}
                                className="border rounded-lg transition-all duration-300"
                            >
                                <CollapsibleTrigger asChild>
                                    <div 
                                        className={cn(
                                            "p-3 flex justify-between items-center cursor-pointer transition-colors w-full",
                                            isSubitemOpen 
                                                ? "bg-primary/10 border-primary/50" 
                                                : "hover:bg-muted/50",
                                            isSelected && !isSubitemOpen && "bg-green-50/50 border-green-200"
                                        )}
                                    >
                                        <div className="flex flex-col text-left">
                                            <p className="font-semibold text-base">
                                                {d.nr_subitem} - {d.nome_subitem}
                                            </p>
                                            {/* Descrição detalhada removida */}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm text-muted-foreground">
                                                {d.itens_aquisicao.filter(item => selectedItemIds[item.id]).length} / {d.itens_aquisicao.length} selecionados
                                            </span>
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isSubitemOpen && "rotate-180")} />
                                        </div>
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="border-t bg-background/80">
                                    <div className="p-3">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px] text-center">
                                                        <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleSelectAllItemsInSubitem(d)}
                                                            className="h-8 w-8"
                                                        >
                                                            <ListChecks className="h-4 w-4" />
                                                        </Button>
                                                    </TableHead>
                                                    <TableHead>Item de Aquisição</TableHead>
                                                    <TableHead className="text-right">Valor Unitário</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {d.itens_aquisicao.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                            Nenhum item de aquisição cadastrado nesta diretriz.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    d.itens_aquisicao.map(item => {
                                                        const isItemSelected = selectedItemIds[item.id] || false;
                                                        
                                                        return (
                                                            <TableRow key={item.id} className={cn(isItemSelected && "bg-green-50/50")}>
                                                                <TableCell className="w-[50px] text-center">
                                                                    <Checkbox
                                                                        checked={isItemSelected}
                                                                        onCheckedChange={(checked) => handleItemToggle(item.id, !!checked)}
                                                                        disabled={isDataLoading}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    {/* Usando nome_reduzido com fallback para descrição completa */}
                                                                    <p className="font-medium">{item.nome_reduzido || item.descricao_item}</p>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {/* Adicionado UASG no final do Pregão */}
                                                                        CATMAT: {item.codigo_catmat} | Pregão: {item.numero_pregao} ({formatCodug(item.uasg)})
                                                                    </p>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <p className="font-medium text-sm">
                                                                        {formatCurrency(item.valor_unitario)}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        / {item.unidade_medida}
                                                                    </p>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-6 w-6 text-primary" />
                        Selecionar Subitem e Itens de Aquisição
                    </DialogTitle>
                </DialogHeader>
                
                <div className="py-4">
                    {renderSubitemList()}
                </div>
                
                <DialogFooter>
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        disabled={isDataLoading}
                    >
                        Cancelar
                    </Button>
                    
                    <Button 
                        type="button" 
                        onClick={handleConfirmSelection}
                        disabled={isDataLoading || totalSelectedItems === 0}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Seleção ({totalSelectedItems})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoSubitemSelectorDialog;