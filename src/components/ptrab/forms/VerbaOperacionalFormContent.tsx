import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, ArrowLeft, RefreshCw, CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { usePTrabContext } from "@/pages/ptrab/PTrabContext";
import { usePTrabData } from "@/hooks/usePTrabData";
import { usePTrabRecords } from "@/hooks/usePTrabRecords";
import { useDiretrizesOperacionais } from "@/hooks/useDiretrizesOperacionais";
import { useSession } from "@/components/SessionContextProvider";
import { sanitizeError } from "@/lib/errorUtils";
import { formatCurrency, parseCurrency } from "@/lib/formatUtils";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";

// =================================================================
// TIPOS E ESQUEMA ZOD
// =================================================================

type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

const VerbaOperacionalSchema = z.object({
  registros: z.array(
    z.object({
      id: z.string().optional(),
      organizacao: z.string().min(1, "Organização é obrigatória."),
      ug: z.string().min(1, "UG é obrigatória."),
      om_detentora: z.string().min(1, "OM Detentora é obrigatória."),
      ug_detentora: z.string().min(1, "UG Detentora é obrigatória."),
      dias_operacao: z.coerce.number().min(1, "Dias de operação deve ser no mínimo 1."),
      quantidade_equipes: z.coerce.number().min(1, "Quantidade de equipes deve ser no mínimo 1."),
      valor_total_solicitado: z.string().transform(parseCurrency).pipe(z.number().min(0, "Valor deve ser positivo.")),
      fase_atividade: z.string().optional().nullable(),
      detalhamento: z.string().optional().nullable(),
      detalhamento_customizado: z.string().optional().nullable(),
      
      // Campos adicionais para Verba Operacional
      objeto_aquisicao: z.string().optional().nullable(),
      objeto_contratacao: z.string().optional().nullable(),
      proposito: z.string().optional().nullable(),
      finalidade: z.string().optional().nullable(),
      local: z.string().optional().nullable(),
      tarefa: z.string().optional().nullable(),
      
      // Campos calculados (apenas para exibição/cálculo interno)
      valor_nd_30: z.number().optional(),
      valor_nd_39: z.number().optional(),
    })
  ),
});

type VerbaOperacionalFormValues = z.infer<typeof VerbaOperacionalSchema>;

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

interface VerbaOperacionalFormContentProps {
  ptrabId: string;
}

