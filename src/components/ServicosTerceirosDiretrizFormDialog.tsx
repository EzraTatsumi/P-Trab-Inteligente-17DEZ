"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus, Pencil, Trash2, Loader2, BookOpen, FileSpreadsheet, Search, Info } from "lucide-react";
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
import CatserCatalogDialog from './CatserCatalogDialog';
import ItemAquisicaoBulkUploadDialog from './ItemAquisicaoBulkUploadDialog';
import ItemAquisicaoPNCPDialog from './ItemAquisicaoPNCPDialog';
import { cn } from '@/lib/utils';

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
    nd: '39' as string,
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
        if (editData) return { ...editData, itens_aquisicao: editData.itens_aquisicao || [], ano_referencia: editData.ano_referencia };
        return { id: undefined, nr_subitem: '', nome_subitem: '', descricao_subitem: '', itens_aquisicao: [], ano_referencia: selectedYear, ativo: true };
    };

    const [subitemForm, setSubitemForm] = useState<InternalServicosForm>(() => getInitialFormState(diretrizToEdit));
    const [itemForm, setItemForm] = useState<typeof initialItemForm>(initialItemForm);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isLocacaoCatalogOpen, setIsLocacaoCatalogOpen] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    const [isCatserCatalogOpen, setIsCatserCatalogOpen] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [isPNCPSearchOpen, setIsPNCPSearchOpen] = useState(false);

    useEffect(() => {
        setSubitemForm(getInitialFormState(diretrizToEdit));
        setItemForm(initialItemForm);
        setEditingItemId(null);
    }, [diretrizToEdit, open, selectedYear]);

    const handleItemCurrencyChange = (numericValue: number, digits: string) => setItemForm(prev => ({ ...prev, valor_unitario: numericValue, rawValor: digits }));
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => setItemForm({ ...itemForm, uasg: e.target.value.replace(/\D/g, '').slice(0, 6) });

    const handleAddItem = () => {
        if (!itemForm.descricao_item || !itemForm.nome_reduzido || !itemForm.unidade_medida || itemForm.valor_unitario <= 0 || !itemForm.numero_pregao || itemForm.uasg.length !== 6) {
            toast.error("Preencha todos os campos obrigatórios do item.");
            return;
        }
        const newItem: ItemAquisicaoServicoExtended = {
            id: editingItemId || Math.random().toString(36).substring(2, 9), 
            descricao_item: itemForm.descricao_item,
            descricao_reduzida: itemForm.nome_reduzido, 
            nome_reduzido: itemForm.nome_reduzido,
            unidade_medida: itemForm.unidade_medida,
            valor_unitario: itemForm.valor_unitario,
            numero_pregao: itemForm.numero_pregao,
            uasg: itemForm.uasg,
            codigo_catmat: itemForm.codigo_catmat, 
            nd: itemForm.nd || '39',
        };
        const updatedItens = editingItemId ? subitemForm.itens_aquisicao.map(t => t.id === editingItemId ? newItem : t) : [...subitemForm.itens_aquisicao, newItem];
        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));
        setEditingItemId(null);
        setItemForm(initialItemForm);
    };

    const handleEditItem = (item: any) => {
        setEditingItemId(item.id);
        setItemForm({ 
            ...item, 
            nome_reduzido: item.nome_reduzido || item.descricao_reduzida || '',
            unidade_medida: item.unidade_medida || 'UN',
            rawValor: numberToRawDigits(item.valor_unitario),
            nd: item.nd || '39'
        });
        itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleReviewItem = (item: any) => {
        handleEditItem(item);
    };

    const handleSave = async () => {
        if (!subitemForm.nr_subitem || !subitemForm.nome_subitem || subitemForm.itens_aquisicao.length === 0) {
            toast.error("Preencha os dados do subitem e adicione itens.");
            return;
        }
        await onSave({ ...subitemForm, ano_referencia: selectedYear });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto modal-novo-subitem">
                <DialogHeader>
                    <DialogTitle>{subitemForm.id ? `Editar Subitem: ${subitemForm.nr_subitem}` : "Novo Subitem da Natureza da Despesa"}</DialogTitle>
                    <DialogDescription>Cadastre o subitem da ND e os itens de serviço/locação associados.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-2">
                    <Card className={cn("p-4", "tour-dados-subitem")}>
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle className="text-base">Dados do Subitem</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsLocacaoCatalogOpen(true)} disabled={loading}><BookOpen className="h-4 w-4 mr-2" />Catálogo ND 33</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsCatalogOpen(true)} disabled={loading}><BookOpen className="h-4 w-4 mr-2" />Catálogo ND 39</Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Número do Subitem *</Label><Input value={subitemForm.nr_subitem} onChange={(e) => setSubitemForm({ ...subitemForm, nr_subitem: e.target.value })} placeholder="Ex: 01" disabled={loading} /></div>
                            <div className="space-y-2 col-span-2"><Label>Nome do Subitem *</Label><Input value={subitemForm.nome_subitem} onChange={(e) => setSubitemForm({ ...subitemForm, nome_subitem: e.target.value })} placeholder="Ex: Serviços de Limpeza" disabled={loading} /></div>
                        </div>
                    </Card>
                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-semibold">{editingItemId ? "Editar Item" : "Adicionar Novo Item"}</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" size="sm" onClick={() => setIsPNCPSearchOpen(true)} disabled={loading} className="btn-importar-pncp"><Search className="h-4 w-4 mr-2" />Importar API PNCP</Button>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setIsBulkUploadOpen(true)} disabled={loading}><FileSpreadsheet className="h-4 w-4 mr-2" />Importar Excel</Button>
                            </div>
                        </div>
                        <div className="border p-3 rounded-lg bg-muted/50 space-y-4" ref={itemFormRef}>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <Label>Cód. Item</Label>
                                    <Input value={itemForm.codigo_catmat} onChange={(e) => setItemForm({ ...itemForm, codigo_catmat: e.target.value })} placeholder="Ex: 12345" />
                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCatserCatalogOpen(true)} className="w-full mt-2"><BookOpen className="h-4 w-4 mr-2" />CATSER</Button>
                                </div>
                                <div className="space-y-2 col-span-4"><Label>Descrição do Item *</Label><Textarea value={itemForm.descricao_item} onChange={(e) => setItemForm({ ...itemForm, descricao_item: e.target.value })} rows={2} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2"><Label>Nome Reduzido *</Label><Input value={itemForm.nome_reduzido} onChange={(e) => setItemForm({ ...itemForm, nome_reduzido: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Unidade *</Label><Input value={itemForm.unidade_medida} onChange={(e) => setItemForm({ ...itemForm, unidade_medida: e.target.value })} placeholder="Ex: hora/dia/mês/ano" /></div>
                                <div className="space-y-2"><Label>Valor Unitário *</Label><CurrencyInput rawDigits={itemForm.rawValor} onChange={handleItemCurrencyChange} /></div>
                                <div className="space-y-2"><Label>Pregão/Ref. *</Label><Input value={itemForm.numero_pregao} onChange={(e) => setItemForm({ ...itemForm, numero_pregao: e.target.value })} /></div>
                                <div className="space-y-2"><Label>UASG *</Label><Input value={itemForm.uasg} onChange={handleUasgChange} maxLength={6} /></div>
                            </div>
                            <Button type="button" className="w-full" onClick={handleAddItem}>{editingItemId ? "Atualizar Item" : "Adicionar Item"}</Button>
                        </div>
                        {subitemForm.itens_aquisicao.length > 0 && (
                            <Table>
                                <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Nome Reduzido</TableHead><TableHead className="text-center">Unid.</TableHead><TableHead className="text-center">Cód.</TableHead><TableHead className="text-center">Pregão</TableHead><TableHead className="text-center">UASG</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                                <TableBody>{subitemForm.itens_aquisicao.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-xs">{item.descricao_item}</TableCell>
                                        <TableCell className="text-xs">{(item as any).nome_reduzido || (item as any).descricao_reduzida || 'N/A'}</TableCell>
                                        <TableCell className="text-center text-xs">{(item as any).unidade_medida || 'N/A'}</TableCell>
                                        <TableCell className="text-center text-sm">{item.codigo_catmat || 'N/A'}</TableCell>
                                        <TableCell className="text-center text-sm">{formatPregao(item.numero_pregao)}</TableCell>
                                        <TableCell className="text-center text-sm">{formatCodug(item.uasg)}</TableCell>
                                        <TableCell className="text-right font-bold text-sm">{formatCurrency(item.valor_unitario)}</TableCell>
                                        <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => handleEditItem(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setSubitemForm(p => ({ ...p, itens_aquisicao: p.itens_aquisicao.filter(i => i.id !== item.id) }))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                                    </TableRow>
                                ))}</TableBody>
                            </Table>
                        )}
                    </Card>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" onClick={handleSave} disabled={loading || subitemForm.itens_aquisicao.length === 0} className="btn-salvar-subitem">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{subitemForm.id ? "Salvar Alterações" : "Cadastrar Subitem"}</Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </div>
            </DialogContent>
            <ServicoCatalogDialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen} onSelect={(c) => setSubitemForm(p => ({ ...p, nr_subitem: c.nr_subitem, nome_subitem: c.nome_subitem, descricao_subitem: c.descricao_subitem }))} />
            <LocacaoCatalogDialog open={isLocacaoCatalogOpen} onOpenChange={setIsLocacaoCatalogOpen} onSelect={(c) => setSubitemForm(p => ({ ...p, nr_subitem: c.nr_subitem, nome_subitem: c.nome_subitem, descricao_subitem: c.descricao_subitem }))} />
            <CatmatCatalogDialog open={isCatmatCatalogOpen} onOpenChange={setIsCatmatCatalogOpen} onSelect={(c) => setItemForm(p => ({ ...p, codigo_catmat: c.code, descricao_item: c.description, nome_reduzido: c.short_description || '' }))} />
            <CatserCatalogDialog open={isCatserCatalogOpen} onOpenChange={setIsCatserCatalogOpen} onSelect={(c) => setItemForm(p => ({ ...p, codigo_catmat: c.code, descricao_item: c.description, nome_reduzido: c.short_description || '' }))} />
            <ItemAquisicaoBulkUploadDialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen} onImport={(items) => setSubitemForm(p => ({ ...p, itens_aquisicao: [...p.itens_aquisicao, ...items] }))} existingItemsInDiretriz={subitemForm.itens_aquisicao as any} mode="servico" />
            <ItemAquisicaoPNCPDialog 
                open={isPNCPSearchOpen} 
                onOpenChange={setIsPNCPSearchOpen} 
                onImport={(items) => {
                    const mappedItems = items.map(item => ({
                        ...item,
                        nome_reduzido: item.descricao_reduzida || '',
                        unidade_medida: (item as any).unidade_medida || 'UN',
                        nd: (item as any).nd || '39',
                    }));
                    setSubitemForm(p => ({ ...p, itens_aquisicao: [...p.itens_aquisicao, ...mappedItems] as ItemAquisicaoServico[] }));
                }} 
                existingItemsInDiretriz={subitemForm.itens_aquisicao as any} 
                onReviewItem={handleReviewItem} 
                selectedYear={selectedYear} 
                mode="servico" 
            />
        </Dialog>
    );
};

export default ServicosTerceirosDiretrizFormDialog;