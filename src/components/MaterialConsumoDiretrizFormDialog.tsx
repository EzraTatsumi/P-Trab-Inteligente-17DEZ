import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import CurrencyInput from "@/components/CurrencyInput";
import { formatCurrencyInput, numberToRawDigits, formatCurrency } from "@/lib/formatUtils";

interface MaterialConsumoDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizMaterialConsumo | null;
    onSave: (data: Partial<DiretrizMaterialConsumo> & { 
        ano_referencia: number, 
    }) => Promise<void>;
    loading: boolean;
}

// Estado inicial para o formulário de Item de Aquisição
const initialItemForm: Omit<ItemAquisicao, 'id'> & { rawValor: string } = {
    descricao_item: '',
    valor_unitario: 0,
    rawValor: numberToRawDigits(0),
    numero_pregao: '',
    uasg: '',
};

// Definindo o tipo interno do formulário
type InternalMaterialConsumoForm = Omit<DiretrizMaterialConsumo, 'user_id' | 'created_at' | 'updated_at'> & { 
    id?: string,
    ano_referencia: number;
};

const MaterialConsumoDiretrizFormDialog: React.FC<MaterialConsumoDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
}) => {
    const { handleEnterToNextField } = useFormNavigation();

    const getInitialFormState = (editData: DiretrizMaterialConsumo | null): InternalMaterialConsumoForm => {
        if (editData) {
            return {
                ...editData,
                itens_aquisicao: editData.itens_aquisicao,
                ano_referencia: editData.ano_referencia,
            };
        }
        
        return { 
            nr_subitem: '', 
            nome_subitem: '', 
            descricao_subitem: '', 
            itens_aquisicao: [],
            ano_referencia: selectedYear,
            ativo: true,
        };
    };

    const [subitemForm, setSubitemForm] = useState<InternalMaterialConsumoForm>(() => getInitialFormState(diretrizToEdit));
    
    const [itemForm, setItemForm] = useState<typeof initialItemForm>(initialItemForm);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    useEffect(() => {
        setSubitemForm(getInitialFormState(diretrizToEdit));
        setItemForm(initialItemForm);
        setEditingItemId(null);
    }, [diretrizToEdit, open, selectedYear]);

    const handleItemCurrencyChange = (rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setItemForm(prev => ({
            ...prev,
            valor_unitario: numericValue,
            rawValor: digits,
        }));
    };

    const handleAddItem = () => {
        if (!itemForm.descricao_item || itemForm.valor_unitario <= 0) {
            toast.error("Preencha a Descrição do Item e o Valor Unitário.");
            return;
        }

        const newItem: ItemAquisicao = {
            id: editingItemId || Math.random().toString(36).substring(2, 9),
            descricao_item: itemForm.descricao_item,
            valor_unitario: itemForm.valor_unitario,
            numero_pregao: itemForm.numero_pregao,
            uasg: itemForm.uasg,
        };

        const updatedItens = editingItemId
            ? subitemForm.itens_aquisicao.map(t => t.id === editingItemId ? newItem : t)
            : [...subitemForm.itens_aquisicao, newItem];

        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));

        // Resetar formulário de item
        setEditingItemId(null);
        setItemForm(initialItemForm);
    };

    const handleEditItem = (item: ItemAquisicao) => {
        setEditingItemId(item.id);
        setItemForm({
            descricao_item: item.descricao_item,
            valor_unitario: item.valor_unitario,
            rawValor: numberToRawDigits(item.valor_unitario),
            numero_pregao: item.numero_pregao,
            uasg: item.uasg,
        });
    };

    const handleDeleteItem = (itemId: string) => {
        const updatedItens = subitemForm.itens_aquisicao.filter(t => t.id !== itemId);
        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));
    };

    const handleSave = async () => {
        if (!subitemForm.nr_subitem || !subitemForm.nome_subitem) {
            toast.error("Preencha o Número e o Nome do Subitem da ND.");
            return;
        }
        
        if (subitemForm.itens_aquisicao.length === 0) {
            toast.error("Adicione pelo menos um item de aquisição.");
            return;
        }
        
        const dataToSave = {
            ...subitemForm,
            ano_referencia: selectedYear,
            id: subitemForm.id,
            // Garantir que itens_aquisicao seja um array limpo
            itens_aquisicao: subitemForm.itens_aquisicao,
        };

        await onSave(dataToSave);
        onOpenChange(false);
    };

    const isEditingSubitem = !!subitemForm.id;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditingSubitem ? `Editar Subitem ND: ${subitemForm.nr_subitem}` : "Novo Subitem da Natureza da Despesa"}
                    </DialogTitle>
                    <DialogDescription>
                        Cadastre o subitem da ND e os itens de aquisição associados.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Seção de Dados do Subitem (Card 266 equivalente) */}
                    <Card className="p-4">
                        <CardTitle className="text-base mb-4">
                            Dados do Subitem da ND
                        </CardTitle>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nr_subitem">Número do Subitem *</Label>
                                <Input
                                    id="nr_subitem"
                                    value={subitemForm.nr_subitem}
                                    onChange={(e) => setSubitemForm({ ...subitemForm, nr_subitem: e.target.value })}
                                    placeholder="Ex: 01"
                                    disabled={loading}
                                    onKeyDown={handleEnterToNextField}
                                    required
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="nome_subitem">Nome do Subitem *</Label>
                                <Input
                                    id="nome_subitem"
                                    value={subitemForm.nome_subitem}
                                    onChange={(e) => setSubitemForm({ ...subitemForm, nome_subitem: e.target.value })}
                                    placeholder="Ex: Material de Expediente"
                                    disabled={loading}
                                    onKeyDown={handleEnterToNextField}
                                    required
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2 mt-4">
                            <Label htmlFor="descricao_subitem">Descrição do Subitem (Propósito)</Label>
                            <Textarea
                                id="descricao_subitem"
                                value={subitemForm.descricao_subitem || ''}
                                onChange={(e) => setSubitemForm({ ...subitemForm, descricao_subitem: e.target.value })}
                                placeholder="Descreva o propósito geral deste subitem da ND."
                                disabled={loading}
                                rows={3}
                            />
                        </div>
                    </Card>

                    {/* Seção de Gerenciamento de Itens de Aquisição (Card 325 equivalente) */}
                    <Card className="p-4 space-y-4">
                        <CardTitle className="text-base font-semibold">
                            {editingItemId ? "Editar Item de Aquisição" : "Adicionar Novo Item de Aquisição"}
                        </CardTitle>
                        
                        {/* Formulário de Item */}
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 border p-3 rounded-lg bg-muted/50">
                            {/* Campo Descrição do Item (2 colunas) */}
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="item-descricao">Descrição do Item *</Label>
                                <Input
                                    id="item-descricao"
                                    value={itemForm.descricao_item}
                                    onChange={(e) => setItemForm({ ...itemForm, descricao_item: e.target.value })}
                                    placeholder="Ex: Caneta Esferográfica Azul"
                                    onKeyDown={handleEnterToNextField}
                                    required
                                />
                            </div>
                            {/* Campo Valor Unitário (1 coluna) */}
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="item-valor">Valor Unitário (R$) *</Label>
                                <CurrencyInput
                                    id="item-valor"
                                    rawDigits={itemForm.rawValor}
                                    onChange={handleItemCurrencyChange}
                                    placeholder="0,00"
                                    onKeyDown={handleEnterToNextField}
                                    required
                                />
                            </div>
                            {/* Campo Pregão (1 coluna) */}
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="item-pregao">Pregão/Ref. Preço</Label>
                                <Input
                                    id="item-pregao"
                                    value={itemForm.numero_pregao}
                                    onChange={(e) => setItemForm({ ...itemForm, numero_pregao: e.target.value })}
                                    placeholder="Ex: 01/2024"
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            {/* Campo UASG (1 coluna) */}
                            <div className="space-y-2 col-span-1">
                                <Label htmlFor="item-uasg">UASG</Label>
                                <Input
                                    id="item-uasg"
                                    value={itemForm.uasg}
                                    onChange={(e) => setItemForm({ ...itemForm, uasg: e.target.value })}
                                    placeholder="Ex: 160001"
                                    onKeyDown={handleEnterToNextField}
                                />
                            </div>
                            {/* Botão Adicionar (1 coluna) */}
                            <div className="space-y-2 col-span-1 flex flex-col justify-end">
                                <Button 
                                    type="button" 
                                    onClick={handleAddItem}
                                    disabled={!itemForm.descricao_item || itemForm.valor_unitario <= 0}
                                >
                                    {editingItemId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {editingItemId ? "Atualizar" : "Adicionar"}
                                </Button>
                            </div>
                        </div>
                        
                        {/* Tabela de Itens de Aquisição */}
                        {subitemForm.itens_aquisicao.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">Descrição do Item</TableHead>
                                        <TableHead className="text-right">Valor Unitário</TableHead>
                                        <TableHead className="text-center">Pregão/Ref.</TableHead>
                                        <TableHead className="text-center">UASG</TableHead>
                                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subitemForm.itens_aquisicao.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.descricao_item}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(item.valor_unitario)}</TableCell>
                                            <TableCell className="text-center">{item.numero_pregao || 'N/A'}</TableCell>
                                            <TableCell className="text-center">{item.uasg || 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">Nenhum item de aquisição cadastrado. Adicione itens acima.</p>
                        )}
                    </Card>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                        type="button" 
                        onClick={handleSave}
                        disabled={loading || !subitemForm.nr_subitem || !subitemForm.nome_subitem || subitemForm.itens_aquisicao.length === 0}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEditingSubitem ? "Salvar Alterações" : "Cadastrar Subitem"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoDiretrizFormDialog;