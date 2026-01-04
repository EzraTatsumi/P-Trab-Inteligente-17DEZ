import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Briefcase, Loader2, Save, Trash2, Edit, Plus, Users, MapPin, Calendar, Check, X, ClipboardList, FileText, Plane, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatNumber, formatCodug, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords, fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { 
    DIARIA_RANKS_CONFIG, 
    DestinoDiaria, 
    QuantidadesPorPosto, 
    calculateDiariaTotals, 
    generateDiariaMemoriaCalculo 
} from "@/lib/diariaUtils";
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
import * as z from "zod";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator"; 
import { LocalAtividadeSelect } from "@/components/LocalAtividadeSelect"; // NOVO
import { DESTINO_OPTIONS } from "@/lib/diariaConstants"; // NOVO
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Importar Alert

// Tipos de dados
// NOTE: O tipo Tables<'diaria_registros'> será atualizado automaticamente pelo Supabase CLI
// assumindo que valor_nd_39 foi removido e valor_nd_15 foi adicionado.
type DiariaRegistro = Tables<'diaria_registros'>;
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Tipo de dados para OmSelector
interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
}

// Tipo para o registro calculado antes de salvar (inclui campos de display)
interface CalculatedDiaria extends TablesInsert<'diaria_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    // Campos de display adicionais
    destinoLabel: string;
    totalMilitares: number;
    // Adicionando valor_nd_15 e removendo valor_nd_39 do tipo local para consistência
    valor_nd_15: number;
}

// Schema de validação para o formulário de Diária
const diariaSchema = z.object({
    organizacao: z.string().min(1, "A OM de destino é obrigatória."),
    ug: z.string().min(1, "A UG de destino é obrigatória."),
    dias_operacao: z.number().int().min(1, "O número de dias deve ser maior que zero."),
    destino: z.enum(['bsb_capitais_especiais', 'demais_capitais', 'demais_dslc'], {
        required_error: "O local para fins de pagamento é obrigatório."
    }),
    nr_viagens: z.number().int().min(1, "O número de viagens deve ser maior que zero."),
    local_atividade: z.string().min(1, "O local da atividade é obrigatório."),
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."),
    is_aereo: z.boolean(),
    
    // Campo nomeado para as quantidades por posto
    quantidades_por_posto: z.record(z.string(), z.number().int().min(0)).refine(
        (data) => Object.values(data).some(qty => qty > 0),
        { message: "Pelo menos um militar deve ser adicionado." }
    ),
    
    om_detentora: z.string().optional().nullable(),
    ug_detentora: z.string().optional().nullable(),
});

// Estado inicial para o formulário
const initialFormState = {
    organizacao: "",
    ug: "",
    dias_operacao: 1,
    destino: 'bsb_capitais_especiais' as DestinoDiaria,
    nr_viagens: 1,
    local_atividade: "",
    fase_atividade: "",
    is_aereo: false,
    om_detentora: null,
    ug_detentora: null,
    quantidades_por_posto: DIARIA_RANKS_CONFIG.reduce((acc, rank) => ({ ...acc, [rank.key]: 0 }), {} as QuantidadesPorPosto),
};

const DiariaForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<DiariaRegistro | null>(null);
    const [memoriaCustomizada, setMemoriaCustomizada] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingDiarias, setPendingDiarias] = useState<CalculatedDiaria[]>([]);
    
    // Estado para rastrear o ID da OM selecionada no OmSelector
    const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
    
    // NOVOS ESTADOS PARA CONTROLE DE ALTERAÇÃO
    const [lastSavedItem, setLastSavedItem] = useState<typeof initialFormState | null>(null);
    const [isFormDirty, setIsFormDirty] = useState(false);

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });
    
    // NOVO: Busca o ano de referência padrão/mais recente
    const { data: diretrizYearData, isLoading: isLoadingDiretrizYear } = useDefaultDiretrizYear();
    const anoReferencia = diretrizYearData?.year;

    // Busca as diretrizes operacionais usando o ano de referência
    const { data: diretrizesOp, isLoading: isLoadingDiretrizes } = useQuery<DiretrizOperacional>({
        queryKey: ['diretrizesOperacionais', anoReferencia],
        queryFn: () => fetchDiretrizesOperacionais(anoReferencia!),
        enabled: !!anoReferencia,
        retry: 1, 
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<DiariaRegistro[]>({
        queryKey: ['diariaRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('diaria_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

    // EFEITO PARA DETECTAR ALTERAÇÕES NO FORMULÁRIO
    useEffect(() => {
        if (lastSavedItem) {
            // Compara o formData atual (excluindo om_detentora/ug_detentora que são sempre null no form)
            const currentData = JSON.stringify({ ...formData, om_detentora: null, ug_detentora: null });
            const savedData = JSON.stringify(lastSavedItem);
            
            setIsFormDirty(currentData !== savedData);
        } else {
            // Se não há item salvo, verifica se o formulário está preenchido (diferente do initialFormState)
            const isInitial = JSON.stringify(formData) === JSON.stringify(initialFormState);
            setIsFormDirty(!isInitial);
        }
    }, [formData, lastSavedItem]);


    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    const calculos = useMemo(() => {
        if (!diretrizesOp || !ptrabData) {
            return {
                totalDiariaBase: 0,
                totalTaxaEmbarque: 0,
                totalGeral: 0,
                totalMilitares: 0,
                calculosPorPosto: [],
                memoria: "Preencha todos os campos obrigatórios e verifique se as Diretrizes Operacionais estão cadastradas para o ano de referência.",
            };
        }
        
        try {
            // Validação rápida dos campos essenciais antes de calcular
            if (formData.dias_operacao <= 0 || formData.nr_viagens <= 0 || !formData.destino || formData.organizacao.length === 0) {
                return {
                    totalDiariaBase: 0, totalTaxaEmbarque: 0, totalGeral: 0, totalMilitares: 0, calculosPorPosto: [],
                    memoria: "Preencha todos os campos obrigatórios para calcular.",
                };
            }
            
            const totals = calculateDiariaTotals(formData as any, diretrizesOp);
            
            const memoria = generateDiariaMemoriaCalculo(formData as any, diretrizesOp, totals);
            
            return {
                ...totals,
                memoria,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalDiariaBase: 0,
                totalTaxaEmbarque: 0,
                totalGeral: 0,
                totalMilitares: 0,
                calculosPorPosto: [],
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, diretrizesOp, ptrabData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingDiarias = useMemo(() => {
        return pendingDiarias.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingDiarias]);

    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: TablesInsert<'diaria_registros'>[]) => {
            if (recordsToSave.length === 0) return;
            
            // Mapeia para o formato de inserção, garantindo que valor_nd_39 não seja enviado
            const dbRecords = recordsToSave.map(record => {
                const { valor_nd_39, ...rest } = record as any; // Remove valor_nd_39 se ainda estiver no tipo
                return rest;
            });

            const { error } = await supabase
                .from("diaria_registros")
                .insert(dbRecords);
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingDiarias.length} registro(s) de Diária adicionado(s).`);
            setPendingDiarias([]); // Limpa a lista pendente
            resetForm();
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: TablesUpdate<'diaria_registros'>) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            const { error } = await supabase
                .from("diaria_registros")
                .update(data)
                .eq("id", editingId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Registro de Diária atualizado com sucesso!`);
            resetForm();
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });

    const handleDeleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("diaria_registros")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success("Registro de Diária excluído com sucesso!");
            setRegistroToDelete(null);
            setShowDeleteDialog(false);
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });

    // =================================================================
    // HANDLERS
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setFormData(initialFormState);
        setMemoriaCustomizada("");
        setSelectedOmId(undefined);
        setLastSavedItem(null); // Resetar o último item salvo
        setIsFormDirty(false); // Resetar o estado de sujeira
    };
    
    const handleClearPending = () => {
        setPendingDiarias([]);
        resetForm();
    };

    const handleEdit = (registro: DiariaRegistro) => {
        if (pendingDiarias.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        const omToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmId(omToEdit?.id);

        const newFormData = {
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.dias_operacao,
            destino: registro.destino as DestinoDiaria,
            nr_viagens: registro.nr_viagens,
            local_atividade: registro.local_atividade || "",
            fase_atividade: registro.fase_atividade || "",
            is_aereo: (registro as any).is_aereo || false,
            om_detentora: null,
            ug_detentora: null,
            quantidades_por_posto: (registro.quantidades_por_posto || initialFormState.quantidades_por_posto) as QuantidadesPorPosto,
        };
        
        setFormData(newFormData);
        setLastSavedItem(newFormData); // Define o item editado como o último salvo
        setMemoriaCustomizada(registro.detalhamento_customizado || "");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: DiariaRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente
    const handleCalculateAndAdd = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingId) {
            // Se estiver editando, chama a função de atualização direta
            handleUpdateExisting(e);
            return;
        }
        
        if (!diretrizesOp) {
            toast.error("Diretrizes Operacionais não carregadas. Verifique as configurações.");
            return;
        }
        
        try {
            // 1. Validação Zod
            diariaSchema.parse(formData);
            
            // 2. Validação de OM/UG
            const omDestino = oms?.find(om => om.id === selectedOmId);
            if (!omDestino || omDestino.codug_om !== formData.ug || omDestino.nome_om !== formData.organizacao) {
                toast.error("OM de Destino inválida ou UG não corresponde.");
                return;
            }
            
            // 3. Preparar o objeto final (baseData)
            const destinoLabel = DESTINO_OPTIONS.find(d => d.value === formData.destino)?.label || formData.destino;
            
            const newPending: CalculatedDiaria = {
                tempId: Math.random().toString(36).substring(2, 9), // ID temporário
                p_trab_id: ptrabId!,
                organizacao: formData.organizacao,
                ug: formData.ug,
                om_detentora: null,
                ug_detentora: null,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                destino: formData.destino,
                nr_viagens: formData.nr_viagens,
                local_atividade: formData.local_atividade,
                
                // Campos calculados
                quantidade: calculos.totalMilitares,
                valor_taxa_embarque: calculos.totalTaxaEmbarque,
                valor_total: calculos.totalGeral,
                valor_nd_30: 0, // Taxa de Embarque consolidada na ND 15
                valor_nd_15: calculos.totalGeral, // Total Geral (Diária Base + Taxa Embarque)
                
                quantidades_por_posto: formData.quantidades_por_posto,
                detalhamento: calculos.memoria,
                detalhamento_customizado: memoriaCustomizada.trim().length > 0 ? memoriaCustomizada : null,
                is_aereo: formData.is_aereo,
                
                // Campos que foram NOT NULL, mas são redundantes no novo fluxo
                posto_graduacao: null,
                valor_diaria_unitario: null,

                // Campos de display para a lista pendente (CORRIGIDO)
                destinoLabel: destinoLabel,
                totalMilitares: calculos.totalMilitares,
            };
            
            // 4. Adicionar à lista pendente
            setPendingDiarias(prev => [...prev, newPending]);
            
            setMemoriaCustomizada("");
            
            // 5. Atualizar o estado de controle de alteração
            setLastSavedItem(formData);
            setIsFormDirty(false);
            
            toast.info("Item de Diária adicionado à lista pendente.");
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingDiarias = () => {
        if (pendingDiarias.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        // Mapeia os itens pendentes para o formato de inserção no DB
        const recordsToSave: TablesInsert<'diaria_registros'>[] = pendingDiarias.map(p => {
            // Remove campos de display e temporários
            const { tempId, memoria_calculo_display, destinoLabel, totalMilitares, valor_nd_39, ...dbRecord } = p as any;
            return dbRecord as TablesInsert<'diaria_registros'>;
        });
        
        saveMutation.mutate(recordsToSave);
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingDiarias(prev => prev.filter(p => p.tempId !== tempId));
        toast.info("Item removido da lista pendente.");
    };
    
    // Edita item existente (apenas se não houver pendentes)
    const handleUpdateExisting = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!editingId) return;
        
        if (!diretrizesOp) {
            toast.error("Diretrizes Operacionais não carregadas. Verifique as configurações.");
            return;
        }
        
        try {
            diariaSchema.parse(formData);
            
            const baseData: TablesUpdate<'diaria_registros'> = {
                organizacao: formData.organizacao,
                ug: formData.ug,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                destino: formData.destino,
                nr_viagens: formData.nr_viagens,
                local_atividade: formData.local_atividade,
                
                quantidade: calculos.totalMilitares,
                valor_taxa_embarque: calculos.totalTaxaEmbarque,
                valor_total: calculos.totalGeral,
                valor_nd_30: 0, // Taxa de Embarque consolidada na ND 15
                valor_nd_15: calculos.totalGeral, // Total Geral (Diária Base + Taxa Embarque)
                
                quantidades_por_posto: formData.quantidades_por_posto,
                detalhamento: calculos.memoria,
                detalhamento_customizado: memoriaCustomizada.trim().length > 0 ? memoriaCustomizada : null,
                is_aereo: formData.is_aereo,
                
                posto_graduacao: null,
                valor_diaria_unitario: null,
            };
            
            updateMutation.mutate(baseData);
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    const handleOmChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmId(omData.id);
            setFormData(prev => ({
                ...prev,
                organizacao: omData.nome_om,
                ug: omData.codug_om,
            }));
        } else {
            setSelectedOmId(undefined);
            setFormData(prev => ({
                ...prev,
                organizacao: "",
                ug: "",
            }));
        }
    };
    
    const handleFaseAtividadeChange = (fase: string) => {
        setFormData(prev => ({
            ...prev,
            fase_atividade: fase,
        }));
    };
    
    const handleRankQuantityChange = (rankKey: string, value: string) => {
        const qty = parseInt(value) || 0;
        setFormData(prev => ({
            ...prev,
            quantidades_por_posto: {
                ...prev.quantidades_por_posto,
                [rankKey]: qty,
            }
        }));
    };
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isLoadingDiretrizes || isLoadingDiretrizYear;

    if (isGlobalLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab e diretrizes...</span>
            </div>
        );
    }

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isSaving = saveMutation.isPending || updateMutation.isPending;
    
    const isBaseFormReady = formData.organizacao.length > 0 && 
                            formData.ug.length > 0 && 
                            formData.fase_atividade.length > 0;

    const isCalculationReady = isBaseFormReady &&
                              formData.dias_operacao > 0 &&
                              formData.nr_viagens > 0 &&
                              formData.local_atividade.length > 0 &&
                              calculos.totalMilitares > 0;
    
    // Usando DESTINO_OPTIONS importado
    const destinoOptions = DESTINO_OPTIONS;
    
    const getUnitValueDisplay = (rankKey: string, destino: DestinoDiaria) => {
        if (!diretrizesOp) return "R$ 0,00";
        
        const rankConfig = DIARIA_RANKS_CONFIG.find(r => r.key === rankKey);
        if (!rankConfig) return "R$ 0,00";

        let fieldSuffix: 'bsb' | 'capitais' | 'demais';
        
        switch (destino) {
            case 'bsb_capitais_especiais':
                fieldSuffix = 'bsb';
                break;
            case 'demais_capitais':
                fieldSuffix = 'capitais';
                break;
            case 'demais_dslc':
                fieldSuffix = 'demais';
                break;
            default:
                return "R$ 0,00";
        }
        
        const fieldKey = `${rankConfig.fieldPrefix}_${fieldSuffix}` as keyof DiretrizOperacional;
        const value = Number(diretrizesOp[fieldKey] || 0);
        return formatCurrency(value);
    };
    
    const taxaEmbarqueUnitario = diretrizesOp?.taxa_embarque ? Number(diretrizesOp.taxa_embarque) : 0;
    const referenciaLegal = diretrizesOp?.diaria_referencia_legal || 'Decreto/Portaria não cadastrada';

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o P Trab
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Pagamento de Diárias
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para Pagamento de Diárias em Atividades Militares.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCalculateAndAdd} className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    1. Dados da Organização
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="organizacao">OM de Destino do Recurso *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmId}
                                            onChange={handleOmChange}
                                            placeholder="Selecione a OM de Destino"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingDiarias.length > 0}
                                            initialOmName={formData.organizacao}
                                            initialOmUg={formData.ug}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="ug">UG de Destino</Label>
                                        <Input
                                            id="ug"
                                            value={formatCodug(formData.ug)}
                                            disabled
                                            className="bg-muted/50"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="fase_atividade">Fase da Atividade *</Label>
                                        <FaseAtividadeSelect
                                            value={formData.fase_atividade}
                                            onChange={handleFaseAtividadeChange}
                                            disabled={!isPTrabEditable || isSaving || pendingDiarias.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (DIAS, VIAGENS, LOCAL E EFETIVO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Item de Diária
                                        {isFormDirty && (
                                            <Badge variant="destructive" className="ml-2 animate-pulse">
                                                <Edit className="h-3 w-3 mr-1" />
                                                Não Salvo
                                            </Badge>
                                        )}
                                    </h3>
                                    
                                    {/* Linha de Destino (Tabs) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="destino">Local para fins de Pagamento</Label>
                                        <Tabs 
                                            value={formData.destino} 
                                            onValueChange={(value) => {
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    destino: value as DestinoDiaria,
                                                    // Limpa o local da atividade ao mudar o destino, forçando nova seleção/digitação
                                                    local_atividade: "" 
                                                }));
                                            }}
                                            className="w-full"
                                        >
                                            <TabsList className="grid w-full grid-cols-3">
                                                {destinoOptions.map(opt => (
                                                    <TabsTrigger key={opt.value} value={opt.value} disabled={!isPTrabEditable || isSaving}>
                                                        {opt.label}
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    
                                    {/* NÍVEL III: Card com fundo cinza para agrupar a configuração */}
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Viagem (Card) - NÍVEL IV */}
                                        <Card className="rounded-lg">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Dados da Viagem</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="dias_operacao">Nr Dias da Viagem *</Label>
                                                            <Input
                                                                id="dias_operacao"
                                                                type="number"
                                                                min={1}
                                                                value={formData.dias_operacao === 0 ? "" : formData.dias_operacao}
                                                                onChange={(e) => setFormData({ ...formData, dias_operacao: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="nr_viagens">Nr Viagens *</Label>
                                                            <Input
                                                                id="nr_viagens"
                                                                type="number"
                                                                min={1}
                                                                value={formData.nr_viagens === 0 ? "" : formData.nr_viagens}
                                                                onChange={(e) => setFormData({ ...formData, nr_viagens: parseInt(e.target.value) || 0 })}
                                                                required
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 grid grid-cols-2 gap-4">
                                                            <div className="space-y-2 col-span-1">
                                                                <Label htmlFor="local_atividade">Local da Atividade *</Label>
                                                                <LocalAtividadeSelect
                                                                    destino={formData.destino}
                                                                    value={formData.local_atividade}
                                                                    onChange={(value) => setFormData({ ...formData, local_atividade: value })}
                                                                    disabled={!isPTrabEditable || isSaving}
                                                                />
                                                            </div>
                                                            {/* NOVO CAMPO: Deslocamento Aéreo */}
                                                            <div className="flex flex-col col-span-1">
                                                                <Label htmlFor="is_aereo" className="text-sm font-medium mb-2">
                                                                    Deslocamento Aéreo?
                                                                </Label>
                                                                <div className="flex items-center space-x-2 h-10 mt-auto">
                                                                    <Switch
                                                                        id="is_aereo"
                                                                        checked={formData.is_aereo}
                                                                        onCheckedChange={(checked) => setFormData({ ...formData, is_aereo: checked })}
                                                                        disabled={!isPTrabEditable || isSaving}
                                                                    />
                                                                    <span className="text-sm text-muted-foreground">
                                                                        {formData.is_aereo ? "Sim (Inclui Taxa de Embarque)" : "Não (Terrestre/Fluvial)"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Tabela de Posto/Graduação e Quantidade (Estilizada como Card) - NÍVEL IV */}
                                        <Card className="mt-4 rounded-lg">
                                            <CardHeader className="py-2">
                                                <CardTitle className="text-base font-semibold">Efetivo por Posto/Graduação</CardTitle>
                                                <p className="text-xs text-muted-foreground">
                                                    Referência Legal: {referenciaLegal}.
                                                </p>
                                            </CardHeader>
                                            <CardContent className="p-3 pt-1">
                                                <div className="rounded-lg border overflow-hidden">
                                                    <Table>
                                                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                                            <TableRow className="bg-muted hover:bg-muted">
                                                                <TableHead className="w-[30%]">Posto/Graduação</TableHead>
                                                                <TableHead className="w-[15%] text-center">Valor Unitário</TableHead>
                                                                <TableHead className="w-[20%] text-center">Taxa de Embarque</TableHead>
                                                                <TableHead className="w-[15%] text-center">Efetivo</TableHead>
                                                                <TableHead className="w-[20%] text-right">Custo Diária (R$)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {DIARIA_RANKS_CONFIG.map((rank) => {
                                                                const qty = formData.quantidades_por_posto[rank.key] || 0;
                                                                const unitValue = getUnitValueDisplay(rank.key, formData.destino);
                                                                const calculatedCost = calculos.calculosPorPosto.find(c => c.posto === rank.label)?.custoTotal || 0;
                                                                
                                                                // Valor da Taxa de Embarque para esta linha
                                                                const taxaEmbarqueDisplay = formData.is_aereo 
                                                                    ? formatCurrency(taxaEmbarqueUnitario) 
                                                                    : formatCurrency(0);
                                                                
                                                                return (
                                                                    <TableRow key={rank.key}>
                                                                        <TableCell className="font-medium">{rank.label}</TableCell>
                                                                        <TableCell className="text-center text-sm text-muted-foreground">{unitValue}</TableCell>
                                                                        <TableCell className="text-center text-sm text-muted-foreground">
                                                                            {taxaEmbarqueDisplay}
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            <Input
                                                                                type="number"
                                                                                min={0}
                                                                                value={qty === 0 ? "" : qty}
                                                                                onChange={(e) => handleRankQuantityChange(rank.key, e.target.value)}
                                                                                disabled={!isPTrabEditable || isSaving}
                                                                                className="text-center max-w-[80px] mx-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                onKeyDown={handleEnterToNextField}
                                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-semibold">
                                                                            {formatCurrency(calculatedCost)}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* NOVO BLOCO DE RESUMO DE TOTAIS (NÍVEL IV) */}
                                        <div className="space-y-2 mt-4">
                                            <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                                                <span className="font-bold text-base">TOTAL GERAL</span>
                                                <span className="font-extrabold text-xl text-primary">
                                                    {formatCurrency(calculos.totalGeral)}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* BOTÕES DE AÇÃO (Salvar Item da Categoria) */}
                                        <div className="flex justify-end gap-3 pt-4">
                                            {editingId ? (
                                                <Button 
                                                    type="button" 
                                                    onClick={handleUpdateExisting}
                                                    disabled={!isPTrabEditable || isSaving || !isCalculationReady}
                                                    className="w-full md:w-auto"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Atualizar Registro
                                                </Button>
                                            ) : (
                                                <Button 
                                                    type="submit" 
                                                    disabled={!isPTrabEditable || isSaving || !isCalculationReady}
                                                    className="w-full md:w-auto"
                                                >
                                                    {isFormDirty ? (
                                                        <>
                                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                            Recalcular e Adicionar
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            Adicionar Item
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                        
                                    </Card> {/* FIM NÍVEL III */}
                                    
                                </section>
                            )}
                            
                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES) - NOVO LAYOUT */}
                            {pendingDiarias.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({pendingDiarias.length})
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {pendingDiarias.map((item) => {
                                            const taxaEmbarqueUnitarioDisplay = formatCurrency(taxaEmbarqueUnitario);
                                            
                                            // Funções utilitárias para singular/plural
                                            const pluralize = (count: number, singular: string, plural: string) => 
                                                count === 1 ? singular : plural;

                                            // CORRIGIDO: Usando item.totalMilitares que agora é garantido
                                            const militarText = pluralize(item.totalMilitares, 'militar', 'militares');
                                            const viagemText = pluralize(item.nr_viagens, 'viagem', 'viagens');
                                            
                                            // --- Detailed Diária Calculation Generation ---
                                            const rankCalculationElements = DIARIA_RANKS_CONFIG.map(rank => {
                                                const qty = item.quantidades_por_posto[rank.key] || 0;
                                                if (qty === 0) return null;

                                                // Get raw unit value
                                                const unitValueRaw = (() => {
                                                    if (!diretrizesOp) return 0;
                                                    let fieldSuffix: 'bsb' | 'capitais' | 'demais';
                                                    
                                                    switch (item.destino) {
                                                        case 'bsb_capitais_especiais':
                                                            fieldSuffix = 'bsb';
                                                            break;
                                                        case 'demais_capitais':
                                                            fieldSuffix = 'capitais';
                                                            break;
                                                        case 'demais_dslc':
                                                            fieldSuffix = 'demais';
                                                            break;
                                                        default:
                                                            return 0;
                                                    }
                                                    const fieldKey = `${rank.fieldPrefix}_${fieldSuffix}` as keyof DiretrizOperacional;
                                                    return Number(diretrizesOp[fieldKey] || 0);
                                                })();
                                                
                                                const diasPagamento = Math.max(0, item.dias_operacao - 0.5);
                                                const subtotal = qty * unitValueRaw * diasPagamento * item.nr_viagens;
                                                
                                                const unitValueFormatted = formatCurrency(unitValueRaw);
                                                const subtotalFormatted = formatCurrency(subtotal);
                                                
                                                // Format: 1 Of Gen x R$ 600,00/dia x 0,5 dias x 1 viagens = R$ 300,00.
                                                const diasText = pluralize(diasPagamento, 'dia', 'dias');
                                                const calculationString = `${qty} ${rank.label} x ${unitValueFormatted}/dia x ${formatNumber(diasPagamento, 1)} ${diasText} x ${item.nr_viagens} ${viagemText} = ${subtotalFormatted}`;
                                                
                                                return (
                                                    <p key={rank.key} className="font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis text-right">
                                                        {calculationString}
                                                    </p>
                                                );
                                            }).filter(Boolean);

                                            if (rankCalculationElements.length === 0) {
                                                rankCalculationElements.push(
                                                    <p key="fallback" className="font-medium text-muted-foreground text-right">
                                                        Nenhum militar adicionado.
                                                    </p>
                                                );
                                            }
                                            // --- End Detailed Diária Calculation Generation ---

                                            // Cálculo da Taxa de Embarque formatado
                                            const totalTaxaEmbarque = item.valor_taxa_embarque;
                                            // CORRIGIDO: Usando item.totalMilitares que agora é garantido
                                            const taxaEmbarqueCalculation = item.is_aereo 
                                                ? `${item.totalMilitares} ${militarText} x ${taxaEmbarqueUnitarioDisplay} x ${item.nr_viagens} ${viagemText} = ${formatCurrency(totalTaxaEmbarque)}`
                                                : 'Não Aéreo';

                                            // Cálculo da Diária Base (Total Geral - Taxa de Embarque)
                                            const totalDiariaBase = item.valor_total - item.valor_taxa_embarque;

                                            return (
                                                <Card 
                                                    key={item.tempId} 
                                                    className="border-2 border-secondary bg-secondary/10 shadow-md"
                                                >
                                                    <CardContent className="p-4">
                                                        
                                                        {/* NOVO HEADER: Título e Valor Total na mesma linha */}
                                                        <div className="flex justify-between items-center border-b border-secondary/30 pb-2 mb-2">
                                                            <h4 className="font-bold text-base text-primary">
                                                                Diárias ({item.local_atividade})
                                                            </h4>
                                                            <p className="font-extrabold text-lg text-primary text-right">
                                                                {formatCurrency(item.valor_total)}
                                                            </p>
                                                        </div>
                                                        
                                                        {/* Detalhes do Cálculo (Taxa de Embarque e Diárias Detalhadas) - AGORA FULL WIDTH */}
                                                        <div className="space-y-2 pt-1">
                                                            
                                                            {/* Taxa de Embarque Row */}
                                                            <div className="grid grid-cols-3 gap-4 text-xs">
                                                                <p className="font-medium text-muted-foreground col-span-1">Taxa de Embarque:</p>
                                                                <p className="font-medium text-muted-foreground text-right col-span-2">
                                                                    {taxaEmbarqueCalculation}
                                                                </p>
                                                            </div>
                                                            
                                                            {/* Separador Tracejado */}
                                                            <div className="w-full border-t border-dashed border-secondary/50 my-2" />

                                                            {/* Diárias Section (Multi-line breakdown) */}
                                                            <div className="grid grid-cols-3 gap-4 text-xs">
                                                                {/* CORRIGIDO: item.destinoLabel agora é garantido */}
                                                                <p className="font-medium text-muted-foreground col-span-1">{item.destinoLabel}</p>
                                                                <div className="space-y-1 w-full col-span-2">
                                                                    {rankCalculationElements}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* SEPARADOR MOVIDO PARA CÁ */}
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Destino Recurso:</p>
                                                                <p className="font-medium">Taxa de Embarque:</p>
                                                                <p className="font-medium">Diárias:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p>
                                                                <p className="font-medium text-green-600">{formatCurrency(item.valor_taxa_embarque)}</p>
                                                                <p className="font-medium text-blue-600">{formatCurrency(totalDiariaBase)}</p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE) */}
                                    <Card className="bg-gray-100 shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">VALOR TOTAL DA OM</span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(totalPendingDiarias)}
                                            </span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        <Button type="button" variant="outline" onClick={handleClearPending} disabled={isSaving}>
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Limpar Formulário
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={handleSavePendingDiarias}
                                            disabled={isSaving || pendingDiarias.length === 0}
                                            className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                        >
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Salvar Registros
                                        </Button>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIA DE CÁLCULO DETALHADA */}
                            {/* CONDIÇÃO AJUSTADA: Mostra se estiver editando OU se for um novo item e o cálculo estiver pronto (e não houver pendentes) */}
                            {(editingId || (isCalculationReady && pendingDiarias.length === 0)) && (
                                <section className="space-y-4 border-t pt-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        5. Memória de Cálculo Detalhada
                                    </h3>
                                    
                                    {/* Aviso de Alteração (se estiver sujo) */}
                                    {isFormDirty && !editingId && (
                                        <Alert variant="warning">
                                            <AlertTitle className="flex items-center gap-2">
                                                <RefreshCw className="h-4 w-4" />
                                                Item Modificado
                                            </AlertTitle>
                                            <AlertDescription>
                                                O item atual foi alterado e precisa ser recalculado e adicionado novamente à lista pendente.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="memoria_calculo">Memória de Cálculo Automática (Registro Atual)</Label>
                                        <Textarea
                                            id="memoria_calculo"
                                            value={calculos.memoria}
                                            rows={15}
                                            readOnly
                                            className="bg-muted/50 font-mono text-xs"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="memoria_customizada">Memória de Cálculo Customizada (Opcional)</Label>
                                        <Textarea
                                            id="memoria_customizada"
                                            value={memoriaCustomizada}
                                            onChange={(e) => setMemoriaCustomizada(e.target.value)}
                                            rows={15}
                                            placeholder="Preencha aqui se desejar substituir a memória automática no relatório final."
                                            disabled={!isPTrabEditable || isSaving}
                                            className="font-mono text-xs border-primary/50"
                                        />
                                    </div>
                                </section>
                            )}
                        </form>
                    </CardContent>
                </Card>
            </div>
            
            {/* Diálogo de Confirmação de Exclusão */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Confirmar Exclusão
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o registro de diária para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}
                            disabled={handleDeleteMutation.isPending}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default DiariaForm;