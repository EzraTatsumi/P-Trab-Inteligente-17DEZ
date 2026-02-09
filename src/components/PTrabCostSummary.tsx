import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
import { Package, Loader2, ChevronRight, HardHat, TrendingUp, Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// --- TIPOS E CONSTANTES ---

interface OmTotals {
    omKey: string;
    omName: string;
    ug: string;
    totalGeral: number;
    totalLogistica: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
    
    classeI: { total: number; totalRacoesOperacionaisGeral: number };
    classeII: { total: number, groupedCategories: Record<string, any> };
    classeIII: { total: number };
    classeV: { total: number, groupedCategories: Record<string, any> };
    classeVI: { total: number, groupedCategories: Record<string, any> };
    classeVII: { total: number, groupedCategories: Record<string, any> };
    classeVIII: { total: number, groupedCategories: Record<string, any> };
    classeIX: { total: number, groupedCategories: Record<string, any> };
    
    diarias: { total: number };
    verbaOperacional: { total: number };
    suprimentoFundos: { total: number };
    passagens: { total: number };
    concessionaria: { total: number };
    horasVoo: { total: number, quantidadeHV: number, groupedHV: Record<string, any> };
    materialConsumo: { total: number };
}

interface PTrabAggregatedTotals {
    totalLogisticoGeral: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
    totalRacoesOperacionaisGeral: number;
    quantidadeHorasVoo: number;
    groupedByOm: Record<string, OmTotals>;
}

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void;
  creditGND3: number;
  creditGND4: number;
}

// --- COMPONENTE: InteractiveCard ---

interface InteractiveCardProps {
    label: string;
    value: number;
    icon: any;
    colorClass: string;
    details: Record<string, number>;
    unit?: string;
}

