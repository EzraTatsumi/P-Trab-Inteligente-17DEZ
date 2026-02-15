"use client";

import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
    ArrowLeft, 
    Loader2, 
    Save, 
    Sparkles, 
    AlertCircle, 
    Trash2, 
    XCircle, 
    Pencil,
    UtensilsCrossed,
    Plus
} from "lucide-react";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { Badge } from "@/components/ui/badge";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils";
import { 
    ComplementoAlimentacaoRegistro, 
    calculateComplementoTotals,
    generateComplementoMemoriaCalculo 
} from "@/lib/complementoAlimentacaoUtils";
import ComplementoAlimentacaoMemoria from "@/components/ComplementoAlimentacaoMemoria";
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
import ComplementoAlimentacaoItemSelector from "@/components/ComplementoAlimentacaoItemSelector";

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

interface PendingComplementoItem {
    tempId: string;
    dbId?: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    group_name: string;
    group_purpose?: string | null;
    categoria_complemento: string;
    publico?: string | null;
    valor_etapa_qs?: number | null;
    pregao_qs?: string | null;
    om_qs?: string | null;
    ug_qs?: string | null;
    valor_etapa_qr?: number | null;
    pregao_qr?: string | null;
    om_qr?: string | null;
    ug_qr?: string | null;
    agua_consumo_dia?: number | null;
    agua_tipo_envase?: string | null;
    agua_volume_envase?: number | null;
    agua_valor_unitario?: number | null;
    agua_pregao?: string | null;
    itens_aquisicao: any[];
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
}

interface ConsolidatedComplementoRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: ComplementoAlimentacaoRegistro[];
    totalGeral: number;
}

const ComplementoAlimentacaoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    
    const queryClient = useQueryClient();
    const { data: oms } = useMilitaryOrganizations();

    // --- ESTADOS DO FORMULÁRIO ---
    const [omFavorecida, setOmFavorecida] = useState({ nome: "", ug: "", id: "" });
    const [faseAtividade, setFaseAtividade] = useState("");
    const [efetivo, setEfetivo] = useState<number>(0);
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });

    const [groupName, setGroupName] = useState("");
    const [groupPurpose, setGroupPurpose] = useState("");
    const [categoriaComplemento, setCategoriaComplemento] = useState<string>("ETAPA_ALIMENTACAO");
    
    // Estados específicos para Etapa de Alimentação
    const [publico, setPublico] = useState("");
    const [valorEtapaQs, setValorEtapaQs] = useState<number | "">("");
    const [pregaoQs, setPregaoQs] = useState("");
    const [omQs, setOmQs] = useState("");
    const [ugQs, setUgQs] = useState("");
    const [valorEtapaQr, setValorEtapaQr] = useState<number | "">("");
    const [pregaoQr, setPregaoQr] = useState("");
    const [omQr, setOmQr] = useState("");
    const [ugQr, setUgQr] = useState("");

    // Estados específicos para Água Mineral
    const [aguaConsumoDia, setAguaConsumoDia] = useState<number | "">("");
    const [aguaTipoEnvase, setAguaTipoEnvase] = useState("GARRAFAO_20L");
    const [aguaVolumeEnvase, setAguaVolumeEnvase] = useState<number | "">("");
    const [aguaValorUnitario, setAguaValorUnitario] = useState<number | "">("");
    const [aguaPregao, setAguaPregao] = useState("");

    // Estados para Itens de Aquisição (Outros)
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    
    const [pendingItems, setPendingItems] = useState<PendingComplementoItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<ComplementoAlimentacaoRegistro | null>(null);

    // --- CÁLCULOS AUXILIARES ---
    const currentTotals = useMemo(() => {
        return calculateComplementoTotals({
            categoria_complemento: categoriaComplemento,
            efetivo,
            dias_operacao: diasOperacao,
            valor_etapa_qs: Number(valorEtapaQs) || 0,
            valor_etapa_qr: Number(valorEtapaQr) || 0,
            agua_consumo_dia: Number(aguaConsumoDia) || 0,
            agua_valor_unitario: Number(aguaValorUnitario) || 0,
            itens_aquisicao: selectedItems
        });
    }, [categoriaComplemento, efetivo, diasOperacao, valorEtapaQs, valorEtapaQr, aguaConsumoDia, aguaValorUnitario, selectedItems]);

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<ComplementoAlimentacaoRegistro[]>({
        queryKey: ['complementoAlimentacaoRegistros', ptrabId],
        queryFn: async () => {
            const data = await fetchPTrabRecords('complemento_alimentacao_registros' as any, ptrabId!);
            return data as unknown as ComplementoAlimentacaoRegistro[];
        },
        enabled: !!ptrabId,
    });

    const consolidatedRegistros = useMemo<ConsolidatedComplementoRecord[]>(() => {
        if (!registros) return [];
        const groups = (registros as ComplementoAlimentacaoRegistro[]).reduce((acc, reg) => {
            const key = `${reg.organizacao}|${reg.ug}`;
            if (!acc[key]) {
                acc[key] = {
                    groupKey: key,
                    organizacao: reg.organizacao,
                    ug: reg.ug,
                    records: [],
                    totalGeral: 0
                };
            }
            acc[key].records.push(reg);
            acc[key].totalGeral += Number(reg.valor_total || 0);
            return acc;
        }, {} as Record<string, ConsolidatedComplementoRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    // --- MUTATIONS ---
    const saveMutation = useMutation({
        mutationFn: async (itemsToSave: PendingComplementoItem[]) => {
            const idsToDelete = itemsToSave.map(i => i.dbId).filter(Boolean) as string[];
            
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase.from('complemento_alimentacao_registros' as any).delete().in('id', idsToDelete);
                if (deleteError) throw deleteError;
            }

            const records = itemsToSave.map(item => ({
                p_trab_id: ptrabId,
                organizacao: item.organizacao,
                ug: item.ug,
                om_detentora: item.om_detentora,
                ug_detentora: item.ug_detentora,
                dias_operacao: item.dias_operacao,
                efetivo: item.efetivo,
                fase_atividade: item.fase_atividade,
                group_name: item.group_name,
                group_purpose: item.group_purpose,
                categoria_complemento: item.categoria_complemento,
                publico: item.publico,
                valor_etapa_qs: item.valor_etapa_qs,
                pregao_qs: item.pregao_qs,
                om_qs: item.om_qs,
                ug_qs: item.ug_qs,
                valor_etapa_qr: item.valor_etapa_qr,
                pregao_qr: item.pregao_qr,
                om_qr: item.om_qr,
                ug_qr: item.ug_qr,
                agua_consumo_dia: item.agua_consumo_dia,
                agua_tipo_envase: item.agua_tipo_envase,
                agua_volume_envase: item.agua_volume_envase,
                agua_valor_unitario: item.agua_valor_unitario,
                agua_pregao: item.agua_pregao,
                itens_aquisicao: item.itens_aquisicao,
                valor_total: item.valor_total,
                valor_nd_30: item.valor_nd_30,
                valor_nd_39: item.valor_nd_39,
            }));
            const { error } = await supabase.from('complemento_alimentacao_registros' as any).insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success(editingId ? "Registro atualizado com sucesso!" : "Registros salvos com sucesso!");
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['complementoAlimentacaoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('complemento_alimentacao_registros' as any).delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro excluído.");
            queryClient.invalidateQueries({ queryKey: ['complementoAlimentacaoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setRecordToDelete(null);
        },
        onError: (err) => toast.error("Erro ao excluir: " + err.message)
    });

    // --- HANDLERS ---
    const resetForm = () => {
        setPendingItems([]);
        setOmFavorecida({ nome: "", ug: "", id: "" });
        setFaseAtividade("");
        setEfetivo(0);
        setDiasOperacao(0);
        setOmDestino({ nome: "", ug: "", id: "" });
        setGroupName("");
        setGroupPurpose("");
        setCategoriaComplemento("ETAPA_ALIMENTACAO");
        setPublico("");
        setValorEtapaQs("");
        setPregaoQs("");
        setOmQs("");
        setUgQs("");
        setValorEtapaQr("");
        setPregaoQr("");
        setOmQr("");
        setUgQr("");
        setAguaConsumoDia("");
        setAguaTipoEnvase("GARRAFAO_20L");
        setAguaVolumeEnvase("");
        setAguaValorUnitario("");
        setAguaPregao("");
        setSelectedItems([]);
        setEditingId(null);
        setActiveCompositionId(null);
    };

    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setOmFavorecida({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
            if (!omDestino.id) setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
        } else setOmFavorecida({ nome: "", ug: "", id: "" });
    };

    const handleAddToPending = () => {
        if (!omFavorecida.nome || !faseAtividade || !groupName || efetivo <= 0 || diasOperacao <= 0) {
            toast.warning("Preencha todos os campos obrigatórios.");
            return;
        }

        const compositionId = editingId || activeCompositionId || crypto.randomUUID();
        if (!editingId && !activeCompositionId) setActiveCompositionId(compositionId);

        const newItem: PendingComplementoItem = {
            tempId: compositionId,
            dbId: editingId || undefined,
            organizacao: omFavorecida.nome,
            ug: omFavorecida.ug,
            om_detentora: omDestino.nome,
            ug_detentora: omDestino.ug || omFavorecida.ug,
            dias_operacao: diasOperacao,
            efetivo: efetivo,
            fase_atividade: faseAtividade,
            group_name: groupName,
            group_purpose: groupPurpose,
            categoria_complemento: categoriaComplemento,
            publico,
            valor_etapa_qs: Number(valorEtapaQs) || null,
            pregao_qs: pregaoQs,
            om_qs: omQs,
            ug_qs: ugQs,
            valor_etapa_qr: Number(valorEtapaQr) || null,
            pregao_qr: pregaoQr,
            om_qr: omQr,
            ug_qr: ugQr,
            agua_consumo_dia: Number(aguaConsumoDia) || null,
            agua_tipo_envase: aguaTipoEnvase,
            agua_volume_envase: Number(aguaVolumeEnvase) || null,
            agua_valor_unitario: Number(aguaValorUnitario) || null,
            agua_pregao: aguaPregao,
            itens_aquisicao: selectedItems,
            valor_total: currentTotals.totalGeral,
            valor_nd_30: currentTotals.totalND30,
            valor_nd_39: currentTotals.totalND39,
        };

        setPendingItems(prev => {
            const filtered = prev.filter(p => p.tempId !== compositionId);
            return [...filtered, newItem];
        });

        setEditingId(null);
        toast.info(activeCompositionId ? "Item atualizado na lista." : "Item adicionado à lista de pendentes.");
    };

    const handleEdit = (reg: ComplementoAlimentacaoRegistro) => {
        if (pendingItems.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar.");
            return;
        }

        setEditingId(reg.id);
        setActiveCompositionId(reg.id);
        
        const omFav = oms?.find(om => om.nome_om === reg.organizacao && om.codug_om === reg.ug);
        if (omFav) setOmFavorecida({ nome: omFav.nome_om, ug: omFav.codug_om, id: omFav.id });
        else setOmFavorecida({ nome: reg.organizacao, ug: reg.ug, id: "" });
        
        setFaseAtividade(reg.fase_atividade);
        setEfetivo(reg.efetivo);
        setDiasOperacao(reg.dias_operacao);
        
        const omDest = oms?.find(om => om.nome_om === reg.om_detentora && om.codug_om === reg.ug_detentora);
        if (omDest) setOmDestino({ nome: omDest.nome_om, ug: omDest.codug_om, id: omDest.id });
        else setOmDestino({ nome: reg.om_detentora, ug: reg.ug_detentora, id: "" });

        setGroupName(reg.group_name);
        setGroupPurpose(reg.group_purpose || "");
        setCategoriaComplemento(reg.categoria_complemento);
        setPublico(reg.publico || "");
        setValorEtapaQs(reg.valor_etapa_qs || "");
        setPregaoQs(reg.pregao_qs || "");
        setOmQs(reg.om_qs || "");
        setUgQs(reg.ug_qs || "");
        setValorEtapaQr(reg.valor_etapa_qr || "");
        setPregaoQr(reg.pregao_qr || "");
        setOmQr(reg.om_qr || "");
        setUgQr(reg.ug_qr || "");
        setAguaConsumoDia(reg.agua_consumo_dia || "");
        setAguaTipoEnvase(reg.agua_tipo_envase || "GARRAFAO_20L");
        setAguaVolumeEnvase(reg.agua_volume_envase || "");
        setAguaValorUnitario(reg.agua_valor_unitario || "");
        setAguaPregao(reg.agua_pregao || "");
        setSelectedItems(reg.itens_aquisicao || []);

        const stagedItem: PendingComplementoItem = {
            tempId: reg.id,
            dbId: reg.id,
            organizacao: reg.organizacao,
            ug: reg.ug,
            om_detentora: reg.om_detentora,
            ug_detentora: reg.ug_detentora,
            dias_operacao: reg.dias_operacao,
            efetivo: reg.efetivo,
            fase_atividade: reg.fase_atividade,
            group_name: reg.group_name,
            group_purpose: reg.group_purpose,
            categoria_complemento: reg.categoria_complemento,
            publico: reg.publico,
            valor_etapa_qs: reg.valor_etapa_qs,
            pregao_qs: reg.pregao_qs,
            om_qs: reg.om_qs,
            ug_qs: reg.ug_qs,
            valor_etapa_qr: reg.valor_etapa_qr,
            pregao_qr: reg.pregao_qr,
            om_qr: reg.om_qr,
            ug_qr: reg.ug_qr,
            agua_consumo_dia: reg.agua_consumo_dia,
            agua_tipo_envase: reg.agua_tipo_envase,
            agua_volume_envase: reg.agua_volume_envase,
            agua_valor_unitario: reg.agua_valor_unitario,
            agua_pregao: reg.agua_pregao,
            itens_aquisicao: reg.itens_aquisicao || [],
            valor_total: Number(reg.valor_total),
            valor_nd_30: Number(reg.valor_nd_30),
            valor_nd_39: Number(reg.valor_nd_39),
        };
        setPendingItems([stagedItem]);

        toast.info("Modo Edição ativado.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (reg: ComplementoAlimentacaoRegistro) => {
        setRecordToDelete(reg);
        setShowDeleteDialog(true);
    };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('complemento_alimentacao_registros' as any).update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ['complementoAlimentacaoRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        const { error } = await supabase.from('complemento_alimentacao_registros' as any).update({ detalhamento_customizado: null }).eq('id', id);
        if (error) toast.error("Erro ao restaurar.");
        else {
            toast.success("Memória automática restaurada.");
            queryClient.invalidateQueries({ queryKey: ['complementoAlimentacaoRegistros', ptrabId] });
        }
    };

    // --- RENDERIZAÇÃO ---
    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros;
    if (isGlobalLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const totalPendingValue = pendingItems.reduce((acc, item) => acc + item.valor_total, 0);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Complemento de Alimentação</CardTitle>
                        <CardDescription>Planejamento de etapas de alimentação, água mineral e outros complementos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={omFavorecida.id || undefined} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM Favorecida" disabled={!isPTrabEditable || (pendingItems.length > 0 && !editingId)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(omFavorecida.ug)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={faseAtividade} onChange={setFaseAtividade} disabled={!isPTrabEditable || (pendingItems.length > 0 && !editingId)} />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR PLANEJAMENTO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Planejamento</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Nome do Grupo/Evento *</Label>
                                        <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Alimentação para o Efetivo da Operação" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Finalidade (Opcional)</Label>
                                        <Input value={groupPurpose} onChange={(e) => setGroupPurpose(e.target.value)} placeholder="Ex: Atender o pessoal em deslocamento" disabled={!isPTrabEditable} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Efetivo *</Label>
                                        <Input type="number" value={efetivo || ""} onChange={(e) => setEfetivo(Number(e.target.value))} placeholder="Ex: 100" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Período (Nr Dias) *</Label>
                                        <Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 10" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>OM Destino do Recurso *</Label>
                                        <OmSelector selectedOmId={omDestino.id || undefined} onChange={(om) => om && setOmDestino({nome: om.nome_om, ug: om.codug_om, id: om.id})} placeholder="Selecione a OM Destino" disabled={!isPTrabEditable} />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <Label>Categoria do Complemento *</Label>
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant={categoriaComplemento === "ETAPA_ALIMENTACAO" ? "default" : "outline"} onClick={() => setCategoriaComplemento("ETAPA_ALIMENTACAO")} disabled={!isPTrabEditable}>Etapa de Alimentação</Button>
                                        <Button variant={categoriaComplemento === "AGUA_MINERAL" ? "default" : "outline"} onClick={() => setCategoriaComplemento("AGUA_MINERAL")} disabled={!isPTrabEditable}>Água Mineral</Button>
                                        <Button variant={categoriaComplemento === "OUTROS" ? "default" : "outline"} onClick={() => setCategoriaComplemento("OUTROS")} disabled={!isPTrabEditable}>Outros Itens</Button>
                                    </div>
                                </div>

                                <Card className="bg-muted/30 p-4">
                                    {categoriaComplemento === "ETAPA_ALIMENTACAO" && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Público Alvo</Label>
                                                    <Input value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ex: Oficiais e Sargentos" disabled={!isPTrabEditable} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4 p-4 bg-background rounded-lg border">
                                                    <h4 className="font-bold text-sm uppercase text-primary">Quota de Suprimento (QS)</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Valor Etapa (R$)</Label>
                                                            <Input type="number" step="0.01" value={valorEtapaQs} onChange={(e) => setValorEtapaQs(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0,00" disabled={!isPTrabEditable} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Nr Pregão</Label>
                                                            <Input value={pregaoQs} onChange={(e) => setPregaoQs(e.target.value)} placeholder="Ex: 01/2024" disabled={!isPTrabEditable} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>OM Detentora</Label>
                                                            <Input value={omQs} onChange={(e) => setOmQs(e.target.value)} placeholder="Ex: 8º BPE" disabled={!isPTrabEditable} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>UG Detentora</Label>
                                                            <Input value={ugQs} onChange={(e) => setUgQs(e.target.value)} placeholder="Ex: 160123" disabled={!isPTrabEditable} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-4 p-4 bg-background rounded-lg border">
                                                    <h4 className="font-bold text-sm uppercase text-primary">Quota de Rancho (QR)</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Valor Etapa (R$)</Label>
                                                            <Input type="number" step="0.01" value={valorEtapaQr} onChange={(e) => setValorEtapaQr(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0,00" disabled={!isPTrabEditable} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Nr Pregão</Label>
                                                            <Input value={pregaoQr} onChange={(e) => setPregaoQr(e.target.value)} placeholder="Ex: 02/2024" disabled={!isPTrabEditable} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>OM Detentora</Label>
                                                            <Input value={omQr} onChange={(e) => setOmQr(e.target.value)} placeholder="Ex: 8º BPE" disabled={!isPTrabEditable} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>UG Detentora</Label>
                                                            <Input value={ugQr} onChange={(e) => setUgQr(e.target.value)} placeholder="Ex: 160123" disabled={!isPTrabEditable} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {categoriaComplemento === "AGUA_MINERAL" && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>Consumo/Pessoa/Dia (L)</Label>
                                                <Input type="number" step="0.1" value={aguaConsumoDia} onChange={(e) => setAguaConsumoDia(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 2.0" disabled={!isPTrabEditable} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Tipo de Envase</Label>
                                                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={aguaTipoEnvase} onChange={(e) => setAguaTipoEnvase(e.target.value)} disabled={!isPTrabEditable}>
                                                    <option value="GARRAFAO_20L">Garrafão 20L</option>
                                                    <option value="GARRAFA_1.5L">Garrafa 1.5L</option>
                                                    <option value="GARRAFA_500ML">Garrafa 500ml</option>
                                                    <option value="COPO_200ML">Copo 200ml</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Volume Envase (L)</Label>
                                                <Input type="number" step="0.01" value={aguaVolumeEnvase} onChange={(e) => setAguaVolumeEnvase(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 20" disabled={!isPTrabEditable} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Valor Unitário Envase (R$)</Label>
                                                <Input type="number" step="0.01" value={aguaValorUnitario} onChange={(e) => setAguaValorUnitario(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0,00" disabled={!isPTrabEditable} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Nr Pregão</Label>
                                                <Input value={aguaPregao} onChange={(e) => setAguaPregao(e.target.value)} placeholder="Ex: 05/2024" disabled={!isPTrabEditable} />
                                            </div>
                                        </div>
                                    )}

                                    {categoriaComplemento === "OUTROS" && (
                                        <div className="space-y-4">
                                            <ComplementoAlimentacaoItemSelector 
                                                selectedItems={selectedItems}
                                                onItemsChange={setSelectedItems}
                                                disabled={!isPTrabEditable}
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center p-3 mt-6 border-t pt-4">
                                        <span className="font-bold text-sm uppercase">VALOR TOTAL DO GRUPO:</span>
                                        <span className="font-extrabold text-lg text-primary">{formatCurrency(currentTotals.totalGeral)}</span>
                                    </div>
                                </Card>

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={!isPTrabEditable || saveMutation.isPending || currentTotals.totalGeral <= 0} onClick={handleAddToPending}>
                                        {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {editingId ? "Atualizar Grupo" : "Adicionar Grupo à Lista"}
                                    </Button>
                                </div>
                            </section>

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES) */}
                            {pendingItems.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados ({pendingItems.length})</h3>
                                    <div className="space-y-4">
                                        {pendingItems.map((item) => (
                                            <Card key={item.tempId} className="border-2 shadow-md border-secondary bg-secondary/10">
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/30">
                                                        <h4 className="font-bold text-base text-foreground">{item.group_name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-extrabold text-lg text-foreground text-right">{formatCurrency(item.valor_total)}</p>
                                                            {!editingId && (
                                                                <Button variant="ghost" size="icon" onClick={() => setPendingItems(prev => prev.filter(i => i.tempId !== item.tempId))} disabled={saveMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                        <div className="space-y-1">
                                                            <p className="font-medium">OM Favorecida:</p>
                                                            <p className="font-medium">OM Destino:</p>
                                                            <p className="font-medium">Período / Efetivo:</p>
                                                            <p className="font-medium">Categoria:</p>
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p>
                                                            <p className="font-medium">{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                            <p className="font-medium">{item.dias_operacao} dias / {item.efetivo} mil</p>
                                                            <p className="font-medium">{item.categoria_complemento.replace('_', ' ')}</p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                    
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">VALOR TOTAL DA OM</span>
                                            <span className="font-extrabold text-xl text-foreground">{formatCurrency(totalPendingValue)}</span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        <Button type="button" onClick={() => saveMutation.mutate(pendingItems)} disabled={saveMutation.isPending || pendingItems.length === 0} className="w-full md:w-auto bg-primary hover:bg-primary/90">
                                            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            {editingId ? "Atualizar Registros" : "Salvar Registros"}
                                        </Button>
                                        <Button type="button" variant="outline" onClick={resetForm} disabled={saveMutation.isPending}>
                                            <XCircle className="mr-2 h-4 w-4" /> {editingId ? "Cancelar Edição" : "Limpar Lista"}
                                        </Button>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS (CONSOLIDADO) */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({consolidatedRegistros.length})
                                    </h3>
                                    {consolidatedRegistros.map((group) => (
                                        <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                    {group.organizacao} (UG: {formatCodug(group.ug)})
                                                </h3>
                                                <span className="font-extrabold text-xl text-primary">{formatCurrency(group.totalGeral)}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {group.records.map((reg) => (
                                                    <Card key={reg.id} className="p-3 bg-background border">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
                                                                    {reg.group_name}
                                                                    <Badge variant="outline" className="text-xs font-semibold">{reg.fase_atividade}</Badge>
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {reg.categoria_complemento.replace('_', ' ')} | {reg.dias_operacao} dias | {reg.efetivo} mil
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xl text-foreground">{formatCurrency(Number(reg.valor_total))}</span>
                                                                <div className="flex gap-1 shrink-0">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(reg)} disabled={!isPTrabEditable || pendingItems.length > 0}><Pencil className="h-4 w-4" /></Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleConfirmDelete(reg)} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4" /></Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="pt-2 border-t mt-2">
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                <span className="font-medium">{reg.om_detentora} ({formatCodug(reg.ug_detentora || '')})</span>
                                                            </div>
                                                            {Number(reg.valor_nd_30) > 0 && (
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                    <span className="text-green-600 font-medium">{formatCurrency(Number(reg.valor_nd_30))}</span>
                                                                </div>
                                                            )}
                                                            {Number(reg.valor_nd_39) > 0 && (
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-muted-foreground">ND 33.90.39:</span>
                                                                    <span className="text-green-600 font-medium">{formatCurrency(Number(reg.valor_nd_39))}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULO */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {registros.map(reg => (
                                        <ComplementoAlimentacaoMemoria 
                                            key={`mem-${reg.id}`}
                                            registro={reg}
                                            isPTrabEditable={isPTrabEditable}
                                            isSaving={false}
                                            editingMemoriaId={editingMemoriaId}
                                            memoriaEdit={memoriaEdit}
                                            setMemoriaEdit={setMemoriaEdit}
                                            onStartEdit={(id, text) => { setEditingMemoriaId(id); setMemoriaEdit(text); }}
                                            onCancelEdit={() => setEditingMemoriaId(null)}
                                            onSave={handleSaveMemoria}
                                            onRestore={handleRestoreMemoria}
                                        />
                                    ))}
                                </section>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" /> Confirmar Exclusão
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o registro <span className="font-bold">{recordToDelete?.group_name}</span>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => recordToDelete && deleteMutation.mutate([recordToDelete.id])} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ComplementoAlimentacaoForm;