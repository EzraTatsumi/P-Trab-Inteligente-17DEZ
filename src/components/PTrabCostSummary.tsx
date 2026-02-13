"use client";

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { 
  Briefcase, 
  Package, 
  TrendingUp, 
  Wallet, 
  Plane,
  ChevronDown, 
  ChevronUp,
  Info,
  AlertCircle,
  FileText,
  Sparkles,
  Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// --- Tipos e Interfaces ---

interface PTrabTotals {
  totalLogisticoGeral: number;
  totalOperacional: number;
  totalMaterialPermanente: number;
  totalAviacaoExercito: number;
  totalClasseI: number;
  totalClasseII: number;
  totalClasseV: number;
  totalCombustivel: number;
  totalLubrificanteValor: number;
  // Detalhamento por OM
  omBreakdown: Record<string, OMTotal>;
}

interface OMTotal {
  nome: string;
  ug: string;
  totalLogistica: number;
  totalOperacional: number;
  totalAviacaoExercito: number;
  totalGeral: number;
  // Detalhamento de HV
  quantidadeHV: number;
  groupedHV: Record<string, { totalHV: number }>;
}

// --- Função de Busca de Totais ---

export const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabTotals> => {
  if (!ptrabId) throw new Error("ID do PTrab não fornecido.");

  const [
    { data: cl1 }, { data: cl2 }, { data: cl3 }, { data: cl5 }, 
    { data: cl6 }, { data: cl7 }, { data: cl8s }, { data: cl8r }, 
    { data: cl9 }, { data: di }, { data: vo }, { data: pa }, 
    { data: co }, { data: hv }, { data: mc }, { data: ca }
  ] = await Promise.all([
    supabase.from('classe_i_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_ii_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_iii_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_v_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_vi_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_vii_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_viii_saude_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_viii_remonta_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_ix_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('diaria_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('verba_operacional_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('passagem_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('concessionaria_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('horas_voo_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('material_consumo_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('complemento_alimentacao_registros').select('*').eq('p_trab_id', ptrabId),
  ]);

  const omBreakdown: Record<string, OMTotal> = {};

  const getOM = (nome: string, ug: string) => {
    const key = `${nome}-${ug}`;
    if (!omBreakdown[key]) {
      omBreakdown[key] = { 
        nome, ug, totalLogistica: 0, totalOperacional: 0, 
        totalAviacaoExercito: 0, totalGeral: 0, quantidadeHV: 0, groupedHV: {} 
      };
    }
    return omBreakdown[key];
  };

  // Processar Logística
  (cl1 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    const val = Number(r.total_qs || 0) + Number(r.total_qr || 0);
    om.totalLogistica += val; om.totalGeral += val;
  });
  (cl2 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl3 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl5 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl6 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl7 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl8s || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl8r || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (cl9 || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalLogistica += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });

  // Processar Operacional
  (di || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalOperacional += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (vo || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalOperacional += Number(r.valor_total_solicitado || 0); om.totalGeral += Number(r.valor_total_solicitado || 0);
  });
  (pa || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalOperacional += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (co || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalOperacional += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (mc || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalOperacional += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });
  (ca || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    om.totalOperacional += Number(r.valor_total || 0); om.totalGeral += Number(r.valor_total || 0);
  });

  // Processar Aviação do Exército
  (hv || []).forEach(r => { 
    const om = getOM(r.organizacao, r.ug);
    const val = Number(r.valor_total || 0);
    om.totalAviacaoExercito += val; om.totalGeral += val;
    om.quantidadeHV += Number(r.quantidade_hv || 0);
    if (!om.groupedHV[r.tipo_anv]) om.groupedHV[r.tipo_anv] = { totalHV: 0 };
    om.groupedHV[r.tipo_anv].totalHV += Number(r.quantidade_hv || 0);
  });

  const totals = Object.values(omBreakdown).reduce((acc, om) => {
    acc.totalLogisticoGeral += om.totalLogistica;
    acc.totalOperacional += om.totalOperacional;
    acc.totalAviacaoExercito += om.totalAviacaoExercito;
    return acc;
  }, { totalLogisticoGeral: 0, totalOperacional: 0, totalAviacaoExercito: 0, totalMaterialPermanente: 0, totalClasseI: 0, totalClasseII: 0, totalClasseV: 0, totalCombustivel: 0, totalLubrificanteValor: 0, omBreakdown });

  return totals;
};

// --- Componentes Internos ---

const CostCard = ({ label, value, icon: Icon, colorClass, creditValue }: { label: string, value: number, icon: any, colorClass: string, creditValue?: number }) => {
  const isOverBudget = creditValue !== undefined && value > creditValue;
  
  return (
    <Card className="overflow-hidden border-none shadow-md bg-background/50 backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={cn("p-3 rounded-lg transition-colors", colorClass)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold leading-none mb-2 truncate">{label}</span>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight leading-none">{formatCurrency(value)}</span>
              {creditValue !== undefined && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant={isOverBudget ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 font-bold">
                    {isOverBudget ? "DÉFICIT" : "SALDO"}
                  </Badge>
                  <span className={cn("text-[10px] font-bold", isOverBudget ? "text-destructive" : "text-green-600")}>
                    {formatCurrency(Math.abs(creditValue - value))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Componente Principal ---

export const PTrabCostSummary = ({ ptrabId, onOpenCreditDialog, creditGND3, creditGND4 }: { ptrabId: string, onOpenCreditDialog: () => void, creditGND3: number, creditGND4: number }) => {
  const { data: totals, isLoading } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
  });

  if (isLoading || !totals) return <Skeleton className="h-[400px] w-full" />;

  const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const totalGND4 = totals.totalMaterialPermanente;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <CostCard 
          label="Total GND 3 (Custeio)" 
          value={totalGND3} 
          icon={Wallet} 
          colorClass="bg-blue-100 text-blue-600" 
          creditValue={creditGND3}
        />
        <CostCard 
          label="Total GND 4 (Investimento)" 
          value={totalGND4} 
          icon={TrendingUp} 
          colorClass="bg-green-100 text-green-600" 
          creditValue={creditGND4}
        />
      </div>

      <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-purple-700">
            <Plane className="h-5 w-5" />
            Aviação do Exército
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-end border-b border-purple-200 pb-3">
            <span className="text-sm font-medium text-purple-600">Total Estimado</span>
            <span className="text-2xl font-black text-purple-800">{formatCurrency(totals.totalAviacaoExercito)}</span>
          </div>

          <div className="space-y-3">
            {Object.values(totals.omBreakdown).filter(om => om.totalAviacaoExercito > 0).map(om => (
              <div key={om.ug} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-muted-foreground uppercase">{om.nome}</span>
                  <span className="text-sm font-bold">{formatCurrency(om.totalAviacaoExercito)}</span>
                </div>
                
                <div className="space-y-1.5 border-l-2 border-purple-200 pl-3 py-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-purple-600/70 uppercase tracking-tighter">
                    <div className="flex items-center gap-1.5">
                      <Plane className="h-3 w-3" />
                      Horas de Voo
                    </div>
                    <span>{formatNumber(om.quantidadeHV, 2)} HV</span>
                  </div>
                  {Object.entries(om.groupedHV).map(([tipo, data]) => (
                    <div key={tipo} className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{tipo}</span>
                      <span className="font-medium">{formatNumber(data.totalHV, 2)} HV</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button 
        variant="outline" 
        className="w-full border-dashed border-2 hover:bg-muted/50 font-bold text-xs uppercase tracking-widest"
        onClick={onOpenCreditDialog}
      >
        <Settings className="mr-2 h-4 w-4" />
        Configurar Créditos Disponíveis
      </Button>
    </div>
  );
};

export default PTrabCostSummary;