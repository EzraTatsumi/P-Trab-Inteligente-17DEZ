import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Save, Package, FileText, Loader2, Trash2, Pencil } from "lucide-react";
import { AcquisitionGroup } from "@/lib/materialConsumoUtils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatNumber, formatCodug, formatPregao } from "@/lib/formatUtils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isGhostMode, getActiveMission } from "@/lib/ghostStore";

// Tipo para agrupar itens por subitem para exibição
interface GroupedItem {
    subitemNr: string;
    subitemNome: string;
    items: ItemAquisicao[];
    totalValue: number; 
}

interface AcquisitionGroupFormProps {
    initialGroup?: AcquisitionGroup;
    onSave: (group: AcquisitionGroup) => void;
    onCancel: () => void;
    isSaving: boolean;
    onOpenItemSelector: (currentItems: ItemAquisicao[]) => void; 
    selectedItemsFromSelector: ItemAquisicao[] | null;
    onClearSelectedItems: () => void;
}

const AcquisitionGroupForm: React.FC<AcquisitionGroupFormProps> = ({ 
    initialGroup, 
    onSave, 
    onCancel, 
    isSaving,
    onOpenItemSelector,
    selectedItemsFromSelector,
    onClearSelectedItems,
}) => {
    const [groupName, setGroupName] = useState(initialGroup?.groupName || '');
    const [groupPurpose, setGroupPurpose] = useState(initialGroup?.groupPurpose || '');
    const [items, setItems] = useState<ItemAquisicao[]>(initialGroup?.items || []);
    const [tempId] = useState(initialGroup?.tempId || crypto.randomUUID());
    
    const [expandedSubitems, setExpandedSubitems] = useState<Record<string, boolean>>({});

    // Expondo função para o tour preencher o nome do grupo
    useEffect(() => {
        (window as any).prefillGroupName = () => {
            setGroupName("Material de Construção");
        };
        return () => { delete (window as any).prefillGroupName; };
    }, []);

    useEffect(() => {
        if (selectedItemsFromSelector) {
            const existingItemIds = new Set(items.map(i => i.id));
            const newItemsMap: Record<string, ItemAquisicao> = {};
            
            selectedItemsFromSelector.forEach(selectedItem => {
                const existingItem = items.find(i => i.id === selectedItem.id);
                
                if (existingItem) {
                    newItemsMap[selectedItem.id] = existingItem;
                } else {
                    // Se estiver na Missão 3 (Cimento), define 5 unidades como diz o tutorial
                    const mission = getActiveMission();
                    const isMission3 = mission?.id === 3;
                    const quantity = isMission3 ? 5 : 1;
                    
                    const valorTotal = selectedItem.valor_unitario * quantity;
                    
                    newItemsMap[selectedItem.id] = {
                        ...selectedItem,
                        quantidade: quantity,
                        valor_total: valorTotal,
                    };
                }
            });
            
            setItems(Object.values(newItemsMap));
            onClearSelectedItems(); 
            setExpandedSubitems({}); 
            
            const addedCount = Object.values(newItemsMap).filter(item => !existingItemIds.has(item.id)).length;
            const removedCount = items.filter(item => !newItemsMap[item.id]).length;
            
            if (addedCount > 0 || removedCount > 0) {
                toast.success(`Seleção atualizada. Adicionados: ${addedCount}, Removidos: ${removedCount}.`);
                if (isGhostMode()) {
                    // Avança do passo 8 para o 9 após a seleção ser confirmada
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('tour:avancar'));
                    }, 300);
                }
            }
        }
    }, [selectedItemsFromSelector]); 

    const totalValue = useMemo(() => {
        return items.reduce((sum, item) => sum + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)), 0);
    }, [items]);
    
    const groupedItems = useMemo<GroupedItem[]>(() => {
        const groups: Record<string, GroupedItem> = {};
        
        items.forEach(item => {
            const key = `${item.nr_subitem}-${item.nome_subitem}`;
            if (!groups[key]) {
                groups[key] = {
                    subitemNr: item.nr_subitem,
                    subitemNome: item.nome_subitem,
                    items: [],
                    totalValue: 0, 
                };
            }
            groups[key].items.push(item);
            groups[key].totalValue += (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)); 
        });
        
        return Object.values(groups).sort((a, b) => a.subitemNr.localeCompare(b.subitemNr));
    }, [items]);
    
    const handleQuantityChange = (itemId: string, rawValue: string) => {
        const quantity = parseInt(rawValue) || 0;
        
        setItems(prevItems => {
            return prevItems.map(item => {
                if (item.id === itemId) {
                    const newQuantity = Math.max(0, quantity);
                    const newValorTotal = newQuantity * item.valor_unitario;
                    return {
                        ...item,
                        quantidade: newQuantity,
                        valor_total: newValorTotal,
                    };
                }
                return item;
            });
        });
    };
    
    const handleRemoveItem = (itemId: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
        toast.info("Item removido do grupo.");
    };

    const handleSaveGroupClick = () => {
        if (!groupName.trim()) {
            toast.error("O Nome do Grupo de Aquisição é obrigatório.");
            return;
        }
        if (items.length === 0) {
            toast.error("Adicione pelo menos um item de aquisição ao grupo.");
            return;
        }
        
        const hasZeroQuantity = items.some(item => item.quantidade === 0);
        if (hasZeroQuantity) {
            toast.error("A quantidade de todos os itens deve ser maior que zero.");
            return;
        }
        
        // Garante que os itens salvos tenham o valor_total correto
        const itemsToSave = items.map(item => ({
            ...item,
            valor_total: item.quantidade * item.valor_unitario
        }));
        
        onSave({
            tempId,
            groupName: groupName.trim(),
            groupPurpose: groupPurpose.trim() || null,
            items: itemsToSave,
            totalValue,
            totalND30: 0, 
            totalND39: 0, 
        } as AcquisitionGroup);
        
        setExpandedSubitems({});
        
        if (isGhostMode()) {
            // Avança para o final da missão após salvar o grupo
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('tour:avancar'));
            }, 300);
        }
    };
    
    const displayTitle = groupName.trim() || (initialGroup ? 'Editando Grupo' : 'Novo Grupo');

    return (
        <Card className="border border-gray-300 bg-gray-50 p-4 shadow-lg tour-group-form-card">
            <h4 className="font-bold text-lg mb-4">{displayTitle}</h4>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="groupName">Nome do Grupo *</Label>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Ex: Material de Expediente"
                            required
                            disabled={isSaving}
                            className="tour-group-name-input"
                        />
                        <p className="text-xs text-muted-foreground">
                            Coluna Despesas (P Trab Op): <br /> Material de Consumo ({groupName.trim() || 'Nome do Grupo'})
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="groupPurpose">Aquisição de Material de Consumo para atender</Label>
                        <Input
                            id="groupPurpose"
                            value={groupPurpose}
                            onChange={(e) => setGroupPurpose(e.target.value)}
                            placeholder="Ex: a montagem da Base Operacional"
                            disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">
                            *Cabeçalho personalizado para a Memória de Cálculo não automatizada.
                        </p>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="items">Itens de Aquisição ({items.length} itens)</Label>
                    <Card className="p-3 bg-background border">
                        
                        {groupedItems.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">
                                Nenhum item selecionado. Clique em "Importar/Alterar Itens" para adicionar.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {groupedItems.map(group => (
                                    <Collapsible 
                                        key={group.subitemNr} 
                                        open={expandedSubitems[group.subitemNr] ?? true}
                                        onOpenChange={(open) => setExpandedSubitems(prev => ({ ...prev, [group.subitemNr]: open }))}
                                    >
                                        <CollapsibleTrigger asChild>
                                            <div className="flex justify-between items-center p-2 bg-[#E2EEEE] border border-gray-300 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
                                                <span className="font-semibold text-sm">
                                                    {group.subitemNr} - {group.subitemNome} ({group.items.length} itens)
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-green-700">
                                                        {formatCurrency(group.totalValue)}
                                                    </span>
                                                    {expandedSubitems[group.subitemNr] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </div>
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[100px] text-center">Qtd *</TableHead>
                                                        <TableHead>Item de Aquisição</TableHead>
                                                        <TableHead className="text-center w-[120px]">Valor Unitário</TableHead>
                                                        <TableHead className="text-right w-[120px]">Total Item</TableHead>
                                                        <TableHead className="w-[50px] text-center">Ação</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.items.map((item, idx) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="w-[100px]">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={item.quantidade === 0 ? "" : item.quantidade}
                                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                    className={cn(
                                                                        "w-full text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                                                        idx === 0 && "tour-item-quantity-input"
                                                                    )}
                                                                    disabled={isSaving}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                <p className="font-medium">
                                                                    {item.descricao_reduzida || item.descricao_item}
                                                                </p>
                                                                <p className="text-muted-foreground text-[10px]">
                                                                    Cód. CATMAT: {item.codigo_catmat || 'N/A'}
                                                                </p>
                                                                <p className="text-muted-foreground text-[10px]">
                                                                    Pregão: {formatPregao(item.numero_pregao)} | UASG: {formatCodug(item.uasg) || 'N/A'}
                                                                </p>
                                                            </TableCell>
                                                            <TableCell className="text-center text-sm text-muted-foreground">
                                                                {formatCurrency(item.valor_unitario)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-sm font-medium">
                                                                {formatCurrency(item.quantidade * item.valor_unitario)}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Button 
                                                                    type="button" 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    onClick={() => handleRemoveItem(item.id)}
                                                                    disabled={isSaving}
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center pt-3 border-t mt-3">
                            <span className="font-bold">Total do Grupo:</span>
                            <span className="font-extrabold text-lg text-primary">
                                {formatCurrency(totalValue)}
                            </span>
                        </div>
                    </Card>
                </div>

                <div className="flex justify-between gap-3 pt-2">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={() => {
                            onOpenItemSelector(items);
                            if (isGhostMode()) {
                                window.dispatchEvent(new CustomEvent('tour:avancar'));
                            }
                        }}
                        disabled={isSaving}
                        className="flex-1 tour-import-items-btn"
                    >
                        <Package className="mr-2 h-4 w-4" />
                        Importar/Alterar Itens de Subitens da ND ({items.length} itens)
                    </Button>
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                    <Button 
                        type="button" 
                        onClick={handleSaveGroupClick} 
                        disabled={isSaving || !groupName.trim() || items.length === 0}
                        className="w-auto btn-salvar-grupo-tour" 
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Grupo
                    </Button>
                    
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onCancel}
                        disabled={isSaving}
                        className="w-auto"
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default AcquisitionGroupForm;