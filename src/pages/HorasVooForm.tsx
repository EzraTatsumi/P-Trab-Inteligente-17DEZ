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
    Plane
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
    HorasVooRegistro, 
    calculateHorasVooTotals,
    generateHorasVooMemoriaCalculo 
} from "@/lib/horasVooUtils";
import HorasVooMemoria from "@/components/HorasVooMemoria";
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

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

interface PendingHorasVooItem {
    tempId: string;
    dbId?: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    fase_atividade: string;
    codug_destino: string;
    municipio: string;
    quantidade_hv: number;
    tipo_anv: string;
    amparo?: string | null;
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
}

interface ConsolidatedHorasVooRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: HorasVooRegistro[];
    totalGeral: number;
}

const HorasVooForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    
    const queryClient = useQueryClient();
    const { data: oms } = useMilitaryOrganizations();

    // --- ESTADOS DO FORMULÁRIO ---
    const [omFavorecida, setOmFavorecida] = useState({ nome: "", ug: "", id: "" });
    const [faseAtividade, setFaseAtividade] = useState("");
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });

    const [codugDestino, setCodugDestino] = useState("");
    const [municipio, setMunicipio] = useState("");
    const [quantidadeHv, setQuantidadeHv] = useState<number | "">("");
    const [tipoAnv, setTipoAnv] = useState("");
    const [amparo, setAmparo] = useState("");
    
    const [pendingItems, setPendingItems] = useState<PendingHorasVooItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<HorasVooRegistro | null>(null);

    // --- CÁLCULOS AUXILIARES ---
    const currentTotals = useMemo(() => {
        return calculateHorasVooTotals({
            quantidade_hv: Number(quantidadeHv) || 0,
            // O valor da HV é fixo ou vem de diretriz? 
            // Por enquanto assumindo um valor base para exemplo ou 0 se não houver diretriz
            valor_hv_unitario: 0 
        });
    }, [quantidadeHv]);

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<HorasVooRegistro[]>({
        queryKey: ['horasVooRegistros', ptrabId],
        queryFn: async () => {
            const data = await fetchPTrabRecords('horas_voo_registros' as any, ptrabId!);
            return data as unknown as HorasVooRegistro[];
        },
        enabled: !!ptrabId,
    });

    const consolidatedRegistros = useMemo<ConsolidatedHorasVooRecord[]>(() => {
        if (!registros) return [];
        const groups = (registros as HorasVooRegistro[]).reduce((acc, reg) => {
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
        }, {} as Record<string, ConsolidatedHorasVooRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    // --- MUTATIONS ---
    const saveMutation = useMutation({
        mutationFn: async (itemsToSave: PendingHorasVooItem[]) => {
            const idsToDelete = itemsToSave.map(i => i.dbId).filter(Boolean) as string[];
            
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase.from('horas_voo_registros' as any).delete().in('id', idsToDelete);
                if (deleteError) throw deleteError;
            }

            const records = itemsToSave.map(item => ({
                p_trab_id: ptrabId,
                organizacao: item.organizacao,
                ug: item.ug,
                om_detentora: item.om_detentora,
                ug_detentora: item.ug_detentora,
                dias_operacao: item.dias_operacao,
                fase_atividade: item.fase_atividade,
                codug_destino: item.codug_destino,
                municipio: item.municipio,
                quantidade_hv: item.quantidade_hv,
                tipo_anv: item.tipo_anv,
                amparo: item.amparo,
                valor_total: item.valor_total,
                valor_nd_30: item.valor_nd_30,
                valor_nd_39: item.valor_nd_39,
            }));
            const { error } = await supabase.from('horas_voo_registros' as any).insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success(editingId ? "Registro atualizado com sucesso!" : "Registros salvos com sucesso!");
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('horas_voo_registros' as any).delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro excluído.");
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
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
        setDiasOperacao(0);
        setOmDestino({ nome: "", ug: "", id: "" });
        setCodugDestino("");
        setMunicipio("");
        setQuantidadeHv("");
        setTipoAnv("");
        setAmparo("");
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
        if (!omFavorecida.nome || !faseAtividade || !codugDestino || !municipio || !quantidadeHv || !tipoAnv || diasOperacao <= 0) {
            toast.warning("Preencha todos os campos obrigatórios.");
            return;
        }

        const compositionId = editingId || activeCompositionId || crypto.randomUUID();
        if (!editingId && !activeCompositionId) setActiveCompositionId(compositionId);

        const newItem: PendingHorasVooItem = {
            tempId: compositionId,
            dbId: editingId || undefined,
            organizacao: omFavorecida.nome,
            ug: omFavorecida.ug,
            om_detentora: omDestino.nome,
            ug_detentora: omDestino.ug || omFavorecida.ug,
            dias_operacao: diasOperacao,
            fase_atividade: faseAtividade,
            codug_destino: codugDestino,
            municipio: municipio,
            quantidade_hv: Number(quantidadeHv),
            tipo_anv: tipoAnv,
            amparo: amparo,
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

    const handleEdit = (reg: HorasVooRegistro) => {
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
        setDiasOperacao(reg.dias_operacao);
        
        const omDest = oms?.find(om => om.nome_om === reg.om_detentora && om.codug_om === reg.ug_detentora);
        if (omDest) setOmDestino({ nome: omDest.nome_om, ug: omDest.codug_om, id: omDest.id });
        else setOmDestino({ nome: reg.om_detentora, ug: reg.ug_detentora, id: "" });

        setCodugDestino(reg.codug_destino);
        setMunicipio(reg.municipio);
        setQuantidadeHv(reg.quantidade_hv);
        setTipoAnv(reg.tipo_anv);
        setAmparo(reg.amparo || "");

        const stagedItem: PendingHorasVooItem = {
            tempId: reg.id,
            dbId: reg.id,
            organizacao: reg.organizacao,
            ug: reg.ug,
            om_detentora: reg.om_detentora,
            ug_detentora: reg.ug_detentora,
            dias_operacao: reg.dias_operacao,
            fase_atividade: reg.fase_atividade,
            codug_destino: reg.codug_destino,
            municipio: reg.municipio,
            quantidade_hv: reg.quantidade_hv,
            tipo_anv: reg.tipo_anv,
            amparo: reg.amparo,
            valor_total: Number(reg.valor_total),
            valor_nd_30: Number(reg.valor_nd_30),
            valor_nd_39: Number(reg.valor_nd_39),
        };
        setPendingItems([stagedItem]);

        toast.info("Modo Edição ativado.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (reg: HorasVooRegistro) => {
        setRecordToDelete(reg);
        setShowDeleteDialog(true);
    };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('horas_voo_registros' as any).update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        const { error } = await supabase.from('horas_voo_registros' as any).update({ detalhamento_customizado: null }).eq('id', id);
        if (error) toast.error("Erro ao restaurar.");
        else {
            toast.success("Memória automática restaurada.");
            queryClient.invalidateQueries({ queryKey: ['horasVooRegistros', ptrabId] });
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
                        <CardTitle>Horas de Voo (AvEx)</CardTitle>
                        <CardDescription>Planejamento de horas de voo para apoio aéreo e transporte.</CardDescription>
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
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Período (Nr Dias) *</Label>
                                        <Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 15" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>OM Destino do Recurso *</Label>
                                        <OmSelector selectedOmId={omDestino.id || undefined} onChange={(om) => om && setOmDestino({nome: om.nome_om, ug: om.codug_om, id: om.id})} placeholder="Selecione a OM Destino" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Destino</Label>
                                        <Input value={formatCodug(omDestino.ug)} disabled className="bg-muted/50" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                    <div className="space-y-2">
                                        <Label>UG Destino da HV *</Label>
                                        <Input value={codugDestino} onChange={(e) => setCodugDestino(e.target.value)} placeholder="Ex: 160123" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Município/Localidade *</Label>
                                        <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Ex: Manaus/AM" disabled={!isPTrabEditable} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Quantidade de HV *</Label>
                                        <Input type="number" step="0.1" value={quantidadeHv || ""} onChange={(e) => setQuantidadeHv(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 10.5" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipo de Aeronave *</Label>
                                        <Input value={tipoAnv} onChange={(e) => setTipoAnv(e.target.value)} placeholder="Ex: HM-4 Jaguar" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Amparo Legal/Diretriz</Label>
                                        <Input value={amparo} onChange={(e) => setAmparo(e.target.value)} placeholder="Ex: Diretriz Nr 01/2024" disabled={!isPTrabEditable} />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={!isPTrabEditable || saveMutation.isPending || !quantidadeHv} onClick={handleAddToPending}>
                                        {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {editingId ? "Atualizar Registro" : "Adicionar à Lista"}
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
                                                        <h4 className="font-bold text-base text-foreground">{item.tipo_anv} - {item.quantidade_hv} HV</h4>
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
                                                            <p className="font-medium">Localidade:</p>
                                                            <p className="font-medium">UG Destino HV:</p>
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p>
                                                            <p className="font-medium">{item.municipio}</p>
                                                            <p className="font-medium">{item.codug_destino}</p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                    
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
                                                                    {reg.tipo_anv} - {reg.quantidade_hv} HV
                                                                    <Badge variant="outline" className="text-xs font-semibold">{reg.fase_atividade}</Badge>
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {reg.municipio} | UG Destino: {reg.codug_destino}
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
                                        <HorasVooMemoria 
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
                            Tem certeza que deseja excluir o registro de HV para <span className="font-bold">{recordToDelete?.tipo_anv}</span>?
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

export default HorasVooForm;