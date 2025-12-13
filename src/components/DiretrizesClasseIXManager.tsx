import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Pencil, Check, Trash2, Plus, XCircle, Truck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DiretrizClasseIX } from '@/types/diretrizesClasseIX';
import { parseInputToNumber, formatNumberForInput, formatInputWithThousands } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';

type Categoria = DiretrizClasseIX['categoria'];

interface EditableDiretriz extends DiretrizClasseIX {
  isNew?: boolean;
  isEditing?: boolean;
  valor_mnt_dia_input: string;
  valor_acionamento_mensal_input: string;
}

const CATEGORIAS: Categoria[] = [
  "Vtr Administrativa",
  "Vtr Operacional",
  "Motocicleta",
  "Vtr Blindada",
];

// --- Data Fetching and Management ---

const fetchDiretrizesData = async (userId: string, anoReferencia: number | 'latest'): Promise<{ diretrizes: DiretrizClasseIX[], availableYears: number[], currentYear: number }> => {
  // 1. Fetch all available years
  const { data: yearsData, error: yearsError } = await supabase
    .from('diretrizes_classe_ix')
    .select('ano_referencia')
    .eq('user_id', userId)
    .order('ano_referencia', { ascending: false });

  if (yearsError) throw yearsError;

  const currentYearDefault = new Date().getFullYear();
  const availableYears = Array.from(new Set((yearsData || []).map(d => d.ano_referencia))).sort((a, b) => b - a);
  
  let targetYear: number;
  if (anoReferencia === 'latest') {
    targetYear = availableYears.length > 0 ? availableYears[0] : currentYearDefault;
  } else {
    targetYear = anoReferencia;
  }
  
  if (!availableYears.includes(currentYearDefault)) {
      availableYears.unshift(currentYearDefault);
  }

  // 2. Fetch directives for the target year
  const { data: diretrizesData, error: diretrizesError } = await supabase
    .from('diretrizes_classe_ix')
    .select('*')
    .eq('user_id', userId)
    .eq('ano_referencia', targetYear)
    .order('categoria')
    .order('item');

  if (diretrizesError) throw diretrizesError;

  const loadedDiretrizes = (diretrizesData || []) as DiretrizClasseIX[];

  return { diretrizes: loadedDiretrizes, availableYears, currentYear: targetYear };
};

const useDiretrizesClasseIX = (anoReferencia: number | 'latest') => {
  const { user } = useSession();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const queryKey = ['diretrizesClasseIX', userId, anoReferencia];

  const { data, isLoading, error } = useQuery({
    queryKey: queryKey,
    queryFn: () => fetchDiretrizesData(userId!, anoReferencia),
    enabled: !!userId,
    initialData: { diretrizes: [], availableYears: [], currentYear: new Date().getFullYear() },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['diretrizesClasseIX', userId] });
  };

  return { data, isLoading, error, refresh };
};

// --- Component ---

