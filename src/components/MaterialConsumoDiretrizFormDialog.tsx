import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus, Pencil, Trash2, Loader2, BookOpen, FileSpreadsheet, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import CurrencyInput from "@/components/CurrencyInput";
import { formatCurrencyInput, numberToRawDigits, formatCurrency, formatCodug } from "@/lib/formatUtils";
import SubitemCatalogDialog from './SubitemCatalogDialog';
import CatmatCatalogDialog from './CatmatCatalogDialog';
import ItemAquisicaoBulkUploadDialog from './ItemAquisicaoBulkUploadDialog';

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
    descricao_reduzida: '', // NOVO CAMPO
    valor_unitario: 0,
    rawValor: numberToRawDigits(0),
    numero_pregao: '',
    uasg: '',
    codigo_catmat: '',
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
            id: undefined, // Adiciona 'id' opcional
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
    
    // NOVO ESTADO: Controle do diálogo do catálogo de Subitem
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    
    // NOVO ESTADO: Controle do diálogo do catálogo CATMAT
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    
    // NOVO ESTADO: Controle do diálogo de importação em massa
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

    useEffect(() => {
        setSubitemForm(getInitialFormState(diretrizToEdit));
        
        // Ao editar, precisamos garantir que o itemForm reflita a estrutura ItemAquisicao
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

    const handleItemCurrencyChange = (rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setItemForm(prev => ({
            ...prev,
            valor_unitario: numericValue,
            rawValor: digits,
        }));
    };
    
    // Função para lidar com a mudança do input UASG, aplicando a formatação
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        // Remove caracteres não numéricos e armazena apenas os dígitos
        const rawDigits = rawValue.replace(/\D/g, '');
        setItemForm({ ...itemForm, uasg: rawDigits }); 
    };

    // Função auxiliar para gerar a chave de unicidade de um item
    const generateItemKey = (item: ItemAquisicao | typeof initialItemForm): string => {
        // Normaliza e remove espaços extras
        const normalize = (str: string) => 
            (str || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ');
            
        // Usamos a descrição completa para a chave de unicidade, mas mantemos os outros campos
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
            descricao_reduzida: itemForm.descricao_reduzida, // NOVO CAMPO
            valor_unitario: itemForm.valor_unitario,
            numero_pregao: itemForm.numero_pregao,
            uasg: itemForm.uasg,
            codigo_catmat: itemForm.codigo_catmat, 
        };
        
        // 1. Verificar duplicidade antes de adicionar/atualizar
        const newItemKey = generateItemKey(newItem);
        const isDuplicate = subitemForm.itens_aquisicao.some(existingItem => {
            // Se estiver editando, permite que o item atual mantenha sua chave
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

        // Resetar formulário de item
        setEditingItemId(null);
        setItemForm(initialItemForm);
    };

    const handleEditItem = (item: ItemAquisicao) => {
        setEditingItemId(item.id);
        setItemForm({
            descricao_item: item.descricao_item,
            descricao_reduzida: item.descricao_reduzida, // NOVO CAMPO
            valor_unitario: item.valor_unitario,
            rawValor: numberToRawDigits(item.valor_unitario),
            numero_pregao: item.numero_pregao,
            uasg: item.uasg,
            codigo_catmat: item.codigo_catmat, 
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

    // Função simplificada para receber APENAS os itens válidos do diálogo de importação
    const handleBulkImport = (newItems: ItemAquisicao[]) => {
        if (newItems.length === 0) {
            toast.info("Nenhum item novo para adicionar.");
            setIsBulkUploadOpen(false); 
            return;
        }
        
        // 1. Adiciona os novos itens válidos aos existentes
        setSubitemForm(prev => ({
            ...prev,
            itens_aquisicao: [...prev.itens_aquisicao, ...newItems],
        }));
        
        toast.success(`${newItems.length} itens importados com sucesso e adicionados à lista.`);

        // 2. Limpa o formulário de item individual
        setItemForm(initialItemForm);
        setEditingItemId(null);
        
        // 3. FECHAR O DIÁLOGO DE IMPORTAÇÃO EM MASSA
        setIsBulkUploadOpen(false); 
    };

    // Função para receber dados do catálogo de Subitem e atualizar o formulário
    const handleCatalogSelect = (catalogItem: { nr_subitem: string, nome_subitem: string, descricao_subitem: string | null }) => {
        setSubitemForm(prev => ({
            ...prev,
            nr_subitem: catalogItem.nr_subitem,
            nome_subitem: catalogItem.nome_subitem,
            descricao_subitem: catalogItem.descricao_subitem,
        }));
        setIsCatalogOpen(false);
    };
    
    // Função para receber dados do catálogo CATMAT e atualizar o formulário de item
    const handleCatmatSelect = (catmatItem: { code: string, description: string, short_description: string | null }) => {
        setItemForm(prev => ({
            ...prev,
            codigo_catmat: catmatItem.code,
            // Descrição Completa recebe a descrição completa do CATMAT
            descricao_item: catmatItem.description, 
            // Descrição Reduzida recebe o nome reduzido do CATMAT
            descricao_reduzida: catmatItem.short_description || '', 
        }));
        setIsCatmatCatalogOpen(false);
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
                                Catálogo ND
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

                    {/* Seção de Gerenciamento de Itens de Aquisição (Card 325 equivalente) */}
                    <Card className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base font-semibold">
                                {editingItemId ? "Editar Item de Aquisição" : "Adicionar Novo Item de Aquisição"}
                            </CardTitle>
                            <div className="flex gap-2">
                                {/* Botão Importar Excel permanece no cabeçalho do card */}
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
                        
                        {/* Formulário de Item - Reorganizado em três linhas lógicas */}
                        <div className="border p-3 rounded-lg bg-muted/50 space-y-4">
                            {/* PRIMEIRA LINHA: CATMAT, Botão CATMAT e Descrição Completa */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {/* Campo Código CATMAT (1 coluna) */}
                                <div className="space-y-2 col-span-1">
                                    <Label htmlFor="item-catmat">Cód. CATMAT</Label>
                                    <Input
                                        id="item-catmat"
                                        value={itemForm.codigo_catmat}
                                        onChange={(e) => setItemForm({ ...itemForm, codigo_catmat: e.target.value })}
                                        placeholder="Ex: 123456789"
                                        onKeyDown={handleEnterToNextField}
                                    />
                                    {/* NOVO: Botão Catálogo CATMAT movido para baixo do input Cód. CATMAT */}
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setIsCatmatCatalogOpen(true)}
                                        disabled={loading}
                                        className="w-full mt-2" // w-full para ocupar a largura da coluna
                                    >
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        Catálogo CATMAT
                                    </Button>
                                </div>
                                
                                {/* Campo Descrição Completa (4 colunas) */}
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

                            {/* SEGUNDA LINHA: Descrição Reduzida, Valor, Pregão, UASG */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {/* Campo Descrição Reduzida (2 colunas) */}
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="item-descricao-reduzida">Descrição Reduzida</Label>
                                    <Input
                                        id="item-descricao-reduzida"
                                        value={itemForm.descricao_reduzida}
                                        onChange={(e) => setItemForm({ ...itemForm, descricao_reduzida: e.target.value })}
                                        placeholder="Ex: Caneta Azul"
                                        onKeyDown={handleEnterToNextField}
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
                                    <p className="text-xs text-muted-foreground">
                                        * Valor estimado.
                                    </p>
                                </div>
                                
                                {/* Campo Pregão (1 coluna) */}
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
                                
                                {/* Campo UASG (1 coluna) */}
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
                            
                            {/* TERCEIRA LINHA: Botão de Ação */}
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
                        
                        {/* Tabela de Itens de Aquisição */}
                        {subitemForm.itens_aquisicao.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[5%]"></TableHead> {/* Coluna para o ícone de arrastar (vazio no formulário) */}
                                        <TableHead className="w-[30%]">Descrição Reduzida</TableHead>
                                        <TableHead className="w-[30%]">Descrição Completa</TableHead>
                                        <TableHead className="w-[10%] text-center">Cód. CATMAT</TableHead>
                                        <TableHead className="w-[10%] text-center">Pregão/Ref.</TableHead>
                                        <TableHead className="w-[10%] text-right">Valor Unitário</TableHead>
                                        <TableHead className="w-[5%] text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subitemForm.itens_aquisicao.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="w-[5%] text-center p-2">
                                                <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">{item.descricao_reduzida || 'N/A'}</TableCell>
                                            <TableCell className="font-medium text-sm">{item.descricao_item}</TableCell>
                                            <TableCell className="text-center text-sm">{item.codigo_catmat || 'N/A'}</TableCell>
                                            <TableCell className="text-center text-sm">{item.numero_pregao || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-bold text-primary">
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
            
            {/* Diálogo do Catálogo de Subitem */}
            <SubitemCatalogDialog 
                open={isCatalogOpen}
                onOpenChange={setIsCatalogOpen}
                onSelect={handleCatalogSelect}
            />
            
            {/* Diálogo do Catálogo CATMAT */}
            <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={handleCatmatSelect}
            />
            
            {/* NOVO: Diálogo de Importação em Massa */}
            <ItemAquisicaoBulkUploadDialog
                open={isBulkUploadOpen}
                onOpenChange={setIsBulkUploadOpen}
                onImport={handleBulkImport}
                // NOVO: Passa a lista de itens já existentes na diretriz atual
                existingItemsInDiretriz={subitemForm.itens_aquisicao} 
            />
        </Dialog>
    );
};

export default MaterialConsumoDiretrizFormDialog;