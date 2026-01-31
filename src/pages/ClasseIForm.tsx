import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { sanitizeError } from "@/lib/errorUtils";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, PlusCircle, Save, ArrowLeft } from "lucide-react";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { usePTrabContext } from "@/context/PTrabContext";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { defaultClasseIConfig } from "@/data/classeIData";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Tipos
type ClasseIRegistro = Tables<'classe_i_registros'>;
type ClasseIInsert = TablesInsert<'classe_i_registros'>;
type DiretrizCusteio = Tables<'diretrizes_custeio'>;

// Esquema Zod para um item de Classe I
const ClasseIItemSchema = z.object({
  id: z.string().optional(),
  organizacao: z.string().min(1, "Organização é obrigatória"),
  ug: z.string().min(1, "UG é obrigatória"),
  om_qs: z.string().min(1, "OM QS é obrigatória"),
  ug_qs: z.string().min(1, "UG QS é obrigatória"),
  efetivo: z.coerce.number().min(1, "Efetivo deve ser maior que zero"),
  dias_operacao: z.coerce.number().min(1, "Dias de Operação deve ser maior que zero"),
  nr_ref_int: z.coerce.number().min(1, "Nr Ref Int é obrigatório"),
  categoria: z.enum(['RACAO_QUENTE', 'RACAO_OPERACIONAL']),
  quantidade_r2: z.coerce.number().min(0, "Quantidade R2 não pode ser negativa").optional(),
  quantidade_r3: z.coerce.number().min(0, "Quantidade R3 não pode ser negativa").optional(),
  
  // Campos de cálculo (armazenados como string de dígitos brutos para o formulário)
  valor_qs: z.string().optional(),
  valor_qr: z.string().optional(),
  complemento_qs: z.string().optional(),
  etapa_qs: z.string().optional(),
  total_qs: z.string().optional(),
  complemento_qr: z.string().optional(),
  etapa_qr: z.string().optional(),
  total_qr: z.string().optional(),
  total_geral: z.string().optional(),
  
  fase_atividade: z.string().optional(),
  memoria_calculo_qs_customizada: z.string().optional(),
  memoria_calculo_qr_customizada: z.string().optional(),
  memoria_calculo_op_customizada: z.string().optional(),
});

// Esquema Zod para o formulário completo
const ClasseIFormSchema = z.object({
  registros: z.array(ClasseIItemSchema),
});

type ClasseIFormValues = z.infer<typeof ClasseIFormSchema>;

// Hook para buscar diretrizes de custeio
const useDiretrizesCusteio = (year: number | null) => {
  return useQuery<DiretrizCusteio | null, Error>({
    queryKey: ['diretrizesCusteio', year],
    enabled: !!year,
    queryFn: async () => {
      if (!year) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { data, error } = await supabase
        .from('diretrizes_custeio')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .maybeSingle();
        
      if (error) {
        console.error("Erro ao buscar diretriz de custeio:", error);
        throw new Error(`Falha ao buscar diretrizes de custeio para o ano ${year}.`);
      }
      
      if (!data) {
        toast.warning(`Diretrizes de Custeio não encontradas para o ano ${year}. Usando valores padrão.`);
        return null;
      }
      
      return data;
    },
  });
};

// Hook para buscar registros existentes
const useClasseIRecords = (ptrabId: string) => {
  return useQuery<ClasseIRegistro[], Error>({
    queryKey: ['classeIRecords', ptrabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classe_i_registros')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return data as ClasseIRegistro[];
    },
  });
};

