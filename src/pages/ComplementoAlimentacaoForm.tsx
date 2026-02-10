import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Plus, XCircle, Pencil, Sparkles, AlertCircle, Check, Utensils, Droplets, Coffee } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TablesInsert, Json } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcquisitionGroupForm from "@/components/AcquisitionGroupForm";
import ComplementoAlimentacaoMemoria from "@/components/ComplementoAlimentacaoMemoria";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import AcquisitionItemSelectorDialog from "@/components/AcquisitionItemSelectorDialog"; 
import PageMetadata from "@/components/PageMetadata";
import { PublicoSelect } from "@/components/PublicoSelect";
import CurrencyInput from "@/components/CurrencyInput";

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
    publico: "Militares",
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
    const [pendingGroups, setPendingGroups] = useState<any[]>([]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedComplementoRecord | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmQrId, setSelectedOmQrId] = useState<string | undefined>(undefined);
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [itemsToPreselect, setItemsToPreselect] = useState<ItemAquisicao[]>([]);
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");

    const { data: ptrabData } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<any[]>({
        queryKey: ['materialConsumoRegistros', ptrabId, 'complemento'],
        queryFn: () => fetchPTrabRecords('material_consumo_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.filter(r => r.group_name?.includes('Complemento') || r.group_name?.includes('Gênero')),
    });

    const consolidatedRegistros = useMemo<ConsolidatedComplementoRecord[]>(() => {
        if (!registros) return [];
        const groups = registros.reduce((acc, r) => {
            const key = `${r.organizacao}|${r.ug}|${r.dias_operacao}|${r.efetivo}|${r.fase_atividade}`;
            if (!acc[key]) {
                acc[key] = {
                    groupKey: key, organizacao: r.organizacao, ug: r.ug, om_detentora: r.om_detentora,
                    ug_detentora: r.ug_detentora, dias_operacao: r.dias_operacao, efetivo: r.efetivo,
                    fase_atividade: r.fase_atividade, records: [], totalGeral: 0, totalND30: 0, totalND39: 0
                };
            }
            acc[key].records.push(r);
            acc[key].totalGeral += Number(r.valor_total);
            acc[key].totalND30 += Number(r.valor_nd_30);
            acc[key].totalND39 += Number(r.valor_nd_39);
            return acc;
        }, {} as Record<string, ConsolidatedComplementoRecord>);
        return Object.values(groups);
    }, [registros]);

    const { data: oms } = useMilitaryOrganizations();

    const insertMutation = useMutation({
        mutationFn: async (groups: any[]) => {
            const records = groups.map(g => ({
                p_trab_id: ptrabId,
                organizacao: g.organizacao,
                ug: g.ug,
                om_detentora: g.om_detentora,
                ug_detentora: g.ug_detentora,
                dias_operacao: g.dias_operacao,
                efetivo: g.efetivo,
                fase_atividade: g.fase_atividade,
                group_name: g.group_name,
                group_purpose: g.group_purpose,
                itens_aquisicao: g.itens_aquisicao as unknown as Json,
                valor_total: g.valor_total,
                valor_nd_30: g.valor_nd_30,
                valor_nd_39: g.valor_nd_39,
            }));
            const { error } = await supabase.from('material_consumo_registros').insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registros salvos com sucesso!");
            setPendingGroups([]);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('material_consumo_registros').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote excluído!");
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            setShowDeleteDialog(false);
        }
    });

    const handleStageCalculation = () => {
        const isGenero = formData.categoria_complemento === 'genero';
        let newItems = [];

        if (isGenero) {
            const totalQS = formData.efetivo * formData.dias_operacao * formData.valor_etapa_qs;
            const totalQR = formData.efetivo * formData.dias_operacao * formData.valor_etapa_qr;
            
            newItems.push({
                tempId: crypto.randomUUID(),
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_qr,
                ug_detentora: formData.ug_qr,
                dias_operacao: formData.dias_operacao,
                efetivo: formData.efetivo,
                fase_atividade: formData.fase_atividade,
                group_name: `Gênero Alimentício (${formData.publico})`,
                categoria_complemento: 'genero',
                generoData: { ...formData },
                valor_total: totalQS + totalQR,
                valor_nd_30: totalQS + totalQR,
                valor_nd_39: 0,
                itens_aquisicao: []
            });
        } else {
            formData.acquisitionGroups.forEach(g => {
                newItems.push({
                    tempId: g.tempId,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino || formData.om_favorecida,
                    ug_detentora: formData.ug_destino || formData.ug_favorecida,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    group_name: `Complemento (${g.groupName})`,
                    categoria_complemento: formData.categoria_complemento,
                    valor_total: g.totalValue,
                    valor_nd_30: g.totalND30,
                    valor_nd_39: g.totalND39,
                    itens_aquisicao: g.items
                });
            });
        }

        setPendingGroups([...pendingGroups, ...newItems]);
        toast.info("Itens adicionados à lista pendente.");
    };

    const handleOmFavorecidaChange = (omData: any) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmQrId(omData.id);
            setFormData(prev => ({ 
                ...prev, om_favorecida: omData.nome_om, ug_favorecida: omData.codug_om, 
                rm_vinculacao: omData.rm_vinculacao, codug_rm_vinculacao: omData.codug_rm_vinculacao,
                om_qs: omData.rm_vinculacao, ug_qs: omData.codug_rm_vinculacao,
                om_qr: omData.nome_om, ug_qr: omData.codug_om, om_destino: omData.nome_om, ug_destino: omData.codug_om
            }));
        }
    };

    const isBaseFormReady = formData.om_favorecida.length > 0 && formData.fase_atividade.length > 0;
    const isGenero = formData.categoria_complemento === 'genero';

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
                        <CardTitle>Complemento de Alimentação</CardTitle>
                        <CardDescription>Levantamento de necessidades de Gêneros, Água e Lanches.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={selectedOmFavorecidaId} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData({...formData, fase_atividade: f})} />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR COMPLEMENTO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Complemento</h3>
                                    <Tabs value={formData.categoria_complemento} onValueChange={(v: any) => setFormData({...formData, categoria_complemento: v})}>
                                        <TabsList className="grid w-full grid-cols-3 mb-6">
                                            <TabsTrigger value="genero"><Utensils className="h-4 w-4 mr-2" />Gênero</TabsTrigger>
                                            <TabsTrigger value="agua"><Droplets className="h-4 w-4 mr-2" />Água</TabsTrigger>
                                            <TabsTrigger value="lanche"><Coffee className="h-4 w-4 mr-2" />Lanche</TabsTrigger>
                                        </TabsList>

                                        <Card className="bg-muted/50 p-4">
                                            <div className="space-y-6 bg-background p-4 rounded-lg border">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Efetivo *</Label>
                                                        <Input type="number" value={formData.efetivo || ""} onChange={(e) => setFormData({...formData, efetivo: parseInt(e.target.value) || 0})} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Público *</Label>
                                                        <PublicoSelect value={formData.publico} onChange={(v) => setFormData({...formData, publico: v})} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Período (Nr Dias) *</Label>
                                                        <Input type="number" value={formData.dias_operacao || ""} onChange={(e) => setFormData({...formData, dias_operacao: parseInt(e.target.value) || 0})} />
                                                    </div>
                                                </div>

                                                {isGenero && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                                        <div className="space-y-4 p-4 bg-primary/5 rounded-md border border-primary/10">
                                                            <h4 className="font-bold text-sm text-primary uppercase">QS (Subsistência)</h4>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2"><Label>Valor Etapa</Label><CurrencyInput value={formData.valor_etapa_qs} onChange={(v) => setFormData({...formData, valor_etapa_qs: v})} /></div>
                                                                <div className="space-y-2"><Label>Pregão</Label><Input value={formData.pregao_qs} onChange={(e) => setFormData({...formData, pregao_qs: e.target.value})} /></div>
                                                            </div>
                                                            <div className="space-y-2"><Label>UASG (RM)</Label><RmSelector value={formData.om_qs} onChange={(n, c) => setFormData({...formData, om_qs: n, ug_qs: c})} /></div>
                                                        </div>
                                                        <div className="space-y-4 p-4 bg-orange-500/5 rounded-md border border-orange-500/10">
                                                            <h4 className="font-bold text-sm text-orange-600 uppercase">QR (Rancho)</h4>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2"><Label>Valor Etapa</Label><CurrencyInput value={formData.valor_etapa_qr} onChange={(v) => setFormData({...formData, valor_etapa_qr: v})} /></div>
                                                                <div className="space-y-2"><Label>Pregão</Label><Input value={formData.pregao_qr} onChange={(e) => setFormData({...formData, pregao_qr: e.target.value})} /></div>
                                                            </div>
                                                            <div className="space-y-2"><Label>UASG (OM)</Label><OmSelector selectedOmId={selectedOmQrId} onChange={(om) => setFormData({...formData, om_qr: om?.nome_om || "", ug_qr: om?.codug_om || ""})} /></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {!isGenero && (
                                                <div className="mt-6">
                                                    <Card className="p-4 bg-background">
                                                        {isGroupFormOpen ? (
                                                            <AcquisitionGroupForm onSave={(g) => { setFormData(prev => ({...prev, acquisitionGroups: [...prev.acquisitionGroups, g]})); setIsGroupFormOpen(false); }} onCancel={() => setIsGroupFormOpen(false)} onOpenItemSelector={(items) => { setItemsToPreselect(items); setIsItemSelectorOpen(true); }} />
                                                        ) : (
                                                            <Button variant="outline" className="w-full" onClick={() => setIsGroupFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Adicionar Itens</Button>
                                                        )}
                                                    </Card>
                                                </div>
                                            )}

                                            <div className="mt-6 flex justify-end">
                                                <Button onClick={handleStageCalculation} disabled={formData.efetivo <= 0}>
                                                    <Save className="mr-2 h-4 w-4" /> Salvar Itens na Lista
                                                </Button>
                                            </div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES) */}
                            {pendingGroups.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold">3. Itens Adicionados (Pendentes)</h3>
                                    <div className="grid gap-4">
                                        {pendingGroups.map(item => (
                                            <Card key={item.tempId} className="p-4 border-secondary bg-secondary/5">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-bold">{item.group_name}</p>
                                                        <p className="text-xs text-muted-foreground">{item.organizacao} | {item.efetivo} militares | {item.dias_operacao} dias</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <p className="font-bold">{formatCurrency(item.valor_total)}</p>
                                                        <Button variant="ghost" size="icon" onClick={() => setPendingGroups(pendingGroups.filter(p => p.tempId !== item.tempId))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setPendingGroups([])}>Limpar Lista</Button>
                                        <Button onClick={() => insertMutation.mutate(pendingGroups)} disabled={insertMutation.isPending}>Confirmar e Salvar no Banco</Button>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS */}
                            {consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> OMs Cadastradas</h3>
                                    {consolidatedRegistros.map(group => (
                                        <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                                <h4 className="font-bold text-primary">{group.organizacao} ({formatCodug(group.ug)})</h4>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-extrabold text-lg">{formatCurrency(group.totalGeral)}</span>
                                                    <Button variant="ghost" size="icon" onClick={() => { setGroupToDelete(group); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                {group.records.map(r => (
                                                    <div key={r.id} className="flex justify-between text-sm bg-background p-2 rounded border">
                                                        <span>{r.group_name}</span>
                                                        <span className="font-medium">{formatCurrency(r.valor_total)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULO */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4">
                                    <h3 className="text-lg font-bold">📋 Memórias de Cálculos Detalhadas</h3>
                                    {registros.map(r => (
                                        <ComplementoAlimentacaoMemoria 
                                            key={r.id} registro={r} context={r} isPTrabEditable={true} isSaving={false}
                                            editingMemoriaId={editingMemoriaId} memoriaEdit={memoriaEdit} setMemoriaEdit={setMemoriaEdit}
                                            handleIniciarEdicaoMemoria={(id, text) => { setEditingMemoriaId(id); setMemoriaEdit(text); }}
                                            handleCancelarEdicaoMemoria={() => setEditingMemoriaId(null)}
                                            handleSalvarMemoriaCustomizada={async (id) => { await supabase.from('material_consumo_registros').update({ detalhamento_customizado: memoriaEdit }).eq('id', id); setEditingMemoriaId(null); queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros'] }); }}
                                            handleRestaurarMemoriaAutomatica={async (id) => { await supabase.from('material_consumo_registros').update({ detalhamento_customizado: null }).eq('id', id); queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros'] }); }}
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
                    <AlertDialogHeader><AlertDialogTitle>Excluir Lote?</AlertDialogTitle><AlertDialogDescription>Deseja excluir todos os registros de complemento para {groupToDelete?.organizacao}?</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive" onClick={() => groupToDelete && deleteMutation.mutate(groupToDelete.records.map(r => r.id))}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AcquisitionItemSelectorDialog open={isItemSelectorOpen} onOpenChange={setIsItemSelectorOpen} selectedYear={new Date().getFullYear()} initialItems={itemsToPreselect} onSelect={(items) => { setFormData(prev => ({...prev, acquisitionGroups: prev.acquisitionGroups.map(g => g.tempId === itemsToPreselect[0]?.id ? {...g, items} : g)})); setIsItemSelectorOpen(false); }} />
        </div>
    );
};

export default ComplementoAlimentacaoForm;