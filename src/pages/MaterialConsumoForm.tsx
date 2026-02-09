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
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    MaterialConsumoRegistro, 
    ConsolidatedMaterialConsumoRecord,
    AcquisitionGroup,
    calculateGroupTotals,
    generateConsolidatedMaterialConsumoMemoriaCalculo,
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
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; // Importar ItemAquisicao
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Importar Tooltip

// Tipos de dados
type MaterialConsumoRegistroDB = Tables<'material_consumo_registros'>; 

// Tipo de dados para OmSelector
interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

// Tipo para o registro calculado antes de salvar (inclui campos de display)
interface CalculatedMaterialConsumo extends TablesInsert<'material_consumo_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
    // Novo: Armazena os grupos de aquisição (para rastreamento)
    acquisitionGroups: AcquisitionGroup[];
}

// Estado inicial para o formulário (Seção 1 & 2)
interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    
    // Dados dos Grupos de Aquisição (Lista de AcquisitionGroup)
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

// Helper function to compare form data structures (excluding acquisitionGroups)
const compareFormData = (data1: MaterialConsumoFormState, data2: MaterialConsumoFormState) => {
    // Compara apenas os campos de contexto que definem o LOTE
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
    
    // Compara a lista de grupos (IDs e totais)
    const groups1 = data1.acquisitionGroups.map(g => `${g.tempId}-${g.totalValue}`).sort().join('|');
    const groups2 = data2.acquisitionGroups.map(g => `${g.tempId}-${g.totalValue}`).sort().join('|');
    
    if (groups1 !== groups2) {
        return true;
    }
    
    return false;
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
    
    // NOVO ESTADO: Armazena o grupo completo a ser excluído/substituído
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedMaterialConsumoRecord | null>(null); 
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedMaterialConsumoRecord | null>(null); 
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos (Cada item é um AcquisitionGroup)
    const [pendingGroups, setPendingGroups] = useState<CalculatedMaterialConsumo[]>([]);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingGroups
    const [lastStagedFormData, setLastStagedFormData] = useState<MaterialConsumoFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida e OM Destino
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    // Estado para o formulário inline de criação de grupo
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<AcquisitionGroup | undefined>(undefined);
    
    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Registros de Material de Consumo
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<MaterialConsumoRegistroDB[]>({
        queryKey: ['materialConsumoRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('material_consumo_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    // NOVO MEMO: Consolida os registros por lote de solicitação (OM, UG, Dias, Efetivo, Fase)
    const consolidatedRegistros = useMemo<ConsolidatedMaterialConsumoRecord[]>(() => {
        if (!registros) return [];

        const groups = registros.reduce((acc, registro) => {
            // Chave de consolidação: OM Favorecida, UG Favorecida, OM Detentora, UG Detentora, Dias, Efetivo, Fase
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
                    efetivo: registro.efetivo,
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

        // Ordenar por OM
        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations ---

    // 1. Mutation for saving multiple new records (INSERT)
    const insertMutation = useMutation({
        mutationFn: async (newGroups: CalculatedMaterialConsumo[]) => {
            // Cada item em newGroups é um AcquisitionGroup completo que se tornará um registro no DB
            const recordsToInsert: TablesInsert<'material_consumo_registros'>[] = newGroups.map(g => {
                // O registro CalculatedMaterialConsumo já contém os dados do grupo no seu array acquisitionGroups[0]
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
                    
                    // Campos específicos do Grupo de Aquisição
                    group_name: group.groupName,
                    group_purpose: group.groupPurpose,
                    itens_aquisicao: group.items as unknown as Json,
                    
                    // Valores calculados
                    valor_total: g.valor_total,
                    valor_nd_30: g.valor_nd_30,
                    valor_nd_39: g.valor_nd_39,
                    detalhamento_customizado: g.detalhamento_customizado,
                };
             });

            const { error } = await supabase
                .from('material_consumo_registros')
                .insert(recordsToInsert);

            if (error) throw error;
            
            return recordsToInsert;
        },
        onSuccess: () => {
            toast.success(`Sucesso! ${pendingGroups.length} Grupo(s) de Aquisição adicionado(s)`);
            setPendingGroups([]);
            setLastStagedFormData(null);
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            
            // Manter campos de contexto (OMs, Dias, Efetivo, Fase)
            setFormData(prev => ({
                ...prev,
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                om_destino: prev.om_destino,
                ug_destino: prev.ug_destino,
                dias_operacao: prev.dias_operacao,
                efetivo: prev.efetivo,
                fase_atividade: prev.fase_atividade,
                acquisitionGroups: [], // Limpa os grupos selecionados após salvar
            }));
            
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros.", { description: sanitizeError(error) });
        }
    });

    // 2. Mutation for replacing an entire group of records (UPDATE/REPLACE)
    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldIds, newRecords }: { oldIds: string[], newRecords: CalculatedMaterialConsumo[] }) => {
            // 1. Delete old records
            const { error: deleteError } = await supabase
                .from('material_consumo_registros')
                .delete()
                .in('id', oldIds);
            if (deleteError) throw deleteError;
            
            // 2. Insert new records
            const recordsToInsert: TablesInsert<'material_consumo_registros'>[] = newRecords.map(g => {
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
             });

            const { error: insertError } = await supabase
                .from('material_consumo_registros')
                .insert(recordsToInsert);

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
        onError: (error) => {
            toast.error("Falha ao atualizar lote.", { description: sanitizeError(error) });
        }
    });

    // 3. Mutation for deleting a group of records
    const handleDeleteMutation = useMutation({
        mutationFn: async (recordIds: string[]) => {
            const { error } = await supabase
                .from('material_consumo_registros')
                .delete()
                .in('id', recordIds);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setGroupToDelete(null);
        },
        onError: (error) => {
            toast.error("Falha ao excluir lote.", { description: sanitizeError(error) });
        }
    });
    
    // Variável de estado de salvamento
    const isSaving = insertMutation.isPending || replaceGroupMutation.isPending || handleDeleteMutation.isPending;
    
    // Efeito de inicialização da OM Favorecida e OM Destino
    useEffect(() => {
        if (ptrabData && !editingId) {
            // Modo Novo Registro: Limpar
            setFormData(prev => ({
                ...initialFormState,
                om_favorecida: "", 
                ug_favorecida: "", 
                om_destino: "",
                ug_destino: "",
            }));
            setSelectedOmFavorecidaId(undefined); 
            setSelectedOmDestinoId(undefined);
            
        } else if (ptrabData && editingId) {
            // Modo Edição: Preencher (A ser preenchido por handleEdit)
        }
    }, [ptrabData, oms, editingId]);
    
    // =================================================================
    // LÓGICA DE GRUPOS DE AQUISIÇÃO (SEÇÃO 2)
    // =================================================================
    
    // Adiciona ou atualiza um grupo de aquisição na lista do formulário (Seção 2)
    const handleSaveAcquisitionGroup = (group: AcquisitionGroup) => {
        // Recalcula NDs antes de salvar no estado do formulário
        const { totalValue, totalND30, totalND39 } = calculateGroupTotals(group.items);
        
        const finalGroup: AcquisitionGroup = {
            ...group,
            totalValue,
            totalND30,
            totalND39,
        };
        
        setFormData(prev => {
            const existingIndex = prev.acquisitionGroups.findIndex(g => g.tempId === finalGroup.tempId);
            
            let newGroups;
            if (existingIndex !== -1) {
                // Atualiza
                newGroups = [...prev.acquisitionGroups];
                newGroups[existingIndex] = finalGroup;
            } else {
                // Adiciona
                newGroups = [...prev.acquisitionGroups, finalGroup];
            }
            
            return { ...prev, acquisitionGroups: newGroups };
        });
        
        setIsGroupFormOpen(false);
        setGroupToEdit(undefined);
        toast.success(`Grupo "${finalGroup.groupName}" salvo no formulário.`);
    };
    
    const handleOpenGroupForm = () => {
        setGroupToEdit(undefined);
        setIsGroupFormOpen(true);
    };
    
    const handleCancelGroupForm = () => {
        setGroupToEdit(undefined);
        setIsGroupFormOpen(false);
    };
    
    const handleEditAcquisitionGroup = (group: AcquisitionGroup) => {
        setGroupToEdit(group);
        setIsGroupFormOpen(true);
    };
    
    const handleDeleteAcquisitionGroup = (tempId: string) => {
        setFormData(prev => ({
            ...prev,
            acquisitionGroups: prev.acquisitionGroups.filter(g => g.tempId !== tempId),
        }));
        toast.info("Grupo de aquisição removido do formulário.");
    };
    
    const renderAcquisitionGroups = () => {
        if (formData.acquisitionGroups.length === 0) {
            return (
                <Alert variant="default" className="border-l-4 border-gray-300">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <AlertTitle>Nenhum Grupo Adicionado</AlertTitle>
                    <AlertDescription>
                        Adicione um grupo para selecionar os itens de aquisição necessários.
                    </AlertDescription>
                </Alert>
            );
        }
        
        return (
            <div className="space-y-3">
                {formData.acquisitionGroups.map(group => (
                    <Collapsible key={group.tempId} defaultOpen>
                        <Card className="border-l-4 border-primary/70">
                            <CollapsibleTrigger asChild>
                                <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-primary" />
                                        <span className="font-semibold">{group.groupName}</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {group.items.length} Itens
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{formatCurrency(group.totalValue)}</span>
                                        {group.groupPurpose && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="max-w-xs">{group.groupPurpose}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        <ChevronDown className="h-4 w-4" />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t p-3 bg-background">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Finalidade: {group.groupPurpose || 'Não especificada'}</p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead className="text-center">Qtd</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead className="w-[100px] text-center">ND</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.items.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-xs">
                                                        {item.descricao_item}
                                                        <p className="text-muted-foreground text-[10px]">CATMAT: {item.codigo_catmat}</p>
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs">{item.quantidade}</TableCell>
                                                    <TableCell className="text-right text-xs font-medium">{formatCurrency(item.valor_total)}</TableCell>
                                                    <TableCell className="text-center text-xs font-medium">{item.nd}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleEditAcquisitionGroup(group)}
                                        disabled={isSaving}
                                    >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => handleDeleteAcquisitionGroup(group.tempId)}
                                        disabled={isSaving}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir
                                    </Button>
                                </div>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                ))}
            </div>
        );
    };
    
    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    // Este cálculo agora é usado apenas para gerar o lote completo para a Seção 3
    const calculos = useMemo(() => {
        if (!ptrabId || formData.acquisitionGroups.length === 0) {
            return {
                totalGeral: 0,
                totalND30: 0,
                totalND39: 0,
                memoria: "Crie e adicione pelo menos um Grupo de Aquisição.",
                calculatedRecords: [],
            };
        }
        
        try {
            let totalGeral = 0;
            let totalND30 = 0;
            let totalND39 = 0;
            
            // 1. Calcular totais consolidados de todos os grupos
            formData.acquisitionGroups.forEach(group => {
                totalGeral += group.totalValue;
                totalND30 += group.totalND30;
                totalND39 += group.totalND39;
            });
            
            // 2. Criar um registro temporário (CalculatedMaterialConsumo) para cada AcquisitionGroup
            // Nota: Em MaterialConsumo, cada AcquisitionGroup se torna um registro no DB.
            const calculatedRecords: CalculatedMaterialConsumo[] = formData.acquisitionGroups.map(group => {
                
                const { totalValue, totalND30: nd30, totalND39: nd39 } = calculateGroupTotals(group.items);
                
                // Cria um registro temporário para a função de memória consolidada
                const tempGroupRecord: ConsolidatedMaterialConsumoRecord = {
                    groupKey: group.tempId,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    records: [{
                        id: group.tempId, 
                        p_trab_id: ptrabId!,
                        organizacao: formData.om_favorecida,
                        ug: formData.ug_favorecida,
                        om_detentora: formData.om_destino,
                        ug_detentora: formData.ug_destino,
                        dias_operacao: formData.dias_operacao,
                        efetivo: formData.efetivo,
                        fase_atividade: formData.fase_atividade,
                        group_name: group.groupName,
                        group_purpose: group.groupPurpose,
                        itens_aquisicao: group.items as unknown as Json,
                        valor_total: totalValue,
                        valor_nd_30: nd30,
                        valor_nd_39: nd39,
                        detalhamento_customizado: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as MaterialConsumoRegistro],
                    totalGeral: totalValue,
                    totalND30: nd30,
                    totalND39: nd39,
                };
                
                const memoria = generateConsolidatedMaterialConsumoMemoriaCalculo(tempGroupRecord);
                
                return {
                    tempId: group.tempId, 
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    valor_total: group.totalValue,
                    valor_nd_30: group.totalND30,
                    valor_nd_39: group.totalND39,
                    
                    totalGeral: group.totalValue,
                    memoria_calculo_display: memoria, 
                    om_favorecida: formData.om_favorecida,
                    ug_favorecida: formData.ug_favorecida,
                    detalhamento_customizado: null,
                    acquisitionGroups: [group],
                } as CalculatedMaterialConsumo;
            });
            
            return {
                totalGeral,
                totalND30,
                totalND39,
                memoria: `Total de ${calculatedRecords.length} Grupo(s) de Aquisição.`,
                calculatedRecords,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0,
                totalND30: 0,
                totalND39: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
                calculatedRecords: [],
            };
        }
    }, [formData, ptrabId]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do lastStagedFormData)
    const isMaterialConsumoDirty = useMemo(() => {
        if (pendingGroups.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }
        return false;
    }, [formData, pendingGroups.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingGroups = useMemo(() => {
        return pendingGroups.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingGroups]);
    
    // =================================================================
    // HANDLERS DE AÇÃO
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setGroupToReplace(null);
        setFormData(prev => ({
            ...initialFormState,
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_destino: prev.om_destino,
            ug_destino: prev.ug_destino,
            dias_operacao: 0,
            efetivo: 0,
            fase_atividade: "",
            acquisitionGroups: [],
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        // Mantém a OM Favorecida e Destino selecionadas no seletor
        setSelectedOmFavorecidaId(selectedOmFavorecidaId);
        setSelectedOmDestinoId(selectedOmDestinoId);
        setLastStagedFormData(null); 
    };
    
    const handleClearPending = () => {
        setPendingGroups([]);
        setLastStagedFormData(null);
        setEditingId(null);
        setGroupToReplace(null);
        resetForm();
    };

    const handleEdit = (group: ConsolidatedMaterialConsumoRecord) => {
        if (pendingGroups.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        // Limpa estados pendentes
        setPendingGroups([]);
        setLastStagedFormData(null);
        
        // Define o modo edição
        setEditingId(group.records[0].id); 
        setGroupToReplace(group); 
        
        // 1. Configurar OM Favorecida e OM Destino
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        // 2. Reconstruir a lista de AcquisitionGroups a partir de TODOS os registros do grupo
        const groupsFromRecords: AcquisitionGroup[] = group.records.map(registro => {
            const { totalValue, totalND30: nd30, totalND39: nd39 } = calculateGroupTotals((registro.itens_aquisicao as unknown as ItemAquisicao[]) || []);
            
            return {
                tempId: registro.id, // Usamos o ID real do DB como tempId
                groupName: registro.group_name,
                groupPurpose: registro.group_purpose || null,
                items: (registro.itens_aquisicao as unknown as ItemAquisicao[]) || [],
                totalValue: totalValue,
                totalND30: nd30,
                totalND39: nd39,
            } as AcquisitionGroup;
        });

        // 3. Populate formData
        const newFormData: MaterialConsumoFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo, 
            fase_atividade: group.fase_atividade || "",
            acquisitionGroups: groupsFromRecords, 
        };
        setFormData(newFormData);
        
        // 4. Gerar os itens pendentes (staging) imediatamente com os dados originais
        // Em MaterialConsumo, cada registro do DB é um item pendente.
        const newPendingItems: CalculatedMaterialConsumo[] = groupsFromRecords.map(group => {
            const { totalValue, totalND30: nd30, totalND39: nd39 } = calculateGroupTotals(group.items);
            
            // Cria um registro temporário para a função de memória consolidada
            const tempGroupRecord: ConsolidatedMaterialConsumoRecord = {
                groupKey: group.tempId,
                organizacao: newFormData.om_favorecida,
                ug: newFormData.ug_favorecida,
                om_detentora: newFormData.om_destino,
                ug_detentora: newFormData.ug_detentora,
                dias_operacao: newFormData.dias_operacao,
                efetivo: newFormData.efetivo,
                fase_atividade: newFormData.fase_atividade,
                records: [{
                    id: group.tempId, 
                    p_trab_id: ptrabId!,
                    organizacao: newFormData.om_favorecida,
                    ug: newFormData.ug_favorecida,
                    om_detentora: newFormData.om_destino,
                    ug_detentora: newFormData.ug_detentora,
                    dias_operacao: newFormData.dias_operacao,
                    efetivo: newFormData.efetivo,
                    fase_atividade: newFormData.fase_atividade,
                    group_name: group.groupName,
                    group_purpose: group.groupPurpose,
                    itens_aquisicao: group.items as unknown as Json,
                    valor_total: totalValue,
                    valor_nd_30: nd30,
                    valor_nd_39: nd39,
                    detalhamento_customizado: groupToReplace?.records.find(r => r.id === group.tempId)?.detalhamento_customizado || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as MaterialConsumoRegistro],
                totalGeral: totalValue,
                totalND30: nd30,
                totalND39: nd39,
            };
            
            const memoria = generateConsolidatedMaterialConsumoMemoriaCalculo(tempGroupRecord);
            
            return {
                tempId: group.tempId, 
                p_trab_id: ptrabId!,
                organizacao: newFormData.om_favorecida,
                ug: newFormData.ug_favorecida,
                om_detentora: newFormData.om_destino,
                ug_detentora: newFormData.ug_detentora,
                dias_operacao: newFormData.dias_operacao,
                efetivo: newFormData.efetivo,
                fase_atividade: newFormData.fase_atividade,
                
                valor_total: totalValue,
                valor_nd_30: group.totalND30,
                valor_nd_39: group.totalND39,
                
                totalGeral: totalValue,
                memoria_calculo_display: memoria, 
                om_favorecida: newFormData.om_favorecida,
                ug_favorecida: newFormData.ug_favorecida,
                detalhamento_customizado: tempGroupRecord.records[0].detalhamento_customizado,
                acquisitionGroups: [group],
            } as CalculatedMaterialConsumo;
        });
        
        setPendingGroups(newPendingItems);
        setLastStagedFormData(newFormData); // Marca o formulário como staged (limpo)
        
        toast.info("Modo Edição ativado. Altere os dados na Seção 2 e clique em 'Recalcular/Revisar Lote'.");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedMaterialConsumoRecord) => {
        setGroupToDelete(group); 
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação básica
            if (formData.acquisitionGroups.length === 0) {
                throw new Error("Crie e adicione pelo menos um Grupo de Aquisição na Seção 2.");
            }
            if (formData.dias_operacao <= 0) {
                throw new Error("O número de dias deve ser maior que zero.");
            }
            if (formData.efetivo <= 0) {
                throw new Error("O efetivo deve ser maior que zero.");
            }
            if (!formData.om_favorecida || !formData.ug_favorecida) {
                throw new Error("A OM Favorecida é obrigatória.");
            }
            if (!formData.om_destino || !formData.ug_destino) {
                throw new Error("A OM Destino do Recurso é obrigatória.");
            }
            
            // 2. Gerar MÚLTIPLOS registros (um para cada AcquisitionGroup)
            const newPendingItems: CalculatedMaterialConsumo[] = formData.acquisitionGroups.map(group => {
                
                const { totalValue, totalND30: nd30, totalND39: nd39 } = calculateGroupTotals(group.items);
                
                // Cria um registro temporário para a função de memória consolidada
                const tempGroupRecord: ConsolidatedMaterialConsumoRecord = {
                    groupKey: group.tempId,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    records: [{
                        id: group.tempId, 
                        p_trab_id: ptrabId!,
                        organizacao: formData.om_favorecida,
                        ug: formData.ug_favorecida,
                        om_detentora: formData.om_destino,
                        ug_detentora: formData.ug_destino,
                        dias_operacao: formData.dias_operacao,
                        efetivo: formData.efetivo,
                        fase_atividade: formData.fase_atividade,
                        group_name: group.groupName,
                        group_purpose: group.groupPurpose,
                        itens_aquisicao: group.items as unknown as Json,
                        valor_total: totalValue,
                        valor_nd_30: nd30,
                        valor_nd_39: nd39,
                        detalhamento_customizado: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as MaterialConsumoRegistro],
                    totalGeral: totalValue,
                    totalND30: nd30,
                    totalND39: nd39,
                };
                
                const memoria = generateConsolidatedMaterialConsumoMemoriaCalculo(tempGroupRecord);
                
                return {
                    tempId: group.tempId, 
                    p_trab_id: ptrabId!,
                    organizacao: formData.om_favorecida,
                    ug: formData.ug_favorecida,
                    om_detentora: formData.om_destino,
                    ug_detentora: formData.ug_destino,
                    dias_operacao: formData.dias_operacao,
                    efetivo: formData.efetivo,
                    fase_atividade: formData.fase_atividade,
                    
                    valor_total: group.totalValue,
                    valor_nd_30: group.totalND30,
                    valor_nd_39: group.totalND39,
                    
                    totalGeral: group.totalValue,
                    memoria_calculo_display: memoria, 
                    om_favorecida: formData.om_favorecida,
                    ug_favorecida: formData.ug_favorecida,
                    detalhamento_customizado: null,
                    acquisitionGroups: [group],
                } as CalculatedMaterialConsumo;
            });
            
            if (editingId) {
                // MODO EDIÇÃO: Geramos os novos registros e os colocamos em pendingGroups
                
                // Preserva a memória customizada do primeiro registro do grupo original, se existir
                let memoriaCustomizadaTexto: string | null = null;
                if (groupToReplace) {
                    // Busca o primeiro registro do grupo original para verificar a memória customizada
                    const originalRecord = groupToReplace.records.find(r => r.id === editingId);
                    if (originalRecord) {
                        memoriaCustomizadaTexto = originalRecord.detalhamento_customizado;
                    }
                }
                
                // Aplicamos a memória customizada ao primeiro item da nova lista (apenas para fins de staging display)
                if (memoriaCustomizadaTexto && newPendingItems.length > 0) {
                    // O tempId do primeiro item deve ser o ID do registro original para rastreamento
                    newPendingItems[0].tempId = editingId; 
                    newPendingItems[0].detalhamento_customizado = memoriaCustomizadaTexto;
                }
                
                setPendingGroups(newPendingItems); // Armazena o novo lote completo
                setLastStagedFormData(formData); // Marca o formulário como staged
                
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar todos os itens gerados à lista pendente
            setPendingGroups(newPendingItems);
            
            // Atualiza o lastStagedFormData para o estado atual do formulário
            setLastStagedFormData(formData);
            
            toast.info(`${newPendingItems.length} Grupo(s) de Aquisição adicionado(s) à lista pendente.`);
            
        } catch (err: any) {
            toast.error(err.message || "Erro desconhecido ao calcular.");
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingGroups = () => {
        if (pendingGroups.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        insertMutation.mutate(pendingGroups);
    };
    
    // Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        
        // 1. IDs dos registros antigos para deletar
        const oldIds = groupToReplace.records.map(r => r.id);
        
        // 2. Novos registros (pendingGroups) para inserir
        replaceGroupMutation.mutate({ oldIds, newRecords: pendingGroups });
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingGroups(prev => {
            const newPending = prev.filter(p => p.tempId !== tempId);
            if (newPending.length === 0) {
                setLastStagedFormData(null);
            }
            return newPending;
        });
        toast.info("Grupo removido da lista pendente.");
    };
    
    // Handler para a OM Favorecida (OM do PTrab)
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmDestinoId(omData.id); // Sincroniza OM Destino
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_destino: omData.nome_om, // Preenchimento automático
                ug_destino: omData.codug_om, // Preenchimento automático
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDestinoId(undefined); // Limpa OM Destino
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_destino: "", // Limpa OM Destino
                ug_destino: "", // Limpa UG Destino
            }));
        }
    };
    
    // Handler para a OM Destino do Recurso
    const handleOmDestinoChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmDestinoId(omData.id);
            setFormData(prev => ({
                ...prev,
                om_destino: omData.nome_om,
                ug_destino: omData.codug_om,
            }));
        } else {
            setSelectedOmDestinoId(undefined);
            setFormData(prev => ({
                ...prev,
                om_destino: "",
                ug_destino: "",
            }));
        }
    };
    
    const handleFaseAtividadeChange = (fase: string) => {
        setFormData(prev => ({
            ...prev,
            fase_atividade: fase,
        }));
    };
    
    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (group: ConsolidatedMaterialConsumoRecord, memoriaCompleta: string) => {
        const firstRecordId = group.records[0].id;
        setEditingMemoriaId(firstRecordId);
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
                .from("material_consumo_registros")
                .update({
                    detalhamento_customizado: memoriaEdit.trim() || null, 
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao salvar memória:", error);
            toast.error(sanitizeError(error));
        }
    };

    const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
        if (!confirm("Deseja realmente restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from("material_consumo_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    // --- Handler para Adicionar Diretriz ---
    const handleAddDiretriz = () => {
        navigate('/config/custos-operacionais', { state: { openMaterialConsumo: true } });
    };
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isSaving;

    if (isGlobalLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
            </div>
        );
    }

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    
    // Lógica de abertura da Seção 2: Depende apenas da OM Favorecida e Fase da Atividade
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.fase_atividade.length > 0;

    // Verifica se os campos numéricos da Solicitação estão preenchidos (incluindo OM Destino, agora na Seção 2)
    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.efetivo > 0 &&
                                    formData.om_destino.length > 0 && 
                                    formData.ug_destino.length > 0;

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady && formData.acquisitionGroups.length > 0;
    
    const itemsToDisplay = pendingGroups;
    const isStagingUpdate = !!editingId && pendingGroups.length > 0;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Material de Consumo
                        </CardTitle>
                        <CardDescription>
                            Detalhamento das necessidades de aquisição de Material de Consumo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStageCalculation} className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    1. Dados da Organização
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* OM FAVORECIDA */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="om_favorecida">OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={handleOmFavorecidaChange}
                                            placeholder="Selecione a OM Favorecida"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingGroups.length > 0}
                                            initialOmName={editingId ? formData.om_favorecida : undefined}
                                            initialOmUg={editingId ? formData.ug_favorecida : undefined}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="ug_favorecida">UG Favorecida</Label>
                                        <Input
                                            id="ug_favorecida"
                                            value={formatCodug(formData.ug_favorecida)}
                                            disabled
                                            className="bg-muted/50"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="fase_atividade">Fase da Atividade *</Label>
                                        <FaseAtividadeSelect
                                            value={formData.fase_atividade}
                                            onChange={handleFaseAtividadeChange}
                                            disabled={!isPTrabEditable || isSaving || pendingGroups.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR GRUPOS DE AQUISIÇÃO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Grupos de Aquisição
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Solicitação (Dias, Efetivo, OM Destino) */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Período, Efetivo e Destino do Recurso</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        
                                                        {/* CAMPO 1: DIAS OPERAÇÃO (Período) */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="dias_operacao">Período (Nr Dias) *</Label>
                                                            <Input
                                                                id="dias_operacao"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 7"
                                                                value={formData.dias_operacao === 0 ? "" : formData.dias_operacao}
                                                                onChange={(e) => setFormData({ ...formData, dias_operacao: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        
                                                        {/* CAMPO 2: EFETIVO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="efetivo">Efetivo *</Label>
                                                            <Input
                                                                id="efetivo"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 10"
                                                                value={formData.efetivo === 0 ? "" : formData.efetivo}
                                                                onChange={(e) => setFormData({ ...formData, efetivo: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        
                                                        {/* CAMPO 3: OM DESTINO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="om_destino">OM Destino do Recurso *</Label>
                                                            <OmSelector
                                                                selectedOmId={selectedOmDestinoId}
                                                                onChange={handleOmDestinoChange}
                                                                placeholder="Selecione a OM Destino"
                                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingGroups.length > 0}
                                                                initialOmName={editingId ? formData.om_destino : formData.om_favorecida}
                                                                initialOmUg={editingId ? formData.ug_destino : formData.ug_favorecida}
                                                            />
                                                        </div>

                                                        {/* CAMPO 4: UG DESTINO */}
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="ug_destino">UG Destino</Label>
                                                            <Input
                                                                id="ug_destino"
                                                                value={formatCodug(formData.ug_destino)}
                                                                disabled
                                                                className="bg-muted/50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Gerenciamento de Grupos de Aquisição */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="semibold text-base mb-4">
                                                Grupos de Aquisição ({formData.acquisitionGroups.length})
                                            </h4>
                                            
                                            {/* Formulário Inline de Criação/Edição */}
                                            {isGroupFormOpen && (
                                                <AcquisitionGroupForm
                                                    initialGroup={groupToEdit}
                                                    onSave={handleSaveAcquisitionGroup}
                                                    onCancel={handleCancelGroupForm}
                                                    isSaving={isSaving}
                                                    onOpenImport={handleAddDiretriz} // Simulação de importação
                                                />
                                            )}
                                            
                                            {/* Lista de Grupos Adicionados */}
                                            {!isGroupFormOpen && renderAcquisitionGroups()}
                                            
                                            {/* Botão para Adicionar Novo Grupo */}
                                            {!isGroupFormOpen && (
                                                <div className="flex justify-end mt-4">
                                                    <Button 
                                                        type="button" 
                                                        onClick={handleOpenGroupForm}
                                                        disabled={!isPTrabEditable || isSaving}
                                                        variant="outline"
                                                        className="w-full"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Criar Novo Grupo de Aquisição
                                                    </Button>
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                <span className="font-bold text-sm">VALOR TOTAL DOS GRUPOS:</span>
                                                <span className={cn("font-extrabold text-lg text-primary")}>
                                                    {formatCurrency(calculos.totalGeral)}
                                                </span>
                                            </div>
                                        </Card>
                                        
                                        {/* BOTÕES DE AÇÃO */}
                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button 
                                                type="submit" 
                                                disabled={!isPTrabEditable || isSaving || !isCalculationReady || isGroupFormOpen}
                                                className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                            >
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                {editingId ? "Recalcular/Revisar Lote" : "Salvar Itens na Lista"}
                                            </Button>
                                        </div>
                                        
                                    </Card> 
                                    
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({itemsToDisplay.length} Grupo(s))
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Dirty Check) */}
                                    {isMaterialConsumoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Itens na Lista" na Seção 2 para atualizar o lote pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const efetivoText = item.efetivo === 1 ? 'militar' : 'militares';
                                            
                                            const isOmDestinoDifferent = item.om_favorecida !== item.om_detentora || item.ug_favorecida !== item.ug_detentora;
                                            
                                            const groupCount = item.acquisitionGroups.length;
                                            const groupText = groupCount === 1 ? 'Grupo' : 'Grupos';

                                            return (
                                                <Card 
                                                    key={item.tempId} 
                                                    className={cn(
                                                        "border-2 shadow-md",
                                                        "border-secondary bg-secondary/10"
                                                    )}
                                                >
                                                    <CardContent className="p-4">
                                                        
                                                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/30">
                                                            <h4 className="font-bold text-base text-foreground">
                                                                Material de Consumo ({groupCount} {groupText})
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-foreground text-right">
                                                                    {formatCurrency(item.valor_total)}
                                                                </p>
                                                                {!isStagingUpdate && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => handleRemovePending(item.tempId)}
                                                                        disabled={isSaving}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Detalhes da Solicitação */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Favorecida:</p>
                                                                <p className="font-medium">OM Destino do Recurso:</p>
                                                                <p className="font-medium">Período/Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.efetivo} {efetivoText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.30:</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(totalND30)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">ND 33.90.39:</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(totalND39)}</span>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">
                                                VALOR TOTAL DO LOTE
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(totalPendingGroups)}
                                            </span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        {isStagingUpdate ? (
                                            <>
                                                <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Cancelar Edição
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleCommitStagedUpdate}
                                                    disabled={isSaving || isMaterialConsumoDirty} 
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    Atualizar Lote
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Limpar Lista
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleSavePendingGroups}
                                                    disabled={isSaving || pendingGroups.length === 0 || isMaterialConsumoDirty}
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Salvar Registros
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS (OMs Cadastradas) */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({consolidatedRegistros.length})
                                    </h3>
                                    
                                    {consolidatedRegistros.map((group) => {
                                        const totalOM = group.totalGeral;
                                        const totalND30Consolidado = group.totalND30;
                                        const totalND39Consolidado = group.totalND39;
                                        
                                        const diasOperacaoConsolidado = group.dias_operacao;
                                        const efetivoConsolidado = group.efetivo;
                                        
                                        const omName = group.organizacao;
                                        const ug = group.ug;
                                        const faseAtividade = group.fase_atividade || 'Não Definida';
                                        
                                        const diasText = diasOperacaoConsolidado === 1 ? 'dia' : 'dias';
                                        const efetivoText = efetivoConsolidado === 1 ? 'militar' : 'militares';
                                        
                                        const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                                        const omDestino = group.om_detentora;
                                        const ugDestino = group.ug_detentora;
                                        
                                        const totalGroups = group.records.length;
                                        const groupText = totalGroups === 1 ? 'Grupo' : 'Grupos';

                                        return (
                                            <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {omName} (UG: {formatCodug(ug)})
                                                        <Badge variant="outline" className="text-xs">
                                                            {faseAtividade}
                                                        </Badge>
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                {/* CORPO CONSOLIDADO */}
                                                <div className="space-y-3">
                                                    <Card 
                                                        key={group.groupKey} 
                                                        className="p-3 bg-background border"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-base text-foreground">
                                                                        Material de Consumo
                                                                    </h4>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {totalGroups} {groupText} | Período: {diasOperacaoConsolidado} {diasText} | Efetivo: {efetivoConsolidado} {efetivoText}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xl text-foreground">
                                                                    {formatCurrency(totalOM)}
                                                                </span>
                                                                {/* Botões de Ação */}
                                                                <div className="flex gap-1 shrink-0">
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleEdit(group)} 
                                                                        disabled={!isPTrabEditable || isSaving || pendingGroups.length > 0}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleConfirmDelete(group)} 
                                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Detalhes da Alocação */}
                                                        <div className="pt-2 border-t mt-2">
                                                            {/* OM Destino Recurso (Sempre visível, vermelha se diferente) */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                    {omDestino} ({formatCodug(ugDestino)})
                                                                </span>
                                                            </div>
                                                            {/* ND 33.90.30 */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                <span className="text-green-600">{formatCurrency(totalND30Consolidado)}</span>
                                                            </div>
                                                            {/* ND 33.90.39 */}
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.39:</span>
                                                                <span className="text-green-600">{formatCurrency(totalND39Consolidado)}</span>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {consolidatedRegistros.map(group => (
                                        <MaterialConsumoMemoria
                                            key={`memoria-view-${group.groupKey}`}
                                            group={group}
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
                                    ))}
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>
                
                {/* Diálogo de Confirmação de Exclusão */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                <Trash2 className="h-5 w-5" />
                                Confirmar Exclusão de Lote
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o lote de Material de Consumo para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>, contendo {groupToDelete?.records.length} Grupo(s) de Aquisição? Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction 
                                onClick={() => groupToDelete && handleDeleteMutation.mutate(groupToDelete.records.map(r => r.id))}
                                disabled={handleDeleteMutation.isPending}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir Lote
                            </AlertDialogAction>
                            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default MaterialConsumoForm;