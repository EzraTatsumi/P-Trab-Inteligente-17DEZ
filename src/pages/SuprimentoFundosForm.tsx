import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    SuprimentoFundosRegistro, // Importar o tipo de registro da DB
} from "@/lib/suprimentoFundosUtils"; // NOVO UTILITÁRIO
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

// Tipos de dados
// Usamos o tipo de Verba Operacional como base, pois a estrutura da DB é a mesma
type SuprimentoFundosRegistroDB = Tables<'verba_operacional_registros'>; 

// Tipo de dados para OmSelector
interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
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

// Função para calcular ND 39 com base no Total Solicitado e ND 30 (ND 39 é a dependente)
const calculateND39 = (totalSolicitado: number, nd30Value: number): number => {
    const nd39 = totalSolicitado - nd30Value;
    return Math.max(0, nd39); // ND 39 não pode ser negativo
};

// Constantes para a OM Detentora padrão (CIE) - Mantido para compatibilidade com registros antigos
const DEFAULT_OM_DETENTORA = "CIE";
const DEFAULT_UG_DETENTORA = "160062";

// Schema de validação para o formulário de Suprimento de Fundos
const suprimentoFundosSchema = z.object({
    // OM Favorecida (OM do PTrab) - Usada para o cabeçalho da memória (organizacao/ug na DB)
    om_favorecida: z.string().min(1, "A OM Favorecida (do PTrab) é obrigatória."),
    ug_favorecida: z.string().min(1, "A UG Favorecida (do PTrab) é obrigatória."),
    
    // OM Detentora (OM Destino do Recurso) - Onde o recurso será alocado (om_detentora/ug_detentora na DB)
    om_detentora: z.string().min(1, "A OM Destino do Recurso é obrigatória."),
    ug_detentora: z.string().min(1, "A UG Destino do Recurso é obrigatória."),
    
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    quantidade_equipes: z.number().int().min(1, "A quantidade de equipes deve ser maior que zero."), // Mantido para consistência de DB, mas pode ser 1
    valor_total_solicitado: z.number().min(0.01, "O valor total solicitado deve ser maior que zero."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    
    // NOVOS CAMPOS DE DETALHAMENTO
    objeto_aquisicao: z.string().min(1, "O Objeto de Aquisição (Material) é obrigatório."),
    objeto_contratacao: z.string().min(1, "O Objeto de Contratação (Serviço) é obrigatório."),
    proposito: z.string().min(1, "O Propósito é obrigatório."),
    finalidade: z.string().min(1, "A Finalidade é obrigatória."),
    local: z.string().min(1, "O Local é obrigatório."),
    tarefa: z.string().min(1, "A Tarefa é obrigatória."),
    
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
    om_favorecida: "", 
    ug_favorecida: "", 
    dias_operacao: 0,
    quantidade_equipes: 1, // Default para 1
    valor_total_solicitado: 0,
    fase_atividade: "",
    om_detentora: "", // Alterado para começar vazio
    ug_detentora: "", // Alterado para começar vazio
    // NOVOS CAMPOS
    objeto_aquisicao: "",
    objeto_contratacao: "",
    proposito: "",
    finalidade: "",
    local: "",
    tarefa: "",
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
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

    // SuprimentoFundos usa a tabela 'verba_operacional_registros'
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<SuprimentoFundosRegistroDB[]>({
        queryKey: ['suprimentoFundosRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!, { detalhamento: 'Suprimento de Fundos' }), // Filtro para Suprimento de Fundos
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.detalhamento?.includes('Suprimento de Fundos')).sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Efeito de inicialização da OM Detentora (CIE) removido. A OM Detentora agora é definida pela OM Favorecida.

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
            // 1. Recalcular ND 39 (dependente) para garantir que o cálculo reflita o estado atual
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
            const totals = calculateSuprimentoFundosTotals(calculatedFormData as any);
            
            // 3. Gerar memória
            const memoria = generateSuprimentoFundosMemoriaCalculo(calculatedFormData as any);
            
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
    const isSuprimentoDirty = useMemo(() => {
        if (!editingId || !stagedUpdate) return false;

        // 1. Comparar campos principais
        if (
            formData.dias_operacao !== stagedUpdate.dias_operacao ||
            formData.quantidade_equipes !== stagedUpdate.quantidade_equipes ||
            !areNumbersEqual(formData.valor_total_solicitado, stagedUpdate.valor_total_solicitado) ||
            !areNumbersEqual(formData.valor_nd_30, stagedUpdate.valor_nd_30) || 
            formData.om_detentora !== stagedUpdate.om_detentora ||
            formData.ug_detentora !== stagedUpdate.ug_detentora ||
            formData.om_favorecida !== stagedUpdate.om_favorecida ||
            formData.ug_favorecida !== stagedUpdate.ug_favorecida ||
            // NOVOS CAMPOS
            formData.objeto_aquisicao !== (stagedUpdate as any).objeto_aquisicao ||
            formData.objeto_contratacao !== (stagedUpdate as any).objeto_contratacao ||
            formData.proposito !== (stagedUpdate as any).proposito ||
            formData.finalidade !== (stagedUpdate as any).finalidade ||
            formData.local !== (stagedUpdate as any).local ||
            formData.tarefa !== (stagedUpdate as any).tarefa
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
    const totalPendingSuprimentos = useMemo(() => {
        return pendingSuprimentos.reduce((sum, item) => sum + item.valor_total_solicitado, 0);
    }, [pendingSuprimentos]);
    
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
        }, {} as Record<string, SuprimentoFundosRegistroDB[]>) || {};
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
                    setRawND30Input(numberToRawDigits(newND30Value)); 
                    toast.warning("O valor da ND 30 foi limitado ao Valor Total Solicitado.");
                }
                
                // Calculate ND 39 (difference)
                newND39Value = calculateND39(newTotalValue, newND30Value);
                setRawND39Input(numberToRawDigits(newND39Value));
                
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
            
            // Mapeia os campos do formData para os campos da DB
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                
                // Adiciona os campos de detalhamento ao 'detalhamento' da DB
                const detalhamentoCustomizado = JSON.stringify({
                    objeto_aquisicao: (rest as any).objeto_aquisicao,
                    objeto_contratacao: (rest as any).objeto_contratacao,
                    proposito: (rest as any).proposito,
                    finalidade: (rest as any).finalidade,
                    local: (rest as any).local,
                    tarefa: (rest as any).tarefa,
                });
                
                return {
                    ...rest,
                    organizacao: om_favorecida, // OM Favorecida (do PTrab)
                    ug: ug_favorecida, // UG Favorecida (do PTrab)
                    detalhamento: "Suprimento de Fundos", // Marcador para filtro
                    detalhamento_customizado: detalhamentoCustomizado, // Armazena os detalhes aqui
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
            queryClient.invalidateQueries({ queryKey: ["suprimentoFundosRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingSuprimentos.length} registro(s) de Suprimento de Fundos adicionado(s).`);
            setPendingSuprimentos([]); 
            
            resetForm();
            
            if (newRecords && newRecords.length > 0) {
                handleEdit(newRecords[0] as SuprimentoFundosRegistroDB);
            }
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedSuprimentoFundos) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            // Mapeia os campos do stagedUpdate para os campos da DB
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            
            // Adiciona os campos de detalhamento ao 'detalhamento_customizado' da DB
            const detalhamentoCustomizado = JSON.stringify({
                objeto_aquisicao: (rest as any).objeto_aquisicao,
                objeto_contratacao: (rest as any).objeto_contratacao,
                proposito: (rest as any).proposito,
                finalidade: (rest as any).finalidade,
                local: (rest as any).local,
                tarefa: (rest as any).tarefa,
            });
            
            const dbUpdateData: TablesUpdate<'verba_operacional_registros'> = {
                ...rest,
                organizacao: om_favorecida, 
                ug: ug_favorecida, 
                detalhamento: "Suprimento de Fundos", // Mantém o marcador
                detalhamento_customizado: detalhamentoCustomizado, // Atualiza os detalhes
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
            // OM Favorecida e UG Favorecida são resetadas para vazio
            om_favorecida: "",
            ug_favorecida: "",
            // Dias e equipes são resetados para 0 (vazio)
            dias_operacao: 0,
            quantidade_equipes: 1,
            // NDs e Total são resetados para 0
            valor_total_solicitado: 0,
            valor_nd_30: 0,
            valor_nd_39: 0,
            objeto_aquisicao: "",
            objeto_contratacao: "",
            proposito: "",
            finalidade: "",
            local: "",
            tarefa: "",
            // Detentora também é resetada para vazio
            om_detentora: "",
            ug_detentora: "",
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDetentoraId(undefined); 
        setStagedUpdate(null); 
        
        setRawTotalInput(numberToRawDigits(0));
        setRawND30Input(numberToRawDigits(0));
        setRawND39Input(numberToRawDigits(0));
    };
    
    const handleClearPending = () => {
        setPendingSuprimentos([]);
        setStagedUpdate(null);
        resetForm();
    };

    const handleEdit = (registro: SuprimentoFundosRegistroDB) => {
        if (pendingSuprimentos.length > 0) {
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
        
        // 3. Parsear Detalhamento Customizado para os campos de detalhe
        let customDetails = initialFormState;
        try {
            if (registro.detalhamento_customizado) {
                // O detalhamento customizado armazena o JSON dos detalhes
                customDetails = JSON.parse(registro.detalhamento_customizado);
            }
        } catch (e) {
            console.error("Erro ao parsear detalhamento customizado:", e);
        }

        // 4. Populate formData
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
            // NOVOS CAMPOS
            objeto_aquisicao: customDetails.objeto_aquisicao || "",
            objeto_contratacao: customDetails.objeto_contratacao || "",
            proposito: customDetails.proposito || "",
            finalidade: customDetails.finalidade || "",
            local: customDetails.local || "",
            tarefa: customDetails.tarefa || "",
        };
        setFormData(newFormData);
        
        // Atualizar inputs brutos
        setRawTotalInput(numberToRawDigits(newFormData.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(newFormData.valor_nd_30));
        setRawND39Input(numberToRawDigits(newFormData.valor_nd_39));

        // 5. Calculate totals and generate memory
        const totals = calculateSuprimentoFundosTotals(newFormData as any);
        const memoria = generateSuprimentoFundosMemoriaCalculo(newFormData as any);
        
        // 6. Stage the current record data immediately for display in Section 3
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
            detalhamento_customizado: registro.detalhamento_customizado || null, 
            
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
            
            // Incluir campos de detalhamento no stagedUpdate para comparação
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
            
            // 2. Validação Zod
            suprimentoFundosSchema.parse(dataToValidate);
            
            // 3. Preparar o objeto final (calculatedData)
            const calculatedDataForUtils = {
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
                
                // Incluir campos de detalhamento no objeto a ser salvo/estagiado
                objeto_aquisicao: formData.objeto_aquisicao,
                objeto_contratacao: formData.objeto_contratacao,
                proposito: formData.proposito,
                finalidade: formData.finalidade,
                local: formData.local,
                tarefa: formData.tarefa,
            } as CalculatedSuprimentoFundos;
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                // Se estiver editando, a memória customizada é o JSON dos detalhes
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            setPendingSuprimentos(prev => [...prev, calculatedData]);
            
            // 5. Resetar o formulário para o próximo item
            setFormData(prev => ({
                ...initialFormState,
                // OM Favorecida e UG Favorecida são resetadas para vazio
                om_favorecida: "",
                ug_favorecida: "",
                fase_atividade: prev.fase_atividade,
                om_detentora: "", // Reset Detentora
                ug_detentora: "", // Reset Detentora
                dias_operacao: 0, 
                quantidade_equipes: 1, 
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
            
            setRawTotalInput(numberToRawDigits(0));
            setRawND30Input(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
            setSelectedOmFavorecidaId(undefined); // Resetar o seletor da OM Favorecida
            setSelectedOmDetentoraId(undefined); // Resetar o seletor da OM Detentora
            
            toast.info("Item de Suprimento de Fundos adicionado à lista pendente.");
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingSuprimentos = () => {
        if (pendingSuprimentos.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        saveMutation.mutate(pendingSuprimentos);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        updateMutation.mutate(stagedUpdate);
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingSuprimentos(prev => prev.filter(p => p.tempId !== tempId));
        toast.info("Item removido da lista pendente.");
    };
    
    // Handler para a OM Favorecida (OM do PTrab)
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            // NOVO: Define a OM Detentora igual à OM Favorecida
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
    
    const handleIniciarEdicaoMemoria = (registro: SuprimentoFundosRegistroDB) => {
        setEditingMemoriaId(registro.id);
        
        // 1. Gerar a memória automática
        const totals = calculateSuprimentoFundosTotals(registro as any);
        const memoriaAutomatica = generateSuprimentoFundosMemoriaCalculo(registro as any);
        
        // 2. Usar a customizada se existir, senão usar a automática
        setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            // Aqui, o campo 'detalhamento_customizado' da DB armazena o JSON dos detalhes,
            // mas o campo 'detalhamento' armazena a memória de cálculo gerada.
            // Para Suprimento de Fundos, vamos usar o campo 'detalhamento_customizado' para a memória editável.
            
            const { error } = await supabase
                .from("verba_operacional_registros")
                .update({
                    detalhamento: "Suprimento de Fundos", // Mantém o marcador
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
                              isAllocationCorrect &&
                              formData.objeto_aquisicao.length > 0 &&
                              formData.objeto_contratacao.length > 0 &&
                              formData.proposito.length > 0 &&
                              formData.finalidade.length > 0 &&
                              formData.local.length > 0 &&
                              formData.tarefa.length > 0;
    
    // Lógica para a Seção 3
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
                                    {/* OM FAVORECIDA (OM do PTrab) */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="om_favorecida">OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={handleOmFavorecidaChange}
                                            placeholder="Selecione a OM Favorecida"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingSuprimentos.length > 0}
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
                                        
                                        {/* Dados da Solicitação (Dias e Equipes) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período e Quantidade</CardTitle>
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
                                        
                                        {/* Detalhamento da Aquisição/Contratação */}
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
                                                                placeholder="Ex: Material de escritório e limpeza"
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
                                                                placeholder="Ex: Pequenos reparos e manutenção"
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
                                                                placeholder="Ex: Apoiar a Operação X"
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
                                                                placeholder="Ex: Garantir a continuidade das atividades"
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
                                                                placeholder="Ex: Marabá/PA"
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
                                                                placeholder="Ex: Aquisição de material de consumo"
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
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
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
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
                                            
                                            // Verifica se a OM Detentora é diferente da OM Favorecida
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;

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
                                                        
                                                        {/* Detalhes da Solicitação */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Favorecida:</p>
                                                                {isDifferentOmInView ? (
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                                                        <span className="text-sm font-medium text-red-600">
                                                                            Destino Recurso: {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <p className="font-medium">OM Destino Recurso:</p>
                                                                )}
                                                                <p className="font-medium">Período / Equipes:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                {!isDifferentOmInView && (
                                                                    <p className="font-medium">{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                                )}
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
                                                    disabled={isSaving || pendingSuprimentos.length === 0}
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
                                                        OM Favorecida: {omName} (UG: {formatCodug(ug)})
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {omRegistros.map((registro) => {
                                                        const totalGeral = registro.valor_nd_30 + registro.valor_nd_39;
                                                        
                                                        // Verifica se a OM Detentora é diferente da OM Favorecida
                                                        const isDifferentOmInView = registro.om_detentora !== registro.organizacao;
                                                        
                                                        // Lógica de concordância de número
                                                        const diasText = registro.dias_operacao === 1 ? "dia" : "dias";
                                                        const equipesText = registro.quantidade_equipes === 1 ? "equipe" : "equipes";

                                                        return (
                                                            <Card 
                                                                key={registro.id} 
                                                                className="p-3 bg-background border"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-semibold text-base text-foreground">
                                                                                Suprimento de Fundos ({formatCurrency(registro.valor_total_solicitado)})
                                                                            </h4>
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {registro.fase_atividade}
                                                                            </Badge>
                                                                        </div>
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

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS */}
                            {registros && registros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {registros.map(registro => {
                                        const isEditing = editingMemoriaId === registro.id;
                                        // Para Suprimento de Fundos, o detalhamento_customizado armazena o JSON dos detalhes,
                                        // e o campo 'detalhamento' armazena a memória gerada.
                                        // Se o detalhamento_customizado for um JSON válido, a memória é automática.
                                        // Se for um texto, é customizada.
                                        let hasCustomMemoria = false;
                                        let memoriaExibida = "";
                                        
                                        try {
                                            // Tenta parsear o detalhamento_customizado. Se falhar, é um texto customizado.
                                            JSON.parse(registro.detalhamento_customizado || "");
                                            // Se o parse for bem-sucedido, a memória é automática (gerada pelo utilitário)
                                            memoriaExibida = generateSuprimentoFundosMemoriaCalculo(registro as any);
                                        } catch (e) {
                                            // Se falhar, o conteúdo é o texto customizado
                                            hasCustomMemoria = !!registro.detalhamento_customizado;
                                            memoriaExibida = registro.detalhamento_customizado || generateSuprimentoFundosMemoriaCalculo(registro as any);
                                        }
                                        
                                        if (isEditing) {
                                            memoriaExibida = memoriaEdit;
                                        }
                                        
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