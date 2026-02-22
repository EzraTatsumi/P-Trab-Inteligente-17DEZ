import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { GHOST_DATA } from "@/lib/ghostStore";

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void;
  creditGND3: number;
  creditGND4: number;
}

export const fetchPTrabTotals = async (ptrabId: string) => {
  if (ptrabId.startsWith('ghost-')) {
    return GHOST_DATA.totais_exemplo;
  }

  const { data, error } = await supabase.rpc('get_ptrab_totals_batch' as any, { 
    p_ptrab_ids: [ptrabId] 
  });

  if (error) throw error;

  const row = data?.[0] || {};
  return {
    totalLogisticoGeral: Number(row.total_logistica || 0),
    totalOperacional: Number(row.total_operacional || 0),
    totalMaterialPermanente: Number(row.total_material_permanente || 0),
    totalAviacaoExercito: 0, // Simplificado para o resumo
    totalClasseI: 0,
    totalClasseII: 0,
    totalClasseV: 0,
    totalCombustivel: 0,
    totalLubrificanteValor: 0,
  };
};

export const PTrabCostSummary: React.FC<PTrabCostSummaryProps> = ({ 
  ptrabId, 
  onOpenCreditDialog,
  creditGND3,
  creditGND4
}) => {
  const { data: totals, isLoading } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
  });

  if (isLoading || !totals) return null;

  const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional;
  const totalGND4 = totals.totalMaterialPermanente;

  const percentGND3 = creditGND3 > 0 ? Math.min((totalGND3 / creditGND3) * 100, 100) : 0;
  const percentGND4 = creditGND4 > 0 ? Math.min((totalGND4 / creditGND4) * 100, 100) : 0;

  return (
    <Card className="card-cost-summary shadow-md border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex justify-between items-center">
          Resumo de Custos
          <button 
            onClick={onOpenCreditDialog}
            className="text-[10px] text-primary hover:underline font-normal"
          >
            Editar Teto
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">GND 3 (Custeio)</span>
            <span className="font-bold">{formatCurrency(totalGND3)} / {formatCurrency(creditGND3)}</span>
          </div>
          <Progress value={percentGND3} className="h-2" />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">GND 4 (Investimento)</span>
            <span className="font-bold">{formatCurrency(totalGND4)} / {formatCurrency(creditGND4)}</span>
          </div>
          <Progress value={percentGND4} className="h-2" />
        </div>

        <div className="pt-2 border-t flex justify-between items-center">
          <span className="text-xs font-bold">TOTAL GERAL</span>
          <span className="text-sm font-extrabold text-primary">{formatCurrency(totalGND3 + totalGND4)}</span>
        </div>
      </CardContent>
    </Card>
  );
};