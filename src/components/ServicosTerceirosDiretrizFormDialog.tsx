import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Search, Import, Loader2, Pencil } from "lucide-react";
import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import SubitemCatalogDialog from "./SubitemCatalogDialog";
import ItemAquisicaoPNCPDialog from "./ItemAquisicaoPNCPDialog";
import ItemAquisicaoBulkUploadDialog from "./ItemAquisicaoBulkUploadDialog";

interface ServicosTerceirosDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizServicosTerceiros | null;
    onSave: (data: Partial<DiretrizServicosTerceiros> & { ano_referencia: number }) => Promise<void>;
    loading: boolean;
}

const ServicosTerceirosDiretrizFormDialog: React.FC<ServicosTerceirosDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
}) => {
    const [subitemForm, setSubitemForm] = useState<Partial<DiretrizServicosTerceiros>>({
        nr_subitem: '',
        nome_subitem: '',
        descricao_subitem: '',
        ativo: true,
        itens_aquisicao: [],
    });

    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [isPNCPSearchOpen, setIsPNCPSearchOpen] = useState(false);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const [itemForm, setItemForm] = useState<Partial<ItemAquisicaoServico>>({
        descricao_item: '',
        nome_reduzido: '',
        unidade_medida: '',
        valor_unitario: 0,
        numero_pregao: '',
        uasg: '',
        codigo_catmat: '',
    });

    useEffect(() => {
        if (diretrizToEdit) {
            setSubitemForm(diretrizToEdit);
        } else {
            setSubitemForm({
                nr_subitem: '',
                nome_subitem: '',
                descricao_subitem: '',
                ativo: true,
                itens_aquisicao: [],
            });
        }
        setEditingItemId(null);
        resetItemForm();
    }, [diretrizToEdit, open]);

    const resetItemForm = () => {
        setItemForm({
            descricao_item: '',
            nome_reduzido: '',
            unidade_medida: '',
            valor_unitario: 0,
            numero_pregao: '',
            uasg: '',
            codigo_catmat: '',
        });
        setEditingItemId(null);
    };

    const handleAddOrUpdateItem = () => {
        if (!itemForm.descricao_item || !itemForm.numero_pregao || !itemForm.uasg) return;

        const newItem: ItemAquisicaoServico = {
            id: editingItemId || Math.random().toString(36).substring(2, 9),
            descricao_item: itemForm.descricao_item!,
            nome_reduzido: itemForm.nome_reduzido || '',
            unidade_medida: itemForm.unidade_medida || '',
            valor_unitario: itemForm.valor_unitario || 0,
            numero_pregao: itemForm.numero_pregao!,
            uasg: itemForm.uasg!,
            codigo_catmat: itemForm.codigo_catmat || '',
            quantidade: 0,
            valor_total: 0,
            nd: '',
            nr_subitem: subitemForm.nr_subitem || '',
            nome_subitem: subitemForm.nome_subitem || '',
        };

        const currentItens = subitemForm.itens_aquisicao || [];
        if (editingItemId) {
            setSubitemForm({
                ...subitemForm,
                itens_aquisicao: currentItens.map(i => i.id === editingItemId ? newItem : i)
            });
        } else {
            setSubitemForm({
                ...subitemForm,
                itens_aquisicao: [...currentItens, newItem]
            });
        }
        resetItemForm();
    };

    const handleEditItem = (item: ItemAquisicaoServico) => {
        setEditingItemId(item.id);
        setItemForm(item);
    };

    const handleRemoveItem = (id: string) => {
        setSubitemForm({
            ...subitemForm,
            itens_aquisicao: (subitemForm.itens_aquisicao || []).filter(i => i.id !== id)
        });
    };

    const handleCatalogSelect = (item: { nr_subitem: string, nome_subitem: string, descricao_subitem: string | null }) => {
        setSubitemForm({
            ...subitemForm,
            nr_subitem: item.nr_subitem,
            nome_subitem: item.nome_subitem,
            descricao_subitem: item.descricao_subitem || '',
        });
    };

    const handlePNCPImport = (items: ItemAquisicaoServico[]) => {
        setSubitemForm({
            ...subitemForm,
            itens_aquisicao: [...(subitemForm.itens_aquisicao || []), ...items]
        });
    };

    const handleBulkImport = (items: ItemAquisicaoServico[]) => {
        setSubitemForm({
            ...subitemForm,
            itens_aquisicao: [...(subitemForm.itens_aquisicao || []), ...items]
        });
        setIsBulkUploadOpen(false);
    };

    const handleReviewItem = (item: ItemAquisicaoServico) => {
        setItemForm(item);
        setEditingItemId(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{diretrizToEdit ? "Editar Subitem da ND" : "Novo Subitem da ND"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Número do Subitem *</Label>
                            <div className="flex gap-2">
                                <Input 
                                    value={subitemForm.nr_subitem} 
                                    onChange={e => setSubitemForm({...subitemForm, nr_subitem: e.target.value})}
                                    placeholder="Ex: 33.90.39.01"
                                />
                                <Button variant="outline" size="icon" onClick={() => setIsCatalogOpen(true)}>
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label>Nome do Subitem *</Label>
                            <Input 
                                value={subitemForm.nome_subitem} 
                                onChange={e => setSubitemForm({...subitemForm, nome_subitem: e.target.value})}
                                placeholder="Ex: Manutenção de Viaturas"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição do Subitem</Label>
                        <Textarea 
                            value={subitemForm.descricao_subitem || ''} 
                            onChange={e => setSubitemForm({...subitemForm, descricao_subitem: e.target.value})}
                            placeholder="Descrição detalhada do subitem..."
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch 
                            checked={subitemForm.ativo} 
                            onCheckedChange={checked => setSubitemForm({...subitemForm, ativo: checked})}
                        />
                        <Label>Subitem Ativo</Label>
                    </div>

                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-semibold">
                                {editingItemId ? "Editar Item" : "Adicionar Novo Item"}
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsPNCPSearchOpen(true)}>
                                    <Search className="h-4 w-4 mr-2" /> PNCP
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setIsBulkUploadOpen(true)}>
                                    <Import className="h-4 w-4 mr-2" /> Importar Excel
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Descrição Completa *</Label>
                                <Input 
                                    value={itemForm.descricao_item} 
                                    onChange={e => setItemForm({...itemForm, descricao_item: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nome Reduzido</Label>
                                <Input 
                                    value={itemForm.nome_reduzido} 
                                    onChange={e => setItemForm({...itemForm, nome_reduzido: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Valor Unitário *</Label>
                                    <Input 
                                        type="number" 
                                        step="0.01"
                                        value={itemForm.valor_unitario} 
                                        onChange={e => setItemForm({...itemForm, valor_unitario: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unidade de Medida</Label>
                                    <Input 
                                        value={itemForm.unidade_medida} 
                                        onChange={e => setItemForm({...itemForm, unidade_medida: e.target.value})}
                                        placeholder="Ex: UN, KM, H"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Pregão *</Label>
                                    <Input 
                                        value={itemForm.numero_pregao} 
                                        onChange={e => setItemForm({...itemForm, numero_pregao: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>UASG *</Label>
                                    <Input 
                                        value={itemForm.uasg} 
                                        onChange={e => setItemForm({...itemForm, uasg: e.target.value})}
                                        maxLength={6}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Cód. CATSER</Label>
                                <Input 
                                    value={itemForm.codigo_catmat} 
                                    onChange={e => setItemForm({...itemForm, codigo_catmat: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            {editingItemId && <Button variant="ghost" onClick={resetItemForm}>Cancelar</Button>}
                            <Button onClick={handleAddOrUpdateItem}>
                                {editingItemId ? "Atualizar Item" : "Adicionar Item"}
                            </Button>
                        </div>

                        {subitemForm.itens_aquisicao && subitemForm.itens_aquisicao.length > 0 && (
                            <div className="border rounded-md overflow-hidden mt-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome Reduzido</TableHead>
                                            <TableHead className="text-center">Unid.</TableHead>
                                            <TableHead className="text-center">Pregão</TableHead>
                                            <TableHead className="text-center">UASG</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {subitemForm.itens_aquisicao.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="text-xs">{item.nome_reduzido || item.descricao_item}</TableCell>
                                                <TableCell className="text-center text-xs">{item.unidade_medida}</TableCell>
                                                <TableCell className="text-center text-xs">{item.numero_pregao}</TableCell>
                                                <TableCell className="text-center text-xs">{formatCodug(item.uasg)}</TableCell>
                                                <TableCell className="text-right text-xs font-medium">{formatCurrency(item.valor_unitario)}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Card>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
                    <Button onClick={() => onSave({...subitemForm, ano_referencia: selectedYear})} disabled={loading || !subitemForm.nr_subitem || !subitemForm.nome_subitem}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Salvar Subitem
                    </Button>
                </DialogFooter>
            </DialogContent>

            <SubitemCatalogDialog 
                open={isCatalogOpen} 
                onOpenChange={setIsCatalogOpen} 
                onSelect={handleCatalogSelect} 
            />

            <ItemAquisicaoPNCPDialog 
                open={isPNCPSearchOpen} 
                onOpenChange={setIsPNCPSearchOpen} 
                onImport={handlePNCPImport} 
                existingItemsInDiretriz={subitemForm.itens_aquisicao || []} 
                onReviewItem={handleReviewItem}
                selectedYear={selectedYear} 
                mode="servico"
            />

            <ItemAquisicaoBulkUploadDialog
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                onImport={handleBulkImport}
                existingItemsInDiretriz={subitemForm.itens_aquisicao || []}
                mode="servico"
            />
        </Dialog>
    );
};

export default ServicosTerceirosDiretrizFormDialog;