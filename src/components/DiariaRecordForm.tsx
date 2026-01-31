"use client";

import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { diariaSchema, DiariaFormType } from '@/lib/validationSchemas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DIARIA_RANKS_CONFIG, calculateDiariaTotals, DestinoDiaria, QuantidadesPorPosto } from '@/lib/diariaUtils';
import { DESTINO_OPTIONS } from '@/lib/diariaConstants';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TablesInsert, Tables } from '@/integrations/supabase/types';
import { sanitizeError } from '@/lib/errorUtils';
import { fetchDiretrizesOperacionais } from '@/lib/ptrabUtils';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { OmSelector } from './OmSelector';
import { formatCurrency } from '@/lib/formatUtils';

// Define the form type based on the schema
type DiariaFormValues = DiariaFormType;

interface DiariaRecordFormProps {
  ptrabId: string;
  onRecordSaved: () => void;
  initialData?: Tables<'diaria_registros'> | null;
  isEditing?: boolean;
}

const defaultQuantities: QuantidadesPorPosto = DIARIA_RANKS_CONFIG.reduce((acc, rank) => {
    acc[rank.key] = 0;
    return acc;
}, {} as QuantidadesPorPosto);

const initialFormValues: DiariaFormValues = {
    om_favorecida: '',
    ug_favorecida: '',
    om_detentora: '',
    ug_detentora: '',
    dias_operacao: 1,
    nr_viagens: 1,
    destino: 'demais_dslc' as DestinoDiaria,
    local_atividade: '',
    fase_atividade: '',
    quantidades_por_posto: defaultQuantities,
    is_aereo: false,
    detalhamento_customizado: null,
};