export const DiretrizesClasseIXManager: React.FC = () => {
  const { user } = useSession();
  const [selectedYear, setSelectedYear] = useState<number | 'latest'>('latest');
  const { data, isLoading, refresh } = useDiretrizesClasseIX(selectedYear);
  const [editableList, setEditableList] = useState<EditableDiretriz[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  // State for new item
  const [newItem, setNewItem] = useState<Partial<EditableDiretriz>>({
    categoria: CATEGORIAS[0],
    item: '',
    valor_mnt_dia_input: '',
    valor_acionamento_mensal_input: '',
    isNew: true,
  });

  useEffect(() => {
    if (data.diretrizes.length > 0) {
      const list = data.diretrizes.map(d => ({
        ...d,
        valor_mnt_dia_input: formatNumberForInput(Number(d.valor_mnt_dia), 2),
        valor_acionamento_mensal_input: formatNumberForInput(Number(d.valor_acionamento_mensal), 2),
        isEditing: false,
      }));
      setEditableList(list);
      setSelectedYear(data.currentYear);
    } else if (data.currentYear && selectedYear === 'latest') {
        // If no directives found for the latest year, ensure the year selector is set to that year
        setSelectedYear(data.currentYear);
        setEditableList([]);
    } else if (data.currentYear && typeof selectedYear === 'number' && selectedYear === data.currentYear) {
        // If year is explicitly selected but no data, clear the list
        setEditableList([]);
    }
  }, [data.diretrizes, data.currentYear]);
  
  const handleYearChange = (yearStr: string) => {
    const year = parseInt(yearStr);
    setSelectedYear(year);
  };

  const handleFieldChange = (id: string, field: keyof EditableDiretriz, value: string) => {
    setEditableList(prev => prev.map(d => 
      d.id === id ? { ...d, [field]: value } : d
    ));
  };
  
  const handleNewItemChange = (field: keyof Partial<EditableDiretriz>, value: any) => {
    setNewItem(prev => ({ ...prev, [field]: value }));
  };

  const handleStartEdit = (id: string) => {
    setEditableList(prev => prev.map(d => 
      d.id === id ? { ...d, isEditing: true } : d
    ));
  };

  const handleCancelEdit = (id: string) => {
    setEditableList(prev => prev.map(d => {
      if (d.id === id) {
        // Reverte para os valores originais (se não for novo)
        const original = data.diretrizes.find(orig => orig.id === id);
        if (original) {
          return {
            ...original,
            valor_mnt_dia_input: formatNumberForInput(Number(original.valor_mnt_dia), 2),
            valor_acionamento_mensal_input: formatNumberForInput(Number(original.valor_acionamento_mensal), 2),
            isEditing: false,
          } as EditableDiretriz;
        }
      }
      return d;
    }).filter(d => !d.isNew)); // Remove se for novo e cancelado
  };
  
  const handleAddDirective = () => {
    if (!newItem.item || !newItem.categoria || !newItem.valor_mnt_dia_input || !newItem.valor_acionamento_mensal_input) {
      toast.error("Preencha todos os campos do novo item.");
      return;
    }
    
    const valorMntDia = parseInputToNumber(newItem.valor_mnt_dia_input || '0');
    const valorAcionamentoMensal = parseInputToNumber(newItem.valor_acionamento_mensal_input || '0');
    
    if (valorMntDia < 0 || valorAcionamentoMensal < 0) {
        toast.error("Valores de manutenção e acionamento devem ser positivos.");
        return;
    }
    
    const newId = `new-${Date.now()}`;
    const newDir: EditableDiretriz = {
        id: newId,
        user_id: user!.id,
        ano_referencia: data.currentYear,
        categoria: newItem.categoria!,
        item: newItem.item,
        valor_mnt_dia: valorMntDia,
        valor_acionamento_mensal: valorAcionamentoMensal,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isNew: true,
        isEditing: true, // Start editing immediately after adding locally
        valor_mnt_dia_input: newItem.valor_mnt_dia_input,
        valor_acionamento_mensal_input: newItem.valor_acionamento_mensal_input,
    };
    
    setEditableList(prev => [...prev, newDir]);
    setIsAddingNew(false);
    setNewItem({
        categoria: CATEGORIAS[0],
        item: '',
        valor_mnt_dia_input: '',
        valor_acionamento_mensal_input: '',
        isNew: true,
    });
  };

  const handleSave = async (diretriz: EditableDiretriz) => {
    if (!user) return;
    
    const valorMntDia = parseInputToNumber(diretriz.valor_mnt_dia_input);
    const valorAcionamentoMensal = parseInputToNumber(diretriz.valor_acionamento_mensal_input);
    
    if (valorMntDia < 0 || valorAcionamentoMensal < 0) {
        toast.error("Valores de manutenção e acionamento devem ser positivos.");
        return;
    }

    const payload = {
      ano_referencia: data.currentYear,
      categoria: diretriz.categoria,
      item: diretriz.item,
      valor_mnt_dia: valorMntDia,
      valor_acionamento_mensal: valorAcionamentoMensal,
      user_id: user.id,
      ativo: diretriz.ativo,
    };

    setIsSaving(true);
    try {
      if (diretriz.isNew) {
        const { error } = await supabase
          .from('diretrizes_classe_ix')
          .insert([payload]);
        if (error) throw error;
        toast.success("Diretriz criada com sucesso!");
      } else {
        const { error } = await supabase
          .from('diretrizes_classe_ix')
          .update(payload)
          .eq('id', diretriz.id);
        if (error) throw error;
        toast.success("Diretriz atualizada com sucesso!");
      }
      
      // 1. Atualiza o estado local imediatamente com os novos valores numéricos
      setEditableList(prev => prev.map(d => {
        if (d.id === diretriz.id) {
            return {
                ...d,
                valor_mnt_dia: valorMntDia,
                valor_acionamento_mensal: valorAcionamentoMensal,
                isEditing: false,
                isNew: false,
            };
        }
        return d;
      }));
      
      // 2. Força o refresh para sincronizar com o DB e atualizar o cache
      await refresh();
      
    } catch (error) {
      console.error("Erro ao salvar diretriz:", error);
      toast.error(diretriz.isNew ? "Erro ao criar diretriz." : "Erro ao atualizar diretriz.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar esta diretriz?")) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('diretrizes_classe_ix')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success("Diretriz deletada com sucesso!");
      await refresh();
    } catch (error) {
      console.error("Erro ao deletar diretriz:", error);
      toast.error("Erro ao deletar diretriz.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const sortedList = useMemo(() => {
    return editableList.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.item.localeCompare(b.item));
  }, [editableList]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          Diretrizes Classe IX (Motomecanização)
        </CardTitle>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <Label htmlFor="ano-referencia" className="text-sm">Ano:</Label>
                <Select 
                    value={data.currentYear.toString()} 
                    onValueChange={handleYearChange}
                    disabled={isLoading || isSaving}
                >
                    <SelectTrigger id="ano-referencia" className="w-[100px]">
                        <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                        {data.availableYears.map(year => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button 
                onClick={() => setIsAddingNew(true)} 
                disabled={isLoading || isSaving}
                size="sm"
            >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Categoria</TableHead>
                  <TableHead className="w-[30%]">Item</TableHead>
                  <TableHead className="w-[15%] text-right">Valor Mnt/Dia (R$)</TableHead>
                  <TableHead className="w-[15%] text-right">Acionamento/Mês (R$)</TableHead>
                  <TableHead className="w-[10%] text-center">Ativo</TableHead>
                  <TableHead className="w-[10%] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Novo Item */}
                {isAddingNew && (
                    <TableRow className="bg-yellow-50/50">
                        <TableCell>
                            <Select 
                                value={newItem.categoria} 
                                onValueChange={(value) => handleNewItemChange('categoria', value as Categoria)}
                            >
                                <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>
                            <Input 
                                value={newItem.item} 
                                onChange={(e) => handleNewItemChange('item', e.target.value)} 
                                placeholder="Nome do Item"
                                className="h-8"
                            />
                        </TableCell>
                        <TableCell>
                            <Input 
                                value={newItem.valor_mnt_dia_input} 
                                onChange={(e) => handleFieldChange(newId, 'valor_mnt_dia_input', formatInputWithThousands(e.target.value))} 
                                onBlur={(e) => handleFieldChange(newId, 'valor_mnt_dia_input', formatNumberForInput(parseInputToNumber(e.target.value), 2))}
                                placeholder="0,00"
                                className="h-8 text-right"
                            />
                        </TableCell>
                        <TableCell>
                            <Input 
                                value={newItem.valor_acionamento_mensal_input} 
                                onChange={(e) => handleFieldChange(newId, 'valor_acionamento_mensal_input', formatInputWithThousands(e.target.value))} 
                                onBlur={(e) => handleFieldChange(newId, 'valor_acionamento_mensal_input', formatNumberForInput(parseInputToNumber(e.target.value), 2))}
                                placeholder="0,00"
                                className="h-8 text-right"
                            />
                        </TableCell>
                        <TableCell className="text-center">
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                        </TableCell>
                        <TableCell className="text-center">
                            <div className="flex gap-1 justify-center">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleAddDirective} disabled={isSaving}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setIsAddingNew(false)} disabled={isSaving}>
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
                
                {/* Lista de Diretrizes Existentes */}
                {sortedList.map((diretriz) => (
                  <TableRow key={diretriz.id} className={cn(diretriz.isNew && "bg-blue-50/50")}>
                    <TableCell className="font-medium">{diretriz.categoria}</TableCell>
                    <TableCell>{diretriz.item}</TableCell>
                    
                    <TableCell>
                      {diretriz.isEditing ? (
                        <Input
                          value={diretriz.valor_mnt_dia_input}
                          onChange={(e) => handleFieldChange(diretriz.id, 'valor_mnt_dia_input', formatInputWithThousands(e.target.value))}
                          onBlur={(e) => handleFieldChange(diretriz.id, 'valor_mnt_dia_input', formatNumberForInput(parseInputToNumber(e.target.value), 2))}
                          className="h-8 text-right"
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="block text-right">{formatNumberForInput(Number(diretriz.valor_mnt_dia), 2)}</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      {diretriz.isEditing ? (
                        <Input
                          value={diretriz.valor_acionamento_mensal_input}
                          onChange={(e) => handleFieldChange(diretriz.id, 'valor_acionamento_mensal_input', formatInputWithThousands(e.target.value))}
                          onBlur={(e) => handleFieldChange(diretriz.id, 'valor_acionamento_mensal_input', formatNumberForInput(parseInputToNumber(e.target.value), 2))}
                          className="h-8 text-right"
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="block text-right">{formatNumberForInput(Number(diretriz.valor_acionamento_mensal), 2)}</span>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-center">
                        {diretriz.ativo ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                        )}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        {diretriz.isEditing || diretriz.isNew ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSave(diretriz)} disabled={isSaving}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleCancelEdit(diretriz.id)} disabled={isSaving}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleStartEdit(diretriz.id)} disabled={isSaving}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(diretriz.id)} disabled={isSaving}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                
                {data.diretrizes.length === 0 && !isAddingNew && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhuma diretriz configurada para o ano {data.currentYear}.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DiretrizesClasseIXManager;