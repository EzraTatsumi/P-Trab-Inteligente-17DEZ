import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus, Pencil, Trash2, Loader2, BookOpen, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import CurrencyInput from "@/components/CurrencyInput";
import { 
    numberToRawDigits, 
    formatCurrency, 
    formatCodug, 
    formatPregao 
} from "@/lib/formatUtils";
import ServicoCatalogDialog from './ServicoCatalogDialog';
import LocacaoCatalogDialog from './LocacaoCatalogDialog';
import CatmatCatalogDialog from './CatmatCatalogDialog';
import ItemAquisicaoBulkUploadDialog from './ItemAquisicaoBulkUploadDialog';
import ItemAquisicaoPNCPDialog from './ItemAquisicaoPNCPDialog';

interface ServicosTerceirosDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizServicosTerceiros | null;
    onSave: (data: Partial<DiretrizServicosTerceiros> & { 
        ano_referencia: number, 
    }) => Promise<void>;
    loading: boolean;
}

// Estendendo o tipo localmente para incluir os novos campos se não existirem no tipo importado
type ItemAquisicaoServicoExtended = ItemAquisicaoServico & {
    nome_reduzido: string;
    unidade_medida: string;
};

const initialItemForm = {
    descricao_item: '',
    nome_reduzido: '',
    unidade_medida: '',
    valor_unitario: 0,
    rawValor: numberToRawDigits(0),
    numero_pregao: '',
    uasg: '',
    codigo_catmat: '',
};

type InternalServicosForm = Omit<DiretrizServicosTerceiros, 'user_id' | 'created_at' | 'updated_at'> & { 
    id?: string,
    ano_referencia: number;
};

