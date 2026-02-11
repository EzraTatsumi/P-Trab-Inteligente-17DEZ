import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { Plus, Trash2, Loader2, Info, List, Settings2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CurrencyInput from "./CurrencyInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    const [activeTab, setActiveTab] = useState<string>("subitem");
    const [formData, setFormData] = useState({
        nr_subitem: "",
        nome_subitem: "",
        descricao_subitem: "",
        ativo: true,
        itens_aquisicao: [] as ItemAquisicaoServico[]
    });

    useEffect(() => {
        if (open) {
            setActiveTab("subitem");
            if (diretrizToEdit) {
                setFormData({
                    nr_subitem: diretrizToEdit.nr_subitem,
                    nome_subitem: diretrizToEdit.nome_subitem,
                    descricao_subitem: diretrizToEdit.descricao_subitem || "",
                    ativo: diretrizToEdit.ativo,
                    itens_aquisicao: diretrizToEdit.itens_aquisicao ? [...diretrizToEdit.itens_aquisicao] : []
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
        if (!formData.nr_subitem || !formData.nome_subitem) {
            setActiveTab("subitem");
            return;
        }
        await onSave({
            ...formData,
            id: diretrizToEdit?.id,
            ano_referencia: selectedYear
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-primary" />
                        <DialogTitle>
                            {diretrizToEdit ? "Editar Subitem de Serviço" : "Novo Subitem de Serviço"}
                        </DialogTitle>
                    </div>
                    <DialogDescription>
                        Configure os detalhes do subitem da ND e seus itens de aquisição para o ano {selectedYear}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="subitem" className="flex items-center gap-2">
                                    <Info className="h-4 w-4" /> Dados do Subitem
                                </TabsTrigger>
                                <TabsTrigger value="itens" className="flex items-center gap-2">
                                    <List className="h-4 w-4" /> Itens de Aquisição ({formData.itens_aquisicao.length})
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 px-6 py-4">
                            <TabsContent value="subitem" className="space-y-6 mt-0">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2 md:col-span-1">
                                        <Label htmlFor="nr_subitem" className="text-sm font-semibold">Nr Subitem</Label>
                                        <Input 
                                            id="nr_subitem"
                                            placeholder="Ex: 01"
                                            value={formData.nr_subitem} 
                                            onChange={e => setFormData({ ...formData, nr_subitem: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-3">
                                        <Label htmlFor="nome_subitem" className="text-sm font-semibold">Nome do Subitem</Label>
                                        <Input 
                                            id="nome_subitem"
                                            placeholder="Ex: Serviços de Limpeza e Conservação"
                                            value={formData.nome_subitem} 
                                            onChange={e => setFormData({ ...formData, nome_subitem: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="descricao_subitem" className="text-sm font-semibold">Descrição / Observações Gerais</Label>
                                    <Textarea 
                                        id="descricao_subitem"
                                        placeholder="Informações adicionais sobre este subitem..."
                                        className="min-h-[100px] resize-none"
                                        value={formData.descricao_subitem} 
                                        onChange={e => setFormData({ ...formData, descricao_subitem: e.target.value })} 
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Status do Subitem</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Subitens inativos não aparecerão na seleção de novos registros.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch 
                                            id="ativo"
                                            checked={formData.ativo} 
                                            onCheckedChange={checked => setFormData({ ...formData, ativo: checked })} 
                                        />
                                        <Label htmlFor="ativo" className="font-semibold">
                                            {formData.ativo ? "Ativo" : "Inativo"}
                                        </Label>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="itens" className="space-y-4 mt-0">
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-semibold">Detalhamento dos Itens</h4>
                                        <p className="text-xs text-muted-foreground">Adicione os itens específicos que compõem este subitem.</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="h-8">
                                        <Plus className="h-4 w-4 mr-2" /> Adicionar Item
                                    </Button>
                                </div>

                                {formData.itens_aquisicao.length === 0 ? (
                                    <Alert className="bg-muted/50 border-dashed">
                                        <Info className="h-4 w-4" />
                                        <AlertDescription className="text-xs">
                                            Nenhum item detalhado adicionado. Clique em "Adicionar Item" para começar.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="text-xs font-bold">Descrição do Item</TableHead>
                                                    <TableHead className="w-[110px] text-xs font-bold">CATMAT</TableHead>
                                                    <TableHead className="w-[110px] text-xs font-bold">Pregão</TableHead>
                                                    <TableHead className="w-[100px] text-xs font-bold">UASG</TableHead>
                                                    <TableHead className="w-[140px] text-xs font-bold">Valor Unit.</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {formData.itens_aquisicao.map((item, index) => (
                                                    <TableRow key={item.id} className="group">
                                                        <TableCell className="p-2">
                                                            <Input 
                                                                className="h-8 text-xs"
                                                                placeholder="Ex: Limpeza de vidros"
                                                                value={item.descricao_item} 
                                                                onChange={e => handleUpdateItem(item.id, 'descricao_item', e.target.value)} 
                                                                required 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input 
                                                                className="h-8 text-xs"
                                                                placeholder="Código"
                                                                value={item.codigo_catmat} 
                                                                onChange={e => handleUpdateItem(item.id, 'codigo_catmat', e.target.value)} 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input 
                                                                className="h-8 text-xs"
                                                                placeholder="00/0000"
                                                                value={item.numero_pregao} 
                                                                onChange={e => handleUpdateItem(item.id, 'numero_pregao', e.target.value)} 
                                                                required 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input 
                                                                className="h-8 text-xs"
                                                                placeholder="UASG"
                                                                value={item.uasg} 
                                                                onChange={e => handleUpdateItem(item.id, 'uasg', e.target.value)} 
                                                                required 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <CurrencyInput 
                                                                className="h-8 text-xs"
                                                                value={item.valor_unitario} 
                                                                onChange={val => handleUpdateItem(item.id, 'valor_unitario', val)} 
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            type="button" 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            onClick={() => handleRemoveItem(item.id)} 
                                                                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Remover item</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>

                    <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                            ) : (
                                "Salvar Diretriz"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosDiretrizFormDialog;