import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, Search, AlertCircle, Check, XCircle, FileText } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrencyInput, numberToRawDigits, formatCurrency, parseInputToNumber, formatNumber } from "@/lib/formatUtils";
import { DiretrizMaterialConsumo, ItemAquisicao, ItemAquisicaoTemplate } from "@/types/diretrizesMaterialConsumo";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCatmatShortDescription, fetchCatmatFullDescription, saveNewCatmatEntry, fetchAllExistingAcquisitionItems } from '@/integrations/supabase/api';
import { useSession } from '@/components/SessionContextProvider';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Tipo para o item de aquisição no estado do formulário (inclui rawValor para input)
type ItemAquisicaoForm = Omit<ItemAquisicaoTemplate, 'id'> & { 
    id?: string; // ID opcional para novos itens
    rawValor: string; 
};

interface MaterialConsumoDiretrizFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizToEdit: DiretrizMaterialConsumo | null;
    onSave: (data: Partial<DiretrizMaterialConsumo> & { ano_referencia: number }) => Promise<void>;
    loading: boolean;
}

const initialItemState: ItemAquisicaoForm = {
    descricao_item: '',
    descricao_reduzida: '',
    valor_unitario: 0,
    rawValor: '',
    numero_pregao: '',
    uasg: '',
    codigo_catmat: '',
    nd: '33.90.30', // Default ND
};