const ServicosTerceirosDiretrizFormDialog: React.FC<ServicosTerceirosDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
}) => {
    const { handleEnterToNextField } = useFormNavigation();
    const itemFormRef = useRef<HTMLDivElement>(null);

    const getInitialFormState = (editData: DiretrizServicosTerceiros | null): InternalServicosForm => {
        if (editData) {
            return {
                ...editData,
                itens_aquisicao: editData.itens_aquisicao || [],
                ano_referencia: editData.ano_referencia,
            };
        }
        
        return { 
            id: undefined,
            nr_subitem: '', 
            nome_subitem: '', 
            descricao_subitem: '', 
            itens_aquisicao: [],
            ano_referencia: selectedYear,
            ativo: true,
        };
    };

    const [subitemForm, setSubitemForm] = useState<InternalServicosForm>(() => getInitialFormState(diretrizToEdit));
    const [itemForm, setItemForm] = useState<typeof initialItemForm>(initialItemForm);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isLocacaoCatalogOpen, setIsLocacaoCatalogOpen] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [isPNCPSearchOpen, setIsPNCPSearchOpen] = useState(false);

    useEffect(() => {
        setSubitemForm(getInitialFormState(diretrizToEdit));
        setItemForm(initialItemForm);
        setEditingItemId(null);
    }, [diretrizToEdit, open, selectedYear]);

    const handleItemCurrencyChange = (numericValue: number, digits: string) => {
        setItemForm(prev => ({
            ...prev,
            valor_unitario: numericValue,
            rawValor: digits,
        }));
    };
    
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawDigits = e.target.value.replace(/\D/g, '');
        setItemForm({ ...itemForm, uasg: rawDigits }); 
    };

    const generateItemKey = (item: any): string => {
        const normalize = (str: string) => (str || '').trim().toUpperCase().replace(/\s+/g, ' ');
        return `${normalize(item.descricao_item)}|${normalize(item.codigo_catmat)}|${normalize(item.numero_pregao)}|${normalize(item.uasg)}`;
    };

    const handleAddItem = () => {
        if (!itemForm.descricao_item || !itemForm.nome_reduzido || !itemForm.unidade_medida || itemForm.valor_unitario <= 0) {
            toast.error("Preencha a Descrição, Nome Reduzido, Unidade e o Valor Unitário.");
            return;
        }
        
        if (!itemForm.numero_pregao) {
            toast.error("O campo 'Pregão/Ref. Preço' é obrigatório.");
            return;
        }

        if (!itemForm.uasg || itemForm.uasg.length !== 6) {
            toast.error("O campo 'UASG' deve ter 6 dígitos.");
            return;
        }

        const newItem: ItemAquisicaoServicoExtended = {
            id: editingItemId || Math.random().toString(36).substring(2, 9), 
            descricao_item: itemForm.descricao_item,
            nome_reduzido: itemForm.nome_reduzido,
            unidade_medida: itemForm.unidade_medida,
            valor_unitario: itemForm.valor_unitario,
            numero_pregao: itemForm.numero_pregao,
            uasg: itemForm.uasg,
            codigo_catmat: itemForm.codigo_catmat, 
        };
        
        const newItemKey = generateItemKey(newItem);
        const isDuplicate = subitemForm.itens_aquisicao.some(existingItem => {
            if (editingItemId && existingItem.id === editingItemId) return false;
            return generateItemKey(existingItem) === newItemKey;
        });
        
        if (isDuplicate) {
            toast.error("Este item de serviço já existe nesta diretriz.");
            return;
        }

        const updatedItens = editingItemId
            ? subitemForm.itens_aquisicao.map(t => t.id === editingItemId ? newItem : t)
            : [...subitemForm.itens_aquisicao, newItem];

        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));
        setEditingItemId(null);
        setItemForm(initialItemForm);
    };

    const handleEditItem = (item: any) => {
        setEditingItemId(item.id);
        setItemForm({
            descricao_item: item.descricao_item,
            nome_reduzido: item.nome_reduzido || '',
            unidade_medida: item.unidade_medida || '',
            valor_unitario: item.valor_unitario,
            rawValor: numberToRawDigits(item.valor_unitario),
            numero_pregao: item.numero_pregao,
            uasg: item.uasg,
            codigo_catmat: item.codigo_catmat, 
        });
        itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleDeleteItem = (itemId: string) => {
        const updatedItens = subitemForm.itens_aquisicao.filter(t => t.id !== itemId);
        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));
    };

    const handleSave = async () => {
        if (!subitemForm.nr_subitem || !subitemForm.nome_subitem) {
            toast.error("Preencha o Número e o Nome do Subitem de Serviço.");
            return;
        }
        
        if (subitemForm.itens_aquisicao.length === 0) {
            toast.error("Adicione pelo menos um item de serviço.");
            return;
        }
        
        await onSave({
            ...subitemForm,
            ano_referencia: selectedYear,
        });
        onOpenChange(false);
    };

    const handleBulkImport = (newItems: any[]) => {
        if (newItems.length === 0) return;
        setSubitemForm(prev => ({
            ...prev,
            itens_aquisicao: [...prev.itens_aquisicao, ...newItems],
        }));
        toast.success(`${newItems.length} itens importados com sucesso.`);
        setIsBulkUploadOpen(false); 
    };
    
    const handlePNCPImport = (newItems: any[]) => {
        if (newItems.length === 0) return;
        setSubitemForm(prev => ({
            ...prev,
            itens_aquisicao: [...prev.itens_aquisicao, ...newItems],
        }));
        toast.success(`${newItems.length} itens importados do PNCP.`);
    };

    const handleCatalogSelect = (catalogItem: any) => {
        setSubitemForm(prev => ({
            ...prev,
            nr_subitem: catalogItem.nr_subitem,
            nome_subitem: catalogItem.nome_subitem,
            descricao_subitem: catalogItem.descricao_subitem,
        }));
        setIsCatalogOpen(false);
        setIsLocacaoCatalogOpen(false);
    };
    
    const handleCatmatSelect = (catmatItem: any) => {
        setItemForm(prev => ({
            ...prev,
            codigo_catmat: catmatItem.code,
            descricao_item: catmatItem.description, 
        }));
        setIsCatmatCatalogOpen(false);
    };
    
    const sortedItens = [...subitemForm.itens_aquisicao].sort((a, b) => 
        a.descricao_item.localeCompare(b.descricao_item)
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {subitemForm.id ? `Editar Subitem: ${subitemForm.nr_subitem}` : "Novo Subitem da Natureza da Despesa"}
                    </DialogTitle>
                    <DialogDescription>
                        Cadastre o subitem da ND e os itens de serviço/locação associados.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle className="text-base">Dados do Subitem</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsLocacaoCatalogOpen(true)} disabled={loading}>
                                    <BookOpen className="h-4 w-4 mr-2" /> Catálogo ND 33
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsCatalogOpen(true)} disabled={loading}>
                                    <BookOpen className="h-4 w-4 mr-2" /> Catálogo ND 39
                                </Button>
                            </div>
                        </div>
                        
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
                                    placeholder="Ex: Serviços de Limpeza"
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
                                placeholder="Descreva o propósito geral deste subitem."
                                disabled={loading}
                                rows={3}
                            />
                        </div>
                    </Card>

                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-semibold">
                                {editingItemId ? "Editar Item" : "Adicionar Novo Item"}
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" size="sm" onClick={() => setIsPNCPSearchOpen(true)} disabled={loading}>
                                    <Search className="h-4 w-4 mr-2" /> Importar API PNCP
                                </Button>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setIsBulkUploadOpen(true)} disabled={loading}>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar Excel
                                </Button>
                            </div>
                        </div>
                        
                        <div className="border p-3 rounded-lg bg-muted/50 space-y-4" ref={itemFormRef}>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <Label htmlFor="item-catmat">Cód. CATSER</Label>
                                    <Input
                                        id="item-catmat"
                                        value={itemForm.codigo_catmat}
                                        onChange={(e) => setItemForm({ ...itemForm, codigo_catmat: e.target.value })}
                                        placeholder="Ex: 12345"
                                        onKeyDown={handleEnterToNextField}
                                    />
                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCatmatCatalogOpen(true)} disabled={loading} className="w-full mt-2">
                                        <BookOpen className="h-4 w-4 mr-2" /> CATSER
                                    </Button>
                                </div>
                                <div className="space-y-2 col-span-4">
                                    <Label htmlFor="item-descricao">Descrição do Item *</Label>
                                    <Textarea 
                                        id="item-descricao"
                                        value={itemForm.descricao_item}
                                        onChange={(e) => setItemForm({ ...itemForm, descricao_item: e.target.value })}
                                        placeholder="Ex: Serviço de manutenção ou Locação de veículo"
                                        rows={2} 
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="item-nome-reduzido">Nome Reduzido *</Label>
                                <Input
                                    id="item-nome-reduzido"
                                    value={itemForm.nome_reduzido}
                                    onChange={(e) => setItemForm({ ...itemForm, nome_reduzido: e.target.value })}
                                    placeholder="Ex: Manut. Ar Condicionado"
                                    onKeyDown={handleEnterToNextField}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="item-unidade">Unidade *</Label>
                                    <Input
                                        id="item-unidade"
                                        value={itemForm.unidade_medida}
                                        onChange={(e) => setItemForm({ ...itemForm, unidade_medida: e.target.value })}
                                        placeholder="Ex: UN, MÊS"
                                        onKeyDown={handleEnterToNextField}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="item-valor">Valor Unitário *</Label>
                                    <CurrencyInput
                                        id="item-valor"
                                        rawDigits={itemForm.rawValor}
                                        onChange={handleItemCurrencyChange}
                                        placeholder="0,00"
                                        onKeyDown={handleEnterToNextField}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="item-pregao">Pregão/Ref. *</Label>
                                    <Input
                                        id="item-pregao"
                                        value={itemForm.numero_pregao}
                                        onChange={(e) => setItemForm({ ...itemForm, numero_pregao: e.target.value })}
                                        placeholder="Ex: 01/2024"
                                        onKeyDown={handleEnterToNextField}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="item-uasg">UASG *</Label>
                                    <Input
                                        id="item-uasg"
                                        value={itemForm.uasg}
                                        onChange={handleUasgChange} 
                                        placeholder="Ex: 160001"
                                        onKeyDown={handleEnterToNextField}
                                        maxLength={6}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <Button type="button" className="w-full" onClick={handleAddItem} disabled={!itemForm.descricao_item || !itemForm.nome_reduzido || !itemForm.unidade_medida || itemForm.valor_unitario <= 0 || !itemForm.numero_pregao || itemForm.uasg.length !== 6}>
                                {editingItemId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                                {editingItemId ? "Atualizar Item" : "Adicionar Item"}
                            </Button>
                        </div>
                        
                        {sortedItens.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[30%]">Descrição</TableHead>
                                        <TableHead className="w-[15%]">Nome Reduzido</TableHead>
                                        <TableHead className="w-[5%] text-center">Unid.</TableHead>
                                        <TableHead className="w-[10%] text-center">CATSER</TableHead>
                                        <TableHead className="w-[10%] text-center">Pregão/Ref.</TableHead>
                                        <TableHead className="w-[10%] text-center">UASG</TableHead>
                                        <TableHead className="w-[10%] text-right">Valor Unitário</TableHead>
                                        <TableHead className="w-[10%] text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedItens.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium text-xs">{item.descricao_item}</TableCell>
                                            <TableCell className="text-xs">{(item as any).nome_reduzido || 'N/A'}</TableCell>
                                            <TableCell className="text-center text-xs">{(item as any).unidade_medida || 'N/A'}</TableCell>
                                            <TableCell className="text-center text-sm">{item.codigo_catmat || 'N/A'}</TableCell>
                                            <TableCell className="text-center text-sm">{formatPregao(item.numero_pregao)}</TableCell>
                                            <TableCell className="text-center text-sm">{formatCodug(item.uasg)}</TableCell>
                                            <TableCell className="text-right font-bold text-primary text-sm">
                                                {formatCurrency(item.valor_unitario)}
                                            </TableCell>
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
                            <p className="text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>
                        )}
                    </Card>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" onClick={handleSave} disabled={loading || !subitemForm.nr_subitem || !subitemForm.nome_subitem || subitemForm.itens_aquisicao.length === 0}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {subitemForm.id ? "Salvar Alterações" : "Cadastrar Subitem"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
                </div>
            </DialogContent>
            
            <ServicoCatalogDialog 
                open={isCatalogOpen} 
                onOpenChange={setIsCatalogOpen} 
                onSelect={handleCatalogSelect} 
            />
            <LocacaoCatalogDialog 
                open={isLocacaoCatalogOpen} 
                onOpenChange={setIsLocacaoCatalogOpen} 
                onSelect={handleCatalogSelect} 
            />
            <CatmatCatalogDialog open={isCatmatCatalogOpen} onOpenChange={setIsCatmatCatalogOpen} onSelect={handleCatmatSelect} />
            <ItemAquisicaoBulkUploadDialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen} onImport={handleBulkImport} existingItemsInDiretriz={subitemForm.itens_aquisicao as any} />
            <ItemAquisicaoPNCPDialog open={isPNCPSearchOpen} onOpenChange={setIsPNCPSearchOpen} onImport={handlePNCPImport} existingItemsInDiretriz={subitemForm.itens_aquisicao as any} selectedYear={selectedYear} />
        </Dialog>
    );
};

export default ServicosTerceirosDiretrizFormDialog;