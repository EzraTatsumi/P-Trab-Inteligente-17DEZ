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
    Zap,
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
    ConcessionariaRegistro, 
    calculateConcessionariaTotals,
    generateConcessionariaMemoriaCalculo 
} from "@/lib/concessionariaUtils";
import ConcessionariaMemoria from "@/components/ConcessionariaMemoria";
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
import ConcessionariaItemSelector from "@/components/ConcessionariaItemSelector";

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

interface PendingConcessionariaItem {
    tempId: string;
    dbId?: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    categoria: string;
    diretriz_id: string;
    valor_unitario: number;
    consumo_pessoa_dia: number;
    valor_total: number;
    valor_nd_39: number;
    detalhamento?: string | null;
}

interface ConsolidatedConcessionariaRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: ConcessionariaRegistro[];
    totalGeral: number;
}

const ConcessionariaForm = () => {
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

    const [selectedDiretriz, setSelectedDiretriz] = useState<any>(null);
    
    const [pendingItems, setPendingItems] = useState<PendingConcessionariaItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<ConcessionariaRegistro | null>(null);

    // --- CÁLCULOS AUXILIARES ---
    const currentTotals = useMemo(() => {
        if (!selectedDiretriz) return { totalGeral: 0, totalND39: 0 };
        return calculateConcessionariaTotals({
            efetivo,
            dias_operacao: diasOperacao,
            valor_unitario: selectedDiretriz.custo_unitario,
            consumo_pessoa_dia: selectedDiretriz.consumo_pessoa_dia
        });
    }, [selectedDiretriz, efetivo, diasOperacao]);

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<ConcessionariaRegistro[]>({
        queryKey: ['concessionariaRegistros', ptrabId],
        queryFn: async () => {
            const data = await fetchPTrabRecords('concessionaria_registros' as any, ptrabId!);
            return data as unknown as ConcessionariaRegistro[];
        },
        enabled: !!ptrabId,
    });

    const consolidatedRegistros = useMemo<ConsolidatedConcessionariaRecord[]>(() => {
        if (!registros) return [];
        const groups = (registros as ConcessionariaRegistro[]).reduce((acc, reg) => {
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
        }, {} as Record<string, ConsolidatedConcessionariaRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    // --- MUTATIONS ---
    const saveMutation = useMutation({
        mutationFn: async (itemsToSave: PendingConcessionariaItem[]) => {
            const idsToDelete = itemsToSave.map(i => i.dbId).filter(Boolean) as string[];
            
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase.from('concessionaria_registros' as any).delete().in('id', idsToDelete);
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
                categoria: item.categoria,
                diretriz_id: item.diretriz_id,
                valor_unitario: item.valor_unitario,
                consumo_pessoa_dia: item.consumo_pessoa_dia,
                valor_total: item.valor_total,
                valor_nd_39: item.valor_nd_39,
                detalhamento: item.detalhamento,
            }));
            const { error } = await supabase.from('concessionaria_registros' as any).insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success(editingId ? "Registro atualizado com sucesso!" : "Registros salvos com sucesso!");
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('concessionaria_registros' as any).delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro excluído.");
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
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
        setSelectedDiretriz(null);
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
        if (!omFavorecida.nome || !faseAtividade || !selectedDiretriz || efetivo <= 0 || diasOperacao <= 0) {
            toast.warning("Preencha todos os campos obrigatórios.");
            return;
        }

        const compositionId = editingId || activeCompositionId || crypto.randomUUID();
        if (!editingId && !activeCompositionId) setActiveCompositionId(compositionId);

        const newItem: PendingConcessionariaItem = {
            tempId: compositionId,
            dbId: editingId || undefined,
            organizacao: omFavorecida.nome,
            ug: omFavorecida.ug,
            om_detentora: omDestino.nome,
            ug_detentora: omDestino.ug || omFavorecida.ug,
            dias_operacao: diasOperacao,
            efetivo: efetivo,
            fase_atividade: faseAtividade,
            categoria: selectedDiretriz.categoria,
            diretriz_id: selectedDiretriz.id,
            valor_unitario: selectedDiretriz.custo_unitario,
            consumo_pessoa_dia: selectedDiretriz.consumo_pessoa_dia,
            valor_total: currentTotals.totalGeral,
            valor_nd_39: currentTotals.totalND39,
            detalhamento: `Pagamento de ${selectedDiretriz.categoria} (${selectedDiretriz.nome_concessionaria})`,
        };

        setPendingItems(prev => {
            const filtered = prev.filter(p => p.tempId !== compositionId);
            return [...filtered, newItem];
        });

        setEditingId(null);
        toast.info(activeCompositionId ? "Item atualizado na lista." : "Item adicionado à lista de pendentes.");
    };

    const handleEdit = (reg: ConcessionariaRegistro) => {
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

        // Tenta reconstruir a diretriz selecionada para o formulário
        setSelectedDiretriz({
            id: reg.diretriz_id,
            categoria: reg.categoria,
            custo_unitario: reg.valor_unitario,
            consumo_pessoa_dia: reg.consumo_pessoa_dia,
            nome_concessionaria: reg.detalhamento?.match(/\(([^)]+)\)/)?.[1] || ""
        });

        const stagedItem: PendingConcessionariaItem = {
            tempId: reg.id,
            dbId: reg.id,
            organizacao: reg.organizacao,
            ug: reg.ug,
            om_detentora: reg.om_detentora,
            ug_detentora: reg.ug_detentora,
            dias_operacao: reg.dias_operacao,
            efetivo: reg.efetivo,
            fase_atividade: reg.fase_atividade,
            categoria: reg.categoria,
            diretriz_id: reg.diretriz_id,
            valor_unitario: Number(reg.valor_unitario),
            consumo_pessoa_dia: Number(reg.consumo_pessoa_dia),
            valor_total: Number(reg.valor_total),
            valor_nd_39: Number(reg.valor_nd_39),
            detalhamento: reg.detalhamento,
        };
        setPendingItems([stagedItem]);

        toast.info("Modo Edição ativado.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (reg: ConcessionariaRegistro) => {
        setRecordToDelete(reg);
        setShowDeleteDialog(true);
    };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('concessionaria_registros' as any).update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        const { error } = await supabase.from('concessionaria_registros' as any).update({ detalhamento_customizado: null }).eq('id', id);
        if (error) toast.error("Erro ao restaurar.");
        else {
            toast.success("Memória automática restaurada.");
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
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
                        <CardTitle>Pagamento de Concessionária</CardTitle>
                        <CardDescription>Planejamento de despesas com energia elétrica, água e esgoto.</CardDescription>
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
                                        <Label>Efetivo *</Label>
                                        <Input type="number" value={efetivo || ""} onChange={(e) => setEfetivo(Number(e.target.value))} placeholder="Ex: 100" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Período (Nr Dias) *</Label>
                                        <Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 15" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>OM Destino do Recurso *</Label>
                                        <OmSelector selectedOmId={omDestino.id || undefined} onChange={(om) => om && setOmDestino({nome: om.nome_om, ug: om.codug_om, id: om.id})} placeholder="Selecione a OM Destino" disabled={!isPTrabEditable} />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <ConcessionariaItemSelector 
                                        selectedDiretriz={selectedDiretriz}
                                        onSelect={setSelectedDiretriz}
                                        disabled={!isPTrabEditable}
                                    />
                                </div>

                                {selectedDiretriz && (
                                    <Card className="bg-muted/30 p-4 mt-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Concessionária</Label>
                                                <p className="font-bold">{selectedDiretriz.nome_concessionaria}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Custo Unitário</Label>
                                                <p className="font-bold">{formatCurrency(selectedDiretriz.custo_unitario)} / {selectedDiretriz.unidade_custo}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Consumo/Pessoa/Dia</Label>
                                                <p className="font-bold">{selectedDiretriz.consumo_pessoa_dia} {selectedDiretriz.unidade_custo}</p>
                                            </div>
                                            <div className="text-right">
                                                <Label className="text-xs text-muted-foreground">Total Estimado</Label>
                                                <p className="font-extrabold text-primary text-lg">{formatCurrency(currentTotals.totalGeral)}</p>
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={!isPTrabEditable || saveMutation.isPending || !selectedDiretriz || currentTotals.totalGeral <= 0} onClick={handleAddToPending}>
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
                                                        <h4 className="font-bold text-base text-foreground">{item.categoria}</h4>
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
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p>
                                                            <p className="font-medium">{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                            <p className="font-medium">{item.dias_operacao} dias / {item.efetivo} mil</p>
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
                                                                    {reg.categoria}
                                                                    <Badge variant="outline" className="text-xs font-semibold">{reg.fase_atividade}</Badge>
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {reg.detalhamento} | {reg.dias_operacao} dias | {reg.efetivo} mil
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
                                        <ConcessionariaMemoria 
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
                            Tem certeza que deseja excluir o registro de <span className="font-bold">{recordToDelete?.categoria}</span>?
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

export default ConcessionariaForm;