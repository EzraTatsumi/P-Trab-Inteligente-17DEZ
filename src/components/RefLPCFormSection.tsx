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
import { RefLPC, RefLPCForm } from "@/types/refLPC";
import { getPreviousWeekRange, formatDateDDMMMAA, formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { fetchFuelPrice } from "@/integrations/supabase/api";

interface RefLPCFormSectionProps {
  ptrabId: string;
  refLPC: RefLPC | null;
  onUpdate: (newRefLPC: RefLPC) => void;
}

const initialFormState: RefLPCForm = {
  data_inicio_consulta: "",
  data_fim_consulta: "",
  ambito: "Nacional",
  nome_local: "",
  preco_diesel: "0", // Armazenar como string de dígitos brutos
  preco_gasolina: "0", // Armazenar como string de dígitos brutos
  source: "Manual",
};

export const RefLPCFormSection = ({ ptrabId, refLPC, onUpdate }: RefLPCFormSectionProps) => {
  const [formLPC, setFormLPC] = useState<RefLPCForm>(initialFormState);
  const [isLPCFormExpanded, setIsLPCFormExpanded] = useState(refLPC === null);
  
  const [loading, setLoading] = useState(false);
  const { handleEnterToNextField } = useFormNavigation();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Estado para rastrear o input focado e seus dígitos brutos (garantindo que rawDigits é string)
  const [focusedInput, setFocusedInput] = useState<{ field: 'preco_diesel' | 'preco_gasolina', rawDigits: string } | null>(null);


  useEffect(() => {
    if (refLPC) {
      setFormLPC({
        data_inicio_consulta: refLPC.data_inicio_consulta,
        data_fim_consulta: refLPC.data_fim_consulta,
        ambito: refLPC.ambito as 'Nacional' | 'Estadual' | 'Municipal',
        nome_local: refLPC.nome_local || "",
        // Inicializa como string de dígitos brutos, garantindo que o valor de entrada seja tratado como number
        preco_diesel: numberToRawDigits(Number(refLPC.preco_diesel)),
        preco_gasolina: numberToRawDigits(Number(refLPC.preco_gasolina)),
        source: refLPC.source || 'Manual',
      });
      setIsLPCFormExpanded(false);
    } else {
      setFormLPC(initialFormState);
      setIsLPCFormExpanded(true);
    }
  }, [refLPC]);

  // Handler genérico para campos que não são de preço, garantindo que a fonte seja 'Manual'
  const handleNonPriceChange = (field: keyof RefLPCForm, value: string) => {
    setFormLPC(prev => ({
        ...prev,
        [field]: value,
        source: 'Manual'
    }));
  };

  const handleAmbitoChange = (val: 'Nacional' | 'Estadual' | 'Municipal') => {
    setFormLPC(prev => ({
        ...prev,
        ambito: val,
        nome_local: '',
        source: 'Manual'
    }));
  };

  const handleSalvarRefLPC = async () => {
    if (!formLPC.data_inicio_consulta || !formLPC.data_fim_consulta) {
      toast.error("Preencha as datas de início e fim da consulta");
      return;
    }

    if (formLPC.ambito !== 'Nacional' && !formLPC.nome_local) {
      toast.error(`Preencha o nome do ${formLPC.ambito === 'Estadual' ? 'Estado' : 'Município'}`);
      return;
    }
    
    // Converte os valores de preço (que estão em string de dígitos brutos) para numérico antes de salvar
    // Garantindo que formLPC.preco_diesel e formLPC.preco_gasolina são strings antes de passar para formatCurrencyInput
    const dieselPrice = formatCurrencyInput(String(formLPC.preco_diesel)).numericValue;
    const gasolinePrice = formatCurrencyInput(String(formLPC.preco_gasolina)).numericValue;

    if (dieselPrice <= 0 || gasolinePrice <= 0) {
      toast.error("Os preços devem ser maiores que zero");
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        p_trab_id: ptrabId,
        data_inicio_consulta: formLPC.data_inicio_consulta,
        data_fim_consulta: formLPC.data_fim_consulta,
        ambito: formLPC.ambito,
        nome_local: formLPC.nome_local,
        preco_diesel: dieselPrice,
        preco_gasolina: gasolinePrice,
        source: formLPC.source,
      };

      let result;
      if (refLPC) {
        const { data, error } = await supabase
          .from("p_trab_ref_lpc")
          .update(dataToSave)
          .eq("id", refLPC.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
        toast.success("Referência LPC atualizada!");
      } else {
        const { data, error } = await supabase
          .from("p_trab_ref_lpc")
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        result = data;
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
      
      // Formata as datas para yyyy-MM-dd removendo a parte do tempo (T...)
      const formattedStart = start.includes('T') ? start.split('T')[0] : start;
      const formattedEnd = end.includes('T') ? end.split('T')[0] : end;
      
      const [dieselResult, gasolinaResult] = await Promise.all([
        fetchFuelPrice('diesel'),
        fetchFuelPrice('gasolina'),
      ]);
      
      setFormLPC(prev => ({
        ...prev,
        data_inicio_consulta: formattedStart,
        data_fim_consulta: formattedEnd,
        ambito: 'Nacional',
        nome_local: 'ANP - Média Nacional',
        // Salva como string de dígitos brutos
        preco_diesel: numberToRawDigits(dieselResult.price),
        preco_gasolina: numberToRawDigits(gasolinaResult.price),
        source: 'API',
      }));
      
      toast.success(`Preços de combustível atualizados via API! Fonte: ${dieselResult.source}`);
      
    } catch (error) {
      // O erro já é tratado e exibido dentro de fetchFuelPrice
    } finally {
      setLoading(false);
    }
  };

  // Handlers para inputs de preço usando formatCurrencyInput
  const getPriceInputProps = (field: 'preco_diesel' | 'preco_gasolina') => {
    // Garantindo que rawDigits é string
    const rawDigits = String(formLPC[field]);
    const isFocused = focusedInput?.field === field;
    
    let displayValue = isFocused 
        ? formatCurrencyInput(String(focusedInput.rawDigits)).formatted
        : formatCurrencyInput(rawDigits).formatted;
        
    if (rawDigits === "0" && !isFocused) {
        displayValue = "";
    }

    const handleFocus = () => {
        setFocusedInput({ 
            field: field, 
            rawDigits: rawDigits // rawDigits é garantido ser string aqui
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { digits } = formatCurrencyInput(e.target.value);
        setFocusedInput(prev => prev ? { ...prev, rawDigits: digits } : null);
        setFormLPC(prev => ({ 
            ...prev, 
            [field]: digits,
            source: 'Manual'
        }));
    };
    
    const handleBlur = () => {
        setFocusedInput(null);
    };
    
    return {
        value: displayValue,
        onChange: handleChange,
        onFocus: handleFocus,
        onBlur: handleBlur,
        type: "text" as const,
        inputMode: "numeric" as const,
    };
  };
  
  const dieselProps = getPriceInputProps('preco_diesel');
  const gasolineProps = getPriceInputProps('preco_gasolina');

  // Lógica para exibir a fonte no título
  const displaySource = formLPC.source || 'Manual';
  const sourceText = displaySource === 'API' ? 'API Externa' : 'Manual';
  const sourceColor = displaySource === 'API' ? 'text-green-700' : 'text-blue-700';
  const sourceBg = displaySource === 'API' ? 'bg-green-100' : 'bg-blue-100';
  
  // Lógica para exibir a data de atualização
  const lastUpdateDate = refLPC?.updated_at ? formatDateDDMMMAA(refLPC.updated_at) : null;


  return (
    <Card className="mb-6 border-2 border-primary/20" ref={contentRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {/* Novo container clicável para o título */}
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
          {/* O botão de seta continua ativo */}
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
          
          <form onSubmit={(e) => { e.preventDefault(); handleSalvarRefLPC(); }}>
            
            {/* Removido o alerta temporário, pois o toast de sucesso já informa a fonte */}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Início Consulta</Label>
                <Input
                  type="date"
                  value={formLPC.data_inicio_consulta}
                  onChange={(e) => handleNonPriceChange('data_inicio_consulta', e.target.value)}
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Data Fim Consulta</Label>
                <Input
                  type="date"
                  value={formLPC.data_fim_consulta}
                  onChange={(e) => handleNonPriceChange('data_fim_consulta', e.target.value)}
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Âmbito da Pesquisa</Label>
                <Select
                  value={formLPC.ambito}
                  onValueChange={handleAmbitoChange}
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
              </div>
              
              {formLPC.ambito !== 'Nacional' && (
                <div className="space-y-2">
                  <Label>{formLPC.ambito === 'Estadual' ? 'Estado' : 'Município'}</Label>
                  <Input
                    value={formLPC.nome_local || ''}
                    onChange={(e) => handleNonPriceChange('nome_local', e.target.value)}
                    placeholder={formLPC.ambito === 'Estadual' ? 'Ex: Rio de Janeiro' : 'Ex: Niterói'}
                    onKeyDown={handleEnterToNextField}
                    disabled={loading}
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Campo Preço Diesel */}
              <div className="flex items-center gap-2">
                <Label className="w-1/2 min-w-[150px]">Preço Diesel (R$/litro)</Label>
                <Input
                  {...dieselProps}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              {/* Campo Preço Gasolina */}
              <div className="flex items-center gap-2">
                <Label className="w-1/2 min-w-[150px]">Preço Gasolina (R$/litro)</Label>
                <Input
                  {...gasolineProps}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
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
  );
};

export default RefLPCFormSection;