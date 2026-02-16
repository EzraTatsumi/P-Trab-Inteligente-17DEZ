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
import { 
    ArrowLeft, 
    Loader2, 
    Save, 
    Sparkles, 
    AlertCircle, 
    Trash2, 
    Plus, 
    XCircle, 
    Pencil,
    Info
} from "lucide-react";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency, formatPregao } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { Badge } from "@/components/ui/badge";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
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

interface ItemAquisicaoExtended {
    id: string;
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida?: string;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    quantidade: number;
    // Novos campos de justificativa
    proposito?: string;
    destinacao?: string;
    local?: string;
    finalidade?: string;
    periodo?: string;
    motivo?: string;
}

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
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });
    const [categoria, setCategoria] = useState("Material Permanente");

    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoExtended[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    const [pendingItems, setPendingItems] = useState<PendingPermanenteItem[]>([]);
    const [lastStagedState, setLastStagedState] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<any>(null);

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

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
            omDestino.id !== lastStagedState.omDestinoId
        );

        if (contextChanged) return true;

        const currentItemsKey = selectedItems.map(i => `${i.id}-${i.quantidade}-${i.proposito}-${i.motivo}`).sort().join('|');
        return currentItemsKey !== lastStagedState.itemsKey;
    }, [omFavorecida, faseAtividade, omDestino, selectedItems, lastStagedState, pendingItems]);

    // --- MUTATIONS ---
    const saveMutation = useMutation({
        mutationFn: async (itemsToSave: PendingPermanenteItem[]) => {
            const idsToDelete = itemsToSave.map(i => i.dbId).filter(Boolean) as string[];
            
            if (idsToDelete.length > 0) {
                await supabase.from('material_permanente_registros').delete().in('id', idsToDelete);
            }

            const records = itemsToSave.map(item => {
                // Gerar memória de cálculo automática baseada nas respostas
                const memorias = item.detalhes_planejamento.itens_selecionados.map((it: ItemAquisicaoExtended) => {
                    const header = `44.90.52 - Aquisição de ${it.proposito || '[Propósito]'} para atender ${it.finalidade || '[Finalidade]'} do ${it.destinacao || '[Destinação]'}, no ${it.local || '[Local]'}, a fim de manter a capacidade de trabalho durante ${it.periodo || '[Período]'}. Justifica-se essa aquisição pela necessidade de ${it.motivo || '[Motivo]'}.`;
                    const calculo = `- ${it.descricao_reduzida || it.descricao_item}: ${formatCurrency(it.valor_unitario)}/ unid.`;
                    const formula = `- ${it.quantidade} ${it.descricao_reduzida || it.descricao_item} x ${formatCurrency(it.valor_unitario)}/unid = ${formatCurrency(it.quantidade * it.valor_unitario)}.`;
                    const total = `Total: ${formatCurrency(it.quantidade * it.valor_unitario)}.`;
                    const rodape = `(Pregão ${formatPregao(it.numero_pregao)} - UASG ${it.uasg}).`;
                    
                    return `${header}\n\nCálculo:\n${calculo}\n\nFórmula:\n${formula}\n\n${total}\n${rodape}`;
                }).join('\n\n---\n\n');

                return {
                    p_trab_id: ptrabId,
                    organizacao: item.organizacao,
                    ug: item.ug,
                    om_detentora: item.om_detentora,
                    ug_detentora: item.ug_detentora,
                    dias_operacao: 1, // Valor padrão pois não é mais usado no cálculo
                    efetivo: 0, // Valor padrão pois não é mais usado no cálculo
                    fase_atividade: item.fase_atividade,
                    categoria: item.categoria,
                    detalhes_planejamento: item.detalhes_planejamento,
                    detalhamento: memorias,
                    valor_total: item.valor_total,
                    valor_nd_52: item.valor_nd_52,
                };
            });
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
        setFaseAtividade("");
        setEditingId(null);
        setActiveCompositionId(null);
    };

    const handleOmFavorecidaChange = (omData: any) => {
        if (omData) {
            setOmFavorecida({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
            if (!omDestino.id) setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
        } else setOmFavorecida({ nome: "", ug: "", id: "" });
    };

    const handleUpdateItemField = (id: string, field: keyof ItemAquisicaoExtended, value: any) => {
        setSelectedItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAddToPending = () => {
        if (selectedItems.length === 0) {
            toast.warning("Selecione pelo menos um item.");
            return;
        }

        // Validar se todos os campos de justificativa foram preenchidos
        const incomplete = selectedItems.some(it => !it.proposito || !it.destinacao || !it.local || !it.finalidade || !it.periodo || !it.motivo);
        if (incomplete) {
            toast.warning("Por favor, preencha todos os campos de justificativa para cada item.");
            return;
        }

        const compositionId = editingId || activeCompositionId || crypto.randomUUID();
        if (!editingId && !activeCompositionId) setActiveCompositionId(compositionId);

        const totalGeral = selectedItems.reduce((acc, it) => acc + (it.quantidade * it.valor_unitario), 0);
        
        const newItem: PendingPermanenteItem = {
            tempId: compositionId,
            dbId: editingId || undefined,
            organizacao: omFavorecida.nome,
            ug: omFavorecida.ug,
            om_detentora: omDestino.nome,
            ug_detentora: omDestino.ug || omFavorecida.ug,
            dias_operacao: 1,
            efetivo: 0,
            fase_atividade: faseAtividade,
            categoria: categoria,
            detalhes_planejamento: { 
                itens_selecionados: selectedItems
            },
            valor_total: totalGeral,
            valor_nd_52: totalGeral,
        };

        setPendingItems([newItem]);

        setLastStagedState({
            omFavorecidaId: omFavorecida.id,
            faseAtividade,
            omDestinoId: omDestino.id,
            itemsKey: selectedItems.map(i => `${i.id}-${i.quantidade}-${i.proposito}-${i.motivo}`).sort().join('|')
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
        
        const omDest = oms?.find(om => om.nome_om === reg.om_detentora && om.codug_om === reg.ug_detentora);
        setOmDestino({ nome: reg.om_detentora || "", ug: reg.ug_detentora || "", id: omDest?.id || "" });

        const details = reg.detalhes_planejamento;
        setSelectedItems(details?.itens_selecionados || []);

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
                        <CardDescription>Planejamento de necessidades de materiais permanentes com justificativa detalhada.</CardDescription>
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
                                                <CardTitle className="text-base font-semibold">Destino do Recurso</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                <h4 className="text-base font-semibold flex items-center gap-2">Itens e Justificativas</h4>
                                                <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)} disabled={!isPTrabEditable}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button>
                                            </div>

                                            {selectedItems.length > 0 ? (
                                                <div className="space-y-6">
                                                    {selectedItems.map((item) => (
                                                        <Card key={item.id} className="border-2 border-primary/10 overflow-hidden">
                                                            <div className="bg-primary/5 p-3 border-b flex justify-between items-center">
                                                                <div className="flex items-center gap-3">
                                                                    <Badge variant="secondary" className="font-mono">{item.codigo_catmat}</Badge>
                                                                    <span className="font-bold text-sm">{item.descricao_reduzida || item.descricao_item}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Qtd:</Label>
                                                                        <Input type="number" min={1} value={item.quantidade || ""} onChange={(e) => handleUpdateItemField(item.id, 'quantidade', parseInt(e.target.value) || 0)} className="h-8 w-16 text-center font-bold" />
                                                                    </div>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4" /></Button>
                                                                </div>
                                                            </div>
                                                            <CardContent className="p-4 space-y-4">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold flex items-center gap-1">Propósito (Obj imediato?) <Info className="h-3 w-3 text-muted-foreground" /></Label>
                                                                        <Input value={item.proposito || ""} onChange={(e) => handleUpdateItemField(item.id, 'proposito', e.target.value)} placeholder="Ex: Eqp Informática" className="h-8 text-xs" />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold flex items-center gap-1">Destinação (Para quem?) Seç/OM <Info className="h-3 w-3 text-muted-foreground" /></Label>
                                                                        <Input value={item.destinacao || ""} onChange={(e) => handleUpdateItemField(item.id, 'destinacao', e.target.value)} placeholder="Ex: Cmdo / 23ª Bda Inf Sl" className="h-8 text-xs" />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold flex items-center gap-1">Local (Onde será empregado?) <Info className="h-3 w-3 text-muted-foreground" /></Label>
                                                                        <Input value={item.local || ""} onChange={(e) => handleUpdateItemField(item.id, 'local', e.target.value)} placeholder="Ex: nos COI das Base Op e Log" className="h-8 text-xs" />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold flex items-center gap-1">Finalidade (Para quê?) Obj Geral <Info className="h-3 w-3 text-muted-foreground" /></Label>
                                                                        <Input value={item.finalidade || ""} onChange={(e) => handleUpdateItemField(item.id, 'finalidade', e.target.value)} placeholder="Ex: atender as necessidades computacionais" className="h-8 text-xs" />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold flex items-center gap-1">Período (Quando?) <Info className="h-3 w-3 text-muted-foreground" /></Label>
                                                                        <Input value={item.periodo || ""} onChange={(e) => handleUpdateItemField(item.id, 'periodo', e.target.value)} placeholder="Ex: durante operação" className="h-8 text-xs" />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-[11px] font-bold flex items-center gap-1">Motivo (Porque?) <Info className="h-3 w-3 text-muted-foreground" /></Label>
                                                                        <Input value={item.motivo || ""} onChange={(e) => handleUpdateItemField(item.id, 'motivo', e.target.value)} placeholder="Ex: necessidade de disponibilizar terminais" className="h-8 text-xs" />
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center pt-2 border-t text-[10px] text-muted-foreground">
                                                                    <span>Pregão: {formatPregao(item.numero_pregao)} | UASG: {item.uasg}</span>
                                                                    <span className="font-bold text-foreground">Subtotal: {formatCurrency(item.quantidade * item.valor_unitario)}</span>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">Selecione itens da diretriz para iniciar o planejamento.</div>
                                            )}

                                            <div className="flex justify-between items-center p-3 mt-4 border-t">
                                                <span className="font-bold text-sm uppercase">VALOR TOTAL DO LOTE:</span>
                                                <span className="font-extrabold text-lg text-primary">{formatCurrency(totalLote)}</span>
                                            </div>
                                        </Card>

                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button className="bg-primary hover:bg-primary/90" disabled={selectedItems.length === 0} onClick={handleAddToPending}>
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
                                                        <p className="font-medium">Itens: {item.detalhes_planejamento.itens_selecionados.length} tipos</p>
                                                        <p className="font-medium italic text-muted-foreground">Justificativas preenchidas</p>
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
                                                                <p className="text-xs text-muted-foreground">Itens: {reg.detalhes_planejamento.itens_selecionados.length} | Valor ND 52: {formatCurrency(Number(reg.valor_nd_52))}</p>
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
                        quantidade: item.quantidade || 1,
                        proposito: item.proposito || "",
                        destinacao: item.destinacao || "",
                        local: item.local || "",
                        finalidade: item.finalidade || "",
                        periodo: item.periodo || "",
                        motivo: item.motivo || ""
                    })));
                }} 
                onAddDiretriz={() => navigate('/config/custos-operacionais')} 
                categoria="Material Permanente"
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