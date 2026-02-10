"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Pencil, Sparkles, AlertCircle, Check, XCircle } from "lucide-react";
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
    VerbaOperacionalRegistro, 
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
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import CurrencyInput from "@/components/CurrencyInput";

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

const initialFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    dias_operacao: 0,
    quantidade_equipes: 0, 
    valor_total_solicitado: 0,
    fase_atividade: "",
    om_detentora: "", 
    ug_detentora: "", 
    objeto_aquisicao: "",
    objeto_contratacao: "",
    proposito: "",
    finalidade: "",
    local: "",
    tarefa: "",
    valor_nd_30: 0,
    valor_nd_39: 0,
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
    
    const [pendingRegistros, setPendingRegistros] = useState<CalculatedVerbaOperacional[]>([]);
    const [lastStagedFormData, setLastStagedFormData] = useState<typeof initialFormState | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    const [rawTotalInput, setRawTotalInput] = useState(numberToRawDigits(0));
    const [rawND30Input, setRawND30Input] = useState(numberToRawDigits(0));
    const [rawND39Input, setRawND39Input] = useState(numberToRawDigits(0));

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

    const handleCurrencyChange = (field: 'valor_total_solicitado' | 'valor_nd_30' | 'valor_nd_39', digits: string) => {
        const { numericValue } = formatCurrencyInput(digits);
        if (field === 'valor_total_solicitado') setRawTotalInput(digits);
        if (field === 'valor_nd_30') setRawND30Input(digits);
        if (field === 'valor_nd_39') setRawND39Input(digits);
        
        setFormData(prev => ({ ...prev, [field]: numericValue }));
    };

    const calculos = useMemo(() => {
        const totals = calculateVerbaOperacionalTotals({ ...formData, organizacao: formData.om_favorecida, ug: formData.ug_favorecida });
        const memoria = generateVerbaOperacionalMemoriaCalculo({ ...formData, organizacao: formData.om_favorecida, ug: formData.ug_favorecida });
        return { ...totals, memoria };
    }, [formData]);

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isSaving = false; // Simplificado para o exemplo

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        const newItem: CalculatedVerbaOperacional = {
            tempId: Math.random().toString(36).substring(7),
            p_trab_id: ptrabId!,
            organizacao: formData.om_favorecida,
            ug: formData.ug_favorecida,
            om_detentora: formData.om_detentora,
            ug_detentora: formData.ug_detentora,
            dias_operacao: formData.dias_operacao,
            quantidade_equipes: formData.quantidade_equipes,
            valor_total_solicitado: formData.valor_total_solicitado,
            valor_nd_30: formData.valor_nd_30,
            valor_nd_39: formData.valor_nd_39,
            fase_atividade: formData.fase_atividade,
            objeto_aquisicao: formData.objeto_aquisicao,
            objeto_contratacao: formData.objeto_contratacao,
            proposito: formData.proposito,
            finalidade: formData.finalidade,
            local: formData.local,
            tarefa: formData.tarefa,
            detalhamento: 'Verba Operacional',
            memoria_calculo_display: calculos.memoria,
            totalGeral: calculos.totalGeral,
            om_favorecida: formData.om_favorecida,
            ug_favorecida: formData.ug_favorecida,
        };
        setPendingRegistros(prev => [...prev, newItem]);
        toast.success("Item adicionado à lista.");
    };

    if (isLoadingPTrab || isLoadingRegistros) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Verba Operacional</CardTitle>
                        <CardDescription>Solicitação de recursos para Verba Operacional.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
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
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fase da Atividade *</Label>
                                    <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData(p => ({ ...p, fase_atividade: f }))} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-6">
                                <div className="space-y-2">
                                    <Label>Valor Total Solicitado *</Label>
                                    <CurrencyInput
                                        id="valor_total_solicitado"
                                        rawDigits={rawTotalInput}
                                        onChange={(_, digits) => handleCurrencyChange('valor_total_solicitado', digits)}
                                        placeholder="Ex: 1.500,00"
                                        disabled={!isPTrabEditable || isSaving}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor ND 30 *</Label>
                                    <CurrencyInput
                                        id="valor_nd_30"
                                        rawDigits={rawND30Input}
                                        onChange={(_, digits) => handleCurrencyChange('valor_nd_30', digits)}
                                        placeholder="0,00"
                                        disabled={!isPTrabEditable || isSaving}
                                        className="text-lg h-12" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor ND 39 *</Label>
                                    <CurrencyInput
                                        id="valor_nd_39"
                                        rawDigits={rawND39Input}
                                        onChange={(_, digits) => handleCurrencyChange('valor_nd_39', digits)}
                                        placeholder="0,00"
                                        disabled={!isPTrabEditable || isSaving}
                                        className="text-lg h-12" 
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full md:w-auto">
                                <Save className="mr-2 h-4 w-4" /> Salvar Item na Lista
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default VerbaOperacionalForm;