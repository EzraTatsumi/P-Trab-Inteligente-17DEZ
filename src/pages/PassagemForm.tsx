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
    // Novo: Armazena os trechos selecionados para recálculo/display
    selected_trechos: TrechoSelection[];
}

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
    const multiplier = trecho.is_ida_volta ? 2 : 1;
    
    // Adicionando verificação defensiva para garantir que os valores são numéricos
    const valorUnitario = Number(trecho.valor_unitario || 0);
    const quantidade = Number(trecho.quantidade_passagens || 0);
    
    // Usa valor_unitario que é o valor do trecho
    return valorUnitario * quantidade * multiplier; 
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

// NOVO: Função auxiliar para realizar o cálculo completo
const calculatePassagemData = (formData: PassagemFormState, ptrabData: PTrabData | undefined) => {
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
        let memoria = "";
        
        formData.selected_trechos.forEach((trecho, index) => {
            // 1. Calcular o total do trecho
            const totalTrecho = calculateTrechoTotal(trecho);
            
            totalGeral += totalTrecho;
            totalND33 += totalTrecho; // ND 33.90.33 é o único para passagens
            
            // 2. Gerar memória para o trecho
            const calculatedFormData: PassagemFormType = {
                om_favorecida: formData.om_favorecida, 
                ug_favorecida: formData.ug_favorecida, 
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                
                // Dados do Trecho Selecionado
                om_detentora: trecho.om_detentora,
                ug_detentora: trecho.ug_detentora,
                diretriz_id: trecho.diretriz_id,
                trecho_id: trecho.id, // Usar 'id' do trecho
                origem: trecho.origem,
                destino: trecho.destino,
                tipo_transporte: trecho.tipo_transporte,
                is_ida_volta: trecho.is_ida_volta,
                valor_unitario: trecho.valor_unitario,
                
                // Quantidade
                quantidade_passagens: trecho.quantidade_passagens,
                efetivo: formData.efetivo,
            };

            memoria += `--- Trecho ${index + 1}: ${trecho.origem} -> ${trecho.destino} ---\n`;
            memoria += generatePassagemMemoriaCalculo({
                ...calculatedFormData,
                valor_total: totalTrecho,
                valor_nd_33: totalTrecho,
            } as PassagemRegistro);
            memoria += "\n";
        });
        
        memoria += `\n==================================================\n`;
        memoria += `TOTAL GERAL SOLICITADO: ${formatCurrency(totalGeral)}\n`;
        memoria += `Efetivo: ${formData.efetivo} militares\n`;
        memoria += `==================================================\n`;
        
        return {
            totalGeral,
            totalND33,
            memoria,
        };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
        console.error("Erro em calculatePassagemData:", e);
        return {
            totalGeral: 0,
            totalND33: 0,
            memoria: `Erro ao calcular: ${errorMessage}`,
        };
    }
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
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
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
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    // 1. Mutation for saving multiple new records
    const saveMutation = useMutation({
        mutationFn: async (newRecords: CalculatedPassagem[]) => {
            const recordsToInsert: TablesInsert<'passagem_registros'>[] = newRecords.map(r => ({
                p_trab_id: r.p_trab_id,
                organizacao: r.organizacao,
                ug: r.ug,
                om_detentora: r.om_detentora,
                ug_detentora: r.ug_detentora,
                dias_operacao: r.dias_operacao,
                fase_atividade: r.fase_atividade,
                diretriz_id: r.diretriz_id,
                trecho_id: r.trecho_id, 
                origem: r.origem,
                destino: r.destino,
                tipo_transporte: r.tipo_transporte,
                is_ida_volta: r.is_ida_volta,
                valor_unitario: r.valor_unitario,
                quantidade_passagens: r.quantidade_passagens,
                valor_total: r.valor_total,
                valor_nd_33: r.valor_nd_33,
                detalhamento: r.detalhamento,
                detalhamento_customizado: r.detalhamento_customizado,
                efetivo: r.efetivo,
             }));

            const { error } = await supabase
                .from('passagem_registros')
                .insert(recordsToInsert);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registros de Passagens salvos com sucesso!");
            setPendingPassagens([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['passagemRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros.", { description: sanitizeError(error) });
        }
    });

    // 2. Mutation for updating a single existing record
    const updateMutation = useMutation({
        mutationFn: async (updatedRecord: CalculatedPassagem) => {
            if (!updatedRecord.tempId) throw new Error("ID do registro para atualização ausente.");

            const recordToUpdate: TablesUpdate<'passagem_registros'> = {
                organizacao: updatedRecord.organizacao,
                ug: updatedRecord.ug,
                om_detentora: updatedRecord.om_detentora,
                ug_detentora: updatedRecord.ug_detentora,
                dias_operacao: updatedRecord.dias_operacao,
                fase_atividade: updatedRecord.fase_atividade,
                diretriz_id: updatedRecord.diretriz_id,
                trecho_id: updatedRecord.trecho_id,
                origem: updatedRecord.origem,
                destino: updatedRecord.destino,
                tipo_transporte: updatedRecord.tipo_transporte,
                is_ida_volta: updatedRecord.is_ida_volta,
                valor_unitario: updatedRecord.valor_unitario,
                quantidade_passagens: updatedRecord.quantidade_passagens,
                valor_total: updatedRecord.valor_total,
                valor_nd_33: updatedRecord.valor_nd_33,
                detalhamento: updatedRecord.detalhamento,
                detalhamento_customizado: updatedRecord.detalhamento_customizado,
                efetivo: updatedRecord.efetivo,
            };

            const { error } = await supabase
                .from('passagem_registros')
                .update(recordToUpdate)
                .eq('id', updatedRecord.tempId);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro de Passagem atualizado com sucesso!");
            setEditingId(null);
            setStagedUpdate(null);
            queryClient.invalidateQueries({ queryKey: ['passagemRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => {
            toast.error("Falha ao atualizar registro.", { description: sanitizeError(error) });
        }
    });

    // 3. Mutation for deleting a record
    const handleDeleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('passagem_registros')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro de Passagem excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['passagemRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setRegistroToDelete(null);
        },
        onError: (error) => {
            toast.error("Falha ao excluir registro.", { description: sanitizeError(error) });
        }
    });
    
    // Efeito de inicialização da OM Favorecida e OM Destino
    useEffect(() => {
        if (ptrabData && !editingId) {
            // Modo Novo Registro: Limpar
            setFormData(prev => ({
                ...prev,
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
    
    // REMOVIDO: useEffect de preenchimento automático da OM Destino (substituído pela lógica no handler)

    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    const calculos = useMemo(() => {
        return calculatePassagemData(formData, ptrabData);
    }, [formData, ptrabData]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate ou lastStagedFormData)
    const isPassagemDirty = useMemo(() => {
        // MODO EDIÇÃO: Compara com stagedUpdate
        if (editingId && stagedUpdate) {
            // Reconstruir o estado do formulário a partir do stagedUpdate
            const stagedFormData: PassagemFormState = {
                om_favorecida: stagedUpdate.organizacao,
                ug_favorecida: stagedUpdate.ug,
                om_destino: stagedUpdate.om_detentora || '', // Usar om_detentora como om_destino
                ug_destino: stagedUpdate.ug_detentora || '', // Usar ug_detentora como ug_destino
                dias_operacao: stagedUpdate.dias_operacao,
                efetivo: stagedUpdate.efetivo || 0, 
                fase_atividade: stagedUpdate.fase_atividade || '',
                selected_trechos: stagedUpdate.selected_trechos,
            };
            
            return compareFormData(formData, stagedFormData);
        }
        
        // MODO NOVO REGISTRO: Compara com lastStagedFormData
        if (!editingId && pendingPassagens.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [editingId, stagedUpdate, formData, pendingPassagens.length, lastStagedFormData]);
    
    // CORREÇÃO: Usar item.totalGeral em vez de item.valor_total
    const totalPendingPassagens = useMemo(() => {
        return pendingPassagens.reduce((sum, item) => sum + item.totalGeral, 0);
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
        resetForm();
    };

    const handleEdit = (registro: PassagemRegistroDB) => {
        if (pendingPassagens.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        // 1. Configurar OM Favorecida e OM Destino
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        // 2. Reconstruir a lista de trechos selecionados a partir dos dados do registro
        const trechoFromRecord: TrechoSelection = {
            id: registro.trecho_id, // Usar trecho_id como id
            diretriz_id: registro.diretriz_id,
            om_detentora: registro.om_detentora,
            ug_detentora: registro.ug_detentora,
            origem: registro.origem,
            destino: registro.destino,
            tipo_transporte: registro.tipo_transporte as TipoTransporte,
            is_ida_volta: registro.is_ida_volta,
            valor_unitario: Number(registro.valor_unitario || 0),
            quantidade_passagens: registro.quantidade_passagens,
            valor: Number(registro.valor_unitario || 0), // Adiciona 'valor' para compatibilidade com TrechoPassagem
        };

        // 3. Populate formData
        const newFormData: PassagemFormState = {
            om_favorecida: registro.organizacao, 
            ug_favorecida: registro.ug, 
            om_destino: registro.om_detentora,
            ug_destino: registro.ug_detentora,
            dias_operacao: registro.dias_operacao,
            efetivo: registro.efetivo || 0, // Usar o campo efetivo
            fase_atividade: registro.fase_atividade || "",
            selected_trechos: [trechoFromRecord], // Usamos apenas o trecho do registro para edição
        };
        setFormData(newFormData);
        
        // 4. Calculate totals and generate memory (USANDO A FUNÇÃO AUXILIAR COM newFormData)
        const { totalGeral, totalND33, memoria } = calculatePassagemData(newFormData, ptrabData);
        
        // 5. Stage the current record data immediately for display in Section 3
        const stagedData: CalculatedPassagem = {
            tempId: registro.id,
            p_trab_id: ptrabId!,
            organizacao: newFormData.om_favorecida, 
            ug: newFormData.ug_favorecida, 
            dias_operacao: newFormData.dias_operacao,
            efetivo: newFormData.efetivo,
            fase_atividade: newFormData.fase_atividade,
            
            // Campos de Trecho (usamos o primeiro trecho para preencher os campos DB legados)
            om_detentora: trechoFromRecord.om_detentora,
            ug_detentora: trechoFromRecord.ug_detentora,
            diretriz_id: trechoFromRecord.diretriz_id,
            trecho_id: trechoFromRecord.id, // Usar id do trecho
            origem: trechoFromRecord.origem,
            destino: trechoFromRecord.destino,
            tipo_transporte: trechoFromRecord.tipo_transporte,
            is_ida_volta: trechoFromRecord.is_ida_volta,
            valor_unitario: trechoFromRecord.valor_unitario,
            quantidade_passagens: trechoFromRecord.quantidade_passagens,
            
            valor_total: totalGeral, // Este é o campo que será salvo no DB
            valor_nd_33: totalND33,
            
            detalhamento: registro.detalhamento,
            detalhamento_customizado: registro.detalhamento_customizado, 
            
            totalGeral: totalGeral, // Este é o campo usado para exibição local
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
            selected_trechos: newFormData.selected_trechos, // Adiciona a lista de trechos
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
            
            // 2. Calcular totais e memória (já feito no useMemo)
            const { totalGeral, totalND33, memoria } = calculos;
            
            // 3. Preparar o objeto final (calculatedData)
            
            // Para fins de salvamento no DB (que ainda espera um único registro por linha),
            // vamos criar um registro que representa o total da solicitação, usando os dados
            // do PRIMEIRO trecho para preencher os campos obrigatórios de FK/detalhe.
            const firstTrecho = formData.selected_trechos[0];

            const calculatedData: CalculatedPassagem = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                dias_operacao: formData.dias_operacao,
                efetivo: formData.efetivo, // NOVO CAMPO
                fase_atividade: formData.fase_atividade,
                
                // Campos de Trecho (usamos o primeiro trecho para preencher os campos DB legados)
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                diretriz_id: firstTrecho.diretriz_id,
                trecho_id: firstTrecho.id, // Usar id do trecho
                origem: firstTrecho.origem,
                destino: firstTrecho.destino,
                tipo_transporte: firstTrecho.tipo_transporte,
                is_ida_volta: firstTrecho.is_ida_volta,
                valor_unitario: firstTrecho.valor_unitario,
                quantidade_passagens: totalPassagens, // Total de passagens
                
                valor_total: totalGeral,
                valor_nd_33: totalND33,
                
                detalhamento: "Passagens", // Marcador
                detalhamento_customizado: null, 
                
                totalGeral: totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                selected_trechos: formData.selected_trechos, // Salva a lista completa
            } as CalculatedPassagem;
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                
                // Preserva a memória customizada se existir
                let memoriaCustomizadaTexto: string | null = null;
                try {
                    // Tenta parsear como JSON (se for o formato antigo)
                    JSON.parse(originalRecord?.detalhamento_customizado || "");
                } catch (e) {
                    // Se falhar, é um texto simples (o que queremos)
                    memoriaCustomizadaTexto = originalRecord?.detalhamento_customizado || null;
                }
                
                calculatedData.detalhamento_customizado = memoriaCustomizadaTexto;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            
            const shouldStageNewItem = pendingPassagens.length === 0 || compareFormData(formData, lastStagedFormData || initialFormState);

            if (shouldStageNewItem) {
                setPendingPassagens(prev => {
                    // Se estivermos no modo de adição e o formulário mudou, adiciona um novo item.
                    // Se o formulário não mudou, apenas atualiza o último item (se houver).
                    if (pendingPassagens.length > 0 && !compareFormData(formData, lastStagedFormData || initialFormState)) {
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
                om_destino: prev.om_destino,
                ug_destino: prev.ug_destino,
                dias_operacao: prev.dias_operacao,
                efetivo: prev.efetivo,
                fase_atividade: prev.fase_atividade,
                selected_trechos: prev.selected_trechos,
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
    
    const handleIniciarEdicaoMemoria = (registro: PassagemRegistroDB) => {
        setEditingMemoriaId(registro.id);
        
        // 1. Reconstruir o TrechoSelection para gerar a memória automática
        const trechoFromRecord: TrechoSelection = {
            id: registro.trecho_id, // Usar trecho_id como id
            om_detentora: registro.om_detentora,
            ug_detentora: registro.ug_detentora,
            diretriz_id: registro.diretriz_id,
            origem: registro.origem,
            destino: registro.destino,
            tipo_transporte: registro.tipo_transporte as TipoTransporte,
            is_ida_volta: registro.is_ida_volta,
            valor_unitario: Number(registro.valor_unitario || 0),
            quantidade_passagens: registro.quantidade_passagens,
            valor: Number(registro.valor_unitario || 0), // Adiciona 'valor' para compatibilidade com TrechoPassagem
        };
        
        // 2. Gerar a memória automática (usando a lógica de cálculo de múltiplos trechos, mas com apenas 1 trecho)
        const calculatedDataForMemoria: PassagemFormState = {
            om_favorecida: registro.organizacao,
            ug_favorecida: registro.ug,
            om_destino: registro.om_detentora,
            ug_destino: registro.ug_detentora,
            dias_operacao: registro.dias_operacao,
            efetivo: registro.efetivo || 0,
            fase_atividade: registro.fase_atividade || "",
            selected_trechos: [trechoFromRecord],
        };
        
        // Nota: Para registros antigos, o cálculo é feito com base no único trecho salvo.
        const { memoria: memoriaAutomatica } = calculatePassagemData(calculatedDataForMemoria, ptrabData);
        
        // 3. Usar a customizada se existir, senão usar a automática
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
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isLoadingDefaultYear;
    const isSaving = saveMutation.isPending || updateMutation.isPending || handleDeleteMutation.isPending;

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
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingPassagens;
    const isStagingUpdate = !!stagedUpdate;
    
    // Trechos iniciais para o diálogo (se estiver editando)
    const initialTrechosForDialog = editingId && stagedUpdate 
        ? stagedUpdate.selected_trechos 
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
                                            const totalPassagens = item.selected_trechos.reduce((sum, t) => sum + t.quantidade_passagens, 0);
                                            const passagemText = totalPassagens === 1 ? 'passagem' : 'passagens'; 

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
                                                                Passagens (Total de {item.selected_trechos.length} Trecho(s))
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
                                                                <p className="font-medium">Efetivo:</p>
                                                                <p className="font-medium">Total Passagens / Dias:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className="font-medium">{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                                <p className="font-medium">{item.efetivo} militares</p>
                                                                <p className="font-medium">{totalPassagens} {passagemText} / {item.dias_operacao} {diasText}</p>
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

                            {/* SEÇÃO 4: REGISTROS SALVOS */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        4. Registros Salvos ({registros.length})
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => (
                                            <Card key={omKey} className="border-2 border-border">
                                                <CardHeader className="py-3 px-4 bg-muted/50">
                                                    <CardTitle className="text-sm font-bold text-foreground">
                                                        OM Favorecida: {omKey}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[150px]">Trecho</TableHead>
                                                                <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                                                <TableHead className="w-[150px] text-center">OM Recurso</TableHead>
                                                                <TableHead className="w-[100px] text-center">Dias</TableHead>
                                                                <TableHead className="w-[100px] text-center">Efetivo</TableHead>
                                                                <TableHead className="text-right">Valor (ND 33)</TableHead>
                                                                <TableHead className="w-[100px] text-center">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {omRegistros.map(registro => (
                                                                <TableRow key={registro.id} className={cn(editingId === registro.id && "bg-yellow-50/50")}>
                                                                    <TableCell className="text-xs font-medium">
                                                                        {registro.origem} &rarr; {registro.destino}
                                                                        <p className="text-muted-foreground text-[10px] mt-0.5">
                                                                            {registro.tipo_transporte} ({registro.is_ida_volta ? 'I/V' : 'Ida'})
                                                                        </p>
                                                                    </TableCell>
                                                                    <TableCell className="text-center font-medium">
                                                                        {registro.quantidade_passagens}
                                                                    </TableCell>
                                                                    <TableCell className="text-center text-xs">
                                                                        {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                    </TableCell>
                                                                    <TableCell className="text-center font-medium">
                                                                        {registro.dias_operacao}
                                                                    </TableCell>
                                                                    <TableCell className="text-center font-medium">
                                                                        {registro.efetivo}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-bold text-green-600">
                                                                        {formatCurrency(registro.valor_nd_33)}
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex justify-center gap-1">
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                onClick={() => handleEdit(registro)}
                                                                                disabled={!isPTrabEditable || isSaving}
                                                                            >
                                                                                <Edit className="h-4 w-4 text-blue-600" />
                                                                            </Button>
                                                                            <Button 
                                                                                variant="ghost" 
                                                                                size="icon" 
                                                                                onClick={() => handleConfirmDelete(registro)}
                                                                                disabled={!isPTrabEditable || isSaving}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        ))}
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
                                        
                                        let hasCustomMemoria = !!registro.detalhamento_customizado;
                                        
                                        // 1. Reconstruir o TrechoSelection para gerar a memória automática
                                        const trechoFromRecord: TrechoSelection = {
                                            id: registro.trecho_id, // Usar trecho_id como id
                                            om_detentora: registro.om_detentora,
                                            ug_detentora: registro.ug_detentora,
                                            diretriz_id: registro.diretriz_id,
                                            origem: registro.origem,
                                            destino: registro.destino,
                                            tipo_transporte: registro.tipo_transporte as TipoTransporte,
                                            is_ida_volta: registro.is_ida_volta,
                                            valor_unitario: Number(registro.valor_unitario || 0),
                                            quantidade_passagens: registro.quantidade_passagens,
                                            valor: Number(registro.valor_unitario || 0), // Adiciona 'valor' para compatibilidade com TrechoPassagem
                                        };
                                        
                                        // 2. Gerar a memória automática (usando a lógica de cálculo de múltiplos trechos, mas com apenas 1 trecho)
                                        const calculatedDataForMemoria: PassagemFormState = {
                                            om_favorecida: registro.organizacao,
                                            ug_favorecida: registro.ug,
                                            om_destino: registro.om_detentora,
                                            ug_destino: registro.ug_detentora,
                                            dias_operacao: registro.dias_operacao,
                                            efetivo: registro.efetivo || 0,
                                            fase_atividade: registro.fase_atividade || "",
                                            selected_trechos: [trechoFromRecord],
                                        };
                                        
                                        // Nota: Para registros antigos, o cálculo é feito com base no único trecho salvo.
                                        const { memoria: memoriaAutomatica } = calculatePassagemData(calculatedDataForMemoria, ptrabData);
                                        
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
                                                                OM Destino: {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
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
                    initialSelections={initialTrechosForDialog}
                />
            </div>
        </div>
    );
};

export default PassagemForm;