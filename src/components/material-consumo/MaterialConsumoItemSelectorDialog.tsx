import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Check, X, Package, AlertCircle, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaterialConsumoDiretrizes } from "@/hooks/useMaterialConsumoDiretrizes";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Tipo para o item de aquisição com estado de seleção e quantidade
interface SelectableItem extends ItemAquisicao {
    isSelected: boolean;
    currentQuantity: number;
}

interface MaterialConsumoItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    // Callback que retorna a diretriz selecionada e os itens com as quantidades
    onSelect: (diretriz: DiretrizMaterialConsumo, selectedItems: ItemAquisicao[]) => void;
    // Diretriz e itens iniciais para edição
    initialDiretrizId: string | null;
    initialItems: ItemAquisicao[];
    onAddDiretriz: () => void;
}

const MaterialConsumoItemSelectorDialog: React.FC<MaterialConsumoItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    onSelect,
    initialDiretrizId,
    initialItems,
    onAddDiretriz,
}) => {
    const { diretrizes, isLoading: isLoadingDiretrizes } = useMaterialConsumoDiretrizes(selectedYear);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDiretrizId, setSelectedDiretrizId] = useState<string | null>(null);
    const [selectableItems, setSelectableItems] = useState<SelectableItem[]>([]);
    
    const selectedDiretriz = useMemo(() => {
        return diretrizes.find(d => d.id === selectedDiretrizId);
    }, [diretrizes, selectedDiretrizId]);

    // Efeito para inicializar o estado quando o diálogo abre ou o ano muda
    useEffect(() => {
        if (open && initialDiretrizId) {
            setSelectedDiretrizId(initialDiretrizId);
        } else if (open && !initialDiretrizId) {
            // Se não houver inicialização, tenta selecionar a primeira diretriz
            if (diretrizes.length > 0) {
                setSelectedDiretrizId(diretrizes[0].id);
            } else {
                setSelectedDiretrizId(null);
            }
        }
    }, [open, initialDiretrizId, diretrizes]);
    
    // Efeito para popular os itens selecionáveis quando a diretriz muda
    useEffect(() => {
        if (selectedDiretriz) {
            const initialItemMap = new Map(initialItems.map(item => [item.id, item]));
            
            const newSelectableItems: SelectableItem[] = (selectedDiretriz.itens_aquisicao || []).map(item => {
                const initial = initialItemMap.get(item.id);
                
                return {
                    ...item,
                    isSelected: !!initial,
                    // Se estiver editando, usa a quantidade do item inicial, senão 1
                    currentQuantity: initial ? initial.quantidade : 1, 
                };
            });
            setSelectableItems(newSelectableItems);
        } else {
            setSelectableItems([]);
        }
    }, [selectedDiretriz, initialItems]);

    // Filtra os itens com base no termo de busca
    const filteredItems = useMemo(() => {
        if (!searchTerm) return selectableItems;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return selectableItems.filter(item => 
            item.descricao_item.toLowerCase().includes(lowerCaseSearch) ||
            item.codigo_catmat.includes(lowerCaseSearch)
        );
    }, [searchTerm, selectableItems]);

    // Calcula o total de itens selecionados
    const selectedItemsCount = useMemo(() => {
        return selectableItems.filter(item => item.isSelected).length;
    }, [selectableItems]);

    // Handlers
    const handleToggleSelect = (itemId: string) => {
        setSelectableItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, isSelected: !item.isSelected } : item
        ));
    };

    const handleQuantityChange = (itemId: string, quantity: number) => {
        if (quantity < 0) return;
        setSelectableItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, currentQuantity: quantity } : item
        ));
    };

    const handleConfirm = () => {
        if (!selectedDiretriz) {
            toast.error("Selecione um Subitem da ND.");
            return;
        }
        
        const finalSelectedItems: ItemAquisicao[] = selectableItems
            .filter(item => item.isSelected && item.currentQuantity > 0)
            .map(item => ({
                ...item,
                quantidade: item.currentQuantity, // Garante que a quantidade final é a editada
            }));
            
        if (finalSelectedItems.length === 0) {
            toast.error("Selecione pelo menos um item de aquisição com quantidade maior que zero.");
            return;
        }
        
        onSelect(selectedDiretriz, finalSelectedItems);
        onOpenChange(false);
    };
    
    const handleDiretrizChange = (diretrizId: string) => {
        // Se o usuário mudar a diretriz, limpamos a seleção atual
        setSelectedDiretrizId(diretrizId);
        setSelectableItems([]);
    };
    
    const handleAddDiretrizClick = () => {
        onOpenChange(false);
        onAddDiretriz();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Selecionar Itens de Material de Consumo ({selectedYear})
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-grow flex flex-col overflow-hidden">
                    
                    {/* SELEÇÃO DA DIRETRIZ (SUBITEM ND) */}
                    <div className="mb-4 border-b pb-4">
                        <Label htmlFor="diretriz-select">Subitem da ND (Diretriz) *</Label>
                        <div className="flex gap-2 mt-1">
                            <select
                                id="diretriz-select"
                                value={selectedDiretrizId || ""}
                                onChange={(e) => handleDiretrizChange(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isLoadingDiretrizes}
                            >
                                <option value="" disabled>Selecione um Subitem da ND...</option>
                                {isLoadingDiretrizes ? (
                                    <option disabled>Carregando diretrizes...</option>
                                ) : diretrizes.length === 0 ? (
                                    <option disabled>Nenhuma diretriz cadastrada para {selectedYear}</option>
                                ) : (
                                    diretrizes.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.nr_subitem} - {d.nome_subitem}
                                        </option>
                                    ))
                                )}
                            </select>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="icon" 
                                onClick={handleAddDiretrizClick}
                                title="Adicionar nova diretriz"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        {selectedDiretriz && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Descrição: {selectedDiretriz.descricao_subitem || 'N/A'}
                            </p>
                        )}
                        
                        {diretrizes.length === 0 && !isLoadingDiretrizes && (
                            <div className="mt-2 text-sm text-red-500 flex items-center">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Nenhuma diretriz encontrada. Cadastre em "Custos Operacionais".
                            </div>
                        )}
                    </div>
                    
                    {/* BUSCA E LISTA DE ITENS */}
                    {selectedDiretriz && (
                        <>
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por descrição ou CATMAT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            
                            <ScrollArea className="flex-grow h-full max-h-[40vh] border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[50px] text-center">Sel.</TableHead>
                                            <TableHead className="w-[100px] text-center">Qtd *</TableHead>
                                            <TableHead className="w-[100px]">CATMAT</TableHead>
                                            <TableHead>Descrição do Item</TableHead>
                                            <TableHead className="w-[80px]">ND</TableHead>
                                            <TableHead className="w-[120px] text-right">Valor Unitário</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                                    Nenhum item encontrado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredItems.map(item => (
                                                <TableRow 
                                                    key={item.id} 
                                                    className={cn(item.isSelected && "bg-primary/5 hover:bg-primary/10")}
                                                >
                                                    <TableCell className="text-center">
                                                        <Button 
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn("h-6 w-6", item.isSelected ? "text-green-600 hover:bg-green-100" : "text-gray-400 hover:bg-gray-100")}
                                                            onClick={() => handleToggleSelect(item.id)}
                                                        >
                                                            {item.isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={item.currentQuantity === 0 ? "" : item.currentQuantity}
                                                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                                            disabled={!item.isSelected}
                                                            className="w-full text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono">{item.codigo_catmat}</TableCell>
                                                    <TableCell className="text-sm">{item.descricao_item}</TableCell>
                                                    <TableCell className="text-xs font-semibold">{item.nd}</TableCell>
                                                    <TableCell className="text-right text-sm">{formatCurrency(item.valor_unitario)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <div className="flex justify-between items-center w-full">
                        <p className="text-sm text-muted-foreground">
                            {selectedItemsCount} item(ns) selecionado(s).
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                <X className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirm} disabled={selectedItemsCount === 0}>
                                <Check className="mr-2 h-4 w-4" />
                                Confirmar Seleção
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoItemSelectorDialog;