import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Loader2, ChevronDown, ChevronUp, Package, List, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CurrencyInput from '@/components/CurrencyInput';
import { formatCurrency, numberToRawDigits } from '@/lib/formatUtils';
import { sanitizeError } from '@/lib/errorUtils';
import { useFormNavigation } from '@/hooks/useFormNavigation';
import {
  fetchMaterialConsumoSubitems,
  createMaterialConsumoSubitem,
  updateMaterialConsumoSubitem,
  deleteMaterialConsumoSubitem,
  fetchMaterialConsumoItems,
  createMaterialConsumoItem,
  updateMaterialConsumoItem,
  deleteMaterialConsumoItem,
} from '@/integrations/supabase/api';
import {
  MaterialConsumoSubitem,
  MaterialConsumoItem,
  MaterialConsumoSubitemInsert,
  MaterialConsumoSubitemUpdate,
  MaterialConsumoItemInsert,
  MaterialConsumoItemUpdate,
} from '@/types/materialConsumo';
import SubitemCatalogDialog from '@/components/materialConsumo/SubitemCatalogDialog';

interface MaterialConsumoFormProps {
  selectedYear: number;
}

// --- Componente de Formulário de Item ---

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subitemId: string;
  itemToEdit: MaterialConsumoItem | null;
  onSave: (item: MaterialConsumoItemInsert & { id?: string }) => void;
  loading: boolean;
}

