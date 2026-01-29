import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Plus, Trash2, CheckCircle, AlertTriangle, Plane, Calendar, Users, MapPin, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { sanitizeError } from "@/lib/errorUtils";
import { fetchPTrabData, fetchPTrabRecords, updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { PTrabData, DiariaRegistro, VerbaOperacionalRegistro } from "@/pages/PTrabReportManager";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { OMData } from "@/lib/omUtils";
import { FASES_PADRAO } from "@/lib/constants";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { PassagemRegistro, generatePassagemMemoriaCalculo, calculatePassagemTotals } from "@/lib/passagemUtils";
import { formatCurrency, formatCodug, formatNumber } from "@/lib/formatUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";

// =================================================================
// TIPOS E SCHEMAS
// =================================================================

// Tipo de dados para o formulário (inclui campos de display)
interface TrechoFormItem {
    id: string; // ID do trecho na diretriz
    diretriz_id: string; // ID da diretriz
    origem: string;
    destino: string;
    tipo_transporte: TipoTransporte;
    is_ida_volta: boolean;
    valor_unitario: number;
    quantidade_passagens: number;
    efetivo: number; // Novo campo
}

interface PassagemFormState {
    // Contexto do PTrab
    om_favorecida: string;
    ug_favorecida: string;
    dias_operacao: number;
    fase_atividade: string;
    om_detentora: string; // OM Contratante
    ug_detentora: string; // UG Contratante
    efetivo: number; // Efetivo total da OM Favorecida
    
    // Detalhamento
    detalhamento_customizado: string;
    
    // Trechos selecionados
    selected_trechos: TrechoFormItem[];
}

const trechoSchema = z.object({
    id: z.string(),
    diretriz_id: z.string(),
    origem: z.string(),
    destino: z.string(),
    tipo_transporte: z.enum(['AÉREO', 'TERRESTRE', 'FLUVIAL']),
    is_ida_volta: z.boolean(),
    valor_unitario: z.number().min(0, "Valor unitário inválido."),
    quantidade_passagens: z.number().int().min(1, "A quantidade deve ser maior que zero."),
    efetivo: z.number().int().min(0, "O efetivo deve ser um número inteiro."),
});

const formSchema = z.object({
    om_favorecida: z.string().min(1, "OM Favorecida é obrigatória."),
    ug_favorecida: z.string().min(1, "UG Favorecida é obrigatória."),
    om_detentora: z.string().min(1, "OM Contratante é obrigatória."),
    ug_detentora: z.string().min(1, "UG Contratante é obrigatória."),
    dias_operacao: z.number().int().min(1, "Dias de operação é obrigatório."),
    fase_atividade: z.string().min(1, "Fase da atividade é obrigatória."),
    efetivo: z.number().int().min(1, "O efetivo deve ser maior que zero."),
    detalhamento_customizado: z.string().optional().nullable(),
    
    // Array de trechos selecionados
    selected_trechos: z.array(trechoSchema).min(1, "Selecione e preencha pelo menos um trecho."),
});

// =================================================================
// FUNÇÕES DE CÁLCULO
// =================================================================

const calculateTrechoTotal = (trecho: TrechoFormItem): number => {
    const valorUnitario = Number(trecho.valor_unitario || 0);
    const quantidade = Number(trecho.quantidade_passagens || 0);
    
    return valorUnitario * quantidade;
};

// NOVO: Função auxiliar para realizar o cálculo completo
const calculatePassagemData = (formData: PassagemFormState, ptrabData: PTrabData | undefined) => {
    if (!ptrabData || formData.selected_trechos.length === 0) {
        console.log("CALC PASSAGEM: Retornando 0. Motivo: PTrab ou Trechos vazios.");
        return {
            totalGeral: 0,
            totalND33: 0,
            memoria: "Selecione pelo menos um trecho e preencha os dados de solicitação.",
        };
    }
    
    try {
        let totalGeral = 0;
        let totalND33 = 0;
        let memoria = "";
        
        formData.selected_trechos.forEach((trecho, index) => {
            // 1. Calcular o total do trecho
            const totalTrecho = calculateTrechoTotal(trecho);
            
            console.log(`Trecho ${index + 1}: Valor Unitário: ${trecho.valor_unitario}, Qtd: ${trecho.quantidade_passagens}, Total Trecho: ${totalTrecho}`); // DEBUG
            
            totalGeral += totalTrecho;
            totalND33 += totalTrecho; // ND 33.90.33 é o único para passagens
            
            // 2. Gerar memória para o trecho (simplificado para o log)
            const tempRegistro: PassagemRegistro = {
                p_trab_id: ptrabData.id,
                organizacao: formData.om_favorecida,
                ug: formData.ug_favorecida,
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                origem: trecho.origem,
                destino: trecho.destino,
                tipo_transporte: trecho.tipo_transporte,
                is_ida_volta: trecho.is_ida_volta,
                valor_unitario: trecho.valor_unitario,
                quantidade_passagens: trecho.quantidade_passagens,
                valor_total: totalTrecho,
                valor_nd_33: totalTrecho,
                detalhamento: "", // Será preenchido no save
                diretriz_id: trecho.diretriz_id,
                trecho_id: trecho.id,
                efetivo: formData.efetivo,
            };
            
            memoria += `\n--- Trecho ${index + 1}: ${trecho.origem} -> ${trecho.destino} ---\n`;
            memoria += generatePassagemMemoriaCalculo(tempRegistro);
            memoria += `\n--------------------------------------------------\n`;
        });
        
        console.log(`CALC PASSAGEM: Total Geral Calculado: ${totalGeral}`); // DEBUG
        
        memoria += `\n==================================================\n`;
        memoria += `TOTAL GERAL SOLICITADO: ${formatCurrency(totalGeral)}\n`;
        memoria += `Efetivo: ${formData.efetivo} militares\n`;
        memoria += `==================================================\n`;
        
        return {
            totalGeral,
            totalND33,
            memoria,
        };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no cálculo.";
        console.error("Erro em calculatePassagemData:", e);
        return {
            totalGeral: 0,
            totalND33: 0,
            memoria: `Erro ao calcular: ${errorMessage}`,
        };
    }
};


// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PassagemForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    
    const [ptrabData, setPtrabData] = useState<PTrabData | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const { handleEnterToNextField } = useFormNavigation();
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

    // --- Fetch Diretrizes de Passagens ---
    const { data: diretrizesPassagens, isLoading: isLoadingDiretrizes } = useQuery({
        queryKey: ['diretrizesPassagens', ptrabData?.periodo_inicio],
        queryFn: async () => {
            if (!ptrabData) return [];
            const year = new Date(ptrabData.periodo_inicio).getFullYear();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];
            
            const { data, error } = await supabase
                .from('diretrizes_passagens')
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', year)
                .order('om_referencia', { ascending: true });
                
            if (error) throw error;
            return data as DiretrizPassagem[];
        },
        enabled: !!ptrabData,
    });
    
    // --- Fetch Registros Existentes ---
    const { data: existingRecords, isLoading: isLoadingRecords, refetch: refetchRecords } = useQuery({
        queryKey: ['passagemRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('passagem_registros', ptrabId!),
        enabled: !!ptrabId,
        initialData: [],
    });
    
    // --- Estado do Formulário (React Hook Form) ---
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            om_favorecida: "",
            ug_favorecida: "",
            dias_operacao: 1,
            fase_atividade: FASES_PADRAO[0],
            om_detentora: "",
            ug_detentora: "",
            efetivo: 1,
            detalhamento_customizado: "",
            selected_trechos: [],
        },
    });
    
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "selected_trechos",
    });
    
    // --- Carregamento Inicial de Dados ---
    useEffect(() => {
        const loadInitialData = async () => {
            if (!ptrabId) {
                toast.error("P Trab não selecionado.");
                navigate('/ptrab');
                return;
            }
            
            try {
                const data = await fetchPTrabData(ptrabId);
                setPtrabData(data);
                
                // Preencher campos iniciais do formulário com dados do PTrab
                form.reset({
                    om_favorecida: data.nome_om,
                    ug_favorecida: data.codug_om || "",
                    om_detentora: data.nome_om, // Padrão: OM Contratante é a própria OM
                    ug_detentora: data.codug_om || "",
                    dias_operacao: data.periodo_inicio && data.periodo_fim 
                        ? calculateDays(data.periodo_inicio, data.periodo_fim) 
                        : 1,
                    fase_atividade: FASES_PADRAO[0],
                    efetivo: parseInt(data.efetivo_empregado.match(/\d+/)?.[0] || '1') || 1,
                    detalhamento_customizado: "",
                    selected_trechos: [],
                });
                
                await updatePTrabStatusIfAberto(ptrabId);
                
            } catch (error) {
                console.error("Erro ao carregar PTrab:", error);
                toast.error("Falha ao carregar dados do Plano de Trabalho.");
                navigate('/ptrab');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [ptrabId, navigate, form]);
    
    // --- Lógica de Edição ---
    const handleEdit = (record: Tables<'passagem_registros'>) => {
        setEditingRecordId(record.id);
        
        // 1. Buscar a diretriz completa para obter os detalhes do trecho
        const diretriz = diretrizesPassagens?.find(d => d.id === record.diretriz_id);
        const trechoDetalhe = diretriz?.trechos.find((t: any) => t.id === record.trecho_id);
        
        if (!trechoDetalhe) {
            toast.error("Diretriz ou trecho original não encontrado.");
            return;
        }
        
        const trechoParaEdicao: TrechoFormItem = {
            id: record.trecho_id,
            diretriz_id: record.diretriz_id,
            origem: record.origem,
            destino: record.destino,
            tipo_transporte: record.tipo_transporte as TipoTransporte,
            is_ida_volta: record.is_ida_volta,
            valor_unitario: Number(record.valor_unitario),
            quantidade_passagens: record.quantidade_passagens,
            efetivo: record.efetivo || 0,
        };
        
        form.reset({
            om_favorecida: record.organizacao,
            ug_favorecida: record.ug,
            om_detentora: record.om_detentora,
            ug_detentora: record.ug_detentora,
            dias_operacao: record.dias_operacao,
            fase_atividade: record.fase_atividade || FASES_PADRAO[0],
            efetivo: record.efetivo || 0,
            detalhamento_customizado: record.detalhamento_customizado || "",
            selected_trechos: [trechoParaEdicao], // Apenas um trecho por registro
        });
    };
    
    const handleCancelEdit = () => {
        setEditingRecordId(null);
        form.reset();
        // Recarrega os defaults do PTrab
        if (ptrabData) {
            form.reset({
                om_favorecida: ptrabData.nome_om,
                ug_favorecida: ptrabData.codug_om || "",
                om_detentora: ptrabData.nome_om,
                ug_detentora: ptrabData.codug_om || "",
                dias_operacao: ptrabData.periodo_inicio && ptrabData.periodo_fim 
                    ? calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim) 
                    : 1,
                fase_atividade: FASES_PADRAO[0],
                efetivo: parseInt(ptrabData.efetivo_empregado.match(/\d+/)?.[0] || '1') || 1,
                detalhamento_customizado: "",
                selected_trechos: [],
            });
        }
    };
    
    // --- Lógica de Seleção de OM ---
    const handleOmChange = (omData: OMData | undefined, field: 'om_favorecida' | 'om_detentora') => {
        if (omData) {
            form.setValue(field, omData.nome_om);
            form.setValue(field === 'om_favorecida' ? 'ug_favorecida' : 'ug_detentora', omData.codug_om);
        } else {
            form.setValue(field, "");
            form.setValue(field === 'om_favorecida' ? 'ug_favorecida' : 'ug_detentora', "");
        }
    };
    
    // --- Lógica de Seleção de Trecho ---
    const handleTrechoSelected = (diretriz: DiretrizPassagem, trecho: TrechoPassagem) => {
        // Verifica se o trecho já está na lista
        const currentTrechos = form.getValues('selected_trechos');
        const trechoExists = currentTrechos.some(t => t.id === trecho.id && t.diretriz_id === diretriz.id);
        
        if (trechoExists) {
            toast.info("Este trecho já foi adicionado.");
            return;
        }
        
        // Adiciona o trecho como um novo item no FieldArray
        append({
            id: trecho.id,
            diretriz_id: diretriz.id,
            origem: trecho.origem,
            destino: trecho.destino,
            tipo_transporte: trecho.tipo_transporte,
            is_ida_volta: trecho.is_ida_volta,
            valor_unitario: Number(trecho.valor),
            quantidade_passagens: 1, // Valor inicial
            efetivo: form.getValues('efetivo') || 1, // Usa o efetivo atual do formulário
        });
        
        // Preenche a OM Contratante (Detentora) com a OM da Diretriz
        form.setValue('om_detentora', diretriz.om_referencia);
        form.setValue('ug_detentora', diretriz.ug_referencia);
    };
    
    // --- Cálculo e Memória ---
    const { totalGeral, totalND33, memoria } = useMemo(() => {
        const formData = form.getValues();
        return calculatePassagemData(formData as PassagemFormState, ptrabData);
    }, [form.watch('selected_trechos'), form.watch('dias_operacao'), form.watch('fase_atividade'), form.watch('om_favorecida'), form.watch('om_detentora'), form.watch('efetivo'), ptrabData]);
    
    // --- Submissão do Formulário ---
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!ptrabId) return;
        
        setIsSaving(true);
        
        try {
            // 1. Gerar o detalhamento final para cada trecho selecionado
            const recordsToSave: PassagemRegistro[] = data.selected_trechos.map(trecho => {
                const totals = calculatePassagemTotals(trecho as any); // Usa o cálculo do trecho individual
                
                const baseRecord: PassagemRegistro = {
                    p_trab_id: ptrabId,
                    organizacao: data.om_favorecida,
                    ug: data.ug_favorecida,
                    om_detentora: data.om_detentora,
                    ug_detentora: data.ug_detentora,
                    dias_operacao: data.dias_operacao,
                    fase_atividade: data.fase_atividade,
                    origem: trecho.origem,
                    destino: trecho.destino,
                    tipo_transporte: trecho.tipo_transporte,
                    is_ida_volta: trecho.is_ida_volta,
                    valor_unitario: trecho.valor_unitario,
                    quantidade_passagens: trecho.quantidade_passagens,
                    valor_total: totals.totalGeral,
                    valor_nd_33: totals.totalND33,
                    detalhamento_customizado: data.detalhamento_customizado || null,
                    diretriz_id: trecho.diretriz_id,
                    trecho_id: trecho.id,
                    efetivo: data.efetivo,
                };
                
                // Gera a memória de cálculo automática
                baseRecord.detalhamento = generatePassagemMemoriaCalculo(baseRecord);
                
                return baseRecord;
            });
            
            if (editingRecordId) {
                // Modo Edição: Apenas um registro é atualizado
                const record = recordsToSave[0];
                const { id, ...updateData } = record;
                
                const { error } = await supabase
                    .from('passagem_registros')
                    .update(updateData as TablesUpdate<'passagem_registros'>)
                    .eq('id', editingRecordId);
                    
                if (error) throw error;
                toast.success("Registro de Passagem atualizado!");
                
            } else {
                // Modo Inserção: Insere todos os trechos como registros separados
                const { error } = await supabase
                    .from('passagem_registros')
                    .insert(recordsToSave as TablesInsert<'passagem_registros'>[]);
                    
                if (error) throw error;
                toast.success("Registros de Passagens salvos com sucesso!");
            }
            
            // Limpar e recarregar
            handleCancelEdit();
            refetchRecords();
            
        } catch (error: any) {
            toast.error(sanitizeError(error));
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este registro?")) return;
        
        try {
            setIsSaving(true);
            const { error } = await supabase
                .from('passagem_registros')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            toast.success("Registro excluído com sucesso!");
            refetchRecords();
            
        } catch (error) {
            toast.error(sanitizeError(error));
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || isLoadingOms || isLoadingDiretrizes || isLoadingRecords) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados de Passagens...</span>
            </div>
        );
    }
    
    const allDiretrizes = diretrizesPassagens || [];
    const trechosDisponiveis = allDiretrizes.flatMap(d => 
        d.trechos.map((t: any) => ({
            ...t,
            diretriz_id: d.id,
            om_contratante: d.om_referencia,
            ug_contratante: d.ug_referencia,
            numero_pregao: d.numero_pregao,
            vigencia: `${formatDate(d.data_inicio_vigencia)} - ${formatDate(d.data_fim_vigencia)}`,
        }))
    );

    return (
        <div className="min-h-screen bg-background py-4 px-4">
            <div className="container max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para o P Trab
                    </Button>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <Plane className="h-6 w-6" />
                        Passagens (ND 33.90.33)
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Coluna Esquerda: Formulário de Solicitação */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{editingRecordId ? "Editar Registro" : "Nova Solicitação de Passagens"}</CardTitle>
                                <CardDescription>
                                    {ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        
                                        {/* 1. Dados da Organização e Período */}
                                        <div className="space-y-4 border-b pb-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                                                <ClipboardList className="h-4 w-4" />
                                                Dados da Solicitação
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="om_favorecida"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>OM Favorecida (Solicitante) *</FormLabel>
                                                            <OmSelector
                                                                selectedOmId={field.value}
                                                                initialOmName={field.value}
                                                                onChange={(omData) => handleOmChange(omData, 'om_favorecida')}
                                                                placeholder="Selecione a OM Favorecida"
                                                                disabled={isSaving}
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="ug_favorecida"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>UG Favorecida *</FormLabel>
                                                            <Input {...field} disabled placeholder="UG da OM Favorecida" />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="om_detentora"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>OM Contratante (Detentora do Recurso) *</FormLabel>
                                                            <OmSelector
                                                                selectedOmId={field.value}
                                                                initialOmName={field.value}
                                                                onChange={(omData) => handleOmChange(omData, 'om_detentora')}
                                                                placeholder="Selecione a OM Contratante"
                                                                disabled={isSaving}
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="ug_detentora"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>UG Contratante *</FormLabel>
                                                            <Input {...field} disabled placeholder="UG da OM Contratante" />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="dias_operacao"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Dias de Operação *</FormLabel>
                                                            <Input
                                                                {...field}
                                                                type="number"
                                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                                min={1}
                                                                disabled={isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="efetivo"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Efetivo (Nr Militares) *</FormLabel>
                                                            <Input
                                                                {...field}
                                                                type="number"
                                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                                min={1}
                                                                disabled={isSaving}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="fase_atividade"
                                                    render={({ field }) => (
                                                        <FormItem className="col-span-1 md:col-span-2">
                                                            <FormLabel>Fase da Atividade *</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSaving}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Selecione a fase" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {FASES_PADRAO.map(fase => (
                                                                        <SelectItem key={fase} value={fase}>{fase}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* 2. Seleção de Trechos */}
                                        <div className="space-y-4 border-b pb-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                                                <Plane className="h-4 w-4" />
                                                Seleção de Trechos (Contratos)
                                            </h3>
                                            
                                            {allDiretrizes.length === 0 ? (
                                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                                                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                                                    Nenhuma diretriz de passagens encontrada para o ano {ptrabData?.periodo_inicio ? new Date(ptrabData.periodo_inicio).getFullYear() : 'atual'}. Cadastre em Configurações > Custos Operacionais.
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {allDiretrizes.map(diretriz => (
                                                        <Card key={diretriz.id} className="shadow-sm">
                                                            <CardHeader className="p-3 bg-muted/50 rounded-t-lg">
                                                                <CardTitle className="text-sm font-semibold">
                                                                    Contrato: {diretriz.om_referencia} (UG: {formatCodug(diretriz.ug_referencia)})
                                                                </CardTitle>
                                                                <CardDescription className="text-xs">
                                                                    Pregão: {diretriz.numero_pregao || 'N/A'} | Vigência: {formatDate(diretriz.data_inicio_vigencia)} - {formatDate(diretriz.data_fim_vigencia)}
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent className="p-3">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {(diretriz.trechos as TrechoPassagem[]).map(trecho => (
                                                                        <Button
                                                                            key={trecho.id}
                                                                            variant="outline"
                                                                            size="sm"
                                                                            type="button"
                                                                            onClick={() => handleTrechoSelected(diretriz, trecho)}
                                                                            disabled={isSaving || editingRecordId !== null}
                                                                            className="h-auto py-2 text-xs justify-start"
                                                                        >
                                                                            <Plus className="h-3 w-3 mr-2" />
                                                                            {trecho.origem} &rarr; {trecho.destino} ({trecho.tipo_transporte})
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* 3. Trechos Selecionados */}
                                        <div className="space-y-4 border-b pb-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                                                <ClipboardList className="h-4 w-4" />
                                                Trechos Selecionados ({fields.length})
                                            </h3>
                                            
                                            {fields.length > 0 && (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Trecho</TableHead>
                                                            <TableHead className="text-center">Tipo</TableHead>
                                                            <TableHead className="text-right">Valor Unitário</TableHead>
                                                            <TableHead className="text-center w-[150px]">Qtd Passagens *</TableHead>
                                                            <TableHead className="text-right">Total</TableHead>
                                                            <TableHead className="w-[50px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {fields.map((field, index) => (
                                                            <TableRow key={field.id}>
                                                                <TableCell className="font-medium text-xs">
                                                                    {field.origem} &rarr; {field.destino}
                                                                    <p className="text-muted-foreground text-[10px] mt-0.5">
                                                                        Contratante: {field.om_contratante || form.getValues('om_detentora')}
                                                                    </p>
                                                                </TableCell>
                                                                <TableCell className="text-center text-xs">
                                                                    {field.tipo_transporte} ({field.is_ida_volta ? 'I/V' : 'Ida'})
                                                                </TableCell>
                                                                <TableCell className="text-right text-sm">
                                                                    {formatCurrency(field.valor_unitario)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`selected_trechos.${index}.quantidade_passagens`}
                                                                        render={({ field: qtyField }) => (
                                                                            <FormItem className="space-y-0">
                                                                                <FormControl>
                                                                                    <Input
                                                                                        {...qtyField}
                                                                                        type="number"
                                                                                        onChange={(e) => qtyField.onChange(parseInt(e.target.value) || 0)}
                                                                                        min={1}
                                                                                        disabled={isSaving}
                                                                                        className="text-center h-8"
                                                                                        onKeyDown={handleEnterToNextField}
                                                                                    />
                                                                                </FormControl>
                                                                                <FormMessage className="text-[10px]" />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-sm">
                                                                    {formatCurrency(calculateTrechoTotal(field))}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        type="button"
                                                                        onClick={() => remove(index)}
                                                                        disabled={isSaving || editingRecordId !== null}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                            
                                            {fields.length > 0 && (
                                                <div className="flex justify-end pt-2">
                                                    <div className="text-lg font-bold">
                                                        Total ND 33.90.33: {formatCurrency(totalND33)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* 4. Memória de Cálculo Customizada */}
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                                                <ClipboardList className="h-4 w-4" />
                                                Memória de Cálculo (Opcional)
                                            </h3>
                                            <FormField
                                                control={form.control}
                                                name="detalhamento_customizado"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Detalhamento Customizado</FormLabel>
                                                        <Textarea
                                                            {...field}
                                                            rows={4}
                                                            placeholder="Deixe em branco para usar a memória de cálculo automática."
                                                            disabled={isSaving}
                                                            onKeyDown={handleEnterToNextField}
                                                        />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4">
                                            {editingRecordId && (
                                                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                                                    Cancelar Edição
                                                </Button>
                                            )}
                                            <Button type="submit" disabled={isSaving || fields.length === 0}>
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                {editingRecordId ? "Atualizar Registro" : "Salvar Registro(s)"}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Coluna Direita: Registros Salvos e Memória */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Registros Salvos */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Registros Salvos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {existingRecords.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">Nenhum registro de passagem salvo para este P Trab.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Trecho</TableHead>
                                                <TableHead className="text-right">Valor</TableHead>
                                                <TableHead className="w-[50px] text-center">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {existingRecords.map((record: Tables<'passagem_registros'>) => (
                                                <TableRow key={record.id}>
                                                    <TableCell className="text-xs font-medium">
                                                        {record.origem} &rarr; {record.destino}
                                                        <p className="text-muted-foreground text-[10px] mt-0.5">
                                                            {record.quantidade_passagens} un. ({record.tipo_transporte})
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-sm">
                                                        {formatCurrency(Number(record.valor_total))}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} disabled={isSaving}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)} disabled={isSaving}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                        
                        {/* Memória de Cálculo */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Memória de Cálculo (Prévia)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={form.getValues('detalhamento_customizado') || memoria}
                                    rows={15}
                                    readOnly
                                    className="font-mono text-xs bg-muted/50 min-h-[300px]"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    {form.getValues('detalhamento_customizado') 
                                        ? "Usando detalhamento customizado." 
                                        : "Memória de cálculo gerada automaticamente."
                                    }
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PassagemForm;