const InteractiveCard = ({ label, value, icon: Icon, colorClass, details, unit }: InteractiveCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (value === 0) return null;

    // Proteção contra details nulo ou indefinido
    const safeDetails = details || {};
    const detailEntries = Object.entries(safeDetails).filter(([_, val]) => val > 0);

    return (
        <div 
            className={cn(
                "group flex flex-col rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer",
                isExpanded 
                    ? "ring-2 ring-primary border-transparent bg-card shadow-lg scale-[1.02]" 
                    : "border-border/50 bg-card/40 hover:bg-accent/5"
            )}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-110", colorClass)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">{label}</p>
                        <p className="text-sm font-black text-foreground">
                            {unit ? `${formatNumber(value, 2)} ${unit}` : formatCurrency(value)}
                        </p>
                    </div>
                </div>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
            </div>

            <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-2 border-t border-dashed border-border/50 space-y-2 mx-4 mt-1">
                        {detailEntries.map(([name, val]) => (
                            <div key={name} className="flex justify-between items-center text-[11px]">
                                <span className="text-muted-foreground font-medium">{name}</span>
                                <span className="font-bold text-foreground">
                                    {unit && name.includes("Total") ? `${formatNumber(val, 2)} ${unit}` : formatCurrency(val)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: OmDetailsDialog ---

interface OmDetailsDialogProps {
    om: OmTotals | null;
    totals: PTrabAggregatedTotals;
    onClose: () => void;
}

const OmDetailsDialog = ({ om, totals, onClose }: OmDetailsDialogProps) => {
    if (!om) return null;
    
    const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
    const omGND3Total = om.totalLogistica + om.totalOperacional + om.totalAviacaoExercito;
    const impactPercentage = totalGND3 > 0 ? ((omGND3Total / totalGND3) * 100).toFixed(1) : '0.0';

    const logisticaDetails = {
        "Classe I (Alimentação)": om.classeI.total,
        "Classe II (Intendência)": om.classeII.total,
        "Classe III (Combustíveis)": om.classeIII.total,
        "Classe V (Armamento)": om.classeV.total,
        "Classe VI (Engenharia)": om.classeVI.total,
        "Classe VII (Comunicações)": om.classeVII.total,
        "Classe VIII (Saúde/Remonta)": om.classeVIII.total,
        "Classe IX (Manutenção)": om.classeIX.total,
    };

    const operacionalDetails = {
        "Diárias": om.diarias.total,
        "Passagens": om.passagens.total,
        "Verba Operacional": om.verbaOperacional.total,
        "Suprimento de Fundos": om.suprimentoFundos.total,
        "Concessionárias": om.concessionaria.total,
        "Material de Consumo": om.materialConsumo.total,
    };

    const aviacaoDetails: Record<string, number> = {};
    if (om.horasVoo && om.horasVoo.groupedHV) {
        Object.entries(om.horasVoo.groupedHV).forEach(([tipo, data]: [string, any]) => {
            aviacaoDetails[`${tipo} (${formatNumber(data.totalHV, 1)} HV)`] = data.totalValor;
        });
    }

    return (
        <Dialog open={!!om} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-card">
                    <DialogTitle className="text-2xl font-bold">{om.omName}</DialogTitle>
                    <DialogDescription className="text-sm">
                        UG: {formatCodug(om.ug)} | Total Geral: {formatCurrency(om.totalGeral)}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto p-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InteractiveCard 
                            label="Aba Logística"
                            value={om.totalLogistica}
                            icon={Package}
                            colorClass="bg-orange-500/10 text-orange-600"
                            details={logisticaDetails}
                        />
                        <InteractiveCard 
                            label="Aba Operacional"
                            value={om.totalOperacional}
                            icon={Activity}
                            colorClass="bg-blue-500/10 text-blue-600"
                            details={operacionalDetails}
                        />
                        <InteractiveCard 
                            label="Aviação do Exército"
                            value={om.horasVoo.total}
                            icon={Zap}
                            colorClass="bg-purple-500/10 text-purple-600"
                            details={aviacaoDetails}
                        />
                        <InteractiveCard 
                            label="Material Permanente"
                            value={om.totalMaterialPermanente}
                            icon={HardHat}
                            colorClass="bg-green-500/10 text-green-600"
                            details={{ "Itens de Investimento": om.totalMaterialPermanente }}
                        />
                    </div>
                </div>
                
                <div className="p-6 pt-4 border-t border-border/30 bg-muted/5">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Impacto no Orçamento GND 3</span>
                        <span className="text-xs font-bold text-primary">{impactPercentage}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                        <div 
                            className="bg-primary h-full transition-all duration-700 ease-out" 
                            style={{ width: `${impactPercentage}%` }}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// --- FUNÇÃO DE BUSCA DE TOTAIS ---

const initializeOmTotals = (omName: string, ug: string): OmTotals => ({
    omKey: `${omName}|${ug}`, omName, ug, totalGeral: 0, totalLogistica: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0,
    classeI: { total: 0, totalRacoesOperacionaisGeral: 0 },
    classeII: { total: 0, groupedCategories: {} },
    classeIII: { total: 0 },
    classeV: { total: 0, groupedCategories: {} },
    classeVI: { total: 0, groupedCategories: {} },
    classeVII: { total: 0, groupedCategories: {} },
    classeVIII: { total: 0, groupedCategories: {} },
    classeIX: { total: 0, groupedCategories: {} },
    diarias: { total: 0 },
    verbaOperacional: { total: 0 },
    suprimentoFundos: { total: 0 },
    passagens: { total: 0 },
    concessionaria: { total: 0 },
    horasVoo: { total: 0, quantidadeHV: 0, groupedHV: {} },
    materialConsumo: { total: 0 },
});

const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabAggregatedTotals> => {
  const groupedByOm: Record<string, OmTotals> = {};
  const getOmTotals = (omName: string, ug: string): OmTotals => {
      const key = `${omName}|${ug}`;
      if (!groupedByOm[key]) groupedByOm[key] = initializeOmTotals(omName, ug);
      return groupedByOm[key];
  };
  
  const results = await Promise.all([
    supabase.from('classe_i_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_ii_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_v_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_vi_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_vii_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_viii_saude_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_viii_remonta_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_ix_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('classe_iii_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('diaria_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('verba_operacional_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('passagem_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('concessionaria_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('horas_voo_registros').select('*').eq('p_trab_id', ptrabId),
    supabase.from('material_consumo_registros').select('*').eq('p_trab_id', ptrabId),
  ]);

  const [
    { data: classeIData }, { data: classeIIData }, { data: classeVData }, { data: classeVIData },
    { data: classeVIIData }, { data: classeVIIISaudeData }, { data: classeVIIIRemontaData },
    { data: classeIXData }, { data: classeIIIData }, { data: diariaData },
    { data: verbaOperacionalData }, { data: passagemData }, { data: concessionariaData },
    { data: horasVooData }, { data: materialConsumoData }
  ] = results;

  (classeIData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    if (record.categoria === 'RACAO_QUENTE') {
        om.classeI.total += (record.total_qs || 0) + (record.total_qr || 0);
        om.totalLogistica += (record.total_qs || 0) + (record.total_qr || 0);
    } else {
        om.classeI.totalRacoesOperacionaisGeral += (record.quantidade_r2 || 0) + (record.quantidade_r3 || 0);
    }
  });

  const processGenericClass = (data: any[], key: keyof OmTotals) => {
    (data || []).forEach(record => {
        const om = getOmTotals(record.organizacao, record.ug);
        const val = Number(record.valor_total || 0);
        (om[key] as any).total += val;
        om.totalLogistica += val;
        const cat = record.categoria || 'Geral';
        if (!(om[key] as any).groupedCategories[cat]) (om[key] as any).groupedCategories[cat] = { totalValor: 0 };
        (om[key] as any).groupedCategories[cat].totalValor += val;
    });
  };

  processGenericClass(classeIIData, 'classeII');
  processGenericClass(classeVData, 'classeV');
  processGenericClass(classeVIData, 'classeVI');
  processGenericClass(classeVIIData, 'classeVII');
  processGenericClass(classeVIIISaudeData, 'classeVIII');
  processGenericClass(classeVIIIRemontaData, 'classeVIII');
  processGenericClass(classeIXData, 'classeIX');

  (classeIIIData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    om.classeIII.total += (record.valor_total || 0);
    om.totalLogistica += (record.valor_total || 0);
  });

  (diariaData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_nd_15 || 0) + (record.valor_nd_30 || 0);
    om.diarias.total += val;
    om.totalOperacional += val;
  });

  (verbaOperacionalData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_nd_30 || 0) + (record.valor_nd_39 || 0);
    om.totalOperacional += val;
    if (record.detalhamento === 'Suprimento de Fundos') om.suprimentoFundos.total += val;
    else om.verbaOperacional.total += val;
  });

  (passagemData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    om.passagens.total += (record.valor_nd_33 || 0);
    om.totalOperacional += (record.valor_nd_33 || 0);
  });

  (concessionariaData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    om.concessionaria.total += (record.valor_nd_39 || 0);
    om.totalOperacional += (record.valor_nd_39 || 0);
  });

  (horasVooData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    om.horasVoo.total += (record.valor_total || 0);
    om.totalAviacaoExercito += (record.valor_total || 0);
    const tipo = record.tipo_anv || 'Aeronave';
    if (!om.horasVoo.groupedHV[tipo]) om.horasVoo.groupedHV[tipo] = { totalValor: 0, totalHV: 0 };
    om.horasVoo.groupedHV[tipo].totalValor += (record.valor_total || 0);
    om.horasVoo.groupedHV[tipo].totalHV += (record.quantidade_hv || 0);
  });

  (materialConsumoData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    om.materialConsumo.total += (record.valor_total || 0);
    om.totalOperacional += (record.valor_total || 0);
  });

  const globalTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0,
      totalRacoesOperacionaisGeral: 0, quantidadeHorasVoo: 0, groupedByOm
  };

  Object.values(groupedByOm).forEach(om => {
      globalTotals.totalLogisticoGeral += om.totalLogistica;
      globalTotals.totalOperacional += om.totalOperacional;
      globalTotals.totalAviacaoExercito += om.totalAviacaoExercito;
      globalTotals.totalRacoesOperacionaisGeral += om.classeI.totalRacoesOperacionaisGeral;
      globalTotals.quantidadeHorasVoo += om.horasVoo.quantidadeHV;
      om.totalGeral = om.totalLogistica + om.totalOperacional + om.totalAviacaoExercito;
  });

  return globalTotals;
};

