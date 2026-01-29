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
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Plane } from "lucide-react";
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
import PassagemTrechoSelectorDialog from "@/components/PassagemTrechoSelectorDialog";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";

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
}

// Estado inicial para o formulário
const initialFormState: PassagemFormType & { trecho_selecionado: boolean } = {
    om_favorecida: "", 
    ug_favorecida: "", 
    dias_operacao: 0,
    fase_atividade: "",
    
    // Dados do Trecho Selecionado (OM Detentora é a OM Contratante)
    om_detentora: "",
    ug_detentora: "",
    diretriz_id: "",
    trecho_id: "",
    origem: "",
    destino: "",
    tipo_transporte: 'AÉREO',
    is_ida_volta: false,
    valor_unitario: 0,
    
    // Quantidade
    quantidade_passagens: 0,
    
    // Campo de controle de UI
    trecho_selecionado: false,
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
        data1.quantidade_passagens !== data2.quantidade_passagens ||
        data1.om_detentora !== data2.om_detentora ||
        data1.ug_detentora !== data2.ug_detentora ||
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.fase_atividade !== data2.fase_atividade ||
        data1.trecho_id !== data2.trecho_id
    ) {
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
    
    const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<PassagemRegistroDB | null>(null);
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingPassagens, setPendingPassagens] = useState<CalculatedPassagem[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedPassagem | null>(null);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingPassagens
    const [lastStagedFormData, setLastStagedFormData] = useState<typeof initialFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida (OM do PTrab)
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    
    // Estado para rastrear o ID da OM Detentora (OM Contratante)
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
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
            
            // 2. OM Detentora (Resetada, pois deve vir da seleção do trecho)
            setFormData(prev => ({
                ...prev,
                om_detentora: "",
                ug_detentora: "",
            }));
            setSelectedOmDetentoraId(undefined);
            
        } else if (ptrabData && editingId) {
            // Se estiver editando, tentamos encontrar os IDs das OMs para o seletor
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
        if (!ptrabData || !formData.trecho_selecionado) {
            return {
                totalGeral: 0,
                totalND33: 0,
                memoria: "Selecione um trecho e preencha a quantidade de passagens.",
            };
        }
        
        try {
            const calculatedFormData: PassagemFormType = {
                ...formData,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
            };

            // 1. Calcular totais
            const totals = calculatePassagemTotals(calculatedFormData);
            
            // 2. Gerar memória
            const memoria = generatePassagemMemoriaCalculo({
                ...calculatedFormData,
                valor_total: totals.totalGeral,
                valor_nd_33: totals.totalND33,
            });
            
            return {
                ...totals,
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
    }, [formData, ptrabData]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate ou lastStagedFormData)
    const isPassagemDirty = useMemo(() => {
        // MODO EDIÇÃO: Compara com stagedUpdate
        if (editingId && stagedUpdate) {
            // We need to convert stagedUpdate back to the form data structure for comparison
            const stagedFormData: typeof initialFormState = {
                om_favorecida: stagedUpdate.organizacao,
                ug_favorecida: stagedUpdate.ug,
                om_detentora: stagedUpdate.om_detentora,
                ug_detentora: stagedUpdate.ug_detentora,
                dias_operacao: stagedUpdate.dias_operacao,
                fase_atividade: stagedUpdate.fase_atividade || '',
                quantidade_passagens: stagedUpdate.quantidade_passagens,
                
                // Campos de trecho
                diretriz_id: stagedUpdate.diretriz_id,
                trecho_id: stagedUpdate.trecho_id,
                origem: stagedUpdate.origem,
                destino: stagedUpdate.destino,
                tipo_transporte: stagedUpdate.tipo_transporte as TipoTransporte,
                is_ida_volta: stagedUpdate.is_ida_volta,
                valor_unitario: stagedUpdate.valor_unitario,
                
                trecho_selecionado: true, // Sempre true se estiver staged
            };
            
            return compareFormData(formData, stagedFormData);
        }
        
        // MODO NOVO REGISTRO: Compara com lastStagedFormData
        if (!editingId && pendingPassagens.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [editingId, stagedUpdate, formData, pendingPassagens.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingPassagens = useMemo(() => {
        return pendingPassagens.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingPassagens]);
    
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
        }, {} as Record<string, PassagemRegistroDB[]>) || {};
    }, [registros]);

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
            // Resetar campos de trecho e quantidade
            quantidade_passagens: 0,
            trecho_selecionado: false,
            om_detentora: "",
            ug_detentora: "",
            diretriz_id: "",
            trecho_id: "",
            origem: "",
            destino: "",
            tipo_transporte: 'AÉREO',
            is_ida_volta: false,
            valor_unitario: 0,
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDetentoraId(undefined); 
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
    };
    
    const handleClearPending = () => {
        setPendingPassagens([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        resetForm();
    };

    const handleEdit = (registro: PassagemRegistroDB) => {
        if (pendingPassagens.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        // 1. Configurar OM Favorecida (OM do PTrab)
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        // 2. Configurar OM Detentora (OM Contratante)
        const omDetentoraToEdit = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omDetentoraToEdit?.id);

        // 3. Populate formData
        const newFormData: typeof initialFormState = {
            om_favorecida: registro.organizacao, 
            ug_favorecida: registro.ug, 
            dias_operacao: registro.dias_operacao,
            fase_atividade: registro.fase_atividade || "",
            
            // Dados do Trecho
            om_detentora: registro.om_detentora,
            ug_detentora: registro.ug_detentora,
            diretriz_id: registro.diretriz_id,
            trecho_id: registro.trecho_id,
            origem: registro.origem,
            destino: registro.destino,
            tipo_transporte: registro.tipo_transporte as TipoTransporte,
            is_ida_volta: registro.is_ida_volta,
            valor_unitario: Number(registro.valor_unitario || 0),
            
            // Quantidade
            quantidade_passagens: registro.quantidade_passagens,
            
            trecho_selecionado: true,
        };
        setFormData(newFormData);
        
        // 4. Calculate totals and generate memory
        const totals = calculatePassagemTotals(newFormData);
        const memoria = generatePassagemMemoriaCalculo({
            ...newFormData,
            valor_total: totals.totalGeral,
            valor_nd_33: totals.totalND33,
        });
        
        // 5. Stage the current record data immediately for display in Section 3
        const stagedData: CalculatedPassagem = {
            tempId: registro.id,
            p_trab_id: ptrabId!,
            organizacao: newFormData.om_favorecida, 
            ug: newFormData.ug_favorecida, 
            om_detentora: newFormData.om_detentora,
            ug_detentora: newFormData.ug_detentora,
            dias_operacao: newFormData.dias_operacao,
            fase_atividade: newFormData.fase_atividade,
            
            // Trecho details
            diretriz_id: newFormData.diretriz_id,
            trecho_id: newFormData.trecho_id,
            origem: newFormData.origem,
            destino: newFormData.destino,
            tipo_transporte: newFormData.tipo_transporte,
            is_ida_volta: newFormData.is_ida_volta,
            valor_unitario: newFormData.valor_unitario,
            
            quantidade_passagens: newFormData.quantidade_passagens,
            
            valor_total: totals.totalGeral,
            valor_nd_33: totals.totalND33,
            
            detalhamento: registro.detalhamento,
            detalhamento_customizado: registro.detalhamento_customizado, 
            
            totalGeral: totals.totalGeral,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
        } as CalculatedPassagem;
        
        setStagedUpdate(stagedData); 

        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: PassagemRegistroDB) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação básica
            if (!formData.trecho_selecionado) {
                throw new Error("Selecione um trecho de passagem na Seção 2.");
            }
            if (formData.quantidade_passagens <= 0) {
                throw new Error("A quantidade de passagens deve ser maior que zero.");
            }
            if (formData.dias_operacao <= 0) {
                throw new Error("O número de dias deve ser maior que zero.");
            }
            if (!formData.om_favorecida || !formData.ug_favorecida) {
                throw new Error("A OM Favorecida é obrigatória.");
            }
            
            // 2. Preparar o objeto final (calculatedData)
            const calculatedDataForUtils: PassagemFormType = {
                ...formData,
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
            };

            const totals = calculatePassagemTotals(calculatedDataForUtils);
            
            const calculatedData: CalculatedPassagem = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                
                // Trecho details
                diretriz_id: formData.diretriz_id,
                trecho_id: formData.trecho_id,
                origem: formData.origem,
                destino: formData.destino,
                tipo_transporte: formData.tipo_transporte,
                is_ida_volta: formData.is_ida_volta,
                valor_unitario: formData.valor_unitario,
                
                quantidade_passagens: formData.quantidade_passagens,
                
                valor_total: totals.totalGeral,
                valor_nd_33: totals.totalND33,
                
                detalhamento: "Passagens", // Marcador
                detalhamento_customizado: null, 
                
                totalGeral: totals.totalGeral,
                memoria_calculo_display: generatePassagemMemoriaCalculo({
                    ...calculatedDataForUtils,
                    valor_total: totals.totalGeral,
                    valor_nd_33: totals.totalND33,
                }), 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
            } as CalculatedPassagem;
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                
                // Preserva a memória customizada se existir
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
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            
            const shouldStageNewItem = pendingPassagens.length === 0 || isPassagemDirty;

            if (shouldStageNewItem) {
                setPendingPassagens(prev => {
                    if (prev.length > 0) {
                        return [...prev.slice(0, -1), calculatedData];
                    }
                    return [...prev, calculatedData];
                });
                
                setLastStagedFormData(formData);
                
                toast.info("Item de Passagem adicionado à lista pendente.");
            } else {
                toast.info("Nenhuma alteração detectada no item pendente.");
            }
            
            // Manter campos de contexto e trecho
            setFormData(prev => ({
                ...prev,
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                dias_operacao: prev.dias_operacao,
                fase_atividade: prev.fase_atividade,
                quantidade_passagens: prev.quantidade_passagens,
                
                // Manter dados do trecho
                om_detentora: prev.om_detentora,
                ug_detentora: prev.ug_detentora,
                diretriz_id: prev.diretriz_id,
                trecho_id: prev.trecho_id,
                origem: prev.origem,
                destino: prev.destino,
                tipo_transporte: prev.tipo_transporte,
                is_ida_volta: prev.is_ida_volta,
                valor_unitario: prev.valor_unitario,
                trecho_selecionado: prev.trecho_selecionado,
            }));
            
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
        
        saveMutation.mutate(pendingPassagens);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        updateMutation.mutate(stagedUpdate);
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
    
    const handleFaseAtividadeChange = (fase: string) => {
        setFormData(prev => ({
            ...prev,
            fase_atividade: fase,
        }));
    };
    
    // --- Lógica de Seleção de Trecho (Callback do Dialog) ---
    const handleTrechoSelected = (trecho: {
        om_detentora: string;
        ug_detentora: string;
        diretriz_id: string;
        trecho_id: string;
        origem: string;
        destino: string;
        tipo_transporte: TipoTransporte;
        is_ida_volta: boolean;
        valor_unitario: number;
    }) => {
        // Atualiza o formulário com os dados do trecho selecionado
        setFormData(prev => ({
            ...prev,
            om_detentora: trecho.om_detentora,
            ug_detentora: trecho.ug_detentora,
            diretriz_id: trecho.diretriz_id,
            trecho_id: trecho.trecho_id,
            origem: trecho.origem,
            destino: trecho.destino,
            tipo_transporte: trecho.tipo_transporte,
            is_ida_volta: trecho.is_ida_volta,
            valor_unitario: trecho.valor_unitario,
            trecho_selecionado: true,
            
            // Se estiver editando, precisamos garantir que a quantidade não seja zero
            quantidade_passagens: prev.quantidade_passagens > 0 ? prev.quantidade_passagens : 1,
        }));
        
        // Atualiza o ID da OM Detentora para o seletor de OM (apenas para fins de visualização)
        const omDetentora = oms?.find(om => om.nome_om === trecho.om_detentora && om.codug_om === trecho.ug_detentora);
        setSelectedOmDetentoraId(omDetentora?.id);
        
        toast.success(`Trecho ${trecho.origem} -> ${trecho.destino} selecionado.`);
    };
    
    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (registro: PassagemRegistroDB) => {
        setEditingMemoriaId(registro.id);
        
        // 1. Gerar a memória automática
        const calculatedData: PassagemRegistro = {
            organizacao: registro.organizacao,
            ug: registro.ug,
            om_detentora: registro.om_detentora,
            ug_detentora: registro.ug_detentora,
            dias_operacao: registro.dias_operacao,
            fase_atividade: registro.fase_atividade || "",
            
            diretriz_id: registro.diretriz_id,
            trecho_id: registro.trecho_id,
            origem: registro.origem,
            destino: registro.destino,
            tipo_transporte: registro.tipo_transporte,
            is_ida_volta: registro.is_ida_volta,
            valor_unitario: registro.valor_unitario,
            
            quantidade_passagens: registro.quantidade_passagens,
            valor_total: registro.valor_total,
            valor_nd_33: registro.valor_nd_33,
        } as PassagemRegistro;
        
        const memoriaAutomatica = generatePassagemMemoriaCalculo(calculatedData);
        
        // 2. Usar a customizada se existir, senão usar a automática
        setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            const { error } = await supabase
                .from("passagem_registros")
                .update({
                    detalhamento_customizado: memoriaEdit.trim() || null, 
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
    
    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedPassagem[]) => {
            if (recordsToSave.length === 0) return;
            
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                
                const dbRecord: TablesInsert<'passagem_registros'> = {
                    ...rest,
                    organizacao: om_favorecida, 
                    ug: ug_favorecida, 
                    detalhamento: "Passagens", 
                    detalhamento_customizado: rest.detalhamento_customizado, 
                } as TablesInsert<'passagem_registros'>;
                
                return dbRecord;
            });
            
            const { data, error } = await supabase
                .from("passagem_registros")
                .insert(dbRecords)
                .select('*')
                .order('created_at', { ascending: false }); 
            
            if (error) throw error;
            return data;
        },
        onSuccess: (newRecords) => {
            queryClient.invalidateQueries({ queryKey: ["passagemRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingPassagens.length} registro(s) de Passagem adicionado(s).`);
            setPendingPassagens([]); 
            setLastStagedFormData(null); 
            
            if (newRecords && newRecords.length > 0) {
                handleEdit(newRecords[0] as PassagemRegistroDB);
            } else {
                resetForm();
            }
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedPassagem) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            
            const dbUpdateData: TablesUpdate<'passagem_registros'> = {
                ...rest,
                organizacao: om_favorecida, 
                ug: ug_favorecida, 
                detalhamento: "Passagens", 
                detalhamento_customizado: rest.detalhamento_customizado, 
            } as TablesUpdate<'passagem_registros'>;
            
            const { error } = await supabase
                .from("passagem_registros")
                .update(dbUpdateData)
                .eq("id", editingId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["passagemRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Registro de Passagem atualizado com sucesso!`);
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
                .from("passagem_registros")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["passagemRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registro de Passagem excluído com sucesso!");
            setRegistroToDelete(null);
            setShowDeleteDialog(false);
            resetForm(); 
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isLoadingDefaultYear;

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
                            formData.fase_atividade.length > 0;

    // Verifica se os campos numéricos da Solicitação estão preenchidos
    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.quantidade_passagens > 0 &&
                                    formData.trecho_selecionado;

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    // Lógica para a Seção 3
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingPassagens;
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
                            Aquisição de Passagens (ND 33)
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
                                    {/* OM FAVORECIDA (OM do PTrab) */}
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
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR ITEM (SELEÇÃO DE TRECHO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Passagem
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação (Dias e Quantidade) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período e Quantidade</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                            <Label htmlFor="quantidade_passagens">Quantidade de Passagens *</Label>
                                                            <Input
                                                                id="quantidade_passagens"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 10"
                                                                value={formData.quantidade_passagens === 0 ? "" : formData.quantidade_passagens}
                                                                onChange={(e) => setFormData({ ...formData, quantidade_passagens: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Detalhes da Passagem (Seleção de Trecho) */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="font-semibold text-base mb-4">
                                                Trecho e Contrato
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
                                                    {formData.trecho_selecionado ? "Alterar Trecho Selecionado" : "Selecionar Trecho de Contrato *"}
                                                </Button>
                                                
                                                {formData.trecho_selecionado && (
                                                    <div className="border p-3 rounded-md space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium">Trecho:</span>
                                                            <span>{formData.origem} &rarr; {formData.destino}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium">Tipo / Modalidade:</span>
                                                            <span>{formData.tipo_transporte} ({formData.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'})</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium">Valor Unitário:</span>
                                                            <span className="font-bold text-primary">{formatCurrency(formData.valor_unitario)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm border-t pt-1 mt-1">
                                                            <span className="font-medium">OM Contratante:</span>
                                                            <span className="text-muted-foreground">{formData.om_detentora} ({formatCodug(formData.ug_detentora)})</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                <span className="font-bold text-sm">VALOR TOTAL:</span>
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
                                    
                                    {/* Alerta de Validação Final */}
                                    {isStagingUpdate && isPassagemDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND33 = item.valor_nd_33;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const passagemText = item.quantidade_passagens === 1 ? 'passagem' : 'passagens'; 

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
                                                                Passagens ({item.origem} &rarr; {item.destino})
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
                                                                <p className="font-medium">OM Contratante:</p>
                                                                <p className="font-medium">Quantidade / Dias:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className="font-medium">{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                                <p className="font-medium">{item.quantidade_passagens} {passagemText} / {item.dias_operacao} {diasText}</p>
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
                                                VALOR TOTAL DA OM
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(isStagingUpdate ? stagedUpdate!.totalGeral : totalPendingPassagens)}
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
                                                    disabled={isSaving || isPassagemDirty} 
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
                                                    onClick={handleSavePendingPassagens}
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
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({registros.length})
                                    </h3>
                                    
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                                        const totalOM = omRegistros.reduce((sum, r) => Number(r.valor_total) + sum, 0);
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
                                                        const totalSolicitado = Number(registro.valor_total || 0);
                                                        const totalND33 = Number(registro.valor_nd_33 || 0);
                                                        
                                                        const diasText = registro.dias_operacao === 1 ? 'dia' : 'dias';
                                                        const passagemText = registro.quantidade_passagens === 1 ? 'passagem' : 'passagens';
                                                        
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
                                                                                Passagens ({registro.origem} &rarr; {registro.destino})
                                                                            </h4>
                                                                            {registro.fase_atividade !== omRegistros[0].fase_atividade && (
                                                                                <Badge variant="outline" className="text-xs">
                                                                                    {registro.fase_atividade}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {registro.quantidade_passagens} {passagemText} | {registro.dias_operacao} {diasText}
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
                                                                                disabled={!isPTrabEditable || isSaving || pendingPassagens.length > 0}
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
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-muted-foreground">OM Contratante:</span>
                                                                        <span className="font-medium">
                                                                            {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">ND 33.90.33 (Passagens):</span>
                                                                        <span className="font-medium text-green-600">{formatCurrency(totalND33)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs font-bold pt-1">
                                                                        <span className="text-muted-foreground">Valor Unitário:</span>
                                                                        <span className="text-foreground">{formatCurrency(registro.valor_unitario)}</span>
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
                                        
                                        let hasCustomMemoria = !!registro.detalhamento_customizado;
                                        
                                        // 1. Gerar a memória automática
                                        const calculatedDataForMemoria: PassagemRegistro = {
                                            organizacao: registro.organizacao,
                                            ug: registro.ug,
                                            om_detentora: registro.om_detentora,
                                            ug_detentora: registro.ug_detentora,
                                            dias_operacao: registro.dias_operacao,
                                            fase_atividade: registro.fase_atividade || "",
                                            
                                            diretriz_id: registro.diretriz_id,
                                            trecho_id: registro.trecho_id,
                                            origem: registro.origem,
                                            destino: registro.destino,
                                            tipo_transporte: registro.tipo_transporte,
                                            is_ida_volta: registro.is_ida_volta,
                                            valor_unitario: registro.valor_unitario,
                                            
                                            quantidade_passagens: registro.quantidade_passagens,
                                            valor_total: registro.valor_total,
                                            valor_nd_33: registro.valor_nd_33,
                                        } as PassagemRegistro;
                                        
                                        const memoriaAutomatica = generatePassagemMemoriaCalculo(calculatedDataForMemoria);
                                        
                                        let memoriaExibida = memoriaAutomatica;
                                        if (isEditing) {
                                            memoriaExibida = memoriaEdit;
                                        } else if (hasCustomMemoria) {
                                            memoriaExibida = registro.detalhamento_customizado!;
                                        }
                                        
                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-semibold text-foreground">
                                                                {registro.organizacao} (UG: {formatCodug(registro.ug)}) - {registro.origem} &rarr; {registro.destino}
                                                            </h4>
                                                            {hasCustomMemoria && !isEditing && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Editada manualmente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Plane className="h-4 w-4 text-primary" />
                                                            <span className="text-sm font-medium text-primary">
                                                                Contratante: {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                            </span>
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
                                Tem certeza que deseja excluir o registro de Passagem para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>? Esta ação é irreversível.
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
                
                {/* Diálogo de Seleção de Trecho */}
                <PassagemTrechoSelectorDialog
                    open={showTrechoSelector}
                    onOpenChange={setShowTrechoSelector}
                    onSelect={handleTrechoSelected}
                    selectedYear={selectedYear}
                />
            </div>
        </div>
    );
};

export default PassagemForm;