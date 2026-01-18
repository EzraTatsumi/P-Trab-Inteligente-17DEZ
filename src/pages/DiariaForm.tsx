import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, MapPin, Plane } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatCurrencyInput, numberToRawDigits, parseInputToNumber } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords, fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { 
    calculateDiariaTotals, 
    generateDiariaMemoriaCalculo,
    DIARIA_RANKS_CONFIG,
    QuantidadesPorPosto,
    DestinoDiaria,
} from "@/lib/diariaUtils";
import { DESTINO_OPTIONS, CAPITAIS_ESPECIAIS } from "@/lib/diariaConstants";
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
import { useDefaultOperacionalYear } from "@/hooks/useDefaultOperacionalYear";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { cn } from "@/lib/utils"; 
import CurrencyInput from "@/components/CurrencyInput";
import { LocalAtividadeSelect } from "@/components/LocalAtividadeSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { diariaSchema } from "@/lib/validationSchemas";

// Tipos de dados
type DiariaRegistro = Tables<'diaria_registros'>; 

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
interface CalculatedDiaria extends TablesInsert<'diaria_registros'> {
    tempId: string; // ID temporário para gerenciamento local
    memoria_calculo_display: string; // A memória gerada
    totalGeral: number;
    totalDiariaBase: number;
    totalTaxaEmbarque: number;
    totalMilitares: number;
    // Campos Favorecida (para display)
    om_favorecida: string;
    ug_favorecida: string;
}

// Constantes para a OM Detentora padrão (CIE)
const DEFAULT_OM_DETENTORA = "CIE";
const DEFAULT_UG_DETENTORA = "160062";

