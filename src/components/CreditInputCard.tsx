import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp } from "lucide-react";
import { formatCurrency, numberToRawDigits, formatCurrencyInput } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import CurrencyInput from "@/components/CurrencyInput"; // Importar CurrencyInput

interface CreditInputCardProps {
  // Futuramente, podemos passar os totais calculados aqui para mostrar o saldo
  totalGND3Cost: number;
  totalGND4Cost: number;
  initialCreditGND3: number; // Novo prop para receber o valor inicial
  initialCreditGND4: number; // Novo prop para receber o valor inicial
}

// Função auxiliar para converter dígitos brutos (string) para número (float)
const rawDigitsToNumber = (rawDigits: string): number => {
    if (!rawDigits) return 0;
    return formatCurrencyInput(rawDigits).numericValue;
};

export const CreditInputCard = ({ totalGND3Cost, totalGND4Cost, initialCreditGND3, initialCreditGND4 }: CreditInputCardProps) => {
  // Armazena os créditos como dígitos brutos (string)
  const [rawCreditGND3, setRawCreditGND3] = useState<string>(numberToRawDigits(initialCreditGND3));
  const [rawCreditGND4, setRawCreditGND4] = useState<string>(numberToRawDigits(initialCreditGND4));
  const { handleEnterToNextField } = useFormNavigation();

  // Sincroniza o estado interno com os props iniciais
  useEffect(() => {
    setRawCreditGND3(numberToRawDigits(initialCreditGND3));
    setRawCreditGND4(numberToRawDigits(initialCreditGND4));
  }, [initialCreditGND3, initialCreditGND4]);

  // Converte os dígitos brutos para valores numéricos para cálculo
  const creditGND3 = rawDigitsToNumber(rawCreditGND3);
  const creditGND4 = rawDigitsToNumber(rawCreditGND4);

  const saldoGND3 = creditGND3 - totalGND3Cost;
  const saldoGND4 = creditGND4 - totalGND4Cost;

  return (
    <Card className="shadow-lg border-2 border-accent/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl text-accent">
          <TrendingUp className="h-5 w-5" />
          Crédito Disponível
        </CardTitle>
        <CardDescription>
          Informe os valores disponíveis para os Grupos de Natureza de Despesa (GND).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* GND 3 - Custeio (Logística, Operacional, Aviação) */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
          <Label htmlFor="credit-gnd3" className="font-semibold text-sm">GND 3 - Custeio</Label>
          <CurrencyInput
            id="credit-gnd3"
            rawDigits={rawCreditGND3}
            onChange={setRawCreditGND3}
            onKeyDown={handleEnterToNextField}
            placeholder="0,00"
            className="text-lg font-bold"
          />
          
          <div className="flex justify-between text-xs pt-1">
            <span className="text-muted-foreground">Custo Calculado:</span>
            <span className="font-medium text-foreground">{formatCurrency(totalGND3Cost)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t pt-2">
            <span className="text-foreground">SALDO:</span>
            <span className={saldoGND3 >= 0 ? "text-green-600" : "text-destructive"}>
              {formatCurrency(saldoGND3)}
            </span>
          </div>
        </div>

        {/* GND 4 - Material Permanente */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
          <Label htmlFor="credit-gnd4" className="font-semibold text-sm">GND 4 - Investimento (Material Permanente)</Label>
          <CurrencyInput
            id="credit-gnd4"
            rawDigits={rawCreditGND4}
            onChange={setRawCreditGND4}
            onKeyDown={handleEnterToNextField}
            placeholder="0,00"
            className="text-lg font-bold"
          />
          
          <div className="flex justify-between text-xs pt-1">
            <span className="text-muted-foreground">Custo Calculado:</span>
            <span className="font-medium text-foreground">{formatCurrency(totalGND4Cost)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t pt-2">
            <span className="text-foreground">SALDO:</span>
            <span className={saldoGND4 >= 0 ? "text-green-600" : "text-destructive"}>
              {formatCurrency(saldoGND4)}
            </span>
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
};