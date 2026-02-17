"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save, Package, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { VehicleGroup, calculateVehicleGroupTotals } from "@/lib/vehicleGroupUtils";
import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency, formatPregao } from "@/lib/formatUtils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface VehicleGroupFormProps {
    initialGroup?: VehicleGroup;
    onSave: (group: VehicleGroup) => void;
    onCancel: () => void;
    isSaving: boolean;
    onOpenItemSelector: (currentItems: ItemAquisicaoServico[]) => void;
    selectedItemsFromSelector: ItemAquisicaoServico[] | null;
    onClearSelectedItems: () => void;
}

const VehicleGroupForm: React.FC<VehicleGroupFormProps> = ({
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
    const [items, setItems] = useState<ItemAquisicaoServico[]>(initialGroup?.items || []);
    const [tempId] = useState(initialGroup?.tempId || crypto.randomUUID());
    const [expandedSubitems, setExpandedSubitems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (selectedItemsFromSelector) {
            const newItemsMap: Record<string, ItemAquisicaoServico> = {};
            
            selectedItemsFromSelector.forEach(selectedItem => {
                const existingItem = items.find(i => i.id === selectedItem.id);
                if (existingItem) {
                    newItemsMap[selectedItem.id] = existingItem;
                } else {
                    newItemsMap[selectedItem.id] = {
                        ...selectedItem,
                        quantidade: 1,
                        periodo: 1,
                        valor_total: selectedItem.valor_unitario,
                    } as any;
                }
            });
            
            setItems(Object.values(newItemsMap));
            onClearSelectedItems();
            setExpandedSubitems({}); 
        }
    }, [selectedItemsFromSelector, items, onClearSelectedItems]);

    const totals = useMemo(() => calculateVehicleGroupTotals(items), [items]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, { nr: string, nome: string, items: ItemAquisicaoServico[], total: number }> = {};
        items.forEach(item => {
            // Cast para any para acessar propriedades injetadas dinamicamente
            const itemAny = item as any;
            const nr = itemAny.nr_subitem || 'N/A';
            const nome = itemAny.nome_subitem || 'Sem Subitem';
            const key = `${nr}-${nome}`;
            
            if (!groups[key]) {
                groups[key] = { nr, nome, items: [], total: 0 };
            }
            groups[key].items.push(item);
            const period = itemAny.periodo || 0;
            groups[key].total += (item.quantidade || 0) * period * item.valor_unitario;
        });
        return Object.values(groups).sort((a, b) => a.nr.localeCompare(b.nr));
    }, [items]);

    const handleQuantityChange = (itemId: string, val: string) => {
        const qty = parseInt(val) || 0;
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, quantidade: qty } : item));
    };

    const handlePeriodChange = (itemId: string, val: string) => {
        const period = parseFloat(val.replace(',', '.')) || 0;
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, periodo: period } as any : item));
    };

    const handleSaveClick = () => {
        if (!groupName.trim()) {
            toast.error("O Nome do Grupo é obrigatório.");
            return;
        }
        if (items.length === 0) {
            toast.error("Adicione pelo menos um veículo ao grupo.");
            return;
        }
        
        onSave({
            tempId,
            groupName: groupName.trim(),
            groupPurpose: groupPurpose.trim() || null,
            items,
            totalValue: totals.totalGeral,
            totalND30: totals.totalND30,
            totalND39: totals.totalND39,
        });
    };

    return (
        <Card className="border border-gray-300 bg-gray-50 p-4 shadow-lg space-y-4">
            <h4 className="font-bold text-lg">{groupName.trim() || (initialGroup ? 'Editando Grupo' : 'Novo Grupo')}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="groupName">Nome do Grupo *</Label>
                    <Input 
                        id="groupName"
                        value={groupName} 
                        onChange={(e) => setGroupName(e.target.value)} 
                        placeholder="Ex: Vtr Pqn Porte, Vtr Especializada, Eqp Engenharia" 
                        disabled={isSaving} 
                    />
                    <p className="text-xs text-muted-foreground">
                        Coluna Despesas (P Trab Op): <br /> Locação de Viatura ({groupName.trim() || 'Nome do Grupo'})
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="groupPurpose">Locação de Viatura para atender</Label>
                    <Input 
                        id="groupPurpose"
                        value={groupPurpose} 
                        onChange={(e) => setGroupPurpose(e.target.value)} 
                        placeholder="Ex: atender aos deslocamentos administrativos" 
                        disabled={isSaving} 
                    />
                    <p className="text-xs text-muted-foreground">
                        *Cabeçalho personalizado para a Memória de Cálculo não automatizada.
                    </p>
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Veículos Selecionados ({items.length} itens)</Label>
                <Card className="p-3 bg-background border">
                    {groupedItems.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">Nenhum veículo selecionado. Clique em "Importar/Alterar Veículos" para adicionar.</div>
                    ) : (
                        <div className="space-y-3">
                            {groupedItems.map(group => (
                                <Collapsible key={group.nr} open={expandedSubitems[group.nr] ?? true} onOpenChange={(open) => setExpandedSubitems(prev => ({ ...prev, [group.nr]: open }))}>
                                    <CollapsibleTrigger asChild>
                                        <div className="flex justify-between items-center p-2 bg-[#E2EEEE] border border-gray-300 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
                                            <span className="font-semibold text-sm">{group.nr} - {group.nome} ({group.items.length} itens)</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-green-700">{formatCurrency(group.total)}</span>
                                                {expandedSubitems[group.nr] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-2">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[80px] text-center">Qtd</TableHead>
                                                    <TableHead>Veículo</TableHead>
                                                    <TableHead className="text-right w-[140px]">Valor Unitário</TableHead>
                                                    <TableHead className="text-center w-[100px]">Período</TableHead>
                                                    <TableHead className="text-right w-[120px]">Total</TableHead>
                                                    <TableHead className="w-[50px] text-center">Ação</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.items.map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <Input 
                                                                type="number" 
                                                                value={item.quantidade || ""} 
                                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)} 
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                className="h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <p className="font-medium">{item.descricao_reduzida || item.descricao_item}</p>
                                                            <p className="text-[10px] text-muted-foreground">Pregão: {formatPregao(item.numero_pregao)}</p>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">
                                                            {formatCurrency(item.valor_unitario)} / {(item as any).unidade_medida || 'UN'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input 
                                                                type="number" 
                                                                value={(item as any).periodo || ""} 
                                                                onChange={(e) => handlePeriodChange(item.id, e.target.value)} 
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                className="h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm font-medium">{formatCurrency((item.quantidade || 0) * ((item as any).periodo || 0) * item.valor_unitario)}</TableCell>
                                                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
                        <span className="font-extrabold text-lg text-primary">{formatCurrency(totals.totalGeral)}</span>
                    </div>
                </Card>
            </div>

            <div className="flex justify-between gap-3">
                <Button type="button" variant="secondary" onClick={() => onOpenItemSelector(items)} className="flex-1">
                    <Package className="mr-2 h-4 w-4" /> Importar/Alterar Veículos da Diretriz ({items.length} itens)
                </Button>
            </div>
            
            <div className="flex justify-end gap-3">
                <Button type="button" onClick={handleSaveClick} disabled={isSaving || !groupName.trim() || items.length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Grupo
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            </div>
        </Card>
    );
};

export default VehicleGroupForm;