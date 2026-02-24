"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Import, Calculator, Package, Info } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import MaterialConsumoItemSelectorDialog from './MaterialConsumoItemSelectorDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaterialConsumoGroup {
    id: string;
    nome: string;
    finalidade?: string;
    itens: Array<ItemAquisicao & { quantidade: number; valor_total: number }>;
}

interface MaterialConsumoGroupFormProps {
    onSave: (group: MaterialConsumoGroup) => void;
    onCancel: () => void;
    selectedYear: number;
    initialData?: MaterialConsumoGroup | null;
}

const MaterialConsumoGroupForm: React.FC<MaterialConsumoGroupFormProps> = ({
    onSave,
    onCancel,
    selectedYear,
    initialData
}) => {
    const [groupName, setGroupName] = useState(initialData?.nome || "");
    const [groupPurpose, setGroupPurpose] = useState(initialData?.finalidade || "");
    const [selectedItens, setSelectedItens] = useState<Array<ItemAquisicao & { quantidade: number; valor_total: number }>>(initialData?.itens || []);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Função para o Tour preencher o nome
    useEffect(() => {
        (window as any).prefillGroupName = () => setGroupName("Material de Construção");
        return () => delete (window as any).prefillGroupName;
    }, []);

    const handleSelectItem = (item: ItemAquisicao) => {
        const alreadyExists = selectedItens.find(i => i.id === item.id);
        if (alreadyExists) {
            toast.warning("Este item já foi adicionado ao grupo.");
            return;
        }

        setSelectedItens(prev => [...prev, {
            ...item,
            quantidade: 1,
            valor_total: item.valor_unitario
        }]);
    };

    const handleUpdateQuantity = (id: string, qty: number) => {
        if (qty < 0) return;
        setSelectedItens(prev => prev.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    quantidade: qty,
                    valor_total: qty * item.valor_unitario
                };
            }
            return item;
        }));
    };

    const handleRemoveItem = (id: string) => {
        setSelectedItens(prev => prev.filter(i => i.id !== id));
    };

    const handleSave = () => {
        if (!groupName.trim()) {
            toast.error("O nome do grupo é obrigatório.");
            return;
        }
        if (selectedItens.length === 0) {
            toast.error("Adicione pelo menos um item ao grupo.");
            return;
        }

        onSave({
            id: initialData?.id || Math.random().toString(36).substring(2, 9),
            nome: groupName,
            finalidade: groupPurpose,
            itens: selectedItens
        });
    };

    const totalGroup = selectedItens.reduce((acc, curr) => acc + curr.valor_total, 0);

    return (
        <Card className="border-primary/20 shadow-md tour-group-form-card">
            <CardHeader className="bg-primary/5 pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        {initialData ? "Editar Grupo" : "Configurar Grupo de Aquisição"}
                    </CardTitle>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total do Grupo</p>
                        <p className="text-xl font-black text-primary">{formatCurrency(totalGroup)}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="group-name">Nome do Grupo / Lote *</Label>
                        <Input 
                            id="group-name"
                            placeholder="Ex: Material de Construção, Kits de Higiene..."
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group-purpose">Finalidade Específica (Opcional)</Label>
                        <Input 
                            id="group-purpose"
                            placeholder="Ex: Manutenção do aquartelamento..."
                            value={groupPurpose}
                            onChange={(e) => setGroupPurpose(e.target.value)}
                        />
                    </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Itens no Grupo
                        </h4>
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)}>
                            <Import className="h-4 w-4 mr-2" />
                            Importar/Alterar Itens
                        </Button>
                    </div>

                    {selectedItens.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                            <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p>Nenhum item selecionado. Clique em Importar para começar.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead className="text-center w-[120px]">Qtd.</TableHead>
                                        <TableHead className="text-right">Unitário</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItens.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium">{item.descricao_item}</span>
                                                    <span className="text-[10px] text-muted-foreground">CATMAT: {item.codigo_catmat} | Pregão: {item.numero_pregao}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input 
                                                    type="number"
                                                    className="h-8 text-center tour-item-quantity-input"
                                                    value={item.quantidade}
                                                    onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right text-xs">{formatCurrency(item.valor_unitario)}</TableCell>
                                            <TableCell className="text-right font-bold text-xs">{formatCurrency(item.valor_total)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={handleSave} className="bg-primary text-primary-foreground">Salvar Grupo</Button>
                </div>
            </CardContent>

            <MaterialConsumoItemSelectorDialog 
                open={isSelectorOpen}
                onOpenChange={setIsSelectorOpen}
                selectedYear={selectedYear}
                onSelect={handleSelectItem}
                selectedItemIds={selectedItens.map(i => i.id)}
            />
        </Card>
    );
};

export default MaterialConsumoGroupForm;