// Estado inicial para o formulário
const initialFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    dias_operacao: 0,
    destino: 'demais_dslc' as DestinoDiaria,
    nr_viagens: 1,
    local_atividade: "",
    quantidades_por_posto: DIARIA_RANKS_CONFIG.reduce((acc, rank) => ({ ...acc, [rank.key]: 0 }), {} as QuantidadesPorPosto),
    is_aereo: false,
    fase_atividade: "",
    om_detentora: DEFAULT_OM_DETENTORA, 
    ug_detentora: DEFAULT_UG_DETENTORA, 
    detalhamento_customizado: null as string | null,
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Helper function to compare form data structures
const compareFormData = (data1: typeof initialFormState, data2: typeof initialFormState) => {
    // Compare all relevant input fields
    if (
        data1.dias_operacao !== data2.dias_operacao ||
        data1.destino !== data2.destino ||
        data1.nr_viagens !== data2.nr_viagens ||
        data1.local_atividade !== data2.local_atividade ||
        data1.is_aereo !== data2.is_aereo ||
        data1.om_detentora !== data2.om_detentora ||
        data1.ug_detentora !== data2.ug_detentora ||
        data1.om_favorecida !== data2.om_favorecida ||
        data1.ug_favorecida !== data2.ug_favorecida ||
        data1.fase_atividade !== data2.fase_atividade
    ) {
        return true;
    }
    
    // Compare quantidades por posto
    for (const key of DIARIA_RANKS_CONFIG.map(r => r.key)) {
        if (data1.quantidades_por_posto[key] !== data2.quantidades_por_posto[key]) {
            return true;
        }
    }
    
    return false;
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
    
    // ESTADOS DE EDIÇÃO DE MEMÓRIA
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState<string>("");
    
    // NOVO ESTADO: Array de registros calculados, mas não salvos
    const [pendingDiarias, setPendingDiarias] = useState<CalculatedDiaria[]>([]);
    
    // NOVO ESTADO: Registro calculado para atualização (staging)
    const [stagedUpdate, setStagedUpdate] = useState<CalculatedDiaria | null>(null);
    
    // NOVO ESTADO: Armazena o último formData que gerou um item em pendingDiarias
    const [lastStagedFormData, setLastStagedFormData] = useState<typeof initialFormState | null>(null);
    
    // Estado para rastrear o ID da OM Favorecida (OM do PTrab)
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    
    // Estado para rastrear o ID da OM Detentora (OM Destino do Recurso)
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    // Hook para o ano padrão operacional
    const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultOperacionalYear();
    const anoReferencia = defaultYearData?.year || new Date().getFullYear();


    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<DiariaRegistro[]>({
        queryKey: ['diariaRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('diaria_registros', ptrabId!), 
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Diretrizes Operacionais (para cálculo de valores unitários)
    const { data: diretrizesOp, isLoading: isLoadingDiretrizes } = useQuery({
        queryKey: ['diretrizesOperacionais', anoReferencia],
        queryFn: () => fetchDiretrizesOperacionais(anoReferencia),
        enabled: !!anoReferencia,
    });
    
    // Efeito de inicialização da OM Favorecida (OM do PTrab)
    useEffect(() => {
        if (ptrabData && !editingId) {
            // 1. OM Favorecida (OM do PTrab) - NÃO PRÉ-SELECIONAR para forçar a seleção manual.
            setFormData(prev => ({
                ...prev,
                om_favorecida: "", 
                ug_favorecida: "", 
            }));
            setSelectedOmFavorecidaId(undefined); 
            
            // 2. OM Detentora (Padrão CIE)
            const cieOm = oms?.find(om => om.nome_om === DEFAULT_OM_DETENTORA && om.codug_om === DEFAULT_UG_DETENTORA);
            if (cieOm) {
                setSelectedOmDetentoraId(cieOm.id);
                setFormData(prev => ({
                    ...prev,
                    om_detentora: DEFAULT_OM_DETENTORA,
                    ug_detentora: DEFAULT_UG_DETENTORA,
                }));
            } else {
                setSelectedOmDetentoraId(undefined);
                setFormData(prev => ({
                    ...prev,
                    om_detentora: DEFAULT_OM_DETENTORA,
                    ug_detentora: DEFAULT_UG_DETENTORA,
                }));
            }
            
        } else if (ptrabData && editingId) {
            const omFavorecida = oms?.find(om => om.nome_om === formData.om_favorecida && om.codug_om === formData.ug_favorecida);
            const omDetentora = oms?.find(om => om.nome_om === formData.om_detentora && om.codug_om === formData.ug_detentora);
            
            setSelectedOmFavorecidaId(omFavorecida?.id);
            setSelectedOmDetentoraId(omDetentora?.id);
        }
    }, [ptrabData, oms, editingId]);

    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    const calculos = useMemo(() => {
        if (!ptrabData || !diretrizesOp) {
            return {
                totalGeral: 0,
                totalDiariaBase: 0,
                totalTaxaEmbarque: 0,
                totalMilitares: 0,
                memoria: "Preencha todos os campos obrigatórios e aguarde o carregamento das diretrizes.",
                calculosPorPosto: [] as ReturnType<typeof calculateDiariaTotals>['calculosPorPosto'],
            };
        }
        
        try {
            const calculatedDataForUtils = {
                ...formData,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
            };

            // 1. Calcular totais
            const totals = calculateDiariaTotals(calculatedDataForUtils as any, diretrizesOp);
            
            // 2. Gerar memória
            const memoria = generateDiariaMemoriaCalculo(calculatedDataForUtils as any, diretrizesOp, totals);
            
            return {
                ...totals,
                memoria,
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
            return {
                totalGeral: 0,
                totalDiariaBase: 0,
                totalTaxaEmbarque: 0,
                totalMilitares: 0,
                memoria: `Erro ao calcular: ${errorMessage}`,
                calculosPorPosto: [] as ReturnType<typeof calculateDiariaTotals>['calculosPorPosto'],
            };
        }
    }, [formData, ptrabData, diretrizesOp]);
    
    // NOVO MEMO: Verifica se o formulário está "sujo" (diferente do stagedUpdate ou lastStagedFormData)
    const isDiariaDirty = useMemo(() => {
        // MODO EDIÇÃO: Compara com stagedUpdate
        if (editingId && stagedUpdate) {
            // We need to convert stagedUpdate back to the form data structure for comparison
            const stagedFormData: typeof initialFormState = {
                om_favorecida: stagedUpdate.organizacao,
                ug_favorecida: stagedUpdate.ug,
                om_detentora: stagedUpdate.om_detentora || '',
                ug_detentora: stagedUpdate.ug_detentora || '',
                dias_operacao: stagedUpdate.dias_operacao,
                destino: stagedUpdate.destino as DestinoDiaria,
                nr_viagens: stagedUpdate.nr_viagens,
                local_atividade: stagedUpdate.local_atividade,
                quantidades_por_posto: stagedUpdate.quantidades_por_posto as QuantidadesPorPosto,
                is_aereo: stagedUpdate.is_aereo || false,
                fase_atividade: stagedUpdate.fase_atividade || '',
            };
            
            return compareFormData(formData, stagedFormData);
        }
        
        // MODO NOVO REGISTRO: Compara com lastStagedFormData
        if (!editingId && pendingDiarias.length > 0 && lastStagedFormData) {
            return compareFormData(formData, lastStagedFormData);
        }

        return false;
    }, [editingId, stagedUpdate, formData, pendingDiarias.length, lastStagedFormData]);
    
    // NOVO: Cálculo do total de todos os itens pendentes
    const totalPendingDiarias = useMemo(() => {
        return pendingDiarias.reduce((sum, item) => sum + item.totalGeral, 0);
    }, [pendingDiarias]);
    
    // NOVO MEMO: Agrupa os registros por OM Favorecida (organizacao/ug)
    const registrosAgrupadosPorOM = useMemo(() => {
        return registros?.reduce((acc, registro) => {
            // Agrupamos pela OM Favorecida (organizacao/ug na DB)
            const omFavorecida = registro.organizacao; 
            const ugFavorecida = registro.ug; 
            const key = `${omFavorecida} (${ugFavorecida})`;
            
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(registro);
            return acc;
        }, {} as Record<string, DiariaRegistro[]>) || {};
    }, [registros]);

    // =================================================================
    // HANDLERS DE INPUT
    // =================================================================
    
    const handlePostoChange = (rankKey: string, value: number) => {
        setFormData(prev => ({
            ...prev,
            quantidades_por_posto: {
                ...prev.quantidades_por_posto,
                [rankKey]: value,
            },
        }));
    };
    
    const handleDestinoChange = (value: DestinoDiaria) => {
        setFormData(prev => ({
            ...prev,
            destino: value,
            // Resetar local_atividade se o destino mudar para um tipo que não é texto livre
            local_atividade: (value === 'demais_dslc' && prev.local_atividade) ? prev.local_atividade : "",
        }));
    };
    
    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const saveMutation = useMutation({
        mutationFn: async (recordsToSave: CalculatedDiaria[]) => {
            if (recordsToSave.length === 0) return;
            
            // Mapeia os campos do formData para os campos da DB
            const dbRecords = recordsToSave.map(r => {
                const { tempId, memoria_calculo_display, totalGeral, totalDiariaBase, totalTaxaEmbarque, totalMilitares, om_favorecida, ug_favorecida, ...rest } = r;
                
                // Campos de detalhamento são mapeados diretamente
                const dbRecord: TablesInsert<'diaria_registros'> = {
                    ...rest,
                    organizacao: om_favorecida, // OM Favorecida (do PTrab)
                    ug: ug_favorecida, // UG Favorecida (do PTrab)
                    valor_total: totalDiariaBase, // Valor total da diária base (sem taxa de embarque)
                    valor_nd_15: totalGeral, // Total Geral (ND 15)
                    valor_nd_30: totalTaxaEmbarque, // Taxa de Embarque (ND 30)
                    quantidade: totalMilitares, // Total de militares
                    detalhamento: "Diária", // Marcador para filtro
                    detalhamento_customizado: rest.detalhamento_customizado, // Preserva o texto customizado da memória
                } as TablesInsert<'diaria_registros'>;
                
                return dbRecord;
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
            setLastStagedFormData(null); 
            
            // Manter campos de contexto, detalhes E valores
            setFormData(prev => ({
                ...prev,
                // Manter campos de contexto
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                om_detentora: prev.om_detentora,
                ug_detentora: prev.ug_detentora,
                fase_atividade: prev.fase_atividade,
                
                // Resetar apenas os campos de valor e numéricos
                dias_operacao: 0,
                nr_viagens: 1,
                local_atividade: "",
                quantidades_por_posto: DIARIA_RANKS_CONFIG.reduce((acc, rank) => ({ ...acc, [rank.key]: 0 }), {} as QuantidadesPorPosto),
                is_aereo: false,
            }));
            
            // NOVO: Carregar o primeiro registro recém-salvo em modo de edição
            if (newRecords && newRecords.length > 0) {
                handleEdit(newRecords[0] as DiariaRegistro);
            } else {
                // Se por algum motivo não houver newRecords, apenas reseta o formulário
                resetForm();
            }
        },
        onError: (err) => {
            toast.error(sanitizeError(err));
        },
    });
    
    const updateMutation = useMutation({
        mutationFn: async (data: CalculatedDiaria) => {
            if (!editingId) throw new Error("ID de edição ausente.");
            
            // Mapeia os campos do stagedUpdate para os campos da DB
            const { tempId, memoria_calculo_display, totalGeral, totalDiariaBase, totalTaxaEmbarque, totalMilitares, om_favorecida, ug_favorecida, ...rest } = data;
            
            const dbUpdateData: TablesUpdate<'diaria_registros'> = {
                ...rest,
                organizacao: om_favorecida, 
                ug: ug_favorecida, 
                valor_total: totalDiariaBase, // Valor total da diária base (sem taxa de embarque)
                valor_nd_15: totalGeral, // Total Geral (ND 15)
                valor_nd_30: totalTaxaEmbarque, // Taxa de Embarque (ND 30)
                quantidade: totalMilitares, // Total de militares
                detalhamento: "Diária", // Mantém o marcador
                detalhamento_customizado: rest.detalhamento_customizado, // Preserva o texto customizado da memória
            } as TablesUpdate<'diaria_registros'>;
            
            const { error } = await supabase
                .from("diaria_registros")
                .update(dbUpdateData)
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
    // HANDLERS DE AÇÃO
    // =================================================================

    const resetForm = () => {
        setEditingId(null);
        setFormData(prev => ({
            ...initialFormState,
            // Manter a OM Favorecida (do PTrab) se já estiver definida
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            // OM Detentora (Padrão CIE)
            om_detentora: DEFAULT_OM_DETENTORA,
            ug_detentora: DEFAULT_UG_DETENTORA,
            // Resetar campos de valor
            dias_operacao: 0,
            nr_viagens: 1,
            local_atividade: "",
            quantidades_por_posto: DIARIA_RANKS_CONFIG.reduce((acc, rank) => ({ ...acc, [rank.key]: 0 }), {} as QuantidadesPorPosto),
            is_aereo: false,
        }));
        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        setSelectedOmFavorecidaId(undefined);
        setSelectedOmDetentoraId(undefined); 
        setStagedUpdate(null); 
        setLastStagedFormData(null); 
    };
    
    const handleClearPending = () => {
        setPendingDiarias([]);
        setStagedUpdate(null);
        setLastStagedFormData(null); 
        resetForm();
    };

    const handleEdit = (registro: DiariaRegistro) => {
        if (pendingDiarias.length > 0) {
            toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente.");
            return;
        }
        
        setEditingId(registro.id);
        
        // 1. Configurar OM Favorecida (OM do PTrab)
        const omFavorecidaToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmFavorecidaId(omFavorecidaToEdit?.id);
        
        // 2. Configurar OM Detentora (OM Destino do Recurso)
        const omDetentoraToEdit = oms?.find(om => om.nome_om === registro.om_detentora && om.codug_om === registro.ug_detentora);
        setSelectedOmDetentoraId(omDetentoraToEdit?.id);

        // 3. Populate formData
        const newFormData = {
            om_favorecida: registro.organizacao, 
            ug_favorecida: registro.ug, 
            dias_operacao: registro.dias_operacao,
            destino: registro.destino as DestinoDiaria,
            nr_viagens: registro.nr_viagens,
            local_atividade: registro.local_atividade,
            quantidades_por_posto: registro.quantidades_por_posto as QuantidadesPorPosto,
            is_aereo: registro.is_aereo || false,
            fase_atividade: registro.fase_atividade || "",
            om_detentora: registro.om_detentora || DEFAULT_OM_DETENTORA,
            ug_detentora: registro.ug_detentora || DEFAULT_UG_DETENTORA,
            detalhamento_customizado: registro.detalhamento_customizado || null,
        };
        setFormData(newFormData);
        
        // 4. Calculate totals and generate memory
        const calculatedDataForUtils = {
            ...newFormData,
            organizacao: newFormData.om_favorecida,
            ug: newFormData.ug_favorecida,
        };
        const totals = calculateDiariaTotals(calculatedDataForUtils as any, diretrizesOp || {});
        const memoria = generateDiariaMemoriaCalculo(calculatedDataForUtils as any, diretrizesOp || {}, totals);
        
        // 5. Stage the current record data immediately for display in Section 3
        const stagedData: CalculatedDiaria = {
            tempId: registro.id,
            p_trab_id: ptrabId!,
            organizacao: newFormData.om_favorecida, 
            ug: newFormData.ug_favorecida, 
            om_detentora: newFormData.om_detentora,
            ug_detentora: newFormData.ug_detentora,
            dias_operacao: newFormData.dias_operacao,
            destino: newFormData.destino,
            nr_viagens: newFormData.nr_viagens,
            local_atividade: newFormData.local_atividade,
            quantidades_por_posto: newFormData.quantidades_por_posto,
            is_aereo: newFormData.is_aereo,
            fase_atividade: newFormData.fase_atividade,
            
            // Campos calculados
            valor_total: totals.totalDiariaBase,
            valor_nd_15: totals.totalGeral,
            valor_nd_30: totals.totalTaxaEmbarque,
            quantidade: totals.totalMilitares,
            
            detalhamento: "Diária",
            detalhamento_customizado: registro.detalhamento_customizado, // Preserva o texto customizado da memória
            
            // Campos de display
            totalGeral: totals.totalGeral,
            totalDiariaBase: totals.totalDiariaBase,
            totalTaxaEmbarque: totals.totalTaxaEmbarque,
            totalMilitares: totals.totalMilitares,
            memoria_calculo_display: memoria, 
            om_favorecida: newFormData.om_favorecida,
            ug_favorecida: newFormData.ug_favorecida,
            
            // Campos de detalhamento (Diária não usa estes, mas o tipo da DB exige)
            valor_taxa_embarque: totals.totalTaxaEmbarque,
            local_atividade: newFormData.local_atividade,
            posto_graduacao: null, // Não usado
            valor_diaria_unitario: null, // Não usado
            valor_nd_39: 0, // Não usado
            valor_nd_15: totals.totalGeral, // Usado para o total geral
        };
        
        setStagedUpdate(stagedData); 

        setEditingMemoriaId(null); 
        setMemoriaEdit("");
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: DiariaRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 1. Validação Zod
        try {
            const dataToValidate = {
                ...formData,
                quantidades_por_posto: Object.values(formData.quantidades_por_posto).reduce((sum, q) => sum + q, 0) > 0 
                    ? formData.quantidades_por_posto 
                    : undefined, // Força erro se não houver militares
            };
            
            diariaSchema.parse(dataToValidate);
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
            return;
        }
        
        // 2. Preparar o objeto final (calculatedData)
        const calculatedDataForUtils = {
            ...formData,
            organizacao: formData.om_favorecida,
            ug: formData.ug_favorecida,
        };

        const totals = calculateDiariaTotals(calculatedDataForUtils as any, diretrizesOp || {});
        const memoria = generateDiariaMemoriaCalculo(calculatedDataForUtils as any, diretrizesOp || {}, totals);
        
        const calculatedData: CalculatedDiaria = {
            tempId: editingId || Math.random().toString(36).substring(2, 9), 
            p_trab_id: ptrabId!,
            organizacao: formData.om_favorecida, 
            ug: formData.ug_favorecida, 
            om_detentora: formData.om_detentora,
            ug_detentora: formData.ug_detentora,
            dias_operacao: formData.dias_operacao,
            destino: formData.destino,
            nr_viagens: formData.nr_viagens,
            local_atividade: formData.local_atividade,
            quantidades_por_posto: formData.quantidades_por_posto,
            is_aereo: formData.is_aereo,
            fase_atividade: formData.fase_atividade,
            
            // Campos calculados
            valor_total: totals.totalDiariaBase,
            valor_nd_15: totals.totalGeral,
            valor_nd_30: totals.totalTaxaEmbarque,
            quantidade: totals.totalMilitares,
            
            detalhamento: "Diária",
            detalhamento_customizado: null, 
            
            // Campos de display
            totalGeral: totals.totalGeral,
            totalDiariaBase: totals.totalDiariaBase,
            totalTaxaEmbarque: totals.totalTaxaEmbarque,
            totalMilitares: totals.totalMilitares,
            memoria_calculo_display: memoria, 
            om_favorecida: formData.om_favorecida,
            ug_favorecida: formData.ug_favorecida,
            
            // Campos de detalhamento (Diária não usa estes, mas o tipo da DB exige)
            valor_taxa_embarque: totals.totalTaxaEmbarque,
            local_atividade: formData.local_atividade,
            posto_graduacao: null, // Não usado
            valor_diaria_unitario: null, // Não usado
            valor_nd_39: 0, // Não usado
        };
        
        if (editingId) {
            // MODO EDIÇÃO: Estagia a atualização para revisão
            const originalRecord = registros?.find(r => r.id === editingId);
            calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
            
            setStagedUpdate(calculatedData);
            toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
            return;
        }
        
        // MODO ADIÇÃO: Adicionar à lista pendente
        
        // Se o formulário está sujo (diferente do último estagiado) OU se a lista está vazia, adicionamos/substituímos.
        const shouldStageNewItem = pendingDiarias.length === 0 || isDiariaDirty;

        if (shouldStageNewItem) {
            setPendingDiarias(prev => {
                if (prev.length > 0) {
                    // Se a lista não está vazia, substitui o último item (pois o formulário está dirty)
                    return [...prev.slice(0, -1), calculatedData];
                }
                // Se a lista está vazia, adiciona
                return [...prev, calculatedData];
            });
            
            // Salva o estado atual do formulário como o último estagiado
            setLastStagedFormData(formData);
            
            toast.info("Item de Diária adicionado à lista pendente.");
        } else {
            toast.info("Nenhuma alteração detectada no item pendente.");
        }
        
        // CORREÇÃO: Manter campos de contexto e resetar campos de valor
        setFormData(prev => ({
            ...prev,
            // Manter campos de contexto
            om_favorecida: prev.om_favorecida,
            ug_favorecida: prev.ug_favorecida,
            om_detentora: prev.om_detentora,
            ug_detentora: prev.ug_detentora,
            fase_atividade: prev.fase_atividade,
            
            // Resetar campos de valor
            dias_operacao: 0,
            nr_viagens: 1,
            local_atividade: "",
            quantidades_por_posto: DIARIA_RANKS_CONFIG.reduce((acc, rank) => ({ ...acc, [rank.key]: 0 }), {} as QuantidadesPorPosto),
            is_aereo: false,
        }));
    };
    
    // Salva todos os itens pendentes no DB
    const handleSavePendingDiarias = () => {
        if (pendingDiarias.length === 0) {
            toast.warning("Nenhum item pendente para salvar.");
            return;
        }
        
        saveMutation.mutate(pendingDiarias);
    };
    
    // NOVO: Confirma a atualização do item estagiado no DB
    const handleCommitStagedUpdate = () => {
        if (!editingId || !stagedUpdate) return;
        
        updateMutation.mutate(stagedUpdate);
    };
    
    // Remove item da lista pendente
    const handleRemovePending = (tempId: string) => {
        setPendingDiarias(prev => {
            const newPending = prev.filter(p => p.tempId !== tempId);
            if (newPending.length === 0) {
                setLastStagedFormData(null);
            }
            return newPending;
        });
        toast.info("Item removido da lista pendente.");
    };
    
    // Handler para a OM Favorecida (OM do PTrab)
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            // Define a OM Detentora igual à OM Favorecida
            setSelectedOmDetentoraId(omData.id); 
            setFormData(prev => ({
                ...prev,
                om_favorecida: omData.nome_om,
                ug_favorecida: omData.codug_om,
                om_detentora: omData.nome_om, // OM Detentora = OM Favorecida
                ug_detentora: omData.codug_om, // UG Detentora = UG Favorecida
            }));
        } else {
            setSelectedOmFavorecidaId(undefined);
            setSelectedOmDetentoraId(undefined); // Reset Detentora
            setFormData(prev => ({
                ...prev,
                om_favorecida: "",
                ug_favorecida: "",
                om_detentora: "", // Reset Detentora
                ug_detentora: "", // Reset Detentora
            }));
        }
    };
    
    // Handler para a OM Detentora (OM Destino do Recurso)
    const handleOmDetentoraChange = (omData: OMData | undefined) => {
        if (omData) {
            setSelectedOmDetentoraId(omData.id);
            setFormData(prev => ({
                ...prev,
                om_detentora: omData.nome_om,
                ug_detentora: omData.codug_om,
            }));
        } else {
            setSelectedOmDetentoraId(undefined);
            setFormData(prev => ({
                ...prev,
                om_detentora: "",
                ug_detentora: "",
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
    
    const handleIniciarEdicaoMemoria = (registro: DiariaRegistro) => {
        setEditingMemoriaId(registro.id);
        
        // 1. Gerar a memória automática
        const calculatedData = {
            organizacao: registro.organizacao,
            ug: registro.ug,
            om_detentora: registro.om_detentora || "",
            ug_detentora: registro.ug_detentora || "",
            dias_operacao: registro.dias_operacao,
            destino: registro.destino as DestinoDiaria,
            nr_viagens: registro.nr_viagens,
            local_atividade: registro.local_atividade,
            quantidades_por_posto: registro.quantidades_por_posto as QuantidadesPorPosto,
            is_aereo: registro.is_aereo || false,
            fase_atividade: registro.fase_atividade || "",
        };
        
        const totals = calculateDiariaTotals(calculatedData as any, diretrizesOp || {});
        const memoriaAutomatica = generateDiariaMemoriaCalculo(calculatedData as any, diretrizesOp || {}, totals);
        
        // 2. Usar a customizada se existir, senão usar a automática
        setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
    };

    const handleCancelarEdicaoMemoria = () => {
        setEditingMemoriaId(null);
        setMemoriaEdit("");
    };

    const handleSalvarMemoriaCustomizada = async (registroId: string) => {
        try {
            // Se o usuário editar a memória, o campo 'detalhamento_customizado' será sobrescrito com o texto da memória.
            
            const { error } = await supabase
                .from("diaria_registros")
                .update({
                    detalhamento: "Diária", // Mantém o marcador
                    detalhamento_customizado: memoriaEdit.trim() || null, // Salva o texto da memória
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo atualizada com sucesso!");
            handleCancelarEdicaoMemoria();
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
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
            // Restaurar para NULL, pois os detalhes estruturados estão em colunas dedicadas
            const { error } = await supabase
                .from("diaria_registros")
                .update({
                    detalhamento_customizado: null,
                })
                .eq("id", registroId);

            if (error) throw error;

            toast.success("Memória de cálculo restaurada!");
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
        } catch (error) {
            console.error("Erro ao restaurar memória:", error);
            toast.error(sanitizeError(error));
        }
    };
    
    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros || isLoadingOms || isLoadingDiretrizes || isLoadingDefaultYear;

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
    
    const totalMilitares = Object.values(formData.quantidades_por_posto).reduce((sum, q) => sum + q, 0);
    
    const isBaseFormReady = formData.om_favorecida.length > 0 && 
                            formData.ug_favorecida.length > 0 && 
                            formData.om_detentora.length > 0 &&
                            formData.ug_detentora.length > 0 &&
                            formData.fase_atividade.length > 0;

    // Verifica se os campos numéricos da Solicitação estão preenchidos
    const isSolicitationDataReady = formData.dias_operacao > 0 &&
                                    formData.nr_viagens > 0 && 
                                    totalMilitares > 0 &&
                                    formData.local_atividade.length > 0;

    const isCalculationReady = isBaseFormReady && isSolicitationDataReady;
    
    // Lógica para a Seção 3
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
                            Solicitação de recursos para Diárias (ND 33.90.15).
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
                                    {/* OM FAVORECIDA (OM do PTrab) */}
                                    <div className="space-y-2 col-span-1">
                                        <Label htmlFor="om_favorecida">OM Favorecida *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmFavorecidaId}
                                            onChange={handleOmFavorecidaChange}
                                            placeholder="Selecione a OM Favorecida"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms || pendingDiarias.length > 0}
                                            // CORREÇÃO: Apenas passa initialOmName/Ug se estiver em modo de edição
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
                                            disabled={!isPTrabEditable || isSaving || pendingDiarias.length > 0}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (DIAS, EQUIPES E ALOCAÇÃO) */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Deslocamento
                                    </h3>
                                    
                                    <Card className="mt-6 bg-muted/50 rounded-lg p-4">
                                        
                                        {/* Dados do Deslocamento */}
                                        <Card className="rounded-lg mb-4">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-base font-semibold">Local e Período</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className="p-4 bg-background rounded-lg border space-y-4">
                                                    
                                                    {/* Destino e Local */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="destino">Destino (Localidade) *</Label>
                                                            <div className="relative">
                                                                <select
                                                                    id="destino"
                                                                    value={formData.destino}
                                                                    onChange={(e) => handleDestinoChange(e.target.value as DestinoDiaria)}
                                                                    required
                                                                    disabled={!isPTrabEditable || isSaving}
                                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    {DESTINO_OPTIONS.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>
                                                                            {opt.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="local_atividade">Local da Atividade *</Label>
                                                            <LocalAtividadeSelect
                                                                destino={formData.destino}
                                                                value={formData.local_atividade}
                                                                onChange={(value) => setFormData(prev => ({ ...prev, local_atividade: value }))}
                                                                disabled={!isPTrabEditable || isSaving}
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Dias e Viagens */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                        <div className="space-y-2 col-span-1">
                                                            <Label htmlFor="nr_viagens">Nr de Viagens *</Label>
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
                                                        <div className="space-y-2 col-span-1 flex items-end">
                                                            <div className="flex items-center space-x-2 h-10">
                                                                <Checkbox
                                                                    id="is_aereo"
                                                                    checked={formData.is_aereo}
                                                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_aereo: !!checked }))}
                                                                    disabled={!isPTrabEditable || isSaving}
                                                                />
                                                                <Label htmlFor="is_aereo" className="flex items-center gap-1">
                                                                    <Plane className="h-4 w-4" /> Deslocamento Aéreo
                                                                </Label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        
                                        {/* Efetivo por Posto/Graduação */}
                                        {isSolicitationDataReady && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4">
                                                    Efetivo por Posto/Graduação (Total: {totalMilitares})
                                                </h4>
                                                
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {DIARIA_RANKS_CONFIG.map(rank => (
                                                        <div key={rank.key} className="space-y-2">
                                                            <Label htmlFor={rank.key} className="text-xs">{rank.label}</Label>
                                                            <Input
                                                                id={rank.key}
                                                                type="number"
                                                                min={0}
                                                                placeholder="0"
                                                                value={formData.quantidades_por_posto[rank.key] === 0 ? "" : formData.quantidades_por_posto[rank.key]}
                                                                onChange={(e) => handlePostoChange(rank.key, parseInt(e.target.value) || 0)}
                                                                disabled={!isPTrabEditable || isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {totalMilitares === 0 && (
                                                    <p className="text-xs text-destructive mt-2 text-center">
                                                        Informe a quantidade de militares por posto/graduação.
                                                    </p>
                                                )}
                                            </Card>
                                        )}
                                        
                                        {/* Resumo do Cálculo */}
                                        {isCalculationReady && (
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <h4 className="font-semibold text-base mb-4">
                                                    Resumo do Cálculo (Ano Ref: {anoReferencia})
                                                </h4>
                                                
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div className="space-y-1">
                                                        <p className="text-muted-foreground">Diária Base (ND 15):</p>
                                                        <p className="text-muted-foreground">Taxa de Embarque (ND 30):</p>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <p className="font-medium text-green-600">{formatCurrency(calculos.totalDiariaBase)}</p>
                                                        <p className="font-medium text-blue-600">{formatCurrency(calculos.totalTaxaEmbarque)}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                    <span className="font-bold text-base uppercase">
                                                        TOTAL GERAL (ND 33.90.15)
                                                    </span>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(calculos.totalGeral)}
                                                    </span>
                                                </div>
                                            </Card>
                                        )}
                                        
                                        {/* BOTÕES DE AÇÃO */}
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
                                    
                                    {/* NOVO: Alerta de Validação Final (Modo Novo Registro) */}
                                    {!editingId && isDiariaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o item pendente antes de salvar os registros.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
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
                                            const totalDiariaBase = item.totalDiariaBase;
                                            const totalTaxaEmbarque = item.totalTaxaEmbarque;
                                            
                                            // Verifica se a OM Detentora é diferente da OM Favorecida
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;
                                            
                                            // Lógica de concordância de número
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const viagemText = item.nr_viagens === 1 ? "viagem" : "viagens"; 
                                            const militarText = item.totalMilitares === 1 ? "militar" : "militares";

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
                                                                Diária ({item.local_atividade})
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-primary text-right">
                                                                    {formatCurrency(item.totalGeral)}
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
                                                                <p className="font-medium">OM Destino Recurso:</p>
                                                                <p className="font-medium">Período / Viagens:</p>
                                                                <p className="font-medium">Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isDifferentOmInView && "text-red-600")}>{item.om_detentora} ({formatCodug(item.ug_detentora)})</p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.nr_viagens} {viagemText}</p>
                                                                <p className="font-medium">{item.totalMilitares} {militarText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" />

                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">Diária Base (ND 15):</p>
                                                                <p className="font-medium">Taxa de Embarque (ND 30):</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium text-green-600">{formatCurrency(totalDiariaBase)}</p>
                                                                <p className="font-medium text-blue-600">{formatCurrency(totalTaxaEmbarque)}</p>
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
                                                {formatCurrency(isStagingUpdate ? stagedUpdate!.totalGeral : totalPendingDiarias)}
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
                                                    disabled={isSaving || pendingDiarias.length === 0 || isDiariaDirty}
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
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        OMs Cadastradas ({registros.length})
                                    </h3>
                                    
                                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                                        // O total da OM é a soma do valor_nd_15 (Total Geral)
                                        const totalOM = omRegistros.reduce((sum, r) => Number(r.valor_nd_15) + sum, 0);
                                        const omName = omKey.split(' (')[0];
                                        const ug = omKey.split(' (')[1].replace(')', '');
                                        
                                        return (
                                            <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                                                        {omName} (UG: {formatCodug(ug)})
                                                        <Badge variant="outline" className="text-xs">
                                                            {omRegistros[0].fase_atividade}
                                                        </Badge>
                                                    </h3>
                                                    <span className="font-extrabold text-xl text-primary">
                                                        {formatCurrency(totalOM)}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {omRegistros.map((registro) => {
                                                        const totalGeral = Number(registro.valor_nd_15 || 0);
                                                        const totalDiariaBase = Number(registro.valor_total || 0);
                                                        const totalTaxaEmbarque = Number(registro.valor_nd_30 || 0);
                                                        
                                                        const isDifferentOm = registro.om_detentora !== registro.organizacao;
                                                        
                                                        const diasText = registro.dias_operacao === 1 ? 'dia' : 'dias';
                                                        const viagemText = registro.nr_viagens === 1 ? 'viagem' : 'viagens';
                                                        const militarText = registro.quantidade === 1 ? 'militar' : 'militares';
                                                        
                                                        return (
                                                            <Card 
                                                                key={registro.id} 
                                                                className={cn(
                                                                    "p-3 bg-background border"
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="font-semibold text-base text-foreground">
                                                                                Diária ({registro.local_atividade})
                                                                            </h4>
                                                                            {registro.is_aereo && (
                                                                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                                                                    Aéreo
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {registro.quantidade} {militarText} | {registro.dias_operacao} {diasText} | {registro.nr_viagens} {viagemText}
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
                                                                
                                                                {/* Detalhes da Alocação */}
                                                                <div className="pt-2 border-t mt-2">
                                                                    {/* OM Destino Recurso (Sempre visível, vermelha se diferente) */}
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                                        <span className={cn("font-medium", isDifferentOm && "text-red-600")}>
                                                                            {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Diária Base (ND 15):</span>
                                                                        <span className="font-medium text-green-600">{formatCurrency(totalDiariaBase)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Taxa Embarque (ND 30):</span>
                                                                        <span className="font-medium text-blue-600">{formatCurrency(totalTaxaEmbarque)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs font-bold pt-1">
                                                                        <span className="text-muted-foreground">Total Geral (ND 15):</span>
                                                                        <span className="text-foreground">{formatCurrency(totalGeral)}</span>
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
                                        const isEditing = editingMemoriaId === registro.id;
                                        
                                        // Verifica se o detalhamento_customizado é um texto customizado (não o JSON de detalhes)
                                        let hasCustomMemoria = false;
                                        try {
                                            JSON.parse(registro.detalhamento_customizado || "");
                                        } catch (e) {
                                            hasCustomMemoria = !!registro.detalhamento_customizado;
                                        }
                                        
                                        // 1. Gerar a memória automática (precisa dos detalhes)
                                        const calculatedDataForMemoria = {
                                            organizacao: registro.organizacao,
                                            ug: registro.ug,
                                            om_detentora: registro.om_detentora || "",
                                            ug_detentora: registro.ug_detentora || "",
                                            dias_operacao: registro.dias_operacao,
                                            destino: registro.destino as DestinoDiaria,
                                            nr_viagens: registro.nr_viagens,
                                            local_atividade: registro.local_atividade,
                                            quantidades_por_posto: registro.quantidades_por_posto as QuantidadesPorPosto,
                                            is_aereo: registro.is_aereo || false,
                                            fase_atividade: registro.fase_atividade || "",
                                        };
                                        
                                        const totals = calculateDiariaTotals(calculatedDataForMemoria as any, diretrizesOp || {});
                                        const memoriaAutomatica = generateDiariaMemoriaCalculo(calculatedDataForMemoria as any, diretrizesOp || {}, totals);
                                        
                                        let memoriaExibida = memoriaAutomatica;
                                        if (isEditing) {
                                            memoriaExibida = memoriaEdit;
                                        } else if (hasCustomMemoria) {
                                            memoriaExibida = registro.detalhamento_customizado!;
                                        }
                                        
                                        // Verifica se a OM Detentora é diferente da OM Favorecida
                                        const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao;

                                        return (
                                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                                
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-base font-semibold text-foreground">
                                                                {registro.organizacao} (UG: {formatCodug(registro.ug)}) - {registro.local_atividade}
                                                            </h4>
                                                            {hasCustomMemoria && !isEditing && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Editada manualmente
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {isDifferentOmInMemoria ? (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                                <span className="text-sm font-medium text-red-600">
                                                                    Destino Recurso: {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">
                                                                Destino Recurso: {registro.om_detentora} (UG: {formatCodug(registro.ug_detentora)})
                                                            </p>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-end gap-2 shrink-0">
                                                        {!isEditing ? (
                                                            <>
                                                                <Button
                                                                    type="button" 
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleIniciarEdicaoMemoria(registro)}
                                                                    disabled={isSaving || !isPTrabEditable}
                                                                    className="gap-2"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    Editar Memória
                                                                </Button>
                                                                
                                                                {hasCustomMemoria && (
                                                                    <Button
                                                                        type="button" 
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                                                        disabled={isSaving || !isPTrabEditable}
                                                                        className="gap-2 text-muted-foreground"
                                                                    >
                                                                        <RefreshCw className="h-4 w-4" />
                                                                        Restaurar Automática
                                                                    </Button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    type="button" 
                                                                    size="sm"
                                                                    variant="default"
                                                                    onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                                                    disabled={isSaving}
                                                                    className="gap-2"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                    Salvar
                                                                </Button>
                                                                <Button
                                                                    type="button" 
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={handleCancelarEdicaoMemoria}
                                                                    disabled={isSaving}
                                                                    className="gap-2"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                    Cancelar
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <Card className="p-4 bg-background rounded-lg border">
                                                    {isEditing ? (
                                                        <Textarea
                                                            value={memoriaExibida}
                                                            onChange={(e) => setMemoriaEdit(e.target.value)}
                                                            className="min-h-[300px] font-mono text-sm"
                                                            placeholder="Digite a memória de cálculo..."
                                                        />
                                                    ) : (
                                                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                                                            {memoriaExibida}
                                                        </pre>
                                                    )}
                                                </Card>
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
                                Tem certeza que deseja excluir o registro de Diária para a OM <span className="font-bold">{registroToDelete?.organizacao}</span>? Esta ação é irreversível.
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

export default DiariaForm;