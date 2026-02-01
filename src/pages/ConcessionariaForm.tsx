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
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Droplet, Zap, Minus } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    calculateConcessionariaTotal, 
    generateConcessionariaMemoriaCalculo,
    generateConsolidatedConcessionariaMemoriaCalculo,
    ConcessionariaRegistro,
    ConsolidatedConcessionariaRecord,
    DiretrizSelection,
} from "@/lib/concessionariaUtils";
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
import ConcessionariaDiretrizSelectorDialog, { ConcessionariaSelection } from "@/components/ConcessionariaDiretrizSelectorDialog";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { ConsolidatedConcessionariaMemoria } from "@/components/ConsolidatedConcessionariaMemoria"; 
import { CategoriaConcessionaria } from "@/types/diretrizesConcessionaria";

// Tipos de dados
type ConcessionariaRegistroDB = Tables<'concessionaria_registros'>; 

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
interface CalculatedConcessionaria extends TablesInsert<'concessionaria_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
    // Novo: Armazena a diretriz selecionada (agora é sempre um array de 1 para registros individuais)
    selected_diretrizes: ConcessionariaSelection[];
}

// NOVO TIPO: Representa um lote consolidado de registros (várias diretrizes)
interface ConsolidatedConcessionaria extends ConsolidatedConcessionariaRecord {
    groupKey: string; 
}

// Estado inicial para o formulário
interface ConcessionariaFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    
    // Dados das Diretrizes Selecionadas (Lista de ConcessionariaSelection)
    selected_diretrizes: ConcessionariaSelection[];
}

const initialFormState: ConcessionariaFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    selected_diretrizes: [],
};

// Helper function to compare form data structures
const compareFormData = (data1: ConcessionariaFormState, data2: ConcessionariaFormState) => {
    // Compare todos os campos relevantes
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.efetivo !== data2.efetivo || 
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_destino !== data2.om_destino || 
        data1.ug_destino !== data2.ug_destino || 
        data1.fase_atividade !== data2.fase_atividade ||
        data1.selected_diretrizes.length !== data2.selected_diretrizes.length
    ) {
        return true;
    }
    
    // Comparar detalhes das diretrizes (IDs)
    const diretrizes1 = data1.selected_diretrizes.map(d => d.id).sort().join('|');
    const diretrizes2 = data2.selected_diretrizes.map(d => d.id).sort().join('|');
    
    if (diretrizes1 !== diretrizes2) {
        return true;
    }
    
    return false;
};


const ConcessionariaForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<ConcessionariaFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<ConcessionariaRegistroDB | null>(null);
    
    // NOVO ESTADO: Armazena o grupo completo a ser excluído/substituído
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedConcessionaria | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedConcessionaria | null>(null); 
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    // Agora, cada item em pendingConcessionaria representa UMA diretriz/registro de DB.
    const [pendingConcessionaria, setPendingConcessionaria] = useState<CalculatedConcessionaria[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedConcessionaria | null>(null);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingConcessionaria
    const [lastStagedFormData, setLastStagedFormData] = useState<ConcessionariaFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida e OM Destino
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    // Estado para o diálogo de seleção de diretrizes
    const [showDiretrizSelector, setShowDiretrizSelector] = useState(false);
    
    // Busca o ano padrão para o seletor de diretrizes
    const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
    const selectedYear = defaultYearData?.year || new Date().getFullYear();

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Concessionária usam a tabela 'concessionaria_registros'
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<ConcessionariaRegistroDB[]>({
        queryKey: ['concessionariaRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('concessionaria_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    // NOVO MEMO: Consolida os registros por lote de solicitação
    const consolidatedRegistros = useMemo<ConsolidatedConcessionaria[]>(() => {
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
                    groupKey: key, 
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora,
                    ug_detentora: registro.ug_detentora,
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo || 0,
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND39: 0,
                };
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedConcessionaria>);

        // Ordenar por OM
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    // 1. Mutation for saving multiple new records (INSERT)
    const insertMutation = useMutation({
        mutationFn: async (newRecords: CalculatedConcessionaria[]) => {
            // Mapear CalculatedConcessionaria (que agora representa uma única diretriz) para TablesInsert
            const recordsToInsert: TablesInsert<'concessionaria_registros'>[] = newRecords.map(r => {
                // O registro CalculatedConcessionaria já contém os dados da diretriz no seu array selected_diretrizes[0]
                const diretriz = r.selected_diretrizes[0];
                
                return {
                    p_trab_id: r.p_trab_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    fase_atividade: r.fase_atividade,
                    
                    // Campos da Diretriz
                    diretriz_id: diretriz.id, // ID da diretriz
                    categoria: diretriz.categoria,
                    valor_unitario: diretriz.custo_unitario,
                    consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                    
                    // Campos consolidados
                    efetivo: r.efetivo,
                    valor_total: r.valor_total,
                    valor_nd_39: r.valor_nd_39,
                    detalhamento: r.detalhamento,
                    detalhamento_customizado: r.detalhamento_customizado,
                };
             });

            const { error } = await supabase
                .from('concessionaria_registros')
                .insert(recordsToInsert);

            if (error) throw error;
            
            return recordsToInsert;
        },
        onSuccess: () => {
            toast.success(`Sucesso! ${pendingConcessionaria.length} registro(s) de Concessionária adicionado(s).`);
            setPendingConcessionaria([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
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
                selected_diretrizes: [], // Limpa as diretrizes selecionadas após salvar
            }));
            
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros.", { description: sanitizeError(error) });
        }
    });

    // 2. Mutation for replacing an entire group of records (UPDATE/REPLACE)
    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedConcessionaria[] }) => {
            // 1. Delete old records
            const { error: deleteError } = await supabase
                .from('concessionaria_registros')
                .delete()
                .in('id', oldIds);
            if (deleteError) throw deleteError;
            
            // 2. Insert new records
            const recordsToInsert: TablesInsert<'concessionaria_registros'>[] = newRecords.map(r => {
                const diretriz = r.selected_diretrizes[0];
                return {
                    p_trab_id: r.p_trab_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    fase_atividade: r.fase_atividade,
                    
                    // Campos da Diretriz
                    diretriz_id: diretriz.id, 
                    categoria: diretriz.categoria,
                    valor_unitario: diretriz.custo_unitario,
                    consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                    
                    // Campos consolidados
                    efetivo: r.efetivo,
                    valor_total: r.valor_total,
                    valor_nd_39: r.valor_nd_39,
                    detalhamento: r.detalhamento,
                    detalhamento_customizado: r.detalhamento_customizado,
                };
             });

            const { error: insertError } = await supabase
                .from('concessionaria_registros')
                .insert(recordsToInsert);

            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Lote de Concessionária atualizado com sucesso!");
            setEditingId(null);
            setStagedUpdate(null);
            setPendingConcessionaria([]);
            setGroupToReplace(null);
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
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
                .from('concessionaria_registros')
                .delete()
                .in('id', recordIds);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote de Concessionária excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setRegistroToDelete(null);
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
    
    // Este cálculo agora é usado apenas para exibir o total consolidado no formulário (Seção 2)
    const calculos = useMemo(() => {
        if (!ptrabData || formData.selected_diretrizes.length === 0 || formData.efetivo <= 0 || formData.dias_operacao <= 0) {
            return {
                totalGeral: 0,
                totalND39: 0,
                memoria: "Selecione pelo menos uma diretriz e preencha os dados de solicitação (dias e efetivo).",
            };
        }
        
        try {
            let totalGeral = 0;
            let totalND39 = 0;
            let memoria = "";
            
            // Gerar a memória consolidada para o STAGING
            const tempGroup: ConsolidatedConcessionariaRecord = {
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                dias_operacao: formData.dias_operacao,
                efetivo: formData.efetivo,
                fase_atividade: formData.fase_atividade,
                records: [], 
                totalGeral: 0, 
                totalND39: 0, 
            };

            formData.selected_diretrizes.forEach((diretriz) => {
                const totalDiretriz = calculateConcessionariaTotal(
                    formData.efetivo,
                    formData.dias_operacao,
                    diretriz.consumo_pessoa_dia,
                    diretriz.custo_unitario
                );
                
                totalGeral += totalDiretriz;
                totalND39 += totalDiretriz; 
                
                // Criar um registro temporário para a função de memória consolidada
                tempGroup.records.push({
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    diretriz_id: diretriz.id,
                    categoria: diretriz.categoria,
                    valor_unitario: diretriz.custo_unitario,
                    consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                    
                    valor_total: totalDiretriz,
                    valor_nd_39: totalDiretriz,
                    detalhamento: `Concessionária: ${diretriz.categoria} - ${diretriz.nome_concessionaria}`,
                    
                    // Campos não usados no cálculo, mas necessários para o tipo
                    id: '', created_at: '', updated_at: '', detalhamento_customizado: null,
                } as ConcessionariaRegistro);
            });
            
            tempGroup.totalGeral = totalGeral;
            tempGroup.totalND39 = totalND39;
            
            memoria = generateConsolidatedConcessionariaMemoriaCalculo(tempGroup);
            
            return {
                totalGeral,
                totalND39,
                memoria,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0,
                totalND39: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, ptrabData, ptrabId]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo"
    const isConcessionariaDirty = useMemo(() => {
        if (pendingConcessionaria.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }
        return false;
    }, [formData, pendingConcessionaria.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingConcessionaria = useMemo(() => {
        return pendingConcessionaria.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingConcessionaria]);
    
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
            selected_diretrizes: [],
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDestinoId(undefined);
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
    };
    
    const handleClearPending = () => {
        setPendingConcessionaria([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        setEditingId(null);
        setGroupToReplace(null);
        resetForm();
    };

    const handleEdit = (group: ConsolidatedConcessionaria) => {
        if (pendingConcessionaria.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        // Limpa estados pendentes
        setPendingConcessionaria([]);
        setLastStagedFormData(null);
        setStagedUpdate(null); 
        
        // Define o modo edição
        setEditingId(group.records[0].id); 
        setGroupToReplace(group); 
        
        // 1. Configurar OM Favorecida e OM Destino
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        // 2. Reconstruir a lista de diretrizes selecionadas a partir de TODOS os registros do grupo
        const diretrizesFromRecords: ConcessionariaSelection[] = group.records.map(registro => ({
            id: registro.diretriz_id, 
            user_id: '', 
            ano_referencia: selectedYear, 
            categoria: registro.categoria as CategoriaConcessionaria,
            nome_concessionaria: registro.detalhamento?.split(': ')[1] || registro.categoria, 
            consumo_pessoa_dia: Number(registro.consumo_pessoa_dia || 0),
            fonte_consumo: null, 
            custo_unitario: Number(registro.valor_unitario || 0),
            fonte_custo: null, 
            unidade_custo: registro.categoria === 'Água/Esgoto' ? 'm³' : 'kWh', 
            created_at: '', updated_at: '',
        }));

        // 3. Populate formData
        const newFormData: ConcessionariaFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo || 0, 
            fase_atividade: group.fase_atividade || "",
            selected_diretrizes: diretrizesFromRecords, 
        };
        setFormData(newFormData);
        
        // 4. Gerar os itens pendentes (staging) imediatamente com os dados originais
        const newPendingItems: CalculatedConcessionaria[] = group.records.map(registro => {
            const diretriz: ConcessionariaSelection = diretrizesFromRecords.find(d => d.id === registro.diretriz_id) || diretrizesFromRecords[0];
            
            const totalDiretriz = calculateConcessionariaTotal(
                registro.efetivo || 0,
                registro.dias_operacao,
                diretriz.consumo_pessoa_dia,
                diretriz.custo_unitario
            );
            
            const calculatedFormData: ConcessionariaRegistro = {
                id: registro.id, 
                p_trab_id: ptrabId!,
                organizacao: registro.organizacao, 
                ug: registro.ug, 
                dias_operacao: registro.dias_operacao,
                fase_atividade: registro.fase_atividade || "",
                
                om_detentora: registro.om_detentora,
                ug_detentora: registro.ug_detentora,
                diretriz_id: diretriz.id,
                categoria: registro.categoria,
                valor_unitario: diretriz.custo_unitario,
                consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                
                efetivo: registro.efetivo || 0,
                
                valor_total: totalDiretriz,
                valor_nd_39: totalDiretriz,
                
                detalhamento: registro.detalhamento, 
                detalhamento_customizado: registro.detalhamento_customizado, 
                
                created_at: registro.created_at,
                updated_at: registro.updated_at,
            } as ConcessionariaRegistro;

            let memoria = generateConcessionariaMemoriaCalculo(calculatedFormData);
            
            return {
                tempId: registro.id, 
                p_trab_id: ptrabId!,
                organizacao: registro.organizacao, 
                ug: registro.ug, 
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo || 0,
                fase_atividade: registro.fase_atividade,
                
                om_detentora: registro.om_detentora,
                ug_detentora: registro.ug_detentora,
                diretriz_id: diretriz.id,
                categoria: registro.categoria,
                valor_unitario: diretriz.custo_unitario,
                consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                
                valor_total: totalDiretriz,
                valor_nd_39: totalDiretriz,
                
                detalhamento: registro.detalhamento, 
                detalhamento_customizado: registro.detalhamento_customizado, 
                
                totalGeral: totalDiretriz,
                memoria_calculo_display: memoria, 
                om_favorecida: registro.organizacao,
                ug_favorecida: registro.ug,
                selected_diretrizes: [diretriz], // Armazena apenas a diretriz relevante
            } as CalculatedConcessionaria;
        });
        
        setPendingConcessionaria(newPendingItems);
        setLastStagedFormData(newFormData); 
        
        toast.info("Modo Edição ativado. Altere os dados na Seção 2 e clique em 'Recalcular/Revisar Lote'.");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedConcessionaria) => {
        setRegistroToDelete(group.records[0]); 
        setGroupToDelete(group); 
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação básica
            if (formData.selected_diretrizes.length === 0) {
                throw new Error("Selecione pelo menos uma diretriz de concessionária na Seção 2.");
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
            
            // 2. Gerar MÚLTIPLOS registros (um para cada diretriz selecionada)
            const newPendingItems: CalculatedConcessionaria[] = formData.selected_diretrizes.map(diretriz => {
                
                const totalDiretriz = calculateConcessionariaTotal(
                    formData.efetivo,
                    formData.dias_operacao,
                    diretriz.consumo_pessoa_dia,
                    diretriz.custo_unitario
                );
                
                const calculatedFormData: ConcessionariaRegistro = {
                    id: crypto.randomUUID(), 
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida, 
                    ug: formData.ug_favorecida, 
                    dias_operacao: formData.dias_operacao,
                    fase_atividade: formData.fase_atividade,
                    
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    diretriz_id: diretriz.id,
                    categoria: diretriz.categoria,
                    valor_unitario: diretriz.custo_unitario,
                    consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                    
                    efetivo: formData.efetivo,
                    
                    valor_total: totalDiretriz,
                    valor_nd_39: totalDiretriz,
                    
                    detalhamento: `Concessionária: ${diretriz.categoria} - ${diretriz.nome_concessionaria}`, 
                    detalhamento_customizado: null, 
                    
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as ConcessionariaRegistro;

                let memoria = generateConcessionariaMemoriaCalculo(calculatedFormData);
                
                return {
                    tempId: crypto.randomUUID(), 
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida, 
                    ug: formData.ug_favorecida, 
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    diretriz_id: diretriz.id,
                    categoria: diretriz.categoria,
                    valor_unitario: diretriz.custo_unitario,
                    consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                    
                    valor_total: totalDiretriz,
                    valor_nd_39: totalDiretriz,
                    
                    detalhamento: `Concessionária: ${diretriz.categoria} - ${diretriz.nome_concessionaria}`, 
                    detalhamento_customizado: null, 
                    
                    totalGeral: totalDiretriz,
                    memoria_calculo_display: memoria, 
                    om_favorecida: formData.om_favorecida,
                    ug_favorecida: formData.ug_favorecida,
                    selected_diretrizes: [diretriz], // Armazena apenas a diretriz relevante
                } as CalculatedConcessionaria;
            });
            
            if (editingId) {
                // MODO EDIÇÃO: Geramos os novos registros e os colocamos em pendingConcessionaria
                
                let memoriaCustomizadaTexto: string | null = null;
                if (groupToReplace) {
                    const originalRecord = groupToReplace.records.find(r => r.id === editingId);
                    if (originalRecord) {
                        memoriaCustomizadaTexto = originalRecord.detalhamento_customizado;
                    }
                }
                
                if (memoriaCustomizadaTexto && newPendingItems.length > 0) {
                    newPendingItems[0].tempId = editingId; 
                    newPendingItems[0].detalhamento_customizado = memoriaCustomizadaTexto;
                }
                
                setPendingConcessionaria(newPendingItems); 
                setStagedUpdate(newPendingItems[0]); 
                setLastStagedFormData(formData); 
                
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar todos os itens gerados à lista pendente
            setPendingConcessionaria(newPendingItems);
            setLastStagedFormData(formData);
            
            toast.info(`${newPendingItems.length} item(ns) de Concessionária adicionado(s) à lista pendente.`);
            
        } catch (err: any) {
            toast.error(err.message || "Erro desconhecido ao calcular.");
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingConcessionaria = () => {
        if (pendingConcessionaria.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        insertMutation.mutate(pendingConcessionaria);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        
        // 1. IDs dos registros antigos para deletar
        const oldIds = groupToReplace.records.map(r => r.id);
        
        // 2. Novos registros (pendingConcessionaria) para inserir
        replaceGroupMutation.mutate({ oldIds, newRecords: pendingConcessionaria });
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingConcessionaria(prev => {
            const newPending = prev.filter(p => p.tempId !== tempId);
            if (newPending.length === 0) {
                setLastStagedFormData(null);
            }
            return newPending;
        });
        toast.info("Item removido da lista pendente.");
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
    
    // --- Lógica de Seleção de Diretriz (Callback do Dialog) ---
    const handleDiretrizSelected = (diretrizes: ConcessionariaSelection[]) => {
        // Atualiza o formulário com a lista de diretrizes selecionadas
        setFormData(prev => ({
            ...prev,
            selected_diretrizes: diretrizes,
        }));
        
        toast.success(`${diretrizes.length} diretriz(es) selecionada(s).`);
    };
    
    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (group: ConsolidatedConcessionariaRecord, memoriaCompleta: string) => {
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
            // A memória customizada é salva APENAS no primeiro registro do grupo.
            const { error } = await supabase
                .from("concessionaria_registros")
                .update({
                    detalhamento_customizado: memoriaEdit.trim() || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["concessionariaRegistros", ptrabId] });
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
                .from("concessionaria_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["concessionariaRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    // --- Handler para Adicionar Contrato ---
    const handleAddContract = () => {
        // Navega para a rota de Custos Operacionais, passando o estado para abrir a seção de concessionárias
        navigate('/config/custos-operacionais', { state: { openConcessionaria: true } });
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
                                    formData.selected_diretrizes.length > 0;

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    // Lógica para a Seção 3
    const itemsToDisplay = editingId ? pendingConcessionaria : pendingConcessionaria;
    const isStagingUpdate = !!editingId && pendingConcessionaria.length > 0;
    
    // Diretrizes iniciais para o diálogo (se estiver editando)
    const initialDiretrizesForDialog = editingId && groupToReplace 
        ? formData.selected_diretrizes 
        : formData.selected_diretrizes;

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
                            Pagamento de Concessionárias
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para pagamento de concessionárias.
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
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingConcessionaria.length > 0}
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
                                            disabled={!isPTrabEditable || isSaving || pendingConcessionaria.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR ITEM (SELEÇÃO DE DIRETRIZ) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Concessionária
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
                                                        
                                                        {/* CAMPO 3: OM DESTINO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="om_destino">OM Destino do Recurso *</Label>
                                                            <OmSelector
                                                                selectedOmId={selectedOmDestinoId}
                                                                onChange={handleOmDestinoChange}
                                                                placeholder="Selecione a OM Destino"
                                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingConcessionaria.length > 0}
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
                                        
                                        {/* Detalhes da Concessionária (Seleção de Diretriz) */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="font-semibold text-base mb-4">
                                                Diretrizes de Consumo Selecionadas
                                            </h4>
                                            
                                            <div className="space-y-4">
                                                <Button 
                                                    type="button" 
                                                    onClick={() => setShowDiretrizSelector(true)}
                                                    disabled={!isPTrabEditable || isSaving}
                                                    variant="secondary"
                                                    className="w-full"
                                                >
                                                    <Droplet className="mr-2 h-4 w-4" />
                                                    <Zap className="mr-2 h-4 w-4" />
                                                    {formData.selected_diretrizes.length > 0 ? `Alterar/Adicionar Diretrizes (${formData.selected_diretrizes.length} selecionadas)` : "Selecionar Diretrizes de Consumo *"}
                                                </Button>
                                                
                                                {/* Exibição das Diretrizes Selecionadas */}
                                                {formData.selected_diretrizes.length > 0 && (
                                                    <div className="border p-3 rounded-md space-y-2">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="w-[150px]">Categoria</TableHead>
                                                                    <TableHead>Concessionária</TableHead>
                                                                    <TableHead className="text-center">Consumo/Pessoa/Dia</TableHead>
                                                                    <TableHead className="text-right">Custo Unitário</TableHead>
                                                                    <TableHead className="text-right">Total Estimado</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {formData.selected_diretrizes.map((diretriz) => {
                                                                    const totalEstimado = calculateConcessionariaTotal(
                                                                        formData.efetivo,
                                                                        formData.dias_operacao,
                                                                        diretriz.consumo_pessoa_dia,
                                                                        diretriz.custo_unitario
                                                                    );
                                                                    
                                                                    const isAgua = diretriz.categoria === 'Água/Esgoto';
                                                                    
                                                                    return (
                                                                        <TableRow key={diretriz.id}>
                                                                            <TableCell className="w-[150px] font-medium text-sm">
                                                                                <span className="flex items-center gap-1">
                                                                                    {isAgua 
                                                                                        ? <Droplet className="h-3 w-3 text-blue-500" /> 
                                                                                        : <Zap className="h-3 w-3 text-yellow-600" />
                                                                                    }
                                                                                    {diretriz.categoria}
                                                                                </span>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {diretriz.nome_concessionaria}
                                                                            </TableCell>
                                                                            <TableCell className="text-center text-sm">
                                                                                {diretriz.consumo_pessoa_dia.toLocaleString('pt-BR')} {diretriz.unidade_custo}
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-sm">
                                                                                {formatCurrency(diretriz.custo_unitario)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-semibold text-sm">
                                                                                {formatCurrency(totalEstimado)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                <span className="font-bold text-sm">VALOR TOTAL DA SOLICITAÇÃO:</span>
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
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({itemsToDisplay.length} {itemsToDisplay.length === 1 ? 'diretriz' : 'diretrizes'})
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Modo Novo Registro) */}
                                    {!editingId && isConcessionariaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isConcessionariaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Recalcular/Revisar Lote" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND39 = item.valor_nd_39;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const efetivoText = item.efetivo === 1 ? 'militar' : 'militares';
                                            
                                            const isOmDestinoDifferent = item.om_favorecida !== item.om_detentora || item.ug_favorecida !== item.ug_detentora;
                                            
                                            const diretriz = item.selected_diretrizes[0];
                                            const isAgua = diretriz.categoria === 'Água/Esgoto';

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
                                                            <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                                                                {isAgua ? <Droplet className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                                                {diretriz.categoria} - {diretriz.nome_concessionaria}
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
                                                                <p className="font-medium">OM Destino do Recurso:</p>
                                                                <p className="font-medium">Período / Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.efetivo} {efetivoText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.39 (Serviços de Terceiros - PJ):</span>
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
                                                VALOR TOTAL DA OM
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(totalPendingConcessionaria)}
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
                                                    disabled={isSaving || isConcessionariaDirty} 
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
                                                    onClick={handleSavePendingConcessionaria}
                                                    disabled={isSaving || pendingConcessionaria.length === 0 || isConcessionariaDirty}
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
                                        const totalOM = group.totalGeral;
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
                                        
                                        const hasAgua = group.records.some(r => r.categoria === 'Água/Esgoto');
                                        const hasEnergia = group.records.some(r => r.categoria === 'Energia Elétrica');

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
                                                                            Concessionárias
                                                                        </h4>
                                                                        {hasAgua && <Droplet className="h-4 w-4 text-blue-500" />}
                                                                        {hasEnergia && <Zap className="h-4 w-4 text-yellow-600" />}
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Itens: {group.records.length} | Período: {diasOperacaoConsolidado} {diasText} | Efetivo: {efetivoConsolidado} {efetivoText}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-extrabold text-xl text-foreground">
                                                                        {formatCurrency(totalND39Consolidado)}
                                                                    </span>
                                                                    {/* Botões de Ação */}
                                                                    <div className="flex gap-1 shrink-0">
                                                                        <Button
                                                                            type="button" 
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            onClick={() => handleEdit(group)} 
                                                                            disabled={!isPTrabEditable || isSaving || pendingConcessionaria.length > 0}
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
                                        <ConsolidatedConcessionariaMemoria
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
                                Tem certeza que deseja excluir o lote de Concessionária para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>, contendo {groupToDelete?.records.length} diretriz(es)? Esta ação é irreversível.
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
                
                {/* Diálogo de Seleção de Diretriz */}
                <ConcessionariaDiretrizSelectorDialog
                    open={showDiretrizSelector}
                    onOpenChange={setShowDiretrizSelector}
                    onSelect={handleDiretrizSelected}
                    selectedYear={selectedYear}
                    initialSelections={initialDiretrizesForDialog}
                    onAddContract={handleAddContract} 
                />
            </div>
        </div>
    );
};

export default ConcessionariaForm;