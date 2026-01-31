import React, { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OmSelector, OMData } from "@/components/OmSelector";
import { usePTrabContext } from "@/pages/ptrab/PTrabContext";
import { VerbaOperacionalRegistro } from "@/types/global";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FaseAtividadeSelector } from "@/components/FaseAtividadeSelector";
import { usePTrabRecords } from "@/hooks/usePTrabRecords";
import { useDiretrizesOperacionais } from "@/hooks/useDiretrizesOperacionais";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

// Esquema de validação Zod
const VerbaOperacionalSchema = z.object({
  registros: z.array(
    z.object({
      id: z.string().optional(),
      organizacao: z.string().min(1, "Organização é obrigatória"),
      ug: z.string().min(1, "UG é obrigatória"),
      om_detentora: z.string().min(1, "OM Detentora é obrigatória"),
      ug_detentora: z.string().min(1, "UG Detentora é obrigatória"),
      dias_operacao: z.number().min(1, "Dias de operação deve ser no mínimo 1"),
      quantidade_equipes: z.number().min(1, "Quantidade de equipes deve ser no mínimo 1"),
      valor_total_solicitado: z.number().min(0, "Valor total deve ser positivo"),
      fase_atividade: z.string().optional().nullable(),
      detalhamento: z.string().optional().nullable(),
      detalhamento_customizado: z.string().optional().nullable(),
      objeto_aquisicao: z.string().optional().nullable(),
      objeto_contratacao: z.string().optional().nullable(),
      proposito: z.string().optional().nullable(),
      finalidade: z.string().optional().nullable(),
      local: z.string().optional().nullable(),
      tarefa: z.string().optional().nullable(),
      
      // Campos calculados (não são editáveis diretamente, mas necessários para o payload)
      valor_nd_30: z.number().optional(),
      valor_nd_39: z.number().optional(),
      
      isEditing: z.boolean().optional(),
    })
  ),
});

type VerbaOperacionalFormValues = z.infer<typeof VerbaOperacionalSchema>;

