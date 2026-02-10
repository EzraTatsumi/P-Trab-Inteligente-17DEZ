"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button"; // ADICIONADO: Importação faltante
import { formatCurrency } from "@/lib/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calculator, TrendingUp, AlertCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Interface para os totais agregados do P Trab
export interface PTrabAggregatedTotals {
  totalLogisticoGeral: number;
  totalOperacional: number;
  totalMaterialPermanente: number;
  totalAviacaoExercito: number;
  totalClasseI: number;
  totalClasseII: number;
  totalClasseV: number;
  totalCombustivel: number;
  totalLubrificanteValor: number;
  totalHorasVoo: number;
  totalHorasVooND30: number;
  totalHorasVooND39: number;
  quantidadeHorasVoo: number;
  groupedHV: any;
}

/**
 * Busca todos os totais de um P Trab de forma agregada.
 */
export async function fetchPTrabTotals(ptrabId: string): Promise<PTrabAggregatedTotals> {
  try {
    // 1. Classe I
    const { data: classeI } = await supabase.from('classe_i_registros').select('total_qs, total_qr').eq('p_trab_id', ptrabId);
    const totalClasseI = (classeI || []).reduce((sum, r) => sum + Number(r.total_qs || 0) + Number(r.total_qr || 0), 0);

    // 2. Classe II
    const { data: classeII } = await supabase.from('classe_ii_registros').select('valor_total').eq('p_trab_id', ptrabId);
    const totalClasseII = (classeII || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0);

    // 3. Classe V
    const { data: classeV } = await supabase.from('classe_v_registros').select('valor_total').eq('p_trab_id', ptrabId);
    const totalClasseV = (classeV || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0);

    // 4. Outras Classes (VI, VII, VIII, IX)
    const [
      { data: classeVI }, { data: classeVII }, { data: classeVIIISaude }, { data: classeVIIIRemonta }, { data: classeIX }
    ] = await Promise.all([
      supabase.from('classe_vi_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('classe_vii_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('classe_viii_saude_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('classe_viii_remonta_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('classe_ix_registros').select('valor_total').eq('p_trab_id', ptrabId),
    ]);

    const totalOutrasClasses = 
      (classeVI || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (classeVII || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (classeVIIISaude || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (classeVIIIRemonta || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (classeIX || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0);

    // 5. Classe III
    const { data: classeIII } = await supabase.from('classe_iii_registros').select('valor_total, tipo_equipamento').eq('p_trab_id', ptrabId);
    const totalCombustivel = (classeIII || []).filter(r => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO').reduce((sum, r) => sum + Number(r.valor_total || 0), 0);
    const totalLubrificante = (classeIII || []).filter(r => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO').reduce((sum, r) => sum + Number(r.valor_total || 0), 0);

    // 6. Operacional (Diárias, Verba, Passagens, Concessionária, Material Consumo)
    const [
      { data: diarias }, { data: verba }, { data: passagens }, { data: concessionaria }, { data: materialConsumo }
    ] = await Promise.all([
      supabase.from('diaria_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('verba_operacional_registros').select('valor_nd_30, valor_nd_39').eq('p_trab_id', ptrabId),
      supabase.from('passagem_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('concessionaria_registros').select('valor_total').eq('p_trab_id', ptrabId),
      supabase.from('material_consumo_registros').select('valor_total').eq('p_trab_id', ptrabId),
    ]);

    const totalOperacional = 
      (diarias || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (verba || []).reduce((sum, r) => sum + Number(r.valor_nd_30 || 0) + Number(r.valor_nd_39 || 0), 0) +
      (passagens || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (concessionaria || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0) +
      (materialConsumo || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0);

    // 7. Horas de Voo (AvEx)
    const { data: horasVoo } = await supabase.from('horas_voo_registros').select('valor_total, valor_nd_30, valor_nd_39, quantidade_hv').eq('p_trab_id', ptrabId);
    const totalHorasVoo = (horasVoo || []).reduce((sum, r) => sum + Number(r.valor_total || 0), 0);
    const totalHorasVooND30 = (horasVoo || []).reduce((sum, r) => sum + Number(r.valor_nd_30 || 0), 0);
    const totalHorasVooND39 = (horasVoo || []).reduce((sum, r) => sum + Number(r.valor_nd_39 || 0), 0);
    const quantidadeHorasVoo = (horasVoo || []).reduce((sum, r) => sum + Number(r.quantidade_hv || 0), 0);

    return {
      totalLogisticoGeral: totalClasseI + totalClasseII + totalClasseV + totalOutrasClasses + totalCombustivel + totalLubrificante,
      totalOperacional,
      totalMaterialPermanente: 0,
      totalAviacaoExercito: totalHorasVoo,
      totalClasseI,
      totalClasseII,
      totalClasseV,
      totalCombustivel,
      totalLubrificanteValor: totalLubrificante,
      totalHorasVoo,
      totalHorasVooND30,
      totalHorasVooND39,
      quantidadeHorasVoo,
      groupedHV: horasVoo || [],
    };
  } catch (error) {
    console.error("Erro ao buscar totais do P Trab:", error);
    return {
      totalLogisticoGeral: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0,
      totalClasseI: 0, totalClasseII: 0, totalClasseV: 0, totalCombustivel: 0, totalLubrificanteValor: 0,
      totalHorasVoo: 0, totalHorasVooND30: 0, totalHorasVooND39: 0, quantidadeHorasVoo: 0, groupedHV: []
    };
  }
}

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void;
  creditGND3: number;
  creditGND4: number;
}

export const PTrabCostSummary: React.FC<PTrabCostSummaryProps> = ({
  ptrabId,
  onOpenCreditDialog,
  creditGND3,
  creditGND4,
}) => {
  const [totals, setTotals] = React.useState<PTrabAggregatedTotals | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchPTrabTotals(ptrabId).then(data => {
      setTotals(data);
      setLoading(false);
    });
  }, [ptrabId]);

  if (loading || !totals) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const totalGND4 = totals.totalMaterialPermanente;
  const totalGeral = totalGND3 + totalGND4;

  const saldoGND3 = creditGND3 - totalGND3;
  const saldoGND4 = creditGND4 - totalGND4;

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Resumo de Custos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-muted-foreground">Total GND 3 (Custeio):</Label>
            <span className="font-bold text-blue-600">{formatCurrency(totalGND3)}</span>
          </div>
          <div className="flex justify-between items-center">
            <Label className="text-muted-foreground">Total GND 4 (Investimento):</Label>
            <span className="font-bold text-green-600">{formatCurrency(totalGND4)}</span>
          </div>
          <div className="pt-2 border-t flex justify-between items-center">
            <Label className="font-bold">TOTAL GERAL:</Label>
            <span className="font-extrabold text-lg">{formatCurrency(totalGeral)}</span>
          </div>
        </div>

        <div className="bg-muted/50 p-3 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Crédito Disponível
            </h4>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onOpenCreditDialog}>
              Editar
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>GND 3:</span>
              <span className="font-medium">{formatCurrency(creditGND3)}</span>
            </div>
            <div className="flex justify-between">
              <span>GND 4:</span>
              <span className="font-medium">{formatCurrency(creditGND4)}</span>
            </div>
          </div>

          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Saldo GND 3:</span>
              <span className={cn("font-bold", saldoGND3 < 0 ? "text-destructive" : "text-green-600")}>
                {formatCurrency(saldoGND3)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Saldo GND 4:</span>
              <span className={cn("font-bold", saldoGND4 < 0 ? "text-destructive" : "text-green-600")}>
                {formatCurrency(saldoGND4)}
              </span>
            </div>
          </div>
          
          {(saldoGND3 < 0 || saldoGND4 < 0) && (
            <div className="flex items-center gap-2 text-[10px] text-destructive font-medium bg-destructive/10 p-2 rounded border border-destructive/20">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Atenção: O custo excede o crédito disponível.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};