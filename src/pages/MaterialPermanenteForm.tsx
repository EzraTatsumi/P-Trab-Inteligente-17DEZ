"use client";

import { useState, useEffect, useMemo } from "react";
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
    ChevronDown,
    ChevronUp,
    Calculator,
    Package,
    CheckCircle2,
    Circle,
    CircleX
} from "lucide-react";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency, formatPregao } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { Badge } from "@/components/ui/badge";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import MaterialPermanenteItemSelectorDialog from "@/components/MaterialPermanenteItemSelectorDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateMaterialPermanenteTotals, generateMaterialPermanenteMemoria } from "@/lib/materialPermanenteUtils";
import MaterialPermanenteMemoria from "@/components/MaterialPermanenteMemoria";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import PageMetadata from "@/components/PageMetadata";
import { useSession } from "@/components/SessionContextProvider";
import MaterialPermanenteJustificativaDialog from "@/components/MaterialPermanenteJustificativaDialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import React from "react";

interface PendingPermanenteItem {
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
    detalhes_planejamento: any;
    valor_total: number;
    valor_nd_52: number;
}

interface ConsolidatedPermanenteRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: any[];
    totalGeral: number;
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
    const [categoria, setCategoria] = useState("Material Permanente");

    const [selectedItems, setSelectedItems] = useState<ItemAquisicao[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    const [pendingItems, setPendingItems] = useState<PendingPermanenteItem[]>([]);
    const [lastStagedState, setLastStagedState] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<any>(null);

    // Estado para o diálogo de justificativa
    const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
    const [itemForJustificativa, setItemForJustificativa] = useState<ItemAquisicao | null>(null);
    const [expandedJustifications, setExpandedJustifications] = useState<Record<string, boolean>>({});

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Busca o perfil para obter o ano padrão
    const { data: profile } = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('default_logistica_year, default_operacional_year')
                .eq('id', user?.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // Lógica de ano: Prioriza o ano padrão do perfil (2026) conforme solicitado
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

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<any[]>({
        queryKey: ['materialPermanenteRegistros', ptrabId],
        queryFn: async () => {
            const data = await fetchPTrabRecords('material_permanente_registros' as any, ptrabId!);
            return data;
        },
        enabled: !!ptrabId,
    });

    const consolidatedRegistros = useMemo<ConsolidatedPermanenteRecord[]>(() => {
        if (!registros) return [];
        const groups = (registros as any[]).reduce((acc, reg) => {
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
        }, {} as Record<string, ConsolidatedPermanenteRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    // --- CÁLCULOS ---
    const totalLote = useMemo(() => {
        return selectedItems.reduce((acc, item) => {
            const qty = item.quantidade || 0;
            return acc + (qty * item.valor_unitario);
        }, 0);
    }, [selectedItems]);

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
            const idsToDelete = itemsToSave.map(i => i.dbId).filter(Boolean) as string[];
            
            if (idsToDelete.length > 0) {
                await supabase.from('material_permanente_registros').delete().in('id', idsToDelete);
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
                detalhes_planejamento: item.detalhes_planejamento,
                valor_total: item.valor_total,
                valor_nd_52: item.valor_nd_52,
            }));
            const { error } = await supabase.from('material_permanente_registros').insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success(editingId ? "Registro atualizado!" : "Registros salvos!");
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('material_permanente_registros').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro excluído.");
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
        setEditingId(null);
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
        if (selectedItems.length === 0) {
            toast.warning("Selecione pelo menos um item.");
            return;
        }

        if (diasOperacao <= 0) {
            toast.warning("Informe o período da operação.");
            return;
        }

        // Validação de justificativa obrigatória
        const itemsWithoutJustification = selectedItems.filter(item => 
            !item.justificativa || 
            !Object.values(item.justificativa).some(v => v && v.toString().trim() !== "")
        );

        if (itemsWithoutJustification.length > 0) {
            toast.error("Todos os itens devem possuir uma justificativa preenchida.");
            return;
        }

        const compositionId = editingId || activeCompositionId || crypto.randomUUID();
        if (!editingId && !activeCompositionId) setActiveCompositionId(compositionId);

        const { totalGeral } = calculateMaterialPermanenteTotals(selectedItems);
        
        const newItem: PendingPermanenteItem = {
            tempId: compositionId,
            dbId: editingId || undefined,
            organizacao: omFavorecida.nome,
            ug: omFavorecida.ug,
            om_detentora: omDestino.nome,
            ug_detentora: omDestino.ug || omFavorecida.ug,
            dias_operacao: diasOperacao,
            efetivo: hasEfetivo ? efetivo : 0,
            fase_atividade: faseAtividade,
            categoria: categoria,
            detalhes_planejamento: { 
                itens_selecionados: selectedItems,
                has_efetivo: hasEfetivo
            },
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

        setEditingId(null);
        toast.info("Lote preparado para salvamento.");
    };

    const handleEdit = (reg: any) => {
        setEditingId(reg.id);
        setActiveCompositionId(reg.id);
        
        const omFav = oms?.find(om => om.nome_om === reg.organizacao && om.codug_om === reg.ug);
        setOmFavorecida({ nome: reg.organizacao, ug: reg.ug, id: omFav?.id || "" });
        setFaseAtividade(reg.fase_atividade || "");
        setEfetivo(reg.efetivo || 0);
        setDiasOperacao(reg.dias_operacao || 0);
        
        const omDest = oms?.find(om => om.nome_om === reg.om_detentora && om.codug_om === reg.ug_detentora);
        setOmDestino({ nome: reg.om_detentora || "", ug: reg.ug_detentora || "", id: omDest?.id || "" });

        const details = reg.detalhes_planejamento;
        setSelectedItems(details?.itens_selecionados || []);
        setHasEfetivo(details?.has_efetivo !== false);

        handleAddToPending();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('material_permanente_registros').update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        await supabase.from('material_permanente_registros').update({ detalhamento_customizado: null }).eq('id', id);
        toast.success("Memória restaurada.");
        queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
    };

    const handleOpenJustificativa = (item: ItemAquisicao) => {
        setItemForJustificativa(item);
        setJustificativaDialogOpen(true);
    };

    const handleSaveJustificativa = (data: any) => {
        if (!itemForJustificativa) return;
        setSelectedItems(prev => prev.map(i => i.id === itemForJustificativa.id ? { ...i, justificativa: data } : i));
        toast.success("Justificativa salva para o item.");
    };

    const toggleJustification = (id: string) => {
        setExpandedJustifications(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (isLoadingPTrab || isLoadingRegistros) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata title="Material Permanente" description="Gerenciamento de aquisições de material permanente." />
            
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">Aquisição de Material Permanente</CardTitle>
                        <CardDescription>Planejamento de necessidades de materiais permanentes.</CardDescription>
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
                            {((omFavorecida.nome !== "" && faseAtividade !== "") || !!editingId) && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Planejamento</h3>
                                    
                                    <Card className="bg-muted/50 rounded-lg p-4">
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período, Efetivo e Destino do Recurso</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Período (Nr Dias) *</Label>
                                                            <Input 
                                                                type="number" 
                                                                value={diasOperacao || ""} 
                                                                onChange={(e) => setDiasOperacao(Number(e.target.value))} 
                                                                placeholder="Ex: 15" 
                                                                disabled={!isPTrabEditable} 
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Efetivo *</Label>
                                                            <Input 
                                                                type="number" 
                                                                value={!hasEfetivo ? "" : (efetivo || "")} 
                                                                onChange={(e) => setEfetivo(Number(e.target.value))} 
                                                                placeholder={!hasEfetivo ? "N/A" : "Ex: 50"} 
                                                                disabled={!isPTrabEditable || !hasEfetivo} 
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                            />
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{hasEfetivo ? 'Ativo' : 'Inativo'}</span>
                                                                <Switch 
                                                                    checked={hasEfetivo} 
                                                                    onCheckedChange={(checked) => {
                                                                        setHasEfetivo(checked);
                                                                        if (!checked) setEfetivo(0);
                                                                    }}
                                                                    disabled={!isPTrabEditable}
                                                                    className="scale-75"
                                                                />
                                                            </div>
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
                                                <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)} disabled={!isPTrabEditable}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button>
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
                                                                <TableHead className="w-[100px] text-center">Justificativa *</TableHead>
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
                                                                            <TableCell>
                                                                                <Input 
                                                                                    type="number" 
                                                                                    min={1} 
                                                                                    value={item.quantidade || ""} 
                                                                                    onChange={(e) => {
                                                                                        const qty = parseInt(e.target.value) || 0;
                                                                                        setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, quantidade: qty } : i));
                                                                                    }} 
                                                                                    onWheel={(e) => e.currentTarget.blur()}
                                                                                    onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                                    className="h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell className="text-xs">
                                                                                <p className="font-medium">{item.descricao_reduzida || item.descricao_item}</p>
                                                                                <p className="text-muted-foreground text-[10px]">CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)}</p>
                                                                            </TableCell>
                                                                            <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(item.valor_unitario)}</TableCell>
                                                                            <TableCell className="text-right text-sm font-bold">{formatCurrency((item.quantidade || 0) * item.valor_unitario)}</TableCell>
                                                                            <TableCell className="text-center">
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    {isJustified ? (
                                                                                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                                                                                    ) : (
                                                                                        <CircleX className="h-5 w-5 text-destructive mx-auto" />
                                                                                    )}
                                                                                    {isJustified && (
                                                                                        <Button 
                                                                                            variant="link" 
                                                                                            size="sm" 
                                                                                            className="h-auto p-0 text-[10px]"
                                                                                            onClick={() => toggleJustification(item.id)}
                                                                                        >
                                                                                            {isExpanded ? "Ocultar" : "Ver Detalhes"}
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <Button 
                                                                                        variant="ghost" 
                                                                                        size="icon" 
                                                                                        className={cn("h-7 w-7", isJustified ? "text-primary" : "text-muted-foreground")} 
                                                                                        onClick={() => handleOpenJustificativa(item)}
                                                                                        title="Justificativa da Aquisição"
                                                                                    >
                                                                                        <FileText className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                        {isJustified && (
                                                                            <TableRow className="bg-muted/30">
                                                                                <TableCell colSpan={6} className="p-0">
                                                                                    <Collapsible open={isExpanded}>
                                                                                        <CollapsibleContent className="p-3 space-y-2 text-[11px] border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                                                                                                <div><span className="font-bold text-muted-foreground uppercase text-[9px]">Propósito:</span> <p>{item.justificativa?.proposito || 'N/A'}</p></div>
                                                                                                <div><span className="font-bold text-muted-foreground uppercase text-[9px]">Destinação:</span> <p>{item.justificativa?.destinacao || 'N/A'}</p></div>
                                                                                                <div><span className="font-bold text-muted-foreground uppercase text-[9px]">Local:</span> <p>{item.justificativa?.local || 'N/A'}</p></div>
                                                                                                <div><span className="font-bold text-muted-foreground uppercase text-[9px]">Finalidade:</span> <p>{item.justificativa?.finalidade || 'N/A'}</p></div>
                                                                                                <div><span className="font-bold text-muted-foreground uppercase text-[9px]">Período:</span> <p>{item.justificativa?.periodo || 'N/A'}</p></div>
                                                                                            </div>
                                                                                            <div className="pt-1 border-t border-border/30">
                                                                                                <span className="font-bold text-muted-foreground uppercase text-[9px]">Motivo:</span>
                                                                                                <p className="mt-0.5 italic">{item.justificativa?.motivo || 'N/A'}</p>
                                                                                            </div>
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

                                            <div className="flex justify-between items-center p-3 mt-4 border-t">
                                                <span className="font-bold text-sm uppercase">VALOR TOTAL DO LOTE:</span>
                                                <span className="font-extrabold text-lg text-primary">{formatCurrency(totalLote)}</span>
                                            </div>
                                        </Card>

                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button className="bg-primary hover:bg-primary/90" disabled={selectedItems.length === 0 || diasOperacao <= 0} onClick={handleAddToPending}>
                                                <Save className="mr-2 h-4 w-4" /> {editingId ? "Recalcular/Revisar Lote" : "Preparar Lote"}
                                            </Button>
                                        </div>
                                    </Card>
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES) */}
                            {pendingItems.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Lote Preparado</h3>
                                    {isDirty && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Os dados foram alterados. Clique em "Recalcular/Revisar Lote" para atualizar.</AlertDescription></Alert>}
                                    
                                    {pendingItems.map((item) => (
                                        <Card key={item.tempId} className="border-2 shadow-md border-secondary bg-secondary/10">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/30">
                                                    <h4 className="font-bold text-base text-foreground">Aquisição de Material Permanente</h4>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-extrabold text-lg text-foreground">{formatCurrency(item.valor_total)}</p>
                                                        {!editingId && <Button variant="ghost" size="icon" onClick={() => setPendingItems([])}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div className="space-y-1">
                                                        <p className="font-medium">OM Favorecida: {item.organizacao} ({formatCodug(item.ug)})</p>
                                                        <p className="font-medium">OM Destino: {item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <p className="font-medium">Período: {item.dias_operacao} dias</p>
                                                        <p className="font-medium">Itens: {item.detalhes_planejamento.itens_selecionados.length} tipos</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        <Button onClick={() => saveMutation.mutate(pendingItems)} disabled={saveMutation.isPending || isDirty} className="bg-primary">
                                            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            {editingId ? "Atualizar Registro" : "Salvar no P Trab"}
                                        </Button>
                                        <Button variant="outline" onClick={resetForm} disabled={saveMutation.isPending}><XCircle className="mr-2 h-4 w-4" /> Cancelar</Button>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS */}
                            {consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> OMs Cadastradas ({consolidatedRegistros.length})</h3>
                                    {consolidatedRegistros.map((group) => (
                                        <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                <h3 className="font-bold text-lg text-primary">{group.organizacao} (UG: {formatCodug(group.ug)})</h3>
                                                <span className="font-extrabold text-xl text-primary">{formatCurrency(group.totalGeral)}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {group.records.map((reg) => (
                                                    <Card key={reg.id} className="p-3 bg-background border">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h4 className="font-semibold text-base flex items-center gap-2">Material Permanente <Badge variant="outline">{reg.fase_atividade}</Badge></h4>
                                                                <p className="text-xs text-muted-foreground">Período: {reg.dias_operacao} dias | Valor ND 52: {formatCurrency(Number(reg.valor_nd_52))}</p>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(reg)} disabled={!isPTrabEditable || pendingItems.length > 0}><Pencil className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setRecordToDelete(reg); setShowDeleteDialog(true); }} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4" /></Button>
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
                                <section className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {registros.map(reg => (
                                        <MaterialPermanenteMemoria 
                                            key={`mem-${reg.id}`}
                                            registro={reg}
                                            isPTrabEditable={isPTrabEditable}
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

            <MaterialPermanenteItemSelectorDialog 
                open={isSelectorOpen} 
                onOpenChange={setIsSelectorOpen} 
                selectedYear={selectedYear} 
                initialItems={selectedItems} 
                onSelect={(items) => {
                    setSelectedItems(items.map(item => ({
                        ...item,
                        quantidade: item.quantidade || 1
                    })));
                }} 
                onAddDiretriz={() => navigate('/config/custos-operacionais')} 
                categoria="Material Permanente"
            />

            <MaterialPermanenteJustificativaDialog 
                open={justificativaDialogOpen}
                onOpenChange={setJustificativaDialogOpen}
                itemName={itemForJustificativa?.descricao_reduzida || itemForJustificativa?.descricao_item || ""}
                data={itemForJustificativa?.justificativa || {}}
                onSave={handleSaveJustificativa}
            />

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>Deseja excluir o registro de Material Permanente da OM {recordToDelete?.organizacao}?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => recordToDelete && deleteMutation.mutate([recordToDelete.id])} className="bg-destructive">Excluir</AlertDialogAction>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default MaterialPermanenteForm;