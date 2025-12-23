import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Fuel, AlertCircle, Cloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { RefLPC, RefLPCForm, RefLPCSource } from "@/types/refLPC";
import { getPreviousWeekRange, formatDateDDMMMAA, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { fetchFuelPrice } from "@/integrations/supabase/api";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import DecimalInput from "./form/DecimalInput";

// Define Zod Schema for RefLPCForm
const RefLPCZodSchema = z.object({
  data_inicio_consulta: z.string().min(1, "Data de início é obrigatória."),
  data_fim_consulta: z.string().min(1, "Data de fim é obrigatória."),
  ambito: z.enum(['Nacional', 'Estadual', 'Municipal']),
  nome_local: z.string().optional(),
  preco_diesel: z.number().min(0.01, "Preço do diesel deve ser maior que zero."),
  preco_gasolina: z.number().min(0.01, "Preço da gasolina deve ser maior que zero."),
  source: z.enum(['Manual', 'API']),
}).refine(data => data.ambito === 'Nacional' || data.nome_local, {
    message: "O nome do local é obrigatório para âmbito Estadual/Municipal.",
    path: ["nome_local"],
});

type RefLPCFormValues = z.infer<typeof RefLPCZodSchema>;

interface RefLPCFormSectionProps {
  ptrabId: string;
  refLPC: RefLPC | null;
  onUpdate: (newRefLPC: RefLPC) => void;
}

export const RefLPCFormSection = ({ ptrabId, refLPC, onUpdate }: RefLPCFormSectionProps) => {
  const [isLPCFormExpanded, setIsLPCFormExpanded] = useState(refLPC === null);
  const [loading, setLoading] = useState(false);
  const { handleEnterToNextField } = useFormNavigation();
  
  const methods = useForm<RefLPCFormValues>({
    resolver: zodResolver(RefLPCZodSchema),
    defaultValues: {
      data_inicio_consulta: "",
      data_fim_consulta: "",
      ambito: "Nacional",
      nome_local: "",
      preco_diesel: 0,
      preco_gasolina: 0,
      source: "Manual",
    },
  });
  
  const { handleSubmit, reset, setValue, watch, formState: { errors } } = methods;
  const watchedAmbito = watch('ambito');
  const watchedSource = watch('source');

  useEffect(() => {
    if (refLPC) {
      reset({
        data_inicio_consulta: refLPC.data_inicio_consulta,
        data_fim_consulta: refLPC.data_fim_consulta,
        ambito: refLPC.ambito as 'Nacional' | 'Estadual' | 'Municipal',
        nome_local: refLPC.nome_local || "",
        preco_diesel: Number(refLPC.preco_diesel),
        preco_gasolina: Number(refLPC.preco_gasolina),
        source: refLPC.source || 'Manual',
      });
      setIsLPCFormExpanded(false);
    } else {
      reset(methods.formState.defaultValues);
      setIsLPCFormExpanded(true);
    }
  }, [refLPC, reset]);

  const handleSalvarRefLPC = async (data: RefLPCFormValues) => {
    setLoading(true);
    try {
      const dataToSave = {
        p_trab_id: ptrabId,
        data_inicio_consulta: data.data_inicio_consulta,
        data_fim_consulta: data.data_fim_consulta,
        ambito: data.ambito,
        nome_local: data.nome_local,
        preco_diesel: data.preco_diesel,
        preco_gasolina: data.preco_gasolina,
        source: data.source,
      };

      let result;
      if (refLPC) {
        const { data: updateData, error } = await supabase
          .from("p_trab_ref_lpc")
          .update(dataToSave)
          .eq("id", refLPC.id)
          .select()
          .single();

        if (error) throw error;
        result = updateData;
        toast.success("Referência LPC atualizada!");
      } else {
        const { data: insertData, error } = await supabase
          .from("p_trab_ref_lpc")
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        result = insertData;
        toast.success("Referência LPC salva!");
      }

      onUpdate(result as RefLPC);
      setIsLPCFormExpanded(false);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleConsultarAPI = async () => {
    setLoading(true);
    try {
      const { start, end } = getPreviousWeekRange();
      
      const [dieselResult, gasolinaResult] = await Promise.all([
        fetchFuelPrice('diesel'),
        fetchFuelPrice('gasolina'),
      ]);
      
      // Update form fields directly with numeric values from API
      setValue('data_inicio_consulta', start);
      setValue('data_fim_consulta', end);
      setValue('ambito', 'Nacional');
      setValue('nome_local', 'ANP - Média Nacional');
      setValue('preco_diesel', dieselResult.price);
      setValue('preco_gasolina', gasolinaResult.price);
      setValue('source', 'API');
      
      toast.success(`Preços de combustível atualizados via API! Fonte: ${dieselResult.source}`);
      
    } catch (error) {
      // Error handled inside fetchFuelPrice
    } finally {
      setLoading(false);
    }
  };

  // Lógica para exibir a fonte no título
  const displaySource = watchedSource || 'Manual';
  const sourceText = displaySource === 'API' ? 'API Externa' : 'Manual';
  const sourceColor = displaySource === 'API' ? 'text-green-700' : 'text-blue-700';
  const sourceBg = displaySource === 'API' ? 'bg-green-100' : 'bg-blue-100';
  
  // Lógica para exibir a data de atualização
  const lastUpdateDate = refLPC?.updated_at ? formatDateDDMMMAA(refLPC.updated_at) : null;


  return (
    <FormProvider {...methods}>
      <Card className="mb-6 border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center flex-1 cursor-pointer"
              onClick={() => setIsLPCFormExpanded(!isLPCFormExpanded)}
            >
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="h-5 w-5" />
                Referência de Preços - Consulta LPC
                {refLPC && (
                    <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${sourceBg} ${sourceColor}`}>
                        {sourceText}
                    </span>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdateDate && (
                  <span className="text-xs text-muted-foreground">
                      Última Atz: {lastUpdateDate}
                  </span>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsLPCFormExpanded(!isLPCFormExpanded)}
                disabled={loading}
              >
                {isLPCFormExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isLPCFormExpanded && (
          <CardContent>
            {!refLPC && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Configure a referência de preços LPC para este P Trab antes de adicionar registros de Classe III.
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit(handleSalvarRefLPC)}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Data Início Consulta</Label>
                  <Input
                    type="date"
                    {...methods.register('data_inicio_consulta')}
                    onKeyDown={handleEnterToNextField}
                    disabled={loading}
                  />
                  {errors.data_inicio_consulta && <p className="text-xs text-destructive mt-1">{errors.data_inicio_consulta.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label>Data Fim Consulta</Label>
                  <Input
                    type="date"
                    {...methods.register('data_fim_consulta')}
                    onKeyDown={handleEnterToNextField}
                    disabled={loading}
                  />
                  {errors.data_fim_consulta && <p className="text-xs text-destructive mt-1">{errors.data_fim_consulta.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label>Âmbito da Pesquisa</Label>
                  <Select
                    value={watchedAmbito}
                    onValueChange={(val: 'Nacional' | 'Estadual' | 'Municipal') => {
                        setValue('ambito', val);
                        setValue('nome_local', '');
                        setValue('source', 'Manual');
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nacional">Nacional</SelectItem>
                      <SelectItem value="Estadual">Estadual</SelectItem>
                      <SelectItem value="Municipal">Municipal</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.ambito && <p className="text-xs text-destructive mt-1">{errors.ambito.message}</p>}
                </div>
                
                {watchedAmbito !== 'Nacional' && (
                  <div className="space-y-2">
                    <Label>{watchedAmbito === 'Estadual' ? 'Estado' : 'Município'}</Label>
                    <Input
                      {...methods.register('nome_local')}
                      placeholder={watchedAmbito === 'Estadual' ? 'Ex: Rio de Janeiro' : 'Ex: Niterói'}
                      onKeyDown={handleEnterToNextField}
                      disabled={loading}
                    />
                    {errors.nome_local && <p className="text-xs text-destructive mt-1">{errors.nome_local.message}</p>}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Preço Diesel</Label>
                  <div className="relative">
                    <DecimalInput
                      name="preco_diesel"
                      placeholder="Ex: 6,50"
                      className="pr-16"
                      onKeyDown={handleEnterToNextField}
                      disabled={loading}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      R$/litro
                    </span>
                  </div>
                  {errors.preco_diesel && <p className="text-xs text-destructive mt-1">{errors.preco_diesel.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label>Preço Gasolina</Label>
                  <div className="relative">
                    <DecimalInput
                      name="preco_gasolina"
                      placeholder="Ex: 5,80"
                      className="pr-16"
                      onKeyDown={handleEnterToNextField}
                      disabled={loading}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      R$/litro
                    </span>
                  </div>
                  {errors.preco_gasolina && <p className="text-xs text-destructive mt-1">{errors.preco_gasolina.message}</p>}
                </div>
              </div>
              
              <div className="flex justify-end mt-4 space-x-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleConsultarAPI}
                  disabled={loading}
                  className="gap-2"
                >
                  <Cloud className="h-4 w-4" />
                  {loading ? "Consultando API..." : "Consultar Preços via API"}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : (refLPC ? "Atualizar Referência LPC" : "Salvar Referência LPC")}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>
    </FormProvider>
  );
};

export default RefLPCFormSection;