"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { OmSelector } from "@/components/OmSelector";
import {
  insertClasseI,
  updateClasseI,
  ClasseIInsert,
  ClasseIUpdate,
  ClasseI,
} from "@/integrations/supabase/classeI";
import { useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OMData } from "@/lib/omUtils";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { usePTrabContext } from "@/context/PTrabContext";
import { Textarea } from "@/components/ui/textarea";

// --- Schemas ---

const formSchema = z.object({
  organizacao: z.string().min(1, "A OM é obrigatória."),
  ug: z.string().min(1, "A UG é obrigatória."),
  om_qs: z.string().min(1, "A OM QS é obrigatória."),
  ug_qs: z.string().min(1, "A UG QS é obrigatória."),
  efetivo: z.coerce.number().min(1, "O efetivo deve ser maior que zero."),
  dias_operacao: z.coerce.number().min(1, "Os dias de operação são obrigatórios."),
  nr_ref_int: z.coerce.number().min(1, "O Nr Ref Int é obrigatório."),
  categoria: z.enum(["RACAO_QUENTE", "R2", "R3"]),
  quantidade_r2: z.coerce.number().optional().nullable(),
  quantidade_r3: z.coerce.number().optional().nullable(),
  
  // Campos calculados (apenas para exibição/armazenamento, não para input direto)
  valor_qs: z.coerce.number().optional().nullable(),
  valor_qr: z.coerce.number().optional().nullable(),
  complemento_qs: z.coerce.number().optional().nullable(),
  etapa_qs: z.coerce.number().optional().nullable(),
  total_qs: z.coerce.number().optional().nullable(),
  complemento_qr: z.coerce.number().optional().nullable(),
  etapa_qr: z.coerce.number().optional().nullable(),
  total_qr: z.coerce.number().optional().nullable(),
  total_geral: z.coerce.number().optional().nullable(),
  fase_atividade: z.string().optional().nullable(),
  memoria_calculo_qs_customizada: z.string().optional().nullable(),
  memoria_calculo_qr_customizada: z.string().optional().nullable(),
  
  // Campos auxiliares para o seletor de OM
  om_id: z.string().optional().nullable(), // ID da OM executante (não persistido na tabela classe_i_registros)
  om_qs_id: z.string().optional().nullable(), // ID da OM QS (não persistido na tabela classe_i_registros)
});

type ClasseIFormValues = z.infer<typeof formSchema>;

// --- Component ---

interface ClasseIFormProps {
  pTrabId: string;
  initialData?: ClasseI;
  onSuccess?: () => void;
}

