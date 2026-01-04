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
import { ArrowLeft, Briefcase, Loader2, Save, Trash2, Edit, Plus, Users, MapPin, Calendar, Check, X, ClipboardList, FileText } from "lucide-react";
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
import { OmSelector } from "@/components/OmSelector"; // Importando o OmSelector

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
    fase_atividade: z.string().min(1, "A fase da atividade é obrigatória."), // Tornando obrigatório
    
    // Quantidades por posto (validação de que pelo menos um militar foi inserido)
    quantidades_por_posto: z.record(z.string(), z.number().int().min(0)).refine(
        (data) => Object.values(data).some(qty => qty > 0),
        { message: "Pelo menos um militar deve ser adicionado." }
    ),
    
    // Campos de OM Detentora (removidos do formulário, mas mantidos no schema como opcionais para compatibilidade com o banco)
    om_detentora: z.string().optional().nullable(),
    ug_detentora: z.string().optional().nullable(),
});

// Estado inicial para o formulário
const initialFormState = {
    organizacao: "",
    ug: "",
    dias_operacao: 1,
    destino: 'demais_dslc' as DestinoDiaria,
    nr_viagens: 1,
    local_atividade: "",
    fase_atividade: "", // Agora obrigatório
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
    
    // Estado para rastrear o ID da OM selecionada no OmSelector
    const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

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
        // Se a busca falhar, o erro será capturado e exibido no formulário
        retry: 1, 
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<DiariaRegistro[]>({
        queryKey: ['diariaRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('diaria_registros', ptrabId!),
        enabled: !!ptrabId,
        select: (data) => data.sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

    // =================================================================
    // CÁLCULOS E MEMÓRIA (MEMOIZED)
    // =================================================================
    
    const calculos = useMemo(() => {
        if (!diretrizesOp || !ptrabData) {
            return {
                totalDiaria: 0,
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
                throw new Error("Dados insuficientes para cálculo.");
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
                totalDiaria: 0,
                totalTaxaEmbarque: 0,
                totalGeral: 0,
                totalMilitares: 0,
                calculosPorPosto: [],
                memoria: `Erro ao calcular: ${errorMessage}`,
            };
        }
    }, [formData, diretrizesOp, ptrabData]);
    
    // =================================================================
    // MUTAÇÕES
    // =================================================================

    const mutation = useMutation({
        mutationFn: async (data: TablesInsert<'diaria_registros'> | TablesUpdate<'diaria_registros'>) => {
            if (!ptrabId) throw new Error("ID do P Trab ausente.");
            if (!diretrizesOp) throw new Error("Diretrizes Operacionais não carregadas.");
            
            // OM Detentora e UG Detentora são sempre null para Diária, pois a OM de destino é a OM que recebe o recurso.
            
            const baseData = {
                p_trab_id: ptrabId,
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
                valor_taxa_embarque: calculos.totalTaxaEmbarque,
                valor_total: calculos.totalGeral,
                
                // Alocação ND: Diárias são GND 3, mas o ND específico é 33.90.15.
                // Alocamos o total da diária (sem taxa) em ND 39 (Serviço) e a taxa de embarque em ND 30 (Material)
                valor_nd_30: calculos.totalTaxaEmbarque, // Taxa de Embarque
                valor_nd_39: calculos.totalDiaria, // Diárias
                
                // JSONB para quantidades detalhadas
                quantidades_por_posto: formData.quantidades_por_posto,
                
                // Detalhamento
                detalhamento: calculos.memoria,
                detalhamento_customizado: memoriaCustomizada.trim().length > 0 ? memoriaCustomizada : null,
            };

            if (editingId) {
                const { error } = await supabase
                    .from("diaria_registros")
                    .update(baseData as TablesUpdate<'diaria_registros'>)
                    .eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("diaria_registros")
                    .insert([baseData as TablesInsert<'diaria_registros'>]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["diariaRegistros", ptrabId] });
            queryClient.invalidateQueries({ queryKey: ["ptrabTotals", ptrabId] });
            toast.success(`Registro de Diária ${editingId ? "atualizado" : "adicionado"} com sucesso!`);
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
    };

    const handleEdit = (registro: DiariaRegistro) => {
        setEditingId(registro.id);
        
        // Tenta encontrar o ID da OM para preencher o OmSelector
        const omToEdit = oms?.find(om => om.nome_om === registro.organizacao && om.codug_om === registro.ug);
        setSelectedOmId(omToEdit?.id);

        setFormData({
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.dias_operacao,
            destino: registro.destino as DestinoDiaria,
            nr_viagens: registro.nr_viagens,
            local_atividade: registro.local_atividade || "",
            fase_atividade: registro.fase_atividade || "",
            om_detentora: null, // Ignorado no formulário
            ug_detentora: null, // Ignorado no formulário
            quantidades_por_posto: (registro.quantidades_por_posto || initialFormState.quantidades_por_posto) as QuantidadesPorPosto,
        });
        setMemoriaCustomizada(registro.detalhamento_customizado || "");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (registro: DiariaRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!diretrizesOp) {
            toast.error("Diretrizes Operacionais não carregadas. Verifique as configurações.");
            return;
        }
        
        try {
            // 1. Validação Zod
            diariaSchema.parse(formData);
            
            // 2. Validação de OM/UG (usando o ID selecionado para garantir que é uma OM válida)
            const omDestino = oms?.find(om => om.id === selectedOmId);
            if (!omDestino || omDestino.codug_om !== formData.ug || omDestino.nome_om !== formData.organizacao) {
                toast.error("OM de Destino inválida ou UG não corresponde.");
                return;
            }
            
            // 3. Executar Mutação
            mutation.mutate(formData as any);
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error("Erro de validação desconhecido.");
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

    // Unificando o estado de carregamento
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
    const isSaving = mutation.isPending;
    
    // Condição para exibir as seções 2 e 3 (Formulário de Item e Botões de Ação)
    // Agora inclui todos os campos obrigatórios da Seção 1
    const isFormReady = formData.organizacao.length > 0 && 
                        formData.ug.length > 0 && 
                        formData.dias_operacao > 0 &&
                        formData.fase_atividade.length > 0 &&
                        formData.local_atividade.length > 0;
    
    // Mapeamento de destino para rótulo
    const destinoOptions = [
        { value: 'bsb_capitais_especiais', label: 'Dslc BSB/MAO/RJ/SP' },
        { value: 'demais_capitais', label: 'Dslc demais capitais' },
        { value: 'demais_dslc', label: 'Demais Dslc' },
    ];
    
    // Função para obter o valor unitário da diária (para exibição na tabela)
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
    
    // Taxa de Embarque para exibição
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
                        <form onSubmit={handleSubmit} className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    1. Dados da Organização (Destino do Recurso)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="organizacao">OM de Destino do Recurso *</Label>
                                        <OmSelector
                                            selectedOmId={selectedOmId}
                                            onChange={handleOmChange}
                                            placeholder="Selecione a OM de Destino"
                                            disabled={!isPTrabEditable || isSaving || isLoadingOms}
                                            initialOmName={formData.organizacao}
                                            initialOmUg={formData.ug}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="ug">UG de Destino</Label>
                                        <Input
                                            id="ug"
                                            value={formatCodug(formData.ug)}
                                            disabled
                                            className="bg-muted/50"
                                        />
                                    </div>
                                    
                                    {/* Fase da Atividade movida para a Seção 1 */}
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="fase_atividade">Fase da Atividade *</Label>
                                        <FaseAtividadeSelect
                                            value={formData.fase_atividade}
                                            onChange={handleFaseAtividadeChange}
                                            disabled={!isPTrabEditable || isSaving}
                                        />
                                    </div>
                                </div>
                                
                                {/* Campos de Dias e Local da Atividade (Movidos para a Seção 1 para completar o isFormReady) */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="dias_operacao">Nr Dias da Viagem *</Label>
                                        <Input
                                            id="dias_operacao"
                                            type="number"
                                            min={1}
                                            value={formData.dias_operacao}
                                            onChange={(e) => setFormData({ ...formData, dias_operacao: parseInt(e.target.value) || 0 })}
                                            required
                                            disabled={!isPTrabEditable || isSaving}
                                            onKeyDown={handleEnterToNextField}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nr_viagens">Nr Viagens *</Label>
                                        <Input
                                            id="nr_viagens"
                                            type="number"
                                            min={1}
                                            value={formData.nr_viagens}
                                            onChange={(e) => setFormData({ ...formData, nr_viagens: parseInt(e.target.value) || 0 })}
                                            required
                                            disabled={!isPTrabEditable || isSaving}
                                            onKeyDown={handleEnterToNextField}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="local_atividade">Local da Atividade (Cidade/Estado) *</Label>
                                        <Input
                                            id="local_atividade"
                                            value={formData.local_atividade}
                                            onChange={(e) => setFormData({ ...formData, local_atividade: e.target.value })}
                                            placeholder="Ex: Belém/PA"
                                            required
                                            disabled={!isPTrabEditable || isSaving}
                                            onKeyDown={handleEnterToNextField}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR O ITEM (TABELA DE DIÁRIAS) */}
                            {isFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        2. Configurar Pagamento de Diárias
                                    </h3>
                                    
                                    {/* Linha de Dados Principais (Destino) */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-2 col-span-4">
                                            <Label htmlFor="destino">Local para fins Pgto *</Label>
                                            <Select
                                                value={formData.destino}
                                                onValueChange={(value) => setFormData({ ...formData, destino: value as DestinoDiaria })}
                                                disabled={!isPTrabEditable || isSaving}
                                            >
                                                <SelectTrigger id="destino">
                                                    <SelectValue placeholder="Selecione o tipo de deslocamento" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {destinoOptions.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    {/* Tabela de Posto/Graduação e Quantidade */}
                                    <div className="mt-6">
                                        <h4 className="font-semibold mb-2">Efetivo por Posto/Graduação</h4>
                                        <Table className="border">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[40%]">Posto/Graduação</TableHead>
                                                    <TableHead className="w-[20%] text-center">Valor Unitário</TableHead>
                                                    <TableHead className="w-[15%] text-center">Qtd *</TableHead>
                                                    <TableHead className="w-[25%] text-right">Custo Diária (R$)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {DIARIA_RANKS_CONFIG.map((rank) => {
                                                    const qty = formData.quantidades_por_posto[rank.key] || 0;
                                                    const unitValue = getUnitValueDisplay(rank.key, formData.destino);
                                                    const calculatedCost = calculos.calculosPorPosto.find(c => c.posto === rank.label)?.custoTotal || 0;
                                                    
                                                    return (
                                                        <TableRow key={rank.key}>
                                                            <TableCell className="font-medium">{rank.label}</TableCell>
                                                            <TableCell className="text-center text-sm text-muted-foreground">{unitValue}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={qty === 0 ? "" : qty}
                                                                    onChange={(e) => handleRankQuantityChange(rank.key, e.target.value)}
                                                                    disabled={!isPTrabEditable || isSaving}
                                                                    className="text-center max-w-[80px] mx-auto"
                                                                    onKeyDown={handleEnterToNextField}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold">
                                                                {formatCurrency(calculatedCost)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                <TableRow className="bg-muted/50 font-bold">
                                                    <TableCell colSpan={3} className="text-right">Total Diária (33.90.39)</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(calculos.totalDiaria)}</TableCell>
                                                </TableRow>
                                                <TableRow className="bg-muted/50 font-bold">
                                                    <TableCell colSpan={3} className="text-right">Total Taxa Emb (33.90.30)</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(calculos.totalTaxaEmbarque)}</TableCell>
                                                </TableRow>
                                                <TableRow className="bg-primary/10 font-bold text-primary-foreground">
                                                    <TableCell colSpan={3} className="text-right">Total Geral (33.90.15)</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(calculos.totalGeral)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                        
                                        <p className="text-xs text-muted-foreground mt-2">
                                            * Valores unitários baseados na Diretriz Operacional ({diretrizesOp?.ano_referencia || anoReferencia}). Taxa de Embarque: {formatCurrency(taxaEmbarqueUnitario)}. Referência Legal: {referenciaLegal}.
                                        </p>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 3: BOTÕES DE AÇÃO */}
                            {isFormReady && (
                                <section className="flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Limpar Formulário
                                    </Button>
                                    <Button type="submit" disabled={!isPTrabEditable || isSaving || calculos.totalMilitares === 0}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {editingId ? "Atualizar Registro" : "Adicionar Registro"}
                                    </Button>
                                </section>
                            )}
                            
                            {/* SEÇÃO 4: REGISTROS CADASTRADOS */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-t pt-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                                        4. Registros de Diárias Cadastrados ({registros?.length || 0})
                                    </h3>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[20%]">OM Destino</TableHead>
                                                    <TableHead className="w-[15%]">Local Pgto</TableHead>
                                                    <TableHead className="w-[10%] text-center">Dias</TableHead>
                                                    <TableHead className="w-[10%] text-center">Militares</TableHead>
                                                    <TableHead className="w-[20%] text-right">Total Diária</TableHead>
                                                    <TableHead className="w-[15%] text-right">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(registros || []).map((registro) => (
                                                    <TableRow key={registro.id}>
                                                        <TableCell className="font-medium">
                                                            {registro.organizacao} ({formatCodug(registro.ug)})
                                                        </TableCell>
                                                        <TableCell>
                                                            {destinoOptions.find(d => d.value === registro.destino)?.label || registro.destino}
                                                        </TableCell>
                                                        <TableCell className="text-center">{registro.dias_operacao}</TableCell>
                                                        <TableCell className="text-center">
                                                            {Object.values(registro.quantidades_por_posto || {}).reduce((sum, qty) => sum + qty, 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatCurrency(registro.valor_total)}
                                                        </TableCell>
                                                        <TableCell className="text-right space-x-2">
                                                            <Button 
                                                                variant="outline" 
                                                                size="icon" 
                                                                onClick={() => handleEdit(registro)}
                                                                disabled={!isPTrabEditable || isSaving}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="destructive" 
                                                                size="icon" 
                                                                onClick={() => handleConfirmDelete(registro)}
                                                                disabled={!isPTrabEditable || isSaving}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {(registros || []).length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                            Nenhum registro de diária adicionado.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 5: MEMÓRIA DE CÁLCULO DETALHADA */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-t pt-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        5. Memória de Cálculo Detalhada
                                    </h3>
                                    <div className="space-y-2">
                                        <Label htmlFor="memoria_calculo">Memória de Cálculo Automática</Label>
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