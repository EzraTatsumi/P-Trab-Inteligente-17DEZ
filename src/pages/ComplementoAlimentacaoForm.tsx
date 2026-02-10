import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Package, Minus, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Utensils, Droplets, Coffee, Eraser } from "lucide-react";
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

interface LancheItem {
    id: string;
    descricao: string;
    quantidade: number;
    valor_unitario: number;
}

// Tipo para o item calculado na lista pendente
interface StagedComplemento {
    tempId: string;
    categoria: 'genero' | 'agua' | 'lanche';
    om_favorecida: string;
    ug_favorecida: string;
    om_destino: string;
    ug_destino: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    publico: string;
    
    // Valores calculados
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
    
    // Detalhes específicos para Gênero
    total_qs?: number;
    total_qr?: number;
    
    // Itens para Lanche
    lanche_items?: LancheItem[];
    
    // Dados brutos do formulário para o dirty check
    formDataSnapshot: any;
}

// Estado inicial para o formulário
interface ComplementoAlimentacaoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    om_destino: string; 
    ug_destino: string; 
    fase_atividade: string;
    categoria_complemento: 'genero' | 'agua' | 'lanche';
    
    // Gênero Alimentício
    genero_efetivo: number;
    genero_dias: number;
    publico: string;
    valor_etapa_qs: number;
    pregao_qs: string;
    om_qs: string;
    ug_qs: string;
    valor_etapa_qr: number;
    pregao_qr: string;
    om_qr: string;
    ug_qr: string;

    // Água Mineral
    agua_efetivo: number;
    agua_dias: number;
    agua_consumo_dia: number;
    agua_tipo_envase: string;
    agua_volume_envase: number;
    agua_valor_unitario: number;
    agua_pregao: string;
    agua_om_uasg: string;
    agua_ug_uasg: string;

    // Lanche/Catanho
    lanche_efetivo: number;
    lanche_dias: number;
    lanche_pregao: string;
    lanche_om_uasg: string;
    lanche_ug_uasg: string;
    lanche_items: LancheItem[];

    acquisitionGroups: AcquisitionGroup[];
}

const initialFormState: ComplementoAlimentacaoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    om_destino: "",
    ug_destino: "",
    fase_atividade: "",
    categoria_complemento: 'genero',
    
    genero_efetivo: 0,
    genero_dias: 0,
    publico: "OSP",
    valor_etapa_qs: 0,
    pregao_qs: "",
    om_qs: "",
    ug_qs: "",
    valor_etapa_qr: 0,
    pregao_qr: "",
    om_qr: "",
    ug_qr: "",

    agua_efetivo: 0,
    agua_dias: 0,
    agua_consumo_dia: 0,
    agua_tipo_envase: "Garrafa",
    agua_volume_envase: 0.5,
    agua_valor_unitario: 0,
    agua_pregao: "",
    agua_om_uasg: "",
    agua_ug_uasg: "",

    lanche_efetivo: 0,
    lanche_dias: 0,
    lanche_pregao: "",
    lanche_om_uasg: "",
    lanche_ug_uasg: "",
    lanche_items: [],

    acquisitionGroups: [],
};

/**
 * Função de Dirty Check refinada.
 * Compara o estado atual com o último estado "staged" (salvo na lista).
 */
const compareFormData = (current: ComplementoAlimentacaoFormState, staged: ComplementoAlimentacaoFormState) => {
    if (
        current.om_favorecida !== staged.om_favorecida ||
        current.ug_favorecida !== staged.ug_favorecida ||
        current.fase_atividade !== staged.fase_atividade
    ) return true;

    if (current.categoria_complemento === staged.categoria_complemento) {
        const cat = current.categoria_complemento;

        if (cat === 'genero') {
            if (
                current.genero_efetivo !== staged.genero_efetivo ||
                current.genero_dias !== staged.genero_dias ||
                current.publico !== staged.publico ||
                current.valor_etapa_qs !== staged.valor_etapa_qs ||
                current.pregao_qs !== staged.pregao_qs ||
                current.om_qs !== staged.om_qs ||
                current.valor_etapa_qr !== staged.valor_etapa_qr ||
                current.pregao_qr !== staged.pregao_qr ||
                current.om_qr !== staged.om_qr
            ) return true;
        } else if (cat === 'agua') {
            if (
                current.agua_efetivo !== staged.agua_efetivo ||
                current.agua_dias !== staged.agua_dias ||
                current.agua_consumo_dia !== staged.agua_consumo_dia ||
                current.agua_tipo_envase !== staged.agua_tipo_envase ||
                current.agua_volume_envase !== staged.agua_volume_envase ||
                current.agua_valor_unitario !== staged.agua_valor_unitario ||
                current.agua_pregao !== staged.agua_pregao ||
                current.agua_om_uasg !== staged.agua_om_uasg
            ) return true;
        } else if (cat === 'lanche') {
            if (
                current.lanche_efetivo !== staged.lanche_efetivo ||
                current.lanche_dias !== staged.lanche_dias ||
                current.lanche_pregao !== staged.lanche_pregao ||
                current.lanche_om_uasg !== staged.lanche_om_uasg ||
                JSON.stringify(current.lanche_items) !== JSON.stringify(staged.lanche_items)
            ) return true;
        }
    }

    return false;
};

const ComplementoAlimentacaoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<ComplementoAlimentacaoFormState>(initialFormState);
    const [pendingItems, setPendingItems] = useState<StagedComplemento[]>([]);
    const [lastStagedFormData, setLastStagedFormData] = useState<ComplementoAlimentacaoFormState | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedComplementoRecord | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmQrId, setSelectedOmQrId] = useState<string | undefined>(undefined);
    const [selectedOmAguaId, setSelectedOmAguaId] = useState<string | undefined>(undefined);
    const [selectedOmLancheId, setSelectedOmLancheId] = useState<string | undefined>(undefined);
    
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [itemsToPreselect, setItemsToPreselect] = useState<ItemAquisicao[]>([]);
    const [selectedItemsFromSelector, setSelectedItemsFromSelector] = useState<ItemAquisicao[] | null>(null);
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");

    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<ComplementoAlimentacaoRegistro[]>({
        queryKey: ['complementoAlimentacaoRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('complemento_alimentacao_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => (data as any[]).map(r => ({
            ...r,
            itens_aquisicao: (r.itens_aquisicao as unknown as ItemAquisicao[]) || []
        })).sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });

    const consolidatedRegistros = useMemo<ConsolidatedComplementoRecord[]>(() => {
        if (!registros) return [];

        const groups = registros.reduce((acc, registro) => {
            const key = [
                registro.organizacao,
                registro.ug,
                registro.fase_atividade,
            ].join('|');

            if (!acc[key]) {
                acc[key] = {
                    groupKey: key, 
                    organizacao: registro.organizacao,
                    ug: registro.ug,
                    om_detentora: registro.om_detentora,
                    ug_detentora: registro.ug_detentora,
                    dias_operacao: registro.dias_operacao,
                    efetivo: registro.efetivo, 
                    fase_atividade: registro.fase_atividade,
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
        }, {} as Record<string, ConsolidatedComplementoRecord>);

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    const insertMutation = useMutation({
        mutationFn: async (items: StagedComplemento[]) => {
            const recordsToInsert = items.map(item => {
                const base: TablesInsert<'complemento_alimentacao_registros'> = {
                    p_trab_id: ptrabId!,
                    organizacao: item.om_favorecida,
                    ug: item.ug_favorecida,
                    om_detentora: item.om_destino,
                    ug_detentora: item.ug_destino,
                    dias_operacao: item.dias_operacao,
                    efetivo: item.efetivo,
                    fase_atividade: item.fase_atividade,
                    categoria_complemento: item.categoria,
                    publico: item.publico,
                    valor_total: item.valor_total,
                    valor_nd_30: item.valor_nd_30,
                    valor_nd_39: item.valor_nd_39,
                    group_name: item.categoria === 'genero' ? 'Gênero Alimentício' : item.categoria === 'agua' ? 'Água Mineral' : 'Lanche/Catanho',
                };

                if (item.categoria === 'genero') {
                    const snap = item.formDataSnapshot;
                    return {
                        ...base,
                        valor_etapa_qs: snap.valor_etapa_qs,
                        pregao_qs: snap.pregao_qs,
                        om_qs: snap.om_qs,
                        ug_qs: snap.ug_qs,
                        valor_etapa_qr: snap.valor_etapa_qr,
                        pregao_qr: snap.pregao_qr,
                        om_qr: snap.om_qr,
                        ug_qr: snap.ug_qr,
                    };
                } else if (item.categoria === 'agua') {
                    const snap = item.formDataSnapshot;
                    return {
                        ...base,
                        agua_consumo_dia: snap.agua_consumo_dia,
                        agua_tipo_envase: snap.agua_tipo_envase,
                        agua_volume_envase: snap.agua_volume_envase,
                        agua_valor_unitario: snap.agua_valor_unitario,
                        agua_pregao: snap.agua_pregao,
                    };
                } else {
                    return {
                        ...base,
                        itens_aquisicao: item.lanche_items as unknown as Json,
                    };
                }
            });

            const { error } = await supabase.from('complemento_alimentacao_registros').insert(recordsToInsert);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registros salvos com sucesso!");
            setPendingItems([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['complementoAlimentacaoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (error) => toast.error("Falha ao salvar.", { description: sanitizeError(error) })
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('complemento_alimentacao_registros').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote excluído.");
            queryClient.invalidateQueries({ queryKey: ['complementoAlimentacaoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
        },
        onError: (error) => toast.error("Falha ao excluir.", { description: sanitizeError(error) })
    });

    // Lógica de pré-seleção das UASGs baseada na OM Favorecida
    const handleOmFavorecidaChange = (omData: any) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmQrId(omData.id);
            setSelectedOmAguaId(omData.id);
            setSelectedOmLancheId(omData.id);

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
                ug_destino: omData.codug_om,
                agua_om_uasg: omData.nome_om,
                agua_ug_uasg: omData.codug_om,
                lanche_om_uasg: omData.nome_om,
                lanche_ug_uasg: omData.codug_om
            }));
        }
    };

    const isBaseFormReady = formData.om_favorecida.length > 0 && formData.fase_atividade.length > 0;
    const isGenero = formData.categoria_complemento === 'genero';

    // Cálculos em tempo real para exibição nos containers
    const currentTotalQS = useMemo(() => {
        return formData.genero_efetivo * formData.valor_etapa_qs * formData.genero_dias;
    }, [formData.genero_efetivo, formData.valor_etapa_qs, formData.genero_dias]);

    const currentTotalQR = useMemo(() => {
        return formData.genero_efetivo * formData.valor_etapa_qr * formData.genero_dias;
    }, [formData.genero_efetivo, formData.valor_etapa_qr, formData.genero_dias]);

    const currentTotalAgua = useMemo(() => {
        const totalLitros = formData.agua_efetivo * formData.agua_consumo_dia * formData.agua_dias;
        if (formData.agua_volume_envase <= 0) return 0;
        const totalGarrafas = Math.ceil(totalLitros / formData.agua_volume_envase);
        return totalGarrafas * formData.agua_valor_unitario;
    }, [formData.agua_efetivo, formData.agua_consumo_dia, formData.agua_dias, formData.agua_volume_envase, formData.agua_valor_unitario]);

    const currentKitValue = useMemo(() => {
        return formData.lanche_items.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
    }, [formData.lanche_items]);

    const currentTotalLanche = useMemo(() => {
        return currentKitValue * formData.lanche_efetivo * formData.lanche_dias;
    }, [currentKitValue, formData.lanche_efetivo, formData.lanche_dias]);

    const currentCategoryTotal = useMemo(() => {
        if (formData.categoria_complemento === 'genero') {
            return currentTotalQS + currentTotalQR;
        } else if (formData.categoria_complemento === 'agua') {
            return currentTotalAgua;
        } else {
            return currentTotalLanche;
        }
    }, [formData.categoria_complemento, currentTotalQS, currentTotalQR, currentTotalAgua, currentTotalLanche]);

    // Memo para Dirty Check
    const isDirty = useMemo(() => {
        if (pendingItems.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }
        return false;
    }, [formData, pendingItems.length, lastStagedFormData]);

    // Lógica de cálculo e adição à lista pendente
    const handleStageCalculation = () => {
        const { categoria_complemento } = formData;
        
        let newItem: StagedComplemento;

        if (categoria_complemento === 'genero') {
            const totalQS = currentTotalQS;
            const totalQR = currentTotalQR;
            const totalGeral = totalQS + totalQR;

            newItem = {
                tempId: crypto.randomUUID(),
                categoria: 'genero',
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                om_destino: formData.om_qr,
                ug_destino: formData.ug_qr,
                dias_operacao: formData.genero_dias,
                efetivo: formData.genero_efetivo,
                fase_atividade: formData.fase_atividade,
                publico: formData.publico,
                valor_total: totalGeral,
                valor_nd_30: totalGeral,
                valor_nd_39: 0,
                total_qs: totalQS,
                total_qr: totalQR,
                formDataSnapshot: { ...formData }
            };
        } else if (categoria_complemento === 'agua') {
            const totalValue = currentTotalAgua;
            newItem = {
                tempId: crypto.randomUUID(),
                categoria: 'agua',
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                om_destino: formData.agua_om_uasg,
                ug_destino: formData.agua_ug_uasg,
                dias_operacao: formData.agua_dias,
                efetivo: formData.agua_efetivo,
                fase_atividade: formData.fase_atividade,
                publico: formData.publico,
                valor_total: totalValue,
                valor_nd_30: totalValue,
                valor_nd_39: 0,
                formDataSnapshot: { ...formData }
            };
        } else {
            const totalValue = currentTotalLanche;
            newItem = {
                tempId: crypto.randomUUID(),
                categoria: 'lanche',
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                om_destino: formData.lanche_om_uasg,
                ug_destino: formData.lanche_ug_uasg,
                dias_operacao: formData.lanche_dias,
                efetivo: formData.lanche_efetivo,
                fase_atividade: formData.fase_atividade,
                publico: formData.publico,
                valor_total: totalValue,
                valor_nd_30: totalValue,
                valor_nd_39: 0,
                lanche_items: [...formData.lanche_items],
                formDataSnapshot: { ...formData }
            };
        }

        setPendingItems(prev => [...prev, newItem]);
        setLastStagedFormData({ ...formData }); 
        
        toast.success("Item adicionado à lista de revisão.");
    };

    const handleRemovePending = (id: string) => {
        setPendingItems(prev => {
            const newList = prev.filter(item => item.tempId !== id);
            if (newList.length === 0) setLastStagedFormData(null);
            return newList;
        });
    };

    const handleClearForm = () => {
        setFormData(prev => ({
            ...initialFormState,
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            rm_vinculacao: prev.rm_vinculacao,
            codug_rm_vinculacao: prev.codug_rm_vinculacao,
            fase_atividade: prev.fase_atividade,
        }));
        toast.info("Campos do formulário limpos.");
    };

    const totalGeralOM = useMemo(() => {
        return pendingItems.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingItems]);

    const isSaveDisabled = useMemo(() => {
        if (!isBaseFormReady) return true;
        
        if (isGenero) {
            if (formData.genero_efetivo <= 0 || formData.genero_dias <= 0) return true;
            return (
                formData.valor_etapa_qs <= 0 || 
                !formData.pregao_qs || 
                !formData.om_qs ||
                formData.valor_etapa_qr <= 0 || 
                !formData.pregao_qr || 
                !formData.om_qr
            );
        } else if (formData.categoria_complemento === 'agua') {
            if (formData.agua_efetivo <= 0 || formData.agua_dias <= 0) return true;
            return (
                formData.agua_consumo_dia <= 0 ||
                !formData.agua_tipo_envase ||
                formData.agua_volume_envase <= 0 ||
                formData.agua_valor_unitario <= 0 ||
                !formData.agua_pregao ||
                !formData.agua_om_uasg
            );
        } else {
            if (formData.lanche_efetivo <= 0 || formData.lanche_dias <= 0) return true;
            return formData.lanche_items.length === 0 || formData.lanche_items.some(i => !i.descricao || i.quantidade <= 0 || i.valor_unitario <= 0) || !formData.lanche_pregao || !formData.lanche_om_uasg;
        }
    }, [formData, isBaseFormReady, isGenero]);

    const addLancheItem = () => {
        setFormData(prev => ({
            ...prev,
            lanche_items: [...prev.lanche_items, { id: crypto.randomUUID(), descricao: "", quantidade: 0, valor_unitario: 0 }]
        }));
    };

    const removeLancheItem = (id: string) => {
        setFormData(prev => ({
            ...prev,
            lanche_items: prev.lanche_items.filter(i => i.id !== id)
        }));
    };

    const updateLancheItem = (id: string, field: keyof LancheItem, value: any) => {
        setFormData(prev => ({
            ...prev,
            lanche_items: prev.lanche_items.map(i => i.id === id ? { ...i, [field]: value } : i)
        }));
    };

    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (registroId: string, memoriaCompleta: string) => {
        setEditingMemoriaId(registroId);
        setMemoriaEdit(memoriaCompleta || "");
        toast.info("Editando memória de cálculo.");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            const { error } = await supabase
                .from("complemento_alimentacao_registros")
                .update({
                    detalhamento_customizado: memoriaEdit.trim() || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["complementoAlimentacaoRegistros", ptrabId] });
        } catch (error) {
            toast.error(sanitizeError(error));
        }
    };

    const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
        if (!confirm("Deseja restaurar a memória automática?")) return;
        
        try {
            const { error } = await supabase
                .from("complemento_alimentacao_registros")
                .update({ detalhamento_customizado: null })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória restaurada!");
            queryClient.invalidateQueries({ queryKey: ["complementoAlimentacaoRegistros", ptrabId] });
        } catch (error) {
            toast.error(sanitizeError(error));
        }
    };

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isSaving = insertMutation.isPending || deleteMutation.isPending;

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
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                Complemento de Alimentação
                            </div>
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
                                        <OmSelector selectedOmId={selectedOmFavorecidaId} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM" disabled={!isPTrabEditable || isSaving} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData({...formData, fase_atividade: f})} disabled={!isPTrabEditable || isSaving} />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR COMPLEMENTO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Complemento</h3>
                                    
                                    <Tabs value={formData.categoria_complemento} onValueChange={(v: any) => setFormData({...formData, categoria_complemento: v})} className="w-full">
                                        <TabsList className="grid w-full grid-cols-3 mb-6">
                                            <TabsTrigger value="genero" className="flex items-center gap-2">
                                                <Utensils className="h-4 w-4" />
                                                Gênero Alimentício
                                            </TabsTrigger>
                                            <TabsTrigger value="agua" className="flex items-center gap-2">
                                                <Droplets className="h-4 w-4" />
                                                Água Mineral
                                            </TabsTrigger>
                                            <TabsTrigger value="lanche" className="flex items-center gap-2">
                                                <Coffee className="h-4 w-4" />
                                                Lanche/Catanho
                                            </TabsTrigger>
                                        </TabsList>

                                        <Card className="bg-muted/50 p-4">
                                            <div className="space-y-6 bg-background p-4 rounded-lg border">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Efetivo *</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={formData.genero_efetivo || ""} 
                                                            onChange={(e) => setFormData({...formData, genero_efetivo: parseInt(e.target.value) || 0})}
                                                            placeholder="Ex: 150"
                                                            disabled={!isPTrabEditable || isSaving}
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Público *</Label>
                                                        <PublicoSelect value={formData.publico} onChange={(v) => setFormData({...formData, publico: v})} disabled={!isPTrabEditable || isSaving} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Período (Nr Dias) *</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={formData.genero_dias || ""} 
                                                            onChange={(e) => setFormData({...formData, genero_dias: parseInt(e.target.value) || 0})}
                                                            placeholder="Ex: 15"
                                                            disabled={!isPTrabEditable || isSaving}
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                </div>

                                                {isGenero && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                                        <div className="space-y-4 p-4 bg-primary/5 rounded-md border border-primary/10 relative overflow-hidden">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm text-primary uppercase">Quantitativo de Subsistência (QS)</h4>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subtotal Estimado</p>
                                                                    <p className="text-sm font-extrabold text-primary">{formatCurrency(currentTotalQS)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Valor Complemento *</Label>
                                                                    <CurrencyInput value={formData.valor_etapa_qs} onChange={(val) => setFormData({...formData, valor_etapa_qs: val})} disabled={!isPTrabEditable || isSaving} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Pregão *</Label>
                                                                    <Input value={formData.pregao_qs} onChange={(e) => setFormData({...formData, pregao_qs: e.target.value})} placeholder="Ex: 90.001/24" disabled={!isPTrabEditable || isSaving} />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>UASG *</Label>
                                                                <RmSelector value={formData.om_qs} onChange={(name, codug) => setFormData({...formData, om_qs: name, ug_qs: codug})} placeholder="Selecione a UASG" disabled={!isPTrabEditable || isSaving} />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4 p-4 bg-orange-500/5 rounded-md border border-orange-500/10 relative overflow-hidden">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm text-orange-600 uppercase">Quantitativo de Rancho (QR)</h4>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subtotal Estimado</p>
                                                                    <p className="text-sm font-extrabold text-orange-600">{formatCurrency(currentTotalQR)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Valor Complemento *</Label>
                                                                    <CurrencyInput value={formData.valor_etapa_qr} onChange={(val) => setFormData({...formData, valor_etapa_qr: val})} disabled={!isPTrabEditable || isSaving} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Pregão *</Label>
                                                                    <Input value={formData.pregao_qr} onChange={(e) => setFormData({...formData, pregao_qr: e.target.value})} placeholder="Ex: 90.001/24" disabled={!isPTrabEditable || isSaving} />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>UASG *</Label>
                                                                <OmSelector selectedOmId={selectedOmQrId} onChange={(om) => setFormData({...formData, om_qr: om?.nome_om || "", ug_qr: om?.codug_om || ""})} placeholder="Selecione a UASG" disabled={!isPTrabEditable || isSaving} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {formData.categoria_complemento === 'agua' && (
                                                    <div className="grid grid-cols-1 gap-6 pt-4 border-t">
                                                        <div className="space-y-4 p-4 bg-blue-500/5 rounded-md border border-blue-500/10 relative overflow-hidden">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm text-blue-600 uppercase">Detalhamento de Água Mineral</h4>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subtotal Estimado</p>
                                                                    <p className="text-sm font-extrabold text-blue-600">{formatCurrency(currentTotalAgua)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Consumo (litro) / dia *</Label>
                                                                    <Input 
                                                                        type="number" 
                                                                        step="0.1" 
                                                                        value={formData.agua_consumo_dia || ""} 
                                                                        onChange={(e) => setFormData({...formData, agua_consumo_dia: parseFloat(e.target.value) || 0})} 
                                                                        onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                        placeholder="Ex: 2.5"
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Tipo Envase *</Label>
                                                                    <Input 
                                                                        value={formData.agua_tipo_envase} 
                                                                        onChange={(e) => setFormData({...formData, agua_tipo_envase: e.target.value})} 
                                                                        placeholder="Ex: Garrafa" 
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Volume do Envase (L) *</Label>
                                                                    <Input 
                                                                        type="number" 
                                                                        step="0.01" 
                                                                        value={formData.agua_volume_envase || ""} 
                                                                        onChange={(e) => setFormData({...formData, agua_volume_envase: parseFloat(e.target.value) || 0})} 
                                                                        onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                        placeholder="Ex: 0.5"
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Valor da Garrafa *</Label>
                                                                    <CurrencyInput value={formData.agua_valor_unitario} onChange={(val) => setFormData({...formData, agua_valor_unitario: val})} disabled={!isPTrabEditable || isSaving} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Pregão *</Label>
                                                                    <Input 
                                                                        value={formData.agua_pregao} 
                                                                        onChange={(e) => setFormData({...formData, agua_pregao: e.target.value})} 
                                                                        placeholder="Ex: 90.001/24" 
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>UASG *</Label>
                                                                <OmSelector 
                                                                    selectedOmId={selectedOmAguaId} 
                                                                    onChange={(om) => setFormData({...formData, agua_om_uasg: om?.nome_om || "", agua_ug_uasg: om?.codug_om || ""})} 
                                                                    placeholder="Selecione a UASG" 
                                                                    disabled={!isPTrabEditable || isSaving}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {formData.categoria_complemento === 'lanche' && (
                                                    <div className="grid grid-cols-1 gap-6 pt-4 border-t">
                                                        <div className="space-y-4 p-4 bg-amber-500/5 rounded-md border border-amber-500/10 relative overflow-hidden">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm text-amber-600 uppercase">Detalhamento de Lanche/Catanho</h4>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subtotal Estimado</p>
                                                                    <p className="text-sm font-extrabold text-amber-600">{formatCurrency(currentTotalLanche)}</p>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Pregão *</Label>
                                                                    <Input 
                                                                        value={formData.lanche_pregao} 
                                                                        onChange={(e) => setFormData({...formData, lanche_pregao: e.target.value})} 
                                                                        placeholder="Ex: 90.001/24" 
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>UASG *</Label>
                                                                    <OmSelector 
                                                                        selectedOmId={selectedOmLancheId} 
                                                                        onChange={(om) => setFormData({...formData, lanche_om_uasg: om?.nome_om || "", lanche_ug_uasg: om?.codug_om || ""})} 
                                                                        placeholder="Selecione a UASG" 
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-4 pt-4 border-t border-amber-500/10">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <h5 className="text-xs font-bold uppercase text-muted-foreground">Itens do Lanche ({formData.lanche_items.length})</h5>
                                                                        <p className="text-[10px] font-bold text-amber-700 uppercase">Valor do Kit: {formatCurrency(currentKitValue)}</p>
                                                                    </div>
                                                                    <Button variant="outline" size="sm" onClick={addLancheItem} disabled={!isPTrabEditable || isSaving} className="h-7 text-[10px] uppercase font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                                                                        <Plus className="mr-1 h-3 w-3" /> Adicionar Item
                                                                    </Button>
                                                                </div>

                                                                {formData.lanche_items.length === 0 ? (
                                                                    <div className="text-center py-6 border-2 border-dashed border-amber-500/10 rounded-lg">
                                                                        <p className="text-xs text-muted-foreground">Nenhum item adicionado ao lanche.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        {formData.lanche_items.map((item, index) => (
                                                                            <Collapsible key={item.id} defaultOpen={true} className="border border-amber-500/10 rounded-md bg-background/50">
                                                                                <div className="flex items-center justify-between p-2 bg-amber-500/5">
                                                                                    <CollapsibleTrigger className="flex items-center gap-2 text-[10px] font-bold uppercase text-amber-700">
                                                                                        <ChevronDown className="h-3 w-3" />
                                                                                        Item #{index + 1}: {item.descricao || "Sem descrição"}
                                                                                    </CollapsibleTrigger>
                                                                                    <Button variant="ghost" size="icon" onClick={() => removeLancheItem(item.id)} disabled={!isPTrabEditable || isSaving} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </Button>
                                                                                </div>
                                                                                <CollapsibleContent className="p-3">
                                                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                                                                        <div className="space-y-2">
                                                                                            <Label className="text-[10px] uppercase">Quantidade *</Label>
                                                                                            <Input 
                                                                                                type="number" 
                                                                                                value={item.quantidade || ""} 
                                                                                                onChange={(e) => updateLancheItem(item.id, "quantidade", parseInt(e.target.value) || 0)} 
                                                                                                disabled={!isPTrabEditable || isSaving}
                                                                                                className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                                onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="md:col-span-2 space-y-2">
                                                                                            <Label className="text-[10px] uppercase">Descrição do Item *</Label>
                                                                                            <Input 
                                                                                                value={item.descricao} 
                                                                                                onChange={(e) => updateLancheItem(item.id, "descricao", e.target.value)} 
                                                                                                placeholder="Ex: Pão de forma, presunto, queijo..." 
                                                                                                disabled={!isPTrabEditable || isSaving}
                                                                                                className="h-8 text-xs"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="space-y-2">
                                                                                            <Label className="text-[10px] uppercase">Valor Unitário *</Label>
                                                                                            <CurrencyInput value={item.valor_unitario} onChange={(val) => updateLancheItem(item.id, "valor_unitario", val)} disabled={!isPTrabEditable || isSaving} className="h-8 text-xs" />
                                                                                        </div>
                                                                                    </div>
                                                                                </CollapsibleContent>
                                                                            </Collapsible>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-extrabold text-foreground uppercase">Total da Solicitação:</span>
                                                    <span className="text-lg font-extrabold text-foreground">{formatCurrency(currentCategoryTotal)}</span>
                                                </div>
                                                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                                                    <Button variant="outline" onClick={handleClearForm} disabled={!isPTrabEditable || isSaving} className="w-full md:w-auto">
                                                        <XCircle className="mr-2 h-4 w-4" />
                                                        Limpar
                                                    </Button>
                                                    <Button className="w-full md:w-auto" disabled={isSaveDisabled || !isPTrabEditable || isSaving} onClick={handleStageCalculation}>
                                                        <Save className="mr-2 h-4 w-4" />
                                                        Salvar Itens na Lista
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (REVISÃO) */}
                            {pendingItems.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados ({pendingItems.length})</h3>
                                    
                                    {isDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Itens na Lista" na Seção 2 para atualizar o lote pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-4">
                                        {pendingItems.map((item) => (
                                            <Card key={item.tempId} className="border-2 border-secondary bg-secondary/5 shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/20">
                                                        <h4 className="font-bold text-base text-foreground">
                                                            Complemento de Alimentação ({item.categoria === 'genero' ? 'Gênero Alimentício' : item.categoria === 'agua' ? 'Água' : 'Lanche'})
                                                        </h4>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-extrabold text-lg text-foreground">
                                                                {formatCurrency(item.valor_total)}
                                                            </p>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemovePending(item.tempId)} disabled={isSaving} className="h-8 w-8 text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-muted-foreground">OM Favorecida:</p>
                                                            <p className="font-medium text-muted-foreground">OM Destino do Recurso:</p>
                                                            <p className="font-medium text-muted-foreground">Período/Efetivo:</p>
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <p className="font-bold">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                            <p className="font-bold">{item.om_destino} ({formatCodug(item.ug_destino)})</p>
                                                            <p className="font-bold">{item.dias_operacao} {item.dias_operacao === 1 ? 'dia' : 'dias'} / {item.efetivo} {item.efetivo === 1 ? 'militar' : 'militares'}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="w-full h-[1px] bg-secondary/20 my-3" />

                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">ND 33.90.30:</span>
                                                        <div className="flex gap-3">
                                                            {item.categoria === 'genero' ? (
                                                                <>
                                                                    <span className="font-bold text-blue-600">{formatCurrency(item.total_qs || 0)} (QS)</span>
                                                                    <span className="font-bold text-green-600">{formatCurrency(item.total_qr || 0)} (QR)</span>
                                                                </>
                                                            ) : (
                                                                <span className="font-bold text-green-600">{formatCurrency(item.valor_nd_30)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    <Card className="bg-muted shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">VALOR TOTAL DA OM</span>
                                            <span className="font-extrabold text-xl text-foreground">{formatCurrency(totalGeralOM)}</span>
                                        </CardContent>
                                    </Card>

                                    <div className="flex justify-end gap-3 pt-4">
                                        <Button className="bg-primary hover:bg-primary/90" disabled={isDirty || isSaving} onClick={() => insertMutation.mutate(pendingItems)}>
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Salvar Registros
                                        </Button>
                                        <Button variant="outline" onClick={() => { setPendingItems([]); setLastStagedFormData(null); }} disabled={isSaving}>
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Limpar Lista
                                        </Button>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS */}
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
                                                    <Badge variant="outline" className="text-xs">{group.fase_atividade}</Badge>
                                                </h3>
                                                <span className="font-extrabold text-xl text-primary">{formatCurrency(group.totalGeral)}</span>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                {group.records.map((registro) => (
                                                    <Card key={registro.id} className="p-3 bg-background border">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <h4 className="font-semibold text-base text-foreground">
                                                                    {registro.group_name} ({registro.categoria_complemento === 'genero' ? 'Gênero' : registro.categoria_complemento === 'agua' ? 'Água' : 'Lanche'})
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Período: {registro.dias_operacao} dias | Efetivo: {registro.efetivo} militares
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xl text-foreground">{formatCurrency(Number(registro.valor_total))}</span>
                                                                <Button variant="ghost" size="icon" onClick={() => { setGroupToDelete(group); setShowDeleteDialog(true); }} disabled={!isPTrabEditable || isSaving} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
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
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {consolidatedRegistros.map(group => group.records.map(registro => (
                                        <ComplementoAlimentacaoMemoria
                                            key={`memoria-${registro.id}`}
                                            registro={registro}
                                            context={{ organizacao: group.organizacao, efetivo: group.efetivo, dias_operacao: group.dias_operacao, fase_atividade: group.fase_atividade }}
                                            isPTrabEditable={isPTrabEditable}
                                            isSaving={isSaving}
                                            editingMemoriaId={editingMemoriaId}
                                            memoriaEdit={memoriaEdit}
                                            setMemoriaEdit={setMemoriaEdit}
                                            handleIniciarEdicaoMemoria={handleIniciarEdicaoMemoria}
                                            handleCancelarEdicaoMemoria={handleCancelarEdicaoMemoria}
                                            handleSalvarMemoriaCustomizada={handleSalvarMemoriaCustomizada}
                                            handleRestaurarMemoriaAutomatica={handleRestaurarMemoriaAutomatica}
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
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>Deseja excluir o lote de Complemento para a OM {groupToDelete?.organizacao}?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => groupToDelete && deleteMutation.mutate(groupToDelete.records.map(r => r.id))} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AcquisitionItemSelectorDialog 
                open={isItemSelectorOpen} 
                onOpenChange={setIsItemSelectorOpen} 
                selectedYear={new Date().getFullYear()} 
                initialItems={itemsToPreselect} 
                onSelect={(items) => { setSelectedItemsFromSelector(items); setIsItemSelectorOpen(false); }} 
            />
        </div>
    );
};

export default ComplementoAlimentacaoForm;