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
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as z from "zod";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import CurrencyInput from "@/components/CurrencyInput";

// Tipos de dados
type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
}

interface CalculatedVerbaOperacional extends TablesInsert<'verba_operacional_registros'> {
    tempId: string;
    memoria_calculo_display: string;
    totalGeral: number;
    om_favorecida: string;
    ug_favorecida: string;
}

const calculateND39 = (totalSolicitado: number, nd30Value: number): number => {
    const nd39 = totalSolicitado - nd30Value;
    return Math.max(0, nd39);
};

const DEFAULT_OM_DETENTORA = "CIE";
const DEFAULT_UG_DETENTORA = "160062";

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

    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<VerbaOperacionalRegistro[]>({
        queryKey: ['verbaOperacionalRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.detalhamento === 'Verba Operacional' || !r.detalhamento).sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
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
        if (!ptrabData) return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: "Preencha os campos." };
        const nd39Value = calculateND39(formData.valor_total_solicitado, formData.valor_nd_30);
        const dataForCalculo = { ...formData, organizacao: formData.om_favorecida, valor_nd_39: nd39Value };
        return {
            ...calculateVerbaOperacionalTotals(dataForCalculo as any),
            memoria: generateVerbaOperacionalMemoriaCalculo(dataForCalculo as any),
        };
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

    const handleCurrencyChange = (field: 'valor_total_solicitado' | 'valor_nd_30', numericValue: number, digits: string) => {
        setFormData(prev => {
            let totalValue = prev.valor_total_solicitado;
            let nd30Value = prev.valor_nd_30;
            if (field === 'valor_total_solicitado') {
                setRawTotalInput(digits);
                totalValue = numericValue;
            } else {
                setRawND30Input(digits);
                nd30Value = numericValue;
                if (totalValue > 0 && nd30Value > totalValue) {
                    nd30Value = totalValue;
                    setRawND30Input(numberToRawDigits(nd30Value));
                }
            }
            return { ...prev, valor_total_solicitado: totalValue, valor_nd_30: nd30Value, valor_nd_39: calculateND39(totalValue, nd30Value) };
        });
    };

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedVerbaOperacional[]) => {
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                return { ...rest, organizacao: om_favorecida, ug: ug_favorecida, detalhamento: "Verba Operacional" } as TablesInsert<'verba_operacional_registros'>;
            });
            const { error } = await supabase.from("verba_operacional_registros").insert(dbRecords);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registros salvos com sucesso.");
            setPendingVerbas([]); resetForm();
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
            toast.success("Registro atualizado.");
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
            toast.success("Registro excluído.");
            setShowDeleteDialog(false); resetForm();
        },
        onError: (err) => toast.error(sanitizeError(err)),
    });

    const resetForm = () => {
        setEditingId(null);
        setFormData(prev => ({ ...initialFormState, om_favorecida: ptrabData?.nome_om || "", ug_favorecida: ptrabData?.codug_om || "" }));
        setEditingMemoriaId(null); setStagedUpdate(null);
        setRawTotalInput(numberToRawDigits(0)); setRawND30Input(numberToRawDigits(0));
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.valor_total_solicitado <= 0 || formData.dias_operacao <= 0 || formData.quantidade_equipes <= 0) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
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
            valor_nd_30: formData.valor_nd_30,
            valor_nd_39: calculos.totalND39,
            detalhamento: "Verba Operacional",
            totalGeral: calculos.totalGeral,
            memoria_calculo_display: calculos.memoria, 
            om_favorecida: formData.om_favorecida,
            ug_favorecida: formData.ug_favorecida,
        } as CalculatedVerbaOperacional;
        if (editingId) setStagedUpdate(calculatedData);
        else setPendingVerbas(prev => [...prev, calculatedData]);
        toast.info("Item adicionado à revisão (Seção 3).");
    };

    const handleEdit = (registro: VerbaOperacionalRegistro) => {
        setEditingId(registro.id);
        const omF = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omF?.id);
        const omD = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omD?.id);
        setFormData({
            om_favorecida: registro.organizacao, ug_favorecida: registro.ug,
            dias_operacao: registro.dias_operacao, quantidade_equipes: registro.quantidade_equipes || 0,
            valor_total_solicitado: Number(registro.valor_total_solicitado),
            fase_atividade: registro.fase_atividade || "",
            om_detentora: registro.om_detentora || DEFAULT_OM_DETENTORA,
            ug_detentora: registro.ug_detentora || DEFAULT_UG_DETENTORA,
            valor_nd_30: Number(registro.valor_nd_30), valor_nd_39: Number(registro.valor_nd_39)
        });
        setRawTotalInput(numberToRawDigits(registro.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(registro.valor_nd_30));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms;
    if (isGlobalLoading) return (<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2">Carregando...</span></div>);

    const isAllocationCorrect = areNumbersEqual(formData.valor_total_solicitado, calculos.totalGeral);
    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader><CardTitle>Verba Operacional</CardTitle><CardDescription>Solicitação global de recursos (Dias x Equipes).</CardDescription></CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            {/* SEÇÃO 1: ORGANIZAÇÃO */}
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

                            {/* SEÇÃO 2: CONFIGURAÇÃO */}
                            {formData.om_favorecida && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Solicitação</h3>
                                    <Card className="bg-muted/30 p-4 border-dashed border-2">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div className="space-y-2">
                                                <Label>Período (Nr Dias) *</Label>
                                                <Input type="number" min={1} value={formData.dias_operacao || ""} onChange={(e) => setFormData(p => ({ ...p, dias_operacao: parseInt(e.target.value) || 0 }))} onKeyDown={handleEnterToNextField} disabled={!isPTrabEditable} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Nr Equipes *</Label>
                                                <Input type="number" min={1} value={formData.quantidade_equipes || ""} onChange={(e) => setFormData(p => ({ ...p, quantidade_equipes: parseInt(e.target.value) || 0 }))} onKeyDown={handleEnterToNextField} disabled={!isPTrabEditable} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Valor Total Solicitado (R$) *</Label>
                                                <CurrencyInput rawDigits={rawTotalInput} onChange={(v, d) => handleCurrencyChange('valor_total_solicitado', v, d)} disabled={!isPTrabEditable} />
                                            </div>
                                        </div>

                                        <div className="bg-background p-4 rounded-lg border space-y-4">
                                            <div className="space-y-2">
                                                <Label>OM de Destino do Recurso *</Label>
                                                <OmSelector
                                                    selectedOmId={selectedOmDetentoraId}
                                                    onChange={(om) => { setSelectedOmDetentoraId(om?.id); setFormData(p => ({ ...p, om_detentora: om?.nome_om || "", ug_detentora: om?.codug_om || "" })); }}
                                                    placeholder="Selecione a OM Detentora"
                                                    disabled={!isPTrabEditable}
                                                    initialOmName={formData.om_detentora}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>ND 33.90.30 (Material)</Label>
                                                    <CurrencyInput rawDigits={rawND30Input} onChange={(v, d) => handleCurrencyChange('valor_nd_30', v, d)} disabled={!isPTrabEditable} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>ND 33.90.39 (Serviço)</Label>
                                                    <Input value={formatCurrency(formData.valor_nd_39)} disabled className="font-bold bg-blue-50 text-blue-700" />
                                                </div>
                                            </div>
                                            {!isAllocationCorrect && <p className="text-xs text-destructive text-center font-bold">A soma das NDs deve ser igual ao Valor Total.</p>}
                                        </div>
                                        
                                        <div className="flex justify-end mt-4">
                                            <Button type="submit" disabled={!isPTrabEditable || !isAllocationCorrect || formData.valor_total_solicitado <= 0}>
                                                {editingId ? "Revisar Alterações" : "Salvar Item na Lista"}
                                            </Button>
                                        </div>
                                    </Card>
                                </section>
                            )}

                            {/* SEÇÃO 3: REVISÃO/STAGING */}
                            {(pendingVerbas.length > 0 || stagedUpdate) && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados</h3>
                                    <div className="space-y-4">
                                        {(stagedUpdate ? [stagedUpdate] : pendingVerbas).map(item => (
                                            <Card key={item.tempId} className="border-2 border-secondary bg-secondary/5">
                                                <CardContent className="p-4 space-y-4">
                                                    <div className="flex justify-between items-center border-b pb-2">
                                                        <h4 className="font-bold">{item.om_favorecida}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg font-extrabold">{formatCurrency(item.valor_total_solicitado)}</span>
                                                            {!stagedUpdate && <Button variant="ghost" size="icon" onClick={() => handleRemovePending(item.tempId)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 text-xs gap-2">
                                                        <div>
                                                            <p className="text-muted-foreground">Destino: {item.om_detentora}</p>
                                                            <p className="text-muted-foreground">Período: {item.dias_operacao} d / {item.quantidade_equipes} eq</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-green-600 font-medium">ND 30: {formatCurrency(item.valor_nd_30)}</p>
                                                            <p className="text-blue-600 font-medium">ND 39: {formatCurrency(item.valor_nd_39)}</p>
                                                        </div>
                                                    </div>
                                                    <pre className="text-[10px] font-mono p-2 bg-white rounded border whitespace-pre-wrap">{item.memoria_calculo_display}</pre>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="outline" onClick={resetForm}><XCircle className="mr-2 h-4 w-4" /> Limpar</Button>
                                            <Button type="button" onClick={() => stagedUpdate ? updateMutation.mutate(stagedUpdate) : saveMutation.mutate(pendingVerbas)}>
                                                <Check className="mr-2 h-4 w-4" /> {stagedUpdate ? "Confirmar Atualização" : "Confirmar e Salvar"}
                                            </Button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> Registros Salvos</h3>
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => (
                                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex justify-between items-center mb-3 border-b pb-2 font-bold text-primary">
                                                <span>OM Favorecida: {omKey}</span>
                                                <span>{formatCurrency(omRegistros.reduce((s, r) => s + Number(r.valor_total_solicitado), 0))}</span>
                                            </div>
                                            <div className="space-y-2">
                                                {omRegistros.map(r => (
                                                    <Card key={r.id} className="p-3 bg-background border flex justify-between items-center">
                                                        <div className="text-sm">
                                                            <p className="font-semibold">Verba Operacional ({formatCurrency(r.valor_total_solicitado)}) - <span className="text-xs font-normal text-muted-foreground">{r.fase_atividade}</span></p>
                                                            <p className={cn("text-[10px]", r.om_detentora !== r.organizacao && "text-red-600 font-bold")}>Destino: {r.om_detentora} ({formatCodug(r.ug_detentora)})</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex gap-1">
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(r)} disabled={!isPTrabEditable}><Pencil className="h-4 w-4" /></Button>
                                                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { setRegistroToDelete(r); setShowDeleteDialog(true); }} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4" /></Button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos</h3>
                                    {registros.map(r => (
                                        <div key={`m-${r.id}`} className="space-y-2 border p-4 rounded-lg bg-muted/30">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-sm font-bold">{r.organizacao} ({r.fase_atividade})</h4>
                                                <div className="flex gap-2">
                                                    {editingMemoriaId === r.id ? (
                                                        <>
                                                            <Button size="sm" onClick={() => handleSalvarMemoriaCustomizada(r.id)}><Check className="h-4 w-4 mr-1" /> Salvar</Button>
                                                            <Button size="sm" variant="outline" onClick={() => setEditingMemoriaId(null)}><XCircle className="h-4 w-4" /></Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => { setEditingMemoriaId(r.id); setMemoriaEdit(r.detalhamento_customizado || generateVerbaOperacionalMemoriaCalculo(r as any)); }} disabled={!isPTrabEditable}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                                                            {r.detalhamento_customizado && <Button size="sm" variant="ghost" onClick={() => handleRestaurarMemoriaAutomatica(r.id)} disabled={!isPTrabEditable}><RefreshCw className="h-4 w-4" /></Button>}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-background p-3 rounded border">
                                                {editingMemoriaId === r.id ? <Textarea value={memoriaEdit} onChange={(e) => setMemoriaEdit(e.target.value)} className="font-mono text-xs min-h-[150px]" /> : <pre className="text-[11px] font-mono whitespace-pre-wrap">{r.detalhamento_customizado || generateVerbaOperacionalMemoriaCalculo(r as any)}</pre>}
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            )}
                        </form>
                    </CardContent>
                </Card>

                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Excluir Registro?</AlertDialogTitle><AlertDialogDescription>Deseja remover a Verba Operacional para {registroToDelete?.organizacao}?</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default VerbaOperacionalForm;