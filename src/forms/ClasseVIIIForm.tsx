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
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { OmSelector } from "@/components/OmSelector";
import {
  insertClasseVIII,
  updateClasseVIII,
  ClasseVIIIInsert,
  ClasseVIIIUpdate,
  ClasseVIII,
} from "@/integrations/supabase/classeVIII";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OMData } from "@/lib/omUtils";
import { usePTrabContext } from "@/context/PTrabContext";

// --- Schemas ---

const formSchema = z.object({
  organizacao: z.string().min(1, "A OM é obrigatória."),
  ug: z.string().min(1, "A UG é obrigatória."),
  dias_operacao: z.coerce.number().min(1, "Os dias de operação são obrigatórios."),
  categoria: z.enum(["Saúde - KPSI/KPT", "Remonta - Animais"]),
  
  // Saúde fields
  itens_saude: z.any().optional().nullable(),
  
  // Remonta fields
  animal_tipo: z.string().optional().nullable(),
  quantidade_animais: z.coerce.number().optional().nullable(),
  itens_remonta: z.any().optional().nullable(),

  detalhamento: z.string().optional().nullable(),
  detalhamento_customizado: z.string().optional().nullable(),
  fase_atividade: z.string().optional().nullable(),
  
  // Campos calculados
  valor_total: z.coerce.number().optional().nullable(),
  valor_nd_30: z.coerce.number().optional().nullable(),
  valor_nd_39: z.coerce.number().optional().nullable(),
  
  // Campos auxiliares para o seletor de OM
  om_id: z.string().optional().nullable(), // ID da OM selecionada (não persistido na tabela classe_viii_registros)
});

type ClasseVIIIFormValues = z.infer<typeof formSchema>;

// --- Component ---

interface ClasseVIIIFormProps {
  pTrabId: string;
  initialData?: ClasseVIII;
  onSuccess?: () => void;
}

export function ClasseVIIIForm({ pTrabId, initialData, onSuccess }: ClasseVIIIFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;
  const { currentPTrab } = usePTrabContext();

  const form = useForm<ClasseVIIIFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organizacao: initialData?.organizacao || "",
      ug: initialData?.ug || "",
      dias_operacao: initialData?.dias_operacao || 1,
      categoria: initialData?.categoria || "Saúde - KPSI/KPT",
      detalhamento: initialData?.detalhamento || "",
      detalhamento_customizado: initialData?.detalhamento_customizado || "",
      fase_atividade: initialData?.fase_atividade || currentPTrab?.acoes || "",
      
      // Saúde
      itens_saude: initialData?.itens_saude || null,
      
      // Remonta
      animal_tipo: initialData?.animal_tipo || undefined,
      quantidade_animais: initialData?.quantidade_animais || undefined,
      itens_remonta: initialData?.itens_remonta || null,
      
      // Campos calculados
      valor_total: initialData?.valor_total || undefined,
      valor_nd_30: initialData?.valor_nd_30 || undefined,
      valor_nd_39: initialData?.valor_nd_39 || undefined,
      
      // Auxiliar OM ID
      om_id: undefined, 
    },
  });

  // Sincronização de dados assíncronos (Fix da conversa anterior)
  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        // Garantir que campos numéricos nulos sejam undefined/null
        dias_operacao: initialData.dias_operacao || 1,
        quantidade_animais: initialData.quantidade_animais || undefined,
        valor_total: initialData.valor_total || undefined,
        valor_nd_30: initialData.valor_nd_30 || undefined,
        valor_nd_39: initialData.valor_nd_39 || undefined,
        
        // O om_id é sempre undefined/null aqui, pois não é persistido na tabela de registro
        om_id: undefined, 
      });
    }
  }, [initialData, form]);
  
  // ... (mutation and calculation logic)

  const onSubmit = async (values: ClasseVIIIFormValues) => {
    // ... (submission logic)
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* OM Selector */}
        <Controller
          control={form.control}
          name="organizacao"
          render={({ field }) => (
            <FormField
              control={form.control}
              name="ug"
              render={({ field: ugField }) => (
                <FormItem>
                  <FormLabel>Organização Militar</FormLabel>
                  <FormControl>
                    <OmSelector
                      // O ID da OM não é persistido na tabela de registro, 
                      // então passamos o ID temporário (se houver) ou undefined.
                      // O nome da OM é lido diretamente do field.value (organizacao)
                      selectedOmId={form.watch("om_id") || undefined} 
                      currentOmName={field.value}
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
        
        {/* ... (restante dos campos) */}
      </form>
    </Form>
  );
}