// --- COMPONENTE PRINCIPAL: PTrabCostSummary ---

export const PTrabCostSummary = ({ ptrabId, onOpenCreditDialog, creditGND3, creditGND4 }: PTrabCostSummaryProps) => {
  const { data: totals, isLoading } = useQuery<PTrabAggregatedTotals>({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000,
  });
  
  const [viewMode, setViewMode] = useState<'global' | 'byOm'>('global');
  const [selectedOm, setSelectedOm] = useState<OmTotals | null>(null);

  if (isLoading || !totals) return <Card className="p-6 flex justify-center"><Loader2 className="animate-spin" /></Card>;

  const totalGeralFinal = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const saldoGND3 = creditGND3 - (totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito);
  const saldoGND4 = creditGND4 - totals.totalMaterialPermanente;

  const sortedOmTotals = Object.values(totals.groupedByOm).sort((a, b) => b.totalGeral - a.totalGeral);

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        <CardDescription className="text-xs">Visão consolidada dos custos logísticos e orçamentários.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-3">
        
        <div className="w-full space-y-1 text-sm px-6 pt-3">
            {viewMode === 'global' ? (
                <>
                    <div className="flex justify-between text-orange-600 font-semibold">
                        <span>Aba Logística</span>
                        <span>{formatCurrency(totals.totalLogisticoGeral)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-semibold">
                        <span>Aba Operacional</span>
                        <span>{formatCurrency(totals.totalOperacional)}</span>
                    </div>
                    <div className="flex justify-between text-purple-600 font-semibold">
                        <span>Aviação do Exército</span>
                        <span>{formatCurrency(totals.totalAviacaoExercito)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                        <span>Aba Material Permanente</span>
                        <span>{formatCurrency(totals.totalMaterialPermanente)}</span>
                    </div>
                </>
            ) : (
                sortedOmTotals.map(om => (
                    <div key={om.omKey} className="flex justify-between items-center p-1 hover:bg-muted/50 rounded cursor-pointer" onClick={() => setSelectedOm(om)}>
                        <span className="font-semibold">{om.omName}</span>
                        <span className="font-bold text-primary">{formatCurrency(om.totalGeral)}</span>
                    </div>
                ))
            )}
        </div>

        <div className="px-6 py-2 border-t border-border/50 flex justify-between items-center">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">Total Geral</span>
                <Button variant="outline" size="sm" className="h-6 text-[10px] mt-1" onClick={() => setViewMode(viewMode === 'global' ? 'byOm' : 'global')}>
                    {viewMode === 'global' ? 'Ver por OM' : 'Voltar ao Global'}
                </Button>
            </div>
            <span className="text-lg font-black text-foreground">{formatCurrency(totalGeralFinal)}</span>
        </div>

        <div className="px-6 pt-2 space-y-2">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-accent flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Saldo GND 3</h4>
                <span className={cn("font-bold text-base", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>{formatCurrency(saldoGND3)}</span>
            </div>
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-xs text-accent flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Saldo GND 4</h4>
                <span className={cn("font-bold text-base", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>{formatCurrency(saldoGND4)}</span>
            </div>
            <Button onClick={onOpenCreditDialog} variant="outline" className="w-full mt-2 border-accent text-accent hover:bg-accent/10 h-8 text-xs">Informar Crédito</Button>
        </div>
      </CardContent>
      
      <OmDetailsDialog om={selectedOm} totals={totals} onClose={() => setSelectedOm(null)} />
    </Card>
  );
};

export { fetchPTrabTotals };