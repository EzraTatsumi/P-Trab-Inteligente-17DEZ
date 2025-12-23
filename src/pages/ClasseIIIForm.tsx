import React, { useEffect, useMemo } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { formatNumberToCurrency } from '@/lib/utils';
import { useFetchClasseIII, useMutateClasseIII } from '@/hooks/useClasseIII';
import { useFetchDiretrizesEquipamentos } from '@/hooks/useDiretrizes';
import DecimalInput from '@/components/form/DecimalInput'; // Import the new component

// --- Schemas and Types (Assuming they exist) ---

const ItemEquipamentoSchema = z.object({
  nome: z.string(),
  quantidade: z.number().min(1, 'Quantidade deve ser maior que 0'),
  consumo_hora: z.number().nullable().optional(),
  consumo_km_litro: z.number().nullable().optional(),
  tipo_combustivel: z.string().optional(),
  preco_litro: z.number().nullable().optional(),
  consumo_lubrificante_litro: z.number().nullable().optional(),
  preco_lubrificante: z.number().nullable().optional(),
});

const RegistroSchema = z.object({
  id: z.string().optional(),
  organizacao: z.string().min(1, 'OM é obrigatória'),
  ug: z.string().min(1, 'UG é obrigatória'),
  dias_operacao: z.number().min(1, 'Dias de Operação é obrigatório'),
  tipo_equipamento: z.enum(['VIATURA', 'EMBARCACAO', 'GERADOR', 'MAQUINA_ENGENHARIA', 'OUTROS']),
  quantidade: z.number().min(1, 'Quantidade é obrigatória'),
  potencia_hp: z.number().nullable().optional(),
  horas_dia: z.number().nullable().optional(),
  consumo_hora: z.number().nullable().optional(),
  consumo_km_litro: z.number().nullable().optional(),
  km_dia: z.number().nullable().optional(),
  tipo_combustivel: z.string().min(1, 'Combustível é obrigatório'),
  preco_litro: z.number().min(0.01, 'Preço é obrigatório'),
  tipo_equipamento_detalhe: z.string().optional(),
  total_litros: z.number().optional(),
  valor_total: z.number().optional(),
  detalhamento: z.string().optional(),
  detalhamento_customizado: z.string().optional(),
  fase_atividade: z.string().optional(),
  valor_nd_30: z.number().optional(),
  valor_nd_39: z.number().optional(),
  consumo_lubrificante_litro: z.number().nullable().optional(),
  preco_lubrificante: z.number().nullable().optional(),
});

const FormSchema = z.object({
  registros: z.array(RegistroSchema),
});

type FormSchema = z.infer<typeof FormSchema>;

interface ClasseIIIFormProps {
  pTrabId: string;
}

const TIPOS_EQUIPAMENTO = [
  { value: 'VIATURA', label: 'Viatura' },
  { value: 'EMBARCACAO', label: 'Embarcação' },
  { value: 'GERADOR', label: 'Gerador' },
  { value: 'MAQUINA_ENGENHARIA', label: 'Máquina de Engenharia' },
  { value: 'OUTROS', label: 'Outros' },
];

const TIPOS_COMBUSTIVEL = ['DIESEL', 'GASOLINA', 'ETANOL', 'AVGAS', 'QAV'];

