import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Package, Minus, ChevronDown } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatNumber } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    calculateItemTotals, 
    calculateLoteTotals,
    generateMaterialConsumoMemoriaCalculo,
    generateConsolidatedMaterialConsumoMemoriaCalculo,
    MaterialConsumoRegistro,
    MaterialConsumoFormState,
    CalculatedMaterialConsumo,
    ConsolidatedMaterialConsumoRecord,
    SelectedItemAquisicao,
    AcquisitionGroup, // NOVO TIPO
} from "@/lib/materialConsumoUtils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import MaterialConsumoSubitemSelectorDialog from "@/components/MaterialConsumoSubitemSelectorDialog";
import { ConsolidatedMaterialConsumoMemoria } from "@/components/ConsolidatedMaterialConsumoMemoria"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear"; 
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; 
// import AcquisitionGroupDialog from "@/components/AcquisitionGroupDialog"; // REMOVIDO

// Tipos de dados
type MaterialConsumoRegistroDB = Tables<'material_consumo_registros'>; 

// Tipo de dados para OmSelector
interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

// NOVO TIPO: Representa um lote consolidado de registros (Subitem)
interface ConsolidatedMaterialConsumo extends ConsolidatedMaterialConsumoRecord {
    groupKey: string; 
}

const initialFormState: MaterialConsumoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    acquisition_groups: [], // Alterado para grupos
};

// Helper function to compare form data structures
const compareFormData = (data1: MaterialConsumoFormState, data2: MaterialConsumoFormState) => {
    // Compare todos os campos relevantes
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.efetivo !== data2.efetivo || 
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_destino !== data2.om_destino || 
        data1.ug_destino !== data2.ug_destino || 
        data1.fase_atividade !== data2.fase_atividade ||
        data1.acquisition_groups.length !== data2.acquisition_groups.length
    ) {
        return true;
    }
    
    // Comparar detalhes dos grupos (IDs, nomes e itens)
    const groups1 = data1.acquisition_groups.map(g => 
        `${g.id}-${g.nome}|${g.itens.map(t => `${t.id}-${t.quantidade_solicitada}`).sort().join(',')}`
    ).sort().join('||');
    
    const groups2 = data2.acquisition_groups.map(g => 
        `${g.id}-${g.nome}|${g.itens.map(t => `${t.id}-${t.quantidade_solicitada}`).sort().join(',')}`
    ).sort().join('||');
    
    if (groups1 !== groups2) {
        return true;
    }
    
    return false;
};

// Tipo de dados para o retorno do seletor de subitens (agora permite múltiplos subitens)
interface SelectedItemAquisicaoAugmented extends SelectedItemAquisicao {
    // Já herda todos os campos necessários
}

const MaterialConsumoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<MaterialConsumoFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null); // ID do grupo de registros (Subitem) que está sendo editado
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    
    // NOVO ESTADO: Armazena o grupo completo a ser excluído/substituído
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedMaterialConsumo | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedMaterialConsumo | null>(null); 
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos (CalculatedMaterialConsumo)
    const [pendingMaterialConsumo, setPendingMaterialConsumo] = useState<CalculatedMaterialConsumo[]>([]);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingMaterialConsumo
    const [lastStagedFormData, setLastStagedFormData] = useState<MaterialConsumoFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida e OM Destino
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    // ESTADOS PARA GERENCIAMENTO INLINE DE GRUPO
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [currentGroup, setCurrentGroup] = useState<AcquisitionGroup | null>(null);
    const [showSubitemSelector, setShowSubitemSelector] = useState(false);
    
    // NEW STATE for expanding groups in Section 2 list
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({}); 
    
    // Busca o ano padrão para o seletor de subitens
    const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear('operacional');
    const selectedYear = defaultYearData?.year || new Date().getFullYear();

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Registros de Material de Consumo
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<MaterialConsumoRegistroDB[]>({
        queryKey: ['materialConsumoRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('material_consumo_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    // NOVO MEMO: Consolida os registros por lote de solicitação (Subitem)
    const consolidatedRegistros = useMemo<ConsolidatedMaterialConsumo[]>(() => {
        if (!registros) return [];

        const groups = registros.reduce((acc, registro) => {
            // Chave de consolidação: Subitem + todos os campos que definem o lote de solicitação
            const key = [
                registro.diretriz_id, // Chave principal de agrupamento (Subitem)
                registro.organizacao,
                registro.ug,
                registro.om_detentora,
                registro.ug_detentora,
                registro.dias_operacao,
                registro.efetivo,
                registro.fase_atividade,
            ].join('|');

            if (!acc[key]) {
                acc[key] = {
                    groupKey: key, 
                    diretriz_id: registro.diretriz_id,
                    nr_subitem: registro.nr_subitem,
                    nome_subitem: registro.nome_subitem,
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora,
                    ug_detentora: registro.ug_detentora,
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo || 0,
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND30: 0,
                    totalND39: 0,
                };
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND30 += Number(registro.valor_nd_30 || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedMaterialConsumo>);

        // Ordenar por Subitem
        return Object.values(groups).sort((a, b) => a.nr_subitem.localeCompare(b.nr_subitem));
    }, [registros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    // 1. Mutation for saving multiple new records (INSERT)
    const insertMutation = useMutation({
        mutationFn: async (newRecords: CalculatedMaterialConsumo[]) => {
            // Mapear CalculatedMaterialConsumo para TablesInsert
            const recordsToInsert: TablesInsert<'material_consumo_registros'>[] = newRecords.map(r => {
                
                return {
                    p_trab_id: r.p_trab_id,
                    diretriz_id: r.diretriz_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    efetivo: r.efetivo,
                    fase_atividade: r.fase_atividade,
                    
                    nr_subitem: r.nr_subitem,
                    nome_subitem: r.nome_subitem,
                    itens_aquisicao_selecionados: r.itens_aquisicao_selecionados,
                    
                    valor_total: r.valor_total,
                    valor_nd_30: r.valor_nd_30,
                    valor_nd_39: r.valor_nd_39,
                    detalhamento: r.detalhamento,
                    detalhamento_customizado: r.detalhamento_customizado,
                };
             });

            const { error } = await supabase
                .from('material_consumo_registros')
                .insert(recordsToInsert);

            if (error) throw error;
            
            return recordsToInsert;
        },
        onSuccess: () => {
            toast.success(`Sucesso! ${pendingMaterialConsumo.length} registro(s) de Material de Consumo adicionado(s).`);
            setPendingMaterialConsumo([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            
            // Manter campos de contexto (OMs, Dias, Efetivo, Fase)
            setFormData(prev => ({
                ...prev,
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                om_destino: prev.om_destino,
                ug_destino: prev.ug_destino,
                dias_operacao: prev.dias_operacao,
                efetivo: prev.efetivo,
                fase_atividade: prev.fase_atividade,
                acquisition_groups: [], // Limpa os grupos após salvar
            }));
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros.", { description: sanitizeError(error) });
        }
    });

    // 2. Mutation for replacing an entire group of records (UPDATE/REPLACE)
    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedMaterialConsumo[] }) => {
            // 1. Delete old records
            const { error: deleteError } = await supabase
                .from('material_consumo_registros')
                .delete()
                .in('id', oldIds);
            if (deleteError) throw deleteError;
            
            // 2. Insert new records
            const recordsToInsert: TablesInsert<'material_consumo_registros'>[] = newRecords.map(r => {
                return {
                    p_trab_id: r.p_trab_id,
                    diretriz_id: r.diretriz_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    efetivo: r.efetivo,
                    fase_atividade: r.fase_atividade,
                    
                    nr_subitem: r.nr_subitem,
                    nome_subitem: r.nome_subitem,
                    itens_aquisicao_selecionados: r.itens_aquisicao_selecionados,
                    
                    valor_total: r.valor_total,
                    valor_nd_30: r.valor_nd_30,
                    valor_nd_39: r.valor_nd_39,
                    detalhamento: r.detalhamento,
                    detalhamento_customizado: r.detalhamento_customizado,
                };
             });

            const { error: insertError } = await supabase
                .from('material_consumo_registros')
                .insert(recordsToInsert);

            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo atualizado com sucesso!");
            setEditingId(null);
            setPendingMaterialConsumo([]);
            setGroupToReplace(null);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => {
            toast.error("Falha ao atualizar lote.", { description: sanitizeError(error) });
        }
    });

    // 3. Mutation for deleting a group of records
    const handleDeleteMutation = useMutation({
        mutationFn: async (recordIds: string[]) => {
            const { error } = await supabase
                .from('material_consumo_registros')
                .delete()
                .in('id', recordIds);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setGroupToDelete(null);
        },
        onError: (error) => {
            toast.error("Falha ao excluir lote.", { description: sanitizeError(error) });
        }
    });
    
    // Efeito de inicialização da OM Favorecida e OM Destino
    useEffect(() => {
        if (ptrabData && !editingId) {
            // Modo Novo Registro: Limpar
            setFormData(prev => ({
                ...initialFormState,
                om_favorecida: "", 
                ug_favorecida: "", 
                om_destino: "",
                ug_destino: "",
            }));
            setSelectedOmFavorecidaId(undefined); 
            setSelectedOmDestinoId(undefined);
            
        } else if (ptrabData && editingId) {
            // Modo Edição: Preencher
            const omFavorecida = oms?.find(om => om.nome_om === formData.om_favorecida && om.codug_om === formData.ug_favorecida);
            setSelectedOmFavorecidaId(omFavorecida?.id);
            
            const omDestino = oms?.find(om => om.nome_om === formData.om_destino && om.codug_om === formData.ug_destino);
            setSelectedOmDestinoId(omDestino?.id);
        }
    }, [ptrabData, oms, editingId]);
    
    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    // Este cálculo é usado apenas para exibir o total consolidado no formulário (Seção 2)
    const calculos = useMemo(() => {
        if (!ptrabData || formData.acquisition_groups.length === 0) {
            return {
                totalGeral: 0,
                totalND30: 0,
                totalND39: 0,
                memoria: "Adicione pelo menos um Grupo de Aquisição e preencha os dados de solicitação.",
            };
        }
        
        try {
            // Agrega todos os itens de todos os grupos para calcular o total geral do formulário
            const allItems = formData.acquisition_groups.flatMap(group => group.itens);
            const totals = calculateLoteTotals(allItems);
            
            return {
                ...totals,
                memoria: "Cálculo pronto para ser estagiado.",
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0,
                totalND30: 0,
                totalND39: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, ptrabData, ptrabId]);
    
    // Verifica se o formulário está "sujo" (diferente do lastStagedFormData)
    const isMaterialConsumoDirty = useMemo(() => {
        if (pendingMaterialConsumo.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }
        return false;
    }, [formData, pendingMaterialConsumo.length, lastStagedFormData]);
    
    // Cálculo do total de todos os itens pendentes
    const totalPendingMaterialConsumo = useMemo(() => {
        return pendingMaterialConsumo.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingMaterialConsumo]);
    
    // Calculate the total number of individual acquisition items selected across all groups
    const totalAcquisitionItems = useMemo(() => {
        return formData.acquisition_groups.reduce((sum, group) => sum + group.itens.length, 0);
    }, [formData.acquisition_groups]);
    
    // =================================================================
    // HANDLERS DE AÇÃO
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setGroupToReplace(null);
        setFormData(prev => ({
            ...initialFormState,
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_destino: prev.om_destino,
            ug_destino: prev.ug_destino,
            dias_operacao: 0,
            efetivo: 0,
            fase_atividade: "",
            acquisition_groups: [],
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDestinoId(undefined);
        setLastStagedFormData(null); 
        setIsAddingGroup(false); // Garante que o formulário inline seja fechado
        setCurrentGroup(null);
    };
    
    const handleClearPending = () => {
        setPendingMaterialConsumo([]);
        setLastStagedFormData(null); 
        setEditingId(null);
        setGroupToReplace(null);
        resetForm();
    };
    
    const handleToggleGroupExpand = (groupId: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId],
        }));
    };

    // --- Lógica de Gerenciamento de Grupos de Aquisição (INLINE) ---
    
    const handleStartAddGroup = () => {
        if (pendingMaterialConsumo.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de adicionar um novo grupo.");
            return;
        }
        setCurrentGroup({
            id: crypto.randomUUID(),
            nome: "",
            finalidade: "",
            itens: [],
        });
        setIsAddingGroup(true);
    };
    
    const handleStartEditGroup = (groupId: string) => {
        if (pendingMaterialConsumo.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um grupo.");
            return;
        }
        const group = formData.acquisition_groups.find(g => g.id === groupId);
        if (group) {
            setCurrentGroup(group);
            setIsAddingGroup(true);
        }
    };
    
    const handleCancelGroupEdit = () => {
        setCurrentGroup(null);
        setIsAddingGroup(false);
    };
    
    const handleSaveGroup = () => {
        if (!currentGroup || !currentGroup.nome.trim()) {
            toast.error("O nome do Grupo de Aquisição é obrigatório.");
            return;
        }
        
        setFormData(prev => {
            const existingIndex = prev.acquisition_groups.findIndex(g => g.id === currentGroup.id);
            if (existingIndex !== -1) {
                // Edição
                const newGroups = [...prev.acquisition_groups];
                newGroups[existingIndex] = currentGroup;
                return { ...prev, acquisition_groups: newGroups };
            } else {
                // Novo
                return { ...prev, acquisition_groups: [...prev.acquisition_groups, currentGroup] };
            }
        });
        
        toast.success(`Grupo "${currentGroup.nome}" salvo!`);
        handleCancelGroupEdit();
    };
    
    const handleRemoveGroup = (groupId: string) => {
        if (pendingMaterialConsumo.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de remover um grupo.");
            return;
        }
        setFormData(prev => ({
            ...prev,
            acquisition_groups: prev.acquisition_groups.filter(g => g.id !== groupId),
        }));
        toast.success("Grupo de aquisição removido.");
    };
    
    const handleItemQuantityChange = (groupId: string, itemId: string, quantity: number) => {
        // Permite 0, mas não negativo
        if (quantity < 0) return;
        
        setFormData(prev => {
            const newGroups = prev.acquisition_groups.map(group => {
                if (group.id === groupId) {
                    const newItems = group.itens.map(item => 
                        item.id === itemId ? { ...item, quantidade_solicitada: quantity } : item
                    );
                    return { ...group, itens: newItems };
                }
                return group;
            });
            return { ...prev, acquisition_groups: newGroups };
        });
    };
    
    const handleRemoveItemFromGroup = (groupId: string, itemId: string) => {
        setFormData(prev => {
            const newGroups = prev.acquisition_groups.map(group => {
                if (group.id === groupId) {
                    const newItems = group.itens.filter(item => item.id !== itemId);
                    return { ...group, itens: newItems };
                }
                return group;
            }).filter(group => group.itens.length > 0); // Remove o grupo se ficar vazio
            
            return { ...prev, acquisition_groups: newGroups };
        });
        toast.info("Item removido do grupo.");
    };
    
    const handleSubitemSelected = (selectedItems: SelectedItemAquisicaoAugmented[]) => {
        if (!currentGroup) return;
        
        // 1. Mapeia os itens selecionados para o formato AcquisitionGroup.itens
        // Preserva a quantidade de itens que já estavam no grupo
        const existingItemMap = new Map(currentGroup.itens.map(item => [item.id, item]));
        
        const newItems: SelectedItemAquisicao[] = selectedItems.map(item => {
            const existing = existingItemMap.get(item.id);
            return {
                ...item,
                quantidade_solicitada: existing ? existing.quantidade_solicitada : 1, // Preserva ou inicializa
            };
        });
        
        setCurrentGroup(prev => (prev ? { ...prev, itens: newItems } : null));
        setShowSubitemSelector(false);
        toast.success(`${newItems.length} itens importados para o grupo. Salve o grupo para confirmar.`);
    };
    
    // --- Lógica de Edição de Registros Salvos (ConsolidatedMaterialConsumo) ---

    const handleEdit = (group: ConsolidatedMaterialConsumo) => {
        if (pendingMaterialConsumo.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        // Limpa estados pendentes
        setPendingMaterialConsumo([]);
        setLastStagedFormData(null);
        
        // Define o modo edição
        setEditingId(group.records[0].id); 
        setGroupToReplace(group); 
        
        // 1. Configurar OMs
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        // 2. Reconstruir a lista de itens selecionados a partir do primeiro registro do grupo
        const firstRecord = group.records[0];
        const selectedItensFromRecords: SelectedItemAquisicao[] = (firstRecord.itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]) || [];

        // 3. Criar um Grupo de Aquisição temporário para edição
        const tempGroup: AcquisitionGroup = {
            id: crypto.randomUUID(), // Novo ID temporário para o grupo de edição
            nome: `Edição: ${group.nr_subitem} - ${group.nome_subitem}`,
            finalidade: `Registro original do Subitem ${group.nr_subitem}`,
            itens: selectedItensFromRecords,
        };

        // 4. Populate formData
        const newFormData: MaterialConsumoFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo || 0, 
            fase_atividade: group.fase_atividade || "",
            acquisition_groups: [tempGroup], // Apenas o grupo de edição
        };
        setFormData(newFormData);
        
        // 5. Gerar o item pendente (staging) imediatamente com os dados originais
        setLastStagedFormData(newFormData); 
        
        toast.info("Modo Edição ativado. Altere os dados na Seção 2 e clique em 'Recalcular/Revisar Lote'.");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedMaterialConsumo) => {
        setGroupToDelete(group); 
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação básica
            if (formData.acquisition_groups.length === 0) {
                throw new Error("Adicione pelo menos um Grupo de Aquisição na Seção 2.");
            }
            if (formData.dias_operacao <= 0) {
                throw new Error("O número de dias deve ser maior que zero.");
            }
            if (formData.efetivo <= 0) {
                throw new Error("O efetivo deve ser maior que zero.");
            }
            if (!formData.om_favorecida || !formData.ug_favorecida) {
                throw new Error("A OM Favorecida é obrigatória.");
            }
            if (!formData.om_destino || !formData.ug_destino) {
                throw new Error("A OM Destino do Recurso é obrigatória.");
            }
            
            // 2. Agrupar todos os itens de todos os grupos por Subitem (diretriz_id)
            const allItems = formData.acquisition_groups.flatMap(group => group.itens);
            
            const groupsToProcess = allItems.reduce((acc, item) => {
                // Ignora itens com quantidade zero
                if (item.quantidade_solicitada <= 0) return acc;
                
                const key = item.diretriz_id;
                if (!acc[key]) {
                    acc[key] = {
                        diretriz_id: item.diretriz_id,
                        nr_subitem: item.nr_subitem,
                        nome_subitem: item.nome_subitem,
                        items: [],
                    };
                }
                acc[key].items.push(item);
                return acc;
            }, {} as Record<string, {
                diretriz_id: string;
                nr_subitem: string;
                nome_subitem: string;
                items: SelectedItemAquisicao[];
            }>);
            
            const newPendingItems: CalculatedMaterialConsumo[] = [];
            
            // 3. Gerar um registro CalculatedMaterialConsumo para CADA Subitem (diretriz_id)
            Object.values(groupsToProcess).forEach(subitemGroup => {
                const totals = calculateLoteTotals(subitemGroup.items);
                
                // Preservar customização de memória se estiver em modo edição
                let customDetalhamento: string | null = null;
                let tempId: string = crypto.randomUUID();
                
                if (editingId && groupToReplace) {
                    // Estamos editando um registro existente (que é um Subitem)
                    // O groupToReplace é o ConsolidatedMaterialConsumo original.
                    // Se o Subitem atual (subitemGroup.diretriz_id) for o mesmo que o Subitem original,
                    // preservamos o ID e o detalhamento customizado.
                    if (subitemGroup.diretriz_id === groupToReplace.diretriz_id) {
                        const originalRecord = groupToReplace.records[0];
                        tempId = originalRecord.id;
                        customDetalhamento = originalRecord.detalhamento_customizado;
                    }
                    // Se for um Subitem diferente, ele é um novo registro, mesmo em modo edição.
                }
                
                const calculatedFormData: CalculatedMaterialConsumo = {
                    tempId: tempId, 
                    p_trab_id: ptrabId!,
                    diretriz_id: subitemGroup.diretriz_id,
                    organizacao: formData.om_favorecida, 
                    ug: formData.ug_favorecida, 
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    nr_subitem: subitemGroup.nr_subitem,
                    nome_subitem: subitemGroup.nome_subitem,
                    itens_aquisicao_selecionados: subitemGroup.items as unknown as Tables<'material_consumo_registros'>['itens_aquisicao_selecionados'],
                    
                    valor_total: totals.totalGeral,
                    valor_nd_30: totals.totalND30,
                    valor_nd_39: totals.totalND39,
                    
                    detalhamento: `Material de Consumo: ${subitemGroup.nr_subitem} - ${subitemGroup.nome_subitem}`, 
                    detalhamento_customizado: customDetalhamento, 
                    
                    totalGeral: totals.totalGeral,
                    memoria_calculo_display: "", // Será preenchido abaixo
                    om_favorecida: formData.om_favorecida,
                    ug_favorecida: formData.ug_favorecida,
                } as CalculatedMaterialConsumo;
                
                // Gerar memória final (usando o objeto calculado)
                calculatedFormData.memoria_calculo_display = generateMaterialConsumoMemoriaCalculo(calculatedFormData);
                
                newPendingItems.push(calculatedFormData);
            });
            
            if (newPendingItems.length === 0) {
                throw new Error("Nenhum item com quantidade maior que zero foi encontrado nos Grupos de Aquisição.");
            }
            
            // 4. Atualizar estados
            setPendingMaterialConsumo(newPendingItems);
            setLastStagedFormData(formData);
            
            if (editingId) {
                toast.info(`Cálculo atualizado. Revise e confirme a atualização de ${newPendingItems.length} Subitem(s) na Seção 3.`);
            } else {
                toast.info(`${newPendingItems.length} Subitem(s) adicionado(s) à lista pendente.`);
            }
            
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
            
        } catch (err: any) {
            toast.error(err.message || "Erro desconhecido ao calcular.");
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingMaterialConsumo = () => {
        if (pendingMaterialConsumo.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        insertMutation.mutate(pendingMaterialConsumo);
    };
    
    // Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        
        // 1. IDs dos registros antigos para deletar (todos os IDs do grupo original)
        const oldIds = groupToReplace.records.map(r => r.id);
        
        // 2. Novos registros (pendingMaterialConsumo) para inserir
        // Note: pendingMaterialConsumo pode ter 1 ou mais registros se o usuário mudou o Subitem
        replaceGroupMutation.mutate({ oldIds, newRecords: pendingMaterialConsumo });
    };
    
    // Handler para a OM Favorecida (OM do PTrab)
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmDestinoId(omData.id); // Sincroniza OM Destino
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_destino: omData.nome_om, // Preenchimento automático
                ug_destino: omData.codug_om, // Preenchimento automático
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDestinoId(undefined); // Limpa OM Destino
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_destino: "", // Limpa OM Destino
                ug_destino: "", // Limpa UG Destino
            }));
        }
    };
    
    // Handler para a OM Destino do Recurso
    const handleOmDestinoChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmDestinoId(omData.id);
            setFormData(prev => ({
                ...prev,
                om_destino: omData.nome_om,
                ug_destino: omData.codug_om,
            }));
        } else {
            setSelectedOmDestinoId(undefined);
            setFormData(prev => ({
                ...prev,
                om_destino: "",
                ug_destino: "",
            }));
        }
    };
    
    const handleFaseAtividadeChange = (fase: string) => {
        setFormData(prev => ({
            ...prev,
            fase_atividade: fase,
        }));
    };
    
    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (group: ConsolidatedMaterialConsumo, memoriaCompleta: string) => {
        const firstRecordId = group.records[0].id;
        setEditingMemoriaId(firstRecordId);
        setMemoriaEdit(memoriaCompleta || "");
        toast.info("Editando memória de cálculo.");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            const { error } = await supabase
                .from("material_consumo_registros")
                .update({
                    detalhamento_customizado: memoriaEdit.trim() || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao salvar memória:", error);
            toast.error(sanitizeError(error));
        }
    };

    const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
        if (!confirm("Deseja realmente restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from("material_consumo_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    // --- Handler para Adicionar Subitem (Redireciona para Config) ---
    const handleAddSubitem = () => {
        // Navegar para a rota de Custos Operacionais, passando o estado para abrir a seção de material de consumo
        navigate('/config/custos-operacionais', { state: { openMaterialConsumo: true } });
    };
    
    // --- Renderização de Grupo de Aquisição (INLINE) ---
    const renderAcquisitionGroupForm = (group: AcquisitionGroup) => {
        const isGroupValid = group.nome.trim().length > 0 && group.itens.some(item => item.quantidade_solicitada > 0);
        const totalGroupValue = calculateLoteTotals(group.itens).totalGeral;
        
        // Agrupa os itens selecionados por Subitem para exibição
        const groupedItems = group.itens.reduce((acc, item) => {
            const key = item.diretriz_id;
            if (!acc[key]) {
                acc[key] = {
                    diretriz_id: item.diretriz_id,
                    nr_subitem: item.nr_subitem,
                    nome_subitem: item.nome_subitem,
                    items: [],
                    totalSubitem: 0,
                };
            }
            const totals = calculateItemTotals(item);
            acc[key].items.push(item);
            acc[key].totalSubitem += totals.totalGeral;
            return acc;
        }, {} as Record<string, {
            diretriz_id: string;
            nr_subitem: string;
            nome_subitem: string;
            items: SelectedItemAquisicao[];
            totalSubitem: number;
        }>);
        
        return (
            <Card className="p-4 border-2 border-primary/50 bg-primary/5 space-y-4">
                <h4 className="font-bold text-lg text-primary">
                    {group.nome || "Novo Grupo"}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="group-name">Nome do Grupo *</Label>
                        <Input
                            id="group-name"
                            placeholder="Ex: Material de Escritório - QG"
                            value={group.nome}
                            onChange={(e) => setCurrentGroup(prev => prev ? { ...prev, nome: e.target.value } : null)}
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group-finalidade">Finalidade (Opcional)</Label>
                        <Input
                            id="group-finalidade"
                            placeholder="Ex: Apoio à Seção de Logística"
                            value={group.finalidade}
                            onChange={(e) => setCurrentGroup(prev => prev ? { ...prev, finalidade: e.target.value } : null)}
                            disabled={isSaving}
                        />
                    </div>
                </div>
                
                {/* Botão para abrir o seletor de itens */}
                <Button 
                    type="button" 
                    onClick={() => setShowSubitemSelector(true)}
                    disabled={isSaving}
                    variant="secondary"
                    className="w-full"
                >
                    <Package className="mr-2 h-4 w-4" />
                    Importar/Alterar Itens de Subitens da ND ({group.itens.length} itens)
                </Button>
                
                {/* Tabela de Itens Selecionados */}
                {group.itens.length > 0 && (
                    <div className="mt-4 border p-3 rounded-md space-y-4 bg-background">
                        {Object.values(groupedItems).map(subitemGroup => (
                            <div key={subitemGroup.diretriz_id} className="space-y-2">
                                <div className="flex justify-between items-center bg-secondary/10 p-2 rounded-md">
                                    <span className="font-semibold text-sm text-foreground">
                                        {subitemGroup.nr_subitem} - {subitemGroup.nome_subitem}
                                    </span>
                                    <span className="font-bold text-sm text-foreground">
                                        {formatCurrency(subitemGroup.totalSubitem)}
                                    </span>
                                </div>
                                
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                            <TableHead>Item de Aquisição</TableHead>
                                            <TableHead className="text-right">Valor Unitário</TableHead>
                                            <TableHead className="text-right">Total Item</TableHead>
                                            <TableHead className="w-[50px] text-center">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {subitemGroup.items.map((item) => {
                                            const totals = calculateItemTotals(item);
                                            
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="w-[100px]">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Input
                                                                type="number"
                                                                min={0} 
                                                                placeholder="1"
                                                                // Garante que '0' seja exibido como '0' e não como string vazia, mas permite a digitação
                                                                value={item.quantidade_solicitada === 0 ? "" : item.quantidade_solicitada}
                                                                onChange={(e) => {
                                                                    // Permite que o campo fique vazio temporariamente durante a digitação
                                                                    const rawValue = e.target.value;
                                                                    const quantity = rawValue === '' ? 0 : parseInt(rawValue) || 0;
                                                                    handleItemQuantityChange(group.id, item.id, quantity);
                                                                }}
                                                                className="w-20 text-center h-8" // Removidas as classes de aparência
                                                                disabled={isSaving}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.descricao_reduzida || item.descricao_item}
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            CATMAT: {item.codigo_catmat} | GND: {item.gnd}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        {formatCurrency(item.valor_unitario)} {item.unidade_medida}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-sm">
                                                        {formatCurrency(totals.totalGeral)}
                                                    </TableCell>
                                                    <TableCell className="w-[50px] text-center">
                                                        <Button
                                                            type="button" 
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveItemFromGroup(group.id, item.id)} 
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                            disabled={isSaving}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                        
                        <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                            <span className="font-bold text-sm">VALOR TOTAL DO GRUPO:</span>
                            <span className={cn("font-extrabold text-lg text-primary")}>
                                {formatCurrency(totalGroupValue)}
                            </span>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button 
                        type="button" 
                        onClick={handleSaveGroup}
                        disabled={isSaving || !isGroupValid}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Salvar Grupo
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCancelGroupEdit}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>
                </div>
            </Card>
        );
    };
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isLoadingDefaultYear;
    const isSaving = insertMutation.isPending || replaceGroupMutation.isPending || handleDeleteMutation.isPending;

    if (isGlobalLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
            </div>
        );
    }

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    
    // Lógica de abertura da Seção 2: Depende apenas da OM Favorecida e Fase da Atividade
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.fase_atividade.length > 0;

    // Verifica se os campos numéricos da Solicitação estão preenchidos (incluindo OM Destino, agora na Seção 2)
    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.efetivo > 0 &&
                                    formData.om_destino.length > 0 && 
                                    formData.ug_destino.length > 0 && 
                                    formData.acquisition_groups.length > 0 &&
                                    formData.acquisition_groups.every(g => g.itens.some(i => i.quantidade_solicitada > 0)); // Verifica se há pelo menos 1 item com Qtd > 0

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    // Lógica para a Seção 3
    const itemsToDisplay = pendingMaterialConsumo;
    const isStagingUpdate = !!editingId && pendingMaterialConsumo.length > 0;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Material de Consumo
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para aquisição de material de consumo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    1. Dados da Organização
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* OM FAVORECIDA */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="om_favorecida">OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={handleOmFavorecidaChange}
                                            placeholder="Selecione a OM Favorecida"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingMaterialConsumo.length > 0}
                                            initialOmName={editingId ? formData.om_favorecida : undefined}
                                            initialOmUg={editingId ? formData.ug_favorecida : undefined}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="ug_favorecida">UG Favorecida</Label>
                                        <Input
                                            id="ug_favorecida"
                                            value={formatCodug(formData.ug_favorecida)}
                                            disabled
                                            className="bg-muted/50"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="fase_atividade">Fase da Atividade *</Label>
                                        <FaseAtividadeSelect
                                            value={formData.fase_atividade}
                                            onChange={handleFaseAtividadeChange}
                                            disabled={!isPTrabEditable || isSaving || pendingMaterialConsumo.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR SOLICITAÇÃO E GRUPOS DE AQUISIÇÃO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Solicitação e Grupos de Aquisição
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação (Dias, Efetivo, OM Destino) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período, Efetivo e Destino do Recurso</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        
                                                        {/* CAMPO 1: DIAS OPERAÇÃO (Período) */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="dias_operacao">Período (Nr Dias) *</Label>
                                                            <Input
                                                                id="dias_operacao"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 7"
                                                                value={formData.dias_operacao === 0 ? "" : formData.dias_operacao}
                                                                onChange={(e) => setFormData({ ...formData, dias_operacao: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        
                                                        {/* CAMPO 2: EFETIVO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="efetivo">Efetivo *</Label>
                                                            <Input
                                                                id="efetivo"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 10"
                                                                value={formData.efetivo === 0 ? "" : formData.efetivo}
                                                                onChange={(e) => setFormData({ ...formData, efetivo: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        
                                                        {/* CAMPO 3: OM DESTINO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="om_destino">OM Destino do Recurso *</Label>
                                                            <OmSelector
                                                                selectedOmId={selectedOmDestinoId}
                                                                onChange={handleOmDestinoChange}
                                                                placeholder="Selecione a OM Destino"
                                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingMaterialConsumo.length > 0}
                                                                initialOmName={editingId ? formData.om_destino : formData.om_favorecida}
                                                                initialOmUg={editingId ? formData.ug_destino : formData.ug_favorecida}
                                                            />
                                                        </div>

                                                        {/* CAMPO 4: UG DESTINO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="ug_destino">UG Destino</Label>
                                                            <Input
                                                                id="ug_destino"
                                                                value={formatCodug(formData.ug_destino)}
                                                                disabled
                                                                className="bg-muted/50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Grupos de Aquisição */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="font-semibold text-base mb-4 flex items-center gap-2">
                                                Grupos de Aquisição ({formData.acquisition_groups.length})
                                            </h4>
                                            
                                            {/* Formulário de Adição/Edição INLINE */}
                                            {isAddingGroup && currentGroup && renderAcquisitionGroupForm(currentGroup)}
                                            
                                            {/* Lista de Grupos */}
                                            {formData.acquisition_groups.length === 0 ? (
                                                <Alert variant="default" className="text-sm">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertTitle>Nenhum Grupo Adicionado</AlertTitle>
                                                    <AlertDescription>
                                                        Adicione um grupo para selecionar os itens de aquisição necessários.
                                                    </AlertDescription>
                                                </Alert>
                                            ) : (
                                                <div className="space-y-3">
                                                    {formData.acquisition_groups.map(group => {
                                                        const totalGroup = calculateLoteTotals(group.itens).totalGeral;
                                                        const isExpanded = expandedGroups[group.id] || false;
                                                        
                                                        // Agrupa os itens selecionados por Subitem para exibição dentro do Collapsible
                                                        const groupedItems = group.itens.reduce((acc, item) => {
                                                            const key = item.diretriz_id;
                                                            if (!acc[key]) {
                                                                acc[key] = {
                                                                    diretriz_id: item.diretriz_id,
                                                                    nr_subitem: item.nr_subitem,
                                                                    nome_subitem: item.nome_subitem,
                                                                    items: [],
                                                                    totalSubitem: 0,
                                                                };
                                                            }
                                                            const totals = calculateItemTotals(item);
                                                            acc[key].items.push(item);
                                                            acc[key].totalSubitem += totals.totalGeral;
                                                            return acc;
                                                        }, {} as Record<string, {
                                                            diretriz_id: string;
                                                            nr_subitem: string;
                                                            nome_subitem: string;
                                                            items: SelectedItemAquisicao[];
                                                            totalSubitem: number;
                                                        }>);

                                                        return (
                                                            <Collapsible 
                                                                key={group.id} 
                                                                open={isExpanded} 
                                                                onOpenChange={() => handleToggleGroupExpand(group.id)}
                                                                className="border rounded-md bg-gray-50"
                                                            >
                                                                <CollapsibleTrigger asChild>
                                                                    <div className="p-3 flex justify-between items-center cursor-pointer w-full hover:bg-gray-100 transition-colors">
                                                                        <div className="flex flex-col text-left">
                                                                            <span className="font-semibold">{group.nome}</span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {group.itens.length} itens ({totalGroup > 0 ? formatCurrency(totalGroup) : 'R$ 0,00'})
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                                            <Button 
                                                                                type="button" 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                onClick={(e) => { e.stopPropagation(); handleStartEditGroup(group.id); }}
                                                                                disabled={!isPTrabEditable || isSaving}
                                                                            >
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button 
                                                                                type="button" 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                onClick={(e) => { e.stopPropagation(); handleRemoveGroup(group.id); }}
                                                                                disabled={!isPTrabEditable || isSaving}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </CollapsibleTrigger>
                                                                <CollapsibleContent className="border-t bg-background/80 p-3 space-y-3">
                                                                    {Object.values(groupedItems).map(subitemGroup => (
                                                                        <div key={subitemGroup.diretriz_id} className="space-y-2 border p-2 rounded-md">
                                                                            <div className="flex justify-between items-center bg-secondary/10 p-1 rounded-sm">
                                                                                <span className="font-semibold text-xs text-foreground">
                                                                                    {subitemGroup.nr_subitem} - {subitemGroup.nome_subitem}
                                                                                </span>
                                                                                <span className="font-bold text-xs text-foreground">
                                                                                    {formatCurrency(subitemGroup.totalSubitem)}
                                                                                </span>
                                                                            </div>
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow>
                                                                                        <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                                                                        <TableHead>Item de Aquisição</TableHead>
                                                                                        <TableHead className="text-right">Valor Unitário</TableHead>
                                                                                        <TableHead className="text-right">Total Item</TableHead>
                                                                                        <TableHead className="w-[50px] text-center">Ação</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {subitemGroup.items.map((item) => {
                                                                                        const totals = calculateItemTotals(item);
                                                                                        
                                                                                        return (
                                                                                            <TableRow key={item.id}>
                                                                                                <TableCell className="w-[100px]">
                                                                                                    <div className="flex items-center justify-center gap-1">
                                                                                                        <Input
                                                                                                            type="number"
                                                                                                            min={0} 
                                                                                                            placeholder="1"
                                                                                                            // Garante que '0' seja exibido como '' para permitir digitação livre
                                                                                                            value={item.quantidade_solicitada === 0 ? "" : item.quantidade_solicitada}
                                                                                                            onChange={(e) => {
                                                                                                                // Permite que o campo fique vazio temporariamente durante a digitação
                                                                                                                const rawValue = e.target.value;
                                                                                                                const quantity = rawValue === '' ? 0 : parseInt(rawValue) || 0;
                                                                                                                handleItemQuantityChange(group.id, item.id, quantity);
                                                                                                            }}
                                                                                                            className="w-20 text-center h-8" // Removidas as classes de aparência
                                                                                                            disabled={isSaving}
                                                                                                        />
                                                                                                    </div>
                                                                                                </TableCell>
                                                                                                <TableCell>
                                                                                                    {item.descricao_reduzida || item.descricao_item}
                                                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                                                        CATMAT: {item.codigo_catmat} | GND: {item.gnd}
                                                                                                    </p>
                                                                                                </TableCell>
                                                                                                <TableCell className="text-right text-sm">
                                                                                                    {formatCurrency(item.valor_unitario)} {item.unidade_medida}
                                                                                                </TableCell>
                                                                                                <TableCell className="text-right font-semibold text-sm">
                                                                                                    {formatCurrency(totals.totalGeral)}
                                                                                                </TableCell>
                                                                                                <TableCell className="w-[50px] text-center">
                                                                                                    <Button
                                                                                                        type="button" 
                                                                                                        variant="ghost"
                                                                                                        size="icon"
                                                                                                        onClick={() => handleRemoveItemFromGroup(group.id, item.id)} 
                                                                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                                                        disabled={isSaving}
                                                                                                    >
                                                                                                        <Trash2 className="h-4 w-4" />
                                                                                                    </Button>
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        );
                                                                                    })}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    ))}
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            
                                            {/* NOVO BOTÃO DE ADICIONAR GRUPO (Movido para baixo do Alert/Lista) */}
                                            {!isAddingGroup && (
                                                <div className="flex justify-end mt-4 border-t pt-4">
                                                    <Button 
                                                        type="button" 
                                                        onClick={handleStartAddGroup}
                                                        disabled={!isPTrabEditable || isSaving}
                                                        variant="outline" 
                                                        className="w-full"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Adicionar Novo Grupo de Aquisição
                                                    </Button>
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                <span className="font-bold text-sm">VALOR TOTAL DA SOLICITAÇÃO ({totalAcquisitionItems} itens):</span>
                                                <span className={cn("font-extrabold text-lg text-primary")}>
                                                    {formatCurrency(calculos.totalGeral)}
                                                </span>
                                            </div>
                                        </Card>
                                        
                                        {/* BOTÕES DE AÇÃO */}
                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button 
                                                type="submit" 
                                                disabled={!isPTrabEditable || isSaving || !isCalculationReady}
                                                className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                            >
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                {editingId ? "Recalcular/Revisar Lote" : "Salvar Item na Lista"}
                                            </Button>
                                        </div>
                                        
                                    </Card> 
                                    
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({itemsToDisplay.length} Subitem)
                                    </h3>
                                    
                                    {/* Alerta de Validação Final */}
                                    {isMaterialConsumoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "{editingId ? "Recalcular/Revisar Lote" : "Salvar Item na Lista"}" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const efetivoText = item.efetivo === 1 ? 'militar' : 'militares';
                                            
                                            const isOmDestinoDifferent = item.om_favorecida !== item.om_detentora || item.ug_favorecida !== item.ug_detentora;
                                            const omDestino = item.om_detentora;
                                            const ugDestino = item.ug_detentora;

                                            return (
                                                <Card 
                                                    key={item.tempId} 
                                                    className={cn(
                                                        "border-2 shadow-md",
                                                        "border-secondary bg-secondary/10"
                                                    )}
                                                >
                                                    <CardContent className="p-4">
                                                        
                                                        <div className={cn("flex justify-between items-center pb-2 mb-2", "border-b border-secondary/30")}>
                                                            <h4 className="font-bold text-base text-foreground">
                                                                Subitem ND: {item.nr_subitem} - {item.nome_subitem}
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-foreground text-right">
                                                                    {formatCurrency(item.valor_total)}
                                                                </p>
                                                                {!isStagingUpdate && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={handleClearPending} // Limpa o único item pendente
                                                                        disabled={isSaving}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Detalhes da Solicitação */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Favorecida:</p>
                                                                <p className="font-medium">OM Destino do Recurso:</p>
                                                                <p className="font-medium">Período / Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>
                                                                    {omDestino} ({formatCodug(ugDestino)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.efetivo} {efetivoText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.30 (Consumo):</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(totalND30)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.39 (Permanente):</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(totalND39)}</span>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">
                                                VALOR TOTAL DO LOTE
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(totalPendingMaterialConsumo)}
                                            </span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        {isStagingUpdate ? (
                                            <>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleCommitStagedUpdate}
                                                    disabled={isSaving || isMaterialConsumoDirty} 
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    Atualizar Lote
                                                </Button>
                                                <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Cancelar Edição
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleSavePendingMaterialConsumo}
                                                    disabled={isSaving || pendingMaterialConsumo.length === 0 || isMaterialConsumoDirty}
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Salvar Registros
                                                </Button>
                                                <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Limpar Lista
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS (OMs Cadastradas) */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        Subitens Cadastrados ({consolidatedRegistros.length})
                                    </h3>
                                    
                                    {consolidatedRegistros.map((group) => {
                                        const totalOM = group.totalGeral;
                                        const totalND30Consolidado = group.totalND30;
                                        const totalND39Consolidado = group.totalND39;
                                        
                                        const diasOperacaoConsolidado = group.dias_operacao;
                                        const efetivoConsolidado = group.efetivo;
                                        
                                        const omName = group.organizacao;
                                        const ug = group.ug;
                                        const faseAtividade = group.fase_atividade || 'Não Definida';
                                        
                                        const diasText = diasOperacaoConsolidado === 1 ? 'dia' : 'dias';
                                        const efetivoText = efetivoConsolidado === 1 ? 'militar' : 'militares';
                                        
                                        const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                                        const omDestino = group.om_detentora;
                                        const ugDestino = group.ug_detentora;
                                        
                                        const totalItens = group.records[0]?.itens_aquisicao_selecionados 
                                            ? (group.records[0].itens_aquisicao_selecionados as unknown as SelectedItemAquisicao[]).length
                                            : 0;
                                        const itemText = totalItens === 1 ? 'item' : 'itens';

                                        return (
                                            <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {group.nr_subitem} - {group.nome_subitem}
                                                        <Badge variant="outline" className="text-xs">
                                                            {faseAtividade}
                                                        </Badge>
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                {/* CORPO CONSOLIDADO */}
                                                <div className="space-y-3">
                                                    <Card 
                                                        key={group.groupKey} 
                                                        className="p-3 bg-background border"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-base text-foreground">
                                                                        Material de Consumo
                                                                    </h4>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {totalItens} {itemText} selecionados | Período: {diasOperacaoConsolidado} {diasText} | Efetivo: {efetivoConsolidado} {efetivoText}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xl text-foreground">
                                                                    {formatCurrency(totalOM)}
                                                                </span>
                                                                {/* Botões de Ação */}
                                                                <div className="flex gap-1 shrink-0">
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleEdit(group)} 
                                                                        disabled={!isPTrabEditable || isSaving || pendingMaterialConsumo.length > 0}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleConfirmDelete(group)} 
                                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Detalhes da Alocação */}
                                                        <div className="pt-2 border-t mt-2">
                                                            {/* OM Destino Recurso (Sempre visível, vermelha se diferente) */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                    {omDestino} ({formatCodug(ugDestino)})
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                <span className="text-green-600">{formatCurrency(totalND30Consolidado)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.39:</span>
                                                                <span className="text-green-600">{formatCurrency(totalND39Consolidado)}</span>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {consolidatedRegistros.map(group => (
                                        <ConsolidatedMaterialConsumoMemoria
                                            key={`memoria-view-${group.groupKey}`}
                                            group={group}
                                            isPTrabEditable={isPTrabEditable}
                                            isSaving={isSaving}
                                            editingMemoriaId={editingMemoriaId}
                                            memoriaEdit={memoriaEdit}
                                            setMemoriaEdit={setMemoriaEdit}
                                            handleIniciarEdicaoMemoria={handleIniciarEdicaoMemoria}
                                            handleCancelarEdicaoMemoria={handleCancelarEdicaoMemoria}
                                            handleSalvarMemoriaCustomizada={handleSalvarMemoriaCustomizada}
                                            handleRestaurarMemoriaAutomatica={handleRestaurarMemoriaAutomatica}
                                        />
                                    ))}
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>
                
                {/* Diálogo de Confirmação de Exclusão */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                <Trash2 className="h-5 w-5" />
                                Confirmar Exclusão de Lote
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o lote do Subitem <span className="font-bold">{groupToDelete?.nr_subitem}</span> para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>? Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction 
                                onClick={() => groupToDelete && handleDeleteMutation.mutate(groupToDelete.records.map(r => r.id))}
                                disabled={handleDeleteMutation.isPending}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir Lote
                            </AlertDialogAction>
                            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                
                {/* Diálogo de Seleção de Subitem (usado internamente pelo formulário inline) */}
                <MaterialConsumoSubitemSelectorDialog
                    open={showSubitemSelector}
                    onOpenChange={setShowSubitemSelector}
                    selectedYear={selectedYear}
                    initialSelections={currentGroup?.itens || []} 
                    onSelect={handleSubitemSelected}
                    onAddSubitem={handleAddSubitem}
                />
            </div>
        </div>
    );
};

export default MaterialConsumoForm;