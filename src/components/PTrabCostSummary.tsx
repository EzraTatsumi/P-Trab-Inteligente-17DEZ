import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
import { 
    Package, Loader2, ChevronRight, HardHat, TrendingUp, Activity, 
    Zap, Swords, Radio, HeartPulse, Truck, Briefcase, Droplet, 
    Plane, Utensils, Fuel, Wallet, ClipboardList, Building2, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// --- TIPOS ---

interface OmTotals {
    omKey: string;
    omName: string;
    ug: string;
    totalGeral: number;
    totalLogistica: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
    
    // Detalhamento por Aba
    logistica: Record<string, { total: number, details: Record<string, number> }>;
    operacional: Record<string, { total: number, details: Record<string, number> }>;
    aviacao: Record<string, { total: number, details: Record<string, number> }>;
}

interface PTrabAggregatedTotals {
    totalLogisticoGeral: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
    totalGeral: number;
    groupedByOm: Record<string, OmTotals>;
}

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void;
  creditGND3: number;
  creditGND4: number;
}

// --- SUBCOMPONENTE: Card de Categoria Expansível ---

interface ExpandableCategoryCardProps {
    label: string;
    total: number;
    icon: any;
    colorClass: string;
    details: Record<string, number>;
}

const ExpandableCategoryCard = ({ label, total, icon: Icon, colorClass, details }: ExpandableCategoryCardProps) => {
    const [isOpen, setIsOpen] = useState(false);
    if (total === 0) return null;

    // Verificação defensiva para details
    const safeDetails = details || {};
    const detailEntries = Object.entries(safeDetails).filter(([_, val]) => typeof val === 'number' && val > 0);

    return (
        <div className="flex flex-col mb-2">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all duration-200",
                    isOpen 
                        ? "bg-accent/10 border-accent shadow-sm ring-1 ring-accent/20" 
                        : "bg-card border-border/50 hover:border-accent/40 hover:bg-accent/5"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", colorClass)}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">{label}</p>
                        <p className="text-sm font-black text-foreground">{formatCurrency(total)}</p>
                    </div>
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform text-muted-foreground", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="mx-2 p-3 bg-muted/20 border-x border-b rounded-b-xl space-y-2 animate-in slide-in-from-top-1 duration-200">
                    {detailEntries.map(([name, val]) => (
                        <div key={name} className="flex justify-between items-center text-[11px] border-b border-dotted border-border pb-1 last:border-0">
                            <span className="text-muted-foreground font-medium">{name}</span>
                            <span className="font-bold text-foreground">{formatCurrency(val)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- COMPONENTE: Dialog de Detalhes da OM ---

interface OmDetailsDialogProps {
    om: OmTotals | null;
    totals: PTrabAggregatedTotals;
    onClose: () => void;
}

const OmDetailsDialog = ({ om, totals, onClose }: OmDetailsDialogProps) => {
    if (!om) return null;
    
    return (
        <Dialog open={!!om} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                        <Building2 className="h-5 w-5 text-primary" /> {om.omName}
                    </DialogTitle>
                    <DialogDescription>
                        UG: {formatCodug(om.ug)} | Total da OM: <span className="font-bold text-foreground">{formatCurrency(om.totalGeral)}</span>
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    {/* BLOCO 1: LOGÍSTICA */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-orange-600 border-b pb-1 flex items-center gap-2">
                            <Package className="h-3 w-3" /> Aba Logística
                        </h4>
                        {Object.entries(om.logistica || {}).map(([label, data]) => (
                            <ExpandableCategoryCard 
                                key={label}
                                label={label}
                                total={data.total}
                                icon={label.includes('Classe I') ? Utensils : label.includes('Classe II') ? HardHat : label.includes('Classe III') ? Fuel : label.includes('Classe V') ? Swords : label.includes('Classe VI') ? Truck : label.includes('Classe VII') ? Radio : label.includes('Classe VIII') ? HeartPulse : Activity}
                                colorClass="bg-orange-500/10 text-orange-600"
                                details={data.details}
                            />
                        ))}
                    </div>

                    {/* BLOCO 2: OPERACIONAL */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-blue-600 border-b pb-1 flex items-center gap-2">
                            <Briefcase className="h-3 w-3" /> Aba Operacional
                        </h4>
                        {Object.entries(om.operacional || {}).map(([label, data]) => (
                            <ExpandableCategoryCard 
                                key={label}
                                label={label}
                                total={data.total}
                                icon={label.includes('Diárias') ? Wallet : label.includes('Passagens') ? Plane : label.includes('Concessionária') ? Droplet : label.includes('Material de Consumo') ? Package : ClipboardList}
                                colorClass="bg-blue-500/10 text-blue-600"
                                details={data.details}
                            />
                        ))}
                    </div>

                    {/* BLOCO 3: AVIAÇÃO E INVESTIMENTO */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-purple-600 border-b pb-1 flex items-center gap-2">
                            <Zap className="h-3 w-3" /> Aviação e Investimento
                        </h4>
                        {Object.entries(om.aviacao || {}).map(([label, data]) => (
                            <ExpandableCategoryCard 
                                key={label}
                                label={label}
                                total={data.total}
                                icon={label.includes('Horas de Voo') ? Zap : HardHat}
                                colorClass="bg-purple-500/10 text-purple-600"
                                details={data.details}
                            />
                        ))}
                        {om.totalMaterialPermanente > 0 && (
                            <ExpandableCategoryCard 
                                label="Material Permanente"
                                total={om.totalMaterialPermanente}
                                icon={HardHat}
                                colorClass="bg-green-500/10 text-green-600"
                                details={{ "Itens de Investimento": om.totalMaterialPermanente }}
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// --- LÓGICA DE BUSCA E PROCESSAMENTO ---

const initializeOmTotals = (omName: string, ug: string): OmTotals => ({
    omKey: `${omName}|${ug}`,
    omName: omName || 'OM Não Informada',
    ug: ug || '000000',
    totalGeral: 0,
    totalLogistica: 0,
    totalOperacional: 0,
    totalMaterialPermanente: 0,
    totalAviacaoExercito: 0,
    logistica: {},
    operacional: {},
    aviacao: {}
});

const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabAggregatedTotals> => {
  const groupedByOm: Record<string, OmTotals> = {};
  
  const getOm = (omName: string, ug: string): OmTotals => {
      const key = `${omName || 'N/A'}|${ug || 'N/A'}`;
      if (!groupedByOm[key]) {
          groupedByOm[key] = initializeOmTotals(omName, ug);
      }
      return groupedByOm[key];
  };

  const addToCategory = (om: OmTotals, aba: 'logistica' | 'operacional' | 'aviacao', label: string, value: number, detailName: string) => {
      if (!om[aba]) om[aba] = {};
      if (!om[aba][label]) om[aba][label] = { total: 0, details: {} };
      
      om[aba][label].total += value;
      om[aba][label].details[detailName] = (om[aba][label].details[detailName] || 0) + value;
      
      if (aba === 'logistica') om.totalLogistica += value;
      else if (aba === 'operacional') om.totalOperacional += value;
      else if (aba === 'aviacao') om.totalAviacaoExercito += value;
      
      om.totalGeral += value;
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
    { data: c1 }, { data: c2 }, { data: c5 }, { data: c6 }, { data: c7 }, { data: c8s }, { data: c8r },
    { data: c9 }, { data: c3 }, { data: dr }, { data: vo }, { data: pr }, { data: cr }, { data: hv }, { data: mc }
  ] = results;

  (c1 || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      const val = (r.total_qs || 0) + (r.total_qr || 0);
      const label = r.categoria === 'RACAO_QUENTE' ? 'Ração Quente' : 'Ração Operacional';
      addToCategory(om, 'logistica', 'Classe I - Subsistência', val, label);
  });

  const processClass = (data: any[], label: string) => {
      (data || []).forEach(r => {
          const om = getOm(r.organizacao, r.ug);
          addToCategory(om, 'logistica', label, Number(r.valor_total || 0), r.categoria || 'Geral');
      });
  };

  processClass(c2, 'Classe II - Intendência');
  processClass(c5, 'Classe V - Armamento');
  processClass(c6, 'Classe VI - Engenharia');
  processClass(c7, 'Classe VII - Comunicações');
  processClass(c8s, 'Classe VIII - Saúde');
  processClass(c8r, 'Classe VIII - Remonta');
  processClass(c9, 'Classe IX - Manutenção');

  (c3 || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      addToCategory(om, 'logistica', 'Classe III - Combustíveis', Number(r.valor_total || 0), r.tipo_combustivel || 'Outros');
  });

  (dr || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      const val = (r.valor_nd_15 || 0) + (r.valor_nd_30 || 0);
      addToCategory(om, 'operacional', 'Pagamento de Diárias', val, r.destino || 'Geral');
  });

  (vo || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      const val = (r.valor_nd_30 || 0) + (r.valor_nd_39 || 0);
      const label = r.detalhamento === 'Suprimento de Fundos' ? 'Suprimento de Fundos' : 'Verba Operacional';
      addToCategory(om, 'operacional', label, val, r.objeto_aquisicao || 'Geral');
  });

  (pr || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      addToCategory(om, 'operacional', 'Passagens', Number(r.valor_nd_33 || 0), r.destino || 'Geral');
  });

  (cr || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      addToCategory(om, 'operacional', 'Concessionárias', Number(r.valor_nd_39 || 0), r.categoria || 'Geral');
  });

  (hv || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      addToCategory(om, 'aviacao', 'Horas de Voo', Number(r.valor_total || 0), `${r.tipo_anv || 'Aeronave'} (${formatNumber(r.quantidade_hv, 1)} HV)`);
  });

  (mc || []).forEach(r => {
      const om = getOm(r.organizacao, r.ug);
      addToCategory(om, 'operacional', 'Material de Consumo', Number(r.valor_total || 0), r.group_name || 'Geral');
  });

  const globalTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0, totalGeral: 0,
      groupedByOm
  };

  // Verificação defensiva antes de iterar sobre groupedByOm
  const omEntries = Object.values(groupedByOm || {});
  omEntries.forEach(om => {
      globalTotals.totalLogisticoGeral += (om.totalLogistica || 0);
      globalTotals.totalOperacional += (om.totalOperacional || 0);
      globalTotals.totalAviacaoExercito += (om.totalAviacaoExercito || 0);
      globalTotals.totalGeral += (om.totalGeral || 0);
  });

  return globalTotals;
};

// --- COMPONENTE PRINCIPAL ---

export const PTrabCostSummary = ({ ptrabId, onOpenCreditDialog, creditGND3, creditGND4 }: PTrabCostSummaryProps) => {
  const { data: totals, isLoading } = useQuery<PTrabAggregatedTotals>({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000,
  });
  
  const [viewMode, setViewMode] = useState<'global' | 'om'>('global');
  const [selectedOm, setSelectedOm] = useState<OmTotals | null>(null);

  if (isLoading || !totals) return <Card className="p-6 flex justify-center"><Loader2 className="animate-spin" /></Card>;

  const saldoGND3 = creditGND3 - (totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito);
  const saldoGND4 = creditGND4 - totals.totalMaterialPermanente;

  // Verificação defensiva para groupedByOm
  const sortedOms = Object.values(totals.groupedByOm || {}).sort((a, b) => b.totalGeral - a.totalGeral);

  return (
    <Card className="shadow-lg border-none bg-transparent">
      <CardHeader className="px-0 pt-0 pb-6 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-black flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" /> Resumo de Custos
          </CardTitle>
          <CardDescription>Visão consolidada do P Trab</CardDescription>
        </div>
        
        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg border">
          <Label htmlFor="view-mode" className={cn("text-[10px] font-bold", viewMode === 'global' ? "text-primary" : "text-muted-foreground")}>GLOBAL</Label>
          <Switch 
            id="view-mode" 
            checked={viewMode === 'om'} 
            onCheckedChange={(s) => setViewMode(s ? 'om' : 'global')} 
          />
          <Label htmlFor="view-mode" className={cn("text-[10px] font-bold", viewMode === 'om' ? "text-primary" : "text-muted-foreground")}>POR OM</Label>
        </div>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {viewMode === 'global' ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 rounded-xl border-l-4 border-l-orange-600 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600"><Package className="h-4 w-4" /></div>
                    <span className="text-xs font-bold text-muted-foreground uppercase">Logística</span>
                </div>
                <span className="font-black text-sm">{formatCurrency(totals.totalLogisticoGeral)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border-l-4 border-l-blue-600 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600"><Activity className="h-4 w-4" /></div>
                    <span className="text-xs font-bold text-muted-foreground uppercase">Operacional</span>
                </div>
                <span className="font-black text-sm">{formatCurrency(totals.totalOperacional)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border-l-4 border-l-purple-600 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600"><Zap className="h-4 w-4" /></div>
                    <span className="text-xs font-bold text-muted-foreground uppercase">Aviação</span>
                </div>
                <span className="font-black text-sm">{formatCurrency(totals.totalAviacaoExercito)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border-l-4 border-l-green-600 bg-card shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-600"><HardHat className="h-4 w-4" /></div>
                    <span className="text-xs font-bold text-muted-foreground uppercase">Mat. Permanente</span>
                </div>
                <span className="font-black text-sm">{formatCurrency(totals.totalMaterialPermanente)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {sortedOms.map((om) => (
              <div 
                key={om.omKey}
                onClick={() => setSelectedOm(om)}
                className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/5 cursor-pointer transition-all"
              >
                <div className="flex flex-col flex-1 mr-4">
                  <span className="font-bold text-xs truncate max-w-[180px]">{om.omName}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${totals.totalGeral > 0 ? (om.totalGeral / totals.totalGeral) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {totals.totalGeral > 0 ? ((om.totalGeral / totals.totalGeral) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                </div>
                <span className="font-black text-xs text-primary whitespace-nowrap">{formatCurrency(om.totalGeral)}</span>
              </div>
            ))}
          </div>
        )}

        {/* RODAPÉ DE TOTAIS E SALDOS */}
        <div className="pt-4 border-t space-y-4">
            <div className="flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-wider">Total Geral</span>
                <span className="text-xl font-black text-foreground">{formatCurrency(totals.totalGeral)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Saldo GND 3</p>
                    <p className={cn("text-sm font-black", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(saldoGND3)}
                    </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Saldo GND 4</p>
                    <p className={cn("text-sm font-black", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(saldoGND4)}
                    </p>
                </div>
            </div>

            <Button onClick={onOpenCreditDialog} variant="outline" className="w-full border-accent text-accent hover:bg-accent/10 font-bold uppercase text-[10px] tracking-widest h-10">
                Informar Crédito Disponível
            </Button>
        </div>
      </CardContent>
      
      <OmDetailsDialog om={selectedOm} totals={totals} onClose={() => setSelectedOm(null)} />
    </Card>
  );
};

export { fetchPTrabTotals };