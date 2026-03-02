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
import { formatCurrency, formatCodug, numberToRawDigits } from "@/lib/formatUtils";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as z from "zod";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import CurrencyInput from "@/components/CurrencyInput";

// Tipos de dados
type VerbaOperacionalRegistroDB = Tables<'verba_operacional_registros'>; 

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
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
    om_detentora: "", 
    ug_detentora: "", 
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
    const [registroToDelete, setRegistroToDelete] = useState<VerbaOperacionalRegistroDB | null>(null);
    
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

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<VerbaOperacionalRegistroDB[]>({
        queryKey: ['verbaOperacionalRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.detalhamento === 'Verba Operacional').sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    useEffect(() => {
        if (ptrabData && !editingId) {
            setFormData(prev => ({ ...prev, om_favorecida: "", ug_favorecida: "" }));
            setSelectedOmFavorecidaId(undefined); 
            
            const cieOm = oms?.find(om => om.nome_om === DEFAULT_OM_DETENTORA && om.codug_om === DEFAULT_UG_DETENTORA);
            if (cieOm) {
                setSelectedOmDetentoraId(cieOm.id);
                setFormData(prev => ({ ...prev, om_detentora: DEFAULT_OM_DETENTORA, ug_detentora: DEFAULT_UG_DETENTORA }));
            }
        } else if (ptrabData && editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === formData.om_favorecida && om.codug_om === formData.ug_favorecida);
            const omDetentora = oms?.find(om => om.nome_om === formData.om_detentora && om.codug_om === formData.ug_detentora);
            setSelectedOmFavorecidaId(omFavorecida?.id);
            setSelectedOmDetentoraId(omDetentora?.id);
        }
    }, [ptrabData, oms, editingId]);

    const calculos = useMemo(() => {
        if (!ptrabData) return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: "Preencha os campos." };
        
        const nd39Value = calculateND39(formData.valor_total_solicitado, formData.valor_nd_30);
        const dataForCalculo = {
            ...formData,
            organizacao: formData.om_favorecida,
            valor_nd_39: nd39Value
        };

        return {
            ...calculateVerbaOperacionalTotals(dataForCalculo as any),
            memoria: generateVerbaOperacionalMemoriaCalculo(dataForCalculo as any),
        };
    }, [formData, ptrabData]);
    
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
            
            return { 
                ...prev, 
                valor_total_solicitado: totalValue,
                valor_nd_30: nd30Value,
                valor_nd_39: calculateND39(totalValue, nd30Value)
            };
        });
    };

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedVerbaOperacional[]) => {
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = r;
                return {
                    ...rest,
                    organizacao: om_favorecida, 
                    ug: ug_favorecida, 
                    detalhamento: "Verba Operacional",
                } as TablesInsert<'verba_operacional_registros'>;
            });
            const { data, error } = await supabase.from("verba_operacional_registros").insert(dbRecords).select('*');
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registros de Verba Operacional salvos.");
            setPendingVerbas([]); 
            resetForm();
        },
        onError: (err) => toast.error(sanitizeError(err)),
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedVerbaOperacional) => {
            const { tempId, memoria_calculo_display, totalGeral, om_favorecida, ug_favorecida, ...rest } = data;
            const { error } = await supabase.from("verba_operacional_registros").update({
                ...rest,
                organizacao: om_favorecida,
                ug: ug_favorecida,
                detalhamento: "Verba Operacional",
            }).eq("id", editingId!);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["verbaOperacionalRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registro atualizado.");
            setStagedUpdate(null); 
            resetForm();
        },
        onError: (err) => toast.error(sanitizeError(err)),
    });

    const resetForm = () => {
        setEditingId(null);
        setFormData(prev => ({
            ...initialFormState,
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_detentora: DEFAULT_OM_DETENTORA,
            ug_detentora: DEFAULT_UG_DETENTORA,
        }));
        setEditingMemoriaId(null); 
        setStagedUpdate(null);
        setRawTotalInput(numberToRawDigits(0));
        setRawND30Input(numberToRawDigits(0));
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.valor_total_solicitado <= 0 || formData.dias_operacao <= 0 || formData.quantidade_equipes <= 0) {
            toast.error("Preencha Dias, Equipes e Valor Total.");
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
        
        if (editingId) {
            setStagedUpdate(calculatedData);
        } else {
            setPendingVerbas([calculatedData]);
        }
    };

    const handleEdit = (registro: VerbaOperacionalRegistroDB) => {
        setEditingId(registro.id);
        const omFavorecida = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecida?.id);
        
        const omDetentora = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omDetentora?.id);

        const newFormData = {
            om_favorecida: registro.organizacao, 
            ug_favorecida: registro.ug, 
            dias_operacao: registro.dias_operacao,
            quantidade_equipes: registro.quantidade_equipes || 0, 
            valor_total_solicitado: Number(registro.valor_total_solicitado || 0),
            fase_atividade: registro.fase_atividade || "",
            om_detentora: registro.om_detentora || DEFAULT_OM_DETENTORA,
            ug_detentora: registro.ug_detentora || DEFAULT_UG_DETENTORA,
            valor_nd_30: Number(registro.valor_nd_30 || 0),
            valor_nd_39: Number(registro.valor_nd_39 || 0),
        };
        setFormData(newFormData);
        setRawTotalInput(numberToRawDigits(newFormData.valor_total_solicitado));
        setRawND30Input(numberToRawDigits(newFormData.valor_nd_30));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingVerbas;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Verba Operacional (Dias x Equipes)</CardTitle>
                        <CardDescription>Modelo aprovado para lançamento global de despesas por OM.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={(om) => {
                                                setSelectedOmFavorecidaId(om?.id);
                                                setFormData(prev => ({ ...prev, om_favorecida: om?.nome_om || "", ug_favorecida: om?.codug_om || "" }));
                                            }}
                                            placeholder="Selecione a OM"
                                            disabled={pendingVerbas.length > 0}
                                            initialOmName={editingId ? formData.om_favorecida : undefined}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData(p => ({ ...p, fase_atividade: f }))} disabled={pendingVerbas.length > 0} />
                                    </div>
                                </div>
                            </section>

                            {formData.om_favorecida && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold">2. Valores e Período</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                                        <div className="space-y-2">
                                            <Label>Nr Dias Operação *</Label>
                                            <Input type="number" value={formData.dias_operacao || ""} onChange={(e) => setFormData(p => ({ ...p, dias_operacao: parseInt(e.target.value) || 0 }))} onKeyDown={handleEnterToNextField} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Quantidade de Equipes *</Label>
                                            <Input type="number" value={formData.quantidade_equipes || ""} onChange={(e) => setFormData(p => ({ ...p, quantidade_equipes: parseInt(e.target.value) || 0 }))} onKeyDown={handleEnterToNextField} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Valor Total Solicitado (R$) *</Label>
                                            <CurrencyInput rawDigits={rawTotalInput} onChange={(v, d) => handleCurrencyChange('valor_total_solicitado', v, d)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <div className="space-y-2">
                                            <Label>ND 33.90.30 (Material) *</Label>
                                            <CurrencyInput rawDigits={rawND30Input} onChange={(v, d) => handleCurrencyChange('valor_nd_30', v, d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>ND 33.90.39 (Serviço)</Label>
                                            <Input value={formatCurrency(calculos.totalND39)} disabled className="font-bold bg-blue-50 text-blue-700" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end pt-4">
                                        <Button type="submit" disabled={!areNumbersEqual(formData.valor_total_solicitado, calculos.totalGeral) || formData.valor_total_solicitado <= 0}>
                                            {editingId ? "Revisar Alterações" : "Adicionar à Lista"}
                                        </Button>
                                    </div>
                                </section>
                            )}

                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold">3. Item Selecionado</h3>
                                    <Card className="border-primary/20 bg-primary/5">
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="font-bold">{itemsToDisplay[0].om_favorecida}</span>
                                                <span className="font-extrabold text-lg">{formatCurrency(itemsToDisplay[0].valor_total_solicitado)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-white p-2 rounded border">
                                                {itemsToDisplay[0].memoria_calculo_display}
                                            </p>
                                            <div className="flex justify-end gap-2">
                                                <Button type="button" variant="outline" onClick={resetForm}><XCircle className="mr-2 h-4 w-4" /> Cancelar</Button>
                                                <Button type="button" onClick={() => stagedUpdate ? updateMutation.mutate(stagedUpdate) : saveMutation.mutate(pendingVerbas)}>
                                                    <Check className="mr-2 h-4 w-4" /> {stagedUpdate ? "Confirmar Atualização" : "Confirmar e Salvar"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </section>
                            )}

                            {registros && registros.length > 0 && (
                                <section className="space-y-4">
                                    <h3 className="text-xl font-bold">OMs Cadastradas</h3>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>OM Favorecida</TableHead><TableHead className="text-center">Dias x Equipes</TableHead><TableHead className="text-right">ND 30</TableHead><TableHead className="text-right">ND 39</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-center">Ações</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {registros.map(r => (
                                                <TableRow key={r.id}>
                                                    <TableCell className="font-medium">{r.organizacao}</TableCell>
                                                    <TableCell className="text-center">{r.dias_operacao} d x {r.quantidade_equipes} eq</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(r.valor_nd_30)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(r.valor_nd_39)}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(r.valor_total_solicitado)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Pencil className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setRegistroToDelete(r); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </section>
                            )}
                        </form>
                    </CardContent>
                </Card>
            </div>
            
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Registro?</AlertDialogTitle>
                        <AlertDialogDescription>Deseja remover a Verba Operacional de {registroToDelete?.organizacao}?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive" onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default VerbaOperacionalForm;