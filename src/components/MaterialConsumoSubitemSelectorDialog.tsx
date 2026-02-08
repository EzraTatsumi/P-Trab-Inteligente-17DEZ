import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Search, Check, Plus, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug, formatNumber } from "@/lib/formatUtils";
import { SelectedItemAquisicao } from "@/lib/materialConsumoUtils";
import { cn } from "@/lib/utils";

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
    onSelect: (selectedItems: SelectedItemAquisicao[], diretriz: SubitemSelection) => void;
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
    const [selectedSubitem, setSelectedSubitem] = useState<SubitemSelection | null>(null);
    
    // Estado dos itens de aquisição com a quantidade solicitada
    const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
    
    // Ref para o container de resultados para rolagem
    const resultsRef = useRef<HTMLDivElement>(null);

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
            
            // Mapear o tipo JSONB para ItemAquisicao[]
            return (data || []).map(d => ({
                ...d,
                itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicao[]) || [],
            })) as DiretrizMaterialConsumo[];
        },
        enabled: !!userId && selectedYear > 0,
        initialData: [],
    });
    
    // --- Efeitos e Handlers de Estado ---
    
    // Efeito para inicializar as quantidades ao abrir o diálogo ou mudar a seleção inicial
    useEffect(() => {
        if (open) {
            // 1. Inicializa as quantidades a partir das seleções iniciais
            const initialQuants: Record<string, number> = {};
            let initialDiretriz: SubitemSelection | null = null;
            
            if (initialSelections.length > 0) {
                initialSelections.forEach(item => {
                    initialQuants[item.id] = item.quantidade_solicitada;
                });
                
                // 2. Tenta encontrar a diretriz correspondente
                const firstItem = initialSelections[0];
                const foundDiretriz = diretrizes.find(d => d.id === firstItem.diretriz_id);
                
                if (foundDiretriz) {
                    initialDiretriz = {
                        diretriz_id: foundDiretriz.id,
                        nr_subitem: foundDiretriz.nr_subitem,
                        nome_subitem: foundDiretriz.nome_subitem,
                        itens_aquisicao: foundDiretriz.itens_aquisicao,
                    };
                }
            }
            
            setItemQuantities(initialQuants);
            setSelectedSubitem(initialDiretriz);
            setSearchTerm("");
        }
    }, [open, initialSelections, diretrizes]);
    
    // Filtra as diretrizes (Subitens) com base no termo de busca
    const filteredDiretrizes = useMemo(() => {
        if (!searchTerm) {
            return diretrizes;
        }
        const lowerCaseSearch = searchTerm.toLowerCase();
        return diretrizes.filter(d => 
            d.nr_subitem.toLowerCase().includes(lowerCaseSearch) ||
            d.nome_subitem.toLowerCase().includes(lowerCaseSearch) ||
            d.descricao_subitem?.toLowerCase().includes(lowerCaseSearch)
        );
    }, [diretrizes, searchTerm]);
    
    // Filtra os itens de aquisição dentro do subitem selecionado
    const filteredAcquisitionItems = useMemo(() => {
        if (!selectedSubitem) return [];
        
        const items = selectedSubitem.itens_aquisicao;
        if (!searchTerm) return items;
        
        const lowerCaseSearch = searchTerm.toLowerCase();
        return items.filter(item => 
            item.codigo_catmat.toLowerCase().includes(lowerCaseSearch) ||
            item.descricao_item.toLowerCase().includes(lowerCaseSearch) ||
            item.numero_pregao.toLowerCase().includes(lowerCaseSearch) ||
            item.om_nome.toLowerCase().includes(lowerCaseSearch)
        );
    }, [selectedSubitem, searchTerm]);
    
    // Calcula o total de itens selecionados (com quantidade > 0)
    const totalSelectedItems = useMemo(() => {
        return Object.values(itemQuantities).filter(q => q > 0).length;
    }, [itemQuantities]);
    
    // --- Handlers de Ação ---
    
    const handleSubitemSelect = (diretriz: DiretrizMaterialConsumo) => {
        // Se o subitem for o mesmo, apenas alterna a visualização
        if (selectedSubitem?.diretriz_id === diretriz.id) {
            setSelectedSubitem(null);
            setItemQuantities({}); // Limpa as quantidades ao deselecionar
            return;
        }
        
        // 1. Define o novo subitem
        const newSubitem: SubitemSelection = {
            diretriz_id: diretriz.id,
            nr_subitem: diretriz.nr_subitem,
            nome_subitem: diretriz.nome_subitem,
            itens_aquisicao: diretriz.itens_aquisicao,
        };
        setSelectedSubitem(newSubitem);
        
        // 2. Limpa a busca e as quantidades
        setSearchTerm("");
        setItemQuantities({});
        
        // 3. Rola para o topo da lista de itens
        setTimeout(() => {
            resultsRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    };
    
    const handleQuantityChange = (itemId: string, quantity: number) => {
        // Garante que a quantidade não seja negativa
        if (quantity < 0) return;
        
        setItemQuantities(prev => ({
            ...prev,
            [itemId]: quantity,
        }));
    };
    
    const handleConfirmSelection = () => {
        if (!selectedSubitem) {
            toast.error("Selecione um Subitem da ND primeiro.");
            return;
        }
        
        const finalSelection: SelectedItemAquisicao[] = [];
        
        // Mapeia os itens de aquisição do subitem selecionado
        selectedSubitem.itens_aquisicao.forEach(item => {
            const quantity = itemQuantities[item.id] || 0;
            
            if (quantity > 0) {
                finalSelection.push({
                    ...item,
                    quantidade_solicitada: quantity,
                    diretriz_id: selectedSubitem.diretriz_id, // Adiciona o ID da diretriz para rastreamento
                });
            }
        });
        
        if (finalSelection.length === 0) {
            toast.error("Selecione pelo menos um item de aquisição com quantidade maior que zero.");
            return;
        }
        
        onSelect(finalSelection, selectedSubitem);
        onOpenChange(false);
    };
    
    const handleClearAll = () => {
        setItemQuantities({});
        toast.info("Quantidades zeradas.");
    };
    
    // --- Renderização ---
    
    const isSubitemSelected = !!selectedSubitem;
    const isDataLoading = isLoadingDiretrizes;
    
    const renderSubitemSelection = () => (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por Nr Subitem ou Nome..."
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
                        Nenhum Subitem da ND encontrado para o ano {selectedYear}.
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
                <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2" ref={resultsRef}>
                    {filteredDiretrizes.map(d => (
                        <div 
                            key={d.id}
                            onClick={() => handleSubitemSelect(d)}
                            className={cn(
                                "p-3 border rounded-lg cursor-pointer transition-colors",
                                selectedSubitem?.diretriz_id === d.id 
                                    ? "bg-primary/10 border-primary ring-2 ring-primary/50" 
                                    : "hover:bg-muted/50"
                            )}
                        >
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-base">
                                    {d.nr_subitem} - {d.nome_subitem}
                                </p>
                                {selectedSubitem?.diretriz_id === d.id ? (
                                    <Check className="h-5 w-5 text-primary" />
                                ) : (
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                {d.descricao_subitem || "Sem descrição detalhada."}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {d.itens_aquisicao.length} itens de aquisição cadastrados.
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
    
    const renderAcquisitionItemSelection = () => (
        <div className="space-y-4">
            <div className="p-3 border rounded-lg bg-primary/10 border-primary/50">
                <h4 className="font-bold text-base text-primary">
                    Subitem Selecionado: {selectedSubitem?.nr_subitem} - {selectedSubitem?.nome_subitem}
                </h4>
                <p className="text-xs text-muted-foreground">
                    Selecione a quantidade desejada para cada item de aquisição.
                </p>
            </div>
            
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Filtrar por CATMAT, Pregão ou Descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isDataLoading}
                    className="pl-10"
                />
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto pr-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px] text-center">Qtd</TableHead>
                            <TableHead>Item de Aquisição</TableHead>
                            <TableHead className="text-right">Valor Unitário</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAcquisitionItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                    Nenhum item encontrado com o filtro.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAcquisitionItems.map(item => {
                                const currentQuantity = itemQuantities[item.id] || 0;
                                
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="w-[100px]">
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={currentQuantity === 0 ? "" : currentQuantity}
                                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                className="w-20 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                disabled={isDataLoading}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-medium">{item.descricao_item}</p>
                                            <p className="text-xs text-muted-foreground">
                                                CATMAT: {item.codigo_catmat} | Pregão: {item.numero_pregao}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                UASG: {formatCodug(item.uasg)} | GND: {item.gnd}
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
            
            <div className="flex justify-between items-center pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClearAll} disabled={isDataLoading}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Zerar Quantidades
                </Button>
                <p className="font-semibold">
                    Itens Selecionados: <span className="text-primary">{totalSelectedItems}</span>
                </p>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-6 w-6 text-primary" />
                        {isSubitemSelected ? "2. Selecionar Itens de Aquisição" : "1. Selecionar Subitem da ND"}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="py-4">
                    {isSubitemSelected ? renderAcquisitionItemSelection() : renderSubitemSelection()}
                </div>
                
                <DialogFooter>
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                            if (isSubitemSelected) {
                                // Volta para a seleção de subitem
                                setSelectedSubitem(null);
                                setItemQuantities({});
                                setSearchTerm("");
                            } else {
                                onOpenChange(false);
                            }
                        }}
                        disabled={isDataLoading}
                    >
                        {isSubitemSelected ? (
                            <>
                                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                                Voltar
                            </>
                        ) : "Cancelar"}
                    </Button>
                    
                    {isSubitemSelected && (
                        <Button 
                            type="button" 
                            onClick={handleConfirmSelection}
                            disabled={isDataLoading || totalSelectedItems === 0}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Confirmar Seleção ({totalSelectedItems})
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoSubitemSelectorDialog;