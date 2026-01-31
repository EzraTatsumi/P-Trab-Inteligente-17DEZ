import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/formatUtils";

interface PTrabCostSummaryProps {
  totalGND3Cost: number;
  totalGND4Cost: number;
}

export const PTrabCostSummary: React.FC<PTrabCostSummaryProps> = ({ totalGND3Cost, totalGND4Cost }) => {
  const totalCost = totalGND3Cost + totalGND4Cost;

  return (
    <Card className="shadow-lg border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl text-primary">
          <DollarSign className="h-5 w-5" />
          Resumo de Custos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">GND 3 (Custeio):</span>
          <span className="font-medium text-foreground">{formatCurrency(totalGND3Cost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">GND 4 (Investimento):</span>
          <span className="font-medium text-foreground">{formatCurrency(totalGND4Cost)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span className="text-foreground">CUSTO TOTAL:</span>
          <span className="text-primary">
            {formatCurrency(totalCost)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};