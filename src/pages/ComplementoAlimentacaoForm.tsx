import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Package, Minus, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Utensils, Droplets, Coffee } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    ComplementoAlimentacaoRegistro, 
    ConsolidatedComplementoRecord,
    AcquisitionGroup,
    calculateGroupTotals,
    generateComplementoMemoriaCalculo,
} from "@/lib/complementoAlimentacaoUtils";
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
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { cn } from "@/lib/utils"; 
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcquisitionGroupForm from "@/components/AcquisitionGroupForm";
import ComplementoAlimentacaoMemoria from "@/components/ComplementoAlimentacaoMemoria";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 
import AcquisitionItemSelectorDialog from "@/components/AcquisitionItemSelectorDialog"; 
import PageMetadata from "@/components/PageMetadata";
import { PublicoSelect } from "@/components/PublicoSelect";
import CurrencyInput from "@/components/CurrencyInput";

// Tipo para o registro calculado antes de salvar
interface CalculatedComplemento extends TablesInsert<'material_consumo_registros'> {
    tempId: string;
    memoria_calculo_display: string;
    totalGeral: number;
    categoria_complemento: 'genero' | 'agua' | 'lanche';
    // Dados para rastreamento
    acquisitionGroups: AcquisitionGroup[];
}

// Estado inicial para o formulário
interface ComplementoAlimentacaoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    categoria_complemento: 'genero' | 'agua' | 'lanche';
    
    publico: string;
    valor_etapa_qs: number;
    pregao_qs: string;
    om_qs: string;
    ug_qs: string;
    valor_etapa_qr: number;
    pregao_qr: string;
    om_qr: string;
    ug_qr: string;

    acquisitionGroups: AcquisitionGroup[];
}

const initialFormState: ComplementoAlimentacaoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    categoria_complemento: 'genero',
    
    publico: "OSP",
    valor_etapa_qs: 0,
    pregao_qs: "",
    om_qs: "",
    ug_qs: "",
    valor_etapa_qr: 0,
    pregao_qr: "",
    om_qr: "",
    ug_qr: "",

    acquisitionGroups: [],
};

const ComplementoAlimentacaoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<ComplementoAlimentacaoFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedComplementoRecord | null>(null);
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedComplementoRecord | null>(null);
    
    const [pendingGroups, setPendingGroups] = useState<CalculatedComplemento[]>([]);
    const [lastStagedFormData, setLastStagedFormData] = useState<ComplementoAlimentacaoFormState | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmQrId, setSelectedOmQrId] = useState<string | undefined>(undefined);
    
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<AcquisitionGroup | undefined>(undefined);
    
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [itemsToPreselect, setItemsToPreselect] = useState<ItemAquisicao[]>([]);
    const [selectedItemsFromSelector, setSelectedItemsFromSelector] = useState<ItemAquisicao[] | null>(null);

    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // --- Queries ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<Tables<'material_consumo_registros'>[]>({
        queryKey: ['materialConsumoRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('material_consumo_registros', ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

    // --- Consolidação ---
    const consolidatedRegistros = useMemo<ConsolidatedComplementoRecord[]>(() => {
        if (!registros) return [];

        const groups = registros.reduce((acc, registro) => {
            // Filtramos apenas registros que possuem a marcação de complemento no group_purpose
            if (!registro.group_purpose?.startsWith('COMPLEMENTO:')) return acc;

            const key = [
                registro.organizacao,
                registro.ug,
                registro.om_detentora,
                registro.ug_detentora,
                registro.dias_operacao,
                registro.efetivo, 
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
                    efetivo: registro.efetivo || 0, 
                    fase_atividade: registro.fase_atividade || '',
                    records: [],
                    totalGeral: 0,
                    totalND30: 0,
                    totalND39: 0,
                };
            }

            // Mapeamento para o tipo ComplementoAlimentacaoRegistro
            const categoria = registro.group_purpose.split(':')[1] as any;
            const itens = (registro.itens_aquisicao as any) || [];
            
            const complementoRecord: ComplementoAlimentacaoRegistro = {
                ...registro,
                categoria_complemento: categoria,
                itens_aquisicao: Array.isArray(itens) ? itens : [],
                // Campos de gênero extraídos do JSONB se for o caso
                publico: (itens as any).publico || 'OSP',
                valor_etapa_qs: (itens as any).valor_etapa_qs || 0,
                pregao_qs: (itens as any).pregao_qs || null,
                om_qs: (itens as any).om_qs || null,
                ug_qs: (itens as any).ug_qs || null,
                valor_etapa_qr: (itens as any).valor_etapa_qr || 0,
                pregao_qr: (itens as any).pregao_qr || null,
                om_qr: (itens as any).om_qr || null,
                ug_qr: (itens as any).ug_qr || null,
            } as any;

            acc[key].records.push(complementoRecord);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND30 += Number(registro.valor_nd_30 || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedComplementoRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    // --- Mutations ---
    const insertMutation = useMutation({
        mutationFn: async (newGroups: CalculatedComplemento[]) => {
            const { error } = await supabase
                .from('material_consumo_registros')
                .insert(newGroups.map(({ tempId, memoria_calculo_display, totalGeral, categoria_complemento, acquisitionGroups, ...rest }) => rest));
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registros de complemento salvos!");
            handleClearPending();
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
        }
    });

    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedComplemento[] }) => {
            const { error: deleteError } = await supabase.from('material_consumo_registros').delete().in('id', oldIds);
            if (deleteError) throw deleteError;
            const { error: insertError } = await supabase.from('material_consumo_registros').insert(newRecords.map(({ tempId, memoria_calculo_display, totalGeral, categoria_complemento, acquisitionGroups, ...rest }) => rest));
            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Lote atualizado com sucesso!");
            handleClearPending();
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('material_consumo_registros').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote excluído!");
            setShowDeleteDialog(false);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
        }
    });

    // --- Handlers ---
    const handleOmFavorecidaChange = (omData: any) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmQrId(omData.id);
            setFormData(prev => ({ 
                ...prev, 
                om_favorecida: omData.nome_om, 
                ug_favorecida: omData.codug_om, 
                rm_vinculacao: omData.rm_vinculacao,
                codug_rm_vinculacao: omData.codug_rm_vinculacao,
                om_qs: omData.rm_vinculacao,
                ug_qs: omData.codug_rm_vinculacao,
                om_qr: omData.nome_om,
                ug_qr: omData.codug_om,
                om_destino: omData.nome_om,
                ug_destino: omData.codug_om
            }));
        }
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        const isGenero = formData.categoria_complemento === 'genero';
        
        let newPendingItems: CalculatedComplemento[] = [];
        const context = {
            organizacao: formData.om_favorecida,
            efetivo: formData.efetivo,
            dias_operacao: formData.dias_operacao,
            fase_atividade: formData.fase_atividade
        };

        if (isGenero) {
            const totalQS = formData.efetivo * formData.dias_operacao * formData.valor_etapa_qs;
            const totalQR = formData.efetivo * formData.dias_operacao * formData.valor_etapa_qr;
            const totalGeral = totalQS + totalQR;

            const generoData = {
                publico: formData.publico,
                valor_etapa_qs: formData.valor_etapa_qs,
                pregao_qs: formData.pregao_qs,
                om_qs: formData.om_qs,
                ug_qs: formData.ug_qs,
                valor_etapa_qr: formData.valor_etapa_qr,
                pregao_qr: formData.pregao_qr,
                om_qr: formData.om_qr,
                ug_qr: formData.ug_qr,
            };

            const item: CalculatedComplemento = {
                tempId: crypto.randomUUID(),
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_destino,
                ug_detentora: formData.ug_destino,
                dias_operacao: formData.dias_operacao,
                efetivo: formData.efetivo,
                fase_atividade: formData.fase_atividade,
                group_name: "Gênero Alimentício",
                group_purpose: `COMPLEMENTO:genero`,
                itens_aquisicao: generoData as any,
                valor_total: totalGeral,
                valor_nd_30: totalGeral,
                valor_nd_39: 0,
                totalGeral,
                categoria_complemento: 'genero',
                memoria_calculo_display: generateComplementoMemoriaCalculo({ ...generoData, categoria_complemento: 'genero', valor_total: totalGeral, efetivo: formData.efetivo, dias_operacao: formData.dias_operacao } as any, context),
                acquisitionGroups: [],
            };
            newPendingItems = [item];
        } else {
            newPendingItems = formData.acquisitionGroups.map(group => {
                const { totalValue, totalND30, totalND39 } = calculateGroupTotals(group.items);
                const item: CalculatedComplemento = {
                    tempId: group.tempId,
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    group_name: group.groupName,
                    group_purpose: `COMPLEMENTO:${formData.categoria_complemento}`,
                    itens_aquisicao: group.items as any,
                    valor_total: totalValue,
                    valor_nd_30: totalND30,
                    valor_nd_39: totalND39,
                    totalGeral: totalValue,
                    categoria_complemento: formData.categoria_complemento,
                    memoria_calculo_display: generateComplementoMemoriaCalculo({ itens_aquisicao: group.items, categoria_complemento: formData.categoria_complemento, valor_total: totalValue } as any, context),
                    acquisitionGroups: [group],
                };
                return item;
            });
        }

        setPendingGroups(newPendingItems);
        setLastStagedFormData(formData);
        toast.info("Itens adicionados à lista de revisão.");
    };

    const handleClearPending = () => {
        setPendingGroups([]);
        setLastStagedFormData(null);
        setEditingId(null);
        setGroupToReplace(null);
    };

    const handleEdit = (group: ConsolidatedComplementoRecord) => {
        setEditingId(group.records[0].id);
        setGroupToReplace(group);
        
        const first = group.records[0];
        const isGenero = first.categoria_complemento === 'genero';

        setFormData({
            om_favorecida: group.organizacao,
            ug_favorecida: group.ug,
            rm_vinculacao: "", // Será preenchido pelo seletor
            codug_rm_vinculacao: "",
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo,
            fase_atividade: group.fase_atividade,
            categoria_complemento: first.categoria_complemento,
            publico: first.publico || "OSP",
            valor_etapa_qs: first.valor_etapa_qs || 0,
            pregao_qs: first.pregao_qs || "",
            om_qs: first.om_qs || "",
            ug_qs: first.ug_qs || "",
            valor_etapa_qr: first.valor_etapa_qr || 0,
            pregao_qr: first.pregao_qr || "",
            om_qr: first.om_qr || "",
            ug_qr: first.ug_qr || "",
            acquisitionGroups: isGenero ? [] : group.records.map(r => ({
                tempId: r.id,
                groupName: r.group_name,
                groupPurpose: r.group_purpose,
                items: r.itens_aquisicao,
                totalValue: r.valor_total,
                totalND30: r.valor_nd_30,
                totalND39: r.valor_nd_39,
            })),
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const isBaseFormReady = formData.om_favorecida.length > 0 && formData.fase_atividade.length > 0;
    const isGenero = formData.categoria_complemento === 'genero';
    const isSaving = insertMutation.isPending || replaceGroupMutation.isPending || deleteMutation.isPending;

    const isSaveDisabled = useMemo(() => {
        if (!isBaseFormReady) return true;
        if (formData.efetivo <= 0 || formData.dias_operacao <= 0) return true;
        if (isGenero) {
            return formData.valor_etapa_qs <= 0 || !formData.pregao_qs || formData.valor_etapa_qr <= 0 || !formData.pregao_qr;
        }
        return formData.acquisitionGroups.length === 0;
    }, [formData, isBaseFormReady, isGenero]);

    const totalPending = useMemo(() => pendingGroups.reduce((sum, g) => sum + g.valor_total, 0), [pendingGroups]);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata title="Complemento de Alimentação" description="Gerenciamento de Complemento de Alimentação" canonicalPath={`/ptrab/complemento-alimentacao?ptrabId=${ptrabId}`} />
            
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Complemento de Alimentação
                        </CardTitle>
                        <CardDescription>
                            Levantamento de necessidades de Gêneros, Água e Lanches.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={selectedOmFavorecidaId} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM" disabled={pendingGroups.length > 0} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData({...formData, fase_atividade: f})} disabled={pendingGroups.length > 0} />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR COMPLEMENTO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Complemento</h3>
                                    
                                    <Tabs value={formData.categoria_complemento} onValueChange={(v: any) => setFormData({...formData, categoria_complemento: v})} className="w-full">
                                        <TabsList className="grid w-full grid-cols-3 mb-6">
                                            <TabsTrigger value="genero" className="flex items-center gap-2" disabled={pendingGroups.length > 0}>
                                                <Utensils className="h-4 w-4" />
                                                Gênero Alimentício
                                            </TabsTrigger>
                                            <TabsTrigger value="agua" className="flex items-center gap-2" disabled={pendingGroups.length > 0}>
                                                <Droplets className="h-4 w-4" />
                                                Água Mineral
                                            </TabsTrigger>
                                            <TabsTrigger value="lanche" className="flex items-center gap-2" disabled={pendingGroups.length > 0}>
                                                <Coffee className="h-4 w-4" />
                                                Lanche/Catanho
                                            </TabsTrigger>
                                        </TabsList>

                                        <Card className="bg-muted/50 p-4">
                                            <div className="space-y-6 bg-background p-4 rounded-lg border">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Efetivo *</Label>
                                                        <Input type="number" value={formData.efetivo || ""} onChange={(e) => setFormData({...formData, efetivo: parseInt(e.target.value) || 0})} placeholder="Ex: 150" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Público *</Label>
                                                        <PublicoSelect value={formData.publico} onChange={(v) => setFormData({...formData, publico: v})} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Período (Nr Dias) *</Label>
                                                        <Input type="number" value={formData.dias_operacao || ""} onChange={(e) => setFormData({...formData, dias_operacao: parseInt(e.target.value) || 0})} placeholder="Ex: 15" />
                                                    </div>
                                                </div>

                                                {isGenero && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                                        <div className="space-y-4 p-4 bg-primary/5 rounded-md border border-primary/10">
                                                            <h4 className="font-bold text-sm text-primary uppercase">Quantitativo de Subsistência (QS)</h4>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2"><Label>Valor Complemento *</Label><CurrencyInput value={formData.valor_etapa_qs} onChange={(val) => setFormData({...formData, valor_etapa_qs: val})} /></div>
                                                                <div className="space-y-2"><Label>Pregão *</Label><Input value={formData.pregao_qs} onChange={(e) => setFormData({...formData, pregao_qs: e.target.value})} placeholder="Ex: 90.001/24" /></div>
                                                            </div>
                                                            <div className="space-y-2"><Label>UASG *</Label><RmSelector value={formData.om_qs} onChange={(name, codug) => setFormData({...formData, om_qs: name, ug_qs: codug})} placeholder="Selecione a UASG" /></div>
                                                        </div>
                                                        <div className="space-y-4 p-4 bg-orange-500/5 rounded-md border border-orange-500/10">
                                                            <h4 className="font-bold text-sm text-orange-600 uppercase">Quantitativo de Rancho (QR)</h4>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2"><Label>Valor Complemento *</Label><CurrencyInput value={formData.valor_etapa_qr} onChange={(val) => setFormData({...formData, valor_etapa_qr: val})} /></div>
                                                                <div className="space-y-2"><Label>Pregão *</Label><Input value={formData.pregao_qr} onChange={(e) => setFormData({...formData, pregao_qr: e.target.value})} placeholder="Ex: 90.001/24" /></div>
                                                            </div>
                                                            <div className="space-y-2"><Label>UASG *</Label><OmSelector selectedOmId={selectedOmQrId} onChange={(om) => setFormData({...formData, om_qr: om?.nome_om || "", ug_qr: om?.codug_om || ""})} placeholder="Selecione a UASG" /></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {!isGenero && (
                                                <div className="mt-6">
                                                    <Card className="p-4 bg-background">
                                                        <h4 className="text-base font-semibold mb-4">Itens de Aquisição ({formData.acquisitionGroups.length})</h4>
                                                        {isGroupFormOpen ? (
                                                            <AcquisitionGroupForm 
                                                                initialGroup={groupToEdit} 
                                                                onSave={(g) => { setFormData(prev => ({...prev, acquisitionGroups: [...prev.acquisitionGroups, g]})); setIsGroupFormOpen(false); }} 
                                                                onCancel={() => setIsGroupFormOpen(false)}
                                                                onOpenItemSelector={(items) => { setItemsToPreselect(items); setIsItemSelectorOpen(true); }}
                                                                selectedItemsFromSelector={selectedItemsFromSelector}
                                                                onOpenChange={setIsItemSelectorOpen}
                                                                onClearSelectedItems={() => setSelectedItemsFromSelector(null)}
                                                            />
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {formData.acquisitionGroups.length === 0 ? (
                                                                    <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Nenhum item</AlertTitle><AlertDescription>Adicione itens para esta categoria.</AlertDescription></Alert>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {formData.acquisitionGroups.map(g => (
                                                                            <div key={g.tempId} className="flex justify-between items-center p-2 border rounded bg-muted/30">
                                                                                <span className="text-sm font-medium">{g.groupName} ({g.items.length} itens)</span>
                                                                                <div className="flex gap-2">
                                                                                    <Button size="icon" variant="ghost" onClick={() => { setGroupToEdit(g); setIsGroupFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                                                                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setFormData(prev => ({...prev, acquisitionGroups: prev.acquisitionGroups.filter(x => x.tempId !== g.tempId)}))}><Trash2 className="h-4 w-4" /></Button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <Button variant="outline" className="w-full" onClick={() => setIsGroupFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Adicionar Grupo de Itens</Button>
                                                            </div>
                                                        )}
                                                    </Card>
                                                </div>
                                            )}

                                            <div className="mt-6 flex justify-end">
                                                <Button className="w-full md:w-auto" disabled={isSaveDisabled} onClick={handleStageCalculation}>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    {editingId ? "Recalcular/Revisar Lote" : "Adicionar à Lista de Revisão"}
                                                </Button>
                                            </div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES) */}
                            {pendingGroups.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados ({pendingGroups.length})</h3>
                                    <div className="space-y-4">
                                        {pendingGroups.map(item => (
                                            <Card key={item.tempId} className="border-2 border-secondary bg-secondary/5">
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-center border-b pb-2 mb-2">
                                                        <h4 className="font-bold">{item.group_name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-lg">{formatCurrency(item.valor_total)}</span>
                                                            {!editingId && <Button variant="ghost" size="icon" onClick={() => setPendingGroups(prev => prev.filter(p => p.tempId !== item.tempId))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                        <div><p className="font-medium">OM Favorecida: {item.organizacao}</p><p className="font-medium">Período/Efetivo: {item.dias_operacao} dias / {item.efetivo} mil.</p></div>
                                                        <div className="text-right"><p className="text-muted-foreground">ND 33.90.30: {formatCurrency(item.valor_nd_30)}</p><p className="text-muted-foreground">ND 33.90.39: {formatCurrency(item.valor_nd_39)}</p></div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <Card className="bg-muted p-4 flex justify-between items-center">
                                            <span className="font-bold">TOTAL DO LOTE:</span>
                                            <span className="font-extrabold text-xl">{formatCurrency(totalPending)}</span>
                                        </Card>
                                        <div className="flex justify-end gap-3">
                                            {editingId ? (
                                                <>
                                                    <Button onClick={() => replaceGroupMutation.mutate({ oldIds: groupToReplace!.records.map(r => r.id), newRecords: pendingGroups })} disabled={isSaving}><Check className="mr-2 h-4 w-4" /> Confirmar Atualização</Button>
                                                    <Button variant="outline" onClick={handleClearPending} disabled={isSaving}><XCircle className="mr-2 h-4 w-4" /> Cancelar</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button onClick={() => insertMutation.mutate(pendingGroups)} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> Salvar Registros</Button>
                                                    <Button variant="outline" onClick={handleClearPending} disabled={isSaving}><XCircle className="mr-2 h-4 w-4" /> Limpar Lista</Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS */}
                            {consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> OMs Cadastradas ({consolidatedRegistros.length})</h3>
                                    {consolidatedRegistros.map(group => (
                                        <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                <h3 className="font-bold text-lg text-primary">{group.organizacao} (UG: {formatCodug(group.ug)}) <Badge variant="outline" className="ml-2">{group.fase_atividade}</Badge></h3>
                                                <span className="font-extrabold text-xl text-primary">{formatCurrency(group.totalGeral)}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {group.records.map(registro => (
                                                    <Card key={registro.id} className="p-3 bg-background border">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h4 className="font-semibold">{registro.group_name} ({registro.categoria_complemento})</h4>
                                                                <p className="text-xs text-muted-foreground">{registro.dias_operacao} dias | {registro.efetivo} militares</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">{formatCurrency(registro.valor_total)}</span>
                                                                <div className="flex gap-1">
                                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(group)} disabled={isSaving || pendingGroups.length > 0}><Pencil className="h-4 w-4" /></Button>
                                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setGroupToDelete(group); setShowDeleteDialog(true); }} disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULO */}
                            {consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {consolidatedRegistros.map(group => group.records.map(registro => (
                                        <ComplementoAlimentacaoMemoria
                                            key={`memoria-${registro.id}`}
                                            registro={registro}
                                            context={{ organizacao: group.organizacao, efetivo: group.efetivo, dias_operacao: group.dias_operacao, fase_atividade: group.fase_atividade }}
                                            isPTrabEditable={ptrabData?.status !== 'aprovado'}
                                            isSaving={isSaving}
                                            editingMemoriaId={editingMemoriaId}
                                            memoriaEdit={memoriaEdit}
                                            setMemoriaEdit={setMemoriaEdit}
                                            handleIniciarEdicaoMemoria={(id, text) => { setEditingMemoriaId(id); setMemoriaEdit(text); }}
                                            handleCancelarEdicaoMemoria={() => setEditingMemoriaId(null)}
                                            handleSalvarMemoriaCustomizada={async (id) => {
                                                const { error } = await supabase.from('material_consumo_registros').update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
                                                if (!error) { toast.success("Memória salva!"); setEditingMemoriaId(null); queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] }); }
                                            }}
                                            handleRestaurarMemoriaAutomatica={async (id) => {
                                                const { error } = await supabase.from('material_consumo_registros').update({ detalhamento_customizado: null }).eq('id', id);
                                                if (!error) { toast.success("Memória restaurada!"); queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] }); }
                                            }}
                                        />
                                    )))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir Lote?</AlertDialogTitle><AlertDialogDescription>Deseja excluir o lote para {groupToDelete?.organizacao}?</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction className="bg-destructive" onClick={() => deleteMutation.mutate(groupToDelete!.records.map(r => r.id))}>Excluir</AlertDialogAction>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AcquisitionItemSelectorDialog open={isItemSelectorOpen} onOpenChange={setIsItemSelectorOpen} selectedYear={new Date().getFullYear()} initialItems={itemsToPreselect} onSelect={(items) => { setSelectedItemsFromSelector(items); setIsItemSelectorOpen(false); }} />
        </div>
    );
};

export default ComplementoAlimentacaoForm;