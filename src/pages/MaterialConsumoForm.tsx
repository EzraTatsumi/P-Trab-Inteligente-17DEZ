"use client";

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
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Package, Minus, ChevronDown, ChevronUp, FileSpreadsheet, FileText } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    MaterialConsumoRegistro, 
    ConsolidatedMaterialConsumoRecord,
    AcquisitionGroup,
    calculateGroupTotals,
    generateMaterialConsumoMemoriaCalculo,
} from "@/lib/materialConsumoUtils";
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
import { cn } from "@/lib/utils"; 
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AcquisitionGroupForm from "@/components/AcquisitionGroupForm";
import MaterialConsumoMemoria from "@/components/MaterialConsumoMemoria";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 
import AcquisitionItemSelectorDialog from "@/components/AcquisitionItemSelectorDialog"; 
import { isGhostMode, GHOST_DATA, getActiveMission } from "@/lib/ghostStore";
import PageMetadata from "@/components/PageMetadata";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MaterialConsumoRegistroDB = Tables<'material_consumo_registros'>; 

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

interface CalculatedMaterialConsumo extends TablesInsert<'material_consumo_registros'> {
    tempId: string; 
    memoria_calculo_display: string; 
    totalGeral: number;
    om_favorecida: string;
    ug_favorecida: string;
    acquisitionGroups: AcquisitionGroup[];
    efetivo: number;
    dias_operacao: number;
}

interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    acquisitionGroups: AcquisitionGroup[];
}

const initialFormState: MaterialConsumoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    acquisitionGroups: [],
};

const compareFormData = (data1: MaterialConsumoFormState, data2: MaterialConsumoFormState) => {
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.efetivo !== data2.efetivo || 
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_destino !== data2.om_destino || 
        data1.ug_destino !== data2.ug_destino || 
        data1.fase_atividade !== data2.fase_atividade
    ) {
        return true;
    }
    
    const groups1 = data1.acquisitionGroups.map(g => `${g.tempId}-${g.totalValue}`).sort().join('|');
    const groups2 = data2.acquisitionGroups.map(g => `${g.tempId}-${g.totalValue}`).sort().join('|');
    
    return groups1 !== groups2;
};

const MaterialConsumoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<MaterialConsumoFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedMaterialConsumoRecord | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedMaterialConsumoRecord | null>(null); 
    
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    const [pendingGroups, setPendingGroups] = useState<CalculatedMaterialConsumo[]>([]);
    const [lastStagedFormData, setLastStagedFormData] = useState<MaterialConsumoFormState | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<AcquisitionGroup | undefined>(undefined);
    
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [itemsToPreselect, setItemsToPreselect] = useState<ItemAquisicao[]>([]);
    const [selectedItemsFromSelector, setSelectedItemsFromSelector] = useState<ItemAquisicao[] | null>(null);

    const [ghostRecords, setGhostRecords] = useState<MaterialConsumoRegistroDB[]>([]);
    
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => isGhostMode() ? Promise.resolve(GHOST_DATA.p_trab_exemplo) : fetchPTrabData(ptrabId!),
        enabled: !!ptrabId || isGhostMode(),
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<MaterialConsumoRegistroDB[]>({
        queryKey: ['materialConsumoRegistros', ptrabId],
        queryFn: () => isGhostMode() ? Promise.resolve([]) : fetchPTrabRecords('material_consumo_registros', ptrabId!),
        enabled: !!ptrabId || isGhostMode(),
        select: (data) => [...(data || [])].sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const consolidatedRegistros = useMemo<ConsolidatedMaterialConsumoRecord[]>(() => {
        const sourceRecords = isGhostMode() ? ghostRecords : (registros || []);
        if (sourceRecords.length === 0) return [];

        const groups = sourceRecords.reduce((acc, registro) => {
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

            acc[key].records.push(registro);
            acc[key].totalGeral += Number(registro.valor_total || 0);
            acc[key].totalND30 += Number(registro.valor_nd_30 || 0);
            acc[key].totalND39 += Number(registro.valor_nd_39 || 0);

            return acc;
        }, {} as Record<string, ConsolidatedMaterialConsumoRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros, ghostRecords]);
    
    const { data: omsReal, isLoading: isLoadingOmsReal } = useMilitaryOrganizations();
    const oms = isGhostMode() ? (GHOST_DATA.oms_exemplo as any[]) : omsReal;
    const isLoadingOms = isGhostMode() ? false : isLoadingOmsReal;
    
    useEffect(() => {
        if (!isLoadingPTrab && !isLoadingRegistros && isGhostMode()) {
            const timer = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('tour:avancar'));
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [isLoadingPTrab, isLoadingRegistros]);

    const prefillMission03 = useCallback(() => {
        if (isGhostMode() && getActiveMission() === '3') {
            setFormData(prev => ({
                ...prev,
                om_favorecida: "1º BIS",
                ug_favorecida: "160222",
                om_destino: "1º BIS",
                ug_destino: "160222",
                fase_atividade: "execucao",
            }));
            setSelectedOmFavorecidaId("om-1");
            setSelectedOmDestinoId("om-1");
        }
    }, []);

    useEffect(() => {
        (window as any).prefillSection2 = () => {
            setFormData(prev => ({
                ...prev,
                dias_operacao: 15,
                efetivo: 150,
            }));
        };
        (window as any).forcePrefillMission03 = prefillMission03;
        return () => { 
            delete (window as any).prefillSection2; 
            delete (window as any).forcePrefillMission03;
        };
    }, [prefillMission03]);

    const mapToDbInsert = (g: CalculatedMaterialConsumo): TablesInsert<'material_consumo_registros'> => {
        const group = g.acquisitionGroups[0];
        return {
            p_trab_id: g.p_trab_id,
            organizacao: g.organizacao,
            ug: g.ug,
            om_detentora: g.om_detentora,
            ug_detentora: g.ug_detentora,
            dias_operacao: g.dias_operacao,
            efetivo: g.efetivo,
            fase_atividade: g.fase_atividade,
            group_name: group.groupName,
            group_purpose: group.groupPurpose,
            itens_aquisicao: group.items as unknown as Json,
            valor_total: g.valor_total,
            valor_nd_30: g.valor_nd_30,
            valor_nd_39: g.valor_nd_39,
            detalhamento_customizado: g.detalhamento_customizado,
        };
    };

    const insertMutation = useMutation({
        mutationFn: async (newGroups: CalculatedMaterialConsumo[]) => {
            if (isGhostMode()) return newGroups;
            const recordsToInsert = newGroups.map(mapToDbInsert);
            const { error } = await supabase.from('material_consumo_registros').insert(recordsToInsert);
            if (error) throw error;
            return recordsToInsert;
        },
        onSuccess: (data) => {
            if (isGhostMode() && Array.isArray(data)) {
                const newRecords = (data as CalculatedMaterialConsumo[]).map(g => {
                    const group = g.acquisitionGroups[0];
                    return {
                        id: g.tempId,
                        p_trab_id: g.p_trab_id,
                        organizacao: g.organizacao,
                        ug: g.ug,
                        om_detentora: g.om_detentora,
                        ug_detentora: g.ug_detentora,
                        dias_operacao: g.dias_operacao,
                        efetivo: g.efetivo,
                        fase_atividade: g.fase_atividade,
                        group_name: group.groupName,
                        group_purpose: group.groupPurpose,
                        itens_aquisicao: group.items as unknown as Json,
                        valor_total: g.valor_total,
                        valor_nd_30: g.valor_nd_30,
                        valor_nd_39: g.valor_nd_39,
                        detalhamento_customizado: g.detalhamento_customizado,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as MaterialConsumoRegistroDB;
                });
                setGhostRecords(prev => [...prev, ...newRecords]);
            }
            toast.success(`Sucesso! ${pendingGroups.length} Grupo(s) de Aquisição adicionado(s)`);
            setPendingGroups([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setFormData(prev => ({ ...prev, dias_operacao: 0, efetivo: 0, fase_atividade: "", acquisitionGroups: [] }));
            resetForm();
            if (isGhostMode()) setTimeout(() => window.dispatchEvent(new CustomEvent('tour:avancar')), 300);
        },
        onError: (error) => toast.error("Falha ao salvar registros.", { description: sanitizeError(error) })
    });

    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedMaterialConsumo[] }) => {
            if (isGhostMode()) return;
            const { error: deleteError = null } = await supabase.from('material_consumo_registros').delete().in('id', oldIds);
            if (deleteError) throw deleteError;
            const recordsToInsert = newRecords.map(mapToDbInsert);
            const { error: insertError = null } = await supabase.from('material_consumo_registros').insert(recordsToInsert);
            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo atualizado com sucesso!");
            setEditingId(null);
            setPendingGroups([]);
            setGroupToReplace(null);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => toast.error("Falha ao atualizar lote.", { description: sanitizeError(error) })
    });

    const handleDeleteMutation = useMutation({
        mutationFn: async (recordIds: string[]) => {
            if (isGhostMode()) return;
            const { error } = await supabase.from('material_consumo_registros').delete().in('id', recordIds);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setGroupToDelete(null);
        },
        onError: (error) => toast.error("Falha ao excluir lote.", { description: sanitizeError(error) })
    });
    
    const isSaving = insertMutation.isPending || replaceGroupMutation.isPending || handleDeleteMutation.isPending;
    
    useEffect(() => {
        const shouldResetContext = !editingId && formData.acquisitionGroups.length === 0;
        if (ptrabData && shouldResetContext) {
            if (isGhostMode() && getActiveMission() === '3') prefillMission03();
            else {
                setFormData(prev => ({ ...initialFormState, om_favorecida: "", ug_favorecida: "", om_destino: "", ug_destino: "" }));
                setSelectedOmFavorecidaId(undefined); 
                setSelectedOmDestinoId(undefined);
            }
        }
    }, [ptrabData, oms, editingId, prefillMission03]);
    
    const handleSaveAcquisitionGroup = (group: AcquisitionGroup) => {
        const { totalValue, totalND30, totalND39 } = calculateGroupTotals(group.items);
        const finalGroup: AcquisitionGroup = { ...group, totalValue, totalND30, totalND39 };
        setFormData(prev => {
            const existingIndex = prev.acquisitionGroups.findIndex(g => g.tempId === finalGroup.tempId);
            let newGroups;
            if (existingIndex !== -1) {
                newGroups = [...prev.acquisitionGroups];
                newGroups[existingIndex] = finalGroup;
            } else {
                newGroups = [...prev.acquisitionGroups, finalGroup];
            }
            return { ...prev, acquisitionGroups: newGroups };
        });
        setIsGroupFormOpen(false);
        setGroupToEdit(undefined);
        toast.success(`Grupo "${finalGroup.groupName}" salvo no formulário.`);
    };
    
    const handleOpenGroupForm = () => { setGroupToEdit(undefined); setIsGroupFormOpen(true); };
    const handleCancelGroupForm = () => { setGroupToEdit(undefined); setIsGroupFormOpen(false); };
    const handleEditAcquisitionGroup = (group: AcquisitionGroup) => { setGroupToEdit(group); setIsGroupFormOpen(true); };
    const handleDeleteAcquisitionGroup = (tempId: string) => {
        setFormData(prev => ({ ...prev, acquisitionGroups: prev.acquisitionGroups.filter(g => g.tempId !== tempId) }));
        toast.info("Grupo de aquisição removido do formulário.");
    };
    
    const renderAcquisitionGroupsList = () => {
        const groups = formData.acquisitionGroups;
        if (groups.length === 0) {
            return (
                <Alert variant="default" className="border border-gray-300">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <AlertTitle>Nenhum Grupo Adicionado</AlertTitle>
                    <AlertDescription>Crie um grupo para selecionar os itens de aquisição necessários.</AlertDescription>
                </Alert>
            );
        }
        return (
            <div className="space-y-3">
                {groups.map(group => (
                    <Collapsible key={group.tempId} defaultOpen={false}>
                        <Card>
                            <CollapsibleTrigger asChild>
                                <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/50 transition-colors border rounded-md">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{group.groupName}</span>
                                        <Badge variant="secondary" className="text-xs">{group.items.length} Itens</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{formatCurrency(group.totalValue)}</span>
                                        {group.groupPurpose && (
                                            <TooltipProvider><Tooltip><TooltipTrigger asChild><FileText className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="max-w-xs">{group.groupPurpose}</p></TooltipContent></Tooltip></TooltipProvider>
                                        )}
                                        <ChevronDown className="h-4 w-4" />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t p-3 bg-background">
                                <div className="space-y-2">
                                    {group.groupPurpose && <p className="text-sm text-muted-foreground">Finalidade: Aquisição de Material de Consumo para atender {group.groupPurpose}.</p>}
                                    <div className="max-h-[350px] overflow-y-auto relative">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow><TableHead className="w-[100px] text-center">Qtd</TableHead><TableHead>Item</TableHead><TableHead className="text-right w-[120px]">Vlr Unitário</TableHead><TableHead className="text-right w-[120px]">Total</TableHead><TableHead className="w-[50px]"></TableHead></TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.items.map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="w-[100px] text-center text-xs">{item.quantidade}</TableCell>
                                                        <TableCell className="text-xs">{item.descricao_reduzida || item.descricao_item}<p className="text-muted-foreground text-[10px]">Cód. CATMAT: {item.codigo_catmat} | ND: {item.nd}</p><p className="text-muted-foreground text-[10px]">Pregão: {formatPregao(item.numero_pregao)} | UASG: {formatCodug(item.uasg) || 'N/A'}</p></TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(item.valor_unitario)}</TableCell>
                                                        <TableCell className="text-right text-sm font-medium">{formatCurrency(item.valor_total)}</TableCell>
                                                        <TableCell className="text-center"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled><Minus className="h-4 w-4 text-muted-foreground" /></Button></TooltipTrigger><TooltipContent>Edite no formulário do grupo</TooltipContent></Tooltip></TooltipProvider></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t mt-3"><Button type="button" variant="outline" size="sm" onClick={() => handleEditAcquisitionGroup(group)} disabled={isSaving}><Pencil className="mr-2 h-4 w-4" />Editar Grupo</Button><Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteAcquisitionGroup(group.tempId)} disabled={isSaving}><Trash2 className="mr-2 h-4 w-4" />Excluir Grupo</Button></div>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                ))}
            </div>
        );
    };
    
    const calculos = useMemo(() => {
        if (!ptrabId || formData.acquisitionGroups.length === 0) return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: "Crie e adicione pelo menos um Grupo de Aquisição.", calculatedRecords: [] };
        try {
            let totalGeral = 0; let totalND30 = 0; let totalND39 = 0;
            formData.acquisitionGroups.forEach(group => { totalGeral += group.totalValue; totalND30 += group.totalND30; totalND39 += group.totalND39; });
            const calculatedRecords: CalculatedMaterialConsumo[] = formData.acquisitionGroups.map(group => {
                const context = { organizacao: formData.om_favorecida, efetivo: formData.efetivo, dias_operacao: formData.dias_operacao, fase_atividade: formData.fase_atividade };
                const tempRecord = { id: group.tempId, p_trab_id: ptrabId!, organizacao: formData.om_favorecida, ug: formData.ug_favorecida, om_detentora: formData.om_destino, ug_detentora: formData.ug_destino, dias_operacao: formData.dias_operacao, efetivo: formData.efetivo, fase_atividade: formData.fase_atividade, group_name: group.groupName, group_purpose: group.groupPurpose, itens_aquisicao: group.items as unknown as Json, valor_total: group.totalValue, valor_nd_30: group.totalND30, valor_nd_39: group.totalND39, detalhamento_customizado: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as MaterialConsumoRegistro;
                const memoria = generateMaterialConsumoMemoriaCalculo(tempRecord, context);
                return { tempId: group.tempId, p_trab_id: ptrabId!, organizacao: formData.om_favorecida, ug: formData.ug_favorecida, om_detentora: formData.om_destino, ug_detentora: formData.ug_destino, dias_operacao: formData.dias_operacao, efetivo: formData.efetivo, fase_atividade: formData.fase_atividade, valor_total: group.totalValue, valor_nd_30: group.totalND30, valor_nd_39: group.totalND39, totalGeral: group.totalValue, memoria_calculo_display: memoria, om_favorecida: formData.om_favorecida, ug_favorecida: formData.ug_favorecida, detalhamento_customizado: null, acquisitionGroups: [group] } as CalculatedMaterialConsumo;
            });
            return { totalGeral, totalND30, totalND39, memoria: `Total de ${calculatedRecords.length} Grupo(s) de Aquisição.`, calculatedRecords };
        } catch (e) { return { totalGeral: 0, totalND30: 0, totalND39: 0, memoria: `Erro ao calcular.`, calculatedRecords: [] }; }
    }, [formData, ptrabId]);
    
    const isMaterialConsumoDirty = useMemo(() => {
        if (pendingGroups.length > 0 && lastStagedFormData) return compareFormData(formData, lastStagedFormData);
        return false;
    }, [formData, pendingGroups.length, lastStagedFormData]);
    
    const totalPendingGroups = useMemo(() => pendingGroups.reduce((sum, item) => sum + item.valor_total, 0), [pendingGroups]);
    
    const resetForm = () => {
        setEditingId(null); setGroupToReplace(null);
        setFormData(prev => ({ ...initialFormState, om_favorecida: prev.om_favorecida, ug_favorecida: prev.ug_favorecida, om_destino: prev.om_destino, ug_destino: prev.ug_destino, acquisitionGroups: [] }));
        setEditingMemoriaId(null); setMemoriaEdit(""); setLastStagedFormData(null); 
    };
    
    const handleClearPending = () => { setPendingGroups([]); setLastStagedFormData(null); setEditingId(null); setGroupToReplace(null); resetForm(); };

    const handleEdit = (group: ConsolidatedMaterialConsumoRecord) => {
        if (pendingGroups.length > 0) { toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente."); return; }
        setPendingGroups([]); setLastStagedFormData(null); setEditingId(group.records[0].id); setGroupToReplace(group); 
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug); setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora); setSelectedOmDestinoId(omDestinoToEdit?.id);
        const groupsFromRecords: AcquisitionGroup[] = group.records.map(registro => ({
            tempId: registro.id, groupName: registro.group_name, groupPurpose: registro.group_purpose || null, items: (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [],
            totalValue: Number(registro.valor_total), totalND30: Number(registro.valor_nd_30), totalND39: Number(registro.valor_nd_39),
        }));
        const newFormData: MaterialConsumoFormState = { om_favorecida: group.organizacao, ug_favorecida: group.ug, om_destino: group.om_detentora, ug_destino: group.ug_detentora, dias_operacao: group.dias_operacao, efetivo: group.efetivo, fase_atividade: group.fase_atividade || "", acquisitionGroups: groupsFromRecords };
        setFormData(newFormData);
        const newPendingItems: CalculatedMaterialConsumo[] = groupsFromRecords.map(group => {
            const context = { organizacao: newFormData.om_favorecida, efetivo: newFormData.efetivo, dias_operacao: newFormData.dias_operacao, fase_atividade: newFormData.fase_atividade };
            const tempRecord = { id: group.tempId, p_trab_id: ptrabId!, organizacao: newFormData.om_favorecida, ug: newFormData.ug_favorecida, om_detentora: newFormData.om_destino, ug_detentora: newFormData.ug_destino, dias_operacao: newFormData.dias_operacao, efetivo: newFormData.efetivo, fase_atividade: newFormData.fase_atividade, group_name: group.groupName, group_purpose: group.groupPurpose, itens_aquisicao: group.items as unknown as Json, valor_total: group.totalValue, valor_nd_30: group.totalND30, valor_nd_39: group.totalND39, detalhamento_customizado: groupToReplace?.records.find(r => r.id === group.tempId)?.detalhamento_customizado || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as MaterialConsumoRegistro;
            const memoria = generateMaterialConsumoMemoriaCalculo(tempRecord, context);
            return { tempId: group.tempId, p_trab_id: ptrabId!, organizacao: newFormData.om_favorecida, ug: newFormData.ug_favorecida, om_detentora: newFormData.om_destino, ug_detentora: newFormData.ug_destino, dias_operacao: newFormData.dias_operacao, efetivo: newFormData.efetivo, fase_atividade: newFormData.fase_atividade, valor_total: group.totalValue, valor_nd_30: group.totalND30, valor_nd_39: group.totalND39, totalGeral: group.totalValue, memoria_calculo_display: memoria, om_favorecida: newFormData.om_favorecida, ug_favorecida: newFormData.ug_favorecida, detalhamento_customizado: tempRecord.detalhamento_customizado, acquisitionGroups: [group] } as CalculatedMaterialConsumo;
        });
        setPendingGroups(newPendingItems); setLastStagedFormData(newFormData); toast.info("Modo Edição ativado."); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedMaterialConsumoRecord) => { setGroupToDelete(group); setShowDeleteDialog(true); };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.acquisitionGroups.length === 0) throw new Error("Adicione pelo menos um Grupo.");
            if (formData.dias_operacao <= 0 || formData.efetivo <= 0) throw new Error("Dados numéricos inválidos.");
            const newPendingItems: CalculatedMaterialConsumo[] = formData.acquisitionGroups.map(group => {
                const context = { organizacao: formData.om_favorecida, efetivo: formData.efetivo, dias_operacao: formData.dias_operacao, fase_atividade: formData.fase_atividade };
                const tempRecord = { id: group.tempId, p_trab_id: ptrabId!, organizacao: formData.om_favorecida, ug: formData.ug_favorecida, om_detentora: formData.om_destino, ug_detentora: formData.ug_destino, dias_operacao: formData.dias_operacao, efetivo: formData.efetivo, fase_atividade: formData.fase_atividade, group_name: group.groupName, group_purpose: group.groupPurpose, itens_aquisicao: group.items as unknown as Json, valor_total: group.totalValue, valor_nd_30: group.totalND30, valor_nd_39: group.totalND39, detalhamento_customizado: null } as any;
                const memoria = generateMaterialConsumoMemoriaCalculo(tempRecord, context);
                return { tempId: group.tempId, p_trab_id: ptrabId!, organizacao: formData.om_favorecida, ug: formData.ug_favorecida, om_detentora: formData.om_destino, ug_detentora: formData.ug_destino, dias_operacao: formData.dias_operacao, efetivo: formData.efetivo, fase_atividade: formData.fase_atividade, valor_total: group.totalValue, valor_nd_30: group.totalND30, valor_nd_39: group.totalND39, totalGeral: group.totalValue, memoria_calculo_display: memoria, om_favorecida: formData.om_favorecida, ug_favorecida: formData.ug_favorecida, acquisitionGroups: [group] } as any;
            });
            if (editingId && groupToReplace) {
                const memoriaCustomizadaTexto = groupToReplace.records.find(r => r.id === editingId)?.detalhamento_customizado;
                if (memoriaCustomizadaTexto && newPendingItems.length > 0) newPendingItems[0].detalhamento_customizado = memoriaCustomizadaTexto;
                setPendingGroups(newPendingItems); setLastStagedFormData(formData); toast.info("Cálculo atualizado.");
                return;
            }
            setPendingGroups(newPendingItems); setLastStagedFormData(formData); toast.info("Lote adicionado.");
            if (isGhostMode()) window.dispatchEvent(new CustomEvent('tour:avancar'));
        } catch (err: any) { toast.error(err.message); }
    };
    
    const handleSavePendingGroups = () => { if (pendingGroups.length > 0) insertMutation.mutate(pendingGroups); };
    const handleCommitStagedUpdate = () => { if (editingId && groupToReplace) replaceGroupMutation.mutate({ oldIds: groupToReplace.records.map(r => r.id), newRecords: pendingGroups }); };
    const handleRemovePending = (tempId: string) => { setPendingGroups(prev => { const n = prev.filter(p => p.tempId !== tempId); if (n.length === 0) setLastStagedFormData(null); return n; }); };
    
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) { setSelectedOmFavorecidaId(omData.id); setSelectedOmDestinoId(omData.id); setFormData(prev => ({ ...prev, om_favorecida: omData.nome_om, ug_favorecida: omData.codug_om, om_destino: omData.nome_om, ug_destino: omData.codug_om })); }
        else { setSelectedOmFavorecidaId(undefined); setSelectedOmDestinoId(undefined); setFormData(prev => ({ ...prev, om_favorecida: "", ug_favorecida: "", om_destino: "", ug_destino: "" })); }
    };
    
    const handleOmDestinoChange = (omData: OMData | undefined) => {
        if (omData) { setSelectedOmDestinoId(omData.id); setFormData(prev => ({ ...prev, om_destino: omData.nome_om, ug_destino: omData.codug_om })); }
        else { setSelectedOmDestinoId(undefined); setFormData(prev => ({ ...prev, om_destino: "", ug_destino: "" })); }
    };
    
    const handleFaseAtividadeChange = (fase: string) => setFormData(prev => ({ ...prev, fase_atividade: fase }));
    const handleIniciarEdicaoMemoria = (registroId: string, memoriaCompleta: string) => { setEditingMemoriaId(registroId); setMemoriaEdit(memoriaCompleta || ""); toast.info("Editando memória."); };
    const handleCancelarEdicaoMemoria = () => { setEditingMemoriaId(null); setMemoriaEdit(""); };
    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try { const { error } = await supabase.from("material_consumo_registros").update({ detalhamento_customizado: memoriaEdit.trim() || null }).eq("id", registroId); if (error) throw error; toast.success("Memória salva!"); handleCancelarEdicaoMemoria(); queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] }); }
        catch (error) { toast.error(sanitizeError(error)); }
    };
    const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
        if (!confirm("Restaurar memória automática?")) return;
        try { const { error } = await supabase.from("material_consumo_registros").update({ detalhamento_customizado: null }).eq("id", registroId); if (error) throw error; toast.success("Restaurada!"); queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] }); }
        catch (error) { toast.error(sanitizeError(error)); }
    };
    const handleAddDiretriz = () => navigate('/config/custos-operacionais', { state: { openMaterialConsumo: true } });
    const handleOpenItemSelector = (currentItems: ItemAquisicao[]) => { setItemsToPreselect(currentItems); setIsItemSelectorOpen(true); };
    const handleItemsSelected = (items: ItemAquisicao[]) => { setSelectedItemsFromSelector(items); setIsItemSelectorOpen(false); };
    const handleClearSelectedItems = () => { setSelectedItemsFromSelector(null); setItemsToPreselect([]); };

    if (isLoadingPTrab || isLoadingRegistros || isLoadingOms || isSaving) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Carregando...</span></div>;

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isBaseFormReady = formData.om_favorecida.length > 0 && formData.ug_favorecida.length > 0 && formData.fase_atividade.length > 0;
    const isSolicitationDataReady = formData.dias_operacao > 0 && formData.efetivo > 0 && formData.om_destino.length > 0;
    const isCalculationReady = isBaseFormReady && isSolicitationDataReady && formData.acquisitionGroups.length > 0;
    const itemsToDisplay = pendingGroups;
    const isStagingUpdate = !!editingId && pendingGroups.length > 0;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata title="Detalhamento de Material de Consumo" description="Lance as necessidades de material de consumo para a operação." canonicalPath="/ptrab/material-consumo" />
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
                <Card><CardHeader><CardTitle>Aquisição de Material de Consumo</CardTitle><CardDescription>Levantamento de necessidades de Material de Consumo.</CardDescription></CardHeader>
                    <CardContent><form onSubmit={handleStageCalculation} className="space-y-8">
                            <section className="space-y-4 border-b pb-6 secao-1-form-material"><h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 col-span-1"><Label>OM Favorecida *</Label>{isGhostMode() ? (<Select value={selectedOmFavorecidaId} onValueChange={(val) => { const om = GHOST_DATA.oms_exemplo.find(o => o.id === val); if (om) handleOmFavorecidaChange(om as any); }}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent className="z-[10001]">{GHOST_DATA.oms_exemplo.map(om => (<SelectItem key={om.id} value={om.id}>{om.nome_om}</SelectItem>))}</SelectContent></Select>) : (<OmSelector selectedOmId={selectedOmFavorecidaId} onChange={handleOmFavorecidaChange} placeholder="Selecione..." disabled={!isPTrabEditable || isSaving || pendingGroups.length > 0} initialOmName={editingId ? formData.om_favorecida : undefined} />)}</div>
                                    <div className="space-y-2 col-span-1"><Label>UG Favorecida</Label><Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" /></div>
                                    <div className="space-y-2 col-span-1"><Label>Fase da Atividade *</Label>{isGhostMode() ? (<Select value={formData.fase_atividade} onValueChange={handleFaseAtividadeChange}><SelectTrigger><SelectValue placeholder="Fase..." /></SelectTrigger><SelectContent className="z-[10001]"><SelectItem value="preparacao">Preparação</SelectItem><SelectItem value="execucao">Execução</SelectItem></SelectContent></Select>) : (<FaseAtividadeSelect value={formData.fase_atividade} onChange={handleFaseAtividadeChange} disabled={!isPTrabEditable || isSaving || pendingGroups.length > 0} />)}</div>
                                </div>
                            </section>
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6 secao-2-planejamento"><h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Planejamento</h3>
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4 tour-planning-container"><Card className="rounded-lg mb-4"><CardHeader className="py-3"><CardTitle className="text-base">Período, Efetivo e Destino</CardTitle></CardHeader><CardContent className="pt-2"><div className="p-4 bg-background rounded-lg border"><div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <div className="space-y-2 col-span-1"><Label>Nr Dias *</Label><Input type="number" min={1} value={formData.dias_operacao === 0 ? "" : formData.dias_operacao} onChange={(e) => setFormData({ ...formData, dias_operacao: parseInt(e.target.value) || 0 })} disabled={!isPTrabEditable} className="[appearance:textfield]" /></div>
                                                        <div className="space-y-2 col-span-1"><Label>Efetivo *</Label><Input type="number" min={1} value={formData.efetivo === 0 ? "" : formData.efetivo} onChange={(e) => setFormData({ ...formData, efetivo: parseInt(e.target.value) || 0 })} disabled={!isPTrabEditable} className="[appearance:textfield]" /></div>
                                                        <div className="space-y-2 col-span-1"><Label>OM Destino *</Label>{isGhostMode() ? (<Select value={selectedOmDestinoId} onValueChange={(val) => { const om = GHOST_DATA.oms_exemplo.find(o => o.id === val); if (om) handleOmDestinoChange(om as any); }}><SelectTrigger><SelectValue placeholder="..." /></SelectTrigger><SelectContent className="z-[10001]">{GHOST_DATA.oms_exemplo.map(om => (<SelectItem key={om.id} value={om.id}>{om.nome_om}</SelectItem>))}</SelectContent></Select>) : (<OmSelector selectedOmId={selectedOmDestinoId} onChange={handleOmDestinoChange} placeholder="..." disabled={!isPTrabEditable || pendingGroups.length > 0} initialOmName={editingId ? formData.om_destino : formData.om_favorecida} />)}</div>
                                                        <div className="space-y-2 col-span-1"><Label>UG Destino</Label><Input value={formatCodug(formData.ug_destino)} disabled className="bg-muted/50" /></div>
                                                    </div></div></CardContent></Card>
                                        <Card className="mt-4 rounded-lg p-4 bg-background"><h4 className="text-base font-semibold mb-4">Grupos de Aquisição ({formData.acquisitionGroups.length})</h4>
                                            {isGroupFormOpen && <AcquisitionGroupForm initialGroup={groupToEdit} onSave={handleSaveAcquisitionGroup} onCancel={handleCancelGroupForm} isSaving={isSaving} onOpenItemSelector={handleOpenItemSelector} selectedItemsFromSelector={selectedItemsFromSelector} onClearSelectedItems={handleClearSelectedItems} />}
                                            {!isGroupFormOpen && renderAcquisitionGroupsList()}
                                            {!isGroupFormOpen && <div className="flex justify-end mt-4"><Button type="button" onClick={() => { handleOpenGroupForm(); if (isGhostMode()) window.dispatchEvent(new CustomEvent('tour:avancar')); }} disabled={!isPTrabEditable} variant="outline" className="w-full btn-criar-grupo"><Plus className="mr-2 h-4 w-4" />Criar Novo Grupo</Button></div>}
                                            <div className="flex justify-between items-center p-3 mt-4 border-t"><span className="bold text-sm">TOTAL:</span><span className="font-extrabold text-lg text-primary">{formatCurrency(calculos.totalGeral)}</span></div>
                                        </Card>
                                        <div className="flex justify-end gap-3 pt-4"><Button type="submit" disabled={!isPTrabEditable || isSaving || !isCalculationReady || isGroupFormOpen} className="w-full md:w-auto"><Save className="mr-2 h-4 w-4" />{editingId ? "Recalcular Lote" : "Salvar na Lista"}</Button></div>
                                    </Card></section>
                            )}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6 tour-section-3-pending"><h3 className="text-lg font-semibold">3. {editingId ? "Revisão" : "Itens Adicionados"} ({itemsToDisplay.length})</h3>
                                    {isMaterialConsumoDirty && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Altere e clique em "Salvar na Lista" para atualizar.</AlertDescription></Alert>}
                                    <div className="space-y-4">{itemsToDisplay.map((item) => (
                                                <Card key={item.tempId} className="border-2 shadow-md border-secondary bg-secondary/10"><CardContent className="p-4"><div className="flex justify-between items-center border-b pb-2 mb-2"><h4 className="font-bold">{item.acquisitionGroups[0]?.groupName}</h4><div className="flex items-center gap-2"><p className="font-extrabold">{formatCurrency(item.valor_total)}</p>{!isStagingUpdate && <Button variant="ghost" size="icon" onClick={() => handleRemovePending(item.tempId)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></div><div className="grid grid-cols-2 gap-4 text-xs"><div><p>Favorecida:</p><p>Período:</p></div><div className="text-right"><p>{item.om_favorecida}</p><p>{item.dias_operacao} dias / {item.efetivo} mil.</p></div></div></CardContent></Card>
                                            ))}</div>
                                    <Card className="bg-gray-100"><CardContent className="p-4 flex justify-between"><span>TOTAL LOTE</span><span className="font-extrabold">{formatCurrency(totalPendingGroups)}</span></CardContent></Card>
                                    <div className="flex justify-end gap-3 pt-4">{isStagingUpdate ? <><Button onClick={handleCommitStagedUpdate} disabled={isSaving || isMaterialConsumoDirty}><Check className="mr-2 h-4 w-4" />Atualizar</Button><Button variant="outline" onClick={handleClearPending}>Cancelar</Button></> : <><Button onClick={handleSavePendingGroups} disabled={isSaving || isMaterialConsumoDirty}><Save className="mr-2 h-4 w-4" />Salvar Registros</Button><Button variant="outline" onClick={handleClearPending}>Limpar</Button></>}</div>
                                </section>
                            )}
                            {consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6 tour-section-4-saved"><h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" />OMs Cadastradas ({consolidatedRegistros.length})</h3>
                                    {consolidatedRegistros.map((group) => (
                                            <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20"><div className="flex items-center justify-between border-b pb-2 mb-3"><h3 className="font-bold text-primary">{group.organizacao}</h3><span className="font-extrabold">{formatCurrency(group.totalGeral)}</span></div><div className="space-y-3">{group.records.map((registro) => (
                                                            <Card key={registro.id} className="p-3 bg-background"><div className="flex items-center justify-between"><div><h4 className="font-semibold text-sm">{registro.group_name}</h4><p className="text-xs text-muted-foreground">{registro.dias_operacao} dias | {registro.efetivo} mil.</p></div><div className="flex items-center gap-2"><span>{formatCurrency(Number(registro.valor_total))}</span><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(group)} disabled={!isPTrabEditable || pendingGroups.length > 0}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleConfirmDelete(group)} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></div></Card>
                                                        ))}</div></Card>
                                        ))}
                                </section>
                            )}
                            {consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8 tour-section-5-memories"><h3 className="text-xl font-bold">📋 Memórias de Cálculos</h3>
                                    {consolidatedRegistros.map(group => group.records.map(registro => (<MaterialConsumoMemoria key={`memoria-${registro.id}`} registro={registro} context={{ organizacao: group.organizacao, efetivo: group.efetivo, dias_operacao: group.dias_operacao, fase_atividade: group.fase_atividade }} isPTrabEditable={isPTrabEditable} isSaving={isSaving} editingMemoriaId={editingMemoriaId} memoriaEdit={memoriaEdit} setMemoriaEdit={setMemoriaEdit} handleIniciarEdicaoMemoria={handleIniciarEdicaoMemoria} handleCancelarEdicaoMemoria={handleCancelarEdicaoMemoria} handleSalvarMemoriaCustomizada={handleSalvarMemoriaCustomizada} handleRestaurarMemoriaAutomatica={handleRestaurarMemoriaAutomatica} />)))}
                                </div>
                            )}
                        </form></CardContent></Card>
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Lote?</AlertDialogTitle><AlertDialogDescription>Excluir Material de Consumo para {groupToDelete?.organizacao}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={() => groupToDelete && handleDeleteMutation.mutate(groupToDelete.records.map(r => r.id))} className="bg-destructive">Excluir</AlertDialogAction><AlertDialogCancel>Cancelar</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
                <AcquisitionItemSelectorDialog open={isItemSelectorOpen} onOpenChange={setIsItemSelectorOpen} selectedYear={new Date().getFullYear()} initialItems={itemsToPreselect} onSelect={handleItemsSelected} onAddDiretriz={handleAddDiretriz} />
            </div>
        </div>
    );
};

export default MaterialConsumoForm;