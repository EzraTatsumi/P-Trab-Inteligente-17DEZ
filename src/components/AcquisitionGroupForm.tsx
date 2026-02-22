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

// Tipo para agrupar itens por subitem para exibição
interface GroupedItem {
    subitemNr: string;
    subitemNome: string;
    items: ItemAquisicao[];
    totalValue: number; // NOVO: Valor total dos itens neste subitem
}

interface AcquisitionGroupFormProps {
    initialGroup?: AcquisitionGroup;
    onSave: (group: AcquisitionGroup) => void;
    onCancel: () => void;
    isSaving: boolean;
    // NOVO: Handler para abrir o seletor de itens
    onOpenItemSelector: (currentItems: ItemAquisicao[]) => void; 
    // NOVO: Lista de itens selecionados (retorno do seletor)
    selectedItemsFromSelector: ItemAquisicao[] | null;
    // NOVO: Handler para limpar os itens selecionados do seletor
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
    // Usamos um ID temporário para cada item para garantir que a quantidade seja rastreada
    const [items, setItems] = useState<ItemAquisicao[]>(initialGroup?.items || []);
    const [tempId] = useState(initialGroup?.tempId || crypto.randomUUID());
    
    // Estado para controlar a expansão dos subitens. Inicialmente, todos abertos se houver itens.
    const [expandedSubitems, setExpandedSubitems] = useState<Record<string, boolean>>({});

    // Efeito para processar itens retornados do seletor
    useEffect(() => {
        if (selectedItemsFromSelector) {
            // 1. Criar um mapa de IDs dos itens existentes para fácil verificação
            const existingItemIds = new Set(items.map(i => i.id));
            
            // 2. Processar os itens selecionados
            const newItemsMap: Record<string, ItemAquisicao> = {};
            
            selectedItemsFromSelector.forEach(selectedItem => {
                const existingItem = items.find(i => i.id === selectedItem.id);
                
                if (existingItem) {
                    // Item já existia: mantém a quantidade e o valor total atual
                    newItemsMap[selectedItem.id] = existingItem;
                } else {
                    // Novo item: quantidade 1, recalcula valor total
                    const quantity = 1;
                    const valorTotal = selectedItem.valor_unitario * quantity;
                    
                    newItemsMap[selectedItem.id] = {
                        ...selectedItem,
                        quantidade: quantity,
                        valor_total: valorTotal,
                    };
                }
            });
            
            // 3. Atualiza a lista de itens (mantendo apenas os selecionados)
            setItems(Object.values(newItemsMap));
            onClearSelectedItems(); // Limpa o estado global do seletor
            
            // 4. FECHA TODOS OS GRUPOS DE SUBITENS APÓS A SELEÇÃO
            setExpandedSubitems({}); 
            
            // Calcula quantos itens foram adicionados/removidos
            const addedCount = Object.values(newItemsMap).filter(item => !existingItemIds.has(item.id)).length;
            const removedCount = items.filter(item => !newItemsMap[item.id]).length;
            
            if (addedCount > 0 || removedCount > 0) {
                toast.success(`Seleção atualizada. Adicionados: ${addedCount}, Removidos: ${removedCount}.`);
            }
        }
    }, [selectedItemsFromSelector]); // Depende apenas dos itens retornados do seletor

    // Calcula o valor total do grupo
    const totalValue = useMemo(() => {
        return items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
    }, [items]);
    
    // Agrupa os itens por subitem para exibição
    const groupedItems = useMemo<GroupedItem[]>(() => {
        const groups: Record<string, GroupedItem> = {};
        
        items.forEach(item => {
            // Chave de agrupamento: Nr Subitem + Nome Subitem
            // Usamos nr_subitem e nome_subitem que agora são injetados pelo seletor
            const key = `${item.nr_subitem}-${item.nome_subitem}`;
            if (!groups[key]) {
                groups[key] = {
                    subitemNr: item.nr_subitem,
                    subitemNome: item.nome_subitem,
                    items: [],
                    totalValue: 0, // Inicializa o total
                };
            }
            groups[key].items.push(item);
            groups[key].totalValue += Number(item.valor_total || 0); // Soma o valor
        });
        
        return Object.values(groups).sort((a, b) => a.subitemNr.localeCompare(b.subitemNr));
    }, [items]);
    
