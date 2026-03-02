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
    om_detentora: DEFAULT_OM_DETENTORA, 
    ug_detentora: DEFAULT_UG_DETENTORA, 
    valor_nd_30: 0, 
    valor_nd_39: 0, 
};

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
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    const [pendingVerbas, setPendingVerbas] = useState<CalculatedVerbaOperacional[]>([]);
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedVerbaOperacional | null>(null);
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    const [rawTotalInput, setRawTotalInput] = useState<string>(numberToRawDigits(0));
    const [rawND30Input, setRawND30Input] = useState<string>(numberToRawDigits(0));
    const [rawND39Input, setRawND39Input] = useState<string>(numberToRawDigits(0));

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
    
    useEffect(() => {
        if (ptrabData && !editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === ptrabData.nome_om && om.codug_om === ptrabData.codug_om);
            setFormData(prev => ({ ...prev, om_favorecida: ptrabData.nome_om, ug_favorecida: ptrabData.codug_om }));
            setSelectedOmFavorecidaId(omFavorecida?.id);
            const cieOm = oms?.find(om => om.nome_om === DEFAULT_OM_DETENTORA && om.codug_om === DEFAULT_UG_DETENTORA);
            if (cieOm) {
                setSelectedOmDetentoraId(cieOm.id);
                setFormData(prev => ({ ...prev, om_detentora: DEFAULT_OM_DETENTORA, ug_detentora: DEFAULT_UG_DETENTORA }));
            }
        }
    }, [ptrabData, oms, editingId]);

    const calculos = useMemo(() => {
        if (!ptrabData) return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: "Preencha todos os campos obrigatórios." };
        try {
            if (formData.dias_operacao <= 0 || formData.quantidade_equipes <= 0 || formData.valor_total_solicitado <= 0 || formData.om_detentora.length === 0) {
                return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: "Preencha todos os campos obrigatórios para calcular." };
            }
            const nd39Value = calculateND39(formData.valor_total_solicitado, formData.valor_nd_30);
            const dataForCalculo = { ...formData, organizacao: formData.om_favorecida, ug: formData.ug_favorecida, valor_nd_30: formData.valor_nd_30, valor_nd_39: nd39Value };
            return {
                ...calculateVerbaOperacionalTotals(dataForCalculo as any),
                memoria: generateVerbaOperacionalMemoriaCalculo(dataForCalculo as any),
            };
        } catch (e) {
            return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: "Erro ao calcular." };
        }
    }, [formData, ptrabData]);
    
    const isVerbaDirty = useMemo(() => {
        if (!editingId || !stagedUpdate) return false;
        return formData.dias_operacao !== stagedUpdate.dias_operacao ||
               formData.quantidade_equipes !== stagedUpdate.quantidade_equipes ||
               !areNumbersEqual(formData.valor_total_solicitado, stagedUpdate.valor_total_solicitado) ||
               !areNumbersEqual(formData.valor_nd_30, stagedUpdate.valor_nd_30) ||
               formData.om_detentora !== stagedUpdate.om_detentora ||
               formData.fase_atividade !== stagedUpdate.fase_atividade;
    }, [editingId, stagedUpdate, formData]);
    
    const totalPendingVerbas = useMemo(() => pendingVerbas.reduce((sum, item) => sum + item.valor_total_solicitado, 0), [pendingVerbas]);
    
    const registrosAgrupadosPorOM = useMemo(() => {
        return registros?.reduce((acc, registro) => {
            const key = `${registro.organizacao} (${registro.ug})`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(registro);
            return acc;
        }, {} as Record<string, VerbaOperacionalRegistro[]>) || {};
    }, [registros]);

    const handleCurrencyChange = (field: keyof typeof initialFormState, rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setFormData(prev => {
            let newTotal = prev.valor_total_solicitado;
            let newND30 = prev.valor_nd_30;
            if (field === 'valor_total_solicitado') {
                setRawTotalInput(digits); newTotal = numericValue;
            } else if (field === 'valor_nd_30') {
                setRawND30Input(digits); newND30 = numericValue;
                if (newTotal > 0 && newND30 > newTotal) {
                    newND30 = newTotal; setRawND30Input(numberToRawDigits(newND30));
                }
            }
            const newND39 = calculateND39(newTotal, newND30);
            setRawND39Input(numberToRawDigits(newND39));
            return { ...prev, valor_total_solicitado: newTotal, valor_nd_30: newND30, valor_nd_39: newND39 };
        });
    };

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedVerbaOperacional[]) => {
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                return { ...rest, organizacao: om_favorecida, ug: ug_favorecida, detalhamento: "Verba Operacional" } as TablesInsert<'verba_operacional_registros'>;
            });
            const { data, error } = await supabase.from("verba_operacional_registros").insert(dbRecords).select('*');
            if (error) throw error;
            return data;
        },
        onSuccess: (newRecords) => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingVerbas.length} registro(s) adicionado(s).`);
            setPendingVerbas([]); resetForm();
            if (newRecords && newRecords.length > 0) handleEdit(newRecords[0] as VerbaOperacionalRegistro);
        },
        onError: (err) => toast.error(sanitizeError(err)),
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedVerbaOperacional) => {
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            const { error } = await supabase.from("verba_operacional_registros").update({ ...rest, organizacao: om_favorecida, ug: ug_favorecida, detalhamento: "Verba Operacional" }).eq("id", editingId!);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Registro atualizado com sucesso!`);
            setStagedUpdate(null); resetForm();
        },
        onError: (err) => toast.error(sanitizeError(err)),
    });

    const handleDeleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("verba_operacional_registros").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registro excluído com sucesso!");
            setShowDeleteDialog(false); resetForm();
        },
        onError: (err) => toast.error(sanitizeError(err)),
    });

    const resetForm = () => {
        setEditingId(null);
        setFormData(prev => ({ ...initialFormState, om_favorecida: ptrabData?.nome_om || "", ug_favorecida: ptrabData?.codug_om || "" }));
        setEditingMemoriaId(null); setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined); setSelectedOmDetentoraId(undefined); 
        setStagedUpdate(null); 
        setRawTotalInput(numberToRawDigits(0)); setRawND30Input(numberToRawDigits(0)); setRawND39Input(numberToRawDigits(0));
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const nd39 = calculateND39(formData.valor_total_solicitado, formData.valor_nd_30);
            verbaOperacionalSchema.parse({ ...formData, valor_nd_39: nd39 });
            const dataForCalculo = { ...formData, organizacao: formData.om_favorecida, ug: formData.ug_favorecida, valor_nd_39: nd39 };
            const calculatedData: CalculatedVerbaOperacional = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, ug: formData.ug_favorecida, 
                om_detentora: formData.om_detentora, ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao, fase_atividade: formData.fase_atividade,
                quantidade_equipes: formData.quantidade_equipes, valor_total_solicitado: formData.valor_total_solicitado,
                valor_nd_30: formData.valor_nd_30, valor_nd_39: nd39,
                detalhamento: "Verba Operacional", totalGeral: calculos.totalGeral,
                memoria_calculo_display: calculos.memoria, om_favorecida: formData.om_favorecida, ug_favorecida: formData.ug_favorecida,
            } as any;
            if (editingId) {
                const original = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = original?.detalhamento_customizado || null;
                setStagedUpdate(calculatedData);
            } else {
                setPendingVerbas(prev => [...prev, calculatedData]);
                resetForm();
            }
            toast.info("Item adicionado à revisão (Seção 3).");
        } catch (err) {
            if (err instanceof z.ZodError) toast.error(err.errors[0].message);
            else toast.error(sanitizeError(err));
        }
    };

    const handleEdit = (registro: VerbaOperacionalRegistro) => {
        if (pendingVerbas.length > 0) { toast.warning("Salve os itens pendentes antes de editar."); return; }
        setEditingId(registro.id);
        const omF = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omF?.id);
        const omD = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omD?.id);
        setFormData({
            om_favorecida: registro.organizacao, ug_favorecida: registro.ug,
            dias_operacao: registro.dias_operacao, quantidade_equipes: registro.quantidade_equipes,
            valor_total_solicitado: Number(registro.valor_total_solicitado),
            fase_atividade: registro.fase_atividade || "",
            om_detentora: registro.om_detentora || DEFAULT_OM_DETENTORA,
            ug_detentora: registro.ug_detentora || DEFAULT_UG_DETENTORA,
            valor_nd_30: Number(registro.valor_nd_30), valor_nd_39: Number(registro.valor_nd_39)
        });
        setRawTotalInput(numberToRawDigits(registro.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(registro.valor_nd_30));
        setRawND39Input(numberToRawDigits(registro.valor_nd_39));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            const { error } = await supabase.from("verba_operacional_registros").update({ detalhamento_customizado: memoriaEdit.trim() || null }).eq("id", registroId);
            if (error) throw error;
            toast.success("Memória atualizada!");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
        } catch (error) { toast.error(sanitizeError(error)); }
    };

    const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
        if (!confirm("Restaurar memória automática?")) return;
        try {
            const { error } = await supabase.from("verba_operacional_registros").update({ detalhamento_customizado: null }).eq("id", registroId);
            if (error) throw error;
            toast.success("Memória restaurada!");
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
        } catch (error) { toast.error(sanitizeError(error)); }
    };

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms;
    if (isGlobalLoading) return (<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2">Carregando dados...</span></div>);

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isAllocationCorrect = areNumbersEqual(formData.valor_total_solicitado, calculos.totalGeral);
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingVerbas;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader><CardTitle>Verba Operacional</CardTitle><CardDescription>Solicitação de recursos para despesas operacionais diversas.</CardDescription></CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={(om) => { setSelectedOmFavorecidaId(om?.id); setFormData(p => ({ ...p, om_favorecida: om?.nome_om || "", ug_favorecida: om?.codug_om || "" })); }}
                                            placeholder="Selecione a OM"
                                            disabled={!isPTrabEditable || pendingVerbas.length > 0}
                                            initialOmName={formData.om_favorecida}
                                            initialOmUg={formData.ug_favorecida}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData(p => ({ ...p, fase_atividade: f }))} disabled={!isPTrabEditable || pendingVerbas.length > 0} />
                                    </div>
                                </div>
                            </section>

                            {formData.om_favorecida && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Item de Verba Operacional</h3>
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3"><CardTitle className="text-base font-semibold">Dados da Solicitação</CardTitle></CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Período (Nr Dias) *</Label>
                                                            <Input type="number" min={1} value={formData.dias_operacao || ""} onChange={(e) => setFormData(p => ({ ...p, dias_operacao: parseInt(e.target.value) || 0 }))} disabled={!isPTrabEditable} onKeyDown={handleEnterToNextField} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Quantidade de Equipes *</Label>
                                                            <Input type="number" min={1} value={formData.quantidade_equipes || ""} onChange={(e) => setFormData(p => ({ ...p, quantidade_equipes: parseInt(e.target.value) || 0 }))} disabled={!isPTrabEditable} onKeyDown={handleEnterToNextField} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Valor Total Solicitado (R$) *</Label>
                                                            <CurrencyInput rawDigits={rawTotalInput} onChange={(dig) => handleCurrencyChange('valor_total_solicitado', dig)} disabled={!isPTrabEditable} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {formData.valor_total_solicitado > 0 && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4 text-primary">Alocação de Recursos (Total: {formatCurrency(formData.valor_total_solicitado)})</h4>
                                                <div className="space-y-2 mb-4">
                                                    <Label>OM de Destino do Recurso *</Label>
                                                    <OmSelector
                                                        selectedOmId={selectedOmDetentoraId}
                                                        onChange={(om) => { setSelectedOmDetentoraId(om?.id); setFormData(p => ({ ...p, om_detentora: om?.nome_om || "", ug_detentora: om?.codug_om || "" })); }}
                                                        placeholder="Selecione a OM Detentora"
                                                        disabled={!isPTrabEditable}
                                                        initialOmName={formData.om_detentora}
                                                        initialOmUg={formData.ug_detentora}
                                                    />
                                                    <p className="text-xs text-muted-foreground">UG de Destino: {formatCodug(formData.ug_detentora)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>ND 33.90.30 (Material)</Label>
                                                        <div className="relative">
                                                            <CurrencyInput rawDigits={rawND30Input} onChange={(dig) => handleCurrencyChange('valor_nd_30', dig)} disabled={!isPTrabEditable} className="pl-12 text-lg h-12" />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg">R$</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>ND 33.90.39 (Serviço)</Label>
                                                        <div className="relative">
                                                            <Input value={formatCurrency(formData.valor_nd_39)} readOnly disabled className="pl-12 text-lg font-bold bg-blue-500/10 text-blue-600 disabled:opacity-100 h-12" />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg">R$</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center p-3 mt-4 border-t">
                                                    <span className="font-bold text-sm">TOTAL ALOCADO:</span>
                                                    <span className={cn("font-extrabold text-lg", isAllocationCorrect ? "text-primary" : "text-destructive")}>{formatCurrency(calculos.totalGeral)}</span>
                                                </div>
                                                {!isAllocationCorrect && <p className="text-xs text-destructive text-center font-bold">A soma das NDs deve ser igual ao Valor Total Solicitado.</p>}
                                            </Card>
                                        )}
                                        <div className="flex justify-end pt-4"><Button type="submit" disabled={!isPTrabEditable || !isAllocationCorrect || formData.valor_total_solicitado <= 0} className="w-full md:w-auto"><Save className="mr-2 h-4 w-4" />Salvar Item na Lista</Button></div>
                                    </Card>
                                </section>
                            )}

                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados</h3>
                                    {editingId && isVerbaDirty && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="font-medium">Os dados do formulário foram alterados. Clique em "Salvar Item na Lista" para atualizar.</AlertDescription></Alert>}
                                    <div className="space-y-4">
                                        {itemsToDisplay.map(item => (
                                            <Card key={item.tempId} className="border-2 shadow-md border-secondary bg-secondary/10">
                                                <CardContent className="p-4 space-y-4">
                                                    <div className="flex justify-between items-center border-b border-secondary/30 pb-2">
                                                        <h4 className="font-bold text-base">{item.om_favorecida}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-lg">{formatCurrency(item.valor_total_solicitado)}</span>
                                                            {!stagedUpdate && <Button variant="ghost" size="icon" onClick={() => handleRemovePending(item.tempId)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 text-xs gap-4">
                                                        <div className="space-y-1">
                                                            <p className="font-medium">OM Favorecida: {item.om_favorecida}</p>
                                                            {item.om_detentora !== item.om_favorecida ? <div className="flex items-center gap-1 text-red-600 font-bold"><AlertCircle className="h-3 w-3" /><span>Destino: {item.om_detentora}</span></div> : <p className="font-medium">Destino: {item.om_detentora}</p>}
                                                            <p className="font-medium">Período/Equipes: {item.dias_operacao}d / {item.quantidade_equipes}eq</p>
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <p className="font-medium text-green-600">ND 30: {formatCurrency(item.valor_nd_30)}</p>
                                                            <p className="font-medium text-blue-600">ND 39: {formatCurrency(item.valor_nd_39)}</p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                    <Card className="bg-gray-100 shadow-inner"><CardContent className="p-4 flex justify-between items-center"><span className="font-bold text-base">VALOR TOTAL DA OM</span><span className="font-extrabold text-xl">{formatCurrency(stagedUpdate ? stagedUpdate.totalGeral : totalPendingVerbas)}</span></CardContent></Card>
                                    <div className="flex justify-end gap-3 pt-4">
                                        {stagedUpdate ? (
                                            <><Button type="button" variant="outline" onClick={resetForm}><XCircle className="mr-2 h-4 w-4" /> Limpar</Button><Button type="button" onClick={() => updateMutation.mutate(stagedUpdate)} disabled={isVerbaDirty}><Check className="mr-2 h-4 w-4" /> Confirmar Atualização</Button></>
                                        ) : (
                                            <><Button type="button" variant="outline" onClick={handleClearPending}><XCircle className="mr-2 h-4 w-4" /> Limpar Lista</Button><Button type="button" onClick={() => saveMutation.mutate(pendingVerbas)} disabled={pendingVerbas.length === 0}><Save className="mr-2 h-4 w-4" /> Salvar Registros</Button></>
                                        )}
                                    </div>
                                </section>
                            )}

                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> Registros Salvos ({registros.length})</h3>
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => (
                                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                <h3 className="font-bold text-lg text-primary">OM Favorecida: {omKey}</h3>
                                                <span className="font-extrabold text-xl text-primary">{formatCurrency(omRegistros.reduce((s, r) => s + (r.valor_nd_30 + r.valor_nd_39), 0))}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {omRegistros.map(r => (
                                                    <Card key={r.id} className="p-3 bg-background border flex justify-between items-center">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2"><h4 className="font-semibold">Verba Operacional ({formatCurrency(r.valor_total_solicitado)})</h4><Badge variant="outline" className="text-xs">{r.fase_atividade}</Badge></div>
                                                            <div className="pt-2 border-t mt-2 text-xs space-y-1">
                                                                <div className="flex justify-between w-64"><span className="text-muted-foreground">OM Destino:</span><span className={cn("font-medium", r.om_detentora !== r.organizacao && "text-red-600 font-bold")}>{r.om_detentora} ({formatCodug(r.ug_detentora)})</span></div>
                                                                <div className="flex justify-between w-64"><span>ND 30: <span className="text-green-600">{formatCurrency(r.valor_nd_30)}</span></span><span>ND 39: <span className="text-blue-600">{formatCurrency(r.valor_nd_39)}</span></span></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(r)} disabled={!isPTrabEditable}><Pencil className="h-4 w-4" /></Button>
                                                            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { setRegistroToDelete(r); setShowDeleteDialog(true); }} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}

                            {registros && registros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {registros.map(r => (
                                        <div key={`mv-${r.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                            <div className="flex items-start justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2"><h4 className="font-semibold text-foreground">OM Favorecida: {r.organizacao}</h4>{r.detalhamento_customizado && <Badge variant="outline" className="text-xs">Editada manualmente</Badge>}</div>
                                                    {r.om_detentora !== r.organizacao && <div className="flex items-center gap-1 text-red-600 text-sm font-medium mt-1"><AlertCircle className="h-4 w-4" /><span>Destino: {r.om_detentora}</span></div>}
                                                </div>
                                                <div className="flex gap-2">
                                                    {editingMemoriaId === r.id ? (
                                                        <><Button size="sm" onClick={() => handleSalvarMemoriaCustomizada(r.id)}><Check className="h-4 w-4 mr-1" /> Salvar</Button><Button size="sm" variant="outline" onClick={() => setEditingMemoriaId(null)}>Cancelar</Button></>
                                                    ) : (
                                                        <><Button size="sm" variant="outline" onClick={() => { setEditingMemoriaId(r.id); setMemoriaEdit(r.detalhamento_customizado || generateVerbaOperacionalMemoriaCalculo(r as any)); }} disabled={!isPTrabEditable}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>{r.detalhamento_customizado && <Button size="sm" variant="ghost" onClick={() => handleRestaurarMemoriaAutomatica(r.id)} disabled={!isPTrabEditable}><RefreshCw className="h-4 w-4" /></Button>}</>
                                                    )}
                                                </div>
                                            </div>
                                            <Card className="p-4 bg-background border">{editingMemoriaId === r.id ? <Textarea value={memoriaEdit} onChange={(e) => setMemoriaEdit(e.target.value)} className="min-h-[250px] font-mono text-xs" /> : <pre className="text-[11px] font-mono whitespace-pre-wrap">{r.detalhamento_customizado || generateVerbaOperacionalMemoriaCalculo(r as any)}</pre>}</Card>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>
                
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle className="text-destructive flex gap-2"><Trash2 /> Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Deseja excluir o registro da OM {registroToDelete?.organizacao}?</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default VerbaOperacionalForm;