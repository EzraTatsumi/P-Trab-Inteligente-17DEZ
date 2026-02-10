"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Wallet, TrendingUp, Package, Briefcase } from "lucide-react";

export interface PTrabTotals {
  totalLogisticoGeral: number;
  totalOperacional: number;
  totalMaterialPermanente: number;
  totalAviacaoExercito: number;
  totalClasseI: number;
  totalClasseII: number;
  totalClasseV: number;
  totalClasseVI: number;
  totalClasseVII: number;
  totalClasseVIII: number;
  totalClasseIX: number;
  totalCombustivel: number;
  totalLubrificanteValor: number;
  totalDiarias: number;
  totalVerbaOp: number;
  totalPassagens: number;
  totalConcessionaria: number;
  totalMaterialConsumo: number;
}

/**
 * Busca e calcula todos os totais de um P Trab agregando dados de todas as tabelas de registros.
 */
export const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabTotals> => {
  const [
    { data: cl1 },
    { data: cl2 },
    { data: cl3 },
    { data: cl5 },
    { data: cl6 },
    { data: cl7 },
    { data: cl8s },
    { data: cl8r },
    { data: cl9 },
    { data: diarias },
    { data: verbaOp },
    { data: passagens },
    { data: concessionaria },
    { data: materialConsumo },
    { data: horasVoo },
  ] = await Promise.all([
    supabase.from('classe_i_registros').select('total_qs, total_qr').eq('p_trab_id', ptrabId),
    supabase.from('classe_ii_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('classe_iii_registros').select('valor_total, tipo_equipamento').eq('p_trab_id', ptrabId),
    supabase.from('classe_v_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('classe_vi_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('classe_vii_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('classe_viii_saude_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('classe_viii_remonta_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('classe_ix_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('diaria_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('verba_operacional_registros').select('valor_total_solicitado').eq('p_trab_id', ptrabId),
    supabase.from('passagem_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('concessionaria_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('material_consumo_registros').select('valor_total').eq('p_trab_id', ptrabId),
    supabase.from('horas_voo_registros').select('valor_total').eq('p_trab_id', ptrabId),
  ]);

  const sum = (arr: any[] | null, key: string) => (arr || []).reduce((acc, item) => acc + Number(item[key] || 0), 0);

  const totalClasseI = (cl1 || []).reduce((acc, item) => acc + Number(item.total_qs || 0) + Number(item.total_qr || 0), 0);
  const totalClasseII = sum(cl2, 'valor_total');
  const totalClasseV = sum(cl5, 'valor_total');
  const totalClasseVI = sum(cl6, 'valor_total');
  const totalClasseVII = sum(cl7, 'valor_total');
  const totalClasseVIII = sum(cl8s, 'valor_total') + sum(cl8r, 'valor_total');
  const totalClasseIX = sum(cl9, 'valor_total');

  const totalCombustivel = (cl3 || [])
    .filter(r => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO')
    .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
    
  const totalLubrificanteValor = (cl3 || [])
    .filter(r => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO')
    .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);

  const totalLogisticoGeral = totalClasseI + totalClasseII + totalClasseV + totalClasseVI + totalClasseVII + totalClasseVIII + totalClasseIX + totalCombustivel + totalLubrificanteValor;

  const totalDiarias = sum(diarias, 'valor_total');
  const totalVerbaOp = sum(verbaOp, 'valor_total_solicitado');
  const totalPassagens = sum(passagens, 'valor_total');
  const totalConcessionaria = sum(concessionaria, 'valor_total');
  const totalMaterialConsumo = sum(materialConsumo, 'valor_total');
  const totalAviacaoExercito = sum(horasVoo, 'valor_total');

  const totalOperacional = totalDiarias + totalVerbaOp + totalPassagens + totalConcessionaria + totalMaterialConsumo + totalAviacaoExercito;

  return {
    totalLogisticoGeral,
    totalOperacional,
    totalMaterialPermanente: 0, // Implementar quando houver tabela de material permanente
    totalAviacaoExercito,
    totalClasseI,
    totalClasseII,
    totalClasseV,
    totalClasseVI,
    totalClasseVII,
    totalClasseVIII,
    totalClasseIX,
    totalCombustivel,
    totalLubrificanteValor,
    totalDiarias,
    totalVerbaOp,
    totalPassagens,
    totalConcessionaria,
    totalMaterialConsumo,
  };
};

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
  const [totals, setTotals] = React.useState<PTrabTotals | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadTotals = async () => {
      try {
        const data = await fetchPTrabTotals(ptrabId);
        setTotals(data);
      } catch (error) {
        console.error("Erro ao carregar totais:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTotals();
  }, [ptrabId]);

  if (loading || !totals) {
    return <div className="p-4 text-center text-muted-foreground">Calculando totais...</div>;
  }

  const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional;
  const totalGND4 = totals.totalMaterialPermanente;
  const saldoGND3 = creditGND3 - totalGND3;
  const saldoGND4 = creditGND4 - totalGND4;

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Resumo de Custos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {/* GND 3 */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-bold text-primary">GND 3 (Custeio)</Label>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Operacional + Logístico</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Crédito Disponível:</span>
              <span className="font-semibold">{formatCurrency(creditGND3)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Planejado:</span>
              <span className="font-semibold text-orange-600">{formatCurrency(totalGND3)}</span>
            </div>
            <div className="pt-1 border-t flex justify-between text-sm font-bold">
              <span>Saldo:</span>
              <span className={saldoGND3 < 0 ? "text-destructive" : "text-green-600"}>
                {formatCurrency(saldoGND3)}
              </span>
            </div>
          </div>

          {/* GND 4 */}
          <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-bold text-green-700">GND 4 (Investimento)</Label>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Material Permanente</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Crédito Disponível:</span>
              <span className="font-semibold">{formatCurrency(creditGND4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Planejado:</span>
              <span className="font-semibold text-orange-600">{formatCurrency(totalGND4)}</span>
            </div>
            <div className="pt-1 border-t flex justify-between text-sm font-bold">
              <span>Saldo:</span>
              <span className={saldoGND4 < 0 ? "text-destructive" : "text-green-600"}>
                {formatCurrency(saldoGND4)}
              </span>
            </div>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full gap-2 border-primary/30 hover:bg-primary/5"
          onClick={onOpenCreditDialog}
        >
          <Wallet className="h-4 w-4" />
          Atualizar Créditos Disponíveis
        </Button>
      </CardContent>
    </Card>
  );
};