const VerbaOperacionalForm = () => {
  const { ptrabId, ptrabData, setLoading, loading: globalLoading } = usePTrabContext();
  const { handleEnterToNextField } = useFormNavigation();

  const { 
    data: registros, 
    isLoading: isRecordsLoading, 
    refetch: refetchRecords 
  } = usePTrabRecords<"verba_operacional_registros">('verba_operacional_registros', ptrabId);

  const anoReferencia = ptrabData?.periodo_inicio ? new Date(ptrabData.periodo_inicio).getFullYear() : new Date().getFullYear();
  const { data: diretrizes, isLoading: isDiretrizesLoading } = useDiretrizesOperacionais(anoReferencia);

  const defaultValues: VerbaOperacionalFormValues = {
    registros: (registros || []).map(r => ({ ...r, isEditing: false })),
  };

  const form = useForm<VerbaOperacionalFormValues>({
    resolver: zodResolver(VerbaOperacionalSchema),
    defaultValues,
    values: {
      registros: (registros || []).map(r => ({ ...r, isEditing: false })),
    },
  });

  const { control, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = form;
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: "registros",
    keyName: "key",
  });
  
  const watchedRegistros = watch('registros');

  useEffect(() => {
    if (registros) {
      reset({ registros: registros.map(r => ({ ...r, isEditing: false })) });
    }
  }, [registros, reset]);

  const calculateValues = useCallback((
    valorTotalSolicitado: number, 
    diasOperacao: number, 
    quantidadeEquipes: number
  ) => {
    if (!diretrizes) {
      toast.error("Diretrizes Operacionais não carregadas. Verifique as configurações.");
      return { valor_nd_30: 0, valor_nd_39: 0, valor_total: 0 };
    }
    
    const valorVerbaOperacionalDia = diretrizes.valor_verba_operacional_dia || 0;
    
    // Cálculo da Verba Operacional (ND 30)
    const valorND30 = valorVerbaOperacionalDia * diasOperacao * quantidadeEquipes;
    
    // O valor total solicitado é o valor que o usuário insere, que pode ser maior que o valor ND 30 calculado.
    // A diferença é alocada para ND 39.
    const valorND39 = Math.max(0, valorTotalSolicitado - valorND30);
    
    // O valor total é a soma do que foi alocado para ND 30 e ND 39
    const valorTotal = valorND30 + valorND39;

    return {
      valor_nd_30: valorND30,
      valor_nd_39: valorND39,
      valor_total: valorTotal,
    };
  }, [diretrizes]);

  const handleSave = async (data: VerbaOperacionalFormValues) => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado.");
      return;
    }
    
    setLoading(true);

    try {
      const currentRecord = data.registros.find(r => r.isEditing);
      if (!currentRecord) throw new Error("Nenhum registro em edição.");
      
      const { isEditing, ...dataToSave } = currentRecord;
      
      const calculated = calculateValues(
        dataToSave.valor_total_solicitado,
        dataToSave.dias_operacao,
        dataToSave.quantidade_equipes
      );
      
      const payload: TablesInsert<'verba_operacional_registros'> = {
        ...dataToSave,
        p_trab_id: ptrabId,
        valor_nd_30: calculated.valor_nd_30,
        valor_nd_39: calculated.valor_nd_39,
        valor_total_solicitado: dataToSave.valor_total_solicitado,
        // Campos obrigatórios que não são opcionais no Insert
        organizacao: dataToSave.organizacao,
        ug: dataToSave.ug,
        dias_operacao: dataToSave.dias_operacao,
        quantidade_equipes: dataToSave.quantidade_equipes,
      };

      if (currentRecord.id) {
        // Update
        const { error } = await supabase
          .from("verba_operacional_registros")
          .update(payload)
          .eq("id", currentRecord.id);
        if (error) throw error;
        toast.success("Registro de Verba Operacional atualizado!");
      } else {
        // Insert
        const { error } = await supabase.from("verba_operacional_registros").insert(payload as TablesInsert<'verba_operacional_registros'>);
        if (error) throw error;
        toast.success("Registro de Verba Operacional adicionado!");
      }

      await refetchRecords();
      setLoading(false);
      
    } catch (error: any) {
      toast.error("Erro ao salvar registro.", { description: sanitizeError(error) });
      setLoading(false);
    }
  };

  const handleRemove = async (id: string, index: number) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return;
    
    setLoading(true);
    try {
      if (id) {
        const { error } = await supabase
          .from("verba_operacional_registros")
          .delete()
          .eq("id", id);
        if (error) throw error;
        toast.success("Registro removido com sucesso!");
      }
      remove(index);
      await refetchRecords();
    } catch (error: any) {
      toast.error("Erro ao remover registro.", { description: sanitizeError(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    const newRecord: VerbaOperacionalRegistro & { isEditing: boolean } = {
      id: undefined,
      p_trab_id: ptrabId || "",
      organizacao: ptrabData?.nome_om || "",
      ug: ptrabData?.codug_om || "",
      om_detentora: ptrabData?.nome_om || "",
      ug_detentora: ptrabData?.codug_om || "",
      dias_operacao: 1,
      quantidade_equipes: 1,
      valor_total_solicitado: 0,
      fase_atividade: null,
      detalhamento: null,
      detalhamento_customizado: null,
      objeto_aquisicao: null,
      objeto_contratacao: null,
      proposito: null,
      finalidade: null,
      local: null,
      tarefa: null,
      valor_nd_30: 0,
      valor_nd_39: 0,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      isEditing: true,
    } as VerbaOperacionalRegistro & { isEditing: boolean };
    
    // Desativa a edição de todos os outros registros
    fields.forEach((_, index) => setValue(`registros.${index}.isEditing`, false));
    
    append(newRecord);
  };

  const handleEdit = (index: number) => {
    // Desativa a edição de todos os outros registros
    fields.forEach((_, idx) => {
      if (idx !== index) {
        setValue(`registros.${idx}.isEditing`, false);
      }
    });
    setValue(`registros.${index}.isEditing`, true);
  };
  
  const handleCancelEdit = (index: number) => {
    // Se for um novo registro sem ID, remove. Senão, apenas desativa a edição.
    if (!fields[index].id) {
      remove(index);
    } else {
      setValue(`registros.${index}.isEditing`, false);
      // Opcional: resetar os valores do registro para o estado original (se necessário)
      // Como o reset é feito com base no `registros` do usePTrabRecords, um refetch resolveria.
    }
  };

  if (isRecordsLoading || isDiretrizesLoading || globalLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!ptrabId) {
    return <p className="text-red-500">Erro: PTrab ID não encontrado.</p>;
  }
  
  if (!diretrizes) {
    return (
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="text-red-600">Diretrizes Operacionais Ausentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Não foi possível carregar as diretrizes operacionais para o ano {anoReferencia}.</p>
          <p className="mt-2">Por favor, configure-as em <span className="font-semibold">Configurações > Custos Operacionais</span>.</p>
        </CardContent>
      </Card>
    );
  }

  const isAnyEditing = watchedRegistros.some(r => r.isEditing);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Verba Operacional (ND 30/39)</CardTitle>
        <Button onClick={handleAddNew} disabled={isAnyEditing || isSubmitting}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Registro
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
          {fields.map((field, index) => {
            const isEditing = watchedRegistros[index]?.isEditing;
            const currentValues = watchedRegistros[index];
            
            const calculated = calculateValues(
              currentValues.valor_total_solicitado || 0,
              currentValues.dias_operacao || 0,
              currentValues.quantidade_equipes || 0
            );

            return (
              <div key={field.key} className="border p-4 rounded-lg shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Registro {index + 1}
                    {isEditing && <span className="text-sm text-blue-600 ml-2">(Editando)</span>}
                  </h3>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button type="submit" size="sm" disabled={isSubmitting}>
                          <Save className="mr-2 h-4 w-4" />
                          {isSubmitting ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleCancelEdit(index)} disabled={isSubmitting}>
                          <X className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(index)} disabled={isAnyEditing}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => handleRemove(field.id!, index)} disabled={isAnyEditing}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* OM Detentora */}
                  <Controller
                    name={`registros.${index}.om_detentora`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`om_detentora_${index}`}>OM Detentora *</Label>
                        <OmSelector
                          selectedOmId={field.value}
                          onSelect={(omData: OMData | undefined) => {
                            if (omData) {
                              field.onChange(omData.nome_om);
                              setValue(`registros.${index}.ug_detentora`, omData.codug_om);
                            } else {
                              field.onChange("");
                              setValue(`registros.${index}.ug_detentora`, "");
                            }
                          }}
                          initialOmName={field.value}
                          placeholder="Selecione a OM Detentora"
                          disabled={!isEditing}
                        />
                        <p className="text-xs text-muted-foreground">UG Detentora: {currentValues.ug_detentora}</p>
                      </div>
                    )}
                  />
                  
                  {/* OM Solicitante */}
                  <Controller
                    name={`registros.${index}.organizacao`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`organizacao_${index}`}>OM Solicitante *</Label>
                        <OmSelector
                          selectedOmId={field.value}
                          onSelect={(omData: OMData | undefined) => {
                            if (omData) {
                              field.onChange(omData.nome_om);
                              setValue(`registros.${index}.ug`, omData.codug_om);
                            } else {
                              field.onChange("");
                              setValue(`registros.${index}.ug`, "");
                            }
                          }}
                          initialOmName={field.value}
                          placeholder="Selecione a OM Solicitante"
                          disabled={!isEditing}
                        />
                        <p className="text-xs text-muted-foreground">UG Solicitante: {currentValues.ug}</p>
                      </div>
                    )}
                  />
                  
                  {/* Fase da Atividade */}
                  <Controller
                    name={`registros.${index}.fase_atividade`}
                    control={control}
                    render={({ field }) => (
                      <FaseAtividadeSelector
                        value={field.value || ""}
                        onChange={field.onChange}
                        disabled={!isEditing}
                      />
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Dias de Operação */}
                  <Controller
                    name={`registros.${index}.dias_operacao`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`dias_operacao_${index}`}>Dias de Operação *</Label>
                        <Input
                          {...field}
                          id={`dias_operacao_${index}`}
                          type="number"
                          min={1}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Quantidade de Equipes */}
                  <Controller
                    name={`registros.${index}.quantidade_equipes`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`quantidade_equipes_${index}`}>Qtd Equipes *</Label>
                        <Input
                          {...field}
                          id={`quantidade_equipes_${index}`}
                          type="number"
                          min={1}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Valor Total Solicitado */}
                  <Controller
                    name={`registros.${index}.valor_total_solicitado`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`valor_total_solicitado_${index}`}>Valor Total Solicitado (R$) *</Label>
                        <Input
                          id={`valor_total_solicitado_${index}`}
                          value={formatCurrency(field.value)}
                          onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Valor ND 30 (Calculado) */}
                  <div className="space-y-2">
                    <Label>Valor ND 30 (Calculado)</Label>
                    <Input
                      value={formatCurrency(calculated.valor_nd_30)}
                      disabled
                      className="bg-gray-100 dark:bg-gray-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(diretrizes.valor_verba_operacional_dia || 0)}/dia x {currentValues.dias_operacao} dias x {currentValues.quantidade_equipes} equipes
                    </p>
                  </div>
                  
                  {/* Valor ND 39 (Calculado) */}
                  <div className="space-y-2">
                    <Label>Valor ND 39 (Calculado)</Label>
                    <Input
                      value={formatCurrency(calculated.valor_nd_39)}
                      disabled
                      className="bg-gray-100 dark:bg-gray-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      Diferença entre Solicitado e ND 30.
                    </p>
                  </div>
                  
                  {/* Valor Total (Calculado) */}
                  <div className="space-y-2">
                    <Label>Valor Total (Geral)</Label>
                    <Input
                      value={formatCurrency(calculated.valor_total)}
                      disabled
                      className="bg-gray-100 dark:bg-gray-800 font-bold"
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Objeto de Aquisição */}
                  <Controller
                    name={`registros.${index}.objeto_aquisicao`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`objeto_aquisicao_${index}`}>Objeto de Aquisição</Label>
                        <Input
                          {...field}
                          id={`objeto_aquisicao_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Objeto de Contratação */}
                  <Controller
                    name={`registros.${index}.objeto_contratacao`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`objeto_contratacao_${index}`}>Objeto de Contratação</Label>
                        <Input
                          {...field}
                          id={`objeto_contratacao_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Propósito */}
                  <Controller
                    name={`registros.${index}.proposito`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`proposito_${index}`}>Propósito</Label>
                        <Input
                          {...field}
                          id={`proposito_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Finalidade */}
                  <Controller
                    name={`registros.${index}.finalidade`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`finalidade_${index}`}>Finalidade</Label>
                        <Input
                          {...field}
                          id={`finalidade_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Local */}
                  <Controller
                    name={`registros.${index}.local`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`local_${index}`}>Local</Label>
                        <Input
                          {...field}
                          id={`local_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Tarefa */}
                  <Controller
                    name={`registros.${index}.tarefa`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`tarefa_${index}`}>Tarefa</Label>
                        <Input
                          {...field}
                          id={`tarefa_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onKeyDown={handleEnterToNextField}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Detalhamento Padrão */}
                  <Controller
                    name={`registros.${index}.detalhamento`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`detalhamento_${index}`}>Detalhamento Padrão</Label>
                        <Textarea
                          {...field}
                          id={`detalhamento_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          rows={3}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                  
                  {/* Detalhamento Customizado */}
                  <Controller
                    name={`registros.${index}.detalhamento_customizado`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Label htmlFor={`detalhamento_customizado_${index}`}>Detalhamento Customizado</Label>
                        <Textarea
                          {...field}
                          id={`detalhamento_customizado_${index}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          rows={3}
                          disabled={!isEditing}
                        />
                      </div>
                    )}
                  />
                </div>
              </div>
            );
          })}
          
          {fields.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro de Verba Operacional adicionado. Clique em "Adicionar Registro" para começar.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default VerbaOperacionalForm;