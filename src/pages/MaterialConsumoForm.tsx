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
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, XCircle, Pencil, Sparkles, AlertCircle, Package, Minus } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
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
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { 
    MaterialConsumoGrupo, 
    ConsolidatedMaterialConsumo, 
    MaterialConsumoRegistroDB 
} from "@/types/materialConsumo";
import { 
    calculateMaterialConsumoTotals, 
    generateConsolidatedMaterialConsumoMemoriaCalculo 
} from "@/lib/materialConsumoUtils";
import MaterialConsumoItemSelectorDialog from "@/components/material-consumo/MaterialConsumoItemSelectorDialog";
import MaterialConsumoGrupoCard from "@/components/material-consumo/MaterialConsumoGrupoCard";
import ConsolidatedMaterialConsumoMemoria from "@/components/ConsolidatedMaterialConsumoMemoria";

// Tipos de dados
type MaterialConsumoRegistroDBType = Tables<'diretrizes_material_consumo'> & {
    id: string; // Usamos o ID da diretriz como ID do registro para simplificar
};

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

// Estado inicial para o formulário
interface MaterialConsumoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
}

const initialFormState: MaterialConsumoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
};

// Helper function to compare form data structures
const compareFormData = (data1: MaterialConsumoFormState, data2: MaterialConsumoFormState) => {
    return (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.efetivo !== data2.efetivo || 
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.om_destino !== data2.om_destino || 
        data1.ug_destino !== data2.ug_destino || 
        data1.fase_atividade !== data2.fase_atividade
    );
};

const MaterialConsumoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<MaterialConsumoFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null); // ID do grupo em edição
    const [groupToReplace, setGroupToReplace] = useState<ConsolidatedMaterialConsumo | null>(null); 
    
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ConsolidatedMaterialConsumo | null>(null); 
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de grupos calculados, mas não salvos (Staging Area)
    const [pendingGrupos, setPendingGrupos] = useState<MaterialConsumoGrupo[]>([]);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingGrupos
    const [lastStagedFormData, setLastStagedFormData] = useState<MaterialConsumoFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida e OM Destino
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    
    // Estado para o diálogo de seleção de itens
    const [showItemSelector, setShowItemSelector] = useState(false);
    
    // Estado para edição de item (passado para o seletor)
    const [diretrizToEditId, setDiretrizToEditId] = useState<string | null>(null);
    const [itemsToEdit, setItemsToEdit] = useState<ItemAquisicao[]>([]);
    
    // Busca o ano padrão para o seletor de diretrizes
    const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
    const selectedYear = defaultYearData?.year || new Date().getFullYear();

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // Material de Consumo usa a tabela 'diretrizes_material_consumo' para persistência,
    // mas aqui simulamos que os registros são salvos em uma tabela de registros.
    // Para esta etapa, vamos simular que 'registros' são os grupos consolidados.
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<MaterialConsumoRegistroDBType[]>({
        queryKey: ['materialConsumoRegistros', ptrabId],
        // SIMULAÇÃO: Retorna um array vazio para esta etapa
        queryFn: async () => {
            // Aqui, no futuro, buscaríamos os registros de material de consumo vinculados ao PTrab
            // Por enquanto, retornamos um array vazio para simular que não há dados salvos.
            return [];
        },
        enabled: !!ptrabId,
    });
    
    // NOVO MEMO: Consolida os registros por lote de solicitação (SIMULADO)
    const consolidatedRegistros = useMemo<ConsolidatedMaterialConsumo[]>(() => {
        // SIMULAÇÃO: Retorna um array vazio para esta etapa
        return [];
    }, [registros]);
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // --- Mutations (SIMULADAS) ---

    const insertMutation = useMutation({
        mutationFn: async (newGrupos: MaterialConsumoGrupo[]) => {
            // SIMULAÇÃO: Apenas loga e retorna
            console.log("SIMULAÇÃO: Inserindo novos grupos de Material de Consumo:", newGrupos);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simula delay
            return newGrupos;
        },
        onSuccess: () => {
            toast.success(`Sucesso! ${pendingGrupos.length} grupo(s) de Material de Consumo adicionado(s) (SIMULADO).`);
            setPendingGrupos([]);
            setLastStagedFormData(null);
            // queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            // queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            
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
            }));
            
            resetForm();
        },
        onError: (error) => { 
            toast.error("Falha ao salvar registros (SIMULADO).", { description: sanitizeError(error) });
        }
    });

    const replaceGroupMutation = useMutation({
        mutationFn: async ({ oldGroup, newGrupo }: { oldGroup: ConsolidatedMaterialConsumo, newGrupo: MaterialConsumoGrupo }) => {
            // SIMULAÇÃO: Apenas loga e retorna
            console.log("SIMULAÇÃO: Substituindo grupo:", oldGroup, "por:", newGrupo);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simula delay
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo atualizado com sucesso (SIMULADO)!");
            setEditingId(null);
            setPendingGrupos([]);
            setGroupToReplace(null);
            // queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            // queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            resetForm();
        },
        onError: (error) => {
            toast.error("Falha ao atualizar lote (SIMULADO).", { description: sanitizeError(error) });
        }
    });

    const handleDeleteMutation = useMutation({
        mutationFn: async (group: ConsolidatedMaterialConsumo) => {
            // SIMULAÇÃO: Apenas loga e retorna
            console.log("SIMULAÇÃO: Excluindo grupo:", group);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simula delay
        },
        onSuccess: () => {
            toast.success("Lote de Material de Consumo excluído com sucesso (SIMULADO)!");
            // queryClient.invalidateQueries({ queryKey: ['materialConsumoRegistros', ptrabId] });
            // queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setGroupToDelete(null);
        },
        onError: (error) => {
            toast.error("Falha ao excluir lote (SIMULADO).", { description: sanitizeError(error) });
        }
    });
    
    // Efeito de inicialização da OM Favorecida e OM Destino
    useEffect(() => {
        if (ptrabData && !editingId) {
            setFormData(prev => ({
                ...initialFormState,
                om_favorecida: "", 
                ug_favorecida: "", 
                om_destino: "",
                ug_destino: "",
            }));
            setSelectedOmFavorecidaId(undefined); 
            setSelectedOmDestinoId(undefined);
        }
    }, [ptrabData, oms, editingId]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo"
    const isMaterialConsumoDirty = useMemo(() => {
        if (pendingGrupos.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }
        return false;
    }, [formData, pendingGrupos.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingGrupos = useMemo(() => {
        return pendingGrupos.reduce((sum, grupo) => sum + grupo.totalLinha, 0);
    }, [pendingGrupos]);
    
    // =================================================================
    // HANDLERS DE AÇÃO
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setGroupToReplace(null);
        setDiretrizToEditId(null);
        setItemsToEdit([]);
        setFormData(prev => ({
            ...prev, // Mantém OM, UG, Fase, Dias, Efetivo
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
    };
    
    const handleClearPending = () => {
        setPendingGrupos([]);
        setLastStagedFormData(null);
        setEditingId(null);
        setGroupToReplace(null);
        resetForm();
    };

    // SIMULAÇÃO: Edição de um grupo consolidado
    const handleEdit = (group: ConsolidatedMaterialConsumo) => {
        if (pendingGrupos.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        // Limpa estados pendentes
        setPendingGrupos([]);
        setLastStagedFormData(null);
        
        // Define o modo edição
        setEditingId(group.records[0].id); 
        setGroupToReplace(group); 
        
        // 1. Configurar OM Favorecida e OM Destino
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === group.organizacao && om.codug_om === group.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        const omDestinoToEdit = oms?.find(om => om.nome_om === group.om_detentora && om.codug_om === group.ug_detentora);
        setSelectedOmDestinoId(omDestinoToEdit?.id);
        
        // 2. Reconstruir a lista de itens selecionados a partir de TODOS os registros do grupo
        // Nota: Material de Consumo é mais complexo, pois um grupo consolidado pode ter vários subitens.
        // Para simplificar a edição, vamos assumir que o grupo consolidado representa um único Subitem ND
        // e que todos os itens de aquisição pertencem a ele.
        
        const firstRecord = group.records[0];
        
        const newFormData: MaterialConsumoFormState = {
            om_favorecida: group.organizacao, 
            ug_favorecida: group.ug, 
            om_destino: group.om_detentora,
            ug_destino: group.ug_detentora,
            dias_operacao: group.dias_operacao,
            efetivo: group.efetivo || 0, 
            fase_atividade: group.fase_atividade || "",
        };
        setFormData(newFormData);
        
        // 3. Prepara o diálogo de seleção de itens com os dados originais
        setDiretrizToEditId(firstRecord.diretrizId);
        setItemsToEdit(group.records.map(r => r.item_aquisicao));
        
        // 4. Abre o diálogo para o usuário revisar/recalcular
        setShowItemSelector(true);
        
        toast.info("Modo Edição ativado. Revise os itens e clique em 'Recalcular/Revisar Lote'.");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (group: ConsolidatedMaterialConsumo) => {
        setGroupToDelete(group); 
        setShowDeleteDialog(true);
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
    
    // --- Lógica de Seleção de Itens (Callback do Dialog) ---
    const handleItemSelection = (diretriz: DiretrizMaterialConsumo, selectedItems: ItemAquisicao[]) => {
        
        // 1. Criar o novo grupo de material de consumo
        let newGrupo: MaterialConsumoGrupo = {
            id: editingId || crypto.randomUUID(), // Mantém o ID se estiver editando
            diretrizId: diretriz.id,
            nrSubitem: diretriz.nr_subitem,
            nomeSubitem: diretriz.nome_subitem,
            
            organizacao: formData.om_favorecida,
            ug: formData.ug_favorecida,
            om_detentora: formData.om_destino,
            ug_detentora: formData.ug_destino,
            dias_operacao: formData.dias_operacao,
            efetivo: formData.efetivo,
            fase_atividade: formData.fase_atividade,
            
            itensSelecionados: selectedItems,
            
            valorND30: 0,
            valorND39: 0,
            totalLinha: 0,
            memoriaCalculo: "",
            detalhamentoCustomizado: null,
        };
        
        // 2. Calcular totais e memória
        newGrupo = calculateMaterialConsumoTotals(newGrupo);
        
        if (editingId) {
            // MODO EDIÇÃO: Substitui o grupo pendente (deve haver apenas um)
            
            // Preserva a memória customizada do grupo original, se existir
            if (groupToReplace && groupToReplace.records[0]?.detalhamento_customizado) {
                newGrupo.detalhamentoCustomizado = groupToReplace.records[0].detalhamento_customizado;
            }
            
            setPendingGrupos([newGrupo]);
            setLastStagedFormData(formData); // Marca o formulário como staged
            
            toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
            return;
        }
        
        // MODO ADIÇÃO: Adiciona o novo grupo à lista pendente
        setPendingGrupos(prev => [...prev, newGrupo]);
        setLastStagedFormData(formData);
        
        toast.info(`Grupo de Material de Consumo adicionado à lista pendente.`);
        
        // Limpa a seleção de itens para o próximo grupo
        setDiretrizToEditId(null);
        setItemsToEdit([]);
    };
    
    // Salva todos os itens pendentes no DB (SIMULADO)
    const handleSavePendingGrupos = () => {
        if (pendingGrupos.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        insertMutation.mutate(pendingGrupos);
    };
    
    // Confirma a atualização do item estagiado no DB (SIMULADO)
    const handleCommitStagedUpdate = () => {
        if (!editingId || !groupToReplace || pendingGrupos.length !== 1) {
            toast.error("Erro: Dados de atualização incompletos.");
            return;
        }
        
        replaceGroupMutation.mutate({ oldGroup: groupToReplace, newGrupo: pendingGrupos[0] });
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (id: string) => {
        setPendingGrupos(prev => {
            const newPending = prev.filter(p => p.id !== id);
            if (newPending.length === 0) {
                setLastStagedFormData(null);
            }
            return newPending;
        });
        toast.info("Grupo removido da lista pendente.");
    };
    
    // --- Lógica de Edição de Memória ---
    
    const handleIniciarEdicaoMemoria = (group: ConsolidatedMaterialConsumo, memoriaCompleta: string) => {
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
        // SIMULAÇÃO: Apenas loga
        console.log(`SIMULAÇÃO: Salvando memória customizada para registro ${registroId}:`, memoriaEdit);
        toast.success("Memória de cálculo atualizada com sucesso (SIMULADO)!");
        handleCancelarEdicaoMemoria();
        // queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] });
    };

    const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
        if (!confirm("Deseja realmente restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
            return;
        }
        
        // SIMULAÇÃO: Apenas loga
        console.log(`SIMULAÇÃO: Restaurando memória automática para registro ${registroId}`);
        toast.success("Memória de cálculo restaurada (SIMULADO)!");
        // queryClient.invalidateQueries({ queryKey: ["materialConsumoRegistros", ptrabId] });
    };
    
    // --- Handler para Adicionar Diretriz ---
    const handleAddDiretriz = () => {
        navigate('/config/custos-operacionais', { state: { openMaterialConsumo: true } });
    };
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isLoadingDefaultYear;
    const isSaving = insertMutation.isPending || replaceGroupMutation.isPending || handleDeleteMutation.isPending;

    if (isGlobalLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
            </div>
        );
    }

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.fase_atividade.length > 0;

    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.efetivo > 0 &&
                                    formData.om_destino.length > 0 && 
                                    formData.ug_destino.length > 0;

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
                            Material de Consumo (ND 33.90.30 e 33.90.39)
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para aquisição de material de consumo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
                            
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
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingGrupos.length > 0}
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
                                            disabled={!isPTrabEditable || isSaving || pendingGrupos.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR ITEM (SELEÇÃO DE DIRETRIZ) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Grupo de Aquisição
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
                                                                disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingGrupos.length > 0}
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
                                        
                                        {/* Seleção de Itens de Aquisição */}
                                        <Card className="mt-4 rounded-lg p-4 bg-background">
                                            <h4 className="font-semibold text-base mb-4">
                                                Itens de Aquisição (Subitem da ND)
                                            </h4>
                                            
                                            <div className="space-y-4">
                                                <Button 
                                                    type="button" 
                                                    onClick={() => setShowItemSelector(true)}
                                                    disabled={!isPTrabEditable || isSaving || !isSolicitationDataReady}
                                                    variant="secondary"
                                                    className="w-full"
                                                >
                                                    <Package className="mr-2 h-4 w-4" />
                                                    Selecionar Subitem da ND e Itens *
                                                </Button>
                                                
                                                {!isSolicitationDataReady && (
                                                    <Alert variant="warning">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertDescription>
                                                            Preencha o Período, Efetivo e a OM Destino do Recurso acima para selecionar os itens.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        </Card>
                                        
                                    </Card> 
                                    
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {pendingGrupos.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. {editingId ? "Revisão de Atualização" : "Itens Adicionados"} ({pendingGrupos.length} grupo(s))
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Modo Novo Registro) */}
                                    {!editingId && isMaterialConsumoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Recalcule o grupo pendente para refletir as mudanças.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isMaterialConsumoDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Recalcule o lote na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {pendingGrupos.map((grupo) => (
                                            <MaterialConsumoGrupoCard
                                                key={grupo.id}
                                                grupo={grupo}
                                                isStagingUpdate={!!editingId}
                                                isSaving={isSaving}
                                                onRemovePending={handleRemovePending}
                                            />
                                        ))}
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">
                                                VALOR TOTAL DO LOTE
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(totalPendingGrupos)}
                                            </span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        {editingId ? (
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
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Atualizar Lote (SIMULADO)
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
                                                    onClick={handleSavePendingGrupos}
                                                    disabled={isSaving || pendingGrupos.length === 0 || isMaterialConsumoDirty}
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Salvar Registros (SIMULADO)
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: REGISTROS SALVOS (OMs Cadastradas) */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 ? (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({consolidatedRegistros.length})
                                    </h3>
                                    
                                    {consolidatedRegistros.map((group) => {
                                        const totalOM = group.totalGeral;
                                        const omName = group.organizacao;
                                        const ug = group.ug;
                                        const faseAtividade = group.fase_atividade || 'Não Definida';
                                        
                                        const isDifferentOm = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;
                                        const omDestino = group.om_detentora;
                                        const ugDestino = group.ug_detentora;

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
                                                
                                                <div className="space-y-3">
                                                    <Card className="p-3 bg-background border">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-base text-foreground">
                                                                        Material de Consumo
                                                                    </h4>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {group.records.length} item(ns) de aquisição | Período: {group.dias_operacao} dias | Efetivo: {group.efetivo} militares
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold text-xl text-foreground">
                                                                    {formatCurrency(group.totalGeral)}
                                                                </span>
                                                                <div className="flex gap-1 shrink-0">
                                                                    <Button
                                                                        type="button" 
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleEdit(group)} 
                                                                        disabled={!isPTrabEditable || isSaving || pendingGrupos.length > 0}
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
                                                        
                                                        <div className="pt-2 border-t mt-2">
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                    {omDestino} ({formatCodug(ugDestino)})
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.30:</span>
                                                                <span className="text-green-600">{formatCurrency(group.totalND30)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-muted-foreground">ND 33.90.39:</span>
                                                                <span className="text-green-600">{formatCurrency(group.totalND39)}</span>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </section>
                            ) : (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas (0)
                                    </h3>
                                    <Alert variant="default">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Nenhum registro de Material de Consumo salvo para este P Trab.
                                        </AlertDescription>
                                    </Alert>
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS */}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {consolidatedRegistros.map(group => (
                                        <ConsolidatedMaterialConsumoMemoria
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
                                Tem certeza que deseja excluir o lote de Material de Consumo para a OM <span className="font-bold">{groupToDelete?.organizacao}</span>? Esta ação é irreversível.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction 
                                onClick={() => groupToDelete && handleDeleteMutation.mutate(groupToDelete)}
                                disabled={handleDeleteMutation.isPending}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir Lote (SIMULADO)
                            </AlertDialogAction>
                            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                
                {/* Diálogo de Seleção de Itens */}
                <MaterialConsumoItemSelectorDialog
                    open={showItemSelector}
                    onOpenChange={setShowItemSelector}
                    selectedYear={selectedYear}
                    onSelect={handleItemSelection}
                    initialDiretrizId={diretrizToEditId}
                    initialItems={itemsToEdit}
                    onAddDiretriz={handleAddDiretriz}
                />
            </div>
        </div>
    );
};

export default MaterialConsumoForm;