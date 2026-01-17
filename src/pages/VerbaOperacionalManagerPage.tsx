import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, XCircle, Pencil, Sparkles, AlertCircle, Check } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, numberToRawDigits } from "@/lib/formatUtils";
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
import CurrencyInput from "@/components/CurrencyInput";
import { useNDAllocation } from "@/hooks/useNDAllocation"; // NOVO HOOK
import { MemoriaCalculoEditor } from "@/components/MemoriaCalculoEditor"; // NOVO COMPONENTE

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
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
}

// Constantes para a OM Detentora padrão (CIE)
const DEFAULT_OM_DETENTORA = "CIE";
const DEFAULT_UG_DETENTORA = "160062";

// Schema de validação para o formulário de Verba Operacional
const verbaOperacionalSchema = z.object({
    om_favorecida: z.string().min(1, "A OM Favorecida (do PTrab) é obrigatória."),
    ug_favorecida: z.string().min(1, "A UG Favorecida (do PTrab) é obrigatória."),
    om_detentora: z.string().min(1, "A OM Destino do Recurso é obrigatória."),
    ug_detentora: z.string().min(1, "A UG Destino do Recurso é obrigatória."),
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    quantidade_equipes: z.number().int().min(1, "A quantidade de equipes deve ser maior que zero."),
    valor_total_solicitado: z.number().min(0.01, "O valor total solicitado deve ser maior que zero."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    valor_nd_30: z.number().min(0, "ND 30 não pode ser negativa."),
    valor_nd_39: z.number().min(0, "ND 39 não pode ser negativa."),
    
}).refine(data => {
    // A soma das NDs deve ser igual ao valor total solicitado (com pequena tolerância)
    const totalAlocado = data.valor_nd_30 + data.valor_nd_39;
    return Math.abs(totalAlocado - data.valor_total_solicitado) < 0.01;
}, {
    message: "A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.",
    path: ["valor_nd_30"],
});

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
    valor_nd_30: 0,
    valor_nd_39: 0,
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

const VerbaOperacionalManagerPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<VerbaOperacionalRegistro | null>(null);
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA (REMOVIDOS, USAR MemoriaCalculoEditor)
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingVerbas, setPendingVerbas] = useState<CalculatedVerbaOperacional[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedVerbaOperacional | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida (OM do PTrab)
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    
    // Estado para rastrear o ID da OM Detentora (OM Destino do Recurso)
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    // NOVO HOOK: Gerenciamento de NDs (ND 30 manual, ND 39 calculada)
    const {
        totalSolicitado, valorND30, valorND39, totalAlocado, isAllocationCorrect,
        rawTotalInput, rawND30Input, rawND39Input,
        handleTotalChange, handleND30Change, handleND39Change, resetAllocation
    } = useNDAllocation(formData.valor_total_solicitado, formData.valor_nd_30, formData.valor_nd_39);

    // Efeito para sincronizar o hook com o formData
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            valor_total_solicitado: totalSolicitado,
            valor_nd_30: valorND30,
            valor_nd_39: valorND39,
        }));
    }, [totalSolicitado, valorND30, valorND39]);


    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<VerbaOperacionalRegistro[]>({
        queryKey: ['verbaOperacionalRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!, { detalhamento: 'Verba Operacional' }),
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.detalhamento !== 'Suprimento de Fundos').sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Efeito para preencher a OM Favorecida (OM do PTrab) e a OM Detentora (CIE) ao carregar
    useEffect(() => {
        if (ptrabData && !editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === ptrabData.nome_om && om.codug_om === ptrabData.codug_om);
            
            setFormData(prev => ({
                ...prev,
                om_favorecida: ptrabData.nome_om,
                ug_favorecida: ptrabData.codug_om,
            }));
            setSelectedOmFavorecidaId(omFavorecida?.id);
            
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
            if (formData.dias_operacao <= 0 || formData.quantidade_equipes <= 0 || formData.valor_total_solicitado <= 0 || formData.om_detentora.length === 0) {
                return {
                    totalGeral: 0, totalND30: 0, totalND39: 0,
                    memoria: "Preencha todos os campos obrigatórios para calcular.",
                };
            }
            
            const calculatedFormData = {
                ...formData,
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                valor_nd_30: valorND30, // Usar valor do hook
                valor_nd_39: valorND39, // Usar valor do hook
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
    }, [formData, ptrabData, valorND30, valorND39]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate)
    const isVerbaDirty = useMemo(() => {
        if (!editingId || !stagedUpdate) return false;

        // 1. Comparar campos principais
        if (
            formData.dias_operacao !== stagedUpdate.dias_operacao ||
            formData.quantidade_equipes !== stagedUpdate.quantidade_equipes ||
            !areNumbersEqual(formData.valor_total_solicitado, stagedUpdate.valor_total_solicitado) ||
            !areNumbersEqual(formData.valor_nd_30, stagedUpdate.valor_nd_30) || // ND 30 é o input manual
            formData.om_detentora !== stagedUpdate.om_detentora ||
            formData.ug_detentora !== stagedUpdate.ug_detentora ||
            formData.om_favorecida !== stagedUpdate.om_favorecida ||
            formData.ug_favorecida !== stagedUpdate.ug_favorecida
        ) {
            return true;
        }

        // 2. Comparar fase de atividade
        if (formData.fase_atividade !== stagedUpdate.fase_atividade) {
            return true;
        }

        return false;
    }, [editingId, stagedUpdate, formData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingVerbas = useMemo(() => {
        return pendingVerbas.reduce((sum, item) => sum + item.valor_total_solicitado, 0);
    }, [pendingVerbas]);
    
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
        }, {} as Record<string, VerbaOperacionalRegistro[]>) || {};
    }, [registros]);

    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedVerbaOperacional[]) => {
            if (recordsToSave.length === 0) return;
            
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                return {
                    ...rest,
                    organizacao: om_favorecida,
                    ug: ug_favorecida,
                    detalhamento: "Verba Operacional",
                } as TablesInsert<'verba_operacional_registros'>;
            });
            
            const { data, error } = await supabase
                .from("verba_operacional_registros")
                .insert(dbRecords)
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
            
            if (newRecords && newRecords.length > 0) {
                handleEdit(newRecords[0] as VerbaOperacionalRegistro);
            }
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedVerbaOperacional) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            
            const dbUpdateData: TablesUpdate<'verba_operacional_registros'> = {
                ...rest,
                organizacao: om_favorecida,
                ug: ug_favorecida,
                detalhamento: "Verba Operacional",
            } as TablesUpdate<'verba_operacional_registros'>;
            
            const { error } = await supabase
                .from("verba_operacional_registros")
                .update(dbUpdateData)
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
        
        // Resetar campos de cálculo e NDs
        resetAllocation();
        
        setFormData(prev => ({
            ...prev,
            dias_operacao: 0,
            quantidade_equipes: 0,
            valor_total_solicitado: 0,
            valor_nd_30: 0,
            valor_nd_39: 0,
        }));
        
        setStagedUpdate(null);
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
        };
        setFormData(newFormData);
        
        // Sincronizar o hook de ND com os valores do registro
        handleTotalChange(newFormData.valor_total_solicitado, numberToRawDigits(newFormData.valor_total_solicitado));
        // Como ND 30 é o campo manual para VO, sincronizamos ele por último para forçar o cálculo de ND 39
        handleND30Change(newFormData.valor_nd_30, numberToRawDigits(newFormData.valor_nd_30));

        // 4. Calculate totals based on the *saved* record data
        const totals = calculateVerbaOperacionalTotals(newFormData as any);
        const memoria = generateVerbaOperacionalMemoriaCalculo({
            ...newFormData,
            organizacao: newFormData.om_favorecida,
            ug: newFormData.ug_favorecida,
        } as any);
        
        // 5. Stage the current record data immediately for display in Seção 3
        const stagedData: CalculatedVerbaOperacional = {
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
            
            detalhamento: "Verba Operacional",
            detalhamento_customizado: registro.detalhamento_customizado || null, 
            
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
        };
        
        setStagedUpdate(stagedData); 
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: VerbaOperacionalRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const dataToValidate = {
                ...formData,
                valor_nd_30: valorND30,
                valor_nd_39: valorND39,
            };
            
            verbaOperacionalSchema.parse(dataToValidate);
            
            const totals = calculateVerbaOperacionalTotals({
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            } as any);
            
            const memoria = generateVerbaOperacionalMemoriaCalculo({
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            } as any);
            
            const calculatedData: CalculatedVerbaOperacional = {
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
                
                detalhamento: "Verba Operacional",
                detalhamento_customizado: null, 
                
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
            };
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            setPendingVerbas(prev => [...prev, calculatedData]);
            
            // Resetar campos de cálculo, MANTENDO OM, FASE e OM DETENTORA
            setFormData(prev => ({
                ...prev,
                dias_operacao: 0,
                quantidade_equipes: 0,
                valor_total_solicitado: 0,
                valor_nd_30: 0,
                valor_nd_39: 0,
            }));
            resetAllocation();
            
            toast.info("Item de Verba Operacional adicionado à lista pendente.");
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    const handleSavePendingVerbas = () => {
        if (pendingVerbas.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        const recordsToSave: TablesInsert<'verba_operacional_registros'>[] = pendingVerbas.map(p => {
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...dbRecord } = p as any;
            return dbRecord as TablesInsert<'verba_operacional_registros'>;
        });
        
        saveMutation.mutate(recordsToSave);
    };
    
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...dbRecord } = stagedUpdate as any;
        
        updateMutation.mutate(dbRecord as TablesUpdate<'verba_operacional_registros'>);
    };
    
    const handleRemovePending = (tempId: string) => {
        setPendingVerbas(prev => prev.filter(p => p.tempId !== tempId));
        toast.info("Item removido da lista pendente.");
    };
    
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
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
    
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.om_detentora.length > 0 &&
                            formData.ug_detentora.length > 0 &&
                            formData.fase_atividade.length > 0;

    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.quantidade_equipes > 0 &&
                                    formData.valor_total_solicitado > 0;

    const isCalculationReady = isBaseFormReady &&
                              isSolicitationDataReady &&
                              isAllocationCorrect;

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
                            Verba Operacional
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para despesas operacionais diversas.
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
                                    {/* OM FAVORECIDA (OM do PTrab) */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="om_favorecida">OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={handleOmFavorecidaChange}
                                            placeholder="Selecione a OM Favorecida"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingVerbas.length > 0}
                                            initialOmName={formData.om_favorecida}
                                            initialOmUg={formData.ug_favorecida}
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
                                            disabled={!isPTrabEditable || isSaving || pendingVerbas.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (DIAS, EQUIPES, VALOR E ND) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Verba Operacional
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação */}
                                        <Card className="rounded-lg mb-4">
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
                                                            <Label htmlFor="quantidade_equipes">Quantidade de Equipes *</Label>
                                                            <Input
                                                                id="quantidade_equipes"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 1"
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
                                                                onChange={handleTotalChange}
                                                                placeholder="Ex: 1.500,00"
                                                                disabled={!isPTrabEditable || isSaving}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Alocação de NDs (Card) */}
                                        {isSolicitationDataReady && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4">
                                                    Alocação de Recursos para Verba Operacional (Valor Total: {formatCurrency(totalSolicitado)})
                                                </h4>
                                                
                                                {/* OM Destino do Recurso (Detentora) */}
                                                <div className="space-y-2 mb-4">
                                                    <Label htmlFor="om_detentora">OM de Destino do Recurso *</Label>
                                                    <OmSelector
                                                        selectedOmId={selectedOmDetentoraId}
                                                        onChange={handleOmDetentoraChange}
                                                        placeholder="Selecione a OM Detentora"
                                                        disabled={!isPTrabEditable || isSaving}
                                                        initialOmName={formData.om_detentora}
                                                        initialOmUg={formData.ug_detentora}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        UG de Destino: {formatCodug(formData.ug_detentora)}
                                                    </p>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* ND 30 (Material) - EDITÁVEL */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_30">ND 33.90.30 (Material) *</Label>
                                                        <div className="relative">
                                                            <CurrencyInput
                                                                id="valor_nd_30"
                                                                rawDigits={rawND30Input}
                                                                onChange={handleND30Change}
                                                                placeholder="0,00"
                                                                disabled={!isPTrabEditable || isSaving}
                                                                className="pl-12 text-lg h-12"
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Valor alocado para material.
                                                        </p>
                                                    </div>
                                                    
                                                    {/* ND 39 (Serviço) - CALCULADO */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_39">ND 33.90.39 (Serviço)</Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="valor_nd_39"
                                                                value={formatCurrency(valorND39)}
                                                                readOnly
                                                                disabled
                                                                className="pl-12 text-lg font-bold bg-blue-500/10 text-blue-600 disabled:opacity-100 h-12"
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Calculado por diferença (Total Solicitado - ND 30).
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                    <span className="font-bold text-sm">TOTAL ALOCADO:</span>
                                                    <span className={cn("font-extrabold text-lg", isAllocationCorrect ? "text-primary" : "text-destructive")}>
                                                        {formatCurrency(totalAlocado)}
                                                    </span>
                                                </div>
                                                
                                                {!isAllocationCorrect && (
                                                    <p className="text-xs text-destructive mt-2 text-center">
                                                        A soma das NDs (30 e 39) deve ser igual ao Valor Total Solicitado.
                                                    </p>
                                                )}
                                            </Card>
                                        )}
                                        
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
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
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
                                            
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const equipesText = item.quantidade_equipes === 1 ? "equipe" : "equipes";

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
                                                                <p className="font-medium">OM Favorecida:</p>
                                                                <p className="font-medium">OM Destino:</p>
                                                                <p className="font-medium">Período / Equipes:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isDifferentOmInView ? "text-red-600 font-bold" : "text-foreground")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.quantidade_equipes} {equipesText}</p>
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

                            {/* SEÇÃO 4: REGISTROS SALVOS (Agrupados por OM Favorecida) */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 mt-8">
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
                                                        OM Favorecida: {omName} (UG: {formatCodug(ug)})
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {omRegistros.map((registro) => {
                                                        const totalGeral = registro.valor_nd_30 + registro.valor_nd_39;
                                                        
                                                        const isDifferentOmInView = registro.om_detentora !== registro.organizacao;
                                                        
                                                        const memoriaAutomatica = generateVerbaOperacionalMemoriaCalculo(registro as any);

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
                                                                
                                                                {/* Detalhe da OM Destino (Detentora) */}
                                                                <div className="pt-2 border-t mt-2">
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">OM Destino:</span>
                                                                        <span className={cn("font-medium", isDifferentOmInView ? "text-red-600 font-bold" : "text-foreground")}>
                                                                            {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                        </span>
                                                                    </div>
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

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS (USANDO NOVO COMPONENTE) */}
                            {registros && registros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {registros.map(registro => {
                                        const memoriaAutomatica = generateVerbaOperacionalMemoriaCalculo(registro as any);
                                        
                                        // Verifica se a OM Detentora é diferente da OM Favorecida
                                        const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao;

                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex flex-col flex-1 min-w-0 mb-2">
                                                    <h4 className="text-base font-semibold text-foreground">
                                                        OM Favorecida: {registro.organizacao} (UG: {formatCodug(registro.ug)})
                                                    </h4>
                                                    {isDifferentOmInMemoria ? (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                                            <span className="text-sm font-medium text-red-600">
                                                                Destino Recurso: {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">
                                                            Destino Recurso: {registro.om_detentora} (UG: {formatCodug(registro.ug_detentora)})
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                <MemoriaCalculoEditor
                                                    registroId={registro.id}
                                                    tableName="verba_operacional_registros"
                                                    memoriaAutomatica={memoriaAutomatica}
                                                    memoriaCustomizada={registro.detalhamento_customizado}
                                                    isPTrabEditable={isPTrabEditable}
                                                    queryKey={["verbaOperacionalRegistros", ptrabId]}
                                                />
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
                                Tem certeza que deseja excluir o registro de Verba Operacional para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>? Esta ação é irreversível.
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

export default VerbaOperacionalManagerPage;