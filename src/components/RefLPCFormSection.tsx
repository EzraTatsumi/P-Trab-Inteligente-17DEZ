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
import { getPreviousWeekRange, formatNumberForInput } from "@/lib/formatUtils";
import { fetchFuelPrice } from "@/integrations/supabase/api"; // Importar a nova função

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
};

export const RefLPCFormSection = ({ ptrabId, refLPC, onUpdate }: RefLPCFormSectionProps) => {
  const [formLPC, setFormLPC] = useState<RefLPCForm>(initialFormState);
  const [isLPCFormExpanded, setIsLPCFormExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastApiSource, setLastApiSource] = useState<string | null>(null); // Novo estado para a fonte da API
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
      });
      setIsLPCFormExpanded(false);
      // Se o registro existir, limpa a fonte da API (assumindo que foi salvo manualmente)
      setLastApiSource(null); 
    } else {
      setFormLPC(initialFormState);
      setIsLPCFormExpanded(true);
    }
  }, [refLPC]);

  const handleSalvarRefLPC = async () => {
    if (!formLPC.data_inicio_consulta || !formLPC.data_fim_consulta) {
      toast.error("Preencha as datas de início e fim da consulta");
      return;
    }

    if (formLPC.ambito !== 'Nacional' && !formLPC.nome_local) {
      toast.error(`Preencha o nome do ${formLPC.ambito === 'Estadual' ? 'Estado' : 'Município'}`);
      return;
    }

    if (formLPC.preco_diesel <= 0 || formLPC.preco_gasolina <= 0) {
      toast.error("Os preços devem ser maiores que zero");
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        p_trab_id: ptrabId,
        ...formLPC,
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
      setLastApiSource(null); // Limpa a fonte da API após salvar
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
      }));
      
      setLastApiSource(dieselResult.source);
      toast.success("Preços de combustível atualizados via API!");
      
    } catch (error) {
      // O erro já é tratado e exibido dentro de fetchFuelPrice
      setLastApiSource(null);
    } finally {
      setLoading(false);
    }
  };

  // Handlers para inputs de preço (para permitir vírgula e formatação)
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'preco_diesel' | 'preco_gasolina') => {
    const rawValue = e.target.value;
    // Permite digitação livre, incluindo vírgula ou ponto, mas sem caracteres extras
    const cleanedValue = rawValue.replace(/[^0-9,.]/g, '');
    setFormLPC(prev => ({ ...prev, [field]: cleanedValue }));
  };

  const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, field: 'preco_diesel' | 'preco_gasolina') => {
    const numericValue = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
    setFormLPC(prev => ({ ...prev, [field]: numericValue }));
  };
  
  // Função para formatar o valor numérico para exibição no input
  const formatPriceForInput = (price: number | string): string => {
    if (typeof price === 'string') {
        // Se for string (durante a digitação), retorna a string
        return price;
    }
    return formatNumberForInput(price, 2);
  };

  return (
    <Card className="mb-6 border-2 border-primary/20" ref={contentRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Referência de Preços - Consulta LPC
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
            <div className="flex justify-end mb-4">
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
            </div>
            
            {lastApiSource && (
                <Alert className="mb-4 bg-green-500/10 border-green-500/30">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        Consulta realizada com sucesso! Fonte: {lastApiSource}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Início Consulta</Label>
                <Input
                  type="date"
                  value={formLPC.data_inicio_consulta}
                  onChange={(e) => setFormLPC({...formLPC, data_inicio_consulta: e.target.value})}
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Data Fim Consulta</Label>
                <Input
                  type="date"
                  value={formLPC.data_fim_consulta}
                  onChange={(e) => setFormLPC({...formLPC, data_fim_consulta: e.target.value})}
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Âmbito da Pesquisa</Label>
                <Select
                  value={formLPC.ambito}
                  onValueChange={(val) => setFormLPC({...formLPC, ambito: val as 'Nacional' | 'Estadual' | 'Municipal', nome_local: ''})}
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
                    onChange={(e) => setFormLPC({...formLPC, nome_local: e.target.value})}
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
            
            <div className="flex justify-end mt-4">
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