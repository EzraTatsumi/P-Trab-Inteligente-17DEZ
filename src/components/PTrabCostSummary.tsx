import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Package, Fuel, Utensils, Loader2, ChevronDown, HardHat, Plane, TrendingUp, Wallet, ClipboardList, Swords, Radio, Activity, HeartPulse, Truck, Briefcase, Droplet, Zap, Info, AlertCircle } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/accordion-custom"; // Usando o componente customizado se disponível ou o padrão
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

// Constantes de categorias
const CATEGORIAS_CLASSE_II = ["Equipamento Individual", "Proteção Balística", "Material de Estacionamento"];
const CATEGORIAS_CLASSE_V = ["Armt L", "Armt P", "IODCT", "DQBRN"];
const CATEGORIAS_CLASSE_VI = ["Embarcação", "Equipamento de Engenharia", "Gerador"];
const CATEGORIAS_CLASSE_VII = ["Comunicações", "Informática"];
const CATEGORIAS_CLASSE_VIII = ["Saúde", "Remonta/Veterinária"];
const CATEGORIAS_CLASSE_IX = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
}

// Helper para cálculo de etapa solicitada
const calculateDiasEtapaSolicitada = (diasOperacao: number): number => {
  const diasRestantesNoCiclo = diasOperacao % 30;
  const ciclosCompletos = Math.floor(diasOperacao / 30);
  if (diasRestantesNoCiclo <= 22 && diasOperacao >= 30) return ciclosCompletos * 8;
  else if (diasRestantesNoCiclo > 22) return (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  return 0;
};

// Interface para os totais de um grupo (Global ou OM)
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
  totalComplemento: number;
  totalEtapaSolicitadaValor: number;
  totalDiasEtapaSolicitada: number;
  totalRefeicoesIntermediarias: number;
  totalRacoesOperacionaisGeral: number;
  totalDieselValor: number;
  totalGasolinaValor: number;
  totalDieselLitros: number;
  totalGasolinaLitros: number;
  totalLubrificanteLitros: number;
  totalDiarias: number;
  totalDiariasND15: number;
  totalDiariasND30: number;
  totalMilitaresDiarias: number;
  totalDiasViagem: number;
  totalVerbaOperacional: number;
  totalVerbaOperacionalND30: number;
  totalVerbaOperacionalND39: number;
  totalEquipesVerba: number;
  totalDiasVerba: number;
  totalSuprimentoFundos: number;
  totalSuprimentoFundosND30: number;
  totalSuprimentoFundosND39: number;
  totalEquipesSuprimento: number;
  totalDiasSuprimento: number;
  totalPassagensND33: number;
  totalQuantidadePassagens: number;
  totalTrechosPassagens: number;
  totalConcessionariaND39: number;
  totalConcessionariaAgua: number;
  totalConcessionariaEnergia: number;
  totalHorasVoo: number;
  quantidadeHorasVoo: number;
  groupedClasseIICategories: Record<string, any>;
  groupedClasseVCategories: Record<string, any>;
  groupedClasseVICategories: Record<string, any>;
  groupedClasseVIICategories: Record<string, any>;
  groupedClasseVIIICategories: Record<string, any>;
  groupedClasseIXCategories: Record<string, any>;
  groupedHorasVoo: Record<string, any>;
}

const createEmptyTotals = (): PTrabTotals => ({
  totalLogisticoGeral: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0,
  totalClasseI: 0, totalClasseII: 0, totalClasseV: 0, totalClasseVI: 0, totalClasseVII: 0, totalClasseVIII: 0, totalClasseIX: 0,
  totalCombustivel: 0, totalLubrificanteValor: 0, totalComplemento: 0, totalEtapaSolicitadaValor: 0,
  totalDiasEtapaSolicitada: 0, totalRefeicoesIntermediarias: 0, totalRacoesOperacionaisGeral: 0,
  totalDieselValor: 0, totalGasolinaValor: 0, totalDieselLitros: 0, totalGasolinaLitros: 0, totalLubrificanteLitros: 0,
  totalDiarias: 0, totalDiariasND15: 0, totalDiariasND30: 0, totalMilitaresDiarias: 0, totalDiasViagem: 0,
  totalVerbaOperacional: 0, totalVerbaOperacionalND30: 0, totalVerbaOperacionalND39: 0, totalEquipesVerba: 0, totalDiasVerba: 0,
  totalSuprimentoFundos: 0, totalSuprimentoFundosND30: 0, totalSuprimentoFundosND39: 0, totalEquipesSuprimento: 0, totalDiasSuprimento: 0,
  totalPassagensND33: 0, totalQuantidadePassagens: 0, totalTrechosPassagens: 0,
  totalConcessionariaND39: 0, totalConcessionariaAgua: 0, totalConcessionariaEnergia: 0,
  totalHorasVoo: 0, quantidadeHorasVoo: 0,
  groupedClasseIICategories: {}, groupedClasseVCategories: {}, groupedClasseVICategories: {},
  groupedClasseVIICategories: {}, groupedClasseVIIICategories: {}, groupedClasseIXCategories: {}, groupedHorasVoo: {},
});