const ItemFormDialog: React.FC<ItemFormDialogProps> = ({ open, onOpenChange, subitemId, itemToEdit, onSave, loading }) => {
  const [descricao, setDescricao] = useState('');
  const [precoUnitarioRaw, setPrecoUnitarioRaw] = useState('');
  const [pregao, setPregao] = useState('');
  const [uasg, setUasg] = useState('');
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (itemToEdit) {
      setDescricao(itemToEdit.descricao);
      setPrecoUnitarioRaw(numberToRawDigits(itemToEdit.preco_unitario));
      setPregao(itemToEdit.pregao || '');
      setUasg(itemToEdit.uasg || '');
    } else {
      setDescricao('');
      setPrecoUnitarioRaw('');
      setPregao('');
      setUasg('');
    }
  }, [itemToEdit, open]);

  const handleSave = () => {
    const precoUnitario = parseFloat(precoUnitarioRaw) || 0;

    if (!descricao.trim()) {
      toast.error('A descrição do item é obrigatória.');
      return;
    }
    if (precoUnitario <= 0) {
      toast.error('O preço unitário deve ser maior que zero.');
      return;
    }

    onSave({
      id: itemToEdit?.id,
      subitem_id: subitemId,
      descricao: descricao.trim(),
      preco_unitario: precoUnitario,
      pregao: pregao.trim() || null,
      uasg: uasg.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{itemToEdit ? 'Editar Item' : 'Novo Item de Consumo'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição do Item</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Detergente, Caneta Esferográfica"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="precoUnitario">Preço Unitário (R$)</Label>
            <CurrencyInput
              id="precoUnitario"
              rawDigits={precoUnitarioRaw}
              onChange={setPrecoUnitarioRaw}
              onKeyDown={handleEnterToNextField}
              placeholder="0,00"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pregao">Pregão (Opcional)</Label>
            <Input
              id="pregao"
              value={pregao}
              onChange={(e) => setPregao(e.target.value)}
              placeholder="Ex: 01/2024"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uasg">UASG (Opcional)</Label>
            <Input
              id="uasg"
              value={uasg}
              onChange={(e) => setUasg(e.target.value)}
              placeholder="Ex: 160001"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline" disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- Componente Principal ---

const MaterialConsumoForm: React.FC<MaterialConsumoFormProps> = ({ selectedYear }) => {
  const queryClient = useQueryClient();
  const [isSubitemFormOpen, setIsSubitemFormOpen] = useState(false);
  const [subitemToEdit, setSubitemToEdit] = useState<MaterialConsumoSubitem | null>(null);
  
  // Novos estados para os campos do subitem
  const [newSubitemNome, setNewSubitemNome] = useState('');
  const [newSubitemNr, setNewSubitemNr] = useState('');
  const [newSubitemDescricao, setNewSubitemDescricao] = useState('');
  
  const [isCatalogOpen, setIsCatalogOpen] = useState(false); // Novo estado para o catálogo

  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<MaterialConsumoItem | null>(null);
  const [currentSubitemId, setCurrentSubitemId] = useState<string | null>(null);

  const [openSubitems, setOpenSubitems] = useState<Record<string, boolean>>({});
  
  // CORREÇÃO: Importa e utiliza o hook useFormNavigation
  const { handleEnterToNextField } = useFormNavigation();

  // Fetch Subitems
  const { data: subitems = [], isLoading: isLoadingSubitems, error: subitemsError } = useQuery<MaterialConsumoSubitem[]>({
    queryKey: ['materialConsumoSubitems'],
    queryFn: fetchMaterialConsumoSubitems,
  });

  // Fetch Items for a specific Subitem
  const { data: items = [], isLoading: isLoadingItems } = useQuery<MaterialConsumoItem[]>({
    queryKey: ['materialConsumoItems', currentSubitemId],
    queryFn: () => fetchMaterialConsumoItems(currentSubitemId!),
    enabled: !!currentSubitemId,
  });

  // Mutations for Subitems
  const subitemMutation = useMutation({
    mutationFn: (data: MaterialConsumoSubitemInsert & { id?: string }) => {
      if (data.id) {
        return updateMaterialConsumoSubitem(data.id, data as MaterialConsumoSubitemUpdate);
      }
      return createMaterialConsumoSubitem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialConsumoSubitems'] });
      setIsSubitemFormOpen(false);
      setSubitemToEdit(null);
      setNewSubitemNome('');
      setNewSubitemNr('');
      setNewSubitemDescricao('');
      toast.success(subitemToEdit ? 'Subitem atualizado!' : 'Subitem criado!');
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const deleteSubitemMutation = useMutation({
    mutationFn: (id: string) => deleteMaterialConsumoSubitem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialConsumoSubitems'] });
      toast.success('Subitem excluído com sucesso.');
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  // Mutations for Items
  const itemMutation = useMutation({
    mutationFn: (data: MaterialConsumoItemInsert & { id?: string }) => {
      if (data.id) {
        return updateMaterialConsumoItem(data.id, data as MaterialConsumoItemUpdate);
      }
      return createMaterialConsumoItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialConsumoItems', currentSubitemId] });
      setIsItemFormOpen(false);
      setItemToEdit(null);
      toast.success(itemToEdit ? 'Item atualizado!' : 'Item criado!');
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteMaterialConsumoItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialConsumoItems', currentSubitemId] });
      toast.success('Item excluído com sucesso.');
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const handleSaveSubitem = () => {
    const trimmedName = newSubitemNome.trim();
    if (!trimmedName) {
      toast.error('O nome do subitem é obrigatório.');
      return;
    }
    
    // Validação de duplicidade (apenas se for criação ou se o nome for alterado)
    const isDuplicate = subitems.some(
      (s) => s.nome.toLowerCase() === trimmedName.toLowerCase() && s.id !== subitemToEdit?.id
    );

    if (isDuplicate) {
      toast.error('Já existe um subitem com este nome.');
      return;
    }

    subitemMutation.mutate({ 
      id: subitemToEdit?.id, 
      nome: trimmedName,
      nr_subitem: newSubitemNr.trim() || null,
      descricao: newSubitemDescricao.trim() || null,
    });
  };

  const handleEditSubitem = (subitem: MaterialConsumoSubitem) => {
    setSubitemToEdit(subitem);
    setNewSubitemNome(subitem.nome);
    setNewSubitemNr(subitem.nr_subitem || '');
    setNewSubitemDescricao(subitem.descricao || '');
    setIsSubitemFormOpen(true);
  };

  const handleDeleteSubitem = (id: string, nome: string) => {
    if (confirm(`Tem certeza que deseja excluir o subitem "${nome}" e TODOS os itens associados? Esta ação é irreversível.`)) {
      deleteSubitemMutation.mutate(id);
    }
  };

  const handleOpenNewItem = (subitemId: string) => {
    setCurrentSubitemId(subitemId);
    setItemToEdit(null);
    setIsItemFormOpen(true);
  };

  const handleEditItem = (item: MaterialConsumoItem) => {
    setCurrentSubitemId(item.subitem_id);
    setItemToEdit(item);
    setIsItemFormOpen(true);
  };

  const handleSaveItem = (itemData: MaterialConsumoItemInsert & { id?: string }) => {
    itemMutation.mutate(itemData);
  };

  const handleDeleteItem = (id: string, descricao: string) => {
    if (confirm(`Tem certeza que deseja excluir o item "${descricao}"?`)) {
      deleteItemMutation.mutate(id);
    }
  };

  const handleToggleSubitem = (subitemId: string) => {
    setOpenSubitems(prev => {
      const isOpen = prev[subitemId];
      if (!isOpen) {
        setCurrentSubitemId(subitemId); // Define o subitem atual para carregar os itens
      }
      return { ...prev, [subitemId]: !isOpen };
    });
  };
  
  // NOVO: Handler para seleção de subitem do catálogo
  const handleSelectSubitemFromCatalog = (subitem: MaterialConsumoSubitem) => {
    // Se estiver editando, limpamos o ID para forçar a criação de um novo registro
    // baseado no catálogo, a menos que o usuário estivesse editando este subitem específico.
    if (subitemToEdit && subitemToEdit.id !== subitem.id) {
        setSubitemToEdit(null);
    }
    
    // Preenche os campos do formulário principal
    setNewSubitemNome(subitem.nome);
    setNewSubitemNr(subitem.nr_subitem || '');
    setNewSubitemDescricao(subitem.descricao || '');
    
    // Fecha o catálogo e mantém o formulário de subitem aberto
    setIsCatalogOpen(false);
  };

  if (isLoadingSubitems) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Carregando subitens...</p>
      </div>
    );
  }

  if (subitemsError) {
    return <Card className="p-4 text-center text-red-500">Erro ao carregar subitens: {sanitizeError(subitemsError)}</Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Subitens de Material de Consumo</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => { setSubitemToEdit(null); setNewSubitemNome(''); setNewSubitemNr(''); setNewSubitemDescricao(''); setIsSubitemFormOpen(true); }}
              disabled={subitemMutation.isPending}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Subitem
            </Button>
          </div>
          
          {subitems.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum subitem cadastrado. Comece adicionando um!</p>
          ) : (
            <div className="space-y-2">
              {subitems.map(subitem => (
                <Collapsible
                  key={subitem.id}
                  open={openSubitems[subitem.id] || false}
                  onOpenChange={() => handleToggleSubitem(subitem.id)}
                  className="border rounded-lg"
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-medium">{subitem.nome}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {/* Nota: Não temos a contagem de itens aqui sem um fetch adicional, 
                          então mantemos a exibição simples ou removemos se for misleading. */}
                        </span>
                        {openSubitems[subitem.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t bg-muted/20 p-4">
                    <div className="space-y-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSubitem(subitem)}
                          disabled={subitemMutation.isPending || deleteSubitemMutation.isPending}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Editar Subitem
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteSubitem(subitem.id, subitem.nome)}
                          disabled={subitemMutation.isPending || deleteSubitemMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir Subitem
                        </Button>
                      </div>

                      <Card className="p-4">
                        <CardTitle className="text-base font-semibold mb-3">Itens Cadastrados em "{subitem.nome}"</CardTitle>
                        
                        {isLoadingItems && currentSubitemId === subitem.id ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        ) : items.length === 0 ? (
                          <p className="text-center text-muted-foreground text-sm">Nenhum item cadastrado neste subitem.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Preço Unitário</TableHead>
                                <TableHead className="text-center">Pregão</TableHead>
                                <TableHead className="text-center">UASG</TableHead>
                                <TableHead className="w-[100px] text-center">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map(item => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.descricao}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.preco_unitario)}</TableCell>
                                  <TableCell className="text-center text-xs">{item.pregao || '-'}</TableCell>
                                  <TableCell className="text-center text-xs">{item.uasg || '-'}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex justify-center gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)} disabled={itemMutation.isPending || deleteItemMutation.isPending}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id, item.descricao)} disabled={itemMutation.isPending || deleteItemMutation.isPending}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                        
                        <div className="flex justify-end mt-4">
                          <Button
                            type="button"
                            onClick={() => handleOpenNewItem(subitem.id)}
                            disabled={itemMutation.isPending || deleteItemMutation.isPending}
                            variant="outline"
                            size="sm"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Item
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Subitem */}
      <Dialog open={isSubitemFormOpen} onOpenChange={setIsSubitemFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{subitemToEdit ? 'Editar Subitem' : 'Novo Subitem de Consumo'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            
            {/* Botão para abrir o Catálogo */}
            {subitems.length > 0 && (
              <Button 
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsCatalogOpen(true)}
                className="w-full"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Buscar no Catálogo de Subitens ({subitems.length})
              </Button>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="nr_subitem">Nr Subitem (Opcional)</Label>
              <Input
                id="nr_subitem"
                value={newSubitemNr}
                onChange={(e) => setNewSubitemNr(e.target.value)}
                placeholder="Ex: 01.01.01"
                onKeyDown={handleEnterToNextField}
                disabled={subitemMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Subitem</Label>
              <Input
                id="nome"
                value={newSubitemNome}
                onChange={(e) => setNewSubitemNome(e.target.value)}
                placeholder="Ex: Material de Limpeza"
                onKeyDown={handleEnterToNextField}
                disabled={subitemMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do Subitem (Opcional)</Label>
              <Input
                id="descricao"
                value={newSubitemDescricao}
                onChange={(e) => setNewSubitemDescricao(e.target.value)}
                placeholder="Detalhes sobre a categoria de consumo"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveSubitem()}
                disabled={subitemMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSubitemFormOpen(false)} variant="outline" disabled={subitemMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSubitem} disabled={subitemMutation.isPending}>
              {subitemMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Item */}
      <ItemFormDialog
        open={isItemFormOpen}
        onOpenChange={setIsItemFormOpen}
        subitemId={currentSubitemId || ''}
        itemToEdit={itemToEdit}
        onSave={handleSaveItem}
        loading={itemMutation.isPending || deleteItemMutation.isPending}
      />

      {/* Catálogo de Subitens */}
      <SubitemCatalogDialog
        open={isCatalogOpen}
        onOpenChange={setIsCatalogOpen}
        subitems={subitems}
        onSelectSubitem={handleSelectSubitemFromCatalog}
      />
    </div>
  );
};

export default MaterialConsumoForm;