import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Plus, Trash2, Edit, Calculator, Zap, Droplet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PTrabData } from "@/types/ptrab";
import { formatCurrency, cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import {
    ConcessionariaSchema,
    ConcessionariaSchemaType,
    fetchConcessionariaRegistros,
    fetchConcessionariaDiretrizes,
    fetchConcessionariaDiretrizById,
    calculateConcessionariaCost,
    generateConsolidatedConcessionariaMemoria,
} from "@/lib/concessionariaUtils";
import { ConcessionariaRegistro, ConcessionariaDiretriz } from "@/types/concessionaria";
import { ConsolidatedConcessionariaMemoria } from "@/components/ConsolidatedConcessionariaMemoria";

// Constantes
const CATEGORIAS_CONCESSIONARIA = [
    { id: 'AGUA_ESGOTO', name: 'Água/Esgoto', icon: Droplet },
    { id: 'ENERGIA_ELETRICA', name: 'Energia Elétrica', icon: Zap },
];

const ConcessionariaForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const [isEditing, setIsEditing] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
    const [loadingPTrab, setLoadingPTrab] = useState(true);

    const form = useForm<ConcessionariaSchemaType>({
        resolver: zodResolver(ConcessionariaSchema),
        defaultValues: {
            organizacao: "",
            ug: "",
            om_detentora: "",
            ug_detentora: "",
            dias_operacao: 1,
            efetivo: 0,
            diretriz_id: "",
            categoria: 'AGUA_ESGOTO',
            detalhamento_customizado: "",
            fase_atividade: "",
        },
    });

    const { watch, setValue, reset, getValues } = form;
    const watchedFields = watch(['efetivo', 'dias_operacao', 'diretriz_id', 'categoria']);
    const currentEfetivo = watchedFields[0];
    const currentDiasOperacao = watchedFields[1];
    const currentDiretrizId = watchedFields[2];
    const currentCategoria = watchedFields[3];

    // --- 1. Fetch PTrab Data ---
    useEffect(() => {
        const loadPTrab = async () => {
            if (!ptrabId) {
                toast.error("P Trab não selecionado");
                navigate('/ptrab');
                return;
            }

            const { data, error } = await supabase
                .from('p_trab')
                .select('*')
                .eq('id', ptrabId)
                .single();

            if (error || !data) {
                toast.error("Não foi possível carregar o P Trab");
                navigate('/ptrab');
                return;
            }

            setPtrabData({
                ...data,
                efetivo_empregado: String(data.efetivo_empregado),
            } as PTrabData);
            setLoadingPTrab(false);
            
            // Preenche o efetivo inicial com o efetivo do PTrab
            setValue('efetivo', parseInt(data.efetivo_empregado || '0', 10));
            setValue('dias_operacao', calculateDays(data.periodo_inicio, data.periodo_fim));
        };

        loadPTrab();
    }, [ptrabId, navigate, setValue]);

    // --- 2. Fetch Diretrizes and Registros ---
    const anoReferencia = useMemo(() => {
        // Implementar lógica para obter o ano de referência (ex: ano atual ou ano da diretriz operacional)
        // Por enquanto, usaremos o ano atual
        return new Date().getFullYear();
    }, []);

    const { data: diretrizes = [], isLoading: isLoadingDiretrizes } = useQuery({
        queryKey: ['concessionariaDiretrizes', anoReferencia],
        queryFn: () => fetchConcessionariaDiretrizes(ptrabData?.user_id || '', anoReferencia),
        enabled: !!ptrabData?.user_id,
    });

    const { data: registros = [], isLoading: isLoadingRegistros } = useQuery({
        queryKey: ['concessionariaRegistros', ptrabId],
        queryFn: () => fetchConcessionariaRegistros(ptrabId!),
        enabled: !!ptrabId,
    });

    // Filtra as diretrizes disponíveis com base na categoria selecionada
    const filteredDiretrizes = useMemo(() => {
        return diretrizes.filter(d => 
            d.categoria === currentCategoria
        );
    }, [diretrizes, currentCategoria]);

    // Busca os detalhes da diretriz selecionada
    const selectedDiretriz = useMemo(() => {
        return diretrizes.find(d => d.id === currentDiretrizId);
    }, [diretrizes, currentDiretrizId]);

    // Calcula o custo total em tempo real
    const calculatedCost = useMemo(() => {
        if (!selectedDiretriz || currentEfetivo === 0 || currentDiasOperacao === 0) return 0;
        
        return calculateConcessionariaCost(
            currentEfetivo,
            currentDiasOperacao,
            selectedDiretriz.consumo_pessoa_dia,
            selectedDiretriz.custo_unitario
        );
    }, [currentEfetivo, currentDiasOperacao, selectedDiretriz]);

    // Memória de Cálculo Consolidada
    const consolidatedRecords = useMemo(() => {
        return generateConsolidatedConcessionariaMemoria(registros, diretrizes);
    }, [registros, diretrizes]);

    // --- 3. Mutations (Add, Update, Delete) ---

    const saveMutation = useMutation({
        mutationFn: async (values: ConcessionariaSchemaType) => {
            if (!ptrabId || !selectedDiretriz) throw new Error("Dados incompletos para salvar.");

            const totalCost = calculatedCost;
            
            const newRecord: Partial<ConcessionariaRegistro> = {
                p_trab_id: ptrabId,
                diretriz_id: values.diretriz_id,
                organizacao: values.organizacao,
                ug: values.ug,
                om_detentora: values.om_detentora,
                ug_detentora: values.ug_detentora,
                dias_operacao: values.dias_operacao,
                efetivo: values.efetivo,
                categoria: values.categoria,
                valor_unitario: selectedDiretriz.custo_unitario,
                consumo_pessoa_dia: selectedDiretriz.consumo_pessoa_dia,
                valor_total: totalCost,
                valor_nd_39: totalCost, // ND 33.90.39 é GND 3, usamos ND 39
                detalhamento_customizado: values.detalhamento_customizado,
                fase_atividade: values.fase_atividade,
                // Detalhamento padrão (para memória de cálculo)
                detalhamento: `Consumo de ${selectedDiretriz.nome_concessionaria} (${selectedDiretriz.unidade_custo}) para ${values.efetivo} militares por ${values.dias_operacao} dias.`,
            };

            if (isEditing && editingRecordId) {
                // Update existing record
                const { error } = await supabase
                    .from('concessionaria_registros')
                    .update(newRecord)
                    .eq('id', editingRecordId);
                if (error) throw error;
            } else {
                // Insert new record
                const { error } = await supabase
                    .from('concessionaria_registros')
                    .insert(newRecord as ConcessionariaRegistro);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            toast.success(isEditing ? "Registro atualizado com sucesso!" : "Registro de concessionária adicionado!");
            handleCancelEdit();
        },
        onError: (error) => {
            toast.error(error.message || "Falha ao salvar o registro.");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('concessionaria_registros')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['concessionariaRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            toast.success("Registro excluído com sucesso!");
        },
        onError: (error) => {
            toast.error(error.message || "Falha ao excluir o registro.");
        }
    });

    // --- 4. Handlers ---

    const onSubmit = (values: ConcessionariaSchemaType) => {
        saveMutation.mutate(values);
    };

    const handleEdit = (id: string) => {
        const record = registros.find(r => r.id === id);
        if (record) {
            setEditingRecordId(id);
            setIsEditing(true);
            
            // Preenche o formulário com os dados do registro
            reset({
                organizacao: record.organizacao,
                ug: record.ug,
                om_detentora: record.om_detentora || '',
                ug_detentora: record.ug_detentora || '',
                dias_operacao: record.dias_operacao,
                efetivo: record.efetivo,
                diretriz_id: record.diretriz_id,
                categoria: record.categoria as 'AGUA_ESGOTO' | 'ENERGIA_ELETRICA',
                detalhamento_customizado: record.detalhamento_customizado || '',
                fase_atividade: record.fase_atividade || '',
            });
            toast.info("Modo de edição ativado. Altere os campos e clique em Salvar.");
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este registro de concessionária?")) {
            deleteMutation.mutate(id);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditingRecordId(null);
        reset({
            ...form.getValues(), // Mantém OM/UG/Efetivo/Dias
            diretriz_id: "",
            detalhamento_customizado: "",
            fase_atividade: "",
        });
    };

    const calculateDays = (inicio: string, fim: string) => {
        const start = new Date(inicio);
        const end = new Date(fim);
        const diff = end.getTime() - start.getTime();
        return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
    };

    if (loadingPTrab || isLoadingDiretrizes || isLoadingRegistros) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
            </div>
        );
    }

    if (!ptrabData) {
        return null; // Should be handled by loadPTrab redirect
    }

    const isSaving = saveMutation.isPending;
    const isDeleting = deleteMutation.isPending;
    const isReadOnly = ptrabData.status === 'completo' || ptrabData.status === 'arquivado';

    return (
        <div className="min-h-screen bg-gray-50 py-4 px-4">
            <div className="container max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(`/ptrab?ptrabId=${ptrabId}`)}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para o P Trab
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-800">
                        <Calculator className="inline h-6 w-6 mr-2 text-primary" />
                        Custos de Concessionárias (ND 33.90.39)
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Seção 1: Dados do P Trab (Clone da Seção 1 de PassagemForm) */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg">P Trab: {ptrabData.numero_ptrab}</CardTitle>
                                <CardDescription>{ptrabData.nome_operacao}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-medium">Período:</span>
                                    <span>{ptrabData.periodo_inicio} a {ptrabData.periodo_fim}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Dias de Operação:</span>
                                    <span>{calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Efetivo Geral:</span>
                                    <span>{ptrabData.efetivo_empregado}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Status:</span>
                                    <span className={cn(
                                        "font-semibold",
                                        ptrabData.status === 'aberto' ? 'text-green-600' : 'text-red-600'
                                    )}>
                                        {ptrabData.status.toUpperCase()}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Seção 3: Memória de Cálculo (Resumo) */}
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg">Memória de Cálculo</CardTitle>
                                <CardDescription>
                                    Detalhes do cálculo para o registro atual.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {selectedDiretriz ? (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">Concessionária:</span>
                                            <span>{selectedDiretriz.nome_concessionaria}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">Consumo Pessoa/Dia:</span>
                                            <span>{selectedDiretriz.consumo_pessoa_dia} {selectedDiretriz.unidade_custo}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">Custo Unitário:</span>
                                            <span>{formatCurrency(selectedDiretriz.custo_unitario)} / {selectedDiretriz.unidade_custo}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">Efetivo x Dias:</span>
                                            <span>{currentEfetivo} x {currentDiasOperacao}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold text-primary pt-2">
                                            <span>Custo Calculado:</span>
                                            <span>{formatCurrency(calculatedCost)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Selecione uma diretriz para calcular o custo.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Seção 2: Formulário de Adição/Edição */}
                    <div className="lg:col-span-2">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>{isEditing ? "Editar Registro" : "Adicionar Novo Registro"}</CardTitle>
                                <CardDescription>
                                    Preencha os detalhes do consumo de concessionária.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        
                                        {/* Campos de OM/UG Detentora e Efetivo/Dias (Idêntico a Passagem) */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="organizacao"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>OM Solicitante</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ex: 1ª RM" {...field} disabled={isReadOnly} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="ug"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>UG Solicitante</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ex: 160001" {...field} disabled={isReadOnly} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="om_detentora"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>OM Detentora (Opcional)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ex: 1ª RM" {...field} disabled={isReadOnly} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="ug_detentora"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>UG Detentora (Opcional)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ex: 160001" {...field} disabled={isReadOnly} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="efetivo"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Efetivo (Pessoas)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                placeholder="0"
                                                                {...field}
                                                                onChange={(e) => field.onChange(parseInt(e.target.value || '0', 10))}
                                                                disabled={isReadOnly}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="dias_operacao"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Dias de Operação</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                placeholder="1"
                                                                {...field}
                                                                onChange={(e) => field.onChange(parseInt(e.target.value || '1', 10))}
                                                                disabled={isReadOnly}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="fase_atividade"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>Fase da Atividade (Opcional)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Ex: Preparação" {...field} disabled={isReadOnly} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        
                                        <Separator />

                                        {/* Campos Específicos de Concessionária */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="categoria"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Tipo de Concessionária</FormLabel>
                                                        <Select onValueChange={(value: 'AGUA_ESGOTO' | 'ENERGIA_ELETRICA') => {
                                                            field.onChange(value);
                                                            // Resetar diretriz_id ao mudar a categoria
                                                            setValue('diretriz_id', '');
                                                        }} defaultValue={field.value} disabled={isReadOnly}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Selecione o tipo de serviço" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                                                    <SelectItem key={cat.id} value={cat.id}>
                                                                        <cat.icon className="inline h-4 w-4 mr-2" />
                                                                        {cat.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            
                                            <FormField
                                                control={form.control}
                                                name="diretriz_id"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Diretriz / Contrato</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly || isLoadingDiretrizes || filteredDiretrizes.length === 0}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={isLoadingDiretrizes ? "Carregando diretrizes..." : "Selecione a diretriz/contrato"} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {filteredDiretrizes.map((diretriz) => (
                                                                    <SelectItem key={diretriz.id} value={diretriz.id}>
                                                                        {diretriz.nome_concessionaria} ({formatCurrency(diretriz.custo_unitario)}/{diretriz.unidade_custo})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Detalhamento Customizado */}
                                        <FormField
                                            control={form.control}
                                            name="detalhamento_customizado"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Detalhamento Customizado (Opcional)</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Adicione detalhes específicos sobre o consumo ou contrato."
                                                            {...field}
                                                            disabled={isReadOnly}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Botões de Ação */}
                                        <div className="flex justify-end space-x-2">
                                            {isEditing && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleCancelEdit}
                                                    disabled={isSaving || isReadOnly}
                                                >
                                                    Cancelar Edição
                                                </Button>
                                            )}
                                            <Button type="submit" disabled={isSaving || isReadOnly || !selectedDiretriz}>
                                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {isEditing ? "Salvar Alterações" : "Adicionar Registro"}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Seção 4 & 5: Tabela de Registros Consolidados */}
                <div className="mt-6">
                    <ConsolidatedConcessionariaMemoria
                        consolidatedRecords={consolidatedRecords}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </div>
            </div>
        </div>
    );
};

export default ConcessionariaForm;