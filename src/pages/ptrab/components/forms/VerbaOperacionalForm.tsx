import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OMData } from "@/lib/omUtils";
import { OmSelector } from "@/components/OmSelector";
import { usePTrabContext } from "@/pages/ptrab/PTrabContext";
import { VerbaOperacionalRegistro, VerbaOperacionalInsert } from "@/types/global";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verbaOperacionalSchema } from "@/lib/validationSchemas";
import { Separator } from "@/components/ui/separator";
import { FaseAtividadeSelector } from "@/components/FaseAtividadeSelector";
import { generateDetalhamento } from "@/lib/verbaOperacionalUtils"; // Assuming this utility exists

interface VerbaOperacionalFormProps {
  registro?: VerbaOperacionalRegistro;
  onSave: () => void;
  onCancel: () => void;
  isSuprimentoDeFundos: boolean;
}

const VerbaOperacionalForm: React.FC<VerbaOperacionalFormProps> = ({
  registro,
  onSave,
  onCancel,
  isSuprimentoDeFundos,
}) => {
  const { ptrab, ptrabId, loading: contextLoading } = usePTrabContext();
  const [loading, setLoading] = useState(false);

  const schema = isSuprimentoDeFundos ? verbaOperacionalSchema.extend({
    objeto_aquisicao: verbaOperacionalSchema.shape.objeto_aquisicao,
    objeto_contratacao: verbaOperacionalSchema.shape.objeto_contratacao,
    proposito: verbaOperacionalSchema.shape.proposito,
    finalidade: verbaOperacionalSchema.shape.finalidade,
    local: verbaOperacionalSchema.shape.local,
    tarefa: verbaOperacionalSchema.shape.tarefa,
  }) : verbaOperacionalSchema;

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      om_favorecida: registro?.organizacao || ptrab?.nome_om || "",
      ug_favorecida: registro?.ug || ptrab?.codug_om || "",
      om_detentora: registro?.om_detentora || ptrab?.nome_om || "",
      ug_detentora: registro?.ug_detentora || ptrab?.codug_om || "",
      dias_operacao: registro?.dias_operacao || 1,
      quantidade_equipes: registro?.quantidade_equipes || 1,
      fase_atividade: registro?.fase_atividade || "",
      valor_total_solicitado: registro?.valor_total_solicitado || 0,
      valor_nd_30: registro?.valor_nd_30 || 0,
      valor_nd_39: registro?.valor_nd_39 || 0,
      detalhamento_customizado: registro?.detalhamento_customizado || "",
      
      // Campos de Suprimento de Fundos
      objeto_aquisicao: registro?.objeto_aquisicao || "",
      objeto_contratacao: registro?.objeto_contratacao || "",
      proposito: registro?.proposito || "",
      finalidade: registro?.finalidade || "",
      local: registro?.local || "",
      tarefa: registro?.tarefa || "",
    },
  });

  const { watch, setValue, handleSubmit, control, formState: { errors } } = form;
  const watchedValues = watch();

  // Efeito para calcular o detalhamento automático
  useEffect(() => {
    if (!isSuprimentoDeFundos) {
      // Apenas Verba Operacional tem detalhamento automático simples
      const detalhamento = `Verba Operacional para ${watchedValues.quantidade_equipes} equipes, durante ${watchedValues.dias_operacao} dias de ${watchedValues.fase_atividade}.`;
      setValue("detalhamento", detalhamento);
    } else {
      // Suprimento de Fundos usa o utilitário de detalhamento completo
      try {
        const detalhamento = generateDetalhamento(watchedValues);
        setValue("detalhamento", detalhamento);
      } catch (e) {
        console.error("Erro ao gerar detalhamento:", e);
        setValue("detalhamento", "Erro ao gerar detalhamento automático.");
      }
    }
  }, [watchedValues.dias_operacao, watchedValues.quantidade_equipes, watchedValues.fase_atividade, isSuprimentoDeFundos, setValue]);

  // Efeito para garantir que a soma das NDs seja igual ao total solicitado
  useEffect(() => {
    const total = watchedValues.valor_total_solicitado;
    const nd30 = watchedValues.valor_nd_30;
    const nd39 = watchedValues.valor_nd_39;

    if (total > 0 && nd30 + nd39 === 0) {
      // Se o total for preenchido, mas as NDs estiverem zeradas, aloca tudo para ND 39 por padrão
      setValue("valor_nd_39", total);
    }
  }, [watchedValues.valor_total_solicitado, watchedValues.valor_nd_30, watchedValues.valor_nd_39, setValue]);

  const onSubmit = async (values: any) => {
    if (!ptrabId) {
      toast.error("P Trab ID não encontrado.");
      return;
    }

    setLoading(true);

    const payload: VerbaOperacionalInsert = {
      p_trab_id: ptrabId,
      organizacao: values.om_favorecida,
      ug: values.ug_favorecida,
      om_detentora: values.om_detentora,
      ug_detentora: values.ug_detentora,
      dias_operacao: values.dias_operacao,
      quantidade_equipes: values.quantidade_equipes,
      fase_atividade: values.fase_atividade,
      valor_total_solicitado: values.valor_total_solicitado,
      valor_nd_30: values.valor_nd_30,
      valor_nd_39: values.valor_nd_39,
      detalhamento_customizado: values.detalhamento_customizado || null,
      detalhamento: values.detalhamento || null,
      
      // Campos de Suprimento de Fundos
      objeto_aquisicao: values.objeto_aquisicao || null,
      objeto_contratacao: values.objeto_contratacao || null,
      proposito: values.proposito || null,
      finalidade: values.finalidade || null,
      local: values.local || null,
      tarefa: values.tarefa || null,
    };

    try {
      if (registro) {
        // Update
        const { error } = await supabase
          .from("verba_operacional_registros")
          .update(payload)
          .eq("id", registro.id);
        if (error) throw error;
        toast.success("Registro atualizado com sucesso!");
      } else {
        // Insert
        const { error } = await supabase.from("verba_operacional_registros").insert(payload as VerbaOperacionalInsert);
        if (error) throw error;
        toast.success("Registro criado com sucesso!");
      }
      onSave();
    } catch (error: any) {
      console.error("Erro ao salvar registro:", error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const title = isSuprimentoDeFundos ? "Suprimento de Fundos" : "Verba Operacional";
  const subtitle = registro ? "Editar Registro" : "Novo Registro";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title} - {subtitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Seção 1: Contexto da OM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={control}
                name="om_favorecida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OM Favorecida (Destino do Recurso) *</FormLabel>
                    <FormControl>
                      <OmSelector
                        selectedOmId={field.value}
                        onOmSelect={(omData: OMData | undefined) => {
                          if (omData) {
                            field.onChange(omData.nome_om);
                            setValue("ug_favorecida", omData.codug_om);
                          } else {
                            field.onChange("");
                            setValue("ug_favorecida", "");
                          }
                        }}
                        initialOmName={field.value}
                        placeholder="Selecione a OM Favorecida..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="ug_favorecida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UG Favorecida (UG Destino) *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="om_detentora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OM Detentora (Fonte do Recurso) *</FormLabel>
                    <FormControl>
                      <OmSelector
                        selectedOmId={field.value}
                        onOmSelect={(omData: OMData | undefined) => {
                          if (omData) {
                            field.onChange(omData.nome_om);
                            setValue("ug_detentora", omData.codug_om);
                          } else {
                            field.onChange("");
                            setValue("ug_detentora", "");
                          }
                        }}
                        initialOmName={field.value}
                        placeholder="Selecione a OM Detentora..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="ug_detentora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UG Detentora (UG Fonte) *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />

            {/* Seção 2: Período e Quantidade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name="dias_operacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dias de Operação *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="quantidade_equipes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de Equipes *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="fase_atividade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fase da Atividade *</FormLabel>
                    <FormControl>
                      <FaseAtividadeSelector
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Seção 3: Valores e Alocação ND */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={control}
                name="valor_total_solicitado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total Solicitado (R$) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={formatCurrency(field.value)}
                        onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="valor_nd_30"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alocação ND 33.90.30 (Material)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={formatCurrency(field.value)}
                        onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="valor_nd_39"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alocação ND 33.90.39 (Serviço)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={formatCurrency(field.value)}
                        onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Seção 4: Detalhamento Suprimento de Fundos (Apenas se for Suprimento) */}
            {isSuprimentoDeFundos && (
              <>
                <Separator />
                <h4 className="text-lg font-semibold">Detalhamento Específico (Suprimento de Fundos)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="objeto_aquisicao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objeto de Aquisição (Material) *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Material de expediente, EPIs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="objeto_contratacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objeto de Contratação (Serviço) *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Serviço de cópias, manutenção" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="proposito"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Propósito *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Apoiar a Operação X" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="finalidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Finalidade *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Garantir a continuidade das atividades" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="local"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Marabá/PA" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="tarefa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarefa *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Aquisição de material de consumo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <Separator />

            {/* Seção 5: Detalhamento Customizado */}
            <FormField
              control={control}
              name="detalhamento_customizado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memória de Cálculo / Detalhamento Customizado (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={6}
                      placeholder="Deixe em branco para usar o detalhamento automático."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || contextLoading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (registro ? "Atualizar Registro" : "Adicionar Registro")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default VerbaOperacionalForm;