    // Handler para mudança de quantidade
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
    
    // Handler para remover item
    const handleRemoveItem = (itemId: string) => {
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
        toast.info("Item removido do grupo.");
    };

    // FUNÇÃO DE SALVAMENTO (AGORA CHAMADA POR ONCLICK)
    const handleSaveGroupClick = () => {
        console.log("[AcquisitionGroupForm] Tentativa de salvar grupo iniciada.");
        
        if (!groupName.trim()) {
            toast.error("O Nome do Grupo de Aquisição é obrigatório.");
            console.log("[AcquisitionGroupForm] Falha: Nome do grupo vazio.");
            return;
        }
        if (items.length === 0) {
            toast.error("Adicione pelo menos um item de aquisição ao grupo.");
            console.log("[AcquisitionGroupForm] Falha: Nenhum item adicionado.");
            return;
        }
        
        // Verifica se há alguma quantidade zero
        const hasZeroQuantity = items.some(item => item.quantidade === 0);
        if (hasZeroQuantity) {
            toast.error("A quantidade de todos os itens deve ser maior que zero.");
            console.log("[AcquisitionGroupForm] Falha: Quantidade zero encontrada.");
            return;
        }
        
        // Nota: totalND30 e totalND39 serão calculados no MaterialConsumoForm.tsx antes de salvar no DB.
        // Aqui, apenas passamos o totalValue e os itens.
        onSave({
            tempId,
            groupName: groupName.trim(),
            groupPurpose: groupPurpose.trim() || null,
            items,
            totalValue,
            totalND30: 0, // Placeholder
            totalND39: 0, // Placeholder
        } as AcquisitionGroup);
        
        // Fecha todos os subitens após salvar o grupo
        setExpandedSubitems({});
        
        console.log("[AcquisitionGroupForm] onSave chamado com sucesso.");
    };
    
    const displayTitle = groupName.trim() || (initialGroup ? 'Editando Grupo' : 'Novo Grupo');

    return (
        <Card className="border border-gray-300 bg-gray-50 p-4 shadow-lg">
            <h4 className="font-bold text-lg mb-4">{displayTitle}</h4>
            {/* REMOVIDO: <form onSubmit={handleSubmit} className="space-y-4"> */}
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
                        
                        {/* Lista de Itens Agrupados */}
                        {groupedItems.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">
                                Nenhum item selecionado. Clique em "Importar/Alterar Itens" para adicionar.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {groupedItems.map(group => (
                                    <Collapsible 
                                        key={group.subitemNr} 
                                        // Controla o estado de expansão
                                        open={expandedSubitems[group.subitemNr] ?? true}
                                        onOpenChange={(open) => setExpandedSubitems(prev => ({ ...prev, [group.subitemNr]: open }))}
                                    >
                                        <CollapsibleTrigger asChild>
                                            {/* CORREÇÃO: Aplicando a cor #E2EEEE e exibindo o total do grupo */}
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
                                            {/* INÍCIO DA REFACTORIZAÇÃO: Renderiza a tabela para este subitem */}
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
                                                    {group.items.map(item => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="w-[100px]">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={item.quantidade === 0 ? "" : item.quantidade}
                                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                    className="w-full text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                                                {formatCurrency(item.valor_total)}
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
                                            {/* FIM DA REFACTORIZAÇÃO */}
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
                        onClick={() => onOpenItemSelector(items)}
                        disabled={isSaving}
                        className="flex-1"
                    >
                        <Package className="mr-2 h-4 w-4" />
                        Importar/Alterar Itens de Subitens da ND ({items.length} itens)
                    </Button>
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                    <Button 
                        type="button" // ALTERADO PARA TYPE="BUTTON"
                        onClick={handleSaveGroupClick} // ALTERADO PARA ONCLICK
                        disabled={isSaving || !groupName.trim() || items.length === 0}
                        // CORREÇÃO: Usando a classe padrão do botão primário
                        className="w-auto" 
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
            {/* REMOVIDO: </form> */}
        </Card>
    );
};

export default AcquisitionGroupForm;