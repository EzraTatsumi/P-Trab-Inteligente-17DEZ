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
    calculateVerbaOperacionalTotals, 
    generateVerbaOperacionalMemoriaCalculo 
} from "@/lib/verbaOperacionalUtils";
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
import CurrencyInput from "@/components/CurrencyInput"; // Componente para input monetário

// Tipos de dados
type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;

// Tipo de dados para OmSelector
interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
}

// Tipo para o registro calculado antes de salvar (inclui campos de display)
interface CalculatedVerbaOperacional extends TablesInsert<'verba_operacional_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
}

// Função para calcular ND 30 com base no Total Solicitado e ND 39
const calculateND30 = (totalSolicitado: number, nd39Value: number): number => {
    const nd30 = totalSolicitado - nd39Value;
    return Math.max(0, nd30); // ND 30 não pode ser negativo
};

// Schema de validação para o formulário de Verba Operacional
const verbaOperacionalSchema = z.object({
    organizacao: z.string().min(1, "A OM de destino é obrigatória."),
    ug: z.string().min(1, "A UG de destino é obrigatória."),
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    quantidade_equipes: z.number().int().min(1, "A quantidade de equipes deve ser maior que zero."),
    valor_total_solicitado: z.number().min(0.01, "O valor total solicitado deve ser maior que zero."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    
    // Alocação de NDs
    valor_nd_30: z.number().min(0, "ND 30 não pode ser negativa."),
    valor_nd_39: z.number().min(0, "ND 39 não pode ser negativa."),
    
    om_detentora: z.string().optional().nullable(),
    ug_detentora: z.string().optional().nullable(),
}).refine(data => {
    // A soma das NDs deve ser igual ao valor total solicitado (com pequena tolerância)
    const totalAlocado = data.valor_nd_30 + data.valor_nd_39;
    return Math.abs(totalAlocado - data.valor_total_solicitado) < 0.01;
}, {
    message: "A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.",
    path: ["valor_nd_30"], // Aponta para o primeiro campo de ND para exibir o erro
});

// Estado inicial para o formulário
const initialFormState = {
    organizacao: "",
    ug: "",
    dias_operacao: 1,
    quantidade_equipes: 1,
    valor_total_solicitado: 0,
    fase_atividade: "",
    om_detentora: null,
    ug_detentora: null,
    valor_nd_30: 0,
    valor_nd_39: 0,
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

const VerbaOperacionalForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<VerbaOperacionalRegistro | null>(null);
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingVerbas, setPendingVerbas] = useState<CalculatedVerbaOperacional[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedVerbaOperacional | null>(null);
    
    // Estado para rastrear o ID da OM selecionada no OmSelector
    const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
    
    // Estado para inputs monetários
    const [rawTotalInput, setRawTotalInput] = useState<string>(numberToRawDigits(initialFormState.valor_total_solicitado));
    const [rawND30Input, setRawND30Input] = useState<string>(numberToRawDigits(initialFormState.valor_nd_30));
    const [rawND39Input, setRawND39Input] = useState<string>(numberToRawDigits(initialFormState.valor_nd_39));

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<VerbaOperacionalRegistro[]>({
        queryKey: ['verbaOperacionalRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Efeito para definir o valor padrão (CIE) se não houver OM selecionada
    useEffect(() => {
        if (oms && !selectedOmId && formData.organizacao === "" && formData.ug === "") {
            const cieOm = oms.find(om => om.nome_om === "CIE" && om.codug_om === "160.062");
            if (cieOm) {
                setSelectedOmId(cieOm.id);
                setFormData(prev => ({
                    ...prev,
                    organizacao: cieOm.nome_om,
                    ug: cieOm.codug_om,
                }));
            }
        }
    }, [oms, selectedOmId, formData.organizacao, formData.ug]);


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
            // Validação rápida dos campos essenciais antes de calcular
            if (formData.dias_operacao <= 0 || formData.quantidade_equipes <= 0 || formData.valor_total_solicitado <= 0 || formData.organizacao.length === 0) {
                return {
                    totalGeral: 0, totalND30: 0, totalND39: 0,
                    memoria: "Preencha todos os campos obrigatórios para calcular.",
                };
            }
            
            // Recalcular ND 30/39 para garantir que o cálculo reflita o estado atual
            const totalSolicitado = formData.valor_total_solicitado;
            const nd39Value = formData.valor_nd_39;
            const nd30Value = calculateND30(totalSolicitado, nd39Value);
            
            const calculatedFormData = {
                ...formData,
                valor_nd_30: nd30Value,
                valor_nd_39: nd39Value,
            };

            const totals = calculateVerbaOperacionalTotals(calculatedFormData as any);
            const memoria = generateVerbaOperacionalMemoriaCalculo(calculatedFormData as any);
            
            return {
                ...totals,
                memoria,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0, totalND30: 0, totalND39: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, ptrabData]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate)
    const isVerbaDirty = useMemo(() => {
        if (!editingId || !stagedUpdate) return false;

        // 1. Comparar campos principais
        if (
            formData.dias_operacao !== stagedUpdate.dias_operacao ||
            formData.quantidade_equipes !== stagedUpdate.quantidade_equipes ||
            !areNumbersEqual(formData.valor_total_solicitado, stagedUpdate.valor_total_solicitado) ||
            // ND 30 is calculated, we only need to check ND 39 input
            !areNumbersEqual(formData.valor_nd_39, stagedUpdate.valor_nd_39)
        ) {
            return true;
        }

        // 2. Comparar fase de atividade (se for diferente, precisa re-estagiar para atualizar a memória)
        if (formData.fase_atividade !== stagedUpdate.fase_atividade) {
            return true;
        }

        return false;
    }, [editingId, stagedUpdate, formData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingVerbas = useMemo(() => {
        return pendingVerbas.reduce((sum, item) => sum + item.valor_total_solicitado, 0);
    }, [pendingVerbas]);
    
    // NOVO MEMO: Agrupa os registros por OM de Destino (organizacao/ug)
    const registrosAgrupadosPorOM = useMemo(() => {
        return registros?.reduce((acc, registro) => {
            const omDestino = registro.organizacao;
            const ugDestino = registro.ug;
            const key = `${omDestino} (${ugDestino})`;
            
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(registro);
            return acc;
        }, {} as Record<string, VerbaOperacionalRegistro[]>) || {};
    }, [registros]);

    // =================================================================
    // HANDLERS DE INPUT
    // =================================================================
    
    const handleCurrencyChange = (field: keyof typeof initialFormState, rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        
        setFormData(prev => {
            let newFormData = { ...prev };
            let newND30Value = prev.valor_nd_30;
            let newND39Value = prev.valor_nd_39;
            let newTotalValue = prev.valor_total_solicitado;

            if (field === 'valor_total_solicitado') {
                setRawTotalInput(digits);
                newTotalValue = numericValue;
                // When total changes, recalculate ND 30 based on existing ND 39
                newND30Value = calculateND30(newTotalValue, newND39Value);
                setRawND30Input(numberToRawDigits(newND30Value));
                
            } else if (field === 'valor_nd_39') {
                setRawND39Input(digits);
                newND39Value = numericValue;
                
                // ND 39 cannot exceed Total Solicitado
                if (newTotalValue > 0 && newND39Value > newTotalValue) {
                    newND39Value = newTotalValue;
                    // Update raw input to reflect capped value
                    setRawND39Input(numberToRawDigits(newND39Value)); 
                    toast.warning("O valor da ND 39 foi limitado ao Valor Total Solicitado.");
                }
                
                // Calculate ND 30
                newND30Value = calculateND30(newTotalValue, newND39Value);
                setRawND30Input(numberToRawDigits(newND30Value));
                
            } else {
                // ND 30 is now read-only, so this branch should not be reached for ND 30 input.
                return prev;
            }
            
            return { 
                ...newFormData, 
                valor_total_solicitado: newTotalValue,
                valor_nd_39: newND39Value,
                valor_nd_30: newND30Value, 
            };
        });
    };
    
    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: TablesInsert<'verba_operacional_registros'>[]) => {
            if (recordsToSave.length === 0) return;
            
            const { data, error } = await supabase
                .from("verba_operacional_registros")
                .insert(recordsToSave)
                .select('*')
                .order('created_at', { ascending: false }); 
            
            if (error) throw error;
            return data;
        },
        onSuccess: (newRecords) => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingVerbas.length} registro(s) de Verba Operacional adicionado(s).`);
            setPendingVerbas([]); 
            
            resetForm();
            
            if (newRecords && newRecords.length > 0) {
                handleEdit(newRecords[0] as VerbaOperacionalRegistro);
            }
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: TablesUpdate<'verba_operacional_registros'>) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            const { error } = await supabase
                .from("verba_operacional_registros")
                .update(data)
                .eq("id", editingId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Registro de Verba Operacional atualizado com sucesso!`);
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
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registro de Verba Operacional excluído com sucesso!");
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
        setFormData(initialFormState);
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmId(undefined);
        setStagedUpdate(null); 
        
        // Resetar inputs brutos
        setRawTotalInput(numberToRawDigits(initialFormState.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(initialFormState.valor_nd_30));
        setRawND39Input(numberToRawDigits(initialFormState.valor_nd_39));
        
        // Tenta redefinir para o padrão CIE
        if (oms) {
            const cieOm = oms.find(om => om.nome_om === "CIE" && om.codug_om === "160.062");
            if (cieOm) {
                setSelectedOmId(cieOm.id);
                setFormData(prev => ({
                    ...prev,
                    organizacao: cieOm.nome_om,
                    ug: cieOm.codug_om,
                }));
            }
        }
    };
    
    const handleClearPending = () => {
        setPendingVerbas([]);
        setStagedUpdate(null);
        resetForm();
    };

    const handleEdit = (registro: VerbaOperacionalRegistro) => {
        if (pendingVerbas.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        const omToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmId(omToEdit?.id);

        // 1. Populate formData
        const newFormData = {
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.dias_operacao,
            quantidade_equipes: registro.quantidade_equipes,
            valor_total_solicitado: Number(registro.valor_total_solicitado || 0),
            fase_atividade: registro.fase_atividade || "",
            om_detentora: registro.om_detentora || null,
            ug_detentora: registro.ug_detentora || null,
            valor_nd_30: Number(registro.valor_nd_30 || 0),
            valor_nd_39: Number(registro.valor_nd_39 || 0),
        };
        setFormData(newFormData);
        
        // Atualizar inputs brutos
        setRawTotalInput(numberToRawDigits(newFormData.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(newFormData.valor_nd_30));
        setRawND39Input(numberToRawDigits(newFormData.valor_nd_39));

        // 2. Calculate totals based on the *saved* record data
        const totals = calculateVerbaOperacionalTotals(newFormData as any);
        const memoria = generateVerbaOperacionalMemoriaCalculo(newFormData as any);
        
        // 3. Stage the current record data immediately for display in Section 3
        const stagedData: CalculatedVerbaOperacional = {
            tempId: registro.id,
            p_trab_id: ptrabId!,
            organizacao: newFormData.organizacao,
            ug: newFormData.ug,
            om_detentora: newFormData.om_detentora,
            ug_detentora: newFormData.ug_detentora,
            dias_operacao: newFormData.dias_operacao,
            fase_atividade: newFormData.fase_atividade,
            quantidade_equipes: newFormData.quantidade_equipes,
            valor_total_solicitado: newFormData.valor_total_solicitado,
            
            // Campos calculados
            valor_nd_30: totals.totalND30,
            valor_nd_39: totals.totalND39,
            
            detalhamento: memoria,
            detalhamento_customizado: registro.detalhamento_customizado || null, 
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
        };
        
        setStagedUpdate(stagedData); 

        // Reset memory edit states
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: VerbaOperacionalRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação Zod
            // Antes de validar, garantimos que ND 30 está sincronizado
            const totalSolicitado = formData.valor_total_solicitado;
            const nd39Value = formData.valor_nd_39;
            const nd30Value = calculateND30(totalSolicitado, nd39Value);
            
            const dataToValidate = {
                ...formData,
                valor_nd_30: nd30Value,
            };
            
            verbaOperacionalSchema.parse(dataToValidate);
            
            // 2. Validação de OM/UG
            const omDestino = oms?.find(om => om.id === selectedOmId);
            if (!omDestino || omDestino.codug_om !== formData.ug || omDestino.nome_om !== formData.organizacao) {
                toast.error("OM de Destino inválida ou UG não corresponde.");
                return;
            }
            
            // 3. Preparar o objeto final (calculatedData)
            const totals = calculateVerbaOperacionalTotals(dataToValidate as any);
            const memoria = generateVerbaOperacionalMemoriaCalculo(dataToValidate as any);
            
            const calculatedData: CalculatedVerbaOperacional = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.organizacao,
                ug: formData.ug,
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                quantidade_equipes: formData.quantidade_equipes,
                valor_total_solicitado: formData.valor_total_solicitado,
                
                // Campos calculados (usando os valores sincronizados)
                valor_nd_30: totals.totalND30,
                valor_nd_39: totals.totalND39,
                
                detalhamento: memoria,
                detalhamento_customizado: null, 
                
                // Campos de display para a lista pendente
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
            };
            
            if (editingId) {
                // MODO EDIÇÃO: Estagia a atualização para revisão
                const originalRecord = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            setPendingVerbas(prev => [...prev, calculatedData]);
            
            // 5. Resetar o formulário para o próximo item (mantendo OM e Fase)
            setFormData(prev => ({
                ...initialFormState,
                organizacao: prev.organizacao,
                ug: prev.ug,
                fase_atividade: prev.fase_atividade,
                // Resetar apenas os campos de cálculo
                dias_operacao: 1,
                quantidade_equipes: 1,
                valor_total_solicitado: 0,
                valor_nd_30: 0,
                valor_nd_39: 0,
            }));
            
            // Resetar inputs brutos
            setRawTotalInput(numberToRawDigits(0));
            setRawND30Input(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
            
            toast.info("Item de Verba Operacional adicionado à lista pendente.");
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingVerbas = () => {
        if (pendingVerbas.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        const recordsToSave: TablesInsert<'verba_operacional_registros'>[] = pendingVerbas.map(p => {
            const { tempId, memoria_calculo_display, totalGeral, ...dbRecord } = p as any;
            return dbRecord as TablesInsert<'verba_operacional_registros'>;
        });
        
        saveMutation.mutate(recordsToSave);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        const { tempId, memoria_calculo_display, totalGeral, ...dbRecord } = stagedUpdate as any;
        
        updateMutation.mutate(dbRecord as TablesUpdate<'verba_operacional_registros'>);
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingVerbas(prev => prev.filter(p => p.tempId !== tempId));
        toast.info("Item removido da lista pendente.");
    };
    
    const handleOmChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmId(omData.id);
            setFormData(prev => ({
                ...prev,
                organizacao: omData.nome_om,
                ug: omData.codug_om,
            }));
        } else {
            setSelectedOmId(undefined);
            setFormData(prev => ({
                ...prev,
                organizacao: "",
                ug: "",
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
    
    const handleIniciarEdicaoMemoria = (registro: VerbaOperacionalRegistro) => {
        setEditingMemoriaId(registro.id);
        
        const totals = calculateVerbaOperacionalTotals(registro as any);
        const memoriaAutomatica = generateVerbaOperacionalMemoriaCalculo(registro as any);
        
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
                    detalhamento_customizado: memoriaEdit.trim() || null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
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
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

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
    
    const isBaseFormReady = formData.organizacao.length > 0 && 
                            formData.ug.length > 0 && 
                            formData.fase_atividade.length > 0;

    // Verifica se o total alocado (ND 30 + ND 39) é igual ao total solicitado
    const isAllocationCorrect = areNumbersEqual(formData.valor_total_solicitado, calculos.totalGeral);

    const isCalculationReady = isBaseFormReady &&
                              formData.dias_operacao > 0 &&
                              formData.quantidade_equipes > 0 &&
                              formData.valor_total_solicitado > 0 &&
                              isAllocationCorrect;
    
    // Lógica para a Seção 3
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingVerbas;
    const isStagingUpdate = !!stagedUpdate;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o P Trab
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Verba Operacional (ND 30/39)
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para despesas operacionais diversas (Verba Operacional).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO E FASE */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    1. Dados da Atividade
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="fase_atividade">Fase da Atividade *</Label>
                                        <FaseAtividadeSelect
                                            value={formData.fase_atividade}
                                            onChange={handleFaseAtividadeChange}
                                            disabled={!isPTrabEditable || isSaving || pendingVerbas.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (DIAS, EQUIPES, VALOR E ND) */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    2. Configurar Item de Verba Operacional
                                </h3>
                                
                                <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                    
                                    {/* Dados da Solicitação */}
                                    <Card className="rounded-lg">
                                        <CardHeader className="py-3">
                                            <CardTitle className="text-base font-semibold">Dados da Solicitação</CardTitle>
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
                                                        <Label htmlFor="quantidade_equipes">Quantidade de Equipes *</Label>
                                                        <Input
                                                            id="quantidade_equipes"
                                                            type="number"
                                                            min={1}
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
                                                            onChange={(digits) => handleCurrencyChange('valor_total_solicitado', digits)}
                                                            placeholder="Ex: 1.500,00"
                                                            disabled={!isPTrabEditable || isSaving}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    
                                    {/* Alocação de NDs (Card) - MODIFICADO PARA O ESTILO DA IMAGEM */}
                                    <Card className="mt-4 rounded-lg p-4 bg-background">
                                        <h4 className="font-semibold text-base mb-4">
                                            Alocação de Natureza de Despesa (ND) (Valor Total: {formatCurrency(formData.valor_total_solicitado)})
                                        </h4>
                                        
                                        {/* OM Destino (OmSelector) - AGORA EDITÁVEL */}
                                        <div className="space-y-2 mb-4">
                                            <Label htmlFor="organizacao">OM de Destino do Recurso *</Label>
                                            <OmSelector
                                                selectedOmId={selectedOmId}
                                                onChange={handleOmChange}
                                                placeholder="Selecione a OM de Destino"
                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingVerbas.length > 0}
                                                initialOmName={formData.organizacao}
                                                initialOmUg={formData.ug}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                UG de Destino: {formatCodug(formData.ug)}
                                            </p>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* ND 30 (Material/Serviço) - CALCULADO */}
                                            <div className="space-y-2">
                                                <Label htmlFor="valor_nd_30">ND 33.90.30 (Material/Serviço)</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="valor_nd_30"
                                                        value={formatCurrency(formData.valor_nd_30)}
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
                                            
                                            {/* ND 39 (Serviço) - EDITÁVEL */}
                                            <div className="space-y-2">
                                                <Label htmlFor="valor_nd_39">ND 33.90.39 (Serviço)</Label>
                                                <div className="relative">
                                                    <CurrencyInput
                                                        id="valor_nd_39"
                                                        rawDigits={rawND39Input}
                                                        onChange={(digits) => handleCurrencyChange('valor_nd_39', digits)}
                                                        placeholder="0,00"
                                                        disabled={!isPTrabEditable || isSaving}
                                                        className="pl-12 text-lg h-12"
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                                </div>
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
                                                A soma das NDs deve ser igual ao Valor Total Solicitado ({formatCurrency(formData.valor_total_solicitado)}).
                                            </p>
                                        )}
                                    </Card>
                                    
                                    {/* BOTÕES DE AÇÃO */}
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
                            
                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isVerbaDirty && (
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
                                                                Verba Operacional ({formatCurrency(item.valor_total_solicitado)})
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
                                                        
                                                        {/* Detalhes da Solicitação */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Destino Recurso:</p>
                                                                <p className="font-medium">Período / Equipes:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p>
                                                                <p className="font-medium">{item.dias_operacao} dias / {item.quantidade_equipes} equipes</p>
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
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">
                                                VALOR TOTAL DA OM
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(isStagingUpdate ? stagedUpdate!.totalGeral : totalPendingVerbas)}
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
                                                    disabled={isSaving || isVerbaDirty} 
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
                                                    onClick={handleSavePendingVerbas}
                                                    disabled={isSaving || pendingVerbas.length === 0}
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

                            {/* SEÇÃO 4: REGISTROS SALVOS (Agrupados por OM) */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        Registros Salvos ({registros.length})
                                    </h3>
                                    
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                                        const totalOM = omRegistros.reduce((sum, r) => (r.valor_nd_30 + r.valor_nd_39) + sum, 0);
                                        const omName = omKey.split(' (')[0];
                                        const ug = omKey.split(' (')[1].replace(')', '');
                                        
                                        return (
                                            <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        OM Destino: {omName} (UG: {formatCodug(ug)})
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {omRegistros.map((registro) => {
                                                        const totalGeral = registro.valor_nd_30 + registro.valor_nd_39;
                                                        
                                                        return (
                                                            <Card 
                                                                key={registro.id} 
                                                                className="p-3 bg-background border"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-semibold text-base text-foreground">
                                                                                Verba Operacional ({formatCurrency(registro.valor_total_solicitado)})
                                                                            </h4>
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {registro.fase_atividade}
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Período: {registro.dias_operacao} {registro.dias_operacao === 1 ? 'dia' : 'dias'} | Equipes: {registro.quantidade_equipes}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-lg text-primary/80">
                                                                            {formatCurrency(totalGeral)}
                                                                        </span>
                                                                        <div className="flex gap-1">
                                                                            <Button
                                                                                type="button" 
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8"
                                                                                onClick={() => handleEdit(registro)}
                                                                                disabled={!isPTrabEditable || isSaving || pendingVerbas.length > 0}
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
                                                                
                                                                {/* Detalhes da Alocação */}
                                                                <div className="pt-2 border-t mt-2">
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                        <span className="font-medium text-green-600">{formatCurrency(registro.valor_nd_30)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">ND 33.90.39:</span>
                                                                        <span className="font-medium text-blue-600">{formatCurrency(registro.valor_nd_39)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs font-bold pt-1">
                                                                        <span className="text-muted-foreground">Total Alocado:</span>
                                                                        <span className="text-foreground">{formatCurrency(totalGeral)}</span>
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
                                        const hasCustomMemoria = !!registro.detalhamento_customizado;
                                        
                                        const totals = calculateVerbaOperacionalTotals(registro as any);
                                        const memoriaAutomatica = generateVerbaOperacionalMemoriaCalculo(registro as any);
                                        
                                        const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                                        
                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-semibold text-foreground">
                                                                OM Destino: {registro.organizacao} (UG: {formatCodug(registro.ug)})
                                                            </h4>
                                                            {hasCustomMemoria && !isEditing && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Editada manualmente
                                                                </Badge>
                                                            )}
                                                        </div>
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
                                                            value={memoriaEdit}
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
                                Tem certeza que deseja excluir o registro de Verba Operacional para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}
                                disabled={handleDeleteMutation.isPending}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default VerbaOperacionalForm;