export function ClasseIForm({ pTrabId, initialData, onSuccess }: ClasseIFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;
  const { currentPTrab } = usePTrabContext();

  const form = useForm<ClasseIFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organizacao: initialData?.organizacao || "",
      ug: initialData?.ug || "",
      om_qs: initialData?.om_qs || "",
      ug_qs: initialData?.ug_qs || "",
      efetivo: initialData?.efetivo || 1,
      dias_operacao: initialData?.dias_operacao || 1,
      nr_ref_int: initialData?.nr_ref_int || 1,
      categoria: initialData?.categoria || "RACAO_QUENTE",
      quantidade_r2: initialData?.quantidade_r2 || 0,
      quantidade_r3: initialData?.quantidade_r3 || 0,
      fase_atividade: initialData?.fase_atividade || currentPTrab?.acoes || "",
      
      // Campos calculados
      valor_qs: initialData?.valor_qs || undefined,
      valor_qr: initialData?.valor_qr || undefined,
      complemento_qs: initialData?.complemento_qs || undefined,
      etapa_qs: initialData?.etapa_qs || undefined,
      total_qs: initialData?.total_qs || undefined,
      complemento_qr: initialData?.complemento_qr || undefined,
      etapa_qr: initialData?.etapa_qr || undefined,
      total_qr: initialData?.total_qr || undefined,
      total_geral: initialData?.total_geral || undefined,
      memoria_calculo_qs_customizada: initialData?.memoria_calculo_qs_customizada || "",
      memoria_calculo_qr_customizada: initialData?.memoria_calculo_qr_customizada || "",
      
      // Auxiliar OM ID
      om_id: undefined, 
      om_qs_id: undefined,
    },
  });

  // Sincronização de dados assíncronos (Fix da conversa anterior)
  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        // Garantir que campos numéricos nulos sejam undefined/null
        efetivo: initialData.efetivo || 1,
        dias_operacao: initialData.dias_operacao || 1,
        nr_ref_int: initialData.nr_ref_int || 1,
        quantidade_r2: initialData.quantidade_r2 || 0,
        quantidade_r3: initialData.quantidade_r3 || 0,
        
        valor_qs: initialData.valor_qs || undefined,
        valor_qr: initialData.valor_qr || undefined,
        complemento_qs: initialData.complemento_qs || undefined,
        etapa_qs: initialData.etapa_qs || undefined,
        total_qs: initialData.total_qs || undefined,
        complemento_qr: initialData.complemento_qr || undefined,
        etapa_qr: initialData.etapa_qr || undefined,
        total_qr: initialData.total_qr || undefined,
        total_geral: initialData.total_geral || undefined,
        
        // O om_id é sempre undefined/null aqui, pois não é persistido na tabela de registro
        om_id: undefined, 
        om_qs_id: undefined,
      });
    }
  }, [initialData, form]);
  
  // ... (mutation and calculation logic)

  const onSubmit = async (values: ClasseIFormValues) => {
    // ... (submission logic)
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* OM Executante Selector */}
        <Controller
          control={form.control}
          name="organizacao"
          render={({ field }) => (
            <FormField
              control={form.control}
              name="ug"
              render={({ field: ugField }) => (
                <FormItem>
                  <FormLabel>Organização Militar Executante</FormLabel>
                  <FormControl>
                    <OmSelector
                      // O ID da OM não é persistido na tabela de registro, 
                      // então passamos o ID temporário (se houver) ou undefined.
                      selectedOmId={form.watch("om_id") || undefined} 
                      currentOmName={field.value} // CORREÇÃO: Passa o nome da OM salva
                      initialOmUg={ugField.value} // NOVO: Passa a UG para lookup
                      onChange={(omData: OMData | undefined) => {
                        field.onChange(omData?.nome_om || "");
                        ugField.onChange(omData?.codug_om || "");
                        form.setValue("om_id", omData?.id || undefined, { shouldDirty: true });
                      }}
                      placeholder="Selecione a OM executante"
                    />
                  </FormControl>
                  <FormMessage />
                  {/* Exibição da UG */}
                  {ugField.value && (
                    <p className="text-sm text-muted-foreground mt-1">
                      UG: {ugField.value}
                    </p>
                  )}
                </FormItem>
              )}
            />
          )}
        />
        
        {/* OM QS Selector */}
        <Controller
          control={form.control}
          name="om_qs"
          render={({ field }) => (
            <FormField
              control={form.control}
              name="ug_qs"
              render={({ field: ugQsField }) => (
                <FormItem>
                  <FormLabel>Organização Militar QS (Quartel-General)</FormLabel>
                  <FormControl>
                    <OmSelector
                      // O ID da OM não é persistido na tabela de registro, 
                      // então passamos o ID temporário (se houver) ou undefined.
                      selectedOmId={form.watch("om_qs_id") || undefined} 
                      currentOmName={field.value} // CORREÇÃO: Passa o nome da OM salva
                      initialOmUg={ugQsField.value} // NOVO: Passa a UG para lookup
                      onChange={(omData: OMData | undefined) => {
                        field.onChange(omData?.nome_om || "");
                        ugQsField.onChange(omData?.codug_om || "");
                        form.setValue("om_qs_id", omData?.id || undefined, { shouldDirty: true });
                      }}
                      placeholder="Selecione a OM QS"
                    />
                  </FormControl>
                  <FormMessage />
                  {/* Exibição da UG */}
                  {ugQsField.value && (
                    <p className="text-sm text-muted-foreground mt-1">
                      UG: {ugQsField.value}
                    </p>
                  )}
                </FormItem>
              )}
            />
          )}
        />
        
        {/* ... (restante dos campos) */}
        
        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> {isEdit ? "Atualizar Registro" : "Adicionar Registro"}</>
          )}
        </Button>
      </form>
    </Form>
  );
}