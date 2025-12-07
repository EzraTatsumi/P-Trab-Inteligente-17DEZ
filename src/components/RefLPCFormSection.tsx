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
import { getPreviousWeekRange, formatNumberForInput } from "@/lib/formatUtils";
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
  preco_diesel: 0,
  preco_gasolina: 0,
  source: "Manual", // Adicionado source padrão
};

export const RefLPCFormSection = ({ ptrabId, refLPC, onUpdate }: RefLPCFormSectionProps) => {
  // Inicializa o estado de expansão baseado no prop inicial.
  // Se refLPC for null, abre (true). Se não for null, fecha (false).
  const [isLPCFormExpanded, setIsLPCFormExpanded] = useState(refLPC === null);
  
  const [formLPC, setFormLPC] = useState<RefLPCForm>(initialFormState);
  const [loading, setLoading] = useState(false);
  const { handleEnterToNextField } = useFormNavigation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (refLPC) {
      setFormLPC({
        data_inicio_consulta: refLPC.data_inicio_consulta,
        data_fim_consulta: refLPC.data_fim_consulta,
        ambito: refLPC.ambito as 'Nacional' | 'Estadual' | 'Municipal',
        nome_local: refLPC.nome_local || "",
        preco_diesel: Number(refLPC.preco_diesel),
        preco_gasolina: Number(refLPC.preco_gasolina),
        source: refLPC.source || 'Manual', // Lê a fonte do registro existente
      });
      setIsLPCFormExpanded(false); // Garante que feche após o carregamento assíncrono
    } else {
      setFormLPC(initialFormState);
      setIsLPCFormExpanded(true); // Garante que abra se o carregamento assíncrono confirmar que é nulo
    }
  }, [refLPC]);

  // Handler genérico para campos que não são de preço, garantindo que a fonte seja 'Manual'
  const handleNonPriceChange = (field: keyof RefLPCForm, value: string) => {
    setFormLPC(prev => ({
        ...prev,
        [field]: value,
        source: 'Manual' // Qualquer alteração manual define a fonte como Manual
    }));
  };

  const handleAmbitoChange = (val: 'Nacional' | 'Estadual' | 'Municipal') => {
    setFormLPC(prev => ({
        ...prev,
        ambito: val,
        nome_local: '',
        source: 'Manual' // Qualquer alteração manual define a fonte como Manual
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
    
    // Converte os valores de preço para numérico antes de salvar
    const dieselPrice = parseFloat(String(formLPC.preco_diesel).replace(/\./g, '').replace(',', '.')) || 0;
    const gasolinePrice = parseFloat(String(formLPC.preco_gasolina).replace(/\./g, '').replace(',', '.')) || 0;

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
        source: formLPC.source, // Salva a fonte atual
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
      
      const [dieselResult, gasolinaResult] = await Promise.all([
        fetchFuelPrice('diesel'),
        fetchFuelPrice('gasolina'),
      ]);
      
      setFormLPC(prev => ({
        ...prev,
        data_inicio_consulta: start,
        data_fim_consulta: end,
        ambito: 'Nacional',
        nome_local: '',
        preco_diesel: dieselResult.price,
        preco_gasolina: gasolinaResult.price,
        source: 'API', // Define a fonte como API
      }));
      
      toast.success(`Preços de combustível atualizados via API! Fonte: ${dieselResult.source}`);
      
    } catch (error) {
      // O erro já é tratado e exibido dentro de fetchFuelPrice
    } finally {
      setLoading(false);
    }
  };

  // Handlers para inputs de preço (para permitir vírgula e formatação)
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'preco_diesel' | 'preco_gasolina') => {
    const rawValue = e.target.value;
    // Permite digitação livre, incluindo vírgula ou ponto, mas sem caracteres extras
    const cleanedValue = rawValue.replace(/[^0-9,.]/g, '');
    setFormLPC(prev => ({ 
        ...prev, 
        [field]: cleanedValue,
        source: 'Manual' // Qualquer interação manual com o preço define a fonte como Manual
    }));
  };

  const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, field: 'preco_diesel' | 'preco_gasolina') => {
    const numericValue = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
    setFormLPC(prev => ({ 
        ...prev, 
        [field]: numericValue,
        source: 'Manual' // Ao sair do campo, confirma a fonte como Manual
    }));
  };
  
  // Função para formatar o valor numérico para exibição no input
  const formatPriceForInput = (price: number | string): string => {
    if (typeof price === 'string') {
        // Se for string (durante a digitação), retorna a string
        return price;
    }
    return formatNumberForInput(price, 2);
  };

  // Lógica para exibir a fonte no título
  const displaySource = refLPC?.source || 'Manual';
  const sourceText = displaySource === 'API' ? 'API Externa' : 'Manual';
  const sourceColor = displaySource === 'API' ? 'text-green-700' : 'text-blue-700';
  const sourceBg = displaySource === 'API' ? 'bg-green-100' : 'bg-blue-100';


  return (
    <Card className="mb-6 border-2 border-primary/20" ref={contentRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Referência de Preços - Consulta LPC
            {refLPC && (
                <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${sourceBg} ${sourceColor}`}>
                    {sourceText}
                </span>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsLPCFormExpanded(!isLPCFormExpanded)}
            disabled={loading}
          >
            {isLPCFormExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
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
              <div className="space-y-2">
                <Label>Preço Diesel</Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                    value={formatPriceForInput(formLPC.preco_diesel)}
                    onChange={(e) => handlePriceChange(e, 'preco_diesel')}
                    onBlur={(e) => handlePriceBlur(e, 'preco_diesel')}
                    onKeyDown={handleEnterToNextField}
                    disabled={loading}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$/litro
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Preço Gasolina</Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                    value={formatPriceForInput(formLPC.preco_gasolina)}
                    onChange={(e) => handlePriceChange(e, 'preco_gasolina')}
                    onBlur={(e) => handlePriceBlur(e, 'preco_gasolina')}
                    onKeyDown={handleEnterToNextField}
                    disabled={loading}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$/litro
                  </span>
                </div>
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