const VerbaOperacionalFormContent: React.FC<VerbaOperacionalFormContentProps> = ({ ptrabId }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const { pTrabData, isLoading: isLoadingPTrab } = usePTrabData(ptrabId);
  
  const anoReferencia = pTrabData?.periodo_inicio ? new Date(pTrabData.periodo_inicio).getFullYear() : null;
  
  const { data: diretrizes, isLoading: isLoadingDiretrizes, error: diretrizesError } = useDiretrizesOperacionais(anoReferencia);
  
  const { data: registros, isLoading: isLoadingRegistros, refetch } = usePTrabRecords('verba_operacional_registros', ptrabId);
  
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOmDetentora, setSelectedOmDetentora] = useState<OMData | null>(null);
  const [selectedOmOrganizacao, setSelectedOmOrganizacao] = useState<OMData | null>(null);

  const form = useForm<VerbaOperacionalFormValues>({
    resolver: zodResolver(VerbaOperacionalSchema),
    defaultValues: {
      registros: [],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "registros",
  });
  
  // =================================================================
  // EFEITOS E CARREGAMENTO DE DADOS
  // =================================================================

  useEffect(() => {
    if (registros && registros.length > 0) {
      const formattedRecords: VerbaOperacionalFormValues['registros'] = registros.map(r => ({
        ...r,
        valor_total_solicitado: formatCurrency(r.valor_total_solicitado),
        // Campos calculados são carregados, mas não são parte do formulário Zod de entrada
        valor_nd_30: r.valor_nd_30,
        valor_nd_39: r.valor_nd_39,
      }));
      form.reset({ registros: formattedRecords });
    } else if (!isLoadingRegistros) {
      form.reset({ registros: [] });
    }
  }, [registros, isLoadingRegistros, form]);
  
  // =================================================================
  // LÓGICA DE CÁLCULO
  // =================================================================
  
  const calculateValues = useCallback((registro: VerbaOperacionalFormValues['registros'][0], diretriz: DiretrizOperacional) => {
    const valorTotal = parseCurrency(registro.valor_total_solicitado);
    const valorVerbaOperacionalDia = diretriz.valor_verba_operacional_dia || 0;
    
    const dias = registro.dias_operacao || 0;
    const equipes = registro.quantidade_equipes || 0;
    
    // Cálculo da Verba Operacional (ND 30)
    // Valor ND 30 = Valor Verba Operacional Dia * Dias de Operação * Quantidade de Equipes
    const valorNd30 = valorVerbaOperacionalDia * dias * equipes;
    
    // O restante do valor total solicitado vai para ND 39
    const valorNd39 = valorTotal - valorNd30;
    
    return {
      valor_nd_30: Math.max(0, valorNd30),
      valor_nd_39: Math.max(0, valorNd39),
      valor_total: valorTotal,
    };
  }, []);
  
  // =================================================================
  // SUBMISSÃO
  // =================================================================

  const onSubmit = async (values: VerbaOperacionalFormValues) => {
    if (!user?.id || !pTrabData || !diretrizes) {
      toast.error("Dados de contexto incompletos. Tente recarregar a página.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      await updatePTrabStatusIfAberto(ptrabId);
      
      const recordsToInsert: TablesInsert<'verba_operacional_registros'>[] = [];
      const recordsToUpdate: TablesUpdate<'verba_operacional_registros'>[] = [];
      const existingIds = new Set(registros?.map(r => r.id));
      
      for (const registro of values.registros) {
        const calculated = calculateValues(registro, diretrizes);
        
        const baseRecord = {
          organizacao: registro.organizacao,
          ug: registro.ug,
          om_detentora: registro.om_detentora,
          ug_detentora: registro.ug_detentora,
          dias_operacao: registro.dias_operacao,
          quantidade_equipes: registro.quantidade_equipes,
          valor_total_solicitado: calculated.valor_total,
          fase_atividade: registro.fase_atividade || null,
          detalhamento: registro.detalhamento || null,
          detalhamento_customizado: registro.detalhamento_customizado || null,
          objeto_aquisicao: registro.objeto_aquisicao || null,
          objeto_contratacao: registro.objeto_contratacao || null,
          proposito: registro.proposito || null,
          finalidade: registro.finalidade || null,
          local: registro.local || null,
          tarefa: registro.tarefa || null,
          
          // Valores calculados
          valor_nd_30: calculated.valor_nd_30,
          valor_nd_39: calculated.valor_nd_39,
        };
        
        if (registro.id && existingIds.has(registro.id)) {
          recordsToUpdate.push({
            ...baseRecord,
            id: registro.id,
          } as TablesUpdate<'verba_operacional_registros'>);
        } else {
          recordsToInsert.push({
            ...baseRecord,
            p_trab_id: ptrabId,
          } as TablesInsert<'verba_operacional_registros'>);
        }
      }
      
      // 1. Inserir novos registros
      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('verba_operacional_registros')
          .insert(recordsToInsert);
        if (insertError) throw insertError;
      }
      
      // 2. Atualizar registros existentes
      if (recordsToUpdate.length > 0) {
        for (const record of recordsToUpdate) {
          const { id, ...updateData } = record;
          const { error: updateError } = await supabase
            .from('verba_operacional_registros')
            .update(updateData)
            .eq('id', id!);
          if (updateError) throw updateError;
        }
      }
      
      // 3. Deletar registros removidos do formulário
      const currentFormIds = new Set(values.registros.map(r => r.id).filter(Boolean) as string[]);
      const idsToDelete = (registros || [])
        .map(r => r.id)
        .filter(id => !currentFormIds.has(id));
        
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('verba_operacional_registros')
          .delete()
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }
      
      toast.success("Registros de Verba Operacional salvos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['verba_operacional_registros', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['ptrabData', ptrabId] });
      refetch();
      
    } catch (error: any) {
      toast.error("Erro ao salvar registros.", { description: sanitizeError(error) });
      console.error("Erro ao salvar Verba Operacional:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // =================================================================
  // RENDERIZAÇÃO
  // =================================================================

  const isLoading = isLoadingPTrab || isLoadingRegistros || isLoadingDiretrizes || isSaving;
  
  if (isLoadingPTrab) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando dados do P Trab...</p>
      </div>
    );
  }
  
  if (!pTrabData) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-red-600">Erro de Carregamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Não foi possível encontrar o Plano de Trabalho especificado.</p>
          <Button onClick={() => navigate('/ptrab')} className="mt-4">Voltar para o Gerenciador</Button>
        </CardContent>
      </Card>
    );
  }
  
  if (diretrizesError || !diretrizes) {
    return (
      <Card className="mt-4 border-red-500">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center">
            <XCircle className="h-5 w-5 mr-2" />
            Diretrizes Operacionais Ausentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Não foi possível carregar as diretrizes operacionais para o ano {anoReferencia}.</p>
          <p className="mt-2">Por favor, configure-as em <span className="font-semibold">Configurações > Custos Operacionais</span>.</p>
          <Button onClick={() => navigate('/config/custos-operacionais')} className="mt-4">
            Configurar Diretrizes
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const valorVerbaOperacionalDia = diretrizes.valor_verba_operacional_dia || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Diretriz Aplicada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ano de Referência</p>
              <p className="font-semibold">{anoReferencia}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Verba Operacional/Dia (ND 30)</p>
              <p className="font-semibold text-blue-600">{formatCurrency(valorVerbaOperacionalDia)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {fields.map((field, index) => {
            const currentRegistro = form.watch(`registros.${index}`);
            const calculated = diretrizes ? calculateValues(currentRegistro, diretrizes) : { valor_nd_30: 0, valor_nd_39: 0, valor_total: 0 };
            
            return (
              <Card key={field.id} className="relative">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl">Registro #{index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* OM ORGANIZAÇÃO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.organizacao`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OM Organização *</FormLabel>
                          <OmSelector
                            selectedOmId={selectedOmOrganizacao?.id}
                            initialOmName={field.value}
                            onChange={(omData: OMData | undefined) => {
                              if (omData) {
                                setSelectedOmOrganizacao(omData);
                                form.setValue(`registros.${index}.organizacao`, omData.nome_om);
                                form.setValue(`registros.${index}.ug`, omData.codug_om);
                              } else {
                                setSelectedOmOrganizacao(null);
                                form.setValue(`registros.${index}.organizacao`, "");
                                form.setValue(`registros.${index}.ug`, "");
                              }
                            }}
                            placeholder="Selecione a OM Organizadora..."
                            disabled={isLoading}
                          />
                          <FormMessage />
                          {form.watch(`registros.${index}.ug`) && (
                            <p className="text-xs text-muted-foreground">
                              UG: {form.watch(`registros.${index}.ug`)}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                    
                    {/* OM DETENTORA */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.om_detentora`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OM Detentora *</FormLabel>
                          <OmSelector
                            selectedOmId={selectedOmDetentora?.id}
                            initialOmName={field.value}
                            onChange={(omData: OMData | undefined) => {
                              if (omData) {
                                setSelectedOmDetentora(omData);
                                form.setValue(`registros.${index}.om_detentora`, omData.nome_om);
                                form.setValue(`registros.${index}.ug_detentora`, omData.codug_om);
                              } else {
                                setSelectedOmDetentora(null);
                                form.setValue(`registros.${index}.om_detentora`, "");
                                form.setValue(`registros.${index}.ug_detentora`, "");
                              }
                            }}
                            placeholder="Selecione a OM Detentora..."
                            disabled={isLoading}
                          />
                          <FormMessage />
                          {form.watch(`registros.${index}.ug_detentora`) && (
                            <p className="text-xs text-muted-foreground">
                              UG Detentora: {form.watch(`registros.${index}.ug_detentora`)}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* DIAS DE OPERAÇÃO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.dias_operacao`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias de Operação *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={1}
                              placeholder="Ex: 10"
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                field.onChange(value > 0 ? value : 1);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* QUANTIDADE DE EQUIPES */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.quantidade_equipes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade de Equipes *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={1}
                              placeholder="Ex: 2"
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                field.onChange(value > 0 ? value : 1);
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* VALOR TOTAL SOLICITADO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.valor_total_solicitado`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Total Solicitado (R$) *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="R$ 0,00"
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                const numericValue = parseCurrency(rawValue);
                                field.onChange(formatCurrency(numericValue));
                              }}
                              onBlur={(e) => {
                                const numericValue = parseCurrency(e.target.value);
                                field.onBlur();
                                field.onChange(formatCurrency(numericValue));
                              }}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DETALHAMENTO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.detalhamento`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalhamento Padrão</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um detalhamento padrão (opcional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Apoio à Operação">Apoio à Operação</SelectItem>
                                <SelectItem value="Aquisição de Material">Aquisição de Material</SelectItem>
                                <SelectItem value="Contratação de Serviço">Contratação de Serviço</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* DETALHAMENTO CUSTOMIZADO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.detalhamento_customizado`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detalhamento Customizado</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Descrição detalhada (opcional)"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FASE DA ATIVIDADE */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.fase_atividade`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fase da Atividade</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: Preparação, Execução, Conclusão"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* LOCAL */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.local`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Local da Atividade</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: Campo de Instrução, Área de Operações"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PROPÓSITO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.proposito`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Propósito</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Propósito da utilização da verba (opcional)"
                              rows={2}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* FINALIDADE */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.finalidade`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Finalidade</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Finalidade da utilização da verba (opcional)"
                              rows={2}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* OBJETO AQUISIÇÃO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.objeto_aquisicao`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Objeto de Aquisição</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: Material de consumo, Equipamento"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* OBJETO CONTRATAÇÃO */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.objeto_contratacao`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Objeto de Contratação</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: Serviço de transporte, Locação"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* TAREFA */}
                    <FormField
                      control={form.control}
                      name={`registros.${index}.tarefa`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tarefa</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Tarefa específica (opcional)"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator className="my-4" />
                  
                  {/* RESULTADO DO CÁLCULO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted p-4 rounded-md">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Valor Total Solicitado</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(calculated.valor_total)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">ND 30 (Verba Operacional)</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(calculated.valor_nd_30)}</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground cursor-help">
                              ({formatCurrency(valorVerbaOperacionalDia)}/dia * {currentRegistro.dias_operacao} dias * {currentRegistro.quantidade_equipes} equipes)
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Cálculo baseado na diretriz de Verba Operacional por dia.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">ND 39 (Outros Custos)</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(calculated.valor_nd_39)}</p>
                      <span className="text-xs text-muted-foreground">
                        (Valor Total - ND 30)
                      </span>
                    </div>
                  </div>
                  
                </CardContent>
              </Card>
            );
          })}
          
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => append({
                organizacao: pTrabData.nome_om || "",
                ug: pTrabData.codug_om || "",
                om_detentora: pTrabData.nome_om || "",
                ug_detentora: pTrabData.codug_om || "",
                dias_operacao: pTrabData.periodo_inicio && pTrabData.periodo_fim ? (new Date(pTrabData.periodo_fim).getTime() - new Date(pTrabData.periodo_inicio).getTime()) / (1000 * 3600 * 24) + 1 : 1,
                quantidade_equipes: 1,
                valor_total_solicitado: formatCurrency(0),
                fase_atividade: null,
                detalhamento: null,
                detalhamento_customizado: null,
                objeto_aquisicao: null,
                objeto_contratacao: null,
                proposito: null,
                finalidade: null,
                local: null,
                tarefa: null,
              })}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Registro
            </Button>
            
            <div className="flex space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isSaving ? "Salvando..." : "Salvar Registros"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default VerbaOperacionalFormContent;