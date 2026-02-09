import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
import { Package, Loader2, ChevronRight, HardHat, TrendingUp, Activity, Zap, Swords, Radio, HeartPulse, Truck, Briefcase, Droplet, Plane, Utensils, Fuel, Wallet, ClipboardList } from "lucide-react";
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
    
    classeI: { total: number; details: Record<string, number> };
    classeII: { total: number, details: Record<string, number> };
    classeIII: { total: number, details: Record<string, number> };
    classeV: { total: number, details: Record<string, number> };
    classeVI: { total: number, details: Record<string, number> };
    classeVII: { total: number, details: Record<string, number> };
    classeVIII: { total: number, details: Record<string, number> };
    classeIX: { total: number, details: Record<string, number> };
    
    diarias: { total: number, details: Record<string, number> };
    verbaOperacional: { total: number, details: Record<string, number> };
    suprimentoFundos: { total: number, details: Record<string, number> };
    passagens: { total: number, details: Record<string, number> };
    concessionaria: { total: number, details: Record<string, number> };
    horasVoo: { total: number, details: Record<string, number> };
    materialConsumo: { total: number, details: Record<string, number> };
}

interface PTrabAggregatedTotals {
    totalLogisticoGeral: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
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
}

const InteractiveCard = ({ label, value, icon: Icon, colorClass, details }: InteractiveCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (value === 0) return null;

    const detailEntries = Object.entries(details || {}).filter(([_, val]) => val > 0);

    return (
        <div 
            className={cn(
                "group flex flex-col rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer mb-2",
                isExpanded 
                    ? "ring-2 ring-primary border-transparent bg-card shadow-md scale-[1.01]" 
                    : "border-border/50 bg-card/40 hover:bg-accent/5"
            )}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg transition-transform group-hover:scale-110", colorClass)}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none mb-1">{label}</p>
                        <p className="text-xs font-black text-foreground">
                            {formatCurrency(value)}
                        </p>
                    </div>
                </div>
                <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform duration-300", isExpanded && "rotate-90")} />
            </div>

            <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="px-3 pb-3 pt-1 border-t border-dashed border-border/50 space-y-1.5 mx-3 mt-1">
                        {detailEntries.map(([name, val]) => (
                            <div key={name} className="flex justify-between items-center text-[10px]">
                                <span className="text-muted-foreground font-medium">{name}</span>
                                <span className="font-bold text-foreground">
                                    {formatCurrency(val)}
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
    
    return (
        <Dialog open={!!om} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[95vw] md:max-w-[900px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-card">
                    <DialogTitle className="text-2xl font-bold">{om.omName}</DialogTitle>
                    <DialogDescription className="text-sm">
                        UG: {formatCodug(om.ug)} | Total Geral: {formatCurrency(om.totalGeral)}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto p-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* BLOCO 1: LOGÍSTICA */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2 mb-2">
                                <Package className="h-3 w-3" /> Aba Logística
                            </h4>
                            <InteractiveCard label="Classe I" value={om.classeI.total} icon={Utensils} colorClass="bg-orange-500/10 text-orange-600" details={om.classeI.details} />
                            <InteractiveCard label="Classe II" value={om.classeII.total} icon={HardHat} colorClass="bg-orange-500/10 text-orange-600" details={om.classeII.details} />
                            <InteractiveCard label="Classe III" value={om.classeIII.total} icon={Fuel} colorClass="bg-orange-500/10 text-orange-600" details={om.classeIII.details} />
                            <InteractiveCard label="Classe V" value={om.classeV.total} icon={Swords} colorClass="bg-orange-500/10 text-orange-600" details={om.classeV.details} />
                            <InteractiveCard label="Classe VI" value={om.classeVI.total} icon={Truck} colorClass="bg-orange-500/10 text-orange-600" details={om.classeVI.details} />
                            <InteractiveCard label="Classe VII" value={om.classeVII.total} icon={Radio} colorClass="bg-orange-500/10 text-orange-600" details={om.classeVII.details} />
                            <InteractiveCard label="Classe VIII" value={om.classeVIII.total} icon={HeartPulse} colorClass="bg-orange-500/10 text-orange-600" details={om.classeVIII.details} />
                            <InteractiveCard label="Classe IX" value={om.classeIX.total} icon={Activity} colorClass="bg-orange-500/10 text-orange-600" details={om.classeIX.details} />
                        </div>

                        {/* BLOCO 2: OPERACIONAL */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 mb-2">
                                <Briefcase className="h-3 w-3" /> Aba Operacional
                            </h4>
                            <InteractiveCard label="Diárias" value={om.diarias.total} icon={Wallet} colorClass="bg-blue-500/10 text-blue-600" details={om.diarias.details} />
                            <InteractiveCard label="Passagens" value={om.passagens.total} icon={Plane} colorClass="bg-blue-500/10 text-blue-600" details={om.passagens.details} />
                            <InteractiveCard label="Verba Operacional" value={om.verbaOperacional.total} icon={ClipboardList} colorClass="bg-blue-500/10 text-blue-600" details={om.verbaOperacional.details} />
                            <InteractiveCard label="Suprimento de Fundos" value={om.suprimentoFundos.total} icon={Wallet} colorClass="bg-blue-500/10 text-blue-600" details={om.suprimentoFundos.details} />
                            <InteractiveCard label="Concessionárias" value={om.concessionaria.total} icon={Droplet} colorClass="bg-blue-500/10 text-blue-600" details={om.concessionaria.details} />
                            <InteractiveCard label="Material de Consumo" value={om.materialConsumo.total} icon={Package} colorClass="bg-blue-500/10 text-blue-600" details={om.materialConsumo.details} />
                        </div>

                        {/* BLOCO 3: AVIAÇÃO E INVESTIMENTO */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-purple-600 flex items-center gap-2 mb-2">
                                <Zap className="h-3 w-3" /> Aviação e Investimento
                            </h4>
                            <InteractiveCard label="Horas de Voo" value={om.horasVoo.total} icon={Zap} colorClass="bg-purple-500/10 text-purple-600" details={om.horasVoo.details} />
                            <InteractiveCard label="Material Permanente" value={om.totalMaterialPermanente} icon={HardHat} colorClass="bg-green-500/10 text-green-600" details={{ "Itens de Investimento": om.totalMaterialPermanente }} />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// --- FUNÇÃO DE BUSCA DE TOTAIS ---

const initializeOmTotals = (omName: string, ug: string): OmTotals => ({
    omKey: `${omName}|${ug}`, omName, ug, totalGeral: 0, totalLogistica: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0,
    classeI: { total: 0, details: {} },
    classeII: { total: 0, details: {} },
    classeIII: { total: 0, details: {} },
    classeV: { total: 0, details: {} },
    classeVI: { total: 0, details: {} },
    classeVII: { total: 0, details: {} },
    classeVIII: { total: 0, details: {} },
    classeIX: { total: 0, details: {} },
    diarias: { total: 0, details: {} },
    verbaOperacional: { total: 0, details: {} },
    suprimentoFundos: { total: 0, details: {} },
    passagens: { total: 0, details: {} },
    concessionaria: { total: 0, details: {} },
    horasVoo: { total: 0, details: {} },
    materialConsumo: { total: 0, details: {} },
});

const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabAggregatedTotals> => {
  const groupedByOm: Record<string, OmTotals> = {};
  
  const getOmTotals = (omName: string, ug: string): OmTotals => {
      const key = `${omName || 'N/A'}|${ug || 'N/A'}`;
      if (!groupedByOm[key]) groupedByOm[key] = initializeOmTotals(omName || 'OM Não Informada', ug || '000000');
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
    const val = (record.total_qs || 0) + (record.total_qr || 0);
    if (record.categoria === 'RACAO_QUENTE') {
        om.classeI.total += val;
        om.totalLogistica += val;
        om.classeI.details["Ração Quente"] = (om.classeI.details["Ração Quente"] || 0) + val;
    } else {
        // Ração Operacional (Valor estimado se disponível, ou apenas contagem)
        om.classeI.details["Ração Operacional"] = (om.classeI.details["Ração Operacional"] || 0) + val;
    }
  });

  const processGenericClass = (data: any[], key: keyof OmTotals) => {
    (data || []).forEach(record => {
        const om = getOmTotals(record.organizacao, record.ug);
        const val = Number(record.valor_total || 0);
        (om[key] as any).total += val;
        om.totalLogistica += val;
        const cat = record.categoria || 'Geral';
        (om[key] as any).details[cat] = ((om[key] as any).details[cat] || 0) + val;
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
    const val = (record.valor_total || 0);
    om.classeIII.total += val;
    om.totalLogistica += val;
    const tipo = record.tipo_combustivel || 'Outros';
    om.classeIII.details[tipo] = (om.classeIII.details[tipo] || 0) + val;
  });

  (diariaData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_nd_15 || 0) + (record.valor_nd_30 || 0);
    om.diarias.total += val;
    om.totalOperacional += val;
    const dest = record.destino || 'Geral';
    om.diarias.details[dest] = (om.diarias.details[dest] || 0) + val;
  });

  (verbaOperacionalData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_nd_30 || 0) + (record.valor_nd_39 || 0);
    om.totalOperacional += val;
    if (record.detalhamento === 'Suprimento de Fundos') {
        om.suprimentoFundos.total += val;
        om.suprimentoFundos.details["Geral"] = (om.suprimentoFundos.details["Geral"] || 0) + val;
    } else {
        om.verbaOperacional.total += val;
        const obj = record.objeto_aquisicao || 'Geral';
        om.verbaOperacional.details[obj] = (om.verbaOperacional.details[obj] || 0) + val;
    }
  });

  (passagemData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_nd_33 || 0);
    om.passagens.total += val;
    om.totalOperacional += val;
    const dest = record.destino || 'Geral';
    om.passagens.details[dest] = (om.passagens.details[dest] || 0) + val;
  });

  (concessionariaData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_nd_39 || 0);
    om.concessionaria.total += val;
    om.totalOperacional += val;
    const cat = record.categoria || 'Geral';
    om.concessionaria.details[cat] = (om.concessionaria.details[cat] || 0) + val;
  });

  (horasVooData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_total || 0);
    om.horasVoo.total += val;
    om.totalAviacaoExercito += val;
    const tipo = record.tipo_anv || 'Aeronave';
    om.horasVoo.details[tipo] = (om.horasVoo.details[tipo] || 0) + val;
  });

  (materialConsumoData || []).forEach(record => {
    const om = getOmTotals(record.organizacao, record.ug);
    const val = (record.valor_total || 0);
    om.materialConsumo.total += val;
    om.totalOperacional += val;
    const group = record.group_name || 'Geral';
    om.materialConsumo.details[group] = (om.materialConsumo.details[group] || 0) + val;
  });

  const globalTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0,
      groupedByOm
  };

  Object.values(groupedByOm).forEach(om => {
      globalTotals.totalLogisticoGeral += (om.totalLogistica || 0);
      globalTotals.totalOperacional += (om.totalOperacional || 0);
      globalTotals.totalAviacaoExercito += (om.totalAviacaoExercito || 0);
      om.totalGeral = (om.totalLogistica || 0) + (om.totalOperacional || 0) + (om.totalAviacaoExercito || 0);
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

  const sortedOmTotals = Object.values(totals.groupedByOm || {}).sort((a, b) => b.totalGeral - a.totalGeral);

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