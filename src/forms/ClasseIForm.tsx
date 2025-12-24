"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
// ... (outras importações)
import { supabase } from "@/integrations/supabase/client"; // Importação necessária para o lookup
import {
  insertClasseI,
  updateClasseI,
  ClasseIInsert,
  ClasseIUpdate,
  ClasseI,
} from "@/integrations/supabase/classeI";
import { useEffect, useMemo } from "react";
// ... (outras importações)

// ... (schema e tipos)

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
    // ... (defaultValues)
  });

  // Sincronização de dados assíncronos (Fix da conversa anterior)
  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        // ... (reset de campos numéricos)
        
        // O om_id é sempre undefined/null aqui, pois não é persistido na tabela de registro
        om_id: undefined, 
        om_qs_id: undefined,
      });
    }
  }, [initialData, form]);
  
  // NOVO: Lookup OM ID (Executante) na edição
  useEffect(() => {
    if (initialData && initialData.organizacao && initialData.ug) {
      const lookupOmId = async () => {
        const { data, error } = await supabase
          .from('organizacoes_militares')
          .select('id')
          .eq('nome_om', initialData.organizacao)
          .eq('codug_om', initialData.ug)
          .maybeSingle();

        if (data && data.id) {
          form.setValue("om_id", data.id, { shouldDirty: false });
        }
      };
      lookupOmId();
    }
  }, [initialData, form]);
  
  // NOVO: Lookup OM ID (QS) na edição
  useEffect(() => {
    if (initialData && initialData.om_qs && initialData.ug_qs) {
      const lookupOmQsId = async () => {
        const { data, error } = await supabase
          .from('organizacoes_militares')
          .select('id')
          .eq('nome_om', initialData.om_qs)
          .eq('codug_om', initialData.ug_qs)
          .maybeSingle();

        if (data && data.id) {
          form.setValue("om_qs_id", data.id, { shouldDirty: false });
        }
      };
      lookupOmQsId();
    }
  }, [initialData, form]);
  
  // ... (restante do componente)

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
                      // Agora om_id é preenchido via lookup assíncrono no useEffect
                      selectedOmId={form.watch("om_id") || undefined} 
                      currentOmName={field.value} 
                      initialOmUg={ugField.value} 
                      onChange={(omData: OMData | undefined) => {
                        field.onChange(omData?.nome_om || "");
                        ugField.onChange(omData?.codug_om || "");
                        // Atualiza o om_id no estado RHF para o OmSelector usar
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
                      // Agora om_qs_id é preenchido via lookup assíncrono no useEffect
                      selectedOmId={form.watch("om_qs_id") || undefined} 
                      currentOmName={field.value} 
                      initialOmUg={ugQsField.value} 
                      onChange={(omData: OMData | undefined) => {
                        field.onChange(omData?.nome_om || "");
                        ugQsField.onChange(omData?.codug_om || "");
                        // Atualiza o om_qs_id no estado RHF para o OmSelector usar
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
      </form>
    </Form>
  );
}