// Componente principal
export const ClasseIForm = () => {
  const { ptrabId } = useParams<{ ptrabId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPTrab } = usePTrabContext();
  const { handleEnterToNextField } = useFormNavigation();

  const [anoReferencia, setAnoReferencia] = useState<number | null>(null);
  const [isFetchingYear, setIsFetchingYear] = useState(true);

  // 1. Determinar o ano de referência
  useEffect(() => {
    const fetchYear = async () => {
      setIsFetchingYear(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Tenta buscar o ano padrão de logística do perfil
        const { data: profileData } = await supabase
          .from("profiles")
          .select("default_logistica_year") // Corrigido para default_logistica_year
          .eq("id", user.id)
          .maybeSingle();

        if (profileData?.default_logistica_year) {
          anoReferencia = profileData.default_logistica_year;
        } else {
          // Se não houver, usa o ano atual como fallback
          anoReferencia = new Date().getFullYear();
        }
        
        setAnoReferencia(anoReferencia);
      } catch (error) {
        console.error("Erro ao buscar ano de referência:", error);
        setAnoReferencia(new Date().getFullYear()); // Fallback
      } finally {
        setIsFetchingYear(false);
      }
    };
    fetchYear();
  }, []);

  const { data: diretrizData, isLoading: isLoadingDiretriz } = useDiretrizesCusteio(anoReferencia);
  const { data: records, isLoading: isLoadingRecords } = useClasseIRecords(ptrabId || "");

  const isLoading = isLoadingRecords || isLoadingDiretriz || isFetchingYear;

  // Valores unitários da diretriz
  const valorQs = diretrizData?.classe_i_valor_qs || defaultClasseIConfig.valor_qs_padrao;
  const valorQr = diretrizData?.classe_i_valor_qr || defaultClasseIConfig.valor_qr_padrao;

  // 2. Inicialização do Formulário
  const form = useForm<ClasseIFormValues>({
    resolver: zodResolver(ClasseIFormSchema),
    defaultValues: {
      registros: [],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "registros",
  });

  useEffect(() => {
    if (records && records.length > 0) {
      const formattedRecords: ClasseIFormValues['registros'] = records.map(record => ({
        ...record,
        // Converte números para strings de dígitos brutos para o formulário
        valor_qs: numberToRawDigits(record.valor_qs),
        valor_qr: numberToRawDigits(record.valor_qr),
        complemento_qs: numberToRawDigits(record.complemento_qs),
        etapa_qs: numberToRawDigits(record.etapa_qs),
        total_qs: numberToRawDigits(record.total_qs),
        complemento_qr: numberToRawDigits(record.complemento_qr),
        etapa_qr: numberToRawDigits(record.etapa_qr),
        total_qr: numberToRawDigits(record.total_qr),
        total_geral: numberToRawDigits(record.total_geral),
      }));
      form.reset({ registros: formattedRecords });
    } else if (!isLoadingRecords && !ptrabId) {
      // Adiciona um registro vazio se não houver registros e não estiver carregando
      append({
        ...defaultClasseIConfig.registro_vazio,
        valor_qs: numberToRawDigits(valorQs),
        valor_qr: numberToRawDigits(valorQr),
      });
    }
  }, [records, isLoadingRecords, ptrabId, form, append, valorQs, valorQr]);

  // 3. Lógica de Cálculo
  const calculateValues = (item: ClasseIFormValues['registros'][number], index: number) => {
    const efetivo = item.efetivo || 0;
    const dias = item.dias_operacao || 0;
    const nrRefInt = item.nr_ref_int || 0;
    const categoria = item.categoria;

    // Valores unitários (usando os valores da diretriz ou padrão)
    const vQs = valorQs;
    const vQr = valorQr;

    let valor_qs_calc = 0;
    let valor_qr_calc = 0;
    let complemento_qs_calc = 0;
    let complemento_qr_calc = 0;
    let etapa_qs_calc = 0;
    let etapa_qr_calc = 0;
    let total_qs_calc = 0;
    let total_qr_calc = 0;
    let total_geral_calc = 0;
    
    let memoria_calculo_qs = "";
    let memoria_calculo_qr = "";
    let memoria_calculo_op = "";

    if (categoria === 'RACAO_QUENTE') {
      // QS (Ração Quente)
      valor_qs_calc = efetivo * dias * vQs;
      complemento_qs_calc = 0; // Não se aplica
      etapa_qs_calc = 0; // Não se aplica
      total_qs_calc = valor_qs_calc;
      
      memoria_calculo_qs = `${efetivo} (Efetivo) x ${dias} (Dias) x R$ ${vQs.toFixed(2)} (Valor QS) = R$ ${total_qs_calc.toFixed(2)}`;

      // QR (Ração de Reserva)
      valor_qr_calc = efetivo * dias * vQr;
      complemento_qr_calc = 0; // Não se aplica
      etapa_qr_calc = 0; // Não se aplica
      total_qr_calc = valor_qr_calc;
      
      memoria_calculo_qr = `${efetivo} (Efetivo) x ${dias} (Dias) x R$ ${vQr.toFixed(2)} (Valor QR) = R$ ${total_qr_calc.toFixed(2)}`;
      
      total_geral_calc = total_qs_calc + total_qr_calc;
      
    } else if (categoria === 'RACAO_OPERACIONAL') {
      const qtdR2 = item.quantidade_r2 || 0;
      const qtdR3 = item.quantidade_r3 || 0;
      
      // Ração Operacional (R2 e R3)
      const valorR2 = qtdR2 * defaultClasseIConfig.valor_r2_padrao;
      const valorR3 = qtdR3 * defaultClasseIConfig.valor_r3_padrao;
      
      total_geral_calc = valorR2 + valorR3;
      
      memoria_calculo_op = `${qtdR2} (R2) x R$ ${defaultClasseIConfig.valor_r2_padrao.toFixed(2)} + ${qtdR3} (R3) x R$ ${defaultClasseIConfig.valor_r3_padrao.toFixed(2)} = R$ ${total_geral_calc.toFixed(2)}`;
      
      // Zera os campos de QS/QR para Ração Operacional
      valor_qs_calc = 0;
      valor_qr_calc = 0;
      total_qs_calc = 0;
      total_qr_calc = 0;
      memoria_calculo_qs = "";
      memoria_calculo_qr = "";
    }

    // Atualiza os campos calculados no formulário
    form.setValue(`registros.${index}.valor_qs`, numberToRawDigits(valor_qs_calc));
    form.setValue(`registros.${index}.valor_qr`, numberToRawDigits(valor_qr_calc));
    form.setValue(`registros.${index}.complemento_qs`, numberToRawDigits(complemento_qs_calc));
    form.setValue(`registros.${index}.etapa_qs`, numberToRawDigits(etapa_qs_calc));
    form.setValue(`registros.${index}.total_qs`, numberToRawDigits(total_qs_calc));
    form.setValue(`registros.${index}.complemento_qr`, numberToRawDigits(complemento_qr_calc));
    form.setValue(`registros.${index}.etapa_qr`, numberToRawDigits(etapa_qr_calc));
    form.setValue(`registros.${index}.total_qr`, numberToRawDigits(total_qr_calc));
    form.setValue(`registros.${index}.total_geral`, numberToRawDigits(total_geral_calc));
    
    // Atualiza as memórias de cálculo (se não houver customização)
    if (!item.memoria_calculo_qs_customizada) {
        form.setValue(`registros.${index}.memoria_calculo_qs_customizada`, categoria === 'RACAO_QUENTE' ? memoria_calculo_qs : null);
    }
    if (!item.memoria_calculo_qr_customizada) {
        form.setValue(`registros.${index}.memoria_calculo_qr_customizada`, categoria === 'RACAO_QUENTE' ? memoria_calculo_qr : null);
    }
    if (!item.memoria_calculo_op_customizada) {
        form.setValue(`registros.${index}.memoria_calculo_op_customizada`, categoria === 'RACAO_OPERACIONAL' ? memoria_calculo_op : null);
    }
  };

  // Observa mudanças nos campos que afetam o cálculo
  form.watch((data, { name, type }) => {
    if (name && name.startsWith('registros.')) {
      const indexMatch = name.match(/registros\.(\d+)\./);
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10);
        const item = data.registros?.[index];
        if (item) {
          // Recalcula se os campos chave mudarem
          if (name.endsWith('.efetivo') || name.endsWith('.dias_operacao') || name.endsWith('.categoria') || name.endsWith('.quantidade_r2') || name.endsWith('.quantidade_r3')) {
            calculateValues(item, index);
          }
        }
      }
    }
  });

  // 4. Mutação (Salvar/Atualizar)
  const saveMutation = useMutation({
    mutationFn: async (data: ClasseIFormValues) => {
      if (!ptrabId) throw new Error("ID do PTrab não encontrado.");

      await updatePTrabStatusIfAberto(ptrabId);

      const updates = data.registros.map(item => {
        // Converte strings de dígitos brutos de volta para números para o Supabase
        const baseData: Partial<ClasseIInsert> = {
          p_trab_id: ptrabId,
          organizacao: item.organizacao,
          ug: item.ug,
          om_qs: item.om_qs,
          ug_qs: item.ug_qs,
          efetivo: item.efetivo,
          dias_operacao: item.dias_operacao,
          nr_ref_int: item.nr_ref_int,
          categoria: item.categoria,
          quantidade_r2: item.quantidade_r2 || 0,
          quantidade_r3: item.quantidade_r3 || 0,
          fase_atividade: item.fase_atividade,
          memoria_calculo_qs_customizada: item.memoria_calculo_qs_customizada,
          memoria_calculo_qr_customizada: item.memoria_calculo_qr_customizada,
          memoria_calculo_op_customizada: item.memoria_calculo_op_customizada,
          
          // Campos calculados (convertidos de string de dígitos brutos para number)
          valor_qs: formatCurrencyInput(item.valor_qs || "0").numericValue,
          valor_qr: formatCurrencyInput(item.valor_qr || "0").numericValue,
          complemento_qs: formatCurrencyInput(item.complemento_qs || "0").numericValue,
          etapa_qs: formatCurrencyInput(item.etapa_qs || "0").numericValue,
          total_qs: formatCurrencyInput(item.total_qs || "0").numericValue,
          complemento_qr: formatCurrencyInput(item.complemento_qr || "0").numericValue,
          etapa_qr: formatCurrencyInput(item.etapa_qr || "0").numericValue,
          total_qr: formatCurrencyInput(item.total_qr || "0").numericValue,
          total_geral: formatCurrencyInput(item.total_geral || "0").numericValue,
        };

        if (item.id) {
          // Atualiza
          return supabase
            .from('classe_i_registros')
            .update(baseData)
            .eq('id', item.id)
            .select()
            .single();
        } else {
          // Insere
          return supabase
            .from('classe_i_registros')
            .insert(baseData as ClasseIInsert)
            .select()
            .single();
        }
      });

      const results = await Promise.all(updates);
      
      // Verifica se houve erros em alguma operação
      const errors = results.filter(res => res.error).map(res => res.error);
      if (errors.length > 0) {
        throw new Error(`Erro ao salvar um ou mais registros: ${errors[0]?.message}`);
      }
      
      return results.map(res => res.data) as ClasseIRegistro[];
    },
    onSuccess: (data) => {
      toast.success("Registros de Classe I salvos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['classeIRecords', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['ptrabData', ptrabId] });
      // Atualiza o formulário com os IDs retornados (se houver novos inserts)
      const formattedRecords: ClasseIFormValues['registros'] = data.map(record => ({
        ...record,
        valor_qs: numberToRawDigits(record.valor_qs),
        valor_qr: numberToRawDigits(record.valor_qr),
        complemento_qs: numberToRawDigits(record.complemento_qs),
        etapa_qs: numberToRawDigits(record.etapa_qs),
        total_qs: numberToRawDigits(record.total_qs),
        complemento_qr: numberToRawDigits(record.complemento_qr),
        etapa_qr: numberToRawDigits(record.etapa_qr),
        total_qr: numberToRawDigits(record.total_qr),
        total_geral: numberToRawDigits(record.total_geral),
      }));
      form.reset({ registros: formattedRecords });
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });
  
  // 5. Mutação (Deletar)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('classe_i_registros')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['classeIRecords', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['ptrabData', ptrabId] });
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const onSubmit = (data: ClasseIFormValues) => {
    saveMutation.mutate(data);
  };
  
  const handleRemove = (index: number, id?: string) => {
    if (id) {
      deleteMutation.mutate(id);
    }
    remove(index);
  };
  
  const handleAdd = () => {
    append({
      ...defaultClasseIConfig.registro_vazio,
      valor_qs: numberToRawDigits(valorQs),
      valor_qr: numberToRawDigits(valorQr),
    });
  };
  
  const totalGeralCalculado = useMemo(() => {
    return fields.reduce((sum, item) => {
      const totalGeralRaw = form.getValues(`registros.${fields.findIndex(f => f.id === item.id) || 0}.total_geral`);
      const numericValue = formatCurrencyInput(totalGeralRaw || "0").numericValue;
      return sum + numericValue;
    }, 0);
  }, [fields, form.watch('registros')]); // Re-calcula quando os registros mudam

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Classe I - Suprimento</h1>
        <Button variant="outline" onClick={() => navigate(`/ptrab/${ptrabId}`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao P Trab
        </Button>
      </div>
      
      <Alert variant="default">
        <AlertTitle className="flex items-center gap-2">
            <span className="font-semibold">Diretrizes de Custeio (Ano {anoReferencia})</span>
        </AlertTitle>
        <AlertDescription>
            Valor QS (Ração Quente): R$ {valorQs.toFixed(2)} | 
            Valor QR (Ração de Reserva): R$ {valorQr.toFixed(2)}
            {diretrizData ? (
                <span className="ml-4 text-green-700"> (Valores personalizados)</span>
            ) : (
                <span className="ml-4 text-red-700"> (Valores padrão - Cadastre em Configurações)</span>
            )}
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {fields.map((field, index) => (
            <Card key={field.id} className="border-l-4 border-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                  Registro {index + 1}
                </CardTitle>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemove(index, field.id)}
                  disabled={saveMutation.isPending || deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name={`registros.${index}.organizacao`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>Organização</FormLabel>
                        <FormControl>
                          <Input {...formField} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`registros.${index}.ug`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>UG</FormLabel>
                        <FormControl>
                          <Input {...formField} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`registros.${index}.om_qs`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>OM QS</FormLabel>
                        <FormControl>
                          <Input {...formField} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`registros.${index}.ug_qs`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>UG QS</FormLabel>
                        <FormControl>
                          <Input {...formField} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                        control={form.control}
                        name={`registros.${index}.categoria`}
                        render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel>Categoria</FormLabel>
                                <Select onValueChange={formField.onChange} defaultValue={formField.value} disabled={saveMutation.isPending}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a categoria" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="RACAO_QUENTE">Ração Quente / Reserva (QS/QR)</SelectItem>
                                        <SelectItem value="RACAO_OPERACIONAL">Ração Operacional (R2/R3)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`registros.${index}.efetivo`}
                        render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel>Efetivo</FormLabel>
                                <FormControl>
                                    <Input type="number" {...formField} onChange={e => formField.onChange(e.target.value)} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`registros.${index}.dias_operacao`}
                        render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel>Dias de Operação</FormLabel>
                                <FormControl>
                                    <Input type="number" {...formField} onChange={e => formField.onChange(e.target.value)} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`registros.${index}.nr_ref_int`}
                        render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel>Nr Ref Int</FormLabel>
                                <FormControl>
                                    <Input type="number" {...formField} onChange={e => formField.onChange(e.target.value)} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                {form.watch(`registros.${index}.categoria`) === 'RACAO_OPERACIONAL' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                            control={form.control}
                            name={`registros.${index}.quantidade_r2`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel>Qtd Ração Operacional R2</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...formField} onChange={e => formField.onChange(e.target.value)} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`registros.${index}.quantidade_r3`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel>Qtd Ração Operacional R3</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...formField} onChange={e => formField.onChange(e.target.value)} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                <Separator className="my-4" />
                
                {/* Campos de Cálculo e Detalhamento */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField
                        control={form.control}
                        name={`registros.${index}.fase_atividade`}
                        render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel>Fase da Atividade</FormLabel>
                                <FormControl>
                                    <Input {...formField} onKeyDown={handleEnterToNextField} disabled={saveMutation.isPending} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <div className="space-y-2 col-span-2 md:col-span-1">
                        <FormLabel>Total Geral (R$)</FormLabel>
                        <Input 
                            value={formatCurrencyInput(form.watch(`registros.${index}.total_geral`) || "0").formatted}
                            disabled
                            className="font-bold text-lg bg-gray-100"
                        />
                    </div>
                </div>
                
                {form.watch(`registros.${index}.categoria`) === 'RACAO_QUENTE' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name={`registros.${index}.memoria_calculo_qs_customizada`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel>Memória de Cálculo QS (Ração Quente)</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            {...formField} 
                                            placeholder={form.watch(`registros.${index}.memoria_calculo_qs_customizada`) || "Cálculo automático..."}
                                            disabled={saveMutation.isPending} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`registros.${index}.memoria_calculo_qr_customizada`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel>Memória de Cálculo QR (Ração de Reserva)</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            {...formField} 
                                            placeholder={form.watch(`registros.${index}.memoria_calculo_qr_customizada`) || "Cálculo automático..."}
                                            disabled={saveMutation.isPending} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1">
                        <FormField
                            control={form.control}
                            name={`registros.${index}.memoria_calculo_op_customizada`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel>Memória de Cálculo Ração Operacional (R2/R3)</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            {...formField} 
                                            placeholder={form.watch(`registros.${index}.memoria_calculo_op_customizada`) || "Cálculo automático..."}
                                            disabled={saveMutation.isPending} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}
                
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleAdd}
              disabled={saveMutation.isPending || deleteMutation.isPending}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar Registro
            </Button>
            
            <div className="flex items-center gap-4">
                <span className="text-xl font-semibold">
                    Total Classe I: {formatCurrencyInput(numberToRawDigits(totalGeralCalculado)).formatted}
                </span>
                <Button type="submit" disabled={saveMutation.isPending || deleteMutation.isPending} className="gap-2">
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Classe I
                </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};