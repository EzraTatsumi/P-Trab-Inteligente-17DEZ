"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    calculateSuprimentoFundosTotals, 
    generateSuprimentoFundosMemoriaCalculo,
    SuprimentoFundosRegistro, 
} from "@/lib/suprimentoFundosUtils"; 
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
import { suprimentoFundosSchema } from "@/lib/validationSchemas"; 

// Tipos de dados
type SuprimentoFundosRegistroDB = Tables<'verba_operacional_registros'>; 

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
interface CalculatedSuprimentoFundos extends TablesInsert<'verba_operacional_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
}

// Função para calcular ND 30 com base no Total Solicitado e ND 39 (ND 30 é a dependente)
const calculateND30 = (totalSolicitado: number, nd39Value: number): number => {
    const nd30 = totalSolicitado - nd39Value;
    return Math.max(0, nd30); // ND 30 não pode ser negativo
};

// Constantes para a OM Detentora padrão (CIE) - Mantido para compatibilidade com registros antigos
const DEFAULT_OM_DETENTORA = "CIE";
const DEFAULT_UG_DETENTORA = "160062";

// Estado inicial para o formulário
const initialFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    dias_operacao: 0,
    quantidade_equipes: 0, 
    valor_total_solicitado: 0,
    fase_atividade: "",
    om_detentora: "", 
    ug_detentora: "", 
    // NOVOS CAMPOS
    objeto_aquisicao: "",
    objeto_contratacao: "",
    proposito: "",
    finalidade: "",
    local: "",
    tarefa: "",
    // NDs
    valor_nd_30: 0,
    valor_nd_39: 0,
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Helper function to compare form data structures
const compareFormData = (data1: typeof initialFormState, data2: typeof initialFormState) => {
    // Compare all relevant input fields
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.quantidade_equipes !== data2.quantidade_equipes ||
        !areNumbersEqual(data1.valor_total_solicitado, data2.valor_total_solicitado) ||
        !areNumbersEqual(data1.valor_nd_39, data2.valor_nd_39) || 
        data1.om_detentora !== data2.om_detentora ||
        data1.ug_detentora !== data2.ug_detentora ||
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.fase_atividade !== data2.fase_atividade ||
        data1.objeto_aquisicao !== data2.objeto_aquisicao ||
        data1.objeto_contratacao !== data2.objeto_contratacao ||
        data1.proposito !== data2.proposito ||
        data1.finalidade !== data2.finalidade ||
        data1.local !== data2.local ||
        data1.tarefa !== data2.tarefa
    ) {
        return true;
    }
    return false;
};


const SuprimentoFundosForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<SuprimentoFundosRegistroDB | null>(null);
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingSuprimentos, setPendingSuprimentos] = useState<CalculatedSuprimentoFundos[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedSuprimentoFundos | null>(null);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingSuprimentos
    const [lastStagedFormData, setLastStagedFormData] = useState<typeof initialFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida (OM do PTrab)
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    
    // Estado para rastrear o ID da OM Detentora (OM Destino do Recurso)
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    // Estado para inputs monetários
    const [rawTotalInput, setRawTotalInput] = useState<string>(numberToRawDigits(initialFormState.valor_total_solicitado));
    // ND 30 é calculada, ND 39 é input manual
    const [rawND39Input, setRawND39Input] = useState<string>(numberToRawDigits(initialFormState.valor_nd_39));

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // SuprimentoFundos usa a tabela 'verba_operacional_registros'
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<SuprimentoFundosRegistroDB[]>({
        queryKey: ['suprimentoFundosRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!), 
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.detalhamento === 'Suprimento de Fundos').sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Efeito de inicialização da OM Favorecida (OM do PTrab)
    useEffect(() => {
        if (ptrabData && !editingId) {
            setFormData(prev => ({
                ...prev,
                om_favorecida: "", 
                ug_favorecida: "", 
            }));
            setSelectedOmFavorecidaId(undefined); 
            
            const cieOm = oms?.find(om => om.nome_om === DEFAULT_OM_DETENTORA && om.codug_om === DEFAULT_UG_DETENTORA);
            if (cieOm) {
                setSelectedOmDetentoraId(cieOm.id);
                setFormData(prev => ({
                    ...prev,
                    om_detentora: DEFAULT_OM_DETENTORA,
                    ug_detentora: DEFAULT_UG_DETENTORA,
                }));
            } else {
                setSelectedOmDetentoraId(undefined);
                setFormData(prev => ({
                    ...prev,
                    om_detentora: DEFAULT_OM_DETENTORA,
                    ug_detentora: DEFAULT_UG_DETENTORA,
                }));
            }
            
        } else if (ptrabData && editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === formData.om_favorecida && om.codug_om === formData.ug_favorecida);
            const omDetentora = oms?.find(om => om.nome_om === formData.om_detentora && om.codug_om === formData.ug_detentora);
            
            setSelectedOmFavorecidaId(omFavorecida?.id);
            setSelectedOmDetentoraId(omDetentora?.id);
        }
    }, [ptrabData, oms, editingId]);

    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    const calculos = useMemo(() => {
        if (!ptrabData) {
            return {
                totalGeral: 0,
                totalND30: 0,
                totalND39: 0,
                memoria: "Preencha todos os campos obrigatórios.",
            };
        }
        
        try {
            const totalSolicitado = formData.valor_total_solicitado;
            const nd39Value = formData.valor_nd_39; 
            const nd30Value = calculateND30(totalSolicitado, nd39Value); 
            
            const calculatedFormData: SuprimentoFundosRegistro = {
                ...formData,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                valor_nd_30: nd30Value,
                valor_nd_39: nd39Value,
            };

            const totals = calculateSuprimentoFundosTotals(calculatedFormData as any);
            const memoria = generateSuprimentoFundosMemoriaCalculo(calculatedFormData as any);
            
            return {
                ...totals,
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
    }, [formData, ptrabData]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate ou lastStagedFormData)
    const isSuprimentoDirty = useMemo(() => {
        if (editingId && stagedUpdate) {
            const stagedFormData: typeof initialFormState = {
                om_favorecida: stagedUpdate.organizacao,
                ug_favorecida: stagedUpdate.ug,
                om_detentora: stagedUpdate.om_detentora || '',
                ug_detentora: stagedUpdate.ug_detentora || '',
                dias_operacao: stagedUpdate.dias_operacao,
                quantidade_equipes: stagedUpdate.quantidade_equipes,
                valor_total_solicitado: stagedUpdate.valor_total_solicitado,
                valor_nd_30: stagedUpdate.valor_nd_30,
                valor_nd_39: stagedUpdate.valor_nd_39,
                fase_atividade: stagedUpdate.fase_atividade || '',
                objeto_aquisicao: stagedUpdate.objeto_aquisicao || '',
                objeto_contratacao: stagedUpdate.objeto_contratacao || '',
                proposito: stagedUpdate.proposito || '',
                finalidade: stagedUpdate.finalidade || '',
                local: stagedUpdate.local || '',
                tarefa: stagedUpdate.tarefa || '',
            };
            
            return compareFormData(formData, stagedFormData);
        }
        
        if (!editingId && pendingSuprimentos.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [editingId, stagedUpdate, formData, pendingSuprimentos.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingSuprimentos = useMemo(() => {
        return pendingSuprimentos.reduce((sum, item) => sum + item.valor_total_solicitado, 0);
    }, [pendingSuprimentos]);
    
    // NOVO MEMO: Agrupa os registros por OM Favorecida (organizacao/ug)
    const registrosAgrupadosPorOM = useMemo(() => {
        return registros?.reduce((acc, registro) => {
            const omFavorecida = registro.organizacao; 
            const ugFavorecida = registro.ug; 
            const key = `${omFavorecida} (${ugFavorecida})`;
            
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(registro);
            return acc;
        }, {} as Record<string, SuprimentoFundosRegistroDB[]>) || {};
    }, [registros]);

    // =================================================================
    // HANDLERS DE INPUT
    // =================================================================
    
    const handleCurrencyChange = (field: 'valor_total_solicitado' | 'valor_nd_39', rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        
        setFormData(prev => {
            let newFormData = { ...prev };
            let newND30Value = prev.valor_nd_30;
            let newND39Value = prev.valor_nd_39;
            let newTotalValue = prev.valor_total_solicitado;

            if (field === 'valor_total_solicitado') {
                setRawTotalInput(digits); 
                newTotalValue = numericValue;
                newND30Value = calculateND30(newTotalValue, newND39Value);
                
            } else if (field === 'valor_nd_39') {
                setRawND39Input(digits); 
                newND39Value = numericValue;
                
                if (newTotalValue > 0 && newND39Value > newTotalValue) {
                    newND39Value = newTotalValue;
                    setRawND39Input(numberToRawDigits(newND39Value)); 
                    toast.warning("O valor da ND 39 foi limitado ao Valor Total Solicitado.");
                }
                
                newND30Value = calculateND30(newTotalValue, newND39Value);
                
            } else {
                return prev;
            }
            
            return { 
                ...newFormData, 
                valor_total_solicitado: newTotalValue,
                valor_nd_30: newND30Value,
                valor_nd_39: newND39Value, 
            };
        });
    };
    
    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedSuprimentoFundos[]) => {
            if (recordsToSave.length === 0) return;
            
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                
                const dbRecord: TablesInsert<'verba_operacional_registros'> = {
                    ...rest,
                    organizacao: om_favorecida, 
                    ug: ug_favorecida, 
                    detalhamento: "Suprimento de Fundos", 
                    detalhamento_customizado: rest.detalhamento_customizado, 
                } as TablesInsert<'verba_operacional_registros'>;
                
                return dbRecord;
            });
            
            const { data, error } = await supabase
                .from("verba_operacional_registros")
                .insert(dbRecords)
                .select('*')
                .order('created_at', { ascending: false }); 
            
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suprimentoFundosRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingSuprimentos.length} registro(s) de Suprimento de Fundos adicionado(s).`);
            setPendingSuprimentos([]); 
            setLastStagedFormData(null); 
            resetForm();
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedSuprimentoFundos) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            
            const dbUpdateData: TablesUpdate<'verba_operacional_registros'> = {
                ...rest,
                organizacao: om_favorecida, 
                ug: ug_favorecida, 
                detalhamento: "Suprimento de Fundos", 
                detalhamento_customizado: rest.detalhamento_customizado, 
            } as TablesUpdate<'verba_operacional_registros'>;
            
            const { error } = await supabase
                .from("verba_operacional_registros")
                .update(dbUpdateData)
                .eq("id", editingId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suprimentoFundosRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Registro de Suprimento de Fundos atualizado com sucesso!`);
            setStagedUpdate(null); 
            resetForm();
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });

    const handleDeleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("verba_operacional_registros")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suprimentoFundosRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registro de Suprimento de Fundos excluído com sucesso!");
            setRegistroToDelete(null);
            setShowDeleteDialog(false);
            resetForm(); 
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });

    // =================================================================
    // HANDLERS DE AÇÃO
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setFormData(prev => ({
            ...initialFormState,
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_detentora: DEFAULT_OM_DETENTORA,
            ug_detentora: DEFAULT_UG_DETENTORA,
            dias_operacao: 0,
            quantidade_equipes: 0,
            valor_total_solicitado: 0,
            valor_nd_30: 0,
            valor_nd_39: 0,
            objeto_aquisicao: "",
            objeto_contratacao: "",
            proposito: "",
            finalidade: "",
            local: "",
            tarefa: "",
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDetentoraId(undefined); 
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
        
        setRawTotalInput(numberToRawDigits(0));
        setRawND39Input(numberToRawDigits(0));
    };
    
    const handleClearPending = () => {
        setPendingSuprimentos([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        resetForm();
    };

    const handleEdit = (registro: SuprimentoFundosRegistroDB) => {
        if (pendingSuprimentos.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDetentoraToEdit = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omDetentoraToEdit?.id);

        const newFormData = {
            om_favorecida: registro.organizacao, 
            ug_favorecida: registro.ug, 
            dias_operacao: registro.dias_operacao,
            quantidade_equipes: registro.quantidade_equipes, 
            valor_total_solicitado: Number(registro.valor_total_solicitado || 0),
            fase_atividade: registro.fase_atividade || "",
            om_detentora: registro.om_detentora || DEFAULT_OM_DETENTORA,
            ug_detentora: registro.ug_detentora || DEFAULT_UG_DETENTORA,
            valor_nd_30: Number(registro.valor_nd_30 || 0),
            valor_nd_39: Number(registro.valor_nd_39 || 0),
            objeto_aquisicao: registro.objeto_aquisicao || "",
            objeto_contratacao: registro.objeto_contratacao || "",
            proposito: registro.proposito || "",
            finalidade: registro.finalidade || "",
            local: registro.local || "",
            tarefa: registro.tarefa || "",
        };
        setFormData(newFormData);
        
        setRawTotalInput(numberToRawDigits(newFormData.valor_total_solicitado));
        setRawND39Input(numberToRawDigits(newFormData.valor_nd_39)); 

        const totals = calculateSuprimentoFundosTotals({
            ...newFormData,
            organizacao: newFormData.om_favorecida,
            ug: newFormData.ug_favorecida,
        } as any);
        const memoria = generateSuprimentoFundosMemoriaCalculo({
            ...newFormData,
            organizacao: newFormData.om_favorecida,
            ug: newFormData.ug_favorecida,
        } as any);
        
        const stagedData: CalculatedSuprimentoFundos = {
            tempId: registro.id,
            p_trab_id: ptrabId!,
            organizacao: newFormData.om_favorecida, 
            ug: newFormData.ug_favorecida, 
            om_detentora: newFormData.om_detentora,
            ug_detentora: newFormData.ug_detentora,
            dias_operacao: newFormData.dias_operacao,
            fase_atividade: newFormData.fase_atividade,
            quantidade_equipes: newFormData.quantidade_equipes, 
            valor_total_solicitado: newFormData.valor_total_solicitado,
            
            valor_nd_30: totals.totalND30,
            valor_nd_39: totals.totalND39,
            
            detalhamento: "Suprimento de Fundos",
            detalhamento_customizado: registro.detalhamento_customizado, 
            
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
            
            objeto_aquisicao: newFormData.objeto_aquisicao,
            objeto_contratacao: newFormData.objeto_contratacao,
            proposito: newFormData.proposito,
            finalidade: newFormData.finalidade,
            local: newFormData.local,
            tarefa: newFormData.tarefa,
        } as CalculatedSuprimentoFundos;
        
        setStagedUpdate(stagedData); 

        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: SuprimentoFundosRegistroDB) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const totalSolicitado = formData.valor_total_solicitado;
            const nd39Value = formData.valor_nd_39;
            const nd30Value = calculateND30(totalSolicitado, nd39Value);
            
            const dataToValidate = {
                ...formData,
                valor_nd_30: nd30Value, 
            };
            
            suprimentoFundosSchema.parse(dataToValidate);
            
            const calculatedDataForUtils: SuprimentoFundosRegistro = {
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            };

            const totals = calculateSuprimentoFundosTotals(calculatedDataForUtils as any);
            const memoria = generateSuprimentoFundosMemoriaCalculo(calculatedDataForUtils as any);
            
            const calculatedData: CalculatedSuprimentoFundos = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                quantidade_equipes: formData.quantidade_equipes, 
                valor_total_solicitado: formData.valor_total_solicitado,
                
                valor_nd_30: totals.totalND30,
                valor_nd_39: totals.totalND39,
                
                detalhamento: "Suprimento de Fundos",
                detalhamento_customizado: null, 
                
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                
                objeto_aquisicao: formData.objeto_aquisicao,
                objeto_contratacao: formData.objeto_contratacao,
                proposito: formData.proposito,
                finalidade: formData.finalidade,
                local: formData.local,
                tarefa: formData.tarefa,
            } as CalculatedSuprimentoFundos;
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                
                let memoriaCustomizadaTexto: string | null = null;
                try {
                    JSON.parse(originalRecord?.detalhamento_customizado || "");
                } catch (e) {
                    memoriaCustomizadaTexto = originalRecord?.detalhamento_customizado || null;
                }
                
                calculatedData.detalhamento_customizado = memoriaCustomizadaTexto;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            const shouldStageNewItem = pendingSuprimentos.length === 0 || isSuprimentoDirty;

            if (shouldStageNewItem) {
                setPendingSuprimentos(prev => {
                    if (prev.length > 0) {
                        return [...prev.slice(0, -1), calculatedData];
                    }
                    return [...prev, calculatedData];
                });
                
                setLastStagedFormData(formData);
                
                toast.info("Item de Suprimento de Fundos adicionado à lista pendente.");
            } else {
                toast.info("Nenhuma alteração detectada no item pendente.");
            }
            
            setFormData(prev => ({
                ...prev,
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                om_detentora: prev.om_detentora,
                ug_detentora: prev.ug_detentora,
                dias_operacao: prev.dias_operacao,
                quantidade_equipes: prev.quantidade_equipes,
                fase_atividade: prev.fase_atividade,
                objeto_aquisicao: prev.objeto_aquisicao,
                objeto_contratacao: prev.objeto_contratacao,
                proposito: prev.proposito,
                finalidade: prev.finalidade,
                local: prev.local,
                tarefa: prev.tarefa,
                
                valor_total_solicitado: prev.valor_total_solicitado,
                valor_nd_30: prev.valor_nd_30,
                valor_nd_39: prev.valor_nd_39,
            }));
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    const handleSavePendingSuprimentos = () => {
        if (pendingSuprimentos.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        saveMutation.mutate(pendingSuprimentos);
    };
    
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        updateMutation.mutate(stagedUpdate);
    };
    
    const handleRemovePending = (tempId: string) => {
        setPendingSuprimentos(prev => {
            const newPending = prev.filter(p => p.tempId !== tempId);
            if (newPending.length === 0) {
                setLastStagedFormData(null);
            }
            return newPending;
        });
        toast.info("Item removido da lista pendente.");
    };
    
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmDetentoraId(omData.id); 
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_detentora: omData.nome_om, 
                ug_detentora: omData.codug_om, 
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDetentoraId(undefined); 
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_detentora: "", 
                ug_detentora: "", 
            }));
        }
    };
    
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
    
    const handleIniciarEdicaoMemoria = (registro: SuprimentoFundosRegistroDB) => {
        setEditingMemoriaId(registro.id);
        
        const calculatedData: SuprimentoFundosRegistro = {
            organizacao: registro.organizacao,
            ug: registro.ug,
            om_detentora: registro.om_detentora || "",
            ug_detentora: registro.ug_detentora || "",
            dias_operacao: registro.dias_operacao,
            quantidade_equipes: registro.quantidade_equipes,
            valor_total_solicitado: registro.valor_total_solicitado,
            fase_atividade: registro.fase_atividade || "",
            valor_nd_30: registro.valor_nd_30,
            valor_nd_39: registro.valor_nd_39,
            objeto_aquisicao: registro.objeto_aquisicao || "",
            objeto_contratacao: registro.objeto_contratacao || "",
            proposito: registro.proposito || "",
            finalidade: registro.finalidade || "",
            local: registro.local || "",
            tarefa: registro.tarefa || "",
        };
        
        const memoriaAutomatica = generateSuprimentoFundosMemoriaCalculo(calculatedData as any);
        setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            const { error } = await supabase
                .from("verba_operacional_registros")
                .update({
                    detalhamento: "Suprimento de Fundos", 
                    detalhamento_customizado: memoriaEdit.trim() || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["suprimentoFundosRegistros", ptrabId] });
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
                .from("verba_operacional_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["suprimentoFundosRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms;

    if (isGlobalLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
            </div>
        );
    }

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isSaving = saveMutation.isPending || updateMutation.isPending;
    
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.om_detentora.length > 0 &&
                            formData.ug_detentora.length > 0 &&
                            formData.fase_atividade.length > 0;

    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.quantidade_equipes > 0 && 
                                    formData.valor_total_solicitado > 0;

    const isAllocationCorrect = areNumbersEqual(formData.valor_total_solicitado, calculos.totalGeral);

    const isCalculationReady = isBaseFormReady &&
                              isSolicitationDataReady &&
                              isAllocationCorrect &&
                              formData.objeto_aquisicao.length > 0 &&
                              formData.objeto_contratacao.length > 0 &&
                              formData.proposito.length > 0 &&
                              formData.finalidade.length > 0 &&
                              formData.local.length > 0 &&
                              formData.tarefa.length > 0;
    
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingSuprimentos;
    const isStagingUpdate = !!stagedUpdate;

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
                            Suprimento de Fundos
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para Suprimento de Fundos (ND 30/39).
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
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="om_favorecida">OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={handleOmFavorecidaChange}
                                            placeholder="Selecione a OM Favorecida"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingSuprimentos.length > 0}
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
                                            disabled={!isPTrabEditable || isSaving || pendingSuprimentos.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (DETALHAMENTO E ALOCAÇÃO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Suprimento de Fundos
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período e Valor</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="quantidade_equipes">Efetivo *</Label>
                                                            <Input
                                                                id="quantidade_equipes"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 10"
                                                                value={formData.quantidade_equipes === 0 ? "" : formData.quantidade_equipes}
                                                                onChange={(e) => setFormData({ ...formData, quantidade_equipes: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="valor_total_solicitado">Valor Total Solicitado (R$) *</Label>
                                                            <CurrencyInput
                                                                id="valor_total_solicitado"
                                                                rawDigits={rawTotalInput}
                                                                onChange={(_, digits) => handleCurrencyChange('valor_total_solicitado', digits)}
                                                                placeholder="Ex: 1.500,00"
                                                                disabled={!isPTrabEditable || isSaving}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        <Card className="mt-4 rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Detalhes da Aplicação</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="objeto_aquisicao">Objeto de Aquisição (Material) *</Label>
                                                            <Input
                                                                id="objeto_aquisicao"
                                                                value={formData.objeto_aquisicao}
                                                                onChange={(e) => setFormData({ ...formData, objeto_aquisicao: e.target.value })}
                                                                placeholder="Ex: Materiais , alimentação de pessoal"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="objeto_contratacao">Objeto de Contratação (Serviço) *</Label>
                                                            <Input
                                                                id="objeto_contratacao"
                                                                value={formData.objeto_contratacao}
                                                                onChange={(e) => setFormData({ ...formData, objeto_contratacao: e.target.value })}
                                                                placeholder="Ex: Serviços para atender eventuais imprevistos (Pequenos reparos e manutenção)"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="proposito">Propósito *</Label>
                                                            <Input
                                                                id="proposito"
                                                                value={formData.proposito}
                                                                onChange={(e) => setFormData({ ...formData, proposito: e.target.value })}
                                                                placeholder="Ex: Garantir a continuidade das atividades"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="finalidade">Finalidade *</Label>
                                                            <Input
                                                                id="finalidade"
                                                                value={formData.finalidade}
                                                                onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                                                                placeholder="Ex: ao manter o fornecimento de suprimentos"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="local">Local *</Label>
                                                            <Input
                                                                id="local"
                                                                value={formData.local}
                                                                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                                                                placeholder="Ex: Base Operacional"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="tarefa">Tarefa *</Label>
                                                            <Input
                                                                id="tarefa"
                                                                value={formData.tarefa}
                                                                onChange={(e) => setFormData({ ...formData, tarefa: e.target.value })}
                                                                placeholder="Ex: Montagem das Estruturas Logísticas"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {isSolicitationDataReady && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4">
                                                    Alocação de Recursos (Valor Total: {formatCurrency(formData.valor_total_solicitado)})
                                                </h4>
                                                
                                                <div className="space-y-2 mb-4">
                                                    <Label htmlFor="om_detentora">OM de Destino do Recurso *</Label>
                                                    <OmSelector
                                                        selectedOmId={selectedOmDetentoraId}
                                                        onChange={handleOmDetentoraChange}
                                                        placeholder="Selecione a OM Detentora"
                                                        disabled={!isPTrabEditable || isSaving}
                                                        initialOmName={editingId ? formData.om_detentora : undefined}
                                                        initialOmUg={editingId ? formData.ug_detentora : undefined}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        UG de Destino: {formatCodug(formData.ug_detentora)}
                                                    </p>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_30">ND 33.90.30 (Material)</Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="valor_nd_30"
                                                                value={formatCurrency(calculos.totalND30)}
                                                                readOnly
                                                                disabled
                                                                className="pl-12 text-lg font-bold bg-green-500/10 text-green-600 disabled:opacity-100 h-12"
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Calculado por diferença (Total Solicitado - ND 39).
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_39">ND 33.90.39 (Serviço) *</Label>
                                                        <CurrencyInput
                                                            id="valor_nd_39"
                                                            rawDigits={rawND39Input}
                                                            onChange={(_, digits) => handleCurrencyChange('valor_nd_39', digits)}
                                                            placeholder="0,00"
                                                            disabled={!isPTrabEditable || isSaving}
                                                            className="text-lg h-12" 
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            Valor alocado para contratação de serviço.
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                    <span className="font-bold text-sm">TOTAL ALOCADO:</span>
                                                    <span className={cn("font-extrabold text-lg", isAllocationCorrect ? "text-primary" : "text-destructive")}>
                                                        {formatCurrency(calculos.totalGeral)}
                                                    </span>
                                                </div>
                                                
                                                {!isAllocationCorrect && (
                                                    <p className="text-xs text-destructive mt-2 text-center">
                                                        A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.
                                                    </p>
                                                )}
                                            </Card>
                                        )}
                                        
                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button 
                                                type="submit" 
                                                disabled={!isPTrabEditable || isSaving || !isCalculationReady}
                                                className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                            >
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Salvar Item na Lista
                                            </Button>
                                        </div>
                                        
                                    </Card> 
                                    
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
                                    {!editingId && isSuprimentoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {editingId && isSuprimentoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const efetivoText = item.quantidade_equipes === 1 ? 'militar' : 'militares'; 

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
                                                                Suprimento de Fundos ({formatCurrency(item.valor_total_solicitado)})
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-foreground text-right">
                                                                    {formatCurrency(item.totalGeral)}
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
                                                        
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Favorecida:</p>
                                                                <p className="font-medium">OM Destino Recurso:</p>
                                                                <p className="font-medium">Período / Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isDifferentOmInView && "text-red-600")}>{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.quantidade_equipes} {efetivoText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">ND 33.90.30:</p>
                                                                <p className="font-medium">ND 33.90.39:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium text-green-600">{formatCurrency(totalND30)}</p>
                                                                <p className="font-medium text-blue-600">{formatCurrency(totalND39)}</p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">
                                                VALOR TOTAL DA OM
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(isStagingUpdate ? stagedUpdate!.totalGeral : totalPendingSuprimentos)}
                                            </span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        {isStagingUpdate ? (
                                            <>
                                                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Limpar Formulário
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleCommitStagedUpdate}
                                                    disabled={isSaving || isSuprimentoDirty} 
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    Atualizar Registro
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
                                                    onClick={handleSavePendingSuprimentos}
                                                    disabled={isSaving || pendingSuprimentos.length === 0 || isSuprimentoDirty}
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
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({registros.length})
                                    </h3>
                                    
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                                        const totalOM = omRegistros.reduce((sum, r) => Number(r.valor_total_solicitado) + sum, 0);
                                        const omName = omKey.split(' (')[0];
                                        const ug = omKey.split(' (')[1].replace(')', '');
                                        
                                        return (
                                            <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {omName} (UG: {formatCodug(ug)})
                                                        <Badge variant="outline" className="text-xs">
                                                            {omRegistros[0].fase_atividade}
                                                        </Badge>
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {omRegistros.map((registro) => {
                                                        const totalSolicitado = Number(registro.valor_total_solicitado || 0);
                                                        const totalND30 = Number(registro.valor_nd_30 || 0);
                                                        const totalND39 = Number(registro.valor_nd_39 || 0);
                                                        const isDifferentOm = registro.om_detentora !== registro.organizacao;
                                                        const diasText = registro.dias_operacao === 1 ? 'dia' : 'dias';
                                                        const efetivoText = registro.quantidade_equipes === 1 ? 'militar' : 'militares';
                                                        
                                                        return (
                                                            <Card 
                                                                key={registro.id} 
                                                                className={cn(
                                                                    "p-3 bg-background border"
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-semibold text-base text-foreground">
                                                                                Suprimento de Fundos
                                                                            </h4>
                                                                            {registro.fase_atividade !== omRegistros[0].fase_atividade && (
                                                                                <Badge variant="outline" className="text-xs">
                                                                                    {registro.fase_atividade}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Período: {registro.dias_operacao} {diasText} | Efetivo: {registro.quantidade_equipes} {efetivoText}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-lg text-primary/80">
                                                                            {formatCurrency(totalSolicitado)}
                                                                        </span>
                                                                        <div className="flex gap-1">
                                                                            <Button
                                                                                type="button" 
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8"
                                                                                onClick={() => handleEdit(registro)}
                                                                                disabled={!isPTrabEditable || isSaving || pendingSuprimentos.length > 0}
                                                                            >
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button" 
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => handleConfirmDelete(registro)}
                                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                                disabled={!isPTrabEditable || isSaving}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="pt-2 border-t mt-2">
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                        <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                            {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                                                        <span className="font-medium text-green-600">{formatCurrency(totalND30)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                                                        <span className="font-medium text-blue-600">{formatCurrency(totalND39)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs font-bold pt-1">
                                                                        <span className="text-muted-foreground">Total Solicitado:</span>
                                                                        <span className="text-foreground">{formatCurrency(totalSolicitado)}</span>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS */}
                            {registros && registros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {registros.map(registro => {
                                        const isEditing = editingMemoriaId === registro.id;
                                        
                                        let hasCustomMemoria = false;
                                        try {
                                            JSON.parse(registro.detalhamento_customizado || "");
                                        } catch (e) {
                                            hasCustomMemoria = !!registro.detalhamento_customizado;
                                        }
                                        
                                        const calculatedDataForMemoria: SuprimentoFundosRegistro = {
                                            organizacao: registro.organizacao,
                                            ug: registro.ug,
                                            om_detentora: registro.om_detentora || "",
                                            ug_detentora: registro.ug_detentora || "",
                                            dias_operacao: registro.dias_operacao,
                                            quantidade_equipes: registro.quantidade_equipes,
                                            valor_total_solicitado: registro.valor_total_solicitado,
                                            fase_atividade: registro.fase_atividade || "",
                                            valor_nd_30: registro.valor_nd_30,
                                            valor_nd_39: registro.valor_nd_39,
                                            objeto_aquisicao: registro.objeto_aquisicao || "",
                                            objeto_contratacao: registro.objeto_contratacao || "",
                                            proposito: registro.proposito || "",
                                            finalidade: registro.finalidade || "",
                                            local: registro.local || "",
                                            tarefa: registro.tarefa || "",
                                        };
                                        
                                        const memoriaAutomatica = generateSuprimentoFundosMemoriaCalculo(calculatedDataForMemoria as any);
                                        
                                        let memoriaExibida = memoriaAutomatica;
                                        if (isEditing) {
                                            memoriaExibida = memoriaEdit;
                                        } else if (hasCustomMemoria) {
                                            memoriaExibida = registro.detalhamento_customizado!;
                                        }
                                        
                                        const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao;

                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-semibold text-foreground">
                                                                {registro.organizacao} (UG: {formatCodug(registro.ug)})
                                                            </h4>
                                                            {hasCustomMemoria && !isEditing && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Editada manualmente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {isDifferentOmInMemoria && (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                                <span className="text-sm font-medium text-red-600">
                                                                    Destino Recurso: {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-end gap-2 shrink-0">
                                                        {!isEditing ? (
                                                            <>
                                                                <Button
                                                                    type="button" 
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleIniciarEdicaoMemoria(registro)}
                                                                    disabled={isSaving || !isPTrabEditable}
                                                                    className="gap-2"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    Editar Memória
                                                                </Button>
                                                                
                                                                {hasCustomMemoria && (
                                                                    <Button
                                                                        type="button" 
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                                                        disabled={isSaving || !isPTrabEditable}
                                                                        className="gap-2 text-muted-foreground"
                                                                    >
                                                                        <RefreshCw className="h-4 w-4" />
                                                                        Restaurar Automática
                                                                    </Button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    type="button" 
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                                                    disabled={isSaving}
                                                                    className="gap-2"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                    Salvar
                                                                </Button>
                                                                <Button
                                                                    type="button" 
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={handleCancelarEdicaoMemoria}
                                                                    disabled={isSaving}
                                                                    className="gap-2"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                    Cancelar
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <Card className="p-4 bg-background rounded-lg border">
                                                    {isEditing ? (
                                                        <Textarea
                                                            value={memoriaExibida}
                                                            onChange={(e) => setMemoriaEdit(e.target.value)}
                                                            className="min-h-[300px] font-mono text-sm"
                                                            placeholder="Digite a memória de cálculo..."
                                                        />
                                                    ) : (
                                                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                                                            {memoriaExibida}
                                                        </pre>
                                                    )}
                                                </Card>
                                            </div>
                                        );
                                    })}
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
                                Confirmar Exclusão
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o registro de Suprimento de Fundos para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>? Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction 
                                onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}
                                disabled={handleDeleteMutation.isPending}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir
                            </AlertDialogAction>
                            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default SuprimentoFundosForm;