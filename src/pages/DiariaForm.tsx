import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Plus, Trash2, Loader2, Save, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { sanitizeError } from "@/lib/errorUtils";
import { formatCurrency, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { fetchPTrabDetails, fetchPTrabDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { fetchUserOMs } from "@/lib/omUtils";

// --- Configuração de Diárias (Deve ser mantida em sincronia com CustosOperacionaisPage) ---
const DIARIA_RANKS_CONFIG = [
  { key: 'of_gen', label: 'Of Gen' },
  { key: 'of_sup', label: 'Of Sup' },
  { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt' },
  { key: 'demais_pracas', label: 'Demais Praças' },
];

const DIARIA_DESTINOS = [
  { key: 'bsb', label: 'BSB/MAO/RJ/SP' },
  { key: 'capitais', label: 'Demais Capitais' },
  { key: 'demais', label: 'Demais Dslc' },
];

// --- Tipagem e Schema Zod ---

// Schema para um registro individual de diária
const diariaRegistroSchema = z.object({
  id: z.string().optional(),
  organizacao: z.string().min(1, "Organização é obrigatória."),
  ug: z.string().min(1, "UG é obrigatória."),
  om_detentora: z.string().optional().nullable(),
  ug_detentora: z.string().optional().nullable(),
  
  dias_operacao: z.coerce.number().int().min(1, "Dias de operação deve ser no mínimo 1."),
  fase_atividade: z.string().optional().nullable(),
  
  posto_graduacao: z.enum(DIARIA_RANKS_CONFIG.map(r => r.key) as [string, ...string[]], {
    required_error: "Posto/Graduação é obrigatório.",
  }),
  destino: z.enum(DIARIA_DESTINOS.map(d => d.key) as [string, ...string[]], {
    required_error: "Destino é obrigatório.",
  }),
  quantidade: z.coerce.number().int().min(1, "Quantidade deve ser no mínimo 1."),
  
  // Campos calculados (armazenados no DB)
  valor_diaria_unitario: z.number().min(0),
  valor_taxa_embarque: z.number().min(0),
  valor_total: z.number().min(0),
  valor_nd_30: z.number().min(0),
  valor_nd_39: z.number().min(0),
  
  detalhamento: z.string().optional().nullable(),
  detalhamento_customizado: z.string().optional().nullable(),
});

// Schema principal do formulário
const formSchema = z.object({
  registros: z.array(diariaRegistroSchema),
});

type DiariaRegistro = z.infer<typeof diariaRegistroSchema>;
type FormValues = z.infer<typeof formSchema>;

const DiariaForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const recordId = searchParams.get('recordId');
  const queryClient = useQueryClient();
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // --- Queries de Dados ---
  
  // 1. Detalhes do PTrab (para dias de operação)
  const { data: ptrabDetails, isLoading: isLoadingPTrab } = useQuery({
    queryKey: ['ptrabDetails', ptrabId],
    queryFn: () => fetchPTrabDetails(ptrabId!),
    enabled: !!ptrabId,
  });
  
  // 2. Diretrizes Operacionais (para valores de diária e taxa de embarque)
  const { data: diretrizes, isLoading: isLoadingDiretrizes } = useQuery({
    queryKey: ['diretrizesOperacionais', ptrabDetails?.ano_referencia],
    queryFn: () => fetchPTrabDiretrizesOperacionais(ptrabDetails?.ano_referencia!),
    enabled: !!ptrabDetails?.ano_referencia,
  });
  
  // 3. Organizações Militares do Usuário
  const { data: userOMs, isLoading: isLoadingOMs } = useQuery({
    queryKey: ['userOMs'],
    queryFn: fetchUserOMs,
  });
  
  // 4. Registros existentes (se estiver editando)
  const { data: existingRecords, isLoading: isLoadingRecords, refetch } = useQuery({
    queryKey: ['diariaRecords', ptrabId],
    queryFn: async () => {
      if (!ptrabId) return [];
      
      const { data, error } = await supabase
        .from('diaria_registros')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return data as DiariaRegistro[];
    },
    enabled: !!ptrabId,
    initialData: [],
  });
  
  // --- Configuração do Formulário ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registros: existingRecords.length > 0 ? existingRecords : [{
        id: undefined,
        organizacao: userOMs?.[0]?.nome_om || '',
        ug: userOMs?.[0]?.codug_om || '',
        om_detentora: userOMs?.[0]?.nome_om || '',
        ug_detentora: userOMs?.[0]?.codug_om || '',
        dias_operacao: ptrabDetails?.dias_operacao || 1,
        fase_atividade: '',
        posto_graduacao: DIARIA_RANKS_CONFIG[0].key as DiariaRegistro['posto_graduacao'],
        destino: DIARIA_DESTINOS[0].key as DiariaRegistro['destino'],
        quantidade: 1,
        valor_diaria_unitario: 0,
        valor_taxa_embarque: 0,
        valor_total: 0,
        valor_nd_30: 0,
        valor_nd_39: 0,
        detalhamento: '',
        detalhamento_customizado: '',
      }],
    },
    values: {
      registros: existingRecords.length > 0 ? existingRecords : [{
        id: undefined,
        organizacao: userOMs?.[0]?.nome_om || '',
        ug: userOMs?.[0]?.codug_om || '',
        om_detentora: userOMs?.[0]?.nome_om || '',
        ug_detentora: userOMs?.[0]?.codug_om || '',
        dias_operacao: ptrabDetails?.dias_operacao || 1,
        fase_atividade: '',
        posto_graduacao: DIARIA_RANKS_CONFIG[0].key as DiariaRegistro['posto_graduacao'],
        destino: DIARIA_DESTINOS[0].key as DiariaRegistro['destino'],
        quantidade: 1,
        valor_diaria_unitario: 0,
        valor_taxa_embarque: 0,
        valor_total: 0,
        valor_nd_30: 0,
        valor_nd_39: 0,
        detalhamento: '',
        detalhamento_customizado: '',
      }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "registros",
  });
  
  // --- Lógica de Cálculo ---
  
  // Função para obter o valor unitário da diária com base nas diretrizes
  const getDiariaUnitario = (posto_graduacao: string, destino: string): number => {
    if (!diretrizes) return 0;
    
    const key = `diaria_${posto_graduacao}_${destino}` as keyof typeof diretrizes;
    return diretrizes[key] as number || 0;
  };
  
  // Efeito para recalcular totais e atualizar dias de operação quando dados mudam
  useEffect(() => {
    if (!ptrabDetails || !diretrizes) return;
    
    const currentRegistros = form.getValues('registros');
    const updatedRegistros = currentRegistros.map(registro => {
      
      // 1. Atualizar dias de operação
      const dias_operacao = ptrabDetails.dias_operacao;
      
      // 2. Obter valores unitários
      const valor_diaria_unitario = getDiariaUnitario(registro.posto_graduacao, registro.destino);
      const valor_taxa_embarque = diretrizes.taxa_embarque || 0;
      
      // 3. Calcular totais
      const subtotal_diarias = valor_diaria_unitario * registro.quantidade * dias_operacao;
      
      // A taxa de embarque é aplicada por pessoa (quantidade) e é um custo único, não por dia.
      // Assumimos que a taxa de embarque é um custo GND 3 (Custeio)
      const total_taxa_embarque = valor_taxa_embarque * registro.quantidade;
      
      const valor_total = subtotal_diarias + total_taxa_embarque;
      
      // Diárias e Taxa de Embarque são GND 3 (Custeio)
      const valor_nd_30 = valor_total;
      const valor_nd_39 = 0; // Diárias não são GND 4
      
      return {
        ...registro,
        dias_operacao,
        valor_diaria_unitario,
        valor_taxa_embarque,
        valor_total,
        valor_nd_30,
        valor_nd_39,
      };
    });
    
    form.setValue('registros', updatedRegistros, { shouldDirty: true });
    
  }, [ptrabDetails, diretrizes, form.watch('registros').map(r => r.posto_graduacao + r.destino + r.quantidade).join('-')]); // Dependências que forçam o recálculo

  // --- Funções de Manipulação de Dados ---
  
  const handleSave = async (data: FormValues) => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado.");
      return;
    }
    
    try {
      const recordsToInsert: TablesInsert<'diaria_registros'>[] = [];
      const recordsToUpdate: TablesUpdate<'diaria_registros'>[] = [];
      
      data.registros.forEach(registro => {
        const baseRecord = {
          p_trab_id: ptrabId,
          organizacao: registro.organizacao,
          ug: registro.ug,
          om_detentora: registro.om_detentora,
          ug_detentora: registro.ug_detentora,
          dias_operacao: registro.dias_operacao,
          fase_atividade: registro.fase_atividade,
          posto_graduacao: registro.posto_graduacao,
          destino: registro.destino,
          quantidade: registro.quantidade,
          valor_diaria_unitario: registro.valor_diaria_unitario,
          valor_taxa_embarque: registro.valor_taxa_embarque,
          valor_total: registro.valor_total,
          valor_nd_30: registro.valor_nd_30,
          valor_nd_39: registro.valor_nd_39,
          detalhamento: registro.detalhamento,
          detalhamento_customizado: registro.detalhamento_customizado,
        };
        
        if (registro.id) {
          recordsToUpdate.push({ ...baseRecord, id: registro.id });
        } else {
          recordsToInsert.push(baseRecord);
        }
      });
      
      if (recordsToInsert.length > 0) {
        const { error } = await supabase.from('diaria_registros').insert(recordsToInsert);
        if (error) throw error;
      }
      
      if (recordsToUpdate.length > 0) {
        for (const record of recordsToUpdate) {
          const { error } = await supabase.from('diaria_registros').update(record).eq('id', record.id!);
          if (error) throw error;
        }
      }
      
      toast.success("Registros de Diárias salvos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['diariaRecords', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
      refetch();
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    }
  };
  
  const handleDelete = async (id: string, index: number) => {
    if (!id) {
      remove(index);
      toast.info("Registro removido localmente.");
      return;
    }
    
    if (!confirm("Tem certeza que deseja excluir este registro de diária?")) return;
    
    try {
      const { error } = await supabase.from('diaria_registros').delete().eq('id', id);
      if (error) throw error;
      
      remove(index);
      toast.success("Registro de diária excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    }
  };
  
  const handleAddRecord = () => {
    append({
      id: undefined,
      organizacao: userOMs?.[0]?.nome_om || '',
      ug: userOMs?.[0]?.codug_om || '',
      om_detentora: userOMs?.[0]?.nome_om || '',
      ug_detentora: userOMs?.[0]?.codug_om || '',
      dias_operacao: ptrabDetails?.dias_operacao || 1,
      fase_atividade: '',
      posto_graduacao: DIARIA_RANKS_CONFIG[0].key as DiariaRegistro['posto_graduacao'],
      destino: DIARIA_DESTINOS[0].key as DiariaRegistro['destino'],
      quantidade: 1,
      valor_diaria_unitario: 0,
      valor_taxa_embarque: 0,
      valor_total: 0,
      valor_nd_30: 0,
      valor_nd_39: 0,
      detalhamento: '',
      detalhamento_customizado: '',
    });
  };

  // --- Renderização ---
  
  const isLoading = isLoadingPTrab || isLoadingDiretrizes || isLoadingOMs || isLoadingRecords;
  
  if (!ptrabId) {
    return <div className="p-4 text-center text-red-500">P Trab ID não fornecido.</div>;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando dados...</span>
      </div>
    );
  }
  
  const totalGND3 = fields.reduce((sum, record) => sum + record.valor_nd_30, 0);
  const totalGND4 = fields.reduce((sum, record) => sum + record.valor_nd_39, 0);
  const totalGeral = totalGND3 + totalGND4;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o P Trab
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recarregar Dados
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Pagamento de Diárias
            </CardTitle>
            <CardDescription>
              Registro de necessidades de recursos para pagamento de diárias e taxas de embarque.
            </CardDescription>
            <div className="mt-2 text-sm text-muted-foreground">
              <p>P Trab: <span className="font-semibold">{ptrabDetails?.numero_ptrab} - {ptrabDetails?.nome_operacao}</span></p>
              <p>Período: <span className="font-semibold">{ptrabDetails?.dias_operacao} dias</span></p>
              <p>Diretriz de Diária: <span className="font-semibold">{diretrizes?.diaria_referencia_legal || 'Não definida'}</span></p>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8">
                
                {fields.map((field, index) => (
                  <div key={field.id} className="border p-4 rounded-lg space-y-4 relative">
                    <h3 className="text-lg font-semibold mb-4">Registro {index + 1}</h3>
                    
                    {/* Botão de Excluir */}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-4 right-4 h-8 w-8"
                      onClick={() => handleDelete(field.id, index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    {/* Linha 1: Organização e UG */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`registros.${index}.organizacao`}
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel>Organização Solicitante</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                const selectedOM = userOMs?.find(om => om.nome_om === value);
                                formField.onChange(value);
                                if (selectedOM) {
                                  form.setValue(`registros.${index}.ug`, selectedOM.codug_om);
                                }
                              }}
                              value={formField.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a OM" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {userOMs?.map(om => (
                                  <SelectItem key={om.id} value={om.nome_om}>
                                    {om.nome_om}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`registros.${index}.ug`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UG Solicitante</FormLabel>
                            <FormControl>
                              <Input {...field} disabled placeholder="UG (Preenchido automaticamente)" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Linha 2: OM Detentora e UG Detentora */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`registros.${index}.om_detentora`}
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel>Organização Detentora (OM que paga)</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                const selectedOM = userOMs?.find(om => om.nome_om === value);
                                formField.onChange(value);
                                if (selectedOM) {
                                  form.setValue(`registros.${index}.ug_detentora`, selectedOM.codug_om);
                                }
                              }}
                              value={formField.value || ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a OM Detentora" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {userOMs?.map(om => (
                                  <SelectItem key={om.id} value={om.nome_om}>
                                    {om.nome_om}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`registros.${index}.ug_detentora`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UG Detentora</FormLabel>
                            <FormControl>
                              <Input {...field} disabled placeholder="UG Detentora (Preenchido automaticamente)" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Linha 3: Posto/Graduação, Destino e Quantidade */}
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`registros.${index}.posto_graduacao`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Posto/Graduação</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DIARIA_RANKS_CONFIG.map(rank => (
                                  <SelectItem key={rank.key} value={rank.key}>
                                    {rank.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`registros.${index}.destino`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Destino</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DIARIA_DESTINOS.map(destino => (
                                  <SelectItem key={destino.key} value={destino.key}>
                                    {destino.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`registros.${index}.quantidade`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Efetivo (Qtd)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                inputMode="numeric"
                                onKeyDown={handleEnterToNextField}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Linha 4: Detalhamento e Fase */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`registros.${index}.detalhamento_customizado`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Detalhamento (Opcional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Missão de Reconhecimento" onKeyDown={handleEnterToNextField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`registros.${index}.fase_atividade`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fase da Atividade (Opcional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Fase 1 - Planejamento" onKeyDown={handleEnterToNextField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Resumo do Cálculo */}
                    <div className="mt-6 p-3 bg-muted/50 rounded-md border">
                      <h4 className="font-semibold mb-2">Resumo do Custo (GND 3)</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p>Dias de Operação:</p>
                        <p className="font-medium text-right">{field.dias_operacao}</p>
                        
                        <p>Valor Diária Unitário:</p>
                        <p className="font-medium text-right">{formatCurrency(field.valor_diaria_unitario)}</p>
                        
                        <p>Taxa de Embarque Unitária:</p>
                        <p className="font-medium text-right">{formatCurrency(field.valor_taxa_embarque)}</p>
                        
                        <Separator className="col-span-2 my-1" />
                        
                        <p className="font-bold">Total Diárias (GND 3):</p>
                        <p className="font-bold text-right text-primary">{formatCurrency(field.valor_total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button type="button" variant="secondary" onClick={handleAddRecord} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Novo Registro de Diária
                </Button>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-lg font-bold">
                    Total Geral (GND 3): <span className="text-primary">{formatCurrency(totalGeral)}</span>
                  </div>
                  <Button type="submit" disabled={isLoading || form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Registros
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiariaForm;