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

// Tipagem do registro de Classe VIII - Saúde
export interface ClasseVIIISaudeRegistro {
  id: string;
  p_trab_id: string;
  organizacao: string; // Nome da OM
  ug: string; // UG da OM
  dias_operacao: number;
  categoria: string; // 'Saúde - KPSI/KPT'
  itens_saude: any; // JSONB
  valor_total: number;
  detalhamento: string | null;
  detalhamento_customizado: string | null;
  fase_atividade: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
}

// Tipagem do registro de Classe VIII - Remonta
export interface ClasseVIIIRemontaRegistro {
  id: string;
  p_trab_id: string;
  organizacao: string; // Nome da OM
  ug: string; // UG da OM
  dias_operacao: number;
  animal_tipo: string;
  quantidade_animais: number;
  itens_remonta: any; // JSONB
  valor_total: number;
  detalhamento: string | null;
  detalhamento_customizado: string | null;
  fase_atividade: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
}

type ClasseVIIIRegistro = ClasseVIIISaudeRegistro | ClasseVIIIRemontaRegistro;

// Esquema de validação Zod base
const ClasseVIIIFormSchemaBase = z.object({
  organizacao: z.string().min(1, "Organização é obrigatória."),
  ug: z.string().min(1, "UG é obrigatória."),
  dias_operacao: z.coerce.number().min(1, "Dias de Operação deve ser maior que 0."),
  detalhamento: z.string().optional(),
  detalhamento_customizado: z.string().optional(),
  fase_atividade: z.string().optional(),
});

// Esquema de validação Zod para Saúde
const ClasseVIIISaudeFormSchema = ClasseVIIIFormSchemaBase.extend({
  categoria: z.literal("Saúde - KPSI/KPT"),
});

// Esquema de validação Zod para Remonta
const ClasseVIIIRemontaFormSchema = ClasseVIIIFormSchemaBase.extend({
  animal_tipo: z.string().min(1, "Tipo de animal é obrigatório."),
  quantidade_animais: z.coerce.number().min(1, "Quantidade deve ser maior que 0."),
});

type ClasseVIIIFormValues = z.infer<typeof ClasseVIIISaudeFormSchema> | z.infer<typeof ClasseVIIIRemontaFormSchema>;

interface ClasseVIIIFormProps {
  initialData?: ClasseVIIIRegistro;
  onSuccess: () => void;
  subClasse: 'saude' | 'remonta';
}

export function ClasseVIIIForm({ initialData, onSuccess, subClasse }: ClasseVIIIFormProps) {
  const queryClient = useQueryClient();
  const { pTrab } = usePTrabContext();

  const isSaude = subClasse === 'saude';
  const schema = isSaude ? ClasseVIIISaudeFormSchema : ClasseVIIIRemontaFormSchema;
  const tableName = isSaude ? "classe_viii_saude_registros" : "classe_viii_remonta_registros";

  const defaultValues = {
    organizacao: initialData?.organizacao || "",
    ug: initialData?.ug || "",
    dias_operacao: initialData?.dias_operacao || 0,
    fase_atividade: initialData?.fase_atividade || "",
    detalhamento: initialData?.detalhamento || "",
    detalhamento_customizado: initialData?.detalhamento_customizado || "",
    ...(isSaude && { categoria: (initialData as ClasseVIIISaudeRegistro)?.categoria || "Saúde - KPSI/KPT" }),
    ...(!isSaude && {
      animal_tipo: (initialData as ClasseVIIIRemontaRegistro)?.animal_tipo || "",
      quantidade_animais: (initialData as ClasseVIIIRemontaRegistro)?.quantidade_animais || 0,
    }),
  };

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues,
  });

  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

  const mutation = useMutation({
    mutationFn: async (data: ClasseVIIIFormValues) => {
      const payload = {
        ...data,
        p_trab_id: pTrab.id,
        valor_total: 0,
        valor_nd_30: 0,
        valor_nd_39: 0,
        ...(isSaude ? { itens_saude: (initialData as ClasseVIIISaudeRegistro)?.itens_saude || [] } : { itens_remonta: (initialData as ClasseVIIIRemontaRegistro)?.itens_remonta || [] }),
      };

      if (initialData) {
        // Update
        const { error } = await supabase
          .from(tableName)
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from(tableName)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, pTrab.id] });
      toast.success(initialData ? "Registro atualizado com sucesso!" : "Registro criado com sucesso!");
      onSuccess();
    },
    onError: (error) => {
      console.error(`Erro ao salvar registro de Classe VIII (${subClasse}):`, error);
      toast.error("Erro ao salvar registro. Tente novamente.");
    },
  });

  const onSubmit = (values: ClasseVIIIFormValues) => {
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
                    // CORREÇÃO: Passando o nome inicial para exibição em modo de edição
                    initialOmName={initialData?.organizacao}
                    initialOmUg={initialData?.ug}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isSaude ? (
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
                      <SelectItem value="Saúde - KPSI/KPT">Saúde - KPSI/KPT</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="animal_tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Animal</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Cavalo">Cavalo</SelectItem>
                      <SelectItem value="Mula">Mula</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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
          {!isSaude && (
            <FormField
              control={form.control}
              name="quantidade_animais"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de Animais</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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