import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Pencil, Sparkles, AlertCircle, Check, Plane, Minus, XCircle } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatCurrencyInput, numberToRawDigits, formatNumber } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    calculateHorasVooTotals, 
    generateHorasVooMemoriaCalculo,
    HorasVooRegistro,
    ConsolidatedHorasVooRecord,
    generateConsolidatedHorasVooMemoriaCalculo,
    HorasVooForm as HorasVooFormType,
} from "@/lib/horasVooUtils";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import CurrencyInput from "@/components/CurrencyInput";
import { ConsolidatedHorasVooMemoria } from "@/components/ConsolidatedHorasVooMemoria"; 
import { TipoAnvSelect } from "@/components/TipoAnvSelect";
import { Switch } from "@/components/ui/switch";

// Tipos de dados
type HorasVooRegistroDB = Tables<'horas_voo_registros'>; 

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
interface CalculatedHorasVoo extends TablesInsert<'horas_voo_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
}

// Tipo para o registro consolidado (lote)
interface ConsolidatedHorasVoo extends ConsolidatedHorasVooRecord {
    groupKey: string;
}

// Estado inicial para o formulário
interface HorasVooFormState extends HorasVooFormType {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; // OM Detentora
    ug_destino: string; // UG Detentora
    dias_operacao: number;
    fase_atividade: string;
    isCoterResponsibility: boolean;
}

const initialFormState: HorasVooFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    fase_atividade: "",
    isCoterResponsibility: true,
    
    // Campos específicos de HV
    codug_destino: "DMAvEx/COLOG Gestor (160.504)",
    municipio: "",
    quantidade_hv: 0,
    tipo_anv: "",
    amparo: "Tudo conforme o DIEx nº 972-DMAvEx/COLOG, de 16 de dezembro de 2022, do Subcomandante Logístico versando sobre o valor da hora de voo para o ano de 2023. O valor foi convertido para REAIS utilizando-se da cotação do dólar (PTAX do DÓLAR).",
    valor_nd_30: 0,
    valor_nd_39: 0,
};

// Helper function to compare form data structures
const compareFormData = (data1: HorasVooFormState, data2: HorasVooFormState) => {
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_destino !== data2.om_destino ||
        data1.ug_destino !== data2.ug_destino ||
        data1.fase_atividade !== data2.fase_atividade ||
        data1.isCoterResponsibility !== data2.isCoterResponsibility ||
        data1.codug_destino !== data2.codug_destino ||
        data1.municipio !== data2.municipio ||
        data1.quantidade_hv !== data2.quantidade_hv ||
        data1.tipo_anv !== data2.tipo_anv ||
        data1.amparo !== data2.amparo ||
        data1.valor_nd_30 !== data2.valor_nd_30 ||
        data1.valor_nd_39 !== data2.valor_nd_39
    ) {
        return true;
    }
    return false;
};

const HorasVooForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<HorasVooFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<HorasVooRegistroDB | null>(null);
    
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedHorasVoo | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedHorasVoo | null>(null); 
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    const [pendingRegistros, setPendingRegistros] = useState<CalculatedHorasVoo[]>([]);
    const [lastStagedFormData, setLastStagedFormData] = useState<HorasVooFormState | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    const [rawND30Input, setRawND30Input] = useState(numberToRawDigits(initialFormState.valor_nd_30));
    const [rawND39Input, setRawND39Input] = useState(numberToRawDigits(initialFormState.valor_nd_39));
    
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<HorasVooRegistroDB[]>({
        queryKey: ['horasVooRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('horas_voo_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const consolidatedRegistros = useMemo<ConsolidatedHorasVoo[]>(() => {
        if (!registros) return [];

        const groups = registros.reduce((acc, registro) => {
            const key = [
                registro.organizacao,
                registro.ug,
                registro.om_detentora,
                registro.ug_detentora,
                registro.dias_operacao,
                registro.fase_atividade,
            ].join('|');

            if (!acc[key]) {
                acc[key] = {
                    groupKey: key,
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora || '',
                    ug_detentora: registro.ug_detentora || '',
                    dias_operacao: registro.dias_operacao,
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND30: 0,
                    totalND39: 0,
                };
            }

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND30 += Number(registro.valor_nd_30 || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedHorasVoo>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);
    
    const totalHvByGroup = useMemo(() => {
        return consolidatedRegistros.reduce((acc, group) => {
            const totalHv = group.records.reduce((sum, record) => sum + Number(record.quantidade_hv || 0), 0);
            acc[group.groupKey] = totalHv;
            return acc;
        }, {} as Record<string, number>);
    }, [consolidatedRegistros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    const insertMutation = useMutation({
        mutationFn: async (newRecords: CalculatedHorasVoo[]) => {
            const recordsToInsert: TablesInsert<'horas_voo_registros'>[] = newRecords.map(r => ({
                p_trab_id: r.p_trab_id,
                organizacao: r.organizacao,
                ug: r.ug,
                om_detentora: r.om_detentora,
                ug_detentora: r.ug_detentora,
                dias_operacao: r.dias_operacao,
                fase_atividade: r.fase_atividade,
                codug_destino: r.codug_destino,
                municipio: r.municipio,
                quantidade_hv: r.quantidade_hv,
                tipo_anv: r.tipo_anv,
                amparo: r.amparo,
                valor_nd_30: r.valor_nd_30,
                valor_nd_39: r.valor_nd_39,
                valor_total: r.valor_total,
                detalhamento: r.detalhamento,
                detalhamento_customizado: r.detalhamento_customizado,
            }));

            const { error } = await supabase
                .from('horas_voo_registros')
                .insert(recordsToInsert);

            if (error) throw error;
            return recordsToInsert;
        },
        onSuccess: () => {
            toast.success(`Sucesso! ${pendingRegistros.length} registro(s) de Horas de Voo adicionado(s).`);
            setPendingRegistros([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros.", { description: sanitizeError(error) });
        }
    });

    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedHorasVoo[] }) => {
            const { error: deleteError } = await supabase
                .from('horas_voo_registros')
                .delete()
                .in('id', oldIds);
            if (deleteError) throw deleteError;
            
            const recordsToInsert: TablesInsert<'horas_voo_registros'>[] = newRecords.map(r => ({
                p_trab_id: r.p_trab_id,
                organizacao: r.organizacao,
                ug: r.ug,
                om_detentora: r.om_detentora,
                ug_detentora: r.ug_detentora,
                dias_operacao: r.dias_operacao,
                fase_atividade: r.fase_atividade,
                codug_destino: r.codug_destino,
                municipio: r.municipio,
                quantidade_hv: r.quantidade_hv,
                tipo_anv: r.tipo_anv,
                amparo: r.amparo,
                valor_nd_30: r.valor_nd_30,
                valor_nd_39: r.valor_nd_39,
                valor_total: r.valor_total,
                detalhamento: r.detalhamento,
                detalhamento_customizado: r.detalhamento_customizado,
            }));

            const { error: insertError } = await supabase
                .from('horas_voo_registros')
                .insert(recordsToInsert);

            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Lote de Horas de Voo atualizado com sucesso!");
            setEditingId(null);
            setPendingRegistros([]);
            setGroupToReplace(null);
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => {
            toast.error("Falha ao atualizar lote.", { description: sanitizeError(error) });
        }
    });

    const handleDeleteMutation = useMutation({
        mutationFn: async (recordIds: string[]) => {
            const { error } = await supabase
                .from('horas_voo_registros')
                .delete()
                .in('id', recordIds);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote de Horas de Voo excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setRegistroToDelete(null);
            setGroupToDelete(null);
        },
        onError: (error) => {
            toast.error("Falha ao excluir lote.", { description: sanitizeError(error) });
        }
    });
    
    useEffect(() => {
        if (ptrabData && !editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === ptrabData.nome_om && om.codug_om === ptrabData.codug_om);
            
            if (omFavorecida) {
                setSelectedOmFavorecidaId(omFavorecida.id);
                setSelectedOmDestinoId(omFavorecida.id);
                setFormData(prev => ({
                    ...initialFormState,
                    om_favorecida: omFavorecida.nome_om,
                    ug_favorecida: omFavorecida.codug_om,
                    om_destino: omFavorecida.nome_om,
                    ug_destino: omFavorecida.codug_om,
                    dias_operacao: 1,
                }));
            }
        } else if (ptrabData && editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === formData.om_favorecida && om.codug_om === formData.ug_favorecida);
            setSelectedOmFavorecidaId(omFavorecida?.id);
            
            const omDestino = oms?.find(om => om.nome_om === formData.om_destino && om.codug_om === formData.ug_destino);
            setSelectedOmDestinoId(omDestino?.id);
        }
    }, [ptrabData, oms, editingId]);
    
    const handleCurrencyChange = (field: 'valor_nd_30' | 'valor_nd_39', numericValue: number, rawDigits: string) => {
        if (field === 'valor_nd_30') {
            setRawND30Input(rawDigits);
            setFormData(prev => ({ ...prev, valor_nd_30: numericValue }));
        } else {
            setRawND39Input(rawDigits);
            setFormData(prev => ({ ...prev, valor_nd_39: numericValue }));
        }
    };
    
    const calculos = useMemo(() => {
        if (!ptrabId) {
            return {
                totalGeral: 0,
                memoria: "Preencha os dados de solicitação.",
            };
        }
        
        const valor_nd_30 = formData.isCoterResponsibility ? 0 : formData.valor_nd_30;
        const valor_nd_39 = formData.isCoterResponsibility ? 0 : formData.valor_nd_39;

        try {
            const dataForCalculation = { 
                ...formData, 
                dias_operacao: 1,
                valor_nd_30,
                valor_nd_39,
            }; 
            const { valor_total } = calculateHorasVooTotals(dataForCalculation);
            
            const tempRegistro: HorasVooRegistro = {
                id: 'temp',
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                dias_operacao: 1,
                fase_atividade: formData.fase_atividade,
                codug_destino: formData.codug_destino,
                municipio: formData.municipio,
                quantidade_hv: formData.quantidade_hv,
                tipo_anv: formData.tipo_anv,
                amparo: formData.amparo,
                valor_nd_30: valor_nd_30,
                valor_nd_39: valor_nd_39,
                valor_total: valor_total,
                detalhamento: '',
                detalhamento_customizado: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            
            const memoria = generateHorasVooMemoriaCalculo(tempRegistro);
            
            return {
                totalGeral: valor_total,
                memoria,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, ptrabId]);
    
    const isFormDirty = useMemo(() => {
        if (pendingRegistros.length > 0 && lastStagedFormData) {
            const { dias_operacao: d1, ...rest1 } = formData;
            const { dias_operacao: d2, ...rest2 } = lastStagedFormData;
            
            return compareFormData({ ...rest1, dias_operacao: 1 }, { ...rest2, dias_operacao: 1 });
        }
        return false;
    }, [formData, pendingRegistros.length, lastStagedFormData]);
    
    const totalPendingRegistros = useMemo(() => {
        return pendingRegistros.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingRegistros]);
    
    const resetForm = () => {
        setEditingId(null);
        setGroupToReplace(null);
        
        // Limpar seletores de OM para permitir que o useEffect de inicialização 
        // ou a ação do usuário limpe os campos visualmente
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDestinoId(undefined);
        
        setFormData({
            ...initialFormState,
            // Resetar tudo para o estado inicial, incluindo OMs e quantidades
        });
        
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setLastStagedFormData(null); 
        
        // Resetar inputs de moeda
        setRawND30Input(numberToRawDigits(0));
        setRawND39Input(numberToRawDigits(0));
    };
    
    const handleClearPending = () => {
        setPendingRegistros([]);
        setLastStagedFormData(null);
        setEditingId(null);
        setGroupToReplace(null);
    };

    const handleEdit = (group: ConsolidatedHorasVoo) => {
        if (pendingRegistros.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setPendingRegistros([]);
        setLastStagedFormData(null);
        
        setEditingId(group.records[0].id);
        setGroupToReplace(group);
        
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        const firstRecord = group.records[0];
        const isCoter = firstRecord.valor_nd_30 === 0 && firstRecord.valor_nd_39 === 0;

        const newFormData: HorasVooFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            fase_atividade: group.fase_atividade || "",
            isCoterResponsibility: isCoter,
            
            codug_destino: firstRecord.codug_destino,
            municipio: firstRecord.municipio,
            quantidade_hv: firstRecord.quantidade_hv,
            tipo_anv: firstRecord.tipo_anv,
            amparo: firstRecord.amparo || "",
            valor_nd_30: firstRecord.valor_nd_30,
            valor_nd_39: firstRecord.valor_nd_39,
        };
        setFormData(newFormData);
        
        setRawND30Input(numberToRawDigits(firstRecord.valor_nd_30));
        setRawND39Input(numberToRawDigits(firstRecord.valor_nd_39));
        
        const newPendingItems: CalculatedHorasVoo[] = group.records.map(registro => {
            const { valor_total } = calculateHorasVooTotals(registro);
            
            const calculatedFormData: HorasVooRegistro = {
                ...registro,
                valor_total: valor_total,
            };

            let memoria = generateHorasVooMemoriaCalculo(calculatedFormData);
            
            return {
                tempId: registro.id,
                p_trab_id: ptrabId!,
                organizacao: registro.organizacao, 
                ug: registro.ug, 
                dias_operacao: registro.dias_operacao,
                fase_atividade: registro.fase_atividade,
                om_detentora: registro.om_detentora,
                ug_detentora: registro.ug_detentora,
                
                codug_destino: registro.codug_destino,
                municipio: registro.municipio,
                quantidade_hv: registro.quantidade_hv,
                tipo_anv: registro.tipo_anv,
                amparo: registro.amparo,
                valor_nd_30: registro.valor_nd_30,
                valor_nd_39: registro.valor_nd_39,
                
                valor_total: valor_total,
                detalhamento: registro.detalhamento, 
                detalhamento_customizado: registro.detalhamento_customizado, 
                
                totalGeral: valor_total,
                memoria_calculo_display: memoria, 
                om_favorecida: registro.organizacao,
                ug_favorecida: registro.ug,
            } as CalculatedHorasVoo;
        });
        
        setPendingRegistros(newPendingItems);
        setLastStagedFormData(newFormData);
        
        toast.info("Modo Edição ativado. Altere os dados na Seção 2 e clique em 'Recalcular/Revisar Lote'.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedHorasVoo) => {
        setRegistroToDelete(group.records[0]); 
        setGroupToDelete(group);
        setShowDeleteDialog(true);
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const diasOperacao = 1; 
            
            if (formData.quantidade_hv <= 0) {
                throw new Error("A quantidade de Horas de Voo deve ser maior que zero.");
            }
            if (!formData.om_favorecida || !formData.ug_favorecida) {
                throw new Error("A OM Favorecida é obrigatória.");
            }
            if (!formData.om_destino || !formData.ug_destino) {
                throw new Error("A OM Detentora do Recurso é obrigatória (preenchida automaticamente).");
            }
            if (!formData.municipio || !formData.codug_destino || !formData.tipo_anv) {
                throw new Error("Preencha todos os campos de Horas de Voo (Município, CODUG, Tipo Anv).");
            }
            
            if (!formData.isCoterResponsibility && (formData.valor_nd_30 + formData.valor_nd_39 <= 0)) {
                throw new Error("No modo manual, o valor total (ND 30 + ND 39) deve ser maior que zero.");
            }
            
            const valor_nd_30_final = formData.isCoterResponsibility ? 0 : formData.valor_nd_30;
            const valor_nd_39_final = formData.isCoterResponsibility ? 0 : formData.valor_nd_39;

            const dataToCalculate = { 
                ...formData, 
                dias_operacao: diasOperacao,
                valor_nd_30: valor_nd_30_final,
                valor_nd_39: valor_nd_39_final,
            };
            
            const { valor_total } = calculateHorasVooTotals(dataToCalculate);
            
            const calculatedFormData: HorasVooRegistro = {
                id: crypto.randomUUID(),
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                dias_operacao: diasOperacao,
                fase_atividade: formData.fase_atividade,
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                codug_destino: formData.codug_destino,
                municipio: formData.municipio,
                quantidade_hv: formData.quantidade_hv,
                tipo_anv: formData.tipo_anv,
                amparo: formData.amparo,
                valor_nd_30: valor_nd_30_final,
                valor_nd_39: valor_nd_39_final,
                valor_total: valor_total,
                detalhamento: `Horas de Voo (${formData.tipo_anv}) para ${formData.municipio}`, 
                detalhamento_customizado: null, 
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as HorasVooRegistro;

            let memoria = generateHorasVooMemoriaCalculo(calculatedFormData);
            
            const newPendingItem: CalculatedHorasVoo = {
                tempId: crypto.randomUUID(), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                dias_operacao: diasOperacao,
                fase_atividade: formData.fase_atividade,
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                codug_destino: formData.codug_destino,
                municipio: formData.municipio,
                quantidade_hv: formData.quantidade_hv,
                tipo_anv: formData.tipo_anv,
                amparo: formData.amparo,
                valor_nd_30: valor_nd_30_final,
                valor_nd_39: valor_nd_39_final,
                valor_total: valor_total,
                detalhamento: calculatedFormData.detalhamento, 
                detalhamento_customizado: null, 
                totalGeral: valor_total,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
            } as CalculatedHorasVoo;
            
            if (editingId) {
                let memoriaCustomizadaTexto: string | null = null;
                if (groupToReplace) {
                    const originalRecord = groupToReplace.records.find(r => r.id === editingId);
                    if (originalRecord) {
                        memoriaCustomizadaTexto = originalRecord.detalhamento_customizado;
                    }
                }
                
                if (memoriaCustomizadaTexto) {
                    newPendingItem.tempId = editingId; 
                    newPendingItem.detalhamento_customizado = memoriaCustomizadaTexto;
                }
                
                setPendingRegistros([newPendingItem]);
                setLastStagedFormData(formData);
                
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            setPendingRegistros(prev => [...prev, newPendingItem]);
            toast.info(`Item de Horas de Voo adicionado à lista pendente.`);
            setLastStagedFormData(formData);
            
        } catch (err: any) {
            toast.error(err.message || "Erro desconhecido ao calcular.");
        }
    };
    
    const handleSavePendingRegistros = () => {
        if (pendingRegistros.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        insertMutation.mutate(pendingRegistros);
    };
    
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        const oldIds = groupToReplace.records.map(r => r.id);
        replaceGroupMutation.mutate({ oldIds, newRecords: pendingRegistros });
    };
    
    const handleRemovePending = (tempId: string) => {
        setPendingRegistros(prev => {
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
            setSelectedOmDestinoId(omData.id);
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_destino: omData.nome_om,
                ug_destino: omData.codug_om,
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDestinoId(undefined);
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_destino: "",
                ug_destino: "",
            }));
        }
    };
    
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
    
    const handleCoterResponsibilityChange = (checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            isCoterResponsibility: checked,
            valor_nd_30: checked ? 0 : prev.valor_nd_30,
            valor_nd_39: checked ? 0 : prev.valor_nd_39,
        }));
        if (checked) {
            setRawND30Input(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
        }
    };
    
    const handleIniciarEdicaoMemoria = (group: ConsolidatedHorasVoo, memoriaCompleta: string) => {
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
            const { error } = await supabase
                .from("horas_voo_registros")
                .update({
                    detalhamento_customizado: memoriaEdit.trim() || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["horasVooRegistros", ptrabId] });
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
                .from("horas_voo_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["horasVooRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms;
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
    
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.fase_atividade.length > 0;

    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.quantidade_hv > 0 &&
                                    formData.om_destino.length > 0 && 
                                    formData.ug_destino.length > 0 && 
                                    formData.codug_destino.length > 0 &&
                                    formData.municipio.length > 0 &&
                                    formData.tipo_anv.length > 0 &&
                                    (formData.isCoterResponsibility || (formData.valor_nd_30 + formData.valor_nd_39 > 0));

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    const itemsToDisplay = pendingRegistros;
    const isStagingUpdate = !!editingId && pendingRegistros.length > 0;
    
    const totalDisplay = (formData.isCoterResponsibility && calculos.totalGeral === 0) 
        ? "A CARGO DO COTER" 
        : formatCurrency(calculos.totalGeral);

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
                            Horas de Voo (AvEx)
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para custeio de Horas de Voo da Aviação do Exército.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            
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
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingRegistros.length > 0}
                                            initialOmName={editingId ? formData.om_favorecida : ptrabData?.nome_om}
                                            initialOmUg={editingId ? formData.ug_favorecida : ptrabData?.codug_om}
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
                                            disabled={!isPTrabEditable || isSaving || pendingRegistros.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Horas de Voo
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        <Card className="rounded-lg p-4 bg-background">
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                
                                                <div className="col-span-4">
                                                    <h4 className="font-semibold text-base mb-4">
                                                        Detalhes da Solicitação de Horas de Voo
                                                    </h4>
                                                </div>
                                                
                                                <div className="space-y-2 col-span-1">
                                                    <Label htmlFor="codug_destino">OM Gestora (CODUG) *</Label>
                                                    <Input
                                                        id="codug_destino"
                                                        placeholder="OM Gestora (CODUG)"
                                                        value={formData.codug_destino}
                                                        onChange={(e) => setFormData({ ...formData, codug_destino: e.target.value })}
                                                        required
                                                        disabled={!isPTrabEditable || isSaving}
                                                        onKeyDown={handleEnterToNextField}
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2 col-span-2">
                                                    <Label htmlFor="municipio">Município *</Label>
                                                    <Input
                                                        id="municipio"
                                                        placeholder="Ex: Taubaté - SP"
                                                        value={formData.municipio}
                                                        onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                                                        required
                                                        disabled={!isPTrabEditable || isSaving}
                                                        onKeyDown={handleEnterToNextField}
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2 col-span-1">
                                                    <Label htmlFor="tipo_anv">Tipo de Anv *</Label>
                                                    <TipoAnvSelect
                                                        value={formData.tipo_anv}
                                                        onChange={(value) => setFormData({ ...formData, tipo_anv: value })}
                                                        disabled={!isPTrabEditable || isSaving}
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2 col-span-1">
                                                    <Label htmlFor="quantidade_hv">Quantidade de HV *</Label>
                                                    <Input
                                                        id="quantidade_hv"
                                                        type="number"
                                                        min={0.01}
                                                        step={0.01}
                                                        placeholder="Ex: 10.5"
                                                        value={formData.quantidade_hv === 0 ? "" : formData.quantidade_hv}
                                                        onChange={(e) => setFormData({ ...formData, quantidade_hv: parseFloat(e.target.value) || 0 })}
                                                        required
                                                        disabled={!isPTrabEditable || isSaving}
                                                        onKeyDown={handleEnterToNextField}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                </div>
                                                
                                                <div className="space-y-2 col-span-3">
                                                    <Label htmlFor="amparo">Amparo Legal/Diretriz</Label>
                                                    <Input
                                                        id="amparo"
                                                        placeholder="Ex: Portaria 123/2024"
                                                        value={formData.amparo}
                                                        onChange={(e) => setFormData({ ...formData, amparo: e.target.value })}
                                                        disabled={!isPTrabEditable || isSaving}
                                                        onKeyDown={handleEnterToNextField}
                                                    />
                                                </div>
                                                
                                                <div className="col-span-4 grid grid-cols-3 gap-4">
                                                    
                                                    <div className="space-y-2 col-span-1">
                                                        <Label htmlFor="valor_nd_30">Valor ND 33.90.30 *</Label>
                                                        <div className="relative">
                                                            <CurrencyInput
                                                                id="valor_nd_30"
                                                                rawDigits={rawND30Input}
                                                                onChange={(val, dig) => handleCurrencyChange('valor_nd_30', val, dig)}
                                                                placeholder="Ex: R$ 10.000,00"
                                                                required={!formData.isCoterResponsibility}
                                                                disabled={!isPTrabEditable || isSaving || formData.isCoterResponsibility}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                            {formData.isCoterResponsibility && (
                                                                <span className="absolute left-[100px] top-1/2 -translate-y-1/2 text-xs text-red-500 opacity-70 pointer-events-none font-medium">
                                                                    A cargo do COTER
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-2 col-span-1">
                                                        <Label htmlFor="valor_nd_39">Valor ND 33.90.39 *</Label>
                                                        <div className="relative">
                                                            <CurrencyInput
                                                                id="valor_nd_39"
                                                                rawDigits={rawND39Input}
                                                                onChange={(val, dig) => handleCurrencyChange('valor_nd_39', val, dig)}
                                                                placeholder="Ex: R$ 5.000,00"
                                                                required={!formData.isCoterResponsibility}
                                                                disabled={!isPTrabEditable || isSaving || formData.isCoterResponsibility}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                            {formData.isCoterResponsibility && (
                                                                <span className="absolute left-[100px] top-1/2 -translate-y-1/2 text-xs text-red-500 opacity-70 pointer-events-none font-medium">
                                                                    A cargo do COTER
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-2 col-span-1 flex flex-col justify-end">
                                                        <Label className="text-sm font-medium leading-none mb-2">
                                                            Responsável pelo Cálculo dos Custos
                                                        </Label>
                                                        <div className="flex items-center space-x-2 p-2 border rounded-md bg-background">
                                                            <Switch
                                                                id="coter-responsibility"
                                                                checked={formData.isCoterResponsibility}
                                                                onCheckedChange={handleCoterResponsibilityChange}
                                                                disabled={!isPTrabEditable || isSaving}
                                                            />
                                                            <Label htmlFor="coter-responsibility" className="text-sm font-medium leading-none">
                                                                A cargo do COTER
                                                            </Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                        
                                        <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                            <span className="font-bold text-sm">VALOR TOTAL DA SOLICITAÇÃO:</span>
                                            <span className={cn("font-extrabold text-lg", formData.isCoterResponsibility && calculos.totalGeral === 0 ? "text-muted-foreground" : "text-primary")}>
                                                {totalDisplay}
                                            </span>
                                        </div>
                                        
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

                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({itemsToDisplay.length} {itemsToDisplay.length === 1 ? 'item' : 'itens'})
                                    </h3>
                                    
                                    {!editingId && isFormDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {editingId && isFormDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Recalcular/Revisar Lote" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            const isCoter = totalND30 === 0 && totalND39 === 0;

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
                                                                Horas de Voo ({item.tipo_anv})
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-foreground text-right">
                                                                    {isCoter ? "A CARGO DO COTER" : formatCurrency(item.valor_total)}
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
                                                                <p className="font-medium">OM Gestora:</p>
                                                                <p className="font-medium">Qtd HV:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className="font-medium">
                                                                    {item.codug_destino}
                                                                </p>
                                                                <p className="font-medium">{formatNumber(item.quantidade_hv, 2)} h</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.30:</span>
                                                            <span className="font-medium text-green-600">
                                                                {totalND30 === 0 ? (isCoter ? "A cargo do COTER" : formatCurrency(totalND30)) : formatCurrency(totalND30)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.39:</span>
                                                            <span className="font-medium text-green-600">
                                                                {totalND39 === 0 ? (isCoter ? "A cargo do COTER" : formatCurrency(totalND39)) : formatCurrency(totalND39)}
                                                            </span>
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
                                                {totalPendingRegistros === 0 && formData.isCoterResponsibility ? "A CARGO DO COTER" : formatCurrency(totalPendingRegistros)}
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
                                                    disabled={isSaving || isFormDirty} 
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
                                                    onClick={handleSavePendingRegistros}
                                                    disabled={isSaving || pendingRegistros.length === 0 || isFormDirty}
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

                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({consolidatedRegistros.length})
                                    </h3>
                                    
                                    {consolidatedRegistros.map((group) => {
                                        const totalOM = group.totalGeral;
                                        const totalND30Consolidado = group.totalND30;
                                        const totalND39Consolidado = group.totalND39;
                                        const omName = group.organizacao;
                                        const ug = group.ug;
                                        const faseAtividade = group.fase_atividade || 'Não Definida';
                                        const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                                        const isCoter = totalND30Consolidado === 0 && totalND39Consolidado === 0;
                                        const totalHv = totalHvByGroup[group.groupKey] || 0;

                                        return (
                                            <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {omName} (UG: {formatCodug(ug)})
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {isCoter ? "A CARGO DO COTER" : formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    <Card 
                                                        key={group.groupKey} 
                                                        className="p-3 bg-background border"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
                                                                        Horas de Voo ({group.records.length} {group.records.length === 1 ? 'registro' : 'registros'})
                                                                        <Badge variant="outline" className="text-xs font-semibold">{faseAtividade}</Badge>
                                                                    </h4>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Qtd HV Solicitada: {formatNumber(totalHv, 2)} h
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xl text-foreground">
                                                                    {isCoter ? "A CARGO DO COTER" : formatCurrency(totalOM)}
                                                                </span>
                                                                <div className="flex gap-1 shrink-0">
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleEdit(group)}
                                                                        disabled={!isPTrabEditable || isSaving || pendingRegistros.length > 0}
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
                                                        
                                                        <div className="pt-2 border-t mt-2">
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Gestora:</span>
                                                                <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                    {group.records[0].codug_destino}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                <span className="text-green-600">
                                                                    {totalND30Consolidado === 0 ? (isCoter ? "A cargo do COTER" : formatCurrency(totalND30Consolidado)) : formatCurrency(totalND30Consolidado)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.39:</span>
                                                                <span className="text-green-600">
                                                                    {totalND39Consolidado === 0 ? (isCoter ? "A cargo do COTER" : formatCurrency(totalND39Consolidado)) : formatCurrency(totalND39Consolidado)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </section>
                            )}

                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {consolidatedRegistros.map(group => (
                                        <ConsolidatedHorasVooMemoria
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
                
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                <Trash2 className="h-5 w-5" />
                                Confirmar Exclusão de Lote
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o lote de Horas de Voo para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>, contendo {groupToDelete?.records.length} registro(s)? Esta ação é irreversível.
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
            </div>
        </div>
    );
};

export default HorasVooForm;