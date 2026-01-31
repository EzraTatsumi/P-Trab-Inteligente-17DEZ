"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { OmSelector } from "@/components/OmSelector";
import { usePTrabContext } from "@/pages/ptrab/PTrabContext";
import { VerbaOperacionalRegistro } from "@/types/global";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FaseAtividadeSelector } from "@/components/FaseAtividadeSelector";

// --- Schema Definition ---
const VerbaOperacionalSchema = z.object({
  id: z.string().optional(),
  p_trab_id: z.string().uuid(),
  organizacao: z.string().min(1, "Organização é obrigatória"),
  ug: z.string().min(1, "UG é obrigatória"),
  om_detentora: z.string().optional().nullable(),
  ug_detentora: z.string().optional().nullable(),
  dias_operacao: z.coerce.number().min(1, "Mínimo 1 dia"),
  quantidade_equipes: z.coerce.number().min(1, "Mínimo 1 equipe"),
  valor_total_solicitado: z.string().min(1, "Valor é obrigatório"),
  fase_atividade: z.string().optional().nullable(),
  detalhamento: z.string().optional().nullable(),
  detalhamento_customizado: z.string().optional().nullable(),
  valor_nd_30: z.string().optional().nullable(),
  valor_nd_39: z.string().optional().nullable(),
});

type VerbaOperacionalFormData = z.infer<typeof VerbaOperacionalSchema>;

interface VerbaOperacionalFormProps {
  initialData?: VerbaOperacionalRegistro;
  onSuccess?: () => void;
}

export function VerbaOperacionalForm({ initialData, onSuccess }: VerbaOperacionalFormProps) {
  const queryClient = useQueryClient();
  const { pTrabId } = usePTrabContext();

  const [omName, setOmName] = useState(initialData?.organizacao || "");
  const [ug, setUg] = useState(initialData?.ug || "");
  const [omDetentoraName, setOmDetentoraName] = useState(initialData?.om_detentora || "");
  const [ugDetentora, setUgDetentora] = useState(initialData?.ug_detentora || "");

  const form = useForm<VerbaOperacionalFormData>({
    resolver: zodResolver(VerbaOperacionalSchema),
    defaultValues: {
      id: initialData?.id,
      p_trab_id: pTrabId,
      organizacao: initialData?.organizacao || "",
      ug: initialData?.ug || "",
      om_detentora: initialData?.om_detentora || null,
      ug_detentora: initialData?.ug_detentora || null,
      dias_operacao: initialData?.dias_operacao || 1,
      quantidade_equipes: initialData?.quantidade_equipes || 1,
      valor_total_solicitado: formatCurrency(initialData?.valor_total_solicitado || 0),
      fase_atividade: initialData?.fase_atividade || null,
      detalhamento: initialData?.detalhamento || null,
      detalhamento_customizado: initialData?.detalhamento_customizado || null,
      valor_nd_30: formatCurrency(initialData?.valor_nd_30 || 0),
      valor_nd_39: formatCurrency(initialData?.valor_nd_39 || 0),
    },
  });

  const isEditing = !!initialData;

  const saveMutation = useMutation({
    mutationFn: async (data: VerbaOperacionalFormData) => {
      const payload = {
        ...data,
        valor_total_solicitado: parseCurrency(data.valor_total_solicitado),
        valor_nd_30: parseCurrency(data.valor_nd_30 || "0"),
        valor_nd_39: parseCurrency(data.valor_nd_39 || "0"),
        organizacao: omName,
        ug: ug,
        om_detentora: omDetentoraName,
        ug_detentora: ugDetentora,
      };

      if (isEditing) {
        const { error } = await supabase.from("verba_operacional_registros").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("verba_operacional_registros").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verba_operacional_registros", pTrabId] });
      queryClient.invalidateQueries({ queryKey: ["ptrab_resumo", pTrabId] });
      toast.success(`Registro de Verba Operacional ${isEditing ? "atualizado" : "criado"} com sucesso.`);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Erro ao salvar registro de Verba Operacional:", error);
      toast.error("Erro ao salvar registro. Tente novamente.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("verba_operacional_registros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verba_operacional_registros", pTrabId] });
      queryClient.invalidateQueries({ queryKey: ["ptrab_resumo", pTrabId] });
      toast.success("Registro de Verba Operacional excluído com sucesso.");
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Erro ao excluir registro de Verba Operacional:", error);
      toast.error("Erro ao excluir registro. Tente novamente.");
    },
  });

  const onSubmit = (data: VerbaOperacionalFormData) => {
    saveMutation.mutate(data);
  };

  const handleDelete = () => {
    if (initialData?.id) {
      deleteMutation.mutate(initialData.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Editar Registro" : "Novo Registro"} de Verba Operacional</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* OM Detentora */}
              <FormField
                control={form.control}
                name="om_detentora"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OM Detentora (Opcional)</FormLabel>
                    <FormControl>
                      <OmSelector
                        selectedOmId={field.value}
                        onSelect={(id, name, ug) => {
                          field.onChange(id);
                          setOmDetentoraName(name);
                          setUgDetentora(ug);
                        }}
                        initialOmName={omDetentoraName}
                        placeholder="Selecione a OM Detentora"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* OM Destino */}
              <FormField
                control={form.control}
                name="organizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OM de Destino</FormLabel>
                    <FormControl>
                      <OmSelector
                        selectedOmId={field.value}
                        onSelect={(id, name, ug) => {
                          field.onChange(id);
                          setOmName(name);
                          setUg(ug);
                        }}
                        initialOmName={omName}
                        placeholder="Selecione a OM de Destino"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dias de Operação */}
              <FormField
                control={form.control}
                name="dias_operacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dias de Operação</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantidade de Equipes */}
              <FormField
                control={form.control}
                name="quantidade_equipes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de Equipes</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fase da Atividade */}
              <FormField
                control={form.control}
                name="fase_atividade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fase da Atividade (Opcional)</FormLabel>
                    <FormControl>
                      <FaseAtividadeSelector
                        selectedFase={field.value || ""}
                        onSelect={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Valor Total Solicitado */}
              <FormField
                control={form.control}
                name="valor_total_solicitado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total Solicitado (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0,00"
                        onChange={(e) => field.onChange(formatCurrency(parseCurrency(e.target.value)))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor ND 30 */}
              <FormField
                control={form.control}
                name="valor_nd_30"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor ND 30 (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0,00"
                        onChange={(e) => field.onChange(formatCurrency(parseCurrency(e.target.value)))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor ND 39 */}
              <FormField
                control={form.control}
                name="valor_nd_39"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor ND 39 (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0,00"
                        onChange={(e) => field.onChange(formatCurrency(parseCurrency(e.target.value)))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Detalhamento */}
            <FormField
              control={form.control}
              name="detalhamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhamento (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o detalhamento..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Detalhamento Customizado */}
            <FormField
              control={form.control}
              name="detalhamento_customizado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhamento Customizado (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o detalhamento customizado..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || saveMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              )}
              <Button type="submit" disabled={saveMutation.isPending || deleteMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : isEditing ? (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Salvar Alterações
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Registro
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}