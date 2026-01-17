import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as z from "zod";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { LocalAtividadeSelect } from "@/components/LocalAtividadeSelect";
import { DESTINO_OPTIONS } from "@/lib/diariaConstants";
import { cn } from "@/lib/utils";
import { MemoriaCalculoEditor } from "@/components/MemoriaCalculoEditor"; // NOVO COMPONENTE

// Tipos de dados
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
    dias_operacao: 0,
    destino: 'bsb_capitais_especiais' as DestinoDiaria,
    nr_viagens: 0,
    local_atividade: "",
    fase_atividade: "",
    is_aereo: false,
    om_detentora: null,
    ug_detentora: null,
    quantidades_por_posto: DIARIA_RANKS_CONFIG.reduce((acc, rank) => ({ ...acc, [rank.key]: 0 }), {} as QuantidadesPorPosto),
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Função para mapear o destino para classes de cor
const getDestinoColorClass = (destino: DestinoDiaria) => {
    switch (destino) {
        case 'bsb_capitais_especiais':
            return 'bg-blue-600 hover:bg-blue-700';
        case 'demais_capitais':
            return 'bg-green-600 hover:bg-green-700';
        case 'demais_dslc':
            return 'bg-purple-600 hover:bg-purple-700';
        default:
            return 'bg-gray-500 hover:bg-gray-600';
    }
};

const DiariaManagerPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<typeof initialFormState>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<DiariaRegistro | null>(null);
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA (REMOVIDOS, USAR MemoriaCalculoEditor)
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingDiarias, setPendingDiarias] = useState<CalculatedDiaria[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedDiaria | null>(null);
    
    // Estado para rastrear o ID da OM selecionada no OmSelector
    const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });
    
    const { data: diretrizYearData, isLoading: isLoadingDiretrizYear } = useDefaultDiretrizYear();
    const anoReferencia = diretrizYearData?.year;

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

    // Efeito para preencher a OM de Destino (OM do PTrab) ao carregar
    useEffect(() => {
        if (ptrabData && !editingId) {
            const omDestino = oms?.find(om => om.nome_om === ptrabData.nome_om && om.codug_om === ptrabData.codug_om);
            
            setFormData(prev => ({
                ...prev,
                organizacao: ptrabData.nome_om,
                ug: ptrabData.codug_om,
            }));
            setSelectedOmId(omDestino?.id);
        }
    }, [ptrabData, oms, editingId]);

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
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate)
    const isDiariaDirty = useMemo(() => {
        if (!editingId || !stagedUpdate) return false;

        // 1. Comparar campos principais
        if (
            formData.dias_operacao !== stagedUpdate.dias_operacao ||
            formData.destino !== stagedUpdate.destino ||
            formData.nr_viagens !== stagedUpdate.nr_viagens ||
            formData.local_atividade !== stagedUpdate.local_atividade ||
            formData.is_aereo !== stagedUpdate.is_aereo
        ) {
            return true;
        }

        // 2. Comparar quantidades por posto
        for (const rank of DIARIA_RANKS_CONFIG) {
            if (formData.quantidades_por_posto[rank.key] !== stagedUpdate.quantidades_por_posto[rank.key]) {
                return true;
            }
        }
        
        // 3. Comparar o total calculado atual (baseado nas diretrizes atuais) com o total salvo no stagedUpdate.
        if (!areNumbersEqual(calculos.totalGeral, stagedUpdate.valor_total)) {
             return true;
        }

        // 4. Comparar fase de atividade
        if (formData.fase_atividade !== stagedUpdate.fase_atividade) {
            return true;
        }

        return false;
    }, [editingId, stagedUpdate, formData, calculos.totalGeral]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingDiarias = useMemo(() => {
        return pendingDiarias.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingDiarias]);
    
    // NOVO MEMO: Agrupa os registros por OM de Destino (organizacao/ug)
    const registrosAgrupadosPorOM = useMemo(() => {
        return registros?.reduce((acc, registro) => {
            const omDestino = registro.organizacao;
            const ugDestino = registro.ug;
            const key = `${omDestino} (${ugDestino})`;
            
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(registro);
            return acc;
        }, {} as Record<string, DiariaRegistro[]>) || {};
    }, [registros]);

    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: TablesInsert<'diaria_registros'>[]) => {
            if (recordsToSave.length === 0) return;
            
            const dbRecords = recordsToSave.map(record => {
                const { valor_nd_39, ...rest } = record as any;
                return rest;
            });

            const { data, error } = await supabase
                .from("diaria_registros")
                .insert(dbRecords)
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        },
        onSuccess: (newRecords) => {
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Sucesso! ${pendingDiarias.length} registro(s) de Diária adicionado(s).`);
            setPendingDiarias([]);
            
            if (newRecords && newRecords.length > 0) {
                const lastSavedRecord = newRecords[0];
                handleEdit(lastSavedRecord as DiariaRegistro);
            }
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
            setStagedUpdate(null);
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
            resetForm();
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
        
        setFormData(prev => ({
            ...initialFormState,
            organizacao: prev.organizacao,
            ug: prev.ug,
            fase_atividade: prev.fase_atividade,
            destino: prev.destino,
            dias_operacao: 0, 
            nr_viagens: 0, 
            local_atividade: "",
            is_aereo: false,
            quantidades_por_posto: initialFormState.quantidades_por_posto,
        }));
        
        setStagedUpdate(null);
    };
    
    const handleClearPending = () => {
        setPendingDiarias([]);
        setStagedUpdate(null);
        resetForm();
    };

    const handleEdit = (registro: DiariaRegistro) => {
        if (pendingDiarias.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        if (!diretrizesOp) {
            toast.error("Diretrizes Operacionais não carregadas. Não é possível editar.");
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

        const totals = calculateDiariaTotals(newFormData as any, diretrizesOp);
        const memoria = generateDiariaMemoriaCalculo(newFormData as any, diretrizesOp, totals);
        
        const destinoLabel = DESTINO_OPTIONS.find(d => d.value === newFormData.destino)?.label || newFormData.destino;

        const stagedData: CalculatedDiaria = {
            tempId: registro.id,
            p_trab_id: ptrabId!,
            organizacao: newFormData.organizacao,
            ug: newFormData.ug,
            om_detentora: null,
            ug_detentora: null,
            dias_operacao: newFormData.dias_operacao,
            fase_atividade: newFormData.fase_atividade,
            destino: newFormData.destino,
            nr_viagens: newFormData.nr_viagens,
            local_atividade: newFormData.local_atividade,
            
            quantidade: totals.totalMilitares,
            valor_taxa_embarque: totals.totalTaxaEmbarque,
            valor_total: totals.totalGeral,
            valor_nd_30: 0,
            valor_nd_15: totals.totalGeral,
            
            quantidades_por_posto: newFormData.quantidades_por_posto,
            detalhamento: memoria,
            detalhamento_customizado: registro.detalhamento_customizado || null, 
            is_aereo: newFormData.is_aereo,
            
            posto_graduacao: null,
            valor_diaria_unitario: null,
            valor_nd_39: 0, // Adicionado para satisfazer o tipo TablesInsert
            
            destinoLabel: destinoLabel,
            totalMilitares: totals.totalMilitares,
            memoria_calculo_display: memoria, 
        };
        
        setStagedUpdate(stagedData);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: DiariaRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!diretrizesOp) {
            toast.error("Diretrizes Operacionais não carregadas. Verifique as configurações.");
            return;
        }
        
        try {
            diariaSchema.parse(formData);
            
            let omDestino = oms?.find(om => om.id === selectedOmId);

            if (!omDestino && formData.organizacao && formData.ug) {
                omDestino = oms?.find(om => om.nome_om === formData.organizacao && om.codug_om === formData.ug);
            }

            if (!omDestino || omDestino.codug_om !== formData.ug || omDestino.nome_om !== formData.organizacao) {
                toast.error("OM de Destino inválida ou UG não corresponde.");
                return;
            }
            
            const destinoLabel = DESTINO_OPTIONS.find(d => d.value === formData.destino)?.label || formData.destino;
            
            const totals = calculateDiariaTotals(formData as any, diretrizesOp);
            const memoria = generateDiariaMemoriaCalculo(formData as any, diretrizesOp, totals);
            
            const calculatedData: CalculatedDiaria = {
                tempId: editingId || Math.random().toString(36).substring(2, 9),
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
                
                quantidade: totals.totalMilitares,
                valor_taxa_embarque: totals.totalTaxaEmbarque,
                valor_total: totals.totalGeral,
                valor_nd_30: 0,
                valor_nd_15: totals.totalGeral,
                
                quantidades_por_posto: formData.quantidades_por_posto,
                detalhamento: memoria,
                detalhamento_customizado: null, 
                is_aereo: formData.is_aereo,
                
                posto_graduacao: null,
                valor_diaria_unitario: null,
                valor_nd_39: 0, // Adicionado para satisfazer o tipo TablesInsert

                destinoLabel: destinoLabel,
                totalMilitares: totals.totalMilitares,
                memoria_calculo_display: memoria, 
            };
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                return;
            }
            
            setPendingDiarias(prev => [...prev, calculatedData]);
            
            setFormData(prev => ({
                ...prev,
                dias_operacao: 0, 
                nr_viagens: 0, 
                local_atividade: "",
                is_aereo: false,
                quantidades_por_posto: initialFormState.quantidades_por_posto,
            }));
            
            toast.info("Item de Diária adicionado à lista pendente.");
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    const handleSavePendingDiarias = () => {
        if (pendingDiarias.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        const recordsToSave: TablesInsert<'diaria_registros'>[] = pendingDiarias.map(p => {
            const { tempId, memoria_calculo_display, destinoLabel, totalMilitares, valor_nd_39, ...dbRecord } = p as any;
            return dbRecord as TablesInsert<'diaria_registros'>;
        });
        
        saveMutation.mutate(recordsToSave);
    };
    
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        const { tempId, memoria_calculo_display, destinoLabel, totalMilitares, valor_nd_39, ...dbRecord } = stagedUpdate as any;
        
        updateMutation.mutate(dbRecord as TablesUpdate<'diaria_registros'>);
    };
    
    const handleRemovePending = (tempId: string) => {
        setPendingDiarias(prev => prev.filter(p => p.tempId !== tempId));
        toast.info("Item removido da lista pendente.");
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
    
    const itemsToDisplay = stagedUpdate ? [stagedUpdate] : pendingDiarias;
    const isStagingUpdate = !!stagedUpdate;

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
                            Pagamento de Diárias
                        </CardTitle>
                        <CardDescription>
                            Solicitação de recursos para Pagamento de Diárias em Atividades Militares.
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
                                                    local_atividade: "" 
                                                }));
                                            }}
                                            className="w-full"
                                        >
                                            <TabsList className="grid w-full grid-cols-3">
                                                {DESTINO_OPTIONS.map(opt => (
                                                    <TabsTrigger key={opt.value} value={opt.value} disabled={!isPTrabEditable || isSaving}>
                                                        {opt.label}
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados da Viagem (Card) */}
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
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="nr_viagens">Nr Viagens *</Label>
                                                            <Input
                                                                id="nr_viagens"
                                                                type="number"
                                                                min={1}
                                                                placeholder="Ex: 1"
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
                                        
                                        {/* Tabela de Posto/Graduação e Quantidade */}
                                        <Card className="mt-4 rounded-lg">
                                            <CardHeader className="py-2">
                                                <CardTitle className="text-base font-semibold">Efetivo por Posto/Graduação</CardTitle>
                                                <p className="text-xs text-muted-foreground">
                                                    Referência Legal: {referenciaLegal}. Taxa de Embarque: {formatCurrency(taxaEmbarqueUnitario)}.
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
                                        
                                        {/* NOVO BLOCO DE RESUMO DE TOTAIS */}
                                        <div className="space-y-2 mt-4">
                                            <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                                                <span className="font-bold text-base">TOTAL GERAL (ND 33.90.15)</span>
                                                <span className="font-extrabold text-xl text-primary">
                                                    {formatCurrency(calculos.totalGeral)}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* BOTÕES DE AÇÃO (Salvar Item da Categoria) */}
                                        <div className="flex justify-end gap-3 pt-4">
                                            <Button 
                                                type="submit" 
                                                disabled={!isPTrabEditable || isSaving || !isCalculationReady}
                                                className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                            >
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Salvar Item na Lista
                                            </Button>
                                        </div>
                                        
                                    </Card>
                                    
                                </section>
                            )}
                            
                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {itemsToDisplay.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
                                    {editingId && isDiariaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o cálculo.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const taxaEmbarqueUnitarioDisplay = formatCurrency(taxaEmbarqueUnitario);
                                            
                                            const pluralize = (count: number, singular: string, plural: string) => 
                                                count === 1 ? singular : plural;

                                            const militarText = pluralize(item.totalMilitares, 'militar', 'militares');
                                            const viagemText = pluralize(item.nr_viagens, 'viagem', 'viagens');
                                            
                                            const rankCalculationElements = DIARIA_RANKS_CONFIG.map(rank => {
                                                const qty = item.quantidades_por_posto[rank.key] || 0;
                                                if (qty === 0) return null;

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
                                                
                                                const diasText = Math.abs(diasPagamento - 0.5) < 0.001 || diasPagamento === 1 ? 'dia' : 'dias';
                                                
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
                                            
                                            const totalTaxaEmbarque = item.valor_taxa_embarque;
                                            const taxaEmbarqueCalculation = item.is_aereo 
                                                ? `${item.totalMilitares} ${militarText} x ${taxaEmbarqueUnitarioDisplay} x ${item.nr_viagens} ${viagemText} = ${formatCurrency(totalTaxaEmbarque)}`
                                                : 'Não Aéreo';

                                            const totalDiariaBase = item.valor_total - item.valor_taxa_embarque;
                                            
                                            return (
                                                <Card 
                                                    key={item.tempId} 
                                                    className={cn(
                                                        "border-2 shadow-md",
                                                        "border-secondary bg-secondary/10"
                                                    )}
                                                >
                                                    <CardContent className="p-4">
                                                        
                                                        <div className={cn("flex justify-between items-center pb-2 mb-2", "border-b border-secondary/30")}>
                                                            <h4 className="font-bold text-base text-foreground">
                                                                Diárias ({item.local_atividade})
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
                                                        
                                                        {/* Detalhes do Cálculo */}
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
                                                                <p className="font-medium text-muted-foreground col-span-1">Diárias Base:</p>
                                                                <div className="space-y-1 w-full col-span-2">
                                                                    {rankCalculationElements}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Destino Recurso:</p>
                                                                <p className="font-medium">Taxa de Embarque (ND 15):</p>
                                                                <p className="font-medium">Diárias (ND 15):</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p>
                                                                <p className="font-medium text-green-600">{formatCurrency(totalTaxaEmbarque)}</p>
                                                                <p className="font-medium text-blue-600">{formatCurrency(totalDiariaBase)}</p>
                                                            </div>
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
                                                VALOR TOTAL DA OM
                                            </span>
                                            <span className="font-extrabold text-xl text-foreground">
                                                {formatCurrency(isStagingUpdate ? stagedUpdate!.valor_total : totalPendingDiarias)}
                                            </span>
                                        </CardContent>
                                    </Card>
                                    
                                    <div className="flex justify-end gap-3 pt-4">
                                        {isStagingUpdate ? (
                                            <>
                                                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Limpar Formulário
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    onClick={handleCommitStagedUpdate}
                                                    disabled={isSaving || isDiariaDirty}
                                                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                                                >
                                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    Atualizar Registro
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
                                                    onClick={handleSavePendingDiarias}
                                                    disabled={isSaving || pendingDiarias.length === 0}
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

                            {/* SEÇÃO 4: REGISTROS SALVOS (Agrupados por OM) */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        Registros Salvos ({registros.length})
                                    </h3>
                                    
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                                        const totalOM = omRegistros.reduce((sum, r) => r.valor_total + sum, 0);
                                        const omName = omKey.split(' (')[0];
                                        const ug = omKey.split(' (')[1].replace(')', '');
                                        
                                        return (
                                            <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        OM Destino: {omName} (UG: {formatCodug(ug)})
                                                        <Badge 
                                                            variant="default" 
                                                            className={cn("text-xs text-white", getDestinoColorClass(omRegistros[0].destino as DestinoDiaria))}
                                                        >
                                                            {DESTINO_OPTIONS.find(d => d.value === omRegistros[0].destino)?.label || omRegistros[0].destino}
                                                        </Badge>
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {omRegistros.map((registro) => {
                                                        const totalGeral = registro.valor_total;
                                                        const totalDiariaBase = totalGeral - (registro.valor_taxa_embarque || 0);
                                                        const totalTaxaEmbarque = registro.valor_taxa_embarque || 0;
                                                        
                                                        const destinoLabel = DESTINO_OPTIONS.find(d => d.value === registro.destino)?.label || registro.destino;
                                                        const destinoColorClass = getDestinoColorClass(registro.destino as DestinoDiaria);
                                                        
                                                        return (
                                                            <Card 
                                                                key={registro.id} 
                                                                className="p-3 bg-background border"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-semibold text-base text-foreground">
                                                                                Diárias ({registro.local_atividade})
                                                                            </h4>
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {registro.fase_atividade}
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Efetivo: {registro.quantidade} | Período: {registro.dias_operacao} {registro.dias_operacao === 1 ? 'dia' : 'dias'} | Viagens: {registro.nr_viagens}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-lg text-primary/80">
                                                                            {formatCurrency(totalGeral)}
                                                                        </span>
                                                                        <div className="flex gap-1">
                                                                            <Button
                                                                                type="button" 
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8"
                                                                                onClick={() => handleEdit(registro)}
                                                                                disabled={!isPTrabEditable || isSaving || pendingDiarias.length > 0}
                                                                            >
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button" 
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => handleConfirmDelete(registro)}
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
                                                                        <span className="text-muted-foreground">Diária Base:</span>
                                                                        <span className="font-medium text-blue-600">{formatCurrency(totalDiariaBase)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Taxa Embarque:</span>
                                                                        <span className="font-medium text-green-600">{formatCurrency(totalTaxaEmbarque)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs font-bold pt-1">
                                                                        <span className="text-muted-foreground">Total (ND 15):</span>
                                                                        <span className="text-foreground">{formatCurrency(registro.valor_nd_15 || 0)}</span>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIAS DE CÁLCULOS DETALHADAS */}
                            {registros && registros.length > 0 && (
                                <div className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        📋 Memórias de Cálculos Detalhadas
                                    </h3>
                                    
                                    {registros.map(registro => {
                                        const memoriaAutomatica = generateDiariaMemoriaCalculo(registro as any, diretrizesOp || {}, calculateDiariaTotals(registro as any, diretrizesOp || {}));
                                        
                                        const destinoLabel = DESTINO_OPTIONS.find(d => d.value === registro.destino)?.label || registro.destino;
                                        const destinoColorClass = getDestinoColorClass(registro.destino as DestinoDiaria);

                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex flex-col flex-1 min-w-0 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-base font-semibold text-foreground">
                                                            OM Destino: {registro.organizacao} (UG: {formatCodug(registro.ug)})
                                                        </h4>
                                                        <Badge variant="default" className={cn("w-fit text-white", destinoColorClass)}>
                                                            {destinoLabel}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                
                                                <MemoriaCalculoEditor
                                                    registroId={registro.id}
                                                    tableName="diaria_registros"
                                                    memoriaAutomatica={memoriaAutomatica}
                                                    memoriaCustomizada={registro.detalhamento_customizado}
                                                    isPTrabEditable={isPTrabEditable}
                                                    queryKey={["diariaRegistros", ptrabId]}
                                                />
                                            </div>
                                        );
                                    })}
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
                                Confirmar Exclusão
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir o registro de diária para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction 
                                onClick={() => registroToDelete && handleDeleteMutation.mutate(registroToDelete.id)}
                                disabled={handleDeleteMutation.isPending}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir
                            </AlertDialogAction>
                            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default DiariaManagerPage;