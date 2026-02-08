import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Plus, Trash2, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { AcquisitionGroup, SelectedItemAquisicao, calculateItemTotals, calculateLoteTotals } from "@/lib/materialConsumoUtils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import MaterialConsumoSubitemSelectorDialog from "@/components/MaterialConsumoSubitemSelectorDialog";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

// Tipo de dados para o retorno do seletor de subitens (agora permite múltiplos subitens)
interface SelectedItemAquisicaoAugmented extends SelectedItemAquisicao {
    // Já herda todos os campos necessários
}

interface AcquisitionGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialGroup?: AcquisitionGroup;
    onSave: (group: AcquisitionGroup) => void;
    selectedYear: number;
    onAddSubitem: () => void;
}

const initialGroupState: AcquisitionGroup = {
    id: crypto.randomUUID(),
    nome: "",
    finalidade: "",
    itens: [],
};

const AcquisitionGroupDialog: React.FC<AcquisitionGroupDialogProps> = ({
    open,
    onOpenChange,
    initialGroup,
    onSave,
    selectedYear,
    onAddSubitem,
}) => {
    const [groupData, setGroupData] = useState<AcquisitionGroup>(initialGroupState);
    const [showSubitemSelector, setShowSubitemSelector] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setGroupData(initialGroup || initialGroupState);
        }
    }, [open, initialGroup]);

    // Agrupa os itens selecionados por Subitem para exibição
    const groupedItems = useMemo(() => {
        return groupData.itens.reduce((acc, item) => {
            const key = item.diretriz_id;
            if (!acc[key]) {
                acc[key] = {
                    diretriz_id: item.diretriz_id,
                    nr_subitem: item.nr_subitem,
                    nome_subitem: item.nome_subitem,
                    items: [],
                    totalSubitem: 0,
                };
            }
            const totals = calculateItemTotals(item);
            acc[key].items.push(item);
            acc[key].totalSubitem += totals.totalGeral;
            return acc;
        }, {} as Record<string, {
            diretriz_id: string;
            nr_subitem: string;
            nome_subitem: string;
            items: SelectedItemAquisicao[];
            totalSubitem: number;
        }>);
    }, [groupData.itens]);
    
    const totalGroupValue = useMemo(() => {
        return calculateLoteTotals(groupData.itens).totalGeral;
    }, [groupData.itens]);

    // --- Handlers ---

    const handleItemQuantityChange = (itemId: string, quantity: number) => {
        if (quantity < 0) return;
        
        setGroupData(prev => {
            const newSelections = prev.itens.map(item => 
                item.id === itemId ? { ...item, quantidade_solicitada: quantity } : item
            );
            
            return {
                ...prev,
                itens: newSelections,
            };
        });
    };
    
    const handleRemoveItem = (itemId: string) => {
        setGroupData(prev => ({
            ...prev,
            itens: prev.itens.filter(item => item.id !== itemId),
        }));
        toast.info("Item removido do grupo.");
    };

    const handleSubitemSelected = (selectedItems: SelectedItemAquisicaoAugmented[]) => {
        // 1. Mapeia os itens selecionados para o formato AcquisitionGroup.itens
        // Preserva a quantidade de itens que já estavam no grupo
        const existingItemMap = new Map(groupData.itens.map(item => [item.id, item]));
        
        const newItems: SelectedItemAquisicao[] = selectedItems.map(item => {
            const existing = existingItemMap.get(item.id);
            return {
                ...item,
                quantidade_solicitada: existing ? existing.quantidade_solicitada : 1, // Preserva ou inicializa
            };
        });
        
        setGroupData(prev => ({
            ...prev,
            itens: newItems,
        }));
        
        toast.success(`${newItems.length} itens importados para o grupo.`);
    };

    const handleSaveGroup = () => {
        if (!groupData.nome.trim()) {
            toast.error("O nome do Grupo de Aquisição é obrigatório.");
            return;
        }
        if (groupData.itens.length === 0) {
            toast.error("O grupo deve conter pelo menos um item de aquisição.");
            return;
        }
        
        // Validação de quantidade > 0
        const hasValidQuantity = groupData.itens.some(item => item.quantidade_solicitada > 0);
        if (!hasValidQuantity) {
            toast.error("Pelo menos um item deve ter quantidade solicitada maior que zero.");
            return;
        }
        
        setIsSaving(true);
        onSave(groupData);
        // O componente pai deve fechar o diálogo após o save
        // onOpenChange(false); 
        setIsSaving(false);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-6 w-6 text-primary" />
                            {initialGroup ? "Editar Grupo de Aquisição" : "Novo Grupo de Aquisição"}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        {/* Detalhes do Grupo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="group-name">Nome do Grupo *</Label>
                                <Input
                                    id="group-name"
                                    placeholder="Ex: Material de Escritório - QG"
                                    value={groupData.nome}
                                    onChange={(e) => setGroupData(prev => ({ ...prev, nome: e.target.value }))}
                                    disabled={isSaving}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="group-finalidade">Finalidade (Opcional)</Label>
                                <Input
                                    id="group-finalidade"
                                    placeholder="Ex: Apoio à Seção de Logística"
                                    value={groupData.finalidade}
                                    onChange={(e) => setGroupData(prev => ({ ...prev, finalidade: e.target.value }))}
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                        
                        {/* Seleção de Itens */}
                        <div className="space-y-4 border p-4 rounded-lg bg-muted/50">
                            <h4 className="font-semibold text-base flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Itens de Aquisição ({groupData.itens.length})
                            </h4>
                            
                            <Button 
                                type="button" 
                                onClick={() => setShowSubitemSelector(true)}
                                disabled={isSaving}
                                variant="secondary"
                                className="w-full"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Importar/Alterar Itens de Subitens da ND
                            </Button>
                            
                            {/* Tabela de Itens Selecionados */}
                            {groupData.itens.length > 0 && (
                                <div className="mt-4 border p-3 rounded-md space-y-4">
                                    {Object.values(groupedItems).map(subitemGroup => (
                                        <div key={subitemGroup.diretriz_id} className="space-y-2">
                                            <div className="flex justify-between items-center bg-primary/10 p-2 rounded-md">
                                                <span className="font-semibold text-sm text-primary">
                                                    {subitemGroup.nr_subitem} - {subitemGroup.nome_subitem}
                                                </span>
                                                <span className="font-bold text-sm text-primary">
                                                    {formatCurrency(subitemGroup.totalSubitem)}
                                                </span>
                                            </div>
                                            
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                                        <TableHead>Item de Aquisição</TableHead>
                                                        <TableHead className="text-right">Valor Unitário</TableHead>
                                                        <TableHead className="text-right">Total Item</TableHead>
                                                        <TableHead className="w-[50px] text-center">Ação</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {subitemGroup.items.map((item) => {
                                                        const totals = calculateItemTotals(item);
                                                        
                                                        return (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="w-[100px]">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <Input
                                                                            type="number"
                                                                            min={0} 
                                                                            placeholder="1"
                                                                            value={item.quantidade_solicitada === 0 ? "" : item.quantidade_solicitada}
                                                                            onChange={(e) => handleItemQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                                                            onWheel={(e) => e.currentTarget.blur()} 
                                                                            className="w-20 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            disabled={isSaving}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.descricao_reduzida || item.descricao_item}
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        CATMAT: {item.codigo_catmat} | GND: {item.gnd}
                                                                    </p>
                                                                </TableCell>
                                                                <TableCell className="text-right text-sm">
                                                                    {formatCurrency(item.valor_unitario)} {item.unidade_medida}
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-sm">
                                                                    {formatCurrency(totals.totalGeral)}
                                                                </TableCell>
                                                                <TableCell className="w-[50px] text-center">
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleRemoveItem(item.id)} 
                                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                        disabled={isSaving}
                                                                    >
                                                                        <Minus className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                    
                                    <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                        <span className="font-bold text-sm">VALOR TOTAL DO GRUPO:</span>
                                        <span className={cn("font-extrabold text-lg text-primary")}>
                                            {formatCurrency(totalGroupValue)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => onOpenChange(false)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        
                        <Button 
                            type="button" 
                            onClick={handleSaveGroup}
                            disabled={isSaving || groupData.itens.length === 0 || !groupData.nome.trim()}
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Salvar Grupo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Diálogo de Seleção de Subitem (usado internamente) */}
            <MaterialConsumoSubitemSelectorDialog
                open={showSubitemSelector}
                onOpenChange={setShowSubitemSelector}
                selectedYear={selectedYear}
                // Passa os itens atuais para preservar a seleção e quantidade
                initialSelections={groupData.itens} 
                onSelect={handleSubitemSelected}
                onAddSubitem={onAddSubitem}
            />
        </>
    );
};

export default AcquisitionGroupDialog;