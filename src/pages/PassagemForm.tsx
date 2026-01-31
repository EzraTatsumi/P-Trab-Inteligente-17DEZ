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
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Plane, Minus } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    calculatePassagemTotals, 
    generatePassagemMemoriaCalculo,
    PassagemRegistro,
    PassagemForm as PassagemFormType,
    generateConsolidatedPassagemMemoriaCalculo,
    ConsolidatedPassagemRecord,
} from "@/lib/passagemUtils";
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
import PassagemTrechoSelectorDialog, { TrechoSelection } from "@/components/PassagemTrechoSelectorDialog";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { ConsolidatedPassagemMemoria } from "@/components/ConsolidatedPassagemMemoria"; 

// Tipos de dados
type PassagemRegistroDB = Tables<'passagem_registros'>; 

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
interface CalculatedPassagem extends TablesInsert<'passagem_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
    // Novo: Armazena o trecho selecionado (agora é sempre um array de 1 para registros individuais)
    selected_trechos: TrechoSelection[];
}

// NOVO TIPO: Representa um lote consolidado de registros (vários trechos)
interface ConsolidatedPassagem extends ConsolidatedPassagemRecord {}

// Estado inicial para o formulário
interface PassagemFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; // NOVO CAMPO
    ug_destino: string; // NOVO CAMPO
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    
    // Dados dos Trechos Selecionados (Lista de TrechoSelection)
    selected_trechos: TrechoSelection[];
}

const initialFormState: PassagemFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    selected_trechos: [],
};

// Função para calcular o valor total de um trecho (considerando ida/volta)
const calculateTrechoTotal = (trecho: TrechoSelection): number => {
    // Assume-se que o valor_unitario já reflete o custo total do trecho (ida ou ida/volta).
    return trecho.valor_unitario * trecho.quantidade_passagens; 
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Helper function to compare form data structures
const compareFormData = (data1: PassagemFormState, data2: PassagemFormState) => {
    // Compare todos os campos relevantes
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.efetivo !== data2.efetivo || 
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_destino !== data2.om_destino || // Comparar OM Destino
        data1.ug_destino !== data2.ug_destino || // Comparar UG Destino
        data1.fase_atividade !== data2.fase_atividade ||
        data1.selected_trechos.length !== data2.selected_trechos.length
    ) {
        return true;
    }
    
    // Comparar detalhes dos trechos (IDs e quantidades)
    const trechos1 = data1.selected_trechos.map(t => `${t.id}-${t.quantidade_passagens}`).sort().join('|');
    const trechos2 = data2.selected_trechos.map(t => `${t.id}-${t.quantidade_passagens}`).sort().join('|');
    
    if (trechos1 !== trechos2) {
        return true;
    }
    
    return false;
};


const PassagemForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<PassagemFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<PassagemRegistroDB | null>(null);
    
    // NOVO ESTADO: Armazena o grupo completo a ser excluído/substituído
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedPassagem | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedPassagem | null>(null); 
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    // Agora, editingMemoriaId rastreia o ID do PRIMEIRO registro do grupo (group.records[0].id)
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    // Agora, cada item em pendingPassagens representa UM trecho/registro de DB.
    const [pendingPassagens, setPendingPassagens] = useState<CalculatedPassagem[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedPassagem | null>(null);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingPassagens
    const [lastStagedFormData, setLastStagedFormData] = useState<PassagemFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida e OM Destino
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    // Estado para o diálogo de seleção de trechos
    const [showTrechoSelector, setShowTrechoSelector] = useState(false);
    
    // Busca o ano padrão para o seletor de trechos
    const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
    const selectedYear = defaultYearData?.year || new Date().getFullYear();

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Passagens usam a tabela 'passagem_registros'
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<PassagemRegistroDB[]>({
        queryKey: ['passagemRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('passagem_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    // NOVO MEMO: Consolida os registros por lote de solicitação
    const consolidatedRegistros = useMemo<ConsolidatedPassagem[]>(() => {
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
                    om_detentora: registro.om_detentora || registro.organizacao, // Garantir fallback
                    ug_detentora: registro.ug_detentora || registro.ug, // Garantir fallback
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo || 0,
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND33: 0,
                };
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND33 += Number(registro.valor_nd_33 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedPassagem>);

        // Ordenar por OM
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    // 1. Mutation for saving multiple new records (INSERT)
    const insertMutation = useMutation({
        mutationFn: async (newRecords: CalculatedPassagem[]) => {
            // Mapear CalculatedPassagem (que agora representa um único trecho) para TablesInsert
            const recordsToInsert: TablesInsert<'passagem_registros'>[] = newRecords.map(r => {
                // O registro CalculatedPassagem já contém os dados do trecho no seu array selected_trechos[0]
                const trecho = r.selected_trechos[0];
                
                return {
                    p_trab_id: r.p_trab_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    fase_atividade: r.fase_atividade,
                    
                    // Campos de Trecho (diretamente do trecho individual)
                    diretriz_id: trecho.diretriz_id,
                    trecho_id: trecho.id,
                    origem: trecho.origem,
                    destino: trecho.destino,
                    tipo_transporte: trecho.tipo_transporte,
                    is_ida_volta: trecho.is_ida_volta,
                    valor_unitario: trecho.valor_unitario,
                    
                    // Campos consolidados (que agora são específicos para este trecho)
                    quantidade_passagens: trecho.quantidade_passagens,
                    valor_total: r.valor_total,
                    valor_nd_33: r.valor_nd_33,
                    detalhamento: r.detalhamento,
                    detalhamento_customizado: r.detalhamento_customizado,
                    efetivo: r.efetivo,
                };
             });

            const { error } = await supabase
                .from('passagem_registros')
                .insert(recordsToInsert);

            if (error) throw error;
            
            return recordsToInsert;
        },
        onSuccess: () => {
            toast.success(`Sucesso! ${pendingPassagens.length} registro(s) de Passagem adicionado(s).`);
            setPendingPassagens([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['passagemRegistros', ptrabId] });
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
                selected_trechos: [], // Limpa os trechos selecionados após salvar
            }));
            
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros.", { description: sanitizeError(error) });
        }
    });

    // 2. Mutation for replacing an entire group of records (UPDATE/REPLACE)
    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedPassagem[] }) => {
            // 1. Delete old records
            const { error: deleteError } = await supabase
                .from('passagem_registros')
                .delete()
                .in('id', oldIds);
            if (deleteError) throw deleteError;
            
            // 2. Insert new records
            const recordsToInsert: TablesInsert<'passagem_registros'>[] = newRecords.map(r => {
                const trecho = r.selected_trechos[0];
                return {
                    p_trab_id: r.p_trab_id,
                    organizacao: r.organizacao,
                    ug: r.ug,
                    om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora,
                    dias_operacao: r.dias_operacao,
                    fase_atividade: r.fase_atividade,
                    diretriz_id: trecho.diretriz_id,
                    trecho_id: trecho.id,
                    origem: trecho.origem,
                    destino: trecho.destino,
                    tipo_transporte: trecho.tipo_transporte,
                    is_ida_volta: trecho.is_ida_volta,
                    valor_unitario: trecho.valor_unitario,
                    quantidade_passagens: trecho.quantidade_passagens,
                    valor_total: r.valor_total,
                    valor_nd_33: r.valor_nd_33,
                    detalhamento: r.detalhamento,
                    detalhamento_customizado: r.detalhamento_customizado,
                    efetivo: r.efetivo,
                };
             });

            const { error: insertError } = await supabase
                .from('passagem_registros')
                .insert(recordsToInsert);

            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Lote de Passagem atualizado com sucesso!");
            setEditingId(null);
            setStagedUpdate(null);
            setPendingPassagens([]);
            setGroupToReplace(null);
            queryClient.invalidateQueries({ queryKey: ['passagemRegistros', ptrabId] });
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
                .from('passagem_registros')
                .delete()
                .in('id', recordIds);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote de Passagem excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['passagemRegistros', ptrabId] });
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
                // Manter a OM Favorecida (do PTrab) se já estiver definida
                om_favorecida: "", 
                ug_favorecida: "", 
                om_destino: "",
                ug_destino: "",
            }));
            setSelectedOmFavorecidaId(undefined); 
            setSelectedOmDestinoId(undefined);
            
        } else if (ptrabData && editingId) {
            // Modo Edição: Preencher
            // Nota: Em modo edição, formData já deve ter sido preenchido por handleEdit
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
        if (!ptrabData || formData.selected_trechos.length === 0) {
            return {
                totalGeral: 0,
                totalND33: 0,
                memoria: "Selecione pelo menos um trecho e preencha os dados de solicitação.",
            };
        }
        
        try {
            let totalGeral = 0;
            let totalND33 = 0;
            
            // Gerar a memória consolidada para o STAGING
            const tempGroup: ConsolidatedPassagemRecord = {
                groupKey: 'staging',
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                dias_operacao: formData.dias_operacao,
                efetivo: formData.efetivo,
                fase_atividade: formData.fase_atividade,
                records: [], // Preenchido abaixo
                totalGeral: 0, // Preenchido abaixo
                totalND33: 0, // Preenchido abaixo
            };

            formData.selected_trechos.forEach((trecho) => {
                const totalTrecho = calculateTrechoTotal(trecho);
                
                totalGeral += totalTrecho;
                totalND33 += totalTrecho; 
                
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
                    diretriz_id: trecho.diretriz_id,
                    trecho_id: trecho.id,
                    origem: trecho.origem,
                    destino: trecho.destino,
                    tipo_transporte: trecho.tipo_transporte,
                    is_ida_volta: trecho.is_ida_volta,
                    valor_unitario: trecho.valor_unitario,
                    quantidade_passagens: trecho.quantidade_passagens,
                    valor_total: totalTrecho,
                    valor_nd_33: totalTrecho,
                    // Campos não usados no cálculo, mas necessários para o tipo
                    id: crypto.randomUUID(), // ID temporário
                    created_at: new Date().toISOString(), 
                    updated_at: new Date().toISOString(), 
                    detalhamento: '', 
                    detalhamento_customizado: null, 
                    valor_nd_30: 0,
                } as PassagemRegistro);
            });
            
            tempGroup.totalGeral = totalGeral;
            tempGroup.totalND33 = totalND33;
            
            const memoria = generateConsolidatedPassagemMemoriaCalculo(tempGroup);
            
            return {
                totalGeral,
                totalND33,
                memoria,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0,
                totalND33: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, ptrabData, ptrabId]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate ou lastStagedFormData)
    const isPassagemDirty = useMemo(() => {
        // MODO EDIÇÃO: Compara com o estado que gerou os pendingPassagens (que é o estado que será salvo)
        if (editingId && pendingPassagens.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }
        
        // MODO NOVO REGISTRO: Compara com lastStagedFormData
        if (!editingId && pendingPassagens.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [editingId, formData, pendingPassagens.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingPassagens = useMemo(() => {
        return pendingPassagens.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingPassagens]);
    
    // O memo registrosAgrupadosPorOM foi substituído por consolidatedRegistros
    
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
            om_destino: prev.om_destino,
            ug_destino: prev.ug_destino,
            // Resetar campos de solicitação
            dias_operacao: 0,
            efetivo: 0,
            fase_atividade: "",
            selected_trechos: [],
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDestinoId(undefined);
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
    };
    
    const handleClearPending = () => {
        setPendingPassagens([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        setEditingId(null);
        setGroupToReplace(null);
        resetForm();
    };

    const handleEdit = (group: ConsolidatedPassagem) => {
        if (pendingPassagens.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        // Limpa estados pendentes
        setPendingPassagens([]);
        setLastStagedFormData(null);
        setStagedUpdate(null); 
        
        // Define o modo edição
        setEditingId(group.records[0].id); // Usa o ID do primeiro registro para controle de UI
        setGroupToReplace(group); // Armazena o grupo original para substituição
        
        // 1. Configurar OM Favorecida e OM Destino
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        // 2. Reconstruir a lista de trechos selecionados a partir de TODOS os registros do grupo
        const trechosFromRecords: TrechoSelection[] = group.records.map(registro => ({
            id: registro.trecho_id, // Usar trecho_id como id
            diretriz_id: registro.diretriz_id,
            om_detentora: registro.om_detentora || registro.organizacao,
            ug_detentora: registro.ug_detentora || registro.ug,
            origem: registro.origem,
            destino: registro.destino,
            tipo_transporte: registro.tipo_transporte as TipoTransporte,
            is_ida_volta: registro.is_ida_volta,
            valor_unitario: Number(registro.valor_unitario || 0),
            quantidade_passagens: registro.quantidade_passagens,
            valor: Number(registro.valor_unitario || 0), // Adiciona 'valor' para compatibilidade com TrechoPassagem
        }));

        // 3. Populate formData
        const newFormData: PassagemFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo || 0, // CORRIGIDO: Garantir que efetivo seja número
            fase_atividade: group.fase_atividade || "",
            selected_trechos: trechosFromRecords, // TODOS os trechos
        };
        setFormData(newFormData);
        
        // 4. Gerar os itens pendentes (staging) imediatamente com os dados originais
        const newPendingItems: CalculatedPassagem[] = group.records.map(registro => {
            const trecho: TrechoSelection = {
                id: registro.trecho_id, 
                diretriz_id: registro.diretriz_id,
                om_detentora: registro.om_detentora || registro.organizacao,
                ug_detentora: registro.ug_detentora || registro.ug,
                origem: registro.origem,
                destino: registro.destino,
                tipo_transporte: registro.tipo_transporte as TipoTransporte,
                is_ida_volta: registro.is_ida_volta,
                valor_unitario: Number(registro.valor_unitario || 0),
                quantidade_passagens: registro.quantidade_passagens,
                valor: Number(registro.valor_unitario || 0),
            };
            
            const totalTrecho = calculateTrechoTotal(trecho);
            
            // O registro de DB (PassagemRegistro) é usado para gerar a memória individual
            const dbRecord: PassagemRegistro = {
                ...registro,
                valor_unitario: Number(registro.valor_unitario || 0),
                valor_total: totalTrecho,
                valor_nd_33: totalTrecho,
                efetivo: registro.efetivo || 0, // Garantir que efetivo seja número
                om_detentora: registro.om_detentora || registro.organizacao,
                ug_detentora: registro.ug_detentora || registro.ug,
            } as PassagemRegistro;

            // Usamos a função de memória individual para o staging, pois cada item é um registro de DB
            let memoria = generatePassagemMemoriaCalculo(dbRecord);
            
            return {
                tempId: registro.id, // Usamos o ID real do DB como tempId para rastreamento
                p_trab_id: registro.p_trab_id,
                organizacao: registro.organizacao, 
                ug: registro.ug, 
                dias_operacao: registro.dias_operacao,
                efetivo: registro.efetivo || 0,
                fase_atividade: registro.fase_atividade || "",
                
                om_detentora: registro.om_detentora || registro.organizacao,
                ug_detentora: registro.ug_detentora || registro.ug,
                diretriz_id: trecho.diretriz_id,
                trecho_id: trecho.id, 
                origem: trecho.origem,
                destino: registro.destino,
                tipo_transporte: registro.tipo_transporte,
                is_ida_volta: registro.is_ida_volta,
                valor_unitario: trecho.valor_unitario,
                quantidade_passagens: registro.quantidade_passagens,
                
                valor_total: totalTrecho,
                valor_nd_33: totalTrecho,
                
                detalhamento: registro.detalhamento, 
                detalhamento_customizado: registro.detalhamento_customizado, 
                
                totalGeral: totalTrecho,
                memoria_calculo_display: memoria, 
                om_favorecida: registro.organizacao,
                ug_favorecida: registro.ug,
                selected_trechos: [trecho], 
            } as CalculatedPassagem;
        });
        
        setPendingPassagens(newPendingItems);
        setLastStagedFormData(newFormData); // Marca o formulário como staged (limpo)
        
        toast.info("Modo Edição ativado. Altere os dados na Seção 2 e clique em 'Recalcular/Revisar Lote'.");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedPassagem) => {
        // Usamos o primeiro registro apenas para exibir o nome da OM no diálogo
        setRegistroToDelete(group.records[0]); 
        setGroupToDelete(group); // Armazena o grupo completo para exclusão
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação básica
            if (formData.selected_trechos.length === 0) {
                throw new Error("Selecione pelo menos um trecho de passagem na Seção 2.");
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
            
            // Validação de quantidade de passagens
            const totalPassagens = formData.selected_trechos.reduce((sum, t) => sum + t.quantidade_passagens, 0);
            if (totalPassagens <= 0) {
                throw new Error("A quantidade total de passagens solicitadas deve ser maior que zero.");
            }
            
            // 2. Gerar MÚLTIPLOS registros (um para cada trecho)
            const newPendingItems: CalculatedPassagem[] = formData.selected_trechos.map(trecho => {
                
                const totalTrecho = calculateTrechoTotal(trecho);
                
                const calculatedFormData: PassagemRegistro = {
                    id: crypto.randomUUID(), // ID temporário para gerar memória
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida, 
                    ug: formData.ug_favorecida, 
                    dias_operacao: formData.dias_operacao,
                    fase_atividade: formData.fase_atividade,
                    
                    // Dados do Trecho Selecionado
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    diretriz_id: trecho.diretriz_id,
                    trecho_id: trecho.id, 
                    origem: trecho.origem,
                    destino: trecho.destino,
                    tipo_transporte: trecho.tipo_transporte,
                    is_ida_volta: trecho.is_ida_volta,
                    valor_unitario: trecho.valor_unitario,
                    
                    // Quantidade
                    quantidade_passagens: trecho.quantidade_passagens,
                    efetivo: formData.efetivo,
                    
                    valor_total: totalTrecho,
                    valor_nd_33: totalTrecho,
                    
                    detalhamento: `Passagem: ${trecho.origem} -> ${trecho.destino}`, 
                    detalhamento_customizado: null, 
                    
                    // Campos obrigatórios do tipo DB
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    valor_nd_30: 0,
                };

                // Usamos a função de memória individual para o staging, pois cada item é um registro de DB
                let memoria = generatePassagemMemoriaCalculo(calculatedFormData);
                
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
                    diretriz_id: trecho.diretriz_id,
                    trecho_id: trecho.id, 
                    origem: trecho.origem,
                    destino: trecho.destino,
                    tipo_transporte: trecho.tipo_transporte,
                    is_ida_volta: trecho.is_ida_volta,
                    valor_unitario: trecho.valor_unitario,
                    quantidade_passagens: trecho.quantidade_passagens,
                    
                    valor_total: totalTrecho,
                    valor_nd_33: totalTrecho,
                    
                    detalhamento: `Passagem: ${trecho.origem} -> ${trecho.destino}`, 
                    detalhamento_customizado: null, 
                    
                    totalGeral: totalTrecho,
                    memoria_calculo_display: memoria, 
                    om_favorecida: formData.om_favorecida,
                    ug_favorecida: formData.ug_favorecida,
                    selected_trechos: [trecho], // Armazena apenas o trecho relevante
                } as CalculatedPassagem;
            });
            
            if (editingId) {
                // MODO EDIÇÃO: Geramos os novos registros e os colocamos em pendingPassagens
                
                // Preserva a memória customizada do primeiro registro do grupo original, se existir
                let memoriaCustomizadaTexto: string | null = null;
                if (groupToReplace) {
                    // Busca o primeiro registro do grupo original para verificar a memória customizada
                    const originalRecord = groupToReplace.records.find(r => r.id === editingId);
                    if (originalRecord) {
                        memoriaCustomizadaTexto = originalRecord.detalhamento_customizado;
                    }
                }
                
                // Aplicamos a memória customizada ao primeiro item da nova lista (apenas para fins de staging display)
                if (memoriaCustomizadaTexto && newPendingItems.length > 0) {
                    newPendingItems[0].tempId = editingId; 
                    newPendingItems[0].detalhamento_customizado = memoriaCustomizadaTexto;
                }
                
                setPendingPassagens(newPendingItems); // Armazena o novo lote completo
                setStagedUpdate(newPendingItems[0]); // Usa o primeiro item para display de revisão
                setLastStagedFormData(formData); // Marca o formulário como staged
                
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar todos os itens gerados à lista pendente
            
            // Se já houver itens pendentes, limpamos e adicionamos os novos (assumindo que o usuário está recalculando o lote)
            setPendingPassagens(newPendingItems);
            
            // Atualiza o lastStagedFormData para o estado atual do formulário
            setLastStagedFormData(formData);
            
            toast.info(`${newPendingItems.length} item(ns) de Passagem adicionado(s) à lista pendente.`);
            
            // Manter campos de contexto. NÃO LIMPAR selected_trechos aqui.
            
        } catch (err: any) {
            toast.error(err.message || "Erro desconhecido ao calcular.");
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingPassagens = () => {
        if (pendingPassagens.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        insertMutation.mutate(pendingPassagens);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        
        // 1. IDs dos registros antigos para deletar
        const oldIds = groupToReplace.records.map(r => r.id);
        
        // 2. Novos registros (pendingPassagens) para inserir
        replaceGroupMutation.mutate({ oldIds, newRecords: pendingPassagens });
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingPassagens(prev => {
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
    
    // --- Lógica de Seleção de Trecho (Callback do Dialog) ---
    const handleTrechoSelected = (trechos: TrechoSelection[]) => {
        // Atualiza o formulário com a lista de trechos selecionados
        setFormData(prev => ({
            ...prev,
            selected_trechos: trechos,
        }));
        
        toast.success(`${trechos.length} trecho(s) selecionado(s).`);
    };
    
    // --- Lógica de Edição de Quantidade de Trecho no Formulário Principal ---
    const handleTrechoQuantityChange = (trechoId: string, quantity: number) => {
        // Garante que a quantidade não seja negativa
        if (quantity < 0) return;
        
        setFormData(prev => {
            const newSelections = prev.selected_trechos.map(t => 
                t.id === trechoId ? { ...t, quantidade_passagens: quantity } : t
            );
            
            // Não remove o trecho se a quantidade for zero.
            return {
                ...prev,
                selected_trechos: newSelections,
            };
        });
    };
    
    // --- Lógica de Edição de Memória ---
    
    // Agora, handleIniciarEdicaoMemoria recebe o grupo consolidado E a string da memória completa
    const handleIniciarEdicaoMemoria = (group: ConsolidatedPassagem, memoriaCompleta: string) => {
        // Usamos o ID do primeiro registro do grupo para rastrear a edição
        const firstRecordId = group.records[0].id;
        setEditingMemoriaId(firstRecordId);
        
        // Preenche o estado de edição com a memória completa (automática ou customizada + Pregão/UASG)
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
            // O componente ConsolidatedPassagemMemoria.tsx se encarrega de adicionar a linha do Pregão/UASG
            // na exibição e na edição, mas o que é salvo no DB é apenas o texto do usuário.
            
            // Remove a linha do Pregão/UASG antes de salvar, se ela estiver presente no texto de edição
            const cleanedMemoria = memoriaEdit.split('\n').filter(line => 
                !line.includes('(Pregão') && !line.includes('UASG')
            ).join('\n').trim();
            
            const { error } = await supabase
                .from("passagem_registros")
                .update({
                    detalhamento_customizado: cleanedMemoria || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["passagemRegistros", ptrabId] });
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
                .from("passagem_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["passagemRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    // --- Handler para Adicionar Contrato ---
    const handleAddContract = () => {
        // CORREÇÃO: Navegar para a rota correta de Custos Operacionais, passando o estado para abrir a seção de passagens
        navigate('/config/custos-operacionais', { state: { openPassagens: true } });
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
                                    formData.om_destino.length > 0 && // Adicionado aqui
                                    formData.ug_destino.length > 0 && // Adicionado aqui
                                    formData.selected_trechos.length > 0 &&
                                    formData.selected_trechos.every(t => t.quantidade_passagens > 0); // Verifica se há quantidade > 0

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    // Lógica para a Seção 3
    // Em modo edição, pendingPassagens armazena o novo cálculo, e stagedUpdate é o primeiro item para display.
    const itemsToDisplay = editingId ? pendingPassagens : pendingPassagens;
    const isStagingUpdate = !!editingId && pendingPassagens.length > 0;
    
    // Trechos iniciais para o diálogo (se estiver editando)
    const initialTrechosForDialog = editingId && groupToReplace 
        ? formData.selected_trechos // Usa o formData que foi populado pelo handleEdit
        : formData.selected_trechos;

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
                            Aquisição de Passagens
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para aquisição de passagens aéreas, terrestres ou fluviais.
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
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingPassagens.length > 0}
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
                                            disabled={!isPTrabEditable || isSaving || pendingPassagens.length > 0}
                                        />
                                    </div>
                                    
                                    {/* OM DESTINO DO RECURSO (REMOVIDO DA SEÇÃO 1) */}
                                    {/* UG DESTINO (REMOVIDO DA SEÇÃO 1) */}
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR ITEM (SELEÇÃO DE TRECHO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Passagem
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação (Dias, Efetivo, OM Destino) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período, Efetivo e Destino do Recurso</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                {/* Ajuste da grade para 4 colunas (ou 2x2) */}
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
                                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingPassagens.length > 0}
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
                                        
                                        {/* Detalhes da Passagem (Seleção de Trecho) */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="font-semibold text-base mb-4">
                                                Trechos e Contratos Selecionados
                                            </h4>
                                            
                                            <div className="space-y-4">
                                                <Button 
                                                    type="button" 
                                                    onClick={() => setShowTrechoSelector(true)}
                                                    disabled={!isPTrabEditable || isSaving}
                                                    variant="secondary"
                                                    className="w-full"
                                                >
                                                    <Plane className="mr-2 h-4 w-4" />
                                                    {formData.selected_trechos.length > 0 ? `Alterar/Adicionar Trechos (${formData.selected_trechos.length} selecionados)` : "Selecionar Trechos de Contrato *"}
                                                </Button>
                                                
                                                {/* Exibição dos Múltiplos Trechos Selecionados */}
                                                {formData.selected_trechos.length > 0 && (
                                                    <div className="border p-3 rounded-md space-y-2">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                                                    <TableHead>Trecho</TableHead>
                                                                    <TableHead>Tipo</TableHead>
                                                                    <TableHead className="text-right">Valor Unitário</TableHead>
                                                                    <TableHead className="text-right">Total Trecho</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {formData.selected_trechos.map((trecho, index) => {
                                                                    const totalTrecho = calculateTrechoTotal(trecho);
                                                                    
                                                                    return (
                                                                        <TableRow key={trecho.id}>
                                                                            <TableCell className="w-[100px]">
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0} 
                                                                                        placeholder="Ex: 3"
                                                                                        value={trecho.quantidade_passagens === 0 ? "" : trecho.quantidade_passagens}
                                                                                        onChange={(e) => handleTrechoQuantityChange(trecho.id, parseInt(e.target.value) || 0)}
                                                                                        onWheel={(e) => e.currentTarget.blur()} // Desabilita roda do mouse
                                                                                        onKeyDown={(e) => { // Desabilita setas do teclado
                                                                                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                                                                                e.preventDefault();
                                                                                            }
                                                                                        }}
                                                                                        className="w-20 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                        disabled={!isPTrabEditable || isSaving}
                                                                                    />
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {trecho.origem} &rarr; {trecho.destino}
                                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                                    Contratante: {trecho.om_detentora} ({formatCodug(trecho.ug_detentora)})
                                                                                </p>
                                                                            </TableCell>
                                                                            <TableCell className="text-xs">
                                                                                {/* Formatação em duas linhas */}
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-medium">{trecho.tipo_transporte}</span>
                                                                                    <span className="text-muted-foreground">({trecho.is_ida_volta ? 'Ida/Volta' : 'Ida'})</span>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-sm">
                                                                                {formatCurrency(trecho.valor_unitario)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-semibold text-sm">
                                                                                {formatCurrency(totalTrecho)}
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
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({itemsToDisplay.length} trecho(s))
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Modo Novo Registro) */}
                                    {!editingId && isPassagemDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isPassagemDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Recalcular/Revisar Lote" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND33 = item.valor_nd_33;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            // Agora, item.selected_trechos deve ter apenas 1 item, mas usamos reduce para segurança
                                            const totalPassagens = item.selected_trechos.reduce((sum, t) => sum + t.quantidade_passagens, 0);
                                            const passagemText = totalPassagens === 1 ? 'passagem' : 'passagens'; 
                                            const efetivoText = item.efetivo === 1 ? 'militar' : 'militares';
                                            
                                            const isOmDestinoDifferent = item.om_favorecida !== item.om_detentora || item.ug_favorecida !== item.ug_detentora;
                                            
                                            const trechoCount = item.selected_trechos.length;
                                            const trechoText = trechoCount === 1 ? 'Trecho' : 'Trechos';

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
                                                                Passagens ({item.selected_trechos[0].origem} &rarr; {item.selected_trechos[0].destino})
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
                                                                <p className="font-medium">Total Passagens:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{totalPassagens} {passagemText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.33 (Passagens):</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(totalND33)}</span>
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
                                                {formatCurrency(totalPendingPassagens)}
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
                                                    disabled={isSaving || isPassagemDirty} 
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
                                                    onClick={handleSavePendingPassagens}
                                                    // O botão de salvar deve ser desabilitado se houver dirty check,
                                                    // pois o usuário precisa re-staged o item alterado.
                                                    disabled={isSaving || pendingPassagens.length === 0 || isPassagemDirty}
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
                                        const totalPassagensConsolidado = group.records.reduce((sum, r) => r.quantidade_passagens + sum, 0);
                                        const totalND33Consolidado = group.totalND33;
                                        
                                        const diasOperacaoConsolidado = group.dias_operacao;
                                        const efetivoConsolidado = group.efetivo;
                                        
                                        const omName = group.organizacao;
                                        const ug = group.ug;
                                        const faseAtividade = group.fase_atividade || 'Não Definida';
                                        
                                        const diasText = diasOperacaoConsolidado === 1 ? 'dia' : 'dias';
                                        const efetivoText = efetivoConsolidado === 1 ? 'militar' : 'militares';
                                        const passagemText = totalPassagensConsolidado === 1 ? 'passagem' : 'passagens';
                                        
                                        // Verifica se a OM Detentora é diferente da OM Favorecida
                                        const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                                        const omDestino = group.om_detentora;
                                        const ugDestino = group.ug_detentora;

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
                                                
                                                {/* CORPO CONSOLIDADO (Card 1537) */}
                                                <div className="space-y-3">
                                                    <Card 
                                                        key={group.groupKey} 
                                                        className="p-3 bg-background border"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-base text-foreground">
                                                                        Passagens
                                                                    </h4>
                                                                </div>
                                                                {/* P 1556: Quantidade total de passagens, dias e efetivo */}
                                                                <p className="text-xs text-muted-foreground">
                                                                    {totalPassagensConsolidado} {passagemText} | Período: {diasOperacaoConsolidado} {diasText} | Efetivo: {efetivoConsolidado} {efetivoText}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {/* SPAN 1561: Total Geral de Passagens (ND 33.90.33) - Restaurado para font-extrabold text-xl text-foreground */}
                                                                <span className="font-extrabold text-xl text-foreground">
                                                                    {formatCurrency(totalND33Consolidado)}
                                                                </span>
                                                                {/* Botões de Ação */}
                                                                <div className="flex gap-1 shrink-0">
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleEdit(group)} // Passa o grupo consolidado
                                                                        disabled={!isPTrabEditable || isSaving || pendingPassagens.length > 0}
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
                                                            {/* OM Destino Recurso (Sempre visível, vermelha se diferente) */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                    {omDestino} ({formatCodug(ugDestino)})
                                                                </span>
                                                            </div>
                                                            {/* SPAN 1600: ND 33.90.33 */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.33:</span>
                                                                <span className="text-green-600">{formatCurrency(totalND33Consolidado)}</span>
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
                                        <ConsolidatedPassagemMemoria
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
                                Tem certeza que deseja excluir o lote de Passagem para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>, contendo {groupToDelete?.records.length} trecho(s)? Esta ação é irreversível.
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
                
                {/* Diálogo de Seleção de Trecho */}
                <PassagemTrechoSelectorDialog
                    open={showTrechoSelector}
                    onOpenChange={setShowTrechoSelector}
                    onSelect={handleTrechoSelected}
                    selectedYear={selectedYear}
                    initialSelections={initialTrechosForDialog}
                    onAddContract={handleAddContract} // Passando o novo handler
                />
            </div>
        </div>
    );
};

export default PassagemForm;