const ClasseIIIForm: React.FC<ClasseIIIFormProps> = ({ pTrabId }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const methods = useForm<FormSchema>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      registros: [],
    },
    mode: 'onBlur',
  });

  const { control, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = methods;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'registros',
  });

  const { data: initialData, isLoading: isLoadingData } = useFetchClasseIII(pTrabId);
  const { data: diretrizes } = useFetchDiretrizesEquipamentos(user?.id);
  const mutation = useMutateClasseIII(pTrabId);

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setValue('registros', initialData.map(reg => ({
        ...reg,
        // Ensure numeric fields are numbers, although RHF should handle this via setValueAs/resolver
        quantidade: Number(reg.quantidade),
        dias_operacao: Number(reg.dias_operacao),
        preco_litro: Number(reg.preco_litro),
        consumo_hora: reg.consumo_hora ? Number(reg.consumo_hora) : undefined,
        consumo_km_litro: reg.consumo_km_litro ? Number(reg.consumo_km_litro) : undefined,
        km_dia: reg.km_dia ? Number(reg.km_dia) : undefined,
        potencia_hp: reg.potencia_hp ? Number(reg.potencia_hp) : undefined,
        horas_dia: reg.horas_dia ? Number(reg.horas_dia) : undefined,
        consumo_lubrificante_litro: reg.consumo_lubrificante_litro ? Number(reg.consumo_lubrificante_litro) : undefined,
        preco_lubrificante: reg.preco_lubrificante ? Number(reg.preco_lubrificante) : undefined,
      })));
    }
  }, [initialData, setValue]);

  const watchedRegistros = watch('registros');

  // Calculation logic
  useEffect(() => {
    watchedRegistros.forEach((item, index) => {
      const {
        quantidade,
        dias_operacao,
        tipo_equipamento,
        consumo_hora,
        consumo_km_litro,
        km_dia,
        preco_litro,
        consumo_lubrificante_litro,
        preco_lubrificante,
      } = item;

      let totalLitros = 0;
      let totalLubrificante = 0;

      if (quantidade && dias_operacao) {
        if (tipo_equipamento === 'VIATURA' && consumo_km_litro && km_dia) {
          // Viatura: (Km/dia / Consumo Km/L) * Dias * Quantidade
          totalLitros = (km_dia / consumo_km_litro) * dias_operacao * quantidade;
        } else if (tipo_equipamento === 'EMBARCACAO' && consumo_hora && item.horas_dia) {
          // Embarcação: Consumo L/h * Horas/dia * Dias * Quantidade
          totalLitros = consumo_hora * item.horas_dia * dias_operacao * quantidade;
        } else if (tipo_equipamento === 'GERADOR' && consumo_hora && item.horas_dia) {
          // Gerador: Consumo L/h * Horas/dia * Dias * Quantidade
          totalLitros = consumo_hora * item.horas_dia * dias_operacao * quantidade;
        } else if (tipo_equipamento === 'MAQUINA_ENGENHARIA' && consumo_hora && item.horas_dia) {
          // Máquina Engenharia: Consumo L/h * Horas/dia * Dias * Quantidade
          totalLitros = consumo_hora * item.horas_dia * dias_operacao * quantidade;
        } else if (tipo_equipamento === 'OUTROS' && consumo_hora && item.horas_dia) {
          // Outros: Consumo L/h * Horas/dia * Dias * Quantidade
          totalLitros = consumo_hora * item.horas_dia * dias_operacao * quantidade;
        }
        
        // Calculate lubricant consumption if applicable
        if (consumo_lubrificante_litro && preco_lubrificante) {
            // Total Lubrificante = Total Litros * Consumo Lubrificante (L/L) * Preço Lubrificante
            totalLubrificante = totalLitros * consumo_lubrificante_litro * preco_lubrificante;
        }
      }

      const valorTotalCombustivel = totalLitros * (preco_litro || 0);
      const valorTotalGeral = valorTotalCombustivel + totalLubrificante;

      // Update RHF values
      setValue(`registros.${index}.total_litros`, totalLitros, { shouldValidate: false });
      setValue(`registros.${index}.valor_total`, valorTotalGeral, { shouldValidate: false });
      setValue(`registros.${index}.valor_nd_30`, valorTotalGeral, { shouldValidate: false }); // Assuming all Class III is ND 30
      setValue(`registros.${index}.valor_nd_39`, 0, { shouldValidate: false });
    });
  }, [watchedRegistros, setValue]);

  const onSubmit = async (data: FormSchema) => {
    if (!user) {
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      return;
    }

    try {
      await mutation.mutateAsync(data.registros);
      toast({ title: 'Sucesso', description: 'Registros da Classe III salvos com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['classeIII', pTrabId] });
    } catch (error) {
      console.error('Erro ao salvar Classe III:', error);
      toast({ title: 'Erro', description: 'Falha ao salvar registros da Classe III.', variant: 'destructive' });
    }
  };

  const handleTipoEquipamentoChange = (index: number, newTipo: FormSchema['registros'][number]['tipo_equipamento']) => {
    // Reset consumption fields when changing equipment type
    setValue(`registros.${index}.tipo_equipamento`, newTipo);
    setValue(`registros.${index}.consumo_hora`, undefined);
    setValue(`registros.${index}.consumo_km_litro`, undefined);
    setValue(`registros.${index}.km_dia`, undefined);
    setValue(`registros.${index}.potencia_hp`, undefined);
    setValue(`registros.${index}.horas_dia`, undefined);
    setValue(`registros.${index}.tipo_equipamento_detalhe`, undefined);
    setValue(`registros.${index}.consumo_lubrificante_litro`, undefined);
    setValue(`registros.${index}.preco_lubrificante`, undefined);
  };

  const handleDiretrizChange = (index: number, diretrizId: string) => {
    const selectedDiretriz = diretrizes?.find(d => d.id === diretrizId);
    if (selectedDiretriz) {
      setValue(`registros.${index}.tipo_equipamento_detalhe`, selectedDiretriz.nome_equipamento);
      setValue(`registros.${index}.tipo_combustivel`, selectedDiretriz.tipo_combustivel);
      setValue(`registros.${index}.consumo_hora`, selectedDiretriz.consumo);
      setValue(`registros.${index}.consumo_km_litro`, selectedDiretriz.consumo);
      // Note: We don't set preco_litro here as it depends on LPC, not the directive.
    }
  };

  if (isLoadingData) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {fields.map((item, index) => (
          <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 p-4 border rounded-md bg-card shadow-sm">
            {/* Row 1: OM, UG, Dias, Tipo Equipamento */}
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor={`organizacao-${index}`}>Organização Militar</Label>
              <Input
                id={`organizacao-${index}`}
                {...methods.register(`registros.${index}.organizacao`)}
                placeholder="Ex: 1º Batalhão"
              />
              {errors.registros?.[index]?.organizacao && <p className="text-red-500 text-sm mt-1">{errors.registros[index].organizacao.message}</p>}
            </div>
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor={`ug-${index}`}>UG</Label>
              <Input
                id={`ug-${index}`}
                {...methods.register(`registros.${index}.ug`)}
                placeholder="Ex: 160001"
              />
              {errors.registros?.[index]?.ug && <p className="text-red-500 text-sm mt-1">{errors.registros[index].ug.message}</p>}
            </div>
            <div className="col-span-12 md:col-span-2">
              <Label htmlFor={`dias_operacao-${index}`}>Dias de Operação</Label>
              <Input
                id={`dias_operacao-${index}`}
                type="number"
                inputMode="numeric"
                {...methods.register(`registros.${index}.dias_operacao`, { valueAsNumber: true })}
                placeholder="Ex: 10"
              />
              {errors.registros?.[index]?.dias_operacao && <p className="text-red-500 text-sm mt-1">{errors.registros[index].dias_operacao.message}</p>}
            </div>
            <div className="col-span-12 md:col-span-4">
              <Label htmlFor={`tipo_equipamento-${index}`}>Tipo de Equipamento</Label>
              <Select
                value={item.tipo_equipamento}
                onValueChange={(value) => handleTipoEquipamentoChange(index, value as FormSchema['registros'][number]['tipo_equipamento'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EQUIPAMENTO.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.registros?.[index]?.tipo_equipamento && <p className="text-red-500 text-sm mt-1">{errors.registros[index].tipo_equipamento.message}</p>}
            </div>

            {/* Row 2: Quantidade, Detalhe, Potencia/Horas */}
            <div className="col-span-12 md:col-span-2">
              <Label htmlFor={`quantidade-${index}`}>Quantidade</Label>
              <Input
                id={`quantidade-${index}`}
                type="number"
                inputMode="numeric"
                {...methods.register(`registros.${index}.quantidade`, { valueAsNumber: true })}
                placeholder="Ex: 1"
              />
              {errors.registros?.[index]?.quantidade && <p className="text-red-500 text-sm mt-1">{errors.registros[index].quantidade.message}</p>}
            </div>

            <div className="col-span-12 md:col-span-4">
              <Label htmlFor={`detalhe-${index}`}>Detalhe do Equipamento (Opcional)</Label>
              <Input
                id={`detalhe-${index}`}
                {...methods.register(`registros.${index}.tipo_equipamento_detalhe`)}
                placeholder="Ex: Viatura 3/4 T"
              />
            </div>

            {/* Diretriz Selection (Optional) */}
            {diretrizes && diretrizes.length > 0 && (
              <div className="col-span-12 md:col-span-3">
                <Label>Aplicar Diretriz (Opcional)</Label>
                <Select onValueChange={(value) => handleDiretrizChange(index, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Buscar Diretriz" />
                  </SelectTrigger>
                  <SelectContent>
                    {diretrizes
                      .filter(d => d.categoria === item.tipo_equipamento)
                      .map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome_equipamento} ({d.consumo} {d.unidade})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Potência HP (Only for GERADOR/MAQUINA_ENGENHARIA) */}
            {(item.tipo_equipamento === 'GERADOR' || item.tipo_equipamento === 'MAQUINA_ENGENHARIA') && (
              <div className="col-span-12 md:col-span-3">
                <Label htmlFor={`potencia_hp-${index}`}>Potência (HP)</Label>
                <DecimalInput
                  name={`registros.${index}.potencia_hp`}
                  placeholder="Ex: 100"
                />
                {errors.registros?.[index]?.potencia_hp && <p className="text-red-500 text-sm mt-1">{errors.registros[index].potencia_hp.message}</p>}
              </div>
            )}

            {/* Horas/Dia (For non-VIATURA) */}
            {item.tipo_equipamento !== 'VIATURA' && (
              <div className="col-span-12 md:col-span-3">
                <Label htmlFor={`horas_dia-${index}`}>Horas/Dia</Label>
                <DecimalInput
                  name={`registros.${index}.horas_dia`}
                  placeholder="Ex: 8"
                />
                {errors.registros?.[index]?.horas_dia && <p className="text-red-500 text-sm mt-1">{errors.registros[index].horas_dia.message}</p>}
              </div>
            )}

            {/* Km/Dia (Only for VIATURA) */}
            {item.tipo_equipamento === 'VIATURA' && (
              <div className="col-span-12 md:col-span-3">
                <Label htmlFor={`km_dia-${index}`}>Km/Dia</Label>
                <DecimalInput
                  name={`registros.${index}.km_dia`}
                  placeholder="Ex: 100"
                />
                {errors.registros?.[index]?.km_dia && <p className="text-red-500 text-sm mt-1">{errors.registros[index].km_dia.message}</p>}
              </div>
            )}

            {/* Consumption Input (L/h or Km/L) */}
            <div className="col-span-12 md:col-span-3">
              {item.tipo_equipamento === 'VIATURA' ? (
                <>
                  <Label>Consumo (Km/L)</Label>
                  <DecimalInput
                    name={`registros.${index}.consumo_km_litro`}
                    placeholder="Ex: 5,5"
                  />
                  {errors.registros?.[index]?.consumo_km_litro && <p className="text-red-500 text-sm mt-1">{errors.registros[index].consumo_km_litro.message}</p>}
                </>
              ) : (
                <>
                  <Label>Consumo (L/h)</Label>
                  <DecimalInput
                    name={`registros.${index}.consumo_hora`}
                    placeholder="Ex: 1,2"
                  />
                  {errors.registros?.[index]?.consumo_hora && <p className="text-red-500 text-sm mt-1">{errors.registros[index].consumo_hora.message}</p>}
                </>
              )}
            </div>

            {/* Combustível and Preço Litro */}
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor={`tipo_combustivel-${index}`}>Tipo de Combustível</Label>
              <Select
                value={item.tipo_combustivel || ''}
                onValueChange={(value) => setValue(`registros.${index}.tipo_combustivel`, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_COMBUSTIVEL.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.registros?.[index]?.tipo_combustivel && <p className="text-red-500 text-sm mt-1">{errors.registros[index].tipo_combustivel.message}</p>}
            </div>

            <div className="col-span-12 md:col-span-3">
              <Label htmlFor={`preco_litro-${index}`}>Preço por Litro (R$)</Label>
              <DecimalInput
                name={`registros.${index}.preco_litro`}
                placeholder="Ex: 6,50"
              />
              {errors.registros?.[index]?.preco_litro && <p className="text-red-500 text-sm mt-1">{errors.registros[index].preco_litro.message}</p>}
            </div>
            
            {/* Lubrificante Fields */}
            <div className="col-span-12 md:col-span-3">
              <Label>Consumo Lubrificante (L/L Combustível)</Label>
              <DecimalInput
                name={`registros.${index}.consumo_lubrificante_litro`}
                placeholder="Ex: 0,01"
              />
              {errors.registros?.[index]?.consumo_lubrificante_litro && <p className="text-red-500 text-sm mt-1">{errors.registros[index].consumo_lubrificante_litro.message}</p>}
            </div>
            
            <div className="col-span-12 md:col-span-3">
              <Label>Preço Lubrificante (R$/L)</Label>
              <DecimalInput
                name={`registros.${index}.preco_lubrificante`}
                placeholder="Ex: 50,00"
              />
              {errors.registros?.[index]?.preco_lubrificante && <p className="text-red-500 text-sm mt-1">{errors.registros[index].preco_lubrificante.message}</p>}
            </div>


            {/* Totals and Detailing */}
            <div className="col-span-12 md:col-span-3">
              <Label>Total Litros Estimado</Label>
              <Input
                value={formatNumberToCurrency(item.total_litros || 0)}
                readOnly
                className="bg-gray-100 dark:bg-gray-800"
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <Label>Valor Total (R$)</Label>
              <Input
                value={formatNumberToCurrency(item.valor_total || 0)}
                readOnly
                className="bg-gray-100 dark:bg-gray-800 font-bold"
              />
            </div>

            <div className="col-span-12 md:col-span-6">
              <Label htmlFor={`detalhamento-${index}`}>Detalhamento da Atividade (Opcional)</Label>
              <Textarea
                id={`detalhamento-${index}`}
                {...methods.register(`registros.${index}.detalhamento`)}
                placeholder="Descreva a atividade que gerou este consumo."
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <Label htmlFor={`fase_atividade-${index}`}>Fase da Atividade (Opcional)</Label>
              <Input
                id={`fase_atividade-${index}`}
                {...methods.register(`registros.${index}.fase_atividade`)}
                placeholder="Ex: Deslocamento, Estacionamento, Operação"
              />
            </div>

            <div className="col-span-12 flex justify-end">
              <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4 mr-2" /> Remover Registro
              </Button>
            </div>
          </div>
        ))}

        <div className="flex justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => append({
              organizacao: '',
              ug: '',
              dias_operacao: 1,
              tipo_equipamento: 'VIATURA',
              quantidade: 1,
              tipo_combustivel: 'DIESEL',
              preco_litro: 0,
              valor_total: 0,
              total_litros: 0,
              valor_nd_30: 0,
              valor_nd_39: 0,
              consumo_lubrificante_litro: 0,
              preco_lubrificante: 0,
            } as FormSchema['registros'][number])}
          >
            <Plus className="h-4 w-4 mr-2" /> Adicionar Registro
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4 mr-2" /> Salvar Classe III
          </Button>
        </div>
        {Object.keys(errors).length > 0 && (
          <p className="text-red-500 mt-4">Por favor, corrija os erros no formulário antes de salvar.</p>
        )}
      </form>
    </FormProvider>
  );
};

export default ClasseIIIForm;