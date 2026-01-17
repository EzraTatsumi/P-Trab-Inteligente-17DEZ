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
    return Math.max(0, nd39); // ND 39 não pode ser negativo
};

// Constantes para a OM Detentora padrão (CIE)
const DEFAULT_OM_DETENTORA = "CIE";
const DEFAULT_UG_DETENTORA = "160062";

// Schema de validação para o formulário de Verba Operacional
const verbaOperacionalSchema = z.object({
    // OM Favorecida (OM do PTrab) - Usada para o cabeçalho da memória (organizacao/ug na DB)
    om_favorecida: z.string().min(1, "A OM Favorecida (do PTrab) é obrigatória."),
    ug_favorecida: z.string().min(1, "A UG Favorecida (do PTrab) é obrigatória."),
    
    // OM Detentora (OM Destino do Recurso) - Onde o recurso será alocado (om_detentora/ug_detentora na DB)
    om_detentora: z.string().min(1, "A OM Destino do Recurso é obrigatória."),
    ug_detentora: z.string().min(1, "A UG Destino do Recurso é obrigatória."),
    
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    quantidade_equipes: z.number().int().min(1, "A quantidade de equipes deve ser maior que zero."),
    valor_total_solicitado: z.number().min(0.01, "O valor total solicitado deve ser maior que zero."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    
    // Alocação de NDs
    valor_nd_30: z.number().min(0, "ND 30 não pode ser negativa."),
    valor_nd_39: z.number().min(0, "ND 39 não pode ser negativa."),
    
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
    om_favorecida: "", // OM Favorecida (do PTrab)
    ug_favorecida: "", // UG Favorecida (do PTrab)
    dias_operacao: 0,
    quantidade_equipes: 0,
    valor_total_solicitado: 0,
    fase_atividade: "",
    om_detentora: "", // OM Destino do Recurso (Padrão CIE)
    ug_detentora: "", // UG Destino do Recurso (Padrão 160.062)
    valor_nd_30: 0, // Inicia zerado
    valor_nd_39: 0, // Inicia zerado (será preenchido ao digitar o total solicitado)
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
    
    // Estado para rastrear o ID da OM Favorecida (OM do PTrab)
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    
    // Estado para rastrear o ID da OM Detentora (OM Destino do Recurso)
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
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
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!, { detalhamento: 'Verba Operacional' }),
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.detalhamento !== 'Suprimento de Fundos').sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Efeito para preencher a OM Favorecida (OM do PTrab) e a OM Detentora (CIE) ao carregar
    useEffect(() => {
        if (ptrabData && !editingId) {
            // 1. OM Favorecida (OM do PTrab) - Deve ser selecionável, mas o valor inicial é o do PTrab
            const omFavorecida = oms?.find(om => om.nome_om === ptrabData.nome_om && om.codug_om === ptrabData.codug_om);
            
            setFormData(prev => ({
                ...prev,
                om_favorecida: ptrabData.nome_om,
                ug_favorecida: ptrabData.codug_om,
            }));
            setSelectedOmFavorecidaId(omFavorecida?.id);
            
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
            // Se estiver editando, garantimos que os seletores de OM sejam inicializados
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
            // Validação rápida dos campos essenciais antes de calcular
            if (formData.dias_operacao <= 0 || formData.quantidade_equipes <= 0 || formData.valor_total_solicitado <= 0 || formData.om_detentora.length === 0) {
                return {
                    totalGeral: 0, totalND30: 0, totalND39: 0,
                    memoria: "Preencha todos os campos obrigatórios para calcular.",
                };
            }
            
            // Recalcular ND 39 (dependente) para garantir que o cálculo reflita o estado atual
            const totalSolicitado = formData.valor_total_solicitado;
            const nd30Value = formData.valor_nd_30; // ND 30 é o valor de input
            const nd39Value = calculateND39(totalSolicitado, nd30Value); // ND 39 é a diferença
            
            const calculatedFormData = {
                ...formData,
                organizacao: formData.om_favorecida, // Mapeamento para a função de utilidade
                ug: formData.ug_favorecida, // Mapeamento para a função de utilidade
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
        // Check if there is an item currently staged for review/update
        if (!stagedUpdate) return false; 

        // 1. Comparar campos principais
        // Nota: ND 39 é calculada, então comparamos ND 30 e Total Solicitado (os inputs do usuário)
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

        // 2. Comparar fase de atividade (se for diferente, precisa re-estagiar para atualizar a memória)
        if (formData.fase_atividade !== stagedUpdate.fase_atividade) {
            return true;
        }

        return false;
    }, [stagedUpdate, formData]);
    
    // NOVO MEMO: Lógica para a Seção 3
    const itemsToDisplay = useMemo(() => {
        if (stagedUpdate) {
            // Se estiver estagiando uma atualização ou um novo item, mostra-o primeiro
            return [stagedUpdate, ...pendingVerbas];
        }
        return pendingVerbas;
    }, [stagedUpdate, pendingVerbas]);
    
    const isStagingUpdate = !!stagedUpdate && !!editingId;
    const isStagingNew = !!stagedUpdate && !editingId;

    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingVerbas = useMemo(() => {
        // Se estiver estagiando, o total é a soma do staged + pending
        const stagedTotal = stagedUpdate ? stagedUpdate.valor_total_solicitado : 0;
        const pendingTotal = pendingVerbas.reduce((sum, item) => sum + item.valor_total_solicitado, 0);
        return stagedTotal + pendingTotal;
    }, [pendingVerbas, stagedUpdate]);
    
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
                
                // ND 30 é mantida como está, mas recalculamos ND 39 com base nela
                newND39Value = calculateND39(newTotalValue, newND30Value);
                
                setRawND39Input(numberToRawDigits(newND39Value));
                
            } else if (field === 'valor_nd_30') {
                setRawND30Input(digits);
                newND30Value = numericValue;
                
                // ND 30 cannot exceed Total Solicitado
                if (newTotalValue > 0 && newND30Value > newTotalValue) {
                    newND30Value = newTotalValue;
                    // Update raw input to reflect capped value
                    setRawND30Input(numberToRawDigits(newND30Value)); 
                    toast.warning("O valor da ND 30 foi limitado ao Valor Total Solicitado.");
                }
                
                // Calculate ND 39 (difference)
                newND39Value = calculateND39(newTotalValue, newND30Value);
                setRawND39Input(numberToRawDigits(newND39Value));
                
            } else {
                // ND 39 is now read-only. This branch should not be reached for ND 39 input.
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
                return {
                    ...rest,
                    organizacao: om_favorecida, // OM Favorecida (do PTrab)
                    ug: ug_favorecida, // UG Favorecida (do PTrab)
                    detalhamento: "Verba Operacional", // Marcador para filtro
                    // om_detentora e ug_detentora já estão corretos
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
            
            // 1. Resetar o formulário (mantendo campos de contexto)
            resetForm();
            
            // 2. Colocar o último registro salvo em modo de edição para exibir a Seção 5
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
            
            // Mapeia os campos do stagedUpdate para os campos da DB
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            
            const dbUpdateData: TablesUpdate<'verba_operacional_registros'> = {
                ...rest,
                organizacao: om_favorecida, // OM Favorecida (do PTrab)
                ug: ug_favorecida, // UG Favorecida (do PTrab)
                detalhamento: "Verba Operacional", // Marcador para filtro
                // om_detentora e ug_detentora já estão corretos
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
            // Mantém a OM Favorecida (do PTrab) se já estiver definida
            om_favorecida: ptrabData?.nome_om || "",
            ug_favorecida: ptrabData?.codug_om || "",
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
        setStagedUpdate(null); // Limpa staged update
        
        // Resetar inputs brutos
        setRawTotalInput(numberToRawDigits(0));
        setRawND30Input(numberToRawDigits(0));
        setRawND39Input(numberToRawDigits(0));
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
        
        // 1. Configurar OM Favorecida (OM do PTrab)
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        // 2. Configurar OM Detentora (OM Destino do Recurso)
        const omDetentoraToEdit = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omDetentoraToEdit?.id);

        // 3. Populate formData
        const newFormData = {
            om_favorecida: registro.organizacao, // OM Favorecida (organizacao na DB)
            ug_favorecida: registro.ug, // UG Favorecida (ug na DB)
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
        setRawND39Input(numberToRawDigits(newFormData.valor_nd_39));

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
            organizacao: newFormData.om_favorecida, // Mapeamento para DB
            ug: newFormData.ug_favorecida, // Mapeamento para DB
            om_detentora: newFormData.om_detentora,
            ug_detentora: newFormData.ug_detentora,
            dias_operacao: newFormData.dias_operacao,
            fase_atividade: newFormData.fase_atividade,
            quantidade_equipes: newFormData.quantidade_equipes,
            valor_total_solicitado: newFormData.valor_total_solicitado,
            
            // Campos calculados
            valor_nd_30: totals.totalND30,
            valor_nd_39: totals.totalND39,
            
            detalhamento: "Verba Operacional",
            detalhamento_customizado: registro.detalhamento_customizado || null, 
            
            // Campos de display
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
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
            const totalSolicitado = formData.valor_total_solicitado;
            const nd30Value = formData.valor_nd_30;
            const nd39Value = calculateND39(totalSolicitado, nd30Value);
            
            const dataToValidate = {
                ...formData,
                valor_nd_39: nd39Value,
            };
            
            verbaOperacionalSchema.parse(dataToValidate);
            
            // 2. Preparar o objeto final (calculatedData)
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
                // Use editingId if present, otherwise generate a new tempId
                tempId: editingId || stagedUpdate?.tempId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, // Mapeamento para DB
                ug: formData.ug_favorecida, // Mapeamento para DB
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
                detalhamento_customizado: stagedUpdate?.detalhamento_customizado || null, 
                
                // Campos de display
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
            };
            
            // If editing, preserve the original custom memory
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
            }
            
            // 3. Stage the calculated data
            setStagedUpdate(calculatedData);
            
            // 4. Provide feedback
            if (editingId) {
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
            } else {
                toast.info("Item calculado. Revise e adicione à lista pendente na Seção 3.");
            }
            
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    // NOVO: Move o item estagiado para a lista pendente e reseta o formulário para o próximo item
    const handleCommitStagedToPending = () => {
        if (!stagedUpdate) return;
        
        setPendingVerbas(prev => [...prev, stagedUpdate]);
        setStagedUpdate(null); // Clear staged item
        
        // Reset form values, keeping context fields
        setFormData(prev => ({
            ...initialFormState,
            // Manter campos de contexto
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_detentora: prev.om_detentora,
            ug_detentora: prev.ug_detentora,
            dias_operacao: prev.dias_operacao,
            quantidade_equipes: prev.quantidade_equipes,
            fase_atividade: prev.fase_atividade,
            
            // Resetar apenas os campos de valor
            valor_total_solicitado: 0,
            valor_nd_30: 0,
            valor_nd_39: 0,
        }));
        
        setRawTotalInput(numberToRawDigits(0));
        setRawND30Input(numberToRawDigits(0));
        setRawND39Input(numberToRawDigits(0));
        
        toast.info("Item adicionado à lista pendente. Pronto para o próximo item ou para salvar.");
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
    const handleRemovePending = (itemToRemove: CalculatedVerbaOperacional) => {
        if (itemToRemove.tempId === stagedUpdate?.tempId && !editingId) {
            // Se for o item estagiado (novo), apenas limpa o estágio
            setStagedUpdate(null);
            resetForm();
        } else {
            // Se for um item na lista pendente
            setPendingVerbas(prev => prev.filter(p => p.tempId !== itemToRemove.tempId));
            toast.info("Item removido da lista pendente.");
        }
    };
    
    // Handler para a OM Favorecida (OM do PTrab)
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
    const itemsToReview = itemsToDisplay.filter(item => item.tempId === stagedUpdate?.tempId);
    const itemsInPendingList = itemsToDisplay.filter(item => item.tempId !== stagedUpdate?.tempId);

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
                                        
                                        {/* Alocação de NDs (Card) - RENDERIZAÇÃO CONDICIONAL */}
                                        {isSolicitationDataReady && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4">
                                                    Alocação de Recursos para Verba Operacional (Valor Total: {formatCurrency(formData.valor_total_solicitado)})
                                                </h4>
                                                
                                                {/* OM Destino do Recurso (Detentora) - AGORA SELECIONÁVEL AQUI */}
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
                                                        <Label htmlFor="valor_nd_30">ND 33.90.30 (Material)</Label>
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
                                                            Valor alocado para material.
                                                        </p>
                                                    </div>
                                                    
                                                    {/* ND 39 (Serviço) - CALCULADO */}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="valor_nd_39">ND 33.90.39 (Serviço)</Label>
                                                        <div className="relative">
                                                            <Input
                                                                id="valor_nd_39"
                                                                value={formatCurrency(formData.valor_nd_39)}
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
                                        3. Itens Adicionados ({itemsInPendingList.length})
                                        {isStagingUpdate && <Badge variant="destructive">Revisão de Edição</Badge>}
                                        {isStagingNew && <Badge variant="secondary">Novo Item em Revisão</Badge>}
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Apenas se houver item estagiado E estiver sujo) */}
                                    {stagedUpdate && isVerbaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToReview.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            
                                            // Verifica se a OM Detentora é diferente da OM Favorecida
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;
                                            
                                            // Lógica de concordância de número
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
                                                                {/* Botão de remoção para itens novos estagiados */}
                                                                {isStagingNew && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => handleRemovePending(item)}
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
                                        
                                        {/* Itens já na lista pendente (se houver) */}
                                        {itemsInPendingList.length > 0 && (
                                            <div className="space-y-2 pt-4 border-t border-dashed">
                                                <h4 className="text-sm font-semibold text-muted-foreground">Itens na Fila de Salvamento ({itemsInPendingList.length})</h4>
                                                {itemsInPendingList.map(item => (
                                                    <div key={item.tempId} className="flex justify-between items-center p-2 bg-background rounded-md border">
                                                        <span className="text-sm">{item.om_favorecida} ({item.dias_operacao} dias)</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm">{formatCurrency(item.totalGeral)}</span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleRemovePending(item)}
                                                                disabled={isSaving}
                                                            >
                                                                <X className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">
                                                VALOR TOTAL DA OM
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(totalPendingVerbas)}
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
                                        ) : isStagingNew ? ( 
                                            <>
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    onClick={resetForm} 
                                                    disabled={isSaving}
                                                >
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Limpar Formulário
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleCommitStagedToPending}
                                                    disabled={isSaving || isVerbaDirty}
                                                    className="w-full md:w-auto bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Adicionar à Lista Pendente
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
                                        
                                        // Verifica se a OM Detentora é diferente da OM Favorecida
                                        const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao;

                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-semibold text-foreground">
                                                                OM Favorecida: {registro.organizacao} (UG: {formatCodug(registro.ug)})
                                                            </h4>
                                                            {hasCustomMemoria && !isEditing && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Editada manualmente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {/* NOVO LOCAL DO ALERTA VISUAL */}
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