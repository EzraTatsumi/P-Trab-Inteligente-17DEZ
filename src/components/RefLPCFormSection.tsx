import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefLPC } from "@/types/refLPC";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { sanitizeError } from "@/lib/errorUtils";

interface RefLPCFormSectionProps {
  ptrabId: string;
  initialRefLPC: RefLPC | null;
  onSave: (refLPC: RefLPC) => void;
}

export function RefLPCFormSection({ ptrabId, initialRefLPC, onSave }: RefLPCFormSectionProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { handleEnterToNextField } = useFormNavigation();

  const [form, setForm] = useState<Omit<RefLPC, 'id' | 'user_id' | 'p_trab_id' | 'created_at' | 'updated_at'>>({
    data_inicio_consulta: initialRefLPC?.data_inicio_consulta || format(new Date(), 'yyyy-MM-dd'),
    data_fim_consulta: initialRefLPC?.data_fim_consulta || format(new Date(), 'yyyy-MM-dd'),
    ambito: initialRefLPC?.ambito || 'Nacional',
    nome_local: initialRefLPC?.nome_local || null,
    preco_diesel: initialRefLPC?.preco_diesel || 0,
    preco_gasolina: initialRefLPC?.preco_gasolina || 0,
  });

  const [inputDiesel, setInputDiesel] = useState(formatNumberForInput(form.preco_diesel, 2));
  const [inputGasolina, setInputGasolina] = useState(formatNumberForInput(form.preco_gasolina, 2));

  useEffect(() => {
    if (initialRefLPC) {
      setForm({
        data_inicio_consulta: initialRefLPC.data_inicio_consulta,
        data_fim_consulta: initialRefLPC.data_fim_consulta,
        ambito: initialRefLPC.ambito,
        nome_local: initialRefLPC.nome_local,
        preco_diesel: initialRefLPC.preco_diesel,
        preco_gasolina: initialRefLPC.preco_gasolina,
      });
      setInputDiesel(formatNumberForInput(initialRefLPC.preco_diesel, 2));
      setInputGasolina(formatNumberForInput(initialRefLPC.preco_gasolina, 2));
    }
  }, [initialRefLPC]);

  const handleDateChange = (field: 'data_inicio_consulta' | 'data_fim_consulta', date: Date | undefined) => {
    if (date) {
      setForm(prev => ({ ...prev, [field]: format(date, 'yyyy-MM-dd') }));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setInput: React.Dispatch<React.SetStateAction<string>>, field: 'preco_diesel' | 'preco_gasolina') => {
    const rawValue = e.target.value;
    let cleaned = rawValue.replace(/[^\d,.]/g, '');
    const parts = cleaned.split(',');
    if (parts.length > 2) { cleaned = parts[0] + ',' + parts.slice(1).join(''); }
    cleaned = cleaned.replace(/\./g, '');
    
    setInput(cleaned);
    setForm(prev => ({ ...prev, [field]: parseInputToNumber(cleaned) }));
  };

  const handlePriceBlur = (input: string, setInput: React.Dispatch<React.SetStateAction<string>>, field: 'preco_diesel' | 'preco_gasolina') => {
    const numericValue = parseInputToNumber(input);
    const formattedDisplay = formatNumberForInput(numericValue, 2);
    setInput(formattedDisplay);
    setForm(prev => ({ ...prev, [field]: numericValue }));
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }
    if (form.preco_diesel <= 0 || form.preco_gasolina <= 0) {
      toast.error("Os preços do Diesel e da Gasolina devem ser maiores que zero.");
      return;
    }
    if (form.ambito === 'Local' && !form.nome_local) {
      toast.error("Informe o nome do local para consulta de âmbito local.");
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        ...form,
        user_id: user.id,
        p_trab_id: ptrabId,
        nome_local: form.ambito === 'Nacional' ? null : form.nome_local,
      };

      if (initialRefLPC) {
        // Update existing
        const { data, error } = await supabase
          .from("p_trab_ref_lpc")
          .update(dataToSave)
          .eq("id", initialRefLPC.id)
          .select()
          .single();
        
        if (error) throw error;
        onSave(data as RefLPC);
        toast.success("Referência LPC atualizada com sucesso!");
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("p_trab_ref_lpc")
          .insert([dataToSave])
          .select()
          .single();
        
        if (error) throw error;
        onSave(data as RefLPC);
        toast.success("Referência LPC salva com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao salvar LPC:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateString: string) => {
    try {
      return new Date(dateString + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso horário
    } catch {
      return undefined;
    }
  };

  const startDate = parseDate(form.data_inicio_consulta);
  const endDate = parseDate(form.data_fim_consulta);

  return (
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle>Referência LPC (Levantamento de Preços e Custos)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Datas de Consulta */}
          <div className="space-y-2">
            <Label>Data Início da Consulta *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => handleDateChange('data_inicio_consulta', date)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Data Fim da Consulta *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => handleDateChange('data_fim_consulta', date)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Âmbito e Local */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Âmbito da Consulta *</Label>
            <Select
              value={form.ambito}
              onValueChange={(value) => setForm(prev => ({ ...prev, ambito: value as 'Nacional' | 'Local', nome_local: value === 'Nacional' ? null : prev.nome_local }))}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o âmbito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional (LPC/DLOG)</SelectItem>
                <SelectItem value="Local">Local (Pesquisa de Mercado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome do Local (Se Local)</Label>
            <Input
              value={form.nome_local || ""}
              onChange={(e) => setForm(prev => ({ ...prev, nome_local: e.target.value }))}
              placeholder="Ex: Posto Ipiranga - Brasília/DF"
              disabled={form.ambito === 'Nacional' || loading}
              onKeyDown={handleEnterToNextField}
            />
          </div>
        </div>

        {/* Preços */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Preço Diesel (R$/L) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={inputDiesel}
              onChange={(e) => handlePriceChange(e, setInputDiesel, 'preco_diesel')}
              onBlur={(e) => handlePriceBlur(e.target.value, setInputDiesel, 'preco_diesel')}
              placeholder="Ex: 6,50"
              disabled={loading}
              onKeyDown={handleEnterToNextField}
            />
          </div>

          <div className="space-y-2">
            <Label>Preço Gasolina (R$/L) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={inputGasolina}
              onChange={(e) => handlePriceChange(e, setInputGasolina, 'preco_gasolina')}
              onBlur={(e) => handlePriceBlur(e.target.value, setInputGasolina, 'preco_gasolina')}
              placeholder="Ex: 5,80"
              disabled={loading}
              onKeyDown={handleEnterToNextField}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Salvando..." : (initialRefLPC ? "Atualizar LPC" : "Salvar LPC")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}