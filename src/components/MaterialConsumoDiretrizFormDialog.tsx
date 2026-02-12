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
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import CurrencyInput from "@/components/CurrencyInput";
import { 
    numberToRawDigits, 
    formatCurrency, 
    formatCodug, 
    formatPregao 
} from "@/lib/formatUtils";
import SubitemCatalogDialog from './SubitemCatalogDialog';
import CatmatCatalogDialog from './CatmatCatalogDialog';
import ItemAquisicaoBulkUploadDialog from './ItemAquisicaoBulkUploadDialog';
import ItemAquisicaoPNCPDialog from './ItemAquisicaoPNCPDialog';

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

const initialItemForm: Omit<ItemAquisicao, 'id'> & { rawValor: string } = {
    descricao_item: '',
    descricao_reduzida: '', 
    valor_unitario: 0,
    rawValor: numberToRawDigits(0),
    numero_pregao: '',
    uasg: '',
    codigo_catmat: '',
    quantidade: 0,
    valor_total: 0,
    nd: '',
    nr_subitem: '',
    nome_subitem: '',
};

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
    const itemFormRef = useRef<HTMLDivElement>(null);

    const getInitialFormState = (editData: DiretrizMaterialConsumo | null): InternalMaterialConsumoForm => {
        if (editData) {
            return {
                ...editData,
                itens_aquisicao: editData.itens_aquisicao,
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

    const [subitemForm, setSubitemForm] = useState<InternalMaterialConsumoForm>(() => getInitialFormState(diretrizToEdit));
    const [itemForm, setItemForm] = useState<typeof initialItemForm>(initialItemForm);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [itemToReview, setItemToReview] = useState<ItemAquisicao | null>(null);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [isPNCPSearchOpen, setIsPNCPSearchOpen] = useState(false);

    useEffect(() => {
        setSubitemForm(getInitialFormState(diretrizToEdit));
        if (diretrizToEdit && editingItemId) {
            const item = diretrizToEdit.itens_aquisicao.find(i => i.id === editingItemId);
            if (item) {
                handleEditItem(item);
            }
        } else {
            setItemForm(initialItemForm);
        }
        setEditingItemId(null);
    }, [diretrizToEdit, open, selectedYear]);
    
    useEffect(() => {
        if (itemToReview) {
            handleEditItem(itemToReview);
            setItemToReview(null);
        }
    }, [itemToReview]);

    const handleItemCurrencyChange = (numericValue: number, digits: string) => {
        setItemForm(prev => ({
            ...prev,
            valor_unitario: numericValue,
            rawValor: digits,
        }));
    };
    
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const rawDigits = rawValue.replace(/\D/g, '');
        setItemForm({ ...itemForm, uasg: rawDigits }); 
    };

    const generateItemKey = (item: ItemAquisicao | typeof initialItemForm): string => {
        const normalize = (str: string) => 
            (str || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ');
            
        const desc = normalize(item.descricao_item); 
        const catmat = normalize(item.codigo_catmat);
        const pregao = normalize(item.numero_pregao);
        const uasg = normalize(item.uasg);
        
        return `${desc}|${catmat}|${pregao}|${uasg}`;
    };

    const handleAddItem = () => {
        if (!itemForm.descricao_item || itemForm.valor_unitario <= 0) {
            toast.error("Preencha a Descrição Completa do Item e o Valor Unitário.");
            return;
        }
        
        if (!itemForm.numero_pregao || itemForm.numero_pregao.trim() === '') {
            toast.error("O campo 'Pregão/Ref. Preço' é obrigatório.");
            return;
        }

        if (!itemForm.uasg || itemForm.uasg.trim() === '' || itemForm.uasg.length !== 6) {
            toast.error("O campo 'UASG' é obrigatório e deve ter 6 dígitos.");
            return;
        }

        const newItem: ItemAquisicao = {
            id: editingItemId || Math.random().toString(36).substring(2, 9), 
            descricao_item: itemForm.descricao_item,
            descricao_reduzida: itemForm.descricao_reduzida, 
            valor_unitario: itemForm.valor_unitario,
            numero_pregao: itemForm.numero_pregao,
            uasg: itemForm.uasg,
            codigo_catmat: itemForm.codigo_catmat, 
            quantidade: itemForm.quantidade || 0,
            valor_total: itemForm.valor_total || 0,
            nd: itemForm.nd || '',
            nr_subitem: itemForm.nr_subitem || '',
            nome_subitem: itemForm.nome_subitem || '',
        };
        
        const newItemKey = generateItemKey(newItem);
        const isDuplicate = subitemForm.itens_aquisicao.some(existingItem => {
            if (editingItemId && existingItem.id === editingItemId) return false;
            return generateItemKey(existingItem) === newItemKey;
        });
        
        if (isDuplicate) {
            toast.error("Este item de aquisição já existe nesta diretriz (duplicidade de Descrição Completa, CATMAT, Pregão e UASG).");
            return;
        }

        const updatedItens = editingItemId
            ? subitemForm.itens_aquisicao.map(t => t.id === editingItemId ? newItem : t)
            : [...subitemForm.itens_aquisicao, newItem];

        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));
        setEditingItemId(null);
        setItemForm(initialItemForm);
    };

    const handleEditItem = (item: ItemAquisicao) => {
        setEditingItemId(item.id);
        setItemForm({
            descricao_item: item.descricao_item,
            descricao_reduzida: item.descricao_reduzida, 
            valor_unitario: item.valor_unitario,
            rawValor: numberToRawDigits(item.valor_unitario),
            numero_pregao: item.numero_pregao,
            uasg: item.uasg,
            codigo_catmat: item.codigo_catmat, 
            quantidade: item.quantidade || 0,
            valor_total: item.valor_total || 0,
            nd: item.nd || '',
            nr_subitem: item.nr_subitem || '',
            nome_subitem: item.nome_subitem || '',
        });
        itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            itens_aquisicao: subitemForm.itens_aquisicao,
        };

        await onSave(dataToSave);
        onOpenChange(false);
    };

    const handleBulkImport = (newItems: ItemAquisicao[]) => {
        if (newItems.length === 0) {
            toast.info("Nenhum item novo para adicionar.");
            setIsBulkUploadOpen(false); 
            return;
        }
        
        setSubitemForm(prev => ({
            ...prev,
            itens_aquisicao: [...prev.itens_aquisicao, ...newItems],
        }));
        
        toast.success(`${newItems.length} itens importados com sucesso e adicionados à lista.`);
        setItemForm(initialItemForm);
        setEditingItemId(null);
        setIsBulkUploadOpen(false); 
    };
    
    const handlePNCPImport = (newItems: ItemAquisicao[]) => {
        if (newItems.length === 0) {
            toast.info("Nenhum item novo para adicionar.");
            return;
        }
        
        const firstItem = newItems[0];
        const isPriceReferenceItem = firstItem.uasg === '' && firstItem.numero_pregao === 'Em processo de abertura';

        if (isPriceReferenceItem) {
            setSubitemForm(prev => ({
                ...prev,
                itens_aquisicao: [...prev.itens_aquisicao, firstItem],
            }));
            handleEditItem(firstItem);
            toast.info("Item de Preço Médio importado. Por favor, preencha a UASG e o Pregão/Ref. Preço antes de adicionar.");
        } else {
            setSubitemForm(prev => ({
                ...prev,
                itens_aquisicao: [...prev.itens_aquisicao, ...newItems],
            }));
            toast.success(`${newItems.length} itens importados do PNCP com sucesso e adicionados à lista.`);
            setItemForm(initialItemForm);
            setEditingItemId(null);
        }
    };
    
    const handleReviewItem = (item: ItemAquisicao) => {
        setItemToReview(item);
    };

    const handleCatalogSelect = (catalogItem: { nr_subitem: string, nome_subitem: string, descricao_subitem: string | null }) => {
        setSubitemForm(prev => ({
            ...prev,
            nr_subitem: catalogItem.nr_subitem,
            nome_subitem: catalogItem.nome_subitem,
            descricao_subitem: catalogItem.descricao_subitem,
        }));
        setIsCatalogOpen(false);
    };
    
    const handleCatmatSelect = (catmatItem: { code: string, description: string, short_description: string | null }) => {
        setItemForm(prev => ({
            ...prev,
            codigo_catmat: catmatItem.code,
            descricao_item: catmatItem.description, 
            descricao_reduzida: catmatItem.short_description || '', 
        }));
        setIsCatmatCatalogOpen(false);
    };
    
    const isEditingSubitem = !!subitemForm.id;
    const sortedItens = [...subitemForm.itens_aquisicao].sort((a, b) => 
        a.descricao_item.localeCompare(b.descricao_item)
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditingSubitem ? `Editar Subitem ND: ${subitemForm.nr_subitem}` : "Novo Subitem da Natureza da Despesa"}
                    </DialogTitle>
                    <DialogDescription>
                        Cadastre o subitem da ND e os itens de aquisição associados.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle className="text-base">
                                Dados do Subitem da ND
                            </CardTitle>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setIsCatalogOpen(true)}
                                disabled={loading}
                            >
                                <BookOpen className="h-4 w-4 mr-2" />
                                Catálogo ND 30
                            </Button>
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

                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-semibold">
                                {editingItemId ? "Editar Item de Aquisição" : "Adicionar Novo Item de Aquisição"}
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => setIsPNCPSearchOpen(true)}
                                    disabled={loading}
                                >
                                    <Search className="h-4 w-4 mr-2" />
                                    Importar API PNCP
                                </Button>
                                
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => setIsBulkUploadOpen(true)}
                                    disabled={loading}
                                >
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Importar Excel
                                </Button>
                            </div>
                        </div>
                        
                        <div className="border p-3 rounded-lg bg-muted/50 space-y-4" ref={itemFormRef}>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <Label htmlFor="item-catmat">Cód. Item</Label>
                                    <Input
                                        id="item-catmat"
                                        value={itemForm.codigo_catmat}
                                        onChange={(e) => setItemForm({ ...itemForm, codigo_catmat: e.target.value })}
                                        placeholder="Ex: 123456789"
                                        onKeyDown={handleEnterToNextField}
                                    />
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setIsCatmatCatalogOpen(true)}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        CATMAT
                                    </Button>
                                </div>
                                
                                <div className="space-y-2 col-span-4">
                                    <Label htmlFor="item-descricao">Descrição Completa *</Label>
                                    <Textarea 
                                        id="item-descricao"
                                        value={itemForm.descricao_item}
                                        onChange={(e) => setItemForm({ ...itemForm, descricao_item: e.target.value })}
                                        placeholder="Ex: Caneta Esferográfica Azul 1.0mm"
                                        rows={2} 
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <Label htmlFor="item-descricao-reduzida">Nome Reduzido</Label>
                                    <Input
                                        id="item-descricao-reduzida"
                                        value={itemForm.descricao_reduzida}
                                        onChange={(e) => setItemForm({ ...itemForm, descricao_reduzida: e.target.value })}
                                        placeholder="Ex: Caneta Azul"
                                        onKeyDown={handleEnterToNextField}
                                    />
                                </div>
                                
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
                                    <p className="text-xs text-muted-foreground">
                                        * Valor estimado.
                                    </p>
                                </div>
                                
                                <div className="space-y-2 col-span-1">
                                    <Label htmlFor="item-pregao">Pregão/Ref. Preço *</Label>
                                    <Input
                                        id="item-pregao"
                                        value={itemForm.numero_pregao}
                                        onChange={(e) => setItemForm({ ...itemForm, numero_pregao: e.target.value })}
                                        placeholder="Ex: 90.001/24"
                                        onKeyDown={handleEnterToNextField}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        *Em processo de abertura.
                                    </p>
                                </div>
                                
                                <div className="space-y-2 col-span-1">
                                    <Label htmlFor="item-uasg">UASG *</Label>
                                    <Input
                                        id="item-uasg"
                                        value={itemForm.uasg}
                                        onChange={handleUasgChange} 
                                        placeholder="Ex: 160.001"
                                        onKeyDown={handleEnterToNextField}
                                        maxLength={6}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1">
                                <Button 
                                    type="button" 
                                    onClick={handleAddItem}
                                    disabled={
                                        !itemForm.descricao_item || 
                                        itemForm.valor_unitario <= 0 ||
                                        !itemForm.numero_pregao || 
                                        itemForm.uasg.length !== 6
                                    }
                                >
                                    {editingItemId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                                    {editingItemId ? "Atualizar Item" : "Adicionar Item"}
                                </Button>
                            </div>
                        </div>
                        
                        {sortedItens.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[20%]">Nome Reduzido</TableHead>
                                        <TableHead className="w-[20%]">Descrição Completa</TableHead>
                                        <TableHead className="w-[10%] text-center">Cód. Item</TableHead>
                                        <TableHead className="w-[10%] text-center">Pregão/Ref.</TableHead>
                                        <TableHead className="w-[10%] text-center">UASG</TableHead>
                                        <TableHead className="w-[10%] text-right">Valor Unitário</TableHead>
                                        <TableHead className="w-[10%] text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedItens.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium text-sm">{item.descricao_reduzida || 'N/A'}</TableCell>
                                            <TableCell className="font-medium text-xs">{item.descricao_item}</TableCell>
                                            <TableCell className="text-center text-sm">{item.codigo_catmat || 'N/A'}</TableCell>
                                            <TableCell className="text-center text-sm">{formatPregao(item.numero_pregao) || 'N/A'}</TableCell>
                                            <TableCell className="text-center text-sm">{formatCodug(item.uasg) || 'N/A'}</TableCell>
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
                            <p className="text-muted-foreground text-center py-4">Nenhum item de aquisição cadastrado. Adicione itens acima ou importe via Excel.</p>
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
            
            <SubitemCatalogDialog 
                open={isCatalogOpen}
                onOpenChange={setIsCatalogOpen}
                onSelect={handleCatalogSelect}
            />
            
            <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={handleCatmatSelect}
            />
            
            <ItemAquisicaoBulkUploadDialog
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                onImport={handleBulkImport}
                existingItemsInDiretriz={subitemForm.itens_aquisicao} 
                mode="material"
            />
            
            <ItemAquisicaoPNCPDialog
                open={isPNCPSearchOpen}
                onOpenChange={setIsPNCPSearchOpen}
                onImport={handlePNCPImport}
                existingItemsInDiretriz={subitemForm.itens_aquisicao}
                onReviewItem={handleReviewItem} 
                selectedYear={selectedYear} 
            />
        </Dialog>
    );
};

export default MaterialConsumoDiretrizFormDialog;