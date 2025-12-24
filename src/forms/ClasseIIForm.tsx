"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { usePTrabContext } from "@/context/PTrabContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Tipagem do registro de Classe II
export interface ClasseIIRegistro {
  id: string;
  p_trab_id: string;
  organizacao: string; // Nome da OM
  ug: string; // UG da OM
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: any; // JSONB
  valor_total: number;
  detalhamento: string | null;
  detalhamento_customizado: string | null;
  fase_atividade: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
}

// Esquema de validação Zod
const ClasseIIFormSchema = z.object({
  organizacao: z.string().min(1, "Organização é obrigatória."),
  ug: z.string().min(1, "UG é obrigatória."),
  dias_operacao: z.coerce.number().min(1, "Dias de Operação deve ser maior que 0."),
  categoria: z.string().min(1, "Categoria é obrigatória."),
  detalhamento: z.string().optional(),
  detalhamento_customizado: z.string().optional(),
  fase_atividade: z.string().optional(),
  // Nota: itens_equipamentos, valor_total, valor_nd_30, valor_nd_39 serão calculados/manipulados separadamente
});

type ClasseIIFormValues = z.infer<typeof ClasseIIFormSchema>;

interface ClasseIIFormProps {
  initialData?: ClasseIIRegistro;
  onSuccess: () => void;
}

export function ClasseIIForm({ initialData, onSuccess }: ClasseIIFormProps) {
  const queryClient = useQueryClient();
  const { pTrab } = usePTrabContext();

  const form = useForm<ClasseIIFormValues>({
    resolver: zodResolver(ClasseIIFormSchema),
    defaultValues: {
      organizacao: initialData?.organizacao || "",
      ug: initialData?.ug || "",
      dias_operacao: initialData?.dias_operacao || 0,
      categoria: initialData?.categoria || "",
      detalhamento: initialData?.detalhamento || "",
      detalhamento_customizado: initialData?.detalhamento_customizado || "",
      fase_atividade: initialData?.fase_atividade || "",
    },
  });

  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

  const mutation = useMutation({
    mutationFn: async (data: ClasseIIFormValues) => {
      const payload = {
        ...data,
        p_trab_id: pTrab.id,
        // Valores de cálculo zerados para inserção/atualização inicial
        valor_total: 0,
        valor_nd_30: 0,
        valor_nd_39: 0,
        itens_equipamentos: initialData?.itens_equipamentos || [], // Manter itens existentes se for update
      };

      if (initialData) {
        // Update
        const { error } = await supabase
          .from("classe_ii_registros")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("classe_ii_registros")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classe_ii_registros", pTrab.id] });
      toast.success(initialData ? "Registro atualizado com sucesso!" : "Registro criado com sucesso!");
      onSuccess();
    },
    onError: (error) => {
      console.error("Erro ao salvar registro de Classe II:", error);
      toast.error("Erro ao salvar registro. Tente novamente.");
    },
  });

  const onSubmit = (values: ClasseIIFormValues) => {
    mutation.mutate(values);
  };

  // Handler para o OmSelector
  const handleOmChange = (omData: OMData | undefined) => {
    if (omData) {
      form.setValue("organizacao", omData.nome_om, { shouldValidate: true });
      form.setValue("ug", omData.codug_om, { shouldValidate: true });
      setSelectedOmId(omData.id);
    } else {
      form.setValue("organizacao", "", { shouldValidate: true });
      form.setValue("ug", "", { shouldValidate: true });
      setSelectedOmId(undefined);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Seletor de OM Principal */}
          <FormField
            control={form.control}
            name="organizacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organização Militar (OM)</FormLabel>
                <FormControl>
                  <OmSelector
                    selectedOmId={selectedOmId}
                    onChange={handleOmChange}
                    placeholder="Selecione a OM executante..."
                    // CORREÇÃO ESTRUTURAL: Usando field.value para garantir o nome salvo
                    currentOmName={field.value}
                    initialOmUg={initialData?.ug}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoria"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Material de Intendência">Material de Intendência</SelectItem>
                    <SelectItem value="Material de Saúde">Material de Saúde</SelectItem>
                    <SelectItem value="Material de Engenharia">Material de Engenharia</SelectItem>
                    <SelectItem value="Material de Comunicações">Material de Comunicações</SelectItem>
                    <SelectItem value="Material de Aviação">Material de Aviação</SelectItem>
                    <SelectItem value="Material de Motomecanização">Material de Motomecanização</SelectItem>
                    <SelectItem value="Material de Remonta e Veterinária">Material de Remonta e Veterinária</SelectItem>
                    <SelectItem value="Material de Sinalização">Material de Sinalização</SelectItem>
                    <SelectItem value="Material de Construção">Material de Construção</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dias_operacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dias de Operação</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="fase_atividade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fase da Atividade</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="detalhamento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Detalhamento (Padrão)</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="detalhamento_customizado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Detalhamento (Customizado)</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : initialData ? (
            "Salvar Alterações"
          ) : (
            "Adicionar Registro"
          )}
        </Button>
      </form>
    </Form>
  );
}