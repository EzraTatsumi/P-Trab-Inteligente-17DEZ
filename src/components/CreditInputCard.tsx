import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

interface CreditInputCardProps {
  // Futuramente, podemos passar os totais calculados aqui para mostrar o saldo
  totalGND3Cost: number;
  totalGND4Cost: number;
}

export const CreditInputCard = ({ totalGND3Cost, totalGND4Cost }: CreditInputCardProps) => {
  const [creditGND3, setCreditGND3] = useState<number>(0);
  const [creditGND4, setCreditGND4] = useState<number>(0);
  const { handleEnterToNextField } = useFormNavigation();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setCredit: React.Dispatch<React.SetStateAction<number>>) => {
    const value = e.target.value.replace(/[^0-9,.]/g, '').replace(',', '.');
    setCredit(parseFloat(value) || 0);
  };

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
          <div className="relative">
            <Input
              id="credit-gnd3"
              type="text"
              inputMode="decimal"
              value={creditGND3 === 0 ? "" : creditGND3.toFixed(2).replace('.', ',')}
              onChange={(e) => handleInputChange(e, setCreditGND3)}
              placeholder="0,00"
              className="pl-8 text-lg font-bold"
              onKeyDown={handleEnterToNextField}
            />
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          
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
          <div className="relative">
            <Input
              id="credit-gnd4"
              type="text"
              inputMode="decimal"
              value={creditGND4 === 0 ? "" : creditGND4.toFixed(2).replace('.', ',')}
              onChange={(e) => handleInputChange(e, setCreditGND4)}
              placeholder="0,00"
              className="pl-8 text-lg font-bold"
              onKeyDown={handleEnterToNextField}
            />
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          
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