const DiariaRecordForm: React.FC<DiariaRecordFormProps> = ({ ptrabId, onRecordSaved, initialData, isEditing }) => {
  const form = useForm<DiariaFormValues>({
    resolver: zodResolver(diariaSchema),
    defaultValues: initialData ? {
        ...initialData,
        destino: initialData.destino as DestinoDiaria,
        quantidades_por_posto: initialData.quantidades_por_posto as QuantidadesPorPosto,
        is_aereo: initialData.is_aereo ?? false,
        // Mapeamento de campos do DB para o Form
        om_favorecida: initialData.organizacao,
        ug_favorecida: initialData.ug,
        // Campos calculados (opcionais no schema)
        valor_nd_15: initialData.valor_nd_15,
        valor_nd_30: initialData.valor_nd_30,
        valor_total: initialData.valor_total,
    } : initialFormValues,
  });
  
  const { watch, setValue, handleSubmit, reset, formState: { isSubmitting, isDirty } } = form;
  
  const watchedFields = watch();
  const anoReferencia = new Date().getFullYear(); // Assuming current year for directives

  // Fetch Diretrizes Operacionais
  const { data: diretrizes, isLoading: isLoadingDiretrizes } = useQuery({
    queryKey: ['diretrizesOperacionais', anoReferencia],
    queryFn: () => fetchDiretrizesOperacionais(anoReferencia),
    staleTime: Infinity,
  });

  // Calculate totals whenever relevant fields change
  const calculatedTotals = useMemo(() => {
    if (!diretrizes) {
        return { totalGeral: 0, totalDiariaBase: 0, totalTaxaEmbarque: 0, totalMilitares: 0 };
    }
    
    const dataForCalculation = {
        ...watchedFields,
        organizacao: watchedFields.om_favorecida, // Use favorecida as organizacao for calculation
        ug: watchedFields.ug_favorecida,
    };
    
    const { totalGeral, totalDiariaBase, totalTaxaEmbarque, totalMilitares } = calculateDiariaTotals(
        dataForCalculation as any, // Cast to any to match DiariaData interface
        diretrizes
    );
    
    return { totalGeral, totalDiariaBase, totalTaxaEmbarque, totalMilitares };
  }, [watchedFields, diretrizes]);
  
  // Update calculated fields in the form state (ND 15, ND 30, Total)
  useEffect(() => {
    // ND 33.90.15 (Diária Base)
    setValue('valor_nd_15', calculatedTotals.totalDiariaBase, { shouldDirty: false });
    
    // ND 33.90.30 (Taxa de Embarque)
    setValue('valor_nd_30', calculatedTotals.totalTaxaEmbarque, { shouldDirty: false });
    
    // O campo valor_total é usado para o total geral
    setValue('valor_total', calculatedTotals.totalGeral, { shouldDirty: false });
    
  }, [calculatedTotals, setValue]);


  // --- LÓGICA DE SUBMISSÃO E RESET ---
  const onSubmit = async (data: DiariaFormValues) => {
    if (!diretrizes) {
        toast.error("Diretrizes operacionais não carregadas.");
        return;
    }
    
    const { totalGeral, totalDiariaBase, totalTaxaEmbarque, totalMilitares } = calculatedTotals;
    
    if (totalMilitares === 0) {
        toast.error("Informe a quantidade de militares por posto/graduação.");
        return;
    }
    
    const { om_favorecida, ug_favorecida, valor_nd_15, valor_nd_30, valor_total, ...rest } = data;
    
    const recordToSave: TablesInsert<'diaria_registros'> = {
        ...rest,
        p_trab_id: ptrabId,
        organizacao: om_favorecida, // Mapeamento para o campo 'organizacao' do DB
        ug: ug_favorecida, // Mapeamento para o campo 'ug' do DB
        quantidade: totalMilitares, // Total de militares
        valor_total: totalGeral,
        valor_nd_15: totalDiariaBase,
        valor_nd_30: totalTaxaEmbarque,
        
        // Campos que não estão no schema mas são necessários para o DB
        detalhamento: 'Gerando detalhamento...', // Será preenchido no onRecordSaved
        valor_diaria_unitario: 0, // Não é mais unitário, mas o campo é obrigatório no DB
        valor_taxa_embarque: diretrizes.taxa_embarque,
    };
    
    try {
        let error;
        
        if (isEditing && initialData) {
            // Edição
            const { error: updateError } = await supabase
                .from('diaria_registros')
                .update(recordToSave as Tables<'diaria_registros'>)
                .eq('id', initialData.id);
            error = updateError;
        } else {
            // Inserção
            const { error: insertError } = await supabase
                .from('diaria_registros')
                .insert([recordToSave]);
            error = insertError;
        }

        if (error) throw error;

        toast.success(`Registro de Diária ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
        
        // --- FIX: Lógica de Reset Seletivo ---
        if (!isEditing) {
            // 1. Captura os valores dos campos de contexto (Seções 1 e 2)
            const contextValues = {
                om_favorecida: data.om_favorecida,
                ug_favorecida: data.ug_favorecida,
                om_detentora: data.om_detentora,
                ug_detentora: data.ug_detentora,
                dias_operacao: data.dias_operacao,
                nr_viagens: data.nr_viagens,
                destino: data.destino,
                local_atividade: data.local_atividade,
                fase_atividade: data.fase_atividade,
                is_aereo: data.is_aereo,
            };
            
            // 2. Define os valores a serem resetados (quantidades e detalhamento customizado)
            const resetQuantities = {
                quantidades_por_posto: defaultQuantities,
                detalhamento_customizado: null,
                // Resetar campos calculados para evitar que o formulário fique 'sujo'
                valor_nd_15: 0,
                valor_nd_30: 0,
                valor_total: 0,
            };
            
            // 3. Reseta o formulário, mantendo os valores de contexto e zerando as quantidades
            reset({
                ...contextValues,
                ...resetQuantities,
            });
        }
        // --- FIM FIX ---
        
        onRecordSaved();
        
    } catch (error: any) {
        console.error("Erro ao salvar registro de diária:", error);
        toast.error("Falha ao salvar registro de diária.", { description: sanitizeError(error) });
    }
  };

  if (isLoadingDiretrizes) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando diretrizes...</div>;
  }
  
  // Assuming OmSelector handles the OM/UG selection and updates om_favorecida/ug_favorecida
  const handleOmFavorecidaChange = (omData: any | undefined) => {
    if (omData) {
        setValue('om_favorecida', omData.nome_om, { shouldValidate: true, shouldDirty: true });
        setValue('ug_favorecida', omData.codug_om, { shouldValidate: true, shouldDirty: true });
    } else {
        setValue('om_favorecida', '', { shouldValidate: true, shouldDirty: true });
        setValue('ug_favorecida', '', { shouldValidate: true, shouldDirty: true });
    }
  };
  
  const handleOmDetentoraChange = (omData: any | undefined) => {
    if (omData) {
        setValue('om_detentora', omData.nome_om, { shouldValidate: true, shouldDirty: true });
        setValue('ug_detentora', omData.codug_om, { shouldValidate: true, shouldDirty: true });
    } else {
        setValue('om_detentora', '', { shouldValidate: true, shouldDirty: true });
        setValue('ug_detentora', '', { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* SEÇÃO 1: OMs e Período */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg">
            <h3 className="col-span-full text-lg font-semibold mb-2">1. Contexto da Diária</h3>
            
            <FormField
                control={form.control}
                name="om_favorecida"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>OM Favorecida (Destino do Militar) *</FormLabel>
                        <OmSelector
                            selectedOmId={field.value}
                            initialOmName={field.value}
                            onChange={handleOmFavorecidaChange}
                            placeholder="Selecione a OM Favorecida"
                        />
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
                control={form.control}
                name="om_detentora"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>OM Destino do Recurso (ND 30/15) *</FormLabel>
                        <OmSelector
                            selectedOmId={field.value}
                            initialOmName={field.value}
                            onChange={handleOmDetentoraChange}
                            placeholder="Selecione a OM Detentora do Recurso"
                        />
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
                control={form.control}
                name="dias_operacao"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Dias de Operação *</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                min={1}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
                control={form.control}
                name="nr_viagens"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Número de Viagens (Ida e Volta) *</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 1)}
                                min={1}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
                control={form.control}
                name="fase_atividade"
                render={({ field }) => (
                    <FormItem className="col-span-full">
                        <FormLabel>Fase da Atividade *</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Ex: Execução, Reconhecimento" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        
        {/* SEÇÃO 2: Local e Tipo de Deslocamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg">
            <h3 className="col-span-full text-lg font-semibold mb-2">2. Local e Deslocamento</h3>
            
            <FormField
                control={form.control}
                name="destino"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tipo de Destino (Cálculo) *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo de destino" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {DESTINO_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
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
                name="local_atividade"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Local da Atividade (Cidade/Estado) *</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Ex: Rio de Janeiro/RJ" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            <FormField
                control={form.control}
                name="is_aereo"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-full">
                        <div className="space-y-0.5">
                            <FormLabel>Deslocamento Aéreo</FormLabel>
                            <p className="text-sm text-muted-foreground">
                                Habilita o cálculo da Taxa de Embarque (ND 33.90.30).
                            </p>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </div>
        
        {/* SEÇÃO 3: Efetivo e Totais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg">
            <h3 className="col-span-full text-lg font-semibold mb-2">3. Efetivo e Totais</h3>
            
            {DIARIA_RANKS_CONFIG.map(rank => (
                <FormField
                    key={rank.key}
                    control={form.control}
                    name={`quantidades_por_posto.${rank.key}`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{rank.label} (Qtd Militares)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                    min={0}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            ))}
            
            <div className="col-span-full space-y-2 pt-4">
                <div className="flex justify-between font-semibold text-lg">
                    <span>Total Diária (ND 33.90.15):</span>
                    <span>{formatCurrency(calculatedTotals.totalDiariaBase)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                    <span>Total Taxa Emb. (ND 33.90.30):</span>
                    <span>{formatCurrency(calculatedTotals.totalTaxaEmbarque)}</span>
                </div>
                <div className="flex justify-between font-bold text-xl border-t pt-2 mt-2">
                    <span>Total Geral:</span>
                    <span className="text-primary">{formatCurrency(calculatedTotals.totalGeral)}</span>
                </div>
            </div>
        </div>
        
        {/* Detalhamento Customizado (Opcional) */}
        <FormField
            control={form.control}
            name="detalhamento_customizado"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Memória de Cálculo Customizada (Opcional)</FormLabel>
                    <FormControl>
                        <Textarea
                            {...field}
                            value={field.value || ''}
                            placeholder="Deixe em branco para usar a memória de cálculo automática."
                            rows={6}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />

        <Button type="submit" disabled={isSubmitting || isLoadingDiretrizes || !isDirty}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEditing ? "Atualizar Item" : "Salvar Item na Lista"}
        </Button>
      </form>
    </Form>
  );
};

export default DiariaRecordForm;