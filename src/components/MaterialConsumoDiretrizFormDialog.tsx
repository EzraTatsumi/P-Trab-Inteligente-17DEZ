"use client";

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
import MaterialCatalogDialog from './MaterialCatalogDialog';
import CatmatCatalogDialog from './CatmatCatalogDialog';
import ItemAquisicaoBulkUploadDialog from './ItemAquisicaoBulkUploadDialog';
import ItemAquisicaoPNCPDialog from './ItemAquisicaoPNCPDialog';
import { cn } from '@/lib/utils';

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

const initialItemForm = {
    descricao_item: '',
    descricao_reduzida: '',
    unidade_medida: 'UN',
    valor_unitario: 0,
    rawValor: numberToRawDigits(0),
    numero_pregao: '',
    uasg: '',
    codigo_catmat: '',
    nd: '30',
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

    const [subitemForm, setSubitemForm] = useState<Partial<DiretrizMaterialConsumo>>({
        nr_subitem: '',
        nome_subitem: '',
        descricao_subitem: '',
        itens_aquisicao: [],
        ano_referencia: selectedYear,
        ativo: true
    });

    const [itemForm, setItemForm] = useState(initialItemForm);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [isPNCPSearchOpen, setIsPNCPSearchOpen] = useState(false);

    useEffect(() => {
        if (diretrizToEdit) {
            setSubitemForm({ ...diretrizToEdit });
        } else {
            setSubitemForm({
                nr_subitem: '',
                nome_subitem: '',
                descricao_subitem: '',
                itens_aquisicao: [],
                ano_referencia: selectedYear,
                ativo: true
            });
        }
        setItemForm(initialItemForm);
        setEditingItemId(null);
    }, [diretrizToEdit, open, selectedYear]);

    const handleAddItem = () => {
        if (!itemForm.descricao_item || itemForm.valor_unitario <= 0 || !itemForm.numero_pregao || itemForm.uasg.length !== 6) {
            toast.error("Preencha os campos obrigatórios do item.");
            return;
        }
        const newItem: ItemAquisicao = {
            id: editingItemId || Math.random().toString(36).substring(2, 9),
            ...itemForm,
            valor_total: 0,
            quantidade: 0,
            nr_subitem: subitemForm.nr_subitem || '',
            nome_subitem: subitemForm.nome_subitem || '',
        };
        const updatedItens = editingItemId 
            ? (subitemForm.itens_aquisicao || []).map(t => t.id === editingItemId ? newItem : t) 
            : [...(subitemForm.itens_aquisicao || []), newItem];
            
        setSubitemForm(prev => ({ ...prev, itens_aquisicao: updatedItens }));
        setEditingItemId(null);
        setItemForm(initialItemForm);
    };

    const handleSave = async () => {
        if (!subitemForm.nr_subitem || !subitemForm.nome_subitem) {
            toast.error("Preencha os dados do subitem.");
            return;
        }
        await onSave({ ...subitemForm, ano_referencia: selectedYear } as any);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-7xl max-h-[90vh] overflow-y-auto z-tour-portal modal-novo-subitem")}>
                <DialogHeader>
                    <DialogTitle>{subitemForm.id ? "Editar Subitem" : "Novo Subitem da Natureza da Despesa"}</DialogTitle>
                    <DialogDescription>Cadastre o subitem da ND 339030 e seus itens de aquisição.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-2">
                    <Card className="p-4 card-novo-subitem">
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle className="text-base">Dados do Subitem</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsCatalogOpen(true)}>
                                <BookOpen className="h-4 w-4 mr-2" />Catálogo ND 30
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Número do Subitem *</Label>
                                <Input value={subitemForm.nr_subitem} onChange={(e) => setSubitemForm({ ...subitemForm, nr_subitem: e.target.value })} placeholder="Ex: 24" />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Nome do Subitem *</Label>
                                <Input value={subitemForm.nome_subitem} onChange={(e) => setSubitemForm({ ...subitemForm, nome_subitem: e.target.value })} placeholder="Ex: Material de Construção" />
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-semibold">Itens de Aquisição</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" size="sm" onClick={() => setIsPNCPSearchOpen(true)} className="btn-importar-pncp">
                                    <Search className="h-4 w-4 mr-2" />Importar API PNCP
                                </Button>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setIsBulkUploadOpen(true)}>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />Importar Excel
                                </Button>
                            </div>
                        </div>

                        <div className="border p-3 rounded-lg bg-muted/50 space-y-4" ref={itemFormRef}>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <Label>Cód. CATMAT</Label>
                                    <div className="flex gap-1">
                                        <Input value={itemForm.codigo_catmat} onChange={(e) => setItemForm({ ...itemForm, codigo_catmat: e.target.value })} placeholder="Ex: 12345" />
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsCatmatCatalogOpen(true)}><BookOpen className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                <div className="space-y-2 col-span-4">
                                    <Label>Descrição do Item *</Label>
                                    <Textarea value={itemForm.descricao_item} onChange={(e) => setItemForm({ ...itemForm, descricao_item: e.target.value })} rows={2} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Valor Unitário *</Label>
                                    <CurrencyInput rawDigits={itemForm.rawValor} onChange={(val, digits) => setItemForm({...itemForm, valor_unitario: val, rawValor: digits})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Pregão/Ref. *</Label>
                                    <Input value={itemForm.numero_pregao} onChange={(e) => setItemForm({ ...itemForm, numero_pregao: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>UASG *</Label>
                                    <Input value={itemForm.uasg} onChange={(e) => setItemForm({ ...itemForm, uasg: e.target.value.replace(/\D/g, '').slice(0, 6) })} maxLength={6} />
                                </div>
                                <div className="flex items-end">
                                    <Button type="button" className="w-full" onClick={handleAddItem}>
                                        {editingItemId ? "Atualizar Item" : "Adicionar Item"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {(subitemForm.itens_aquisicao?.length || 0) > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="text-center">Pregão</TableHead>
                                        <TableHead className="text-center">UASG</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subitemForm.itens_aquisicao?.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-xs">{item.descricao_item}</TableCell>
                                            <TableCell className="text-center text-sm">{formatPregao(item.numero_pregao)}</TableCell>
                                            <TableCell className="text-center text-sm">{formatCodug(item.uasg)}</TableCell>
                                            <TableCell className="text-right font-bold text-sm">{formatCurrency(item.valor_unitario)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        setEditingItemId(item.id);
                                                        setItemForm({ ...item as any, rawValor: numberToRawDigits(item.valor_unitario) });
                                                        itemFormRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                    }}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setSubitemForm(p => ({ ...p, itens_aquisicao: p.itens_aquisicao?.filter(i => i.id !== item.id) }))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Card>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="button" onClick={handleSave} disabled={loading} className="btn-salvar-subitem">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Subitem
                    </Button>
                </div>
            </DialogContent>

            <MaterialCatalogDialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen} onSelect={(c) => setSubitemForm(p => ({ ...p, nr_subitem: c.nr_subitem, nome_subitem: c.nome_subitem, descricao_subitem: c.descricao_subitem }))} />
            <CatmatCatalogDialog open={isCatmatCatalogOpen} onOpenChange={setIsCatmatCatalogOpen} onSelect={(c) => setItemForm(p => ({ ...p, codigo_catmat: c.code, descricao_item: c.description, descricao_reduzida: c.short_description || '' }))} />
            <ItemAquisicaoBulkUploadDialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen} onImport={(items) => setSubitemForm(p => ({ ...p, itens_aquisicao: [...(p.itens_aquisicao || []), ...items] }))} existingItemsInDiretriz={subitemForm.itens_aquisicao || []} mode="material" />
            <ItemAquisicaoPNCPDialog 
                open={isPNCPSearchOpen} 
                onOpenChange={setIsPNCPSearchOpen} 
                onImport={(items) => setSubitemForm(p => ({ ...p, itens_aquisicao: [...(p.itens_aquisicao || []), ...items] }))} 
                existingItemsInDiretriz={subitemForm.itens_aquisicao || []} 
                onReviewItem={(item) => {
                    setEditingItemId(item.id);
                    setItemForm({ ...item as any, rawValor: numberToRawDigits(item.valor_unitario) });
                }}
                selectedYear={selectedYear} 
                mode="material" 
            />
        </Dialog>
    );
};

export default MaterialConsumoDiretrizFormDialog;