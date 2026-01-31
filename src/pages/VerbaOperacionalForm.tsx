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
    generateVerbaOperacionalMemoriaCalculo,
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
import { verbaOperacionalSchema } from "@/lib/validationSchemas"; 

// Tipos de dados
type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>; 

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
interface CalculatedVerbaOperacional extends TablesInsert<'verba_operacional_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
}

// Função para calcular ND 39 com base no Total Solicitado e ND 30 (ND 39 é a dependente)
const calculateND39 = (totalSolicitado: number, nd30Value: number): number => {
    const nd39 = totalSolicitado - nd30Value;
    return Math.max(0, nd39); // ND 39 não pode ser negativa
};

// Constantes para a OM Detentora padrão (CIE)
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
        !areNumbersEqual(data1.valor_nd_30, data2.valor_nd_30) || 
        data1.om_detentora !== data2.om_detentora ||
        data1.ug_detentora !== data2.ug_detentora ||
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.fase_atividade !== data2.fase_atividade
    ) {
        return true;
    }
    return false;
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
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingVerbas
    const [lastStagedFormData, setLastStagedFormData] = useState<typeof initialFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida (OM do PTrab)
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    
    // Estado para rastrear o ID da OM Detentora (OM Destino do Recurso)
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    // Estado para inputs monetários
    const [rawTotalInput, setRawTotalInput] = useState<string>(numberToRawDigits(initialFormState.valor_total_solicitado));
    // ND 30 e ND 39 são inputs manuais (ND 39 é calculada por diferença)
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
        // FILTRO CORRIGIDO: Se não for explicitamente 'Suprimento de Fundos', é Verba Operacional (ou registro antigo).
        select: (data) => data
            .filter(r => r.detalhamento !== 'Suprimento de Fundos')
            .sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Efeito de inicialização da OM Favorecida (OM do PTrab)
    useEffect(() => {
        if (ptrabData && !editingId) {
            // 1. OM Favorecida (OM do PTrab) - NÃO PRÉ-SELECIONAR para forçar a seleção manual.
            setFormData(prev => ({
                ...prev,
                om_favorecida: "", 
                ug_favorecida: "", 
            }));
            setSelectedOmFavorecidaId(undefined); 
            
            // 2. OM Detentora (Padrão CIE)
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
            // 1. Recalcular ND 39 (dependente)
            const totalSolicitado = formData.valor_total_solicitado;
            const nd30Value = formData.valor_nd_30; 
            const nd39Value = calculateND39(totalSolicitado, nd30Value); 
            
            const calculatedFormData = {
                ...formData,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                valor_nd_30: nd30Value,
                valor_nd_39: nd39Value,
            };

            // 2. Calcular totais
            const totals = calculateVerbaOperacionalTotals(calculatedFormData as any);
            
            // 3. Gerar memória
            const memoria = generateVerbaOperacionalMemoriaCalculo(calculatedFormData as any);
            
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
    const isVerbaDirty = useMemo(() => {
        // MODO EDIÇÃO: Compara com stagedUpdate
        if (editingId && stagedUpdate) {
            // We need to convert stagedUpdate back to the form data structure for comparison
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
            };
            
            return compareFormData(formData, stagedFormData);
        }
        
        // MODO NOVO REGISTRO: Compara com lastStagedFormData
        if (!editingId && pendingVerbas.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [editingId, stagedUpdate, formData, pendingVerbas.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingVerbas = useMemo(() => {
        return pendingVerbas.reduce((sum, item) => sum + item.valor_total_solicitado, 0);
    }, [pendingVerbas]);
    
    // NOVO MEMO: Agrupa os registros por OM Favorecida (organizacao/ug)
    const registrosAgrupadosPorOM = useMemo(() => {
        return registros?.reduce((acc, registro) => {
            // Agrupamos pela OM Favorecida (organizacao/ug na DB)
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
    // HANDLERS DE INPUT
    // =================================================================
    
    const handleCurrencyChange = (field: 'valor_total_solicitado' | 'valor_nd_30', rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        
        setFormData(prev => {
            let newFormData = { ...prev };
            let newND30Value = prev.valor_nd_30;
            let newND39Value = prev.valor_nd_39;
            let newTotalValue = prev.valor_total_solicitado;

            if (field === 'valor_total_solicitado') {
                setRawTotalInput(digits); 
                newTotalValue = numericValue;
                
                // ND 30 é mantida como está, mas recalculamos ND 39 com base nela
                newND39Value = calculateND39(newTotalValue, newND30Value);
                
            } else if (field === 'valor_nd_30') {
                setRawND30Input(digits); 
                newND30Value = numericValue;
                
                // ND 30 cannot exceed Total Solicitado
                if (newTotalValue > 0 && newND30Value > newTotalValue) {
                    newND30Value = newTotalValue;
                    setRawND30Input(numberToRawDigits(newND30Value)); 
                    toast.warning("O valor da ND 30 foi limitado ao Valor Total Solicitado.");
                }
                
                // Calculate ND 39 (difference)
                newND39Value = calculateND39(newTotalValue, newND30Value);
                
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
        mutationFn: async (recordsToSave: CalculatedVerbaOperacional[]) => {
            if (recordsToSave.length === 0) return;
            
            // Mapeia os campos do formData para os campos da DB
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                
                // Campos de detalhamento são mapeados diretamente
                const dbRecord: TablesInsert<'verba_operacional_registros'> = {
                    ...rest,
                    organizacao: om_favorecida, // OM Favorecida (do PTrab)
                    ug: ug_favorecida, // UG Favorecida (do PTrab)
                    detalhamento: "Verba Operacional", // Marcador para filtro
                    detalhamento_customizado: rest.detalhamento_customizado, // Preserva o texto customizado da memória
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
        onSuccess: (newRecords) => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingVerbas.length} registro(s) de Verba Operacional adicionado(s).`);
            setPendingVerbas([]); 
            setLastStagedFormData(null); 
            
            // Após salvar o lote, resetamos o formulário para uma nova entrada.
            resetForm();
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedVerbaOperacional) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            // Mapeia os campos do stagedUpdate para os campos da DB
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            
            const dbUpdateData: TablesUpdate<'verba_operacional_registros'> = {
                ...rest,
                organizacao: om_favorecida, 
                ug: ug_favorecida, 
                detalhamento: "Verba Operacional", // Mantém o marcador
                detalhamento_customizado: rest.detalhamento_customizado, // Preserva o texto customizado da memória
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
        setFormData(prev => ({
            ...initialFormState,
            // Manter a OM Favorecida (do PTrab) se já estiver definida
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            // OM Detentora (Padrão CIE)
            om_detentora: DEFAULT_OM_DETENTORA,
            ug_detentora: DEFAULT_UG_DETENTORA,
            // Dias e equipes são resetados para 0 (vazio)
            dias_operacao: 0,
            quantidade_equipes: 0,
            // NDs e Total são resetados para 0
            valor_total_solicitado: 0,
            valor_nd_30: 0,
            valor_nd_39: 0,
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDetentoraId(undefined); 
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
        
        setRawTotalInput(numberToRawDigits(0));
        setRawND30Input(numberToRawDigits(0));
        setRawND39Input(numberToRawDigits(0));
    };
    
    const handleClearPending = () => {
        setPendingVerbas([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        resetForm();
    };

    const handleEdit = (registro: VerbaOperacionalRegistro) => {
        if (pendingVerbas.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        // 1. Configurar OM Favorecida (OM do PTrab)
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        // 2. Configurar OM Detentora (OM Destino do Recurso)
        const omDetentoraToEdit = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omDetentoraToEdit?.id);

        // 3. Populate formData
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
        
        // Atualizar inputs brutos
        setRawTotalInput(numberToRawDigits(newFormData.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(newFormData.valor_nd_30)); 

        // 4. Calculate totals and generate memory
        const totals = calculateVerbaOperacionalTotals({
            ...newFormData,
            organizacao: newFormData.om_favorecida,
            ug: newFormData.ug_favorecida,
        } as any);
        const memoria = generateVerbaOperacionalMemoriaCalculo({
            ...newFormData,
            organizacao: newFormData.om_favorecida,
            ug: newFormData.ug_favorecida,
        } as any);
        
        // 5. Stage the current record data immediately for display in Section 3
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
            detalhamento_customizado: registro.detalhamento_customizado, // Preserva o texto customizado da memória
            
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
            
            // Campos de detalhamento (Verba Operacional não usa estes, mas o tipo da DB exige)
            objeto_aquisicao: null,
            objeto_contratacao: null,
            proposito: null,
            finalidade: null,
            local: null,
            tarefa: null,
        };
        
        setStagedUpdate(stagedData); 

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
            // 1. Recalcular ND 39 (dependente)
            const totalSolicitado = formData.valor_total_solicitado;
            const nd30Value = formData.valor_nd_30;
            const nd39Value = calculateND39(totalSolicitado, nd30Value);
            
            const dataToValidate = {
                ...formData,
                valor_nd_39: nd39Value,
            };
            
            // CORREÇÃO CRÍTICA: Usar o schema correto para Verba Operacional
            verbaOperacionalSchema.parse(dataToValidate);
            
            // 2. Preparar o objeto final (calculatedData)
            const calculatedDataForUtils = {
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            };

            const totals = calculateVerbaOperacionalTotals(calculatedDataForUtils as any);
            const memoria = generateVerbaOperacionalMemoriaCalculo(calculatedDataForUtils as any);
            
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
                
                // Campos calculados
                valor_nd_30: totals.totalND30,
                valor_nd_39: totals.totalND39,
                
                detalhamento: "Verba Operacional",
                detalhamento_customizado: null, 
                
                // Campos de display
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                
                // Campos de detalhamento (Verba Operacional não usa estes, mas o tipo da DB exige)
                objeto_aquisicao: null,
                objeto_contratacao: null,
                proposito: null,
                finalidade: null,
                local: null,
                tarefa: null,
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
            
            // Se o formulário está sujo (diferente do último estagiado) OU se a lista está vazia, adicionamos/substituímos.
            const shouldStageNewItem = pendingVerbas.length === 0 || isVerbaDirty;

            if (shouldStageNewItem) {
                setPendingVerbas(prev => {
                    if (prev.length > 0) {
                        // Se a lista não está vazia, substitui o último item (pois o formulário está dirty)
                        return [...prev.slice(0, -1), calculatedData];
                    }
                    // Se a lista está vazia, adiciona
                    return [...prev, calculatedData];
                });
                
                // Salva o estado atual do formulário como o último estagiado
                setLastStagedFormData(formData);
                
                toast.info("Item de Verba Operacional adicionado à lista pendente.");
            } else {
                toast.info("Nenhuma alteração detectada no item pendente.");
            }
            
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
        
        saveMutation.mutate(pendingVerbas);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        updateMutation.mutate(stagedUpdate);
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingVerbas(prev => {
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
            // Define a OM Detentora igual à OM Favorecida
            setSelectedOmDetentoraId(omData.id); 
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_detentora: omData.nome_om, // OM Detentora = OM Favorecida
                ug_detentora: omData.codug_om, // UG Detentora = UG Favorecida
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDetentoraId(undefined); // Reset Detentora
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_detentora: "", // Reset Detentora
                ug_detentora: "", // Reset Detentora
            }));
        }
    };
    
    // Handler para a OM Detentora (OM Destino do Recurso)
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
    
    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (registro: VerbaOperacionalRegistro) => {
        setEditingMemoriaId(registro.id);
        
        // 1. Gerar a memória automática
        const calculatedData = {
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
        };
        
        const memoriaAutomatica = generateVerbaOperacionalMemoriaCalculo(calculatedData as any);
        
        // 2. Usar a customizada se existir, senão usar a automática
        setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            // Se o usuário editar a memória, o campo 'detalhamento_customizado' será sobrescrito com o texto da memória.
            
            const { error } = await supabase
                .from("verba_operacional_registros")
                .update({
                    detalhamento: "Verba Operacional", // Mantém o marcador
                    detalhamento_customizado: memoriaEdit.trim() || null, // Salva o texto da memória
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
            // Restaurar para NULL, pois os detalhes estruturados estão em colunas dedicadas
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
    
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.om_detentora.length > 0 &&
                            formData.ug_detentora.length > 0 &&
                            formData.fase_atividade.length > 0;

    // Verifica se os campos numéricos da Solicitação estão preenchidos
    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.quantidade_equipes > 0 && 
                                    formData.valor_total_solicitado > 0;

    // Verifica se o total alocado (ND 30 + ND 39) é igual ao total solicitado
    const isAllocationCorrect = areNumbersEqual(formData.valor_total_solicitado, calculos.totalGeral);

    const isCalculationReady = isBaseFormReady &&
                              isSolicitationDataReady &&
                              isAllocationCorrect;
    
    // Lógica para a Seção 3
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingVerbas;
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
                            Verba Operacional
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para Verba Operacional (ND 30/39).
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
                                            // CORREÇÃO: Apenas passa initialOmName/Ug se estiver em modo de edição
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
                                            disabled={!isPTrabEditable || isSaving || pendingVerbas.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (DIAS, EQUIPES E ALOCAÇÃO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Verba Operacional
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação (Dias e Equipes) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período e Efetivo</CardTitle>
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
                                        
                                        {/* Alocação de NDs */}
                                        {isSolicitationDataReady && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4">
                                                    Alocação de Recursos (Valor Total: {formatCurrency(formData.valor_total_solicitado)})
                                                </h4>
                                                
                                                {/* OM Destino do Recurso (Detentora) */}
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
                                                    {/* ND 30 (Material) - EDITÁVEL */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_30">ND 33.90.30 (Material) *</Label>
                                                        <div className="relative">
                                                            <CurrencyInput
                                                                id="valor_nd_30"
                                                                rawDigits={rawND30Input}
                                                                onChange={(digits) => handleCurrencyChange('valor_nd_30', digits)}
                                                                placeholder="0,00"
                                                                disabled={!isPTrabEditable || isSaving}
                                                                className="pl-12 text-lg h-12"
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Valor alocado para aquisição de material.
                                                        </p>
                                                    </div>
                                                    
                                                    {/* ND 39 (Serviço) - CALCULADO */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_39">ND 33.90.39 (Serviço)</Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="valor_nd_39"
                                                                value={formatCurrency(calculos.totalND39)}
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
                                    
                                    {/* NOVO: Alerta de Validação Final (Modo Novo Registro) */}
                                    {!editingId && isVerbaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
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
                                            
                                            // Verifica se a OM Detentora é diferente da OM Favorecida
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;
                                            
                                            // Lógica de concordância de número
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const equipeText = item.quantidade_equipes === 1 ? "equipe" : "equipes"; 

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
                                                                <p className="font-medium">OM Destino Recurso:</p>
                                                                <p className="font-medium">Período / Equipes:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isDifferentOmInView && "text-red-600")}>{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.quantidade_equipes} {equipeText}</p>
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
                                                    disabled={isSaving || pendingVerbas.length === 0 || isVerbaDirty}
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
                                        // O total da OM é a soma do valor_total_solicitado
                                        const totalOM = omRegistros.reduce((sum, r) => Number(r.valor_total_solicitado) + sum, 0);
                                        const omName = omKey.split(' (')[0];
                                        const ug = omKey.split(' (')[1].replace(')', '');
                                        
                                        return (
                                            <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {omName} (UG: {formatCodug(ug)})
                                                        {/* Não há Badge de Destino/Categoria fixa aqui, mas podemos adicionar a Fase da Atividade do primeiro registro */}
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
                                                        const equipeText = registro.quantidade_equipes === 1 ? 'equipe' : 'equipes';
                                                        
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
                                                                                Verba Operacional
                                                                            </h4>
                                                                            {/* Badge de Fase da Atividade (se for diferente do agrupamento) */}
                                                                            {registro.fase_atividade !== omRegistros[0].fase_atividade && (
                                                                                <Badge variant="outline" className="text-xs">
                                                                                    {registro.fase_atividade}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Período: {registro.dias_operacao} {diasText} | Equipes: {registro.quantidade_equipes} {equipeText}
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
                                                                    {/* OM Destino Recurso (Sempre visível, vermelha se diferente) */}
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
                                        
                                        // Verifica se o detalhamento_customizado é um texto customizado (não o JSON de detalhes)
                                        let hasCustomMemoria = false;
                                        try {
                                            JSON.parse(registro.detalhamento_customizado || "");
                                        } catch (e) {
                                            hasCustomMemoria = !!registro.detalhamento_customizado;
                                        }
                                        
                                        // 1. Gerar a memória automática (precisa dos detalhes)
                                        const calculatedDataForMemoria = {
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
                                        };
                                        
                                        const memoriaAutomatica = generateVerbaOperacionalMemoriaCalculo(calculatedDataForMemoria as any);
                                        
                                        let memoriaExibida = memoriaAutomatica;
                                        if (isEditing) {
                                            memoriaExibida = memoriaEdit;
                                        } else if (hasCustomMemoria) {
                                            memoriaExibida = registro.detalhamento_customizado!;
                                        }
                                        
                                        // Verifica se a OM Detentora é diferente da OM Favorecida
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

export default VerbaOperacionalForm;