export const fetchPTrabTotals = async (ptrabId: string) => {
  const [
    classeI, classeII, classeV, classeVI, classeVII, classeVIII_Saude, classeVIII_Remonta, classeIX,
    classeIII, diarias, verba, passagens, concessionaria, horasVoo
  ] = await Promise.all([
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
  ]);

  const global = createEmptyTotals();
  const bySolicitante: Record<string, PTrabTotals> = {};
  const byDestino: Record<string, PTrabTotals> = {};

  const addTo = (om: string, type: 'solicitante' | 'destino', fn: (t: PTrabTotals) => void) => {
    if (!om) return;
    const map = type === 'solicitante' ? bySolicitante : byDestino;
    if (!map[om]) map[om] = createEmptyTotals();
    fn(map[om]);
  };

  // Processamento Classe I
  (classeI.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      if (r.categoria === 'RACAO_QUENTE') {
        const val = Number(r.total_qs || 0) + Number(r.total_qr || 0);
        t.totalClasseI += val;
        t.totalLogisticoGeral += val;
        t.totalComplemento += Number(r.complemento_qs || 0) + Number(r.complemento_qr || 0);
        t.totalEtapaSolicitadaValor += Number(r.etapa_qs || 0) + Number(r.etapa_qr || 0);
        t.totalDiasEtapaSolicitada += calculateDiasEtapaSolicitada(Number(r.dias_operacao || 0));
        t.totalRefeicoesIntermediarias += Number(r.efetivo || 0) * Number(r.nr_ref_int || 0) * Number(r.dias_operacao || 0);
      } else {
        t.totalRacoesOperacionaisGeral += Number(r.quantidade_r2 || 0) + Number(r.quantidade_r3 || 0);
      }
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_qs || r.organizacao, 'destino', process);
  });

  // Processamento Classes Diversas (II, V, VI, VII, VIII, IX)
  const allDiversas = [
    ...(classeII.data || []).map(r => ({ ...r, type: 'II' })),
    ...(classeV.data || []).map(r => ({ ...r, type: 'V' })),
    ...(classeVI.data || []).map(r => ({ ...r, type: 'VI' })),
    ...(classeVII.data || []).map(r => ({ ...r, type: 'VII' })),
    ...(classeVIII_Saude.data || []).map(r => ({ ...r, type: 'VIII', itens_equipamentos: r.itens_saude, categoria: 'Saúde' })),
    ...(classeVIII_Remonta.data || []).map(r => ({ ...r, type: 'VIII', itens_equipamentos: r.itens_remonta, categoria: 'Remonta/Veterinária' })),
    ...(classeIX.data || []).map(r => ({ ...r, type: 'IX', itens_equipamentos: r.itens_motomecanizacao })),
  ];

  allDiversas.forEach(r => {
    const process = (t: PTrabTotals) => {
      const val = Number(r.valor_total || 0);
      const nd30 = Number(r.valor_nd_30 || 0);
      const nd39 = Number(r.valor_nd_39 || 0);
      const items = (r.itens_equipamentos || []) as unknown as ItemClasseII[];
      const count = items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);

      t.totalLogisticoGeral += val;
      const cat = r.categoria;
      
      if (r.type === 'II') {
        t.totalClasseII += val;
        if (!t.groupedClasseIICategories[cat]) t.groupedClasseIICategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        t.groupedClasseIICategories[cat].totalValor += val; t.groupedClasseIICategories[cat].totalND30 += nd30; t.groupedClasseIICategories[cat].totalND39 += nd39; t.groupedClasseIICategories[cat].totalItens += count;
      } else if (r.type === 'V') {
        t.totalClasseV += val;
        if (!t.groupedClasseVCategories[cat]) t.groupedClasseVCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        t.groupedClasseVCategories[cat].totalValor += val; t.groupedClasseVCategories[cat].totalND30 += nd30; t.groupedClasseVCategories[cat].totalND39 += nd39; t.groupedClasseVCategories[cat].totalItens += count;
      } else if (r.type === 'VI') {
        t.totalClasseVI += val;
        if (!t.groupedClasseVICategories[cat]) t.groupedClasseVICategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        t.groupedClasseVICategories[cat].totalValor += val; t.groupedClasseVICategories[cat].totalND30 += nd30; t.groupedClasseVICategories[cat].totalND39 += nd39; t.groupedClasseVICategories[cat].totalItens += count;
      } else if (r.type === 'VII') {
        t.totalClasseVII += val;
        if (!t.groupedClasseVIICategories[cat]) t.groupedClasseVIICategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        t.groupedClasseVIICategories[cat].totalValor += val; t.groupedClasseVIICategories[cat].totalND30 += nd30; t.groupedClasseVIICategories[cat].totalND39 += nd39; t.groupedClasseVIICategories[cat].totalItens += count;
      } else if (r.type === 'VIII') {
        t.totalClasseVIII += val;
        const key = cat === 'Remonta/Veterinária' ? `Remonta - ${r.animal_tipo}` : 'Saúde';
        const finalCount = cat === 'Remonta/Veterinária' ? Number(r.quantidade_animais || 0) : count;
        if (!t.groupedClasseVIIICategories[key]) t.groupedClasseVIIICategories[key] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        t.groupedClasseVIIICategories[key].totalValor += val; t.groupedClasseVIIICategories[key].totalND30 += nd30; t.groupedClasseVIIICategories[key].totalND39 += nd39; t.groupedClasseVIIICategories[key].totalItens += finalCount;
      } else if (r.type === 'IX') {
        t.totalClasseIX += val;
        if (!t.groupedClasseIXCategories[cat]) t.groupedClasseIXCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        t.groupedClasseIXCategories[cat].totalValor += val; t.groupedClasseIXCategories[cat].totalND30 += nd30; t.groupedClasseIXCategories[cat].totalND39 += nd39; t.groupedClasseIXCategories[cat].totalItens += count;
      }
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  // Processamento Classe III
  (classeIII.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      const val = Number(r.valor_total || 0);
      const lit = Number(r.total_litros || 0);
      t.totalLogisticoGeral += val;
      if (r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') {
        t.totalLubrificanteValor += val; t.totalLubrificanteLitros += lit;
      } else {
        t.totalCombustivel += val;
        if (r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD') { t.totalDieselValor += val; t.totalDieselLitros += lit; }
        else { t.totalGasolinaValor += val; t.totalGasolinaLitros += lit; }
      }
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  // Processamento Diárias
  (diarias.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      const nd15 = Number(r.valor_nd_15 || 0);
      const taxa = Number(r.valor_taxa_embarque || 0);
      t.totalOperacional += nd15;
      t.totalDiarias += (nd15 - taxa);
      t.totalDiariasND15 += (nd15 - taxa);
      t.totalDiariasND30 += taxa;
      t.totalMilitaresDiarias += Number(r.quantidade || 0);
      t.totalDiasViagem += Number(r.dias_operacao || 0);
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  // Processamento Verba/Suprimento
  (verba.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      const val = Number(r.valor_nd_30 || 0) + Number(r.valor_nd_39 || 0);
      t.totalOperacional += val;
      if (r.detalhamento === 'Suprimento de Fundos') {
        t.totalSuprimentoFundos += val; t.totalSuprimentoFundosND30 += Number(r.valor_nd_30 || 0); t.totalSuprimentoFundosND39 += Number(r.valor_nd_39 || 0);
        t.totalEquipesSuprimento += Number(r.quantidade_equipes || 0); t.totalDiasSuprimento += Number(r.dias_operacao || 0);
      } else {
        t.totalVerbaOperacional += val; t.totalVerbaOperacionalND30 += Number(r.valor_nd_30 || 0); t.totalVerbaOperacionalND39 += Number(r.valor_nd_39 || 0);
        t.totalEquipesVerba += Number(r.quantidade_equipes || 0); t.totalDiasVerba += Number(r.dias_operacao || 0);
      }
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  // Processamento Passagens
  (passagens.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      const val = Number(r.valor_nd_33 || 0);
      t.totalOperacional += val; t.totalPassagensND33 += val;
      t.totalQuantidadePassagens += Number(r.quantidade_passagens || 0); t.totalTrechosPassagens += 1;
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  // Processamento Concessionária
  (concessionaria.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      const val = Number(r.valor_nd_39 || 0);
      t.totalOperacional += val; t.totalConcessionariaND39 += val;
      if (r.categoria === 'Água/Esgoto') t.totalConcessionariaAgua += val;
      else if (r.categoria === 'Energia Elétrica') t.totalConcessionariaEnergia += val;
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  // Processamento Horas de Voo
  (horasVoo.data || []).forEach(r => {
    const process = (t: PTrabTotals) => {
      const val = Number(r.valor_total || 0);
      const hv = Number(r.quantidade_hv || 0);
      const anv = r.tipo_anv || 'Não Especificado';
      t.totalAviacaoExercito += val; t.totalHorasVoo += val; t.quantidadeHorasVoo += hv;
      if (!t.groupedHorasVoo[anv]) t.groupedHorasVoo[anv] = { totalValor: 0, totalHV: 0 };
      t.groupedHorasVoo[anv].totalValor += val; t.groupedHorasVoo[anv].totalHV += hv;
    };
    process(global);
    addTo(r.organizacao, 'solicitante', process);
    addTo(r.om_detentora || r.organizacao, 'destino', process);
  });

  return { global, bySolicitante, byDestino };
};

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void;
  creditGND3: number;
  creditGND4: number;
}

export const PTrabCostSummary = ({ 
  ptrabId, 
  onOpenCreditDialog,
  creditGND3,
  creditGND4,
}: PTrabCostSummaryProps) => {
  const [viewMode, setViewMode] = useState<'global' | 'byOM'>('global');
  const [omGroupMode, setOmGroupMode] = useState<'solicitante' | 'destino'>('solicitante');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000,
  });
  
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  if (isLoading || !data) {
    return (
      <Card className="shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Calculando totais...</span>
        </CardContent>
      </Card>
    );
  }

  const { global, bySolicitante, byDestino } = data;
  const saldoGND3 = creditGND3 - (global.totalLogisticoGeral + global.totalOperacional + global.totalAviacaoExercito);
  const saldoGND4 = creditGND4 - global.totalMaterialPermanente;

  const renderTotalsAccordion = (totals: PTrabTotals, idPrefix: string = "") => {
    const totalGeral = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalMaterialPermanente + totals.totalAviacaoExercito;
    
    return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="details" className="border-b-0">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex justify-between items-center w-full pr-4">
              <span className="text-sm font-bold">Total: {formatCurrency(totalGeral)}</span>
              <span className="text-[10px] text-primary font-semibold uppercase">Detalhes</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Logística */}
            <div className="space-y-2 border-l-4 border-orange-500 pl-3">
              <div className="flex justify-between text-xs font-bold text-orange-600">
                <span>Logística</span>
                <span>{formatCurrency(totals.totalLogisticoGeral)}</span>
              </div>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                {totals.totalClasseI > 0 && <div className="flex justify-between"><span>Classe I</span><span>{formatCurrency(totals.totalClasseI)}</span></div>}
                {totals.totalClasseII > 0 && <div className="flex justify-between"><span>Classe II</span><span>{formatCurrency(totals.totalClasseII)}</span></div>}
                {totals.totalCombustivel > 0 && <div className="flex justify-between"><span>Combustível</span><span>{formatCurrency(totals.totalCombustivel)}</span></div>}
                {totals.totalLubrificanteValor > 0 && <div className="flex justify-between"><span>Lubrificante</span><span>{formatCurrency(totals.totalLubrificanteValor)}</span></div>}
                {totals.totalClasseV > 0 && <div className="flex justify-between"><span>Classe V</span><span>{formatCurrency(totals.totalClasseV)}</span></div>}
                {totals.totalClasseVI > 0 && <div className="flex justify-between"><span>Classe VI</span><span>{formatCurrency(totals.totalClasseVI)}</span></div>}
                {totals.totalClasseVII > 0 && <div className="flex justify-between"><span>Classe VII</span><span>{formatCurrency(totals.totalClasseVII)}</span></div>}
                {totals.totalClasseVIII > 0 && <div className="flex justify-between"><span>Classe VIII</span><span>{formatCurrency(totals.totalClasseVIII)}</span></div>}
                {totals.totalClasseIX > 0 && <div className="flex justify-between"><span>Classe IX</span><span>{formatCurrency(totals.totalClasseIX)}</span></div>}
              </div>
            </div>

            {/* Operacional */}
            <div className="space-y-2 border-l-4 border-blue-500 pl-3">
              <div className="flex justify-between text-xs font-bold text-blue-600">
                <span>Operacional</span>
                <span>{formatCurrency(totals.totalOperacional)}</span>
              </div>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                {totals.totalDiarias > 0 && <div className="flex justify-between"><span>Diárias</span><span>{formatCurrency(totals.totalDiarias)}</span></div>}
                {totals.totalPassagensND33 > 0 && <div className="flex justify-between"><span>Passagens</span><span>{formatCurrency(totals.totalPassagensND33)}</span></div>}
                {totals.totalVerbaOperacional > 0 && <div className="flex justify-between"><span>Verba Operacional</span><span>{formatCurrency(totals.totalVerbaOperacional)}</span></div>}
                {totals.totalSuprimentoFundos > 0 && <div className="flex justify-between"><span>Suprimento de Fundos</span><span>{formatCurrency(totals.totalSuprimentoFundos)}</span></div>}
                {totals.totalConcessionariaND39 > 0 && <div className="flex justify-between"><span>Concessionária</span><span>{formatCurrency(totals.totalConcessionariaND39)}</span></div>}
              </div>
            </div>

            {/* Aviação */}
            <div className="space-y-2 border-l-4 border-purple-500 pl-3">
              <div className="flex justify-between text-xs font-bold text-purple-600">
                <span>Aviação do Exército</span>
                <span>{formatNumber(totals.quantidadeHorasVoo, 2)} HV</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Resumo de Custos
        </CardTitle>
        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="global" className="text-xs">Global</TabsTrigger>
            <TabsTrigger value="byOM" className="text-xs">Por OM</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-2">
        {viewMode === 'global' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Logística:</span>
                <span className="font-bold text-orange-600">{formatCurrency(global.totalLogisticoGeral)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Operacional:</span>
                <span className="font-bold text-blue-600">{formatCurrency(global.totalOperacional)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Aviação:</span>
                <span className="font-bold text-purple-600">{formatNumber(global.quantidadeHorasVoo, 2)} HV</span>
              </div>
            </div>
            {renderTotalsAccordion(global, "global")}
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={omGroupMode} onValueChange={(v: any) => setOmGroupMode(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-7 bg-muted/30">
                <TabsTrigger value="solicitante" className="text-[10px]">Solicitante</TabsTrigger>
                <TabsTrigger value="destino" className="text-[10px]">Destino</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
              {Object.entries(omGroupMode === 'solicitante' ? bySolicitante : byDestino)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([om, totals]) => (
                  <div key={om} className="p-3 rounded-lg border bg-muted/20 space-y-1">
                    <div className="font-bold text-xs text-primary truncate" title={om}>{om}</div>
                    {renderTotalsAccordion(totals, om)}
                  </div>
                ))}
              {Object.keys(omGroupMode === 'solicitante' ? bySolicitante : byDestino).length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">Nenhum registro encontrado.</div>
              )}
            </div>
          </div>
        )}

        {/* Seção de Saldo e Crédito */}
        <div className="pt-4 border-t space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                Saldo GND 3
              </Label>
              <span className={cn("font-bold text-sm", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(saldoGND3)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                Saldo GND 4
              </Label>
              <span className={cn("font-bold text-sm", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(saldoGND4)}
              </span>
            </div>
          </div>
          
          <Button 
            onClick={onOpenCreditDialog} 
            variant="outline" 
            className="w-full border-primary/30 text-primary hover:bg-primary/5 h-8 text-xs"
          >
            Informar Crédito Disponível
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export { fetchPTrabTotals };