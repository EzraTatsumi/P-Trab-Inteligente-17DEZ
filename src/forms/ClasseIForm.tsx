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

// Tipagem do registro de Classe I
export interface ClasseIRegistro {
  id: string;
  p_trab_id: string;
  organizacao: string; // Nome da OM
  ug: string; // UG da OM
  om_qs: string; // Nome da OM QS
  ug_qs: string; // UG da OM QS
  efetivo: number;
  dias_operacao: number;
  nr_ref_int: number;
  valor_qs: number;
  valor_qr: number;
  complemento_qs: number;
  etapa_qs: number;
  total_qs: number;
  complemento_qr: number;
  etapa_qr: number;
  total_qr: number;
  total_geral: number;
  fase_atividade: string;
  memoria_calculo_qs_customizada: string | null;
  memoria_calculo_qr_customizada: string | null;
  categoria: 'RACAO_QUENTE' | 'R2' | 'R3';
  quantidade_r2: number;
  quantidade_r3: number;
}

// Esquema de validação Zod
const ClasseIFormSchema = z.object({
  organizacao: z.string().min(1, "Organização é obrigatória."),
  ug: z.string().min(1, "UG é obrigatória."),
  om_qs: z.string().min(1, "OM de Quota Suplementar é obrigatória."),
  ug_qs: z.string().min(1, "UG da OM QS é obrigatória."),
  efetivo: z.coerce.number().min(1, "Efetivo deve ser maior que 0."),
  dias_operacao: z.coerce.number().min(1, "Dias de Operação deve ser maior que 0."),
  nr_ref_int: z.coerce.number().min(1, "Nr Ref Int deve ser maior que 0."),
  categoria: z.enum(['RACAO_QUENTE', 'R2', 'R3']),
  quantidade_r2: z.coerce.number().min(0).optional(),
  quantidade_r3: z.coerce.number().min(0).optional(),
  fase_atividade: z.string().optional(),
  memoria_calculo_qs_customizada: z.string().optional(),
  memoria_calculo_qr_customizada: z.string().optional(),
});

type ClasseIFormValues = z.infer<typeof ClasseIFormSchema>;

interface ClasseIFormProps {
  initialData?: ClasseIRegistro;
  onSuccess: () => void;
}

export function ClasseIForm({ initialData, onSuccess }: ClasseIFormProps) {
  const queryClient = useQueryClient();
  const { pTrab } = usePTrabContext();

  const form = useForm<ClasseIFormValues>({
    resolver: zodResolver(ClasseIFormSchema),
    defaultValues: {
      organizacao: initialData?.organizacao || "",
      ug: initialData?.ug || "",
      om_qs: initialData?.om_qs || "",
      ug_qs: initialData?.ug_qs || "",
      efetivo: initialData?.efetivo || 0,
      dias_operacao: initialData?.dias_operacao || 0,
      nr_ref_int: initialData?.nr_ref_int || 0,
      categoria: initialData?.categoria || 'RACAO_QUENTE',
      quantidade_r2: initialData?.quantidade_r2 || 0,
      quantidade_r3: initialData?.quantidade_r3 || 0,
      fase_atividade: initialData?.fase_atividade || "",
      memoria_calculo_qs_customizada: initialData?.memoria_calculo_qs_customizada || "",
      memoria_calculo_qr_customizada: initialData?.memoria_calculo_qr_customizada || "",
    },
  });

  // Estado para armazenar os IDs das OMs selecionadas (não persistidos no DB, apenas para o OmSelector)
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [selectedOmQsId, setSelectedOmQsId] = useState<string | undefined>(undefined);

  // Efeito para inicializar os IDs se estivermos em modo de edição
  useEffect(() => {
    if (initialData) {
      // Nota: A tabela classe_i_registros não armazena o ID da OM, apenas o nome e UG.
      // Para que o OmSelector funcione corretamente em modo de edição, precisamos de uma forma
      // de mapear o nome/UG de volta para um ID, ou aceitar que o OmSelector exibirá o nome
      // via `currentOmName` (que é o que faremos).
      // Não podemos definir selectedOmId/selectedOmQsId aqui, pois não temos o ID no initialData.
    }
  }, [initialData]);

  const mutation = useMutation({
    mutationFn: async (data: ClasseIFormValues) => {
      const payload = {
        ...data,
        p_trab_id: pTrab.id,
        // Campos de cálculo (devem ser calculados no backend ou em um hook de cálculo, mas por simplicidade, vamos zerar aqui)
        valor_qs: 0,
        valor_qr: 0,
        complemento_qs: 0,
        etapa_qs: 0,
        total_qs: 0,
        complemento_qr: 0,
        etapa_qr: 0,
        total_qr: 0,
        total_geral: 0,
      };

      if (initialData) {
        // Update
        const { error } = await supabase
          .from("classe_i_registros")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("classe_i_registros")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classe_i_registros", pTrab.id] });
      toast.success(initialData ? "Registro atualizado com sucesso!" : "Registro criado com sucesso!");
      onSuccess();
    },
    onError: (error) => {
      console.error("Erro ao salvar registro de Classe I:", error);
      toast.error("Erro ao salvar registro. Tente novamente.");
    },
  });

  const onSubmit = (values: ClasseIFormValues) => {
    mutation.mutate(values);
  };

  // Handlers para o OmSelector
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

  const handleOmQsChange = (omData: OMData | undefined) => {
    if (omData) {
      form.setValue("om_qs", omData.nome_om, { shouldValidate: true });
      form.setValue("ug_qs", omData.codug_om, { shouldValidate: true });
      setSelectedOmQsId(omData.id);
    } else {
      form.setValue("om_qs", "", { shouldValidate: true });
      form.setValue("ug_qs", "", { shouldValidate: true });
      setSelectedOmQsId(undefined);
    }
  };

  const isRacaoQuente = form.watch('categoria') === 'RACAO_QUENTE';

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

          {/* Seletor de OM de Quota Suplementar (OM QS) */}
          <FormField
            control={form.control}
            name="om_qs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OM de Quota Suplementar (OM QS)</FormLabel>
                <FormControl>
                  <OmSelector
                    selectedOmId={selectedOmQsId}
                    onChange={handleOmQsChange}
                    placeholder="Selecione uma OM de Destino..."
                    // CORREÇÃO ESTRUTURAL: Usando field.value para garantir o nome salvo
                    currentOmName={field.value}
                    initialOmUg={initialData?.ug_qs}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="efetivo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Efetivo</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
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
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nr_ref_int"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nr Ref Int</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
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
                    <SelectItem value="RACAO_QUENTE">Ração Quente (QS/QR)</SelectItem>
                    <SelectItem value="R2">R2</SelectItem>
                    <SelectItem value="R3">R3</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!isRacaoQuente && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantidade_r2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade R2</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantidade_r3"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade R3</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

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

        {isRacaoQuente && (
          <>
            <FormField
              control={form.control}
              name="memoria_calculo_qs_customizada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memória de Cálculo QS (Customizada)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="memoria_calculo_qr_customizada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Memória de Cálculo QR (Customizada)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

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