const MaterialConsumoDiretrizFormDialog: React.FC<MaterialConsumoDiretrizFormDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizToEdit,
    onSave,
    loading,
}) => {
    const { user } = useSession();
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [nrSubitem, setNrSubitem] = useState('');
    const [nomeSubitem, setNomeSubitem] = useState('');
    const [descricaoSubitem, setDescricaoSubitem] = useState<string | null>(null);
    const [itensAquisicao, setItensAquisicao] = useState<ItemAquisicaoTemplate[]>([]);
    const [isItemFormOpen, setIsItemFormOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<ItemAquisicaoForm>(initialItemState);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [isCatmatLoading, setIsCatmatLoading] = useState(false);
    const [isSavingInternal, setIsSavingInternal] = useState(false);
    
    // Estado para armazenar todos os itens de aquisição existentes do usuário para o ano (para checagem de duplicidade)
    const [existingAcquisitionItems, setExistingAcquisitionItems] = useState<ItemAquisicao[]>([]);
    
    // Query para buscar todos os itens existentes (para checagem de duplicidade)
    const { data: existingItemsData, isLoading: isLoadingExistingItems } = useQuery({
        queryKey: ['allExistingAcquisitionItems', selectedYear, user?.id],
        queryFn: () => fetchAllExistingAcquisitionItems(selectedYear, user!.id),
        enabled: !!user?.id && selectedYear > 0 && open,
        initialData: [],
    });
    
    useEffect(() => {
        if (existingItemsData) {
            setExistingAcquisitionItems(existingItemsData);
        }
    }, [existingItemsData]);

    useEffect(() => {
        if (diretrizToEdit) {
            setNrSubitem(diretrizToEdit.nr_subitem);
            setNomeSubitem(diretrizToEdit.nome_subitem);
            setDescricaoSubitem(diretrizToEdit.descricao_subitem || null);
            // Mapeia de volta para ItemAquisicaoTemplate[]
            setItensAquisicao(diretrizToEdit.itens_aquisicao || []);
        } else {
            setNrSubitem('');
            setNomeSubitem('');
            setDescricaoSubitem(null);
            setItensAquisicao([]);
        }
        setIsItemFormOpen(false);
        setCurrentItem(initialItemState);
        setEditingItemId(null);
    }, [diretrizToEdit, open]);
    
    const isEditingDiretriz = !!diretrizToEdit;
    const isGlobalLoading = loading || isLoadingExistingItems || isSavingInternal;

    // --- Lógica de Itens de Aquisição ---
    
    const handleOpenItemForm = () => {
        setCurrentItem(initialItemState);
        setEditingItemId(null);
        setIsItemFormOpen(true);
    };
    
    const handleEditItem = (item: ItemAquisicaoTemplate) => {
        setEditingItemId(item.id);
        setCurrentItem({
            ...item,
            rawValor: numberToRawDigits(item.valor_unitario),
        });
        setIsItemFormOpen(true);
    };
    
    const handleRemoveItem = (itemId: string) => {
        setItensAquisicao(prev => prev.filter(item => item.id !== itemId));
        toast.info("Item de aquisição removido.");
    };
    
    const handleItemChange = (field: keyof ItemAquisicaoForm, value: string) => {
        setCurrentItem(prev => ({ ...prev, [field]: value }));
    };
    
    const handleCurrencyChange = (rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setCurrentItem(prev => ({ 
            ...prev, 
            valor_unitario: numericValue, 
            rawValor: digits 
        }));
    };
    
    const handleCatmatBlur = async () => {
        const code = currentItem.codigo_catmat.trim();
        if (!code) return;
        
        setIsCatmatLoading(true);
        try {
            // 1. Busca descrição reduzida no catálogo local
            const { shortDescription, isCataloged } = await fetchCatmatShortDescription(code);
            
            // 2. Se não catalogado ou sem descrição reduzida, busca descrição completa no PNCP
            if (!isCataloged || !shortDescription) {
                const { fullDescription, nomePdm } = await fetchCatmatFullDescription(code);
                
                if (fullDescription) {
                    // Se encontrou no PNCP, usa a descrição completa e sugere a reduzida
                    setCurrentItem(prev => ({
                        ...prev,
                        descricao_item: fullDescription,
                        descricao_reduzida: shortDescription || nomePdm || fullDescription.substring(0, 50),
                    }));
                    
                    if (!isCataloged) {
                        toast.warning("CATMAT encontrado no PNCP, mas não no catálogo local. Preencha a descrição reduzida para catalogar.");
                    }
                } else {
                    toast.warning("CATMAT não encontrado no catálogo local nem no PNCP.");
                }
            } else {
                // Se encontrou no catálogo local, preenche a descrição reduzida
                setCurrentItem(prev => ({
                    ...prev,
                    descricao_reduzida: shortDescription,
                }));
                toast.success("CATMAT encontrado no catálogo local.");
            }
        } catch (error) {
            toast.error("Erro ao consultar CATMAT.");
        } finally {
            setIsCatmatLoading(false);
        }
    };
    
    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!currentItem.descricao_item.trim() || !currentItem.descricao_reduzida.trim() || !currentItem.codigo_catmat.trim()) {
            toast.error("Descrição completa, reduzida e código CATMAT são obrigatórios.");
            return;
        }
        if (currentItem.valor_unitario <= 0) {
            toast.error("O valor unitário deve ser maior que zero.");
            return;
        }
        
        setIsSavingInternal(true);
        
        try {
            // 1. Salvar/Atualizar CATMAT no catálogo local se a descrição reduzida for nova
            const { shortDescription, isCataloged } = await fetchCatmatShortDescription(currentItem.codigo_catmat);
            
            if (!isCataloged || shortDescription !== currentItem.descricao_reduzida) {
                await saveNewCatmatEntry(
                    currentItem.codigo_catmat, 
                    currentItem.descricao_item, 
                    currentItem.descricao_reduzida
                );
                toast.info("CATMAT atualizado/catalogado com descrição reduzida.");
                // Invalida a query do catálogo para refletir a mudança
                queryClient.invalidateQueries({ queryKey: ['catmatShortDescription', currentItem.codigo_catmat] });
            }
            
            // 2. Criar ou Atualizar o Item de Aquisição
            const itemToSave: ItemAquisicaoTemplate = {
                id: editingItemId || crypto.randomUUID(),
                descricao_item: currentItem.descricao_item.trim(),
                descricao_reduzida: currentItem.descricao_reduzida.trim(),
                valor_unitario: currentItem.valor_unitario,
                numero_pregao: currentItem.numero_pregao.trim(),
                uasg: currentItem.uasg.trim(),
                codigo_catmat: currentItem.codigo_catmat.trim(),
                nd: currentItem.nd,
            };
            
            setItensAquisicao(prev => {
                if (editingItemId) {
                    return prev.map(item => item.id === editingItemId ? itemToSave : item);
                } else {
                    return [...prev, itemToSave];
                }
            });
            
            setIsItemFormOpen(false);
            setCurrentItem(initialItemState);
            setEditingItemId(null);
            toast.success(`Item de aquisição ${editingItemId ? 'atualizado' : 'adicionado'} com sucesso.`);
            
        } catch (error) {
            toast.error("Falha ao salvar item de aquisição.");
            console.error(error);
        } finally {
            setIsSavingInternal(false);
        }
    };
    
    // --- Lógica de Diretriz Principal ---

    const handleSaveDiretriz = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!nrSubitem.trim() || !nomeSubitem.trim()) {
            toast.error("Número e Nome do Subitem são obrigatórios.");
            return;
        }
        if (itensAquisicao.length === 0) {
            toast.error("Adicione pelo menos um item de aquisição à diretriz.");
            return;
        }
        
        // Checagem de duplicidade (apenas para novos registros)
        if (!isEditingDiretriz) {
            const isDuplicate = existingAcquisitionItems.some(item => 
                item.nr_subitem === nrSubitem.trim() && item.nome_subitem === nomeSubitem.trim()
            );
            if (isDuplicate) {
                toast.error("Já existe um Subitem da ND com este número e nome para este ano.");
                return;
            }
        }

        const dataToSave: Partial<DiretrizMaterialConsumo> & { ano_referencia: number } = {
            id: diretrizToEdit?.id,
            ano_referencia: selectedYear,
            nr_subitem: nrSubitem.trim(),
            nome_subitem: nomeSubitem.trim(),
            descricao_subitem: descricaoSubitem?.trim() || null,
            // Salva ItemAquisicaoTemplate[]
            itens_aquisicao: itensAquisicao, 
            ativo: diretrizToEdit?.ativo ?? true,
        };
        
        await onSave(dataToSave);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditingDiretriz ? "Editar Subitem da ND" : "Novo Subitem da ND"}</DialogTitle>
                    <p className="text-sm text-muted-foreground">Ano de Referência: {selectedYear}</p>
                </DialogHeader>
                
                <form onSubmit={handleSaveDiretriz} className="space-y-6 py-2">
                    
                    {/* DADOS PRINCIPAIS DA DIRETRIZ */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nrSubitem">Nr Subitem *</Label>
                            <Input
                                id="nrSubitem"
                                value={nrSubitem}
                                onChange={(e) => setNrSubitem(e.target.value)}
                                placeholder="Ex: 01"
                                required
                                disabled={isGlobalLoading}
                                onKeyDown={handleEnterToNextField}
                            />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="nomeSubitem">Nome do Subitem *</Label>
                            <Input
                                id="nomeSubitem"
                                value={nomeSubitem}
                                onChange={(e) => setNomeSubitem(e.target.value)}
                                placeholder="Ex: Material de Escritório"
                                required
                                disabled={isGlobalLoading}
                                onKeyDown={handleEnterToNextField}
                            />
                        </div>
                        <div className="space-y-2 col-span-3">
                            <Label htmlFor="descricaoSubitem">Descrição Detalhada (Opcional)</Label>
                            <Textarea
                                id="descricaoSubitem"
                                value={descricaoSubitem || ''}
                                onChange={(e) => setDescricaoSubitem(e.target.value)}
                                placeholder="Descrição completa do subitem para referência."
                                disabled={isGlobalLoading}
                                rows={2}
                            />
                        </div>
                    </div>
                    
                    {/* GERENCIAMENTO DE ITENS DE AQUISIÇÃO */}
                    <div className="space-y-4 border-t pt-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            Itens de Aquisição ({itensAquisicao.length})
                        </h3>
                        
                        {/* Formulário de Adição/Edição de Item */}
                        {isItemFormOpen && (
                            <Card className="p-4 bg-muted/50">
                                <h4 className="font-semibold mb-3">{editingItemId ? "Editar Item" : "Adicionar Novo Item"}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    
                                    {/* CATMAT */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="codigo_catmat">Cód. CATMAT *</Label>
                                        <Input
                                            id="codigo_catmat"
                                            value={currentItem.codigo_catmat}
                                            onChange={(e) => handleItemChange('codigo_catmat', e.target.value)}
                                            onBlur={handleCatmatBlur}
                                            placeholder="Ex: 301000000"
                                            required
                                            disabled={isGlobalLoading || isCatmatLoading}
                                        />
                                        {isCatmatLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                    </div>
                                    
                                    {/* ND */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="nd">Natureza da Despesa *</Label>
                                        <Input
                                            id="nd"
                                            value={currentItem.nd}
                                            onChange={(e) => handleItemChange('nd', e.target.value as '33.90.30' | '33.90.39')}
                                            placeholder="Ex: 33.90.30"
                                            required
                                            disabled={isGlobalLoading}
                                        />
                                    </div>
                                    
                                    {/* VALOR UNITÁRIO */}
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="valor_unitario">Valor Unitário (R$) *</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                            <Input
                                                id="valor_unitario"
                                                type="text"
                                                inputMode="numeric"
                                                className="pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={currentItem.rawValor.length === 0 && currentItem.valor_unitario === 0 ? "" : formatCurrencyInput(currentItem.rawValor).formatted}
                                                onChange={(e) => handleCurrencyChange(e.target.value)}
                                                required
                                                disabled={isGlobalLoading}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* DESCRIÇÃO REDUZIDA */}
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="descricao_reduzida">Descrição Reduzida (Catálogo) *</Label>
                                        <Input
                                            id="descricao_reduzida"
                                            value={currentItem.descricao_reduzida}
                                            onChange={(e) => handleItemChange('descricao_reduzida', e.target.value)}
                                            placeholder="Ex: Caneta esferográfica azul"
                                            required
                                            disabled={isGlobalLoading}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Usada para exibição resumida.
                                        </p>
                                    </div>
                                    
                                    {/* PREGÃO / UASG */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="numero_pregao">Pregão (Opcional)</Label>
                                        <Input
                                            id="numero_pregao"
                                            value={currentItem.numero_pregao}
                                            onChange={(e) => handleItemChange('numero_pregao', e.target.value)}
                                            placeholder="Ex: 001/2024"
                                            disabled={isGlobalLoading}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="uasg">UASG (Opcional)</Label>
                                        <Input
                                            id="uasg"
                                            value={currentItem.uasg}
                                            onChange={(e) => handleItemChange('uasg', e.target.value)}
                                            placeholder="Ex: 160001"
                                            disabled={isGlobalLoading}
                                        />
                                    </div>
                                    
                                    {/* DESCRIÇÃO COMPLETA */}
                                    <div className="space-y-2 col-span-4">
                                        <Label htmlFor="descricao_item">Descrição Completa *</Label>
                                        <Textarea
                                            id="descricao_item"
                                            value={currentItem.descricao_item}
                                            onChange={(e) => handleItemChange('descricao_item', e.target.value)}
                                            placeholder="Descrição detalhada do item, conforme PNCP/Catálogo."
                                            required
                                            disabled={isGlobalLoading}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsItemFormOpen(false)} disabled={isGlobalLoading}>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancelar
                                    </Button>
                                    <Button type="button" onClick={handleSaveItem} disabled={isGlobalLoading || isCatmatLoading}>
                                        {isGlobalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {editingItemId ? "Atualizar Item" : "Adicionar Item"}
                                    </Button>
                                </div>
                            </Card>
                        )}
                        
                        {/* Lista de Itens */}
                        {itensAquisicao.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px] text-center">ND</TableHead>
                                        <TableHead>Item de Aquisição</TableHead>
                                        <TableHead className="text-right">Vlr Unitário</TableHead>
                                        <TableHead className="w-[100px] text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {itensAquisicao.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-center text-xs font-medium">{item.nd}</TableCell>
                                            <TableCell>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex flex-col cursor-help">
                                                                <span className="font-medium">{item.descricao_reduzida}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    CATMAT: {item.codigo_catmat} | Pregão: {item.numero_pregao} ({item.uasg})
                                                                </span>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-md">
                                                            <p className="font-bold mb-1">Descrição Completa:</p>
                                                            <p className="text-sm whitespace-normal">{item.descricao_item}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(item.valor_unitario)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-1">
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleEditItem(item)}
                                                        disabled={isGlobalLoading || isItemFormOpen}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        disabled={isGlobalLoading || isItemFormOpen}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        
                        {!isItemFormOpen && (
                            <Button 
                                type="button" 
                                onClick={handleOpenItemForm}
                                disabled={isGlobalLoading}
                                variant="outline"
                                className="w-full mt-4"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar Item de Aquisição
                            </Button>
                        )}
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isGlobalLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isGlobalLoading || itensAquisicao.length === 0}>
                            {isGlobalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Diretriz
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoDiretrizFormDialog;