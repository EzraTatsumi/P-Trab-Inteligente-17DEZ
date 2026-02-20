"use client";

import React, { useState, useEffect, useMemo } from "react";
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
    FileText, 
    Plus, 
    XCircle, 
    Pencil,
    CheckCircle2,
    CircleX,
    Table as TableIcon,
    ChevronRight
} from "lucide-react";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency, formatPregao } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { Badge } from "@/components/ui/badge";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils";
import { ItemAquisicaoPermanente, ConsolidatedPermanenteRecord } from "@/types/diretrizesMaterialPermanente";
import MaterialPermanenteItemSelectorDialog from "@/components/MaterialPermanenteItemSelectorDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateMaterialPermanenteTotals } from "@/lib/materialPermanenteUtils";
import MaterialPermanenteMemoria from "@/components/MaterialPermanenteMemoria";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import PageMetadata from "@/components/PageMetadata";
import { useSession } from "@/components/SessionContextProvider";
import MaterialPermanenteJustificativaDialog from "@/components/MaterialPermanenteJustificativaDialog";
import MaterialPermanenteBulkJustificativaDialog from "@/components/MaterialPermanenteBulkJustificativaDialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

// Interface para os registros vindos do banco de dados
interface MaterialPermanenteDBRecord {
    id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    categoria: string;
    detalhes_planejamento: any;
    valor_total: number;
    valor_nd_52: number;
    detalhamento_customizado?: string | null;
}

interface PendingPermanenteItem {
    tempId: string;
    dbIds?: string[]; 
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    categoria: string;
    detalhes_planejamento: any;
    valor_total: number;
    valor_nd_52: number;
}

const MaterialPermanenteForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { user } = useSession();
    const { data: oms } = useMilitaryOrganizations();

    // --- ESTADOS DO FORMULÁRIO ---
    const [omFavorecida, setOmFavorecida] = useState({ nome: "", ug: "", id: "" });
    const [faseAtividade, setFaseAtividade] = useState("");
    const [efetivo, setEfetivo] = useState<number>(0);
    const [hasEfetivo, setHasEfetivo] = useState(true);
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });
    const [categoria] = useState("Material Permanente");

    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoPermanente[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isBulkJustificativaOpen, setIsBulkJustificativaOpen] = useState(false);
    
    const [pendingItems, setPendingItems] = useState<PendingPermanenteItem[]>([]);
    const [lastStagedState, setLastStagedState] = useState<any>(null);
    const [editingIds, setEditingIds] = useState<string[]>([]); 
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedPermanenteRecord | null>(null);

    const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
    const [itemForJustificativa, setItemForJustificativa] = useState<ItemAquisicaoPermanente | null>(null);
    const [expandedJustifications, setExpandedJustifications] = useState<Record<string, boolean>>({});

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: profile } = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('profiles').select('default_logistica_year, default_operacional_year').eq('id', user?.id).single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    const selectedYear = useMemo(() => {
        if (profile?.default_logistica_year) return profile.default_logistica_year;
        if (profile?.default_operacional_year) return profile.default_operacional_year;
        const dateStr = ptrabData?.periodo_inicio;
        if (dateStr) {
            const yearMatch = dateStr.match(/\d{4}/);
            if (yearMatch) return parseInt(yearMatch[0]);
        }
        return new Date().getFullYear();
    }, [ptrabData?.periodo_inicio, profile]);

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<MaterialPermanenteDBRecord[]>({
        queryKey: ['materialPermanenteRegistros', ptrabId],
        queryFn: async () => {
            const data = await fetchPTrabRecords('material_permanente_registros' as any, ptrabId!);
            return data as unknown as MaterialPermanenteDBRecord[];
        },
        enabled: !!ptrabId,
    });

    const consolidatedRegistros = useMemo<ConsolidatedPermanenteRecord[]>(() => {
        if (!registros) return [];
        const groups = registros.reduce((acc, reg) => {
            const key = `${reg.organizacao}|${reg.ug}`;
            if (!acc[key]) {
                acc[key] = { groupKey: key, organizacao: reg.organizacao, ug: reg.ug, records: [], totalGeral: 0 };
            }
            acc[key].records.push(reg);
            acc[key].totalGeral += Number(reg.valor_total || 0);
            return acc;
        }, {} as Record<string, ConsolidatedPermanenteRecord>);
        
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    const sortedRegistrosForMemoria = useMemo<MaterialPermanenteDBRecord[]>(() => {
        if (!registros) return [];
        return [...registros].sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    // --- CÁLCULOS ---
    const totalLote = useMemo(() => {
        return selectedItems.reduce((acc, item) => acc + ((item.quantidade || 0) * item.valor_unitario), 0);
    }, [selectedItems]);

    const totalPendingValue = useMemo(() => {
        return pendingItems.reduce((acc, item) => acc + item.valor_total, 0);
    }, [pendingItems]);

    const isDirty = useMemo(() => {
        if (!lastStagedState || pendingItems.length === 0) return false;
        const contextChanged = (
            omFavorecida.id !== lastStagedState.omFavorecidaId ||
            faseAtividade !== lastStagedState.faseAtividade ||
            efetivo !== lastStagedState.efetivo ||
            hasEfetivo !== lastStagedState.hasEfetivo ||
            diasOperacao !== lastStagedState.diasOperacao ||
            omDestino.id !== lastStagedState.omDestinoId
        );
        if (contextChanged) return true;
        const currentItemsKey = selectedItems.map(i => `${i.id}-${i.quantidade}`).sort().join('|');
        return currentItemsKey !== lastStagedState.itemsKey;
    }, [omFavorecida, faseAtividade, efetivo, hasEfetivo, diasOperacao, omDestino, selectedItems, lastStagedState, pendingItems]);

    // --- MUTATIONS ---
    const saveMutation = useMutation({
        mutationFn: async (itemsToSave: PendingPermanenteItem[]) => {
            const idsToDelete = itemsToSave.flatMap(i => i.dbIds || []).filter(Boolean);
            if (idsToDelete.length > 0) {
                await supabase.from('material_permanente_registros' as any).delete().in('id', idsToDelete);
            }
            
            const records = itemsToSave.flatMap(lote => {
                const items = lote.detalhes_planejamento?.itens_selecionados || [];
                return items.map((item: any) => ({
                    p_trab_id: ptrabId,
                    organizacao: lote.organizacao,
                    ug: lote.ug,
                    om_detentora: lote.om_detentora,
                    ug_detentora: lote.ug_detentora,
                    dias_operacao: lote.dias_operacao,
                    efetivo: lote.efetivo,
                    fase_atividade: lote.fase_atividade,
                    categoria: lote.categoria,
                    detalhes_planejamento: { item_unico: item, has_efetivo: lote.detalhes_planejamento.has_efetivo } as any,
                    valor_total: (item.quantidade || 1) * item.valor_unitario,
                    valor_nd_52: (item.quantidade || 1) * item.valor_unitario,
                }));
            });
            const { error } = await supabase.from('material_permanente_registros' as any).insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success(editingIds.length > 0 ? "Registros atualizados!" : "Registros salvos!");
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('material_permanente_registros' as any).delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registros excluídos.");
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
        },
        onError: (err) => toast.error("Erro ao excluir: " + err.message)
    });

    // --- HANDLERS ---
    const resetForm = () => {
        setPendingItems([]);
        setLastStagedState(null);
        setSelectedItems([]);
        setEfetivo(0);
        setHasEfetivo(true);
        setDiasOperacao(0);
        setFaseAtividade("");
        setEditingIds([]);
        setActiveCompositionId(null);
        setExpandedJustifications({});
    };

    const handleOmFavorecidaChange = (omData: any) => {
        if (omData) {
            setOmFavorecida({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
            if (!omDestino.id) setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
        } else setOmFavorecida({ nome: "", ug: "", id: "" });
    };

    const handleAddToPending = () => {
        if (selectedItems.length === 0) { toast.warning("Selecione pelo menos um item."); return; }
        if (diasOperacao <= 0) { toast.warning("Informe o período da operação."); return; }
        const itemsWithoutJustification = selectedItems.filter(item => !item.justificativa || !Object.values(item.justificativa).some(v => v && v.toString().trim() !== ""));
        if (itemsWithoutJustification.length > 0) { toast.error("Todos os itens devem possuir uma justificativa preenchida."); return; }
        
        const compositionId = activeCompositionId || crypto.randomUUID();
        if (!activeCompositionId) setActiveCompositionId(compositionId);
        
        const { totalGeral } = calculateMaterialPermanenteTotals(selectedItems);
        const newItem: PendingPermanenteItem = {
            tempId: compositionId,
            dbIds: editingIds.length > 0 ? editingIds : undefined,
            organizacao: omFavorecida.nome,
            ug: omFavorecida.ug,
            om_detentora: omDestino.nome,
            ug_detentora: omDestino.ug || omFavorecida.ug,
            dias_operacao: diasOperacao,
            efetivo: hasEfetivo ? efetivo : 0,
            fase_atividade: faseAtividade,
            categoria: categoria,
            detalhes_planejamento: { itens_selecionados: selectedItems, has_efetivo: hasEfetivo },
            valor_total: totalGeral,
            valor_nd_52: totalGeral,
        };
        setPendingItems([newItem]);
        setLastStagedState({
            omFavorecidaId: omFavorecida.id,
            faseAtividade,
            efetivo,
            hasEfetivo,
            diasOperacao,
            omDestinoId: omDestino.id,
            itemsKey: selectedItems.map(i => `${i.id}-${i.quantidade}`).sort().join('|')
        });
        toast.info("Lote preparado para salvamento.");
    };

    const handleEditGroup = (group: ConsolidatedPermanenteRecord) => {
        const firstReg = group.records[0];
        const allIds = group.records.map(r => r.id);
        
        setEditingIds(allIds);
        setActiveCompositionId(group.groupKey);
        
        const omFav = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        const omFavData = { nome: group.organizacao, ug: group.ug, id: omFav?.id || "" };
        setOmFavorecida(omFavData);
        
        setFaseAtividade(firstReg.fase_atividade || "");
        setEfetivo(firstReg.efetivo || 0);
        setDiasOperacao(firstReg.dias_operacao || 0);
        
        const omDest = oms?.find(om => om.nome_om === firstReg.om_detentora && om.codug_om === firstReg.ug_detentora);
        const omDestData = { nome: firstReg.om_detentora || "", ug: firstReg.ug_detentora || "", id: omDest?.id || "" };
        setOmDestino(omDestData);
        
        const allItems = group.records.flatMap(reg => {
            const details = reg.detalhes_planejamento;
            return details?.item_unico ? [details.item_unico] : (details?.itens_selecionados || []);
        });
        
        setSelectedItems(allItems);
        setHasEfetivo(firstReg.detalhes_planejamento?.has_efetivo !== false);
        
        const { totalGeral } = calculateMaterialPermanenteTotals(allItems);
        const newItem: PendingPermanenteItem = {
            tempId: group.groupKey,
            dbIds: allIds,
            organizacao: group.organizacao,
            ug: group.ug,
            om_detentora: firstReg.om_detentora,
            ug_detentora: firstReg.ug_detentora,
            dias_operacao: firstReg.dias_operacao,
            efetivo: firstReg.efetivo || 0,
            fase_atividade: firstReg.fase_atividade,
            categoria: firstReg.categoria,
            detalhes_planejamento: { itens_selecionados: allItems, has_efetivo: firstReg.detalhes_planejamento?.has_efetivo !== false },
            valor_total: totalGeral,
            valor_nd_52: totalGeral,
        };
        
        setPendingItems([newItem]);
        setLastStagedState({
            omFavorecidaId: omFavData.id,
            faseAtividade: firstReg.fase_atividade || "",
            efetivo: firstReg.efetivo || 0,
            hasEfetivo: firstReg.detalhes_planejamento?.has_efetivo !== false,
            diasOperacao: firstReg.dias_operacao,
            omDestinoId: omDestData.id,
            itemsKey: allItems.map((i: any) => `${i.id}-${i.quantidade}`).sort().join('|')
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('material_permanente_registros' as any).update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        await supabase.from('material_permanente_registros' as any).update({ detalhamento_customizado: null }).eq('id', id);
        toast.success("Memória restaurada.");
        queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
    };

    const handleOpenJustificativa = (item: ItemAquisicaoPermanente) => {
        setItemForJustificativa(item);
        setJustificativaDialogOpen(true);
    };

    const handleSaveJustificativa = (data: any) => {
        if (!itemForJustificativa) return;
        setSelectedItems(prev => prev.map(i => i.id === itemForJustificativa.id ? { ...i, justificativa: data } : i));
        toast.success("Justificativa salva para o item.");
    };

    const handleSaveBulkJustificativas = (justificationData: any) => {
        setSelectedItems(prev => prev.map(i => ({ ...i, justificativa: justificationData })));
        toast.success("Justificativas atualizadas em massa.");
    };

    const toggleJustification = (id: string) => {
        setExpandedJustifications(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getJustificativaText = (item: any, dias: number, fase: string) => {
        const { grupo, proposito, destinacao, local, finalidade, motivo } = item.justificativa || {};
        const diasStr = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
        return `Aquisição de ${grupo || '[Grupo]'} para atender ${proposito || '[Propósito]'} ${destinacao || '[Destinação]'}, ${local || '[Local]'}, a fim de ${finalidade || '[Finalidade]'}, durante ${diasStr} de ${fase || '[Fase]'}. Justifica-se essa aquisição ${motivo || '[Motivo]'}.`;
    };

    if (isLoadingPTrab || isLoadingRegistros) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata 
                title="Material Permanente" 
                description="Gerenciamento de aquisições de material permanente." 
                canonicalPath="/ptrab/material-permanente"
            />
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">Material Permanente</CardTitle>
                        <CardDescription>Planejamento de necessidades de materiais permanentes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={omFavorecida.id || undefined} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM Favorecida" disabled={!isPTrabEditable || (pendingItems.length > 0 && editingIds.length === 0)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(omFavorecida.ug)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={faseAtividade} onChange={setFaseAtividade} disabled={!isPTrabEditable || (pendingItems.length > 0 && editingIds.length === 0)} />
                                    </div>
                                </div>
                            </section>
                            {((omFavorecida.nome !== "" && faseAtividade !== "") || editingIds.length > 0) && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Planejamento</h3>
                                    <Card className="bg-muted/50 rounded-lg p-4">
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3"><CardTitle className="text-base font-semibold">Período e Destino do Recurso</CardTitle></CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Período (Nr Dias) *</Label>
                                                            <Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 15" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="rounded-lg p-4 bg-background">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-base font-semibold flex items-center gap-2">Itens de Material Permanente</h4>
                                                <div className="flex items-center gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsBulkJustificativaOpen(true)} disabled={!isPTrabEditable || selectedItems.length === 0} className="border-primary text-primary hover:bg-primary/10"><TableIcon className="mr-2 h-4 w-4" /> Preenchimento Coletivo</Button>
                                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)} disabled={!isPTrabEditable}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button>
                                                </div>
                                            </div>
                                            {selectedItems.length > 0 ? (
                                                <div className="border rounded-md overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[80px] text-center">Qtd</TableHead>
                                                                <TableHead>Descrição do Material</TableHead>
                                                                <TableHead className="text-right w-[140px]">Valor Unitário</TableHead>
                                                                <TableHead className="text-right w-[140px]">Total</TableHead>
                                                                <TableHead className="w-[120px] text-center whitespace-nowrap">Justificativa *</TableHead>
                                                                <TableHead className="w-[100px] text-center">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {selectedItems.map((item) => {
                                                                const isJustified = !!(item.justificativa && Object.values(item.justificativa).some(v => v && v.toString().trim() !== ""));
                                                                const isExpanded = expandedJustifications[item.id] || false;
                                                                return (
                                                                    <React.Fragment key={item.id}>
                                                                        <TableRow>
                                                                            <TableCell><Input type="number" min={1} value={item.quantidade || ""} onChange={(e) => { const qty = parseInt(e.target.value) || 0; setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, quantidade: qty } : i)); }} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></TableCell>
                                                                            <TableCell className="text-xs"><p className="font-medium">{item.descricao_reduzida || item.descricao_item}</p><p className="text-muted-foreground text-[10px]">CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)}</p></TableCell>
                                                                            <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(item.valor_unitario)}</TableCell>
                                                                            <TableCell className="text-right text-sm font-bold">{formatCurrency((item.quantidade || 0) * item.valor_unitario)}</TableCell>
                                                                            <TableCell className="text-center"><div className="flex flex-col items-center gap-1">{isJustified ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> : <CircleX className="h-5 w-5 text-destructive mx-auto" />}{isJustified && <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={() => toggleJustification(item.id)}>{isExpanded ? "Ocultar" : "Ver Detalhes"}</Button>}</div></TableCell>
                                                                            <TableCell className="text-center"><div className="flex items-center justify-center gap-1"><Button variant="ghost" size="icon" className={cn("h-7 w-7", isJustified ? "text-primary" : "text-muted-foreground")} onClick={() => handleOpenJustificativa(item)} title="Justificativa da Aquisição"><FileText className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                                                                        </TableRow>
                                                                        {isJustified && (
                                                                            <TableRow className="bg-muted/30">
                                                                                <TableCell colSpan={6} className="p-0">
                                                                                    <Collapsible open={isExpanded}>
                                                                                        <CollapsibleContent className="p-4 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                            <div className="bg-background p-3 rounded border border-primary/20 shadow-sm"><span className="font-bold text-primary uppercase text-[10px] block mb-1">Justificativa Montada:</span><p className="italic leading-relaxed text-foreground/90 text-sm">{getJustificativaText(item, diasOperacao, faseAtividade)}</p></div>
                                                                                        </CollapsibleContent>
                                                                                    </Collapsible>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">Selecione itens da diretriz para iniciar.</div>
                                            )}
                                            <div className="flex justify-between items-center p-3 mt-4 border-t"><span className="font-bold text-sm uppercase">VALOR TOTAL DO LOTE:</span><span className="font-extrabold text-lg text-primary">{formatCurrency(totalLote)}</span></div>
                                        </Card>
                                        <div className="flex justify-end gap-3 pt-4"><Button className="bg-primary hover:bg-primary/90" disabled={selectedItems.length === 0 || diasOperacao <= 0} onClick={handleAddToPending}><Save className="mr-2 h-4 w-4" /> Salvar Item na Lista</Button></div>
                                    </Card>
                                </section>
                            )}
                            {pendingItems.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados ({pendingItems.length})</h3>
                                    {isDirty && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="font-medium">Atenção: Os dados do formulário foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o lote pendente.</AlertDescription></Alert>}
                                    <div className="space-y-4">
                                        {pendingItems.map((item) => {
                                            const isOmDestinoDifferent = item.organizacao.trim() !== item.om_detentora.trim();
                                            const totalQty = item.detalhes_planejamento?.itens_selecionados?.reduce((acc: number, i: any) => acc + (i.quantidade || 0), 0) || 0;
                                            return (
                                                <Card key={item.tempId} className="border-2 shadow-md border-secondary bg-secondary/10">
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/30"><h4 className="font-bold text-base text-foreground">Material Permanente</h4><div className="flex items-center gap-2"><p className="font-extrabold text-lg text-foreground text-right">{formatCurrency(item.valor_total)}</p>{editingIds.length === 0 && <Button variant="ghost" size="icon" onClick={() => setPendingItems(prev => prev.filter(i => i.tempId !== item.tempId))} disabled={saveMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></div>
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1"><div className="space-y-1"><p className="font-medium">OM Favorecida:</p><p className="font-medium">OM Destino do Recurso:</p><p className="font-medium">Período / Qtd Itens:</p></div><div className="text-right space-y-1"><p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p><p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>{item.om_detentora} ({formatCodug(item.ug_detentora)})</p><p className="font-medium">{item.dias_operacao} {item.dias_operacao === 1 ? 'dia' : 'dias'} / {totalQty} un</p></div></div>
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" /><div className="flex flex-col gap-1"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Total ND 44.90.52:</span><span className="font-medium text-green-600">{formatCurrency(item.valor_nd_52)}</span></div></div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    <Card className="bg-gray-100 shadow-inner"><CardContent className="p-4 flex justify-between items-center"><span className="font-bold text-base uppercase">VALOR TOTAL DA OM</span><span className="font-extrabold text-xl text-foreground">{formatCurrency(totalPendingValue)}</span></CardContent></Card>
                                    <div className="flex justify-end gap-3 pt-4"><Button type="button" onClick={() => saveMutation.mutate(pendingItems)} disabled={saveMutation.isPending || pendingItems.length === 0 || isDirty} className="w-full md:w-auto bg-primary hover:bg-primary/90" id="save-records-btn">{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editingIds.length > 0 ? "Atualizar Lote" : "Salvar Registros"}</Button><Button type="button" variant="outline" onClick={resetForm} disabled={saveMutation.isPending}><XCircle className="mr-2 h-4 w-4" /> {editingIds.length > 0 ? "Cancelar Edição" : "Limpar Lista"}</Button></div>
                                </section>
                            )}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" />OMs Cadastradas ({consolidatedRegistros.length})</h3>
                                    {consolidatedRegistros.map((group) => (
                                        <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                    {group.organizacao} (UG: {formatCodug(group.ug)})
                                                </h3>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-extrabold text-xl text-primary">{formatCurrency(group.totalGeral)}</span>
                                                    <div className="flex gap-1 shrink-0">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-primary hover:bg-primary/10" 
                                                            onClick={() => handleEditGroup(group)} 
                                                            disabled={!isPTrabEditable || pendingItems.length > 0}
                                                            title="Editar todos os itens desta OM"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                                            onClick={() => { setGroupToDelete(group); setShowDeleteDialog(true); }} 
                                                            disabled={!isPTrabEditable}
                                                            title="Excluir todos os itens desta OM"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {group.records.map((reg: MaterialPermanenteDBRecord) => {
                                                    const item = reg.detalhes_planejamento?.item_unico || reg.detalhes_planejamento?.itens_selecionados?.[0];
                                                    return (
                                                        <div key={reg.id} className="flex items-center justify-between p-2 bg-background rounded border border-primary/10 text-xs">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{item?.descricao_reduzida || item?.descricao_item || "Material Permanente"}</span>
                                                                <span className="text-[10px] text-muted-foreground">Fase: {reg.fase_atividade} | Qtd: {item?.quantidade || 0} un</span>
                                                            </div>
                                                            <span className="font-bold text-foreground">{formatCurrency(Number(reg.valor_total))}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}
                            {sortedRegistrosForMemoria && sortedRegistrosForMemoria.length > 0 && (
                                <section className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {sortedRegistrosForMemoria.flatMap(reg => {
                                        const items = reg.detalhes_planejamento?.itens_selecionados || (reg.detalhes_planejamento?.item_unico ? [reg.detalhes_planejamento.item_unico] : []);
                                        return items.map((item: any) => (
                                            <MaterialPermanenteMemoria 
                                                key={`mem-${reg.id}-${item.id}`}
                                                registro={reg}
                                                item={item}
                                                isPTrabEditable={isPTrabEditable}
                                                editingMemoriaId={editingMemoriaId}
                                                memoriaEdit={memoriaEdit}
                                                setMemoriaEdit={setMemoriaEdit}
                                                onStartEdit={(id, text) => { setEditingMemoriaId(id); setMemoriaEdit(text); }}
                                                onCancelEdit={() => setEditingMemoriaId(null)}
                                                onSave={handleSaveMemoria}
                                                onRestore={handleRestoreMemoria}
                                            />
                                        ));
                                    })}
                                </section>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <MaterialPermanenteItemSelectorDialog open={isSelectorOpen} onOpenChange={setIsSelectorOpen} selectedYear={selectedYear} initialItems={selectedItems} onSelect={(items) => { setSelectedItems(items.map(item => ({ ...item, quantidade: item.quantidade || 1 }))); }} onAddDiretriz={() => navigate('/config/custos-operacionais')} categoria="Material Permanente" />
            <MaterialPermanenteJustificativaDialog open={justificativaDialogOpen} onOpenChange={setJustificativaDialogOpen} itemName={itemForJustificativa?.descricao_reduzida || itemForJustificativa?.descricao_item || ""} data={itemForJustificativa?.justificativa || {}} diasOperacao={diasOperacao} faseAtividade={faseAtividade} onSave={handleSaveJustificativa} />
            <MaterialPermanenteBulkJustificativaDialog open={isBulkJustificativaOpen} onOpenChange={setIsBulkJustificativaOpen} items={selectedItems} onSave={(data) => handleSaveBulkJustificativas(data)} />
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deseja excluir todos os registros de Material Permanente da OM {groupToDelete?.organizacao}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction 
                            onClick={() => groupToDelete && deleteMutation.mutate(groupToDelete.records.map(r => r.id))} 
                            className="bg-destructive"
                        >
                            Excluir
                        </AlertDialogAction>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default MaterialPermanenteForm;