import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, XCircle, Package, FileText, AlertCircle, RefreshCw, Check, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatNumber } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
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
import * as z from "zod";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import CurrencyInput from "@/components/CurrencyInput";
import { AcquisitionGroup, calculateGroupTotals, MaterialConsumoRegistro, MaterialConsumoForm as MaterialConsumoFormType, generateMaterialConsumoMemoriaCalculo, generateConsolidatedMaterialConsumoMemoriaCalculo, ConsolidatedMaterialConsumoRecord } from "@/lib/materialConsumoUtils";
import AcquisitionGroupForm from "@/components/AcquisitionGroupForm";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import MaterialConsumoItemSelectorDialog from "@/components/MaterialConsumoItemSelectorDialog";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConsolidatedMaterialConsumoMemoria } from "@/components/ConsolidatedMaterialConsumoMemoria";

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

// Tipo para o registro calculado antes de salvar (inclui campos de display)
interface CalculatedMaterialConsumo extends TablesInsert<'material_consumo_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
    // Novo: Armazena o grupo de aquisição
    acquisitionGroup: AcquisitionGroup;
}

// NOVO TIPO: Representa um lote consolidado de registros (vários grupos)
interface ConsolidatedMaterialConsumo extends ConsolidatedMaterialConsumoRecord {
    groupKey: string; // Adicionado para resolver o erro TS2353 e TS2339
}

// Estado inicial para o formulário
interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_detentora: string; 
    ug_detentora: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    
    // Grupos de Aquisição (Itens de Aquisição)
    acquisitionGroups: AcquisitionGroup[];
}

const initialFormState: MaterialConsumoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_detentora: "",
    ug_detentora: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    acquisitionGroups: [],
};

// Helper function to compare form data structures
const compareFormData = (data1: MaterialConsumoFormState, data2: MaterialConsumoFormState) => {
    // Compare todos os campos relevantes
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.efetivo !== data2.efetivo || 
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_detentora !== data2.om_detentora || 
        data1.ug_detentora !== data2.ug_detentora || 
        data1.fase_atividade !== data2.fase_atividade ||
        data1.acquisitionGroups.length !== data2.acquisitionGroups.length
    ) {
        return true;
    }
    
    // Comparar detalhes dos grupos (nomes e itens)
    const groups1 = data1.acquisitionGroups.map(g => `${g.groupName}-${g.items.length}`).sort().join('|');
    const groups2 = data2.acquisitionGroups.map(g => `${g.groupName}-${g.items.length}`).sort().join('|');
    
    if (groups1 !== groups2) {
        return true;
    }
    
    return false;
};


const MaterialConsumoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<MaterialConsumoFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    
    // NOVO ESTADO: Armazena o grupo completo a ser excluído/substituído
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedMaterialConsumo | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedMaterialConsumo | null>(null); 
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    // editingMemoriaId rastreia o ID do PRIMEIRO registro do grupo (group.records[0].id)
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    // Cada item em pendingMaterialConsumo representa UM grupo de aquisição.
    const [pendingMaterialConsumo, setPendingMaterialConsumo] = useState<CalculatedMaterialConsumo[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedMaterialConsumo | null>(null);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingMaterialConsumo
    const [lastStagedFormData, setLastStagedFormData] = useState<MaterialConsumoFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida e OM Detentora
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    // Estado para o formulário de grupo de aquisição
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<AcquisitionGroup | null>(null);
    
    // Estado para o diálogo de seleção de itens
    const [showItemSelector, setShowItemSelector] = useState(false);
    const [currentItemsForSelector, setCurrentItemsForSelector] = useState<ItemAquisicao[]>([]);
    const [selectedItemsFromSelector, setSelectedItemsFromSelector] = useState<ItemAquisicao[] | null>(null);
    
    // Busca o ano padrão para o seletor de itens
    const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
    const selectedYear = defaultYearData?.year || new Date().getFullYear();

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Material de Consumo usa a tabela 'material_consumo_registros'
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<MaterialConsumoRegistroDB[]>({
        queryKey: ['materialConsumoRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('material_consumo_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    // NOVO MEMO: Consolida os registros por lote de solicitação
    const consolidatedRegistros = useMemo<ConsolidatedMaterialConsumo[]>(() => {
        if (!registros) return [];

        const groups = registros.reduce((acc, registro) => {
            // Chave de consolidação: todos os campos que definem o lote de solicitação
            const key = [
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
                    groupKey: key, // Adicionado para resolver o erro
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

            // Mapear itens_aquisicao (Json) de volta para ItemAquisicao[]
            const itemsAquisicao = (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [];
            
            // Adicionar o registro ao grupo, garantindo que o campo items_aquisicao seja o tipo correto
            acc[key].records.push({
                ...registro,
                itens_aquisicao: itemsAquisicao,
            } as MaterialConsumoRegistro);
            
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND30 += Number(registro.valor_nd_30 || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedMaterialConsumo>);

        // Ordenar por OM
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    // 1. Mutation for saving multiple new records (INSERT)
    const insertMutation = useMutation({
        mutationFn: async (newRecords: CalculatedMaterialConsumo[]) => {
            // Mapear CalculatedMaterialConsumo (que representa um grupo) para TablesInsert
            const recordsToInsert: TablesInsert<'material_consumo_registros'>[] = newRecords.map(r => {
                return {
                    p_trab_id: r.p_trab_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    efetivo: r.efetivo,
                    fase_atividade: r.fase_atividade,
                    group_name: r.group_name,
                    group_purpose: r.group_purpose,
                    // O campo itens_aquisicao é o JSONB que contém a lista de ItemAquisicao
                    itens_aquisicao: r.itens_aquisicao as unknown as Json, 
                    valor_total: r.valor_total,
                    valor_nd_30: r.valor_nd_30,
                    valor_nd_39: r.valor_nd_39,
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
            toast.success(`Sucesso! ${pendingMaterialConsumo.length} grupo(s) de Material de Consumo adicionado(s).`);
            setPendingMaterialConsumo([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            
            // Manter campos de contexto (OMs, Dias, Efetivo, Fase)
            setFormData(prev => ({
                ...prev,
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                om_detentora: prev.om_detentora,
                ug_detentora: prev.ug_detentora,
                dias_operacao: prev.dias_operacao,
                efetivo: prev.efetivo,
                fase_atividade: prev.fase_atividade,
                acquisitionGroups: [], // Limpa os grupos selecionados após salvar
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
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    efetivo: r.efetivo,
                    fase_atividade: r.fase_atividade,
                    group_name: r.group_name,
                    group_purpose: r.group_purpose,
                    itens_aquisicao: r.itens_aquisicao as unknown as Json, 
                    valor_total: r.valor_total,
                    valor_nd_30: r.valor_nd_30,
                    valor_nd_39: r.valor_nd_39,
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
            setStagedUpdate(null);
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
    
    // Efeito de inicialização da OM Favorecida e OM Detentora
    useEffect(() => {
        if (ptrabData && !editingId) {
            // Modo Novo Registro: Limpar
            setFormData(prev => ({
                ...initialFormState,
                // Manter a OM Favorecida (do PTrab) se já estiver definida
                om_favorecida: "", 
                ug_favorecida: "", 
                om_detentora: "",
                ug_detentora: "",
            }));
            setSelectedOmFavorecidaId(undefined); 
            setSelectedOmDetentoraId(undefined);
            
        } else if (ptrabData && editingId) {
            // Modo Edição: Preencher
            // Nota: Em modo edição, formData já deve ter sido preenchido por handleEdit
            const omFavorecida = oms?.find(om => om.nome_om === formData.om_favorecida && om.codug_om === formData.ug_favorecida);
            setSelectedOmFavorecidaId(omFavorecida?.id);
            
            const omDetentora = oms?.find(om => om.nome_om === formData.om_detentora && om.codug_om === formData.ug_detentora);
            setSelectedOmDetentoraId(omDetentora?.id);
        }
    }, [ptrabData, oms, editingId]);
    
    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    // Este cálculo agora é usado apenas para exibir o total consolidado no formulário (Seção 2)
    const calculos = useMemo(() => {
        if (!ptrabData || formData.acquisitionGroups.length === 0) {
            return {
                totalGeral: 0,
                totalND30: 0,
                totalND39: 0,
                memoria: "Adicione pelo menos um grupo de aquisição e preencha os dados de solicitação.",
            };
        }
        
        try {
            let totalGeral = 0;
            let totalND30 = 0;
            let totalND39 = 0;
            
            // 1. Calcular totais por grupo
            const calculatedGroups = formData.acquisitionGroups.map(group => {
                const { totalValue, totalND30: nd30, totalND39: nd39 } = calculateGroupTotals(group);
                totalGeral += totalValue;
                totalND30 += nd30;
                totalND39 += nd39;
                return { ...group, totalValue, totalND30: nd30, totalND39: nd39 };
            });
            
            // 2. Gerar a memória consolidada para o STAGING
            const tempGroup: ConsolidatedMaterialConsumoRecord = {
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                efetivo: formData.efetivo,
                fase_atividade: formData.fase_atividade,
                records: calculatedGroups.map(g => ({
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_detentora,
                    ug_detentora: formData.ug_detentora,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    group_name: g.groupName,
                    group_purpose: g.groupPurpose,
                    itens_aquisicao: g.items,
                    valor_total: g.totalValue,
                    valor_nd_30: g.totalND30,
                    valor_nd_39: g.totalND39,
                    detalhamento_customizado: null,
                    // Campos obrigatórios do tipo DB
                    id: '', created_at: '', updated_at: '',
                } as MaterialConsumoRegistro)),
                totalGeral: totalGeral,
                totalND30: totalND30,
                totalND39: totalND39,
            };
            
            const memoria = generateConsolidatedMaterialConsumoMemoriaCalculo(tempGroup);
            
            return {
                totalGeral,
                totalND30,
                totalND39,
                memoria,
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
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate ou lastStagedFormData)
    const isMaterialConsumoDirty = useMemo(() => {
        // Compara o estado atual do formulário com o último estado que gerou um item pendente
        if (pendingMaterialConsumo.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [formData, pendingMaterialConsumo.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingMaterialConsumo = useMemo(() => {
        return pendingMaterialConsumo.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingMaterialConsumo]);
    
    // =================================================================
    // HANDLERS DE AÇÃO
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setGroupToReplace(null);
        setFormData(prev => ({
            ...initialFormState,
            // Manter a OM Favorecida (do PTrab) se já estiver definida
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_detentora: prev.om_detentora,
            ug_detentora: prev.ug_detentora,
            // Resetar campos de solicitação
            dias_operacao: 0,
            efetivo: 0,
            fase_atividade: "",
            acquisitionGroups: [],
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDetentoraId(undefined);
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
        setIsGroupFormOpen(false);
        setGroupToEdit(null);
    };
    
    const handleClearPending = () => {
        setPendingMaterialConsumo([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        setEditingId(null);
        setGroupToReplace(null);
        resetForm();
    };

    const handleEdit = (group: ConsolidatedMaterialConsumo) => {
        if (pendingMaterialConsumo.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        // Limpa estados pendentes
        setPendingMaterialConsumo([]);
        setLastStagedFormData(null);
        setStagedUpdate(null); 
        
        // Define o modo edição
        setEditingId(group.records[0].id); // Usa o ID do primeiro registro para controle de UI
        setGroupToReplace(group); // Armazena o grupo original para substituição
        
        // 1. Configurar OM Favorecida e OM Detentora
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDetentoraToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDetentoraId(omDetentoraToEdit?.id);
        
        // 2. Reconstruir a lista de grupos de aquisição a partir de TODOS os registros do grupo
        const groupsFromRecords: AcquisitionGroup[] = group.records.map(registro => {
            const { totalValue, totalND30, totalND39 } = calculateGroupTotals({ items: registro.itens_aquisicao as ItemAquisicao[] });
            
            return {
                tempId: registro.id, // Usamos o ID do DB como tempId para rastreamento
                groupName: registro.group_name,
                groupPurpose: registro.group_purpose,
                items: registro.itens_aquisicao as ItemAquisicao[],
                totalValue,
                totalND30,
                totalND39,
            };
        });

        // 3. Populate formData
        const newFormData: MaterialConsumoFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_detentora: group.om_detentora,
            ug_detentora: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo || 0, 
            fase_atividade: group.fase_atividade || "",
            acquisitionGroups: groupsFromRecords, // TODOS os grupos
        };
        setFormData(newFormData);
        
        // 4. Gerar os itens pendentes (staging) imediatamente com os dados originais
        const newPendingItems: CalculatedMaterialConsumo[] = groupsFromRecords.map(groupItem => {
            const { totalValue, totalND30, totalND39 } = calculateGroupTotals(groupItem);
            
            const calculatedFormData: MaterialConsumoRegistro = {
                id: groupItem.tempId, // Usamos o ID real do DB
                p_trab_id: ptrabId!,
                organizacao: group.organizacao, 
                ug: group.ug, 
                dias_operacao: group.dias_operacao,
                efetivo: group.efetivo,
                fase_atividade: group.fase_atividade || "",
                
                om_detentora: group.om_detentora,
                ug_detentora: group.ug_detentora,
                group_name: groupItem.groupName,
                group_purpose: groupItem.groupPurpose,
                itens_aquisicao: groupItem.items,
                
                valor_total: totalValue,
                valor_nd_30: totalND30,
                valor_nd_39: totalND39,
                
                detalhamento_customizado: group.records.find(r => r.id === groupItem.tempId)?.detalhamento_customizado || null,
                
                // Campos obrigatórios do tipo DB
                created_at: group.records.find(r => r.id === groupItem.tempId)?.created_at || new Date().toISOString(),
                updated_at: group.records.find(r => r.id === groupItem.tempId)?.updated_at || new Date().toISOString(),
                detalhamento: null, // Não usado nesta classe
            } as MaterialConsumoRegistro;

            // Usamos a função de memória individual para o staging, pois cada item é um registro de DB
            let memoria = generateMaterialConsumoMemoriaCalculo(calculatedFormData);
            
            return {
                tempId: groupItem.tempId, // Usamos o ID real do DB como tempId para rastreamento
                p_trab_id: ptrabId!,
                organizacao: group.organizacao, 
                ug: group.ug, 
                dias_operacao: group.dias_operacao,
                efetivo: group.efetivo,
                fase_atividade: group.fase_atividade,
                
                om_detentora: group.om_detentora,
                ug_detentora: group.ug_detentora,
                group_name: groupItem.groupName,
                group_purpose: groupItem.groupPurpose,
                itens_aquisicao: groupItem.items,
                
                valor_total: totalValue,
                valor_nd_30: totalND30,
                valor_nd_39: totalND39,
                
                detalhamento_customizado: calculatedFormData.detalhamento_customizado,
                
                totalGeral: totalValue,
                memoria_calculo_display: memoria, 
                om_favorecida: group.organizacao,
                ug_favorecida: group.ug,
                acquisitionGroup: groupItem,
            } as CalculatedMaterialConsumo;
        });
        
        setPendingMaterialConsumo(newPendingItems);
        setLastStagedFormData(newFormData); // Marca o formulário como staged (limpo)
        
        toast.info("Modo Edição ativado. Altere os dados na Seção 2 e clique em 'Recalcular/Revisar Lote'.");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedMaterialConsumo) => {
        setGroupToDelete(group); // Armazena o grupo completo para exclusão
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação básica
            if (formData.acquisitionGroups.length === 0) {
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
            if (!formData.om_detentora || !formData.ug_detentora) {
                throw new Error("A OM Detentora do Recurso é obrigatória.");
            }
            
            // 2. Gerar MÚLTIPLOS registros (um para cada grupo de aquisição)
            const newPendingItems: CalculatedMaterialConsumo[] = formData.acquisitionGroups.map(groupItem => {
                
                const { totalValue, totalND30, totalND39 } = calculateGroupTotals(groupItem);
                
                const calculatedFormData: MaterialConsumoRegistro = {
                    id: groupItem.tempId, // ID temporário para gerar memória
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida, 
                    ug: formData.ug_favorecida, 
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    om_detentora: formData.om_detentora,
                    ug_detentora: formData.ug_detentora,
                    group_name: groupItem.groupName,
                    group_purpose: groupItem.groupPurpose,
                    itens_aquisicao: groupItem.items,
                    
                    valor_total: totalValue,
                    valor_nd_30: totalND30,
                    valor_nd_39: totalND39,
                    
                    detalhamento_customizado: null, 
                    
                    // Campos obrigatórios do tipo DB
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    detalhamento: null,
                } as MaterialConsumoRegistro;

                // Usamos a função de memória individual para o staging, pois cada item é um registro de DB
                let memoria = generateMaterialConsumoMemoriaCalculo(calculatedFormData);
                
                return {
                    tempId: groupItem.tempId, 
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida, 
                    ug: formData.ug_favorecida, 
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    om_detentora: formData.om_detentora,
                    ug_detentora: formData.ug_detentora,
                    group_name: groupItem.groupName,
                    group_purpose: groupItem.groupPurpose,
                    itens_aquisicao: groupItem.items,
                    
                    valor_total: totalValue,
                    valor_nd_30: totalND30,
                    valor_nd_39: totalND39,
                    
                    detalhamento_customizado: null, 
                    
                    totalGeral: totalValue,
                    memoria_calculo_display: memoria, 
                    om_favorecida: formData.om_favorecida,
                    ug_favorecida: formData.ug_favorecida,
                    acquisitionGroup: groupItem,
                } as CalculatedMaterialConsumo;
            });
            
            if (editingId) {
                // MODO EDIÇÃO: Geramos os novos registros e os colocamos em pendingMaterialConsumo
                
                // Preserva a memória customizada do primeiro registro do grupo original, se existir
                let memoriaCustomizadaTexto: string | null = null;
                if (groupToReplace) {
                    // Busca o primeiro registro do grupo original para verificar a memória customizada
                    const originalRecord = groupToReplace.records[0];
                    if (originalRecord) {
                        memoriaCustomizadaTexto = originalRecord.detalhamento_customizado;
                    }
                }
                
                // Aplicamos a memória customizada ao primeiro item da nova lista (apenas para fins de staging display)
                if (memoriaCustomizadaTexto && newPendingItems.length > 0) {
                    // O tempId do primeiro item deve ser o ID do registro original para rastreamento
                    newPendingItems[0].tempId = editingId; 
                    newPendingItems[0].detalhamento_customizado = memoriaCustomizadaTexto;
                }
                
                setPendingMaterialConsumo(newPendingItems); // Armazena o novo lote completo
                setStagedUpdate(newPendingItems[0]); // Usa o primeiro item para display de revisão
                setLastStagedFormData(formData); // Marca o formulário como staged
                
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar todos os itens gerados à lista pendente
            
            // Se já houver itens pendentes, limpamos e adicionamos os novos (assumindo que o usuário está recalculando o lote)
            setPendingMaterialConsumo(newPendingItems);
            
            // Atualiza o lastStagedFormData para o estado atual do formulário
            setLastStagedFormData(formData);
            
            toast.info(`${newPendingItems.length} grupo(s) de Material de Consumo adicionado(s) à lista pendente.`);
            
            // Manter campos de contexto. NÃO LIMPAR acquisitionGroups aqui.
            
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
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        
        // 1. IDs dos registros antigos para deletar
        const oldIds = groupToReplace.records.map(r => r.id);
        
        // 2. Novos registros (pendingMaterialConsumo) para inserir
        replaceGroupMutation.mutate({ oldIds, newRecords: pendingMaterialConsumo });
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingMaterialConsumo(prev => {
            const newPending = prev.filter(p => p.tempId !== tempId);
            if (newPending.length === 0) {
                setLastStagedFormData(null);
            }
            return newPending;
        });
        toast.info("Grupo removido da lista pendente.");
    };
    
    // Handler para a OM Favorecida (OM do PTrab)
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmDetentoraId(omData.id); // Sincroniza OM Detentora
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_detentora: omData.nome_om, // Preenchimento automático
                ug_detentora: omData.codug_om, // Preenchimento automático
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDetentoraId(undefined); // Limpa OM Detentora
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_detentora: "", // Limpa OM Detentora
                ug_detentora: "", // Limpa UG Detentora
            }));
        }
    };
    
    // Handler para a OM Detentora do Recurso
    const handleOmDetentoraChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmDetentoraId(omData.id);
            setFormData(prev => ({
                ...prev,
                om_detentora: omData.nome_om,
                ug_detentora: omData.codug_om,
            }));
        } else {
            setSelectedOmDetentoraId(undefined);
            setFormData(prev => ({
                ...prev,
                om_detentora: "",
                ug_detentora: "",
            }));
        }
    };
    
    const handleFaseAtividadeChange = (fase: string) => {
        setFormData(prev => ({
            ...prev,
            fase_atividade: fase,
        }));
    };
    
    // --- Lógica de Gerenciamento de Grupos de Aquisição ---
    
    const handleOpenGroupForm = (group: AcquisitionGroup | null) => {
        if (pendingMaterialConsumo.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um grupo.");
            return;
        }
        setGroupToEdit(group);
        setIsGroupFormOpen(true);
    };
    
    const handleSaveGroup = (group: AcquisitionGroup) => {
        setFormData(prev => {
            const existingIndex = prev.acquisitionGroups.findIndex(g => g.tempId === group.tempId);
            
            let newGroups: AcquisitionGroup[];
            if (existingIndex !== -1) {
                // Atualiza grupo existente
                newGroups = prev.acquisitionGroups.map((g, index) => index === existingIndex ? group : g);
                toast.success(`Grupo "${group.groupName}" atualizado.`);
            } else {
                // Adiciona novo grupo
                newGroups = [...prev.acquisitionGroups, group];
                toast.success(`Grupo "${group.groupName}" adicionado.`);
            }
            
            return { ...prev, acquisitionGroups: newGroups };
        });
        
        setIsGroupFormOpen(false);
        setGroupToEdit(null);
    };
    
    const handleCancelGroupForm = () => {
        setIsGroupFormOpen(false);
        setGroupToEdit(null);
    };
    
    const handleDeleteGroup = (tempId: string, groupName: string) => {
        if (!confirm(`Tem certeza que deseja remover o grupo "${groupName}"?`)) return;
        
        setFormData(prev => ({
            ...prev,
            acquisitionGroups: prev.acquisitionGroups.filter(g => g.tempId !== tempId),
        }));
        toast.info(`Grupo "${groupName}" removido.`);
    };
    
    // --- Lógica de Seleção de Itens (PNCP) ---
    
    const handleOpenItemSelector = (currentItems: ItemAquisicao[]) => {
        setCurrentItemsForSelector(currentItems);
        setShowItemSelector(true);
    };
    
    const handleClearSelectedItems = () => {
        setSelectedItemsFromSelector(null);
    };
    
    // --- Lógica de Edição de Memória ---
    
    // Agora, handleIniciarEdicaoMemoria recebe o grupo consolidado E a string da memória completa
    const handleIniciarEdicaoMemoria = (group: ConsolidatedMaterialConsumo, memoriaCompleta: string) => {
        // Usamos o ID do primeiro registro do grupo para rastrear a edição
        const firstRecordId = group.records[0].id;
        setEditingMemoriaId(firstRecordId);
        
        // Preenche o estado de edição com a memória completa (automática ou customizada)
        setMemoriaEdit(memoriaCompleta || "");
        
        toast.info("Editando memória de cálculo.");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            // A memória customizada é salva APENAS no primeiro registro do grupo.
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
            // A memória customizada é removida APENAS do primeiro registro do grupo.
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
    
    // --- Handler para Adicionar Diretriz ---
    const handleAddDiretriz = () => {
        // Navegar para a rota correta de Custos Operacionais, passando o estado para abrir a seção de material de consumo
        navigate('/config/custos-operacionais', { state: { openMaterialConsumo: true } });
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

    // Verifica se os campos numéricos da Solicitação estão preenchidos (incluindo OM Detentora, agora na Seção 2)
    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.efetivo > 0 &&
                                    formData.om_detentora.length > 0 && 
                                    formData.ug_detentora.length > 0 && 
                                    formData.acquisitionGroups.length > 0;

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    // Lógica para a Seção 3
    // Em modo edição, pendingMaterialConsumo armazena o novo cálculo, e stagedUpdate é o primeiro item para display.
    const itemsToDisplay = editingId ? pendingMaterialConsumo : pendingMaterialConsumo;
    const isStagingUpdate = !!editingId && pendingMaterialConsumo.length > 0;
    
    // Verifica se há algum grupo com quantidade zero
    const hasZeroQuantityInGroups = formData.acquisitionGroups.some(group => 
        group.items.some(item => item.quantidade === 0)
    );

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
                            Material de Consumo (ND 33.90.30 e 33.90.39)
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

                            {/* SEÇÃO 2: CONFIGURAR ITEM (GRUPOS DE AQUISIÇÃO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Solicitação e Itens
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação (Dias, Efetivo, OM Detentora) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período, Efetivo e Detentora do Recurso</CardTitle>
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
                                                                onWheel={(e) => e.currentTarget.blur()}
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
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        
                                                        {/* CAMPO 3: OM DETENTORA */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="om_detentora">OM Detentora do Recurso *</Label>
                                                            <OmSelector
                                                                selectedOmId={selectedOmDetentoraId}
                                                                onChange={handleOmDetentoraChange}
                                                                placeholder="Selecione a OM Detentora"
                                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingMaterialConsumo.length > 0}
                                                                initialOmName={editingId ? formData.om_detentora : formData.om_favorecida}
                                                                initialOmUg={editingId ? formData.ug_detentora : formData.ug_favorecida}
                                                            />
                                                        </div>

                                                        {/* CAMPO 4: UG DETENTORA */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="ug_detentora">UG Detentora</Label>
                                                            <Input
                                                                id="ug_detentora"
                                                                value={formatCodug(formData.ug_detentora)}
                                                                disabled
                                                                className="bg-muted/50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Gerenciamento de Grupos de Aquisição */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="semibold text-base mb-4">
                                                Grupos de Aquisição ({formData.acquisitionGroups.length})
                                            </h4>
                                            
                                            {isGroupFormOpen ? (
                                                <AcquisitionGroupForm
                                                    initialGroup={groupToEdit || undefined}
                                                    onSave={handleSaveGroup}
                                                    onCancel={handleCancelGroupForm}
                                                    isSaving={isSaving}
                                                    onOpenItemSelector={handleOpenItemSelector}
                                                    selectedItemsFromSelector={selectedItemsFromSelector}
                                                    onClearSelectedItems={handleClearSelectedItems}
                                                />
                                            ) : (
                                                <div className="space-y-3">
                                                    {formData.acquisitionGroups.length === 0 ? (
                                                        <div className="text-center text-muted-foreground py-4 border rounded-lg">
                                                            Nenhum grupo de aquisição cadastrado.
                                                        </div>
                                                    ) : (
                                                        formData.acquisitionGroups.map(group => (
                                                            <Card key={group.tempId} className="p-3 border-l-4 border-primary/70 shadow-sm">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-semibold text-sm">{group.groupName}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {group.items.length} itens | {group.groupPurpose}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-sm text-primary">
                                                                            {formatCurrency(group.totalValue)}
                                                                        </span>
                                                                        <Button 
                                                                            type="button" 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            onClick={() => handleOpenGroupForm(group)}
                                                                            disabled={isSaving}
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button 
                                                                            type="button" 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            onClick={() => handleDeleteGroup(group.tempId, group.groupName)}
                                                                            disabled={isSaving}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        ))
                                                    )}
                                                    
                                                    <Button 
                                                        type="button" 
                                                        onClick={() => handleOpenGroupForm(null)}
                                                        disabled={!isPTrabEditable || isSaving}
                                                        variant="outline"
                                                        className="w-full mt-4"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Adicionar Novo Grupo de Aquisição
                                                    </Button>
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                <span className="font-bold text-base">VALOR TOTAL DOS GRUPOS:</span>
                                                <span className={cn("font-extrabold text-lg text-primary")}>
                                                    {formatCurrency(calculos.totalGeral)}
                                                </span>
                                            </div>
                                        </Card>
                                        
                                        {/* BOTÕES DE AÇÃO */}
                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button 
                                                type="submit" 
                                                disabled={!isPTrabEditable || isSaving || !isCalculationReady || hasZeroQuantityInGroups}
                                                className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                            >
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                {editingId ? "Recalcular/Revisar Lote" : "Salvar Item na Lista"}
                                            </Button>
                                        </div>
                                        
                                        {hasZeroQuantityInGroups && (
                                            <Alert variant="destructive" className="mt-4">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                    Atenção: Um ou mais itens nos grupos de aquisição estão com quantidade zero. Ajuste as quantidades antes de calcular.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        
                                    </Card> 
                                    
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({itemsToDisplay.length} grupo(s))
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Modo Novo Registro) */}
                                    {!editingId && isMaterialConsumoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isMaterialConsumoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Recalcular/Revisar Lote" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const efetivoText = item.efetivo === 1 ? 'militar' : 'militares';
                                            
                                            const isOmDetentoraDifferent = item.om_favorecida !== item.om_detentora || item.ug_favorecida !== item.ug_detentora;
                                            
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
                                                                Grupo: {item.group_name}
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-foreground text-right">
                                                                    {formatCurrency(item.valor_total)}
                                                                </p>
                                                                {!isStagingUpdate && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => handleRemovePending(item.tempId)}
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
                                                                <p className="font-medium">OM Detentora do Recurso:</p>
                                                                <p className="font-medium">Período/Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isOmDetentoraDifferent && "text-destructive font-bold")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.efetivo} {efetivoText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.30 (Material Consumo):</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(totalND30)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.39 (Serviços):</span>
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
                                                <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Cancelar Edição
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleCommitStagedUpdate}
                                                    disabled={isSaving || isMaterialConsumoDirty} 
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    Atualizar Lote
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Limpar Lista
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleSavePendingMaterialConsumo}
                                                    // O botão de salvar deve ser desabilitado se houver dirty check,
                                                    // pois o usuário precisa re-staged o item alterado.
                                                    disabled={isSaving || pendingMaterialConsumo.length === 0 || isMaterialConsumoDirty}
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Salvar Registros
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
                                        OMs Cadastradas ({consolidatedRegistros.length})
                                    </h3>
                                    
                                    {consolidatedRegistros.map((group) => {
                                        // 1. Calcular Totais Consolidados (já estão no objeto group)
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
                                        
                                        // Verifica se a OM Detentora é diferente da OM Favorecida
                                        const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                                        const omDetentora = group.om_detentora;
                                        const ugDetentora = group.ug_detentora;

                                        return (
                                            <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {omName} (UG: {formatCodug(ug)})
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
                                                                    {group.records.length} grupos | Período: {diasOperacaoConsolidado} {diasText} | Efetivo: {efetivoConsolidado} {efetivoText}
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
                                                                        onClick={() => handleEdit(group)} // Passa o grupo consolidado
                                                                        disabled={!isPTrabEditable || isSaving || pendingMaterialConsumo.length > 0}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleConfirmDelete(group)} // Passa o grupo consolidado
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
                                                            {/* OM Detentora Recurso (Sempre visível, vermelha se diferente) */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Detentora Recurso:</span>
                                                                <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                    {omDetentora} ({formatCodug(ugDetentora)})
                                                                </span>
                                                            </div>
                                                            {/* ND 33.90.30 */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                <span className="text-green-600">{formatCurrency(totalND30Consolidado)}</span>
                                                            </div>
                                                            {/* ND 33.90.39 */}
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
                                Tem certeza que deseja excluir o lote de Material de Consumo para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>, contendo {groupToDelete?.records.length} grupo(s)? Esta ação é irreversível.
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
                
                {/* Diálogo de Seleção de Itens */}
                <MaterialConsumoItemSelectorDialog
                    open={showItemSelector}
                    onOpenChange={setShowItemSelector}
                    onSelect={setSelectedItemsFromSelector}
                    selectedYear={selectedYear}
                    initialSelections={currentItemsForSelector}
                    onAddDiretriz={handleAddDiretriz}
                />
            </div>
        </div>
    );
};

export default MaterialConsumoForm;