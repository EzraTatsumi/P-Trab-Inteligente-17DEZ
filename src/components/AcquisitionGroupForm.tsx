import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Package, Check, X, Minus, Search } from "lucide-react";
import { AcquisitionGroup, calculateGroupTotals } from "@/lib/materialConsumoUtils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { toast } from "sonner";
import { isGhostMode } from "@/lib/ghostStore";

interface AcquisitionGroupFormProps {
    initialGroup?: AcquisitionGroup;
    onSave: (group: AcquisitionGroup) => void;
    onCancel: () => void;
    isSaving: boolean;
    // Callback para abrir o seletor de itens externo
    onOpenItemSelector: (currentItems: ItemAquisicao[]) => void;
    // Itens que retornaram do seletor externo
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
    const [groupName, setGroupName] = useState(initialGroup?.groupName || "");
    const [groupPurpose, setGroupPurpose] = useState(initialGroup?.groupPurpose || "");
    const [items, setItems] = useState<ItemAquisicao[]>(initialGroup?.items || []);
    
    // Sincroniza itens vindos do seletor externo
    useEffect(() => {
        if (selectedItemsFromSelector) {
            // Mescla os itens selecionados com os já existentes, preservando quantidades se o item já existia
            const newItems = selectedItemsFromSelector.map(selectedItem => {
                const existingItem = items.find(i => i.id === selectedItem.id);
                return {
                    ...selectedItem,
                    quantidade: existingItem ? existingItem.quantidade : 1,
                    valor_total: (existingItem ? existingItem.quantidade : 1) * selectedItem.valor_unitario,
                };
            });
            setItems(newItems);
            onClearSelectedItems(); // Limpa o buffer do seletor
        }
    }, [selectedItemsFromSelector, items, onClearSelectedItems]);

    const handleUpdateQuantity = (id: string, quantity: number) => {
        if (quantity < 1) return;
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    quantidade: quantity,
                    valor_total: quantity * item.valor_unitario,
                };
            }
            return item;
        }));
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupName.trim()) {
            toast.error("O nome do grupo é obrigatório.");
            return;
        }
        if (items.length === 0) {
            toast.error("Adicione pelo menos um item ao grupo.");
            return;
        }

        const { totalValue, totalND30, totalND39 } = calculateGroupTotals(items);

        onSave({
            tempId: initialGroup?.tempId || crypto.randomUUID(),
            groupName,
            groupPurpose: groupPurpose.trim() || null,
            items,
            totalValue,
            totalND30,
            totalND39,
        });
    };

    const { totalValue } = calculateGroupTotals(items);

    return (
        <Card className="border-2 border-primary/20 bg-primary/5 mb-6">
            <CardHeader className="py-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    {initialGroup ? "Editar Grupo de Aquisição" : "Novo Grupo de Aquisição"}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="groupName">Nome do Grupo *</Label>
                        <Input
                            id="groupName"
                            placeholder="Ex: Material de Construção"
                            value={groupName}
                            onChange={(e) => {
                                setGroupName(e.target.value);
                                if (isGhostMode() && e.target.value.toLowerCase().includes('material de construção')) {
                                    window.dispatchEvent(new CustomEvent('tour:avancar'));
                                }
                            }}
                            className="bg-background tour-nome-grupo"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="groupPurpose">Finalidade (Opcional)</Label>
                        <Input
                            id="groupPurpose"
                            placeholder="Ex: Manutenção do Pavilhão de Comando"
                            value={groupPurpose}
                            onChange={(e) => setGroupPurpose(e.target.value)}
                            className="bg-background"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-sm font-semibold">Itens do Grupo ({items.length})</Label>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => onOpenItemSelector(items)}
                            className="bg-background tour-btn-importar-itens"
                        >
                            <Search className="mr-2 h-4 w-4" />
                            Importar/Alterar Itens de Subitens da ND
                        </Button>
                    </div>

                    <div className="border rounded-md bg-background overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px] text-center">Qtd</TableHead>
                                    <TableHead>Descrição do Item</TableHead>
                                    <TableHead className="text-right w-[120px]">Vlr Unitário</TableHead>
                                    <TableHead className="text-right w-[120px]">Total</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                            Nenhum item selecionado. Clique em "Importar Itens" para começar.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="p-2">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={item.quantidade}
                                                    onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                    className="h-8 text-center px-1"
                                                />
                                            </TableCell>
                                            <TableCell className="text-xs py-2">
                                                <p className="font-medium">{item.descricao_reduzida || item.descricao_item}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-right text-xs">
                                                {formatCurrency(item.valor_unitario)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-bold">
                                                {formatCurrency(item.valor_total)}
                                            </TableCell>
                                            <TableCell className="text-center p-1">
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-background border rounded-md">
                    <span className="font-bold text-sm">TOTAL DO GRUPO:</span>
                    <span className="font-extrabold text-lg text-primary">{formatCurrency(totalValue)}</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleSubmit} 
                        disabled={isSaving || items.length === 0 || !groupName.trim()}
                        className="tour-btn-salvar-grupo"
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Salvar Grupo no Formulário
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default AcquisitionGroupForm;