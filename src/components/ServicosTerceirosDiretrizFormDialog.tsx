import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CurrencyInput from "./CurrencyInput";

interface ServicosTerceirosDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizServicosTerceiros | null;
    onSave: (data: Partial<DiretrizServicosTerceiros> & { ano_referencia: number }) => Promise<void>;
    loading: boolean;
}

const ServicosTerceirosDiretrizFormDialog: React.FC<ServicosTerceirosDiretrizFormDialogProps> = ({
    open, onOpenChange, selectedYear, diretrizToEdit, onSave, loading
}) => {
    const [formData, setFormData] = useState({
        nr_subitem: "",
        nome_subitem: "",
        descricao_subitem: "",
        ativo: true,
        itens_aquisicao: [] as ItemAquisicaoServico[]
    });

    useEffect(() => {
        if (diretrizToEdit) {
            setFormData({
                nr_subitem: diretrizToEdit.nr_subitem,
                nome_subitem: diretrizToEdit.nome_subitem,
                descricao_subitem: diretrizToEdit.descricao_subitem || "",
                ativo: diretrizToEdit.ativo,
                itens_aquisicao: [...diretrizToEdit.itens_aquisicao]
            });
        } else {
            setFormData({
                nr_subitem: "",
                nome_subitem: "",
                descricao_subitem: "",
                ativo: true,
                itens_aquisicao: []
            });
        }
    }, [diretrizToEdit, open]);

    const handleAddItem = () => {
        const newItem: ItemAquisicaoServico = {
            id: crypto.randomUUID(),
            descricao_item: "",
            codigo_catmat: "",
            numero_pregao: "",
            uasg: "",
            valor_unitario: 0
        };
        setFormData(prev => ({ ...prev, itens_aquisicao: [...prev.itens_aquisicao, newItem] }));
    };

    const handleRemoveItem = (id: string) => {
        setFormData(prev => ({ ...prev, itens_aquisicao: prev.itens_aquisicao.filter(i => i.id !== id) }));
    };

    const handleUpdateItem = (id: string, field: keyof ItemAquisicaoServico, value: any) => {
        setFormData(prev => ({
            ...prev,
            itens_aquisicao: prev.itens_aquisicao.map(i => i.id === id ? { ...i, [field]: value } : i)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            ...formData,
            id: diretrizToEdit?.id,
            ano_referencia: selectedYear
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{diretrizToEdit ? "Editar Subitem da ND" : "Novo Subitem da ND"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Nr Subitem</Label>
                            <Input value={formData.nr_subitem} onChange={e => setFormData({ ...formData, nr_subitem: e.target.value })} required />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Nome do Subitem</Label>
                            <Input value={formData.nome_subitem} onChange={e => setFormData({ ...formData, nome_subitem: e.target.value })} required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Descrição/Observações</Label>
                        <Textarea value={formData.descricao_subitem} onChange={e => setFormData({ ...formData, descricao_subitem: e.target.value })} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch checked={formData.ativo} onCheckedChange={checked => setFormData({ ...formData, ativo: checked })} />
                        <Label>Subitem Ativo</Label>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-base font-semibold">Itens de Aquisição Detalhados</Label>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                                <Plus className="h-4 w-4 mr-2" /> Adicionar Item
                            </Button>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Descrição Reduzida</TableHead>
                                    <TableHead className="w-[120px]">CATMAT</TableHead>
                                    <TableHead className="w-[120px]">Pregão</TableHead>
                                    <TableHead className="w-[120px]">UASG</TableHead>
                                    <TableHead className="w-[150px]">Valor Unit.</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {formData.itens_aquisicao.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell><Input value={item.descricao_item} onChange={e => handleUpdateItem(item.id, 'descricao_item', e.target.value)} required /></TableCell>
                                        <TableCell><Input value={item.codigo_catmat} onChange={e => handleUpdateItem(item.id, 'codigo_catmat', e.target.value)} /></TableCell>
                                        <TableCell><Input value={item.numero_pregao} onChange={e => handleUpdateItem(item.id, 'numero_pregao', e.target.value)} required /></TableCell>
                                        <TableCell><Input value={item.uasg} onChange={e => handleUpdateItem(item.id, 'uasg', e.target.value)} required /></TableCell>
                                        <TableCell><CurrencyInput value={item.valor_unitario} onChange={val => handleUpdateItem(item.id, 'valor_unitario', val)} /></TableCell>
                                        <TableCell>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosDiretrizFormDialog;