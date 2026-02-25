"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
import { 
  Package, Fuel, Utensils, Loader2, ChevronDown, HardHat, 
  Helicopter, TrendingUp, Wallet, ClipboardList, Swords, 
  Radio, Activity, HeartPulse, Truck, Briefcase, Droplet, 
  Building2, MapPin, Plane 
} from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isGhostMode, GHOST_DATA } from "@/lib/ghostStore";

// --- Interfaces ---

interface OmTotals {
  omKey: string;
  omName: string;
  ug: string;
  totalGeral: number;
  totalLogistica: number;
  totalOperacional: number;
  totalMaterialPermanente: number;
  totalAviacaoExercito: number;
  classeI: {
    total: number;
    totalComplemento: number;
    totalEtapaSolicitadaValor: number;
    totalDiasEtapaSolicitada: number;
    totalRefeicoesIntermediarias: number;
    totalRacoesOperacionaisGeral: number;
  };
  classeII: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> };
  classeIII: { total: number, totalDieselValor: number, totalGasolinaValor: number, totalDieselLitros: number, totalGasolinaLitros: number, totalLubrificanteValor: number, totalLubrificanteLitros: number };
  classeV: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> };
  classeVI: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> };
  classeVII: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> };
  classeVIII: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> };
  classeIX: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> };
  diarias: { total: number, totalND15: number, totalND30: number, totalMilitares: number, totalDiasViagem: number };
  verbaOperacional: { total: number, totalND30: number, totalND39: number, totalEquipes: number, totalDias: number };
  suprimentoFundos: { total: number, totalND30: number, totalND39: number, totalEquipes: number, totalDias: number };
  passagens: { total: number, totalQuantidade: number, totalTrechos: number };
  concessionaria: { total: number, totalAgua: number, totalEnergia: number, totalRegistros: number };
  horasVoo: { total: number, totalND30: number, totalND39: number, quantidadeHV: number, groupedHV: Record<string, { totalValor: number, totalHV: number }>; };
  materialConsumo: { total: number, totalND30: number, totalND39: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number }> };
  complementoAlimentacao: { total: number, totalND30: number, totalND39: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number }> };
  servicosTerceiros: { total: number, totalND33: number, totalND39: number, groupedCategories: Record<string, { totalValor: number, totalND33: number, totalND39: number }> };
  materialPermanente: { total: number, totalND52: number, groupedCategories: Record<string, { totalValor: number, totalND52: number }> };
}

export interface PTrabAggregatedTotals {
  totalLogisticoGeral: number;
  totalOperacional: number;
  totalMaterialPermanente: number;
  totalAviacaoExercito: number;
  totalRacoesOperacionaisGeral: number;
  totalClasseI: number;
  totalComplemento: number;
  totalEtapaSolicitadaValor: number;
  totalDiasEtapaSolicitada: number;
  totalRefeicoesIntermediarias: number;
  totalClasseII: number;
  totalClasseII_ND30: number;
  totalClasseII_ND39: number;
  totalItensClasseII: number;
  groupedClasseIICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
  totalClasseV: number;
  totalClasseV_ND30: number;
  totalClasseV_ND39: number;
  totalItensClasseV: number;
  groupedClasseVCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
  totalClasseVI: number;
  totalClasseVI_ND30: number;
  totalClasseVI_ND39: number;
  totalItensClasseVI: number;
  groupedClasseVICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
  totalClasseVII: number;
  totalClasseVII_ND30: number;
  totalClasseVII_ND39: number;
  totalItensClasseVII: number;
  groupedClasseVIICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
  totalClasseVIII: number;
  totalClasseVIII_ND30: number;
  totalClasseVIII_ND39: number;
  totalItensClasseVIII: number;
  groupedClasseVIIICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
  totalClasseIX: number;
  totalClasseIX_ND30: number;
  totalClasseIX_ND39: number;
  totalItensClasseIX: number;
  groupedClasseIXCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
  totalDieselValor: number;
  totalGasolinaValor: number;
  totalDieselLitros: number;
  totalGasolinaLitros: number;
  totalLubrificanteValor: number;
  totalLubrificanteLitros: number;
  totalCombustivel: number;
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
  totalConcessionariaRegistros: number;
  totalConcessionariaAgua: number;
  totalConcessionariaEnergia: number;
  totalHorasVoo: number;
  totalHorasVooND30: number;
  totalHorasVooND39: number;
  quantidadeHorasVoo: number;
  groupedHorasVoo: Record<string, { totalValor: number, totalHV: number }>;
  totalMaterialConsumo: number;
  totalMaterialConsumoND30: number;
  totalMaterialConsumoND39: number;
  groupedMaterialConsumoCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number }>;
  totalComplementoAlimentacao: number;
  totalComplementoAlimentacaoND30: number;
  totalComplementoAlimentacaoND39: number;
  groupedComplementoCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number }>;
  totalServicosTerceiros: number;
  totalServicosTerceirosND33: number;
  totalServicosTerceirosND39: number;
  groupedServicosTerceirosCategories: Record<string, { totalValor: number, totalND33: number, totalND39: number }>;
  totalMaterialPermanenteND52: number;
  groupedMaterialPermanenteCategories: Record<string, { totalValor: number, totalND52: number }>;
  groupedByOmSolicitante: Record<string, OmTotals>;
  groupedByOmDestino: Record<string, OmTotals>;
}

// --- Funções Auxiliares ---

const calculateDiasEtapaSolicitada = (diasOperacao: number): number => {
  const diasRestantesNoCiclo = diasOperacao % 30;
  const ciclosCompletos = Math.floor(diasOperacao / 30);
  if (diasRestantesNoCiclo <= 22 && diasOperacao >= 30) return ciclosCompletos * 8;
  else if (diasRestantesNoCiclo > 22) return (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  else return 0;
};

const normalizeOmName = (name: string): string => {
  if (!name) return "";
  return name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ª/g, "A").replace(/º/g, "O").replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ");
};

const initializeOmTotals = (omName: string, ug: string): OmTotals => ({
  omKey: normalizeOmName(omName),
  omName: omName.trim(),
  ug: ug.trim(),
  totalGeral: 0,
  totalLogistica: 0,
  totalOperacional: 0,
  totalMaterialPermanente: 0,
  totalAviacaoExercito: 0,
  classeI: { total: 0, totalComplemento: 0, totalEtapaSolicitadaValor: 0, totalDiasEtapaSolicitada: 0, totalRefeicoesIntermediarias: 0, totalRacoesOperacionaisGeral: 0 },
  classeII: { total: 0, totalND30: 0, totalND39: 0, totalItens: 0, groupedCategories: {} },
  classeIII: { total: 0, totalDieselValor: 0, totalGasolinaValor: 0, totalDieselLitros: 0, totalGasolinaLitros: 0, totalLubrificanteValor: 0, totalLubrificanteLitros: 0 },
  classeV: { total: 0, totalND30: 0, totalND39: 0, totalItens: 0, groupedCategories: {} },
  classeVI: { total: 0, totalND30: 0, totalND39: 0, totalItens: 0, groupedCategories: {} },
  classeVII: { total: 0, totalND30: 0, totalND39: 0, totalItens: 0, groupedCategories: {} },
  classeVIII: { total: 0, totalND30: 0, totalND39: 0, totalItens: 0, groupedCategories: {} },
  classeIX: { total: 0, totalND30: 0, totalND39: 0, totalItens: 0, groupedCategories: {} },
  diarias: { total: 0, totalND15: 0, totalND30: 0, totalMilitares: 0, totalDiasViagem: 0 },
  verbaOperacional: { total: 0, totalND30: 0, totalND39: 0, totalEquipes: 0, totalDias: 0 },
  suprimentoFundos: { total: 0, totalND30: 0, totalND39: 0, totalEquipes: 0, totalDias: 0 },
  passagens: { total: 0, totalQuantidade: 0, totalTrechos: 0 },
  concessionaria: { total: 0, totalAgua: 0, totalEnergia: 0, totalRegistros: 0 },
  horasVoo: { total: 0, totalND30: 0, totalND39: 0, quantidadeHV: 0, groupedHV: {} },
  materialConsumo: { total: 0, totalND30: 0, totalND39: 0, groupedCategories: {} },
  complementoAlimentacao: { total: 0, totalND30: 0, totalND39: 0, groupedCategories: {} },
  servicosTerceiros: { total: 0, totalND33: 0, totalND39: 0, groupedCategories: {} },
  materialPermanente: { total: 0, totalND52: 0, groupedCategories: {} },
} as any);

const formatCategoryLabel = (cat: string, details?: any) => {
  if (cat === 'outros' && details?.nome_servico_outros) return details.nome_servico_outros;
  if (cat === 'fretamento-aereo') return 'Fretamento Aéreo';
  if (cat === 'servico-satelital') return 'Serviço Satelital';
  if (cat === 'transporte-coletivo') return 'Transporte Coletivo';
  if (cat === 'locacao-veiculos') return 'Locação de Veículos';
  if (cat === 'locacao-estruturas') return 'Locação de Estruturas';
  if (cat === 'servico-grafico') return 'Serviço Gráfico';
  return 'Serviços de Terceiros';
};

/**
 * Busca e calcula todos os totais de um P Trab agregando dados de todas as tabelas de registros.
 */
export const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabAggregatedTotals> => {
  if (isGhostMode()) {
    const mockTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 45000.50,
      totalOperacional: 1250.50,
      totalMaterialPermanente: 8900.00,
      totalAviacaoExercito: 15400.00,
      quantidadeHorasVoo: 70,
      totalRacoesOperacionaisGeral: 0,
      totalClasseI: 15000,
      totalComplemento: 5000,
      totalEtapaSolicitadaValor: 10000,
      totalDiasEtapaSolicitada: 8,
      totalRefeicoesIntermediarias: 150,
      totalClasseII: 5000,
      totalClasseII_ND30: 5000,
      totalClasseII_ND39: 0,
      totalItensClasseII: 10,
      groupedClasseIICategories: {},
      totalClasseV: 2000,
      totalClasseV_ND30: 2000,
      totalClasseV_ND39: 0,
      totalItensClasseV: 5,
      groupedClasseVCategories: {},
      totalClasseVI: 0, totalClasseVI_ND30: 0, totalClasseVI_ND39: 0, totalItensClasseVI: 0, groupedClasseVICategories: {},
      totalClasseVII: 0, totalClasseVII_ND30: 0, totalClasseVII_ND39: 0, totalItensClasseVII: 0, groupedClasseVIICategories: {},
      totalClasseVIII: 0, totalClasseVIII_ND30: 0, totalClasseVIII_ND39: 0, totalItensClasseVIII: 0, groupedClasseVIIICategories: {},
      totalClasseIX: 0, totalClasseIX_ND30: 0, totalClasseIX_ND39: 0, totalItensClasseIX: 0, groupedClasseIXCategories: {},
      totalDieselValor: 18000, totalGasolinaValor: 0, totalDieselLitros: 3000, totalGasolinaLitros: 0, totalLubrificanteValor: 5000.50, totalLubrificanteLitros: 100, totalCombustivel: 23000.50,
      totalDiarias: 0, totalDiariasND15: 0, totalDiariasND30: 0, totalMilitaresDiarias: 0, totalDiasViagem: 0,
      totalVerbaOperacional: 0, totalVerbaOperacionalND30: 0, totalVerbaOperacionalND39: 0, totalEquipesVerba: 0, totalDiasVerba: 0,
      totalSuprimentoFundos: 0, totalSuprimentoFundosND30: 0, totalSuprimentoFundosND39: 0, totalEquipesSuprimento: 0, totalDiasSuprimento: 0,
      totalPassagensND33: 0, totalQuantidadePassagens: 0, totalTrechosPassagens: 0,
      totalConcessionariaND39: 0, totalConcessionariaRegistros: 0, totalConcessionariaAgua: 0, totalConcessionariaEnergia: 0,
      totalHorasVoo: 15400.00, totalHorasVooND30: 15400.00, totalHorasVooND39: 0, 
      groupedHorasVoo: {
        "HM-4 Pantera": { totalValor: 15400.00, totalHV: 70 }
      },
      totalMaterialConsumo: 1250.50,
      totalMaterialConsumoND30: 1250.50,
      totalMaterialConsumoND39: 0,
      groupedMaterialConsumoCategories: {
        "Material de Construção": { totalValor: 1250.50, totalND30: 1250.50, totalND39: 0 }
      },
      totalComplementoAlimentacao: 0, totalComplementoAlimentacaoND30: 0, totalComplementoAlimentacaoND39: 0, groupedComplementoCategories: {},
      totalServicosTerceiros: 0, totalServicosTerceirosND33: 0, totalServicosTerceirosND39: 0, groupedServicosTerceirosCategories: {},
      totalMaterialPermanenteND52: 8900.00,
      groupedMaterialPermanenteCategories: {
        "Equipamentos": { totalValor: 8900.00, totalND52: 8900.00 }
      },
      groupedByOmSolicitante: {
        "1 BIS": {
          ...initializeOmTotals("1º BIS", "160222"),
          totalGeral: 1250.50 + 15400.00,
          totalOperacional: 1250.50,
          totalAviacaoExercito: 15400.00,
          materialConsumo: {
            total: 1250.50, totalND30: 1250.50, totalND39: 0,
            groupedCategories: { "Material de Construção": { totalValor: 1250.50, totalND30: 1250.50, totalND39: 0 } }
          },
          horasVoo: {
            total: 15400.00, totalND30: 15400.00, totalND39: 0, quantidadeHV: 70,
            groupedHV: { "HM-4 Pantera": { totalValor: 15400.00, totalHV: 70 } }
          }
        }
      },
      groupedByOmDestino: {
        "1 BIS": {
          ...initializeOmTotals("1º BIS", "160222"),
          totalGeral: 1250.50 + 15400.00,
          totalOperacional: 1250.50,
          totalAviacaoExercito: 15400.00,
          materialConsumo: {
            total: 1250.50, totalND30: 1250.50, totalND39: 0,
            groupedCategories: { "Material de Construção": { totalValor: 1250.50, totalND30: 1250.50, totalND39: 0 } }
          }
        }
      }
    };
    return mockTotals;
  }

  try {
    const groupedByOmSolicitante: Record<string, OmTotals> = {};
    const groupedByOmDestino: Record<string, OmTotals> = {};

    const getOmTotals = (omName: string, ug: string, mode: 'solicitante' | 'destino'): OmTotals => {
      const targetGroup = mode === 'solicitante' ? groupedByOmSolicitante : groupedByOmDestino;
      const cleanName = (omName || "NÃO ESPECIFICADO").trim();
      const cleanUg = (ug || "").trim();
      const key = normalizeOmName(cleanName);
      if (!targetGroup[key]) targetGroup[key] = initializeOmTotals(cleanName, cleanUg);
      else {
        const currentUgs = targetGroup[key].ug.split(', ');
        if (cleanUg && !currentUgs.includes(cleanUg)) targetGroup[key].ug = [...currentUgs, cleanUg].join(', ');
      }
      return targetGroup[key];
    };

    const { data: cl1 } = await supabase.from('classe_i_registros').select('*').eq('p_trab_id', ptrabId);
    (cl1 || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD_Solicitante = getOmTotals(record.organizacao, record.ug, 'destino');
      const omD_Fornecedora = getOmTotals(record.om_qs || record.organizacao, record.ug_qs || record.ug, 'destino');
      
      if (record.categoria === 'RACAO_QUENTE') {
        const totalQR = Number(record.total_qr || 0);
        const totalQS = Number(record.total_qs || 0);
        const compQR = Number(record.complemento_qr || 0);
        const compQS = Number(record.complemento_qs || 0);
        const etpQR = Number(record.etapa_qr || 0);
        const etpQS = Number(record.etapa_qs || 0);
        const diasEtp = calculateDiasEtapaSolicitada(Number(record.dias_operacao || 0));
        const totalRefInt = Number(record.efetivo || 0) * Number(record.nr_ref_int || 0) * Number(record.dias_operacao || 0);
        
        omS.classeI.total += totalQR + totalQS;
        omS.classeI.totalComplemento += compQR + compQS;
        omS.classeI.totalEtapaSolicitadaValor += etpQR + etpQS;
        omS.classeI.totalDiasEtapaSolicitada += diasEtp;
        omS.classeI.totalRefeicoesIntermediarias += totalRefInt;
        
        omD_Solicitante.classeI.total += totalQR;
        omD_Solicitante.classeI.totalComplemento += compQR;
        omD_Solicitante.classeI.totalEtapaSolicitadaValor += etpQR;
        
        omD_Fornecedora.classeI.total += totalQS;
        omD_Fornecedora.classeI.totalComplemento += compQS;
        omD_Fornecedora.classeI.totalEtapaSolicitadaValor += etpQS;
        omD_Fornecedora.classeI.totalDiasEtapaSolicitada += diasEtp;
        omD_Fornecedora.classeI.totalRefeicoesIntermediarias += totalRefInt;
      } else if (record.categoria === 'RACAO_OPERACIONAL') {
        const qtd = Number(record.quantidade_r2 || 0) + Number(record.quantidade_r3 || 0);
        omS.classeI.totalRacoesOperacionaisGeral += qtd;
        omD_Fornecedora.classeI.totalRacoesOperacionaisGeral += qtd;
      }
    });

    const [
      { data: cl2 }, { data: cl5 }, { data: cl6 }, { data: cl7 },
      { data: cl8s }, { data: cl8r }, { data: cl9 }, { data: cl3 },
      { data: diarias }, { data: verbaOp }, { data: passagens },
      { data: concessionaria }, { data: horasVoo }, { data: materialConsumo },
      { data: complementoAlimentacao }, { data: servicosTerceiros },
      { data: materialPermanente },
    ] = await Promise.all([
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
      supabase.from('complemento_alimentacao_registros').select('*').eq('p_trab_id', ptrabId),
      supabase.from('servicos_terceiros_registros' as any).select('*').eq('p_trab_id', ptrabId),
      supabase.from('material_permanente_registros' as any).select('*').eq('p_trab_id', ptrabId),
    ]);

    const processGenericClass = (data: any[], classe: string) => {
      data.forEach(record => {
        const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
        const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
        [omS, omD].forEach(omTotals => {
          const group = (omTotals as any)[`classe${classe}`];
          if (!group) return;
          const val = Number(record.valor_total || 0);
          const nd30 = Number(record.valor_nd_30 || 0);
          const nd39 = Number(record.valor_nd_39 || 0);
          group.total += val;
          group.totalND30 += nd30;
          group.totalND39 += nd39;
          const items = (record.itens_equipamentos || record.itens_saude || record.itens_remonta || record.itens_motomecanizacao || []) as any[];
          const count = items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
          group.totalItens += count;
          let cat = record.categoria || (classe === 'VIII' ? 'Saúde' : 'Geral');
          if (classe === 'VIII' && record.animal_tipo) cat = `Remonta - ${record.animal_tipo}`;
          if (!group.groupedCategories[cat]) group.groupedCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
          group.groupedCategories[cat].totalValor += val;
          group.groupedCategories[cat].totalND30 += nd30;
          group.groupedCategories[cat].totalND39 += nd39;
          group.groupedCategories[cat].totalItens += (classe === 'VIII' && record.animal_tipo) ? Number(record.quantidade_animais || 0) : count;
        });
      });
    };

    processGenericClass(cl2 || [], 'II');
    processGenericClass(cl5 || [], 'V');
    processGenericClass(cl6 || [], 'VI');
    processGenericClass(cl7 || [], 'VII');
    processGenericClass([...(cl8s || []), ...(cl8r || [])], 'VIII');
    processGenericClass(cl9 || [], 'IX');

    (cl3 || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        const val = Number(record.valor_total || 0);
        const lit = Number(record.total_litros || 0);
        omTotals.classeIII.total += val;
        if (record.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') {
          omTotals.classeIII.totalLubrificanteValor += val;
          omTotals.classeIII.totalLubrificanteLitros += lit;
        } else if (record.tipo_combustivel?.includes('DIESEL')) {
          omTotals.classeIII.totalDieselValor += val;
          omTotals.classeIII.totalDieselLitros += lit;
        } else if (record.tipo_combustivel?.includes('GAS')) {
          omTotals.classeIII.totalGasolinaValor += val;
          omTotals.classeIII.totalGasolinaLitros += lit;
        }
      });
    });

    (diarias || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        const val15 = Number(record.valor_nd_15 || 0);
        const val30 = Number(record.valor_nd_30 || 0);
        omTotals.diarias.total += val15 + val30;
        omTotals.diarias.totalND15 += val15 - Number(record.valor_taxa_embarque || 0);
        omTotals.diarias.totalND30 += Number(record.valor_taxa_embarque || 0) + val30;
        omTotals.diarias.totalMilitares += Number(record.quantidade || 0);
        omTotals.diarias.totalDiasViagem += Number(record.dias_operacao || 0);
      });
    });

    (verbaOp || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        const total = Number(record.valor_nd_30 || 0) + Number(record.valor_nd_39 || 0);
        const target = record.detalhamento === 'Suprimento de Fundos' ? omTotals.suprimentoFundos : omTotals.verbaOperacional;
        target.total += total;
        target.totalND30 += Number(record.valor_nd_30 || 0);
        target.totalND39 += Number(record.valor_nd_39 || 0);
        target.totalEquipes += Number(record.quantidade_equipes || 0);
        target.totalDias += Number(record.dias_operacao || 0);
      });
    });

    (passagens || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        omTotals.passagens.total += Number(record.valor_nd_33 || 0);
        omTotals.passagens.totalQuantidade += Number(record.quantidade_passagens || 0);
        omTotals.passagens.totalTrechos += 1;
      });
    });

    (concessionaria || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        const val39 = Number(record.valor_nd_39 || 0);
        omTotals.concessionaria.total += val39;
        omTotals.concessionaria.totalRegistros += 1;
        if (record.categoria === 'Água/Esgoto') omTotals.concessionaria.totalAgua += val39;
        else if (record.categoria === 'Energia Elétrica') omTotals.concessionaria.totalEnergia += val39;
      });
    });

    (horasVoo || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        const val30 = Number(record.valor_nd_30 || 0);
        const val39 = Number(record.valor_nd_39 || 0);
        const total = val30 + val39;
        omTotals.totalAviacaoExercito += total;
        omTotals.horasVoo.total += total;
        omTotals.horasVoo.totalND30 += val30;
        omTotals.horasVoo.totalND39 += val39;
        omTotals.horasVoo.quantidadeHV += Number(record.quantidade_hv || 0);
        const tipo = record.tipo_anv || 'Geral';
        if (!omTotals.horasVoo.groupedHV[tipo]) omTotals.horasVoo.groupedHV[tipo] = { totalValor: 0, totalHV: 0 };
        omTotals.horasVoo.groupedHV[tipo].totalValor += total;
        omTotals.horasVoo.groupedHV[tipo].totalHV += Number(record.quantidade_hv || 0);
      });
    });

    (materialConsumo || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      const val = Number(record.valor_total || 0);
      const nd30 = Number(record.valor_nd_30 || 0);
      const nd39 = Number(record.valor_nd_39 || 0);
      const cat = record.group_name || 'Geral';
      [omS, omD].forEach(omTotals => {
        omTotals.materialConsumo.total += val;
        omTotals.materialConsumo.totalND30 += nd30;
        omTotals.materialConsumo.totalND39 += nd39;
        if (!omTotals.materialConsumo.groupedCategories[cat]) omTotals.materialConsumo.groupedCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        omTotals.materialConsumo.groupedCategories[cat].totalValor += val;
        omTotals.materialConsumo.groupedCategories[cat].totalND30 += nd30;
        omTotals.materialConsumo.groupedCategories[cat].totalND39 += nd39;
      });
    });

    (complementoAlimentacao || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      if (record.categoria_complemento === 'genero') {
        const totalQS = Number(record.efetivo || 0) * Number(record.valor_etapa_qs || 0) * Number(record.dias_operacao || 0);
        const totalQR = Number(record.efetivo || 0) * Number(record.valor_etapa_qr || 0) * Number(record.dias_operacao || 0);
        const totalGeral = totalQS + totalQR;
        omS.complementoAlimentacao.total += totalGeral;
        omS.complementoAlimentacao.totalND30 += totalGeral;
        if (!omS.complementoAlimentacao.groupedCategories['Gênero Alimentício']) omS.complementoAlimentacao.groupedCategories['Gênero Alimentício'] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        omS.complementoAlimentacao.groupedCategories['Gênero Alimentício'].totalValor += totalGeral;
        omS.complementoAlimentacao.groupedCategories['Gênero Alimentício'].totalND30 += totalGeral;
        const omD_QS = getOmTotals(record.om_qs || record.organizacao, record.ug_qs || record.ug, 'destino');
        omD_QS.complementoAlimentacao.total += totalQS;
        omD_QS.complementoAlimentacao.totalND30 += totalQS;
        if (!omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)']) omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)'] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)'].totalValor += totalQS;
        omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)'].totalND30 += totalQS;
        const omD_QR = getOmTotals(record.om_qr || record.organizacao, record.ug_qr || record.ug, 'destino');
        omD_QR.complementoAlimentacao.total += totalQR;
        omD_QR.complementoAlimentacao.totalND30 += totalQR;
        if (!omD_QR.complementoAlimentacao.groupedCategories['Gênero Alimentício (QR)']) omD_QR.complementoAlimentacao.groupedCategories['Gênero Alimentício (QR)'] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        omD_QR.complementoAlimentacao.groupedCategories['Gênero Alimentício (QR)'].totalValor += totalQR;
        omD_QR.complementoAlimentacao.groupedCategories['Gênero Alimentício (QR)'].totalND30 += totalQR;
      } else {
        const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
        const val = Number(record.valor_total || 0);
        const nd30 = Number(record.valor_nd_30 || 0);
        const nd39 = Number(record.valor_nd_39 || 0);
        [omS, omD].forEach(omTotals => {
          omTotals.complementoAlimentacao.total += val;
          omTotals.complementoAlimentacao.totalND30 += nd30;
          omTotals.complementoAlimentacao.totalND39 += nd39;
          let cat = record.categoria_complemento === 'agua' ? 'Água Mineral' : 'Lanche/Catanho';
          if (!omTotals.complementoAlimentacao.groupedCategories) omTotals.complementoAlimentacao.groupedCategories = {};
          if (!omTotals.complementoAlimentacao.groupedCategories[cat]) omTotals.complementoAlimentacao.groupedCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
          omTotals.complementoAlimentacao.groupedCategories[cat].totalValor += val;
          omTotals.complementoAlimentacao.groupedCategories[cat].totalND30 += nd30;
          omTotals.complementoAlimentacao.groupedCategories[cat].totalND39 += nd39;
        });
      }
    });

    (servicosTerceiros as any[] || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      const val = Number(record.valor_total || 0);
      let nd33 = Number(record.valor_nd_30 || 0); let nd39 = Number(record.valor_nd_39 || 0);
      if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(record.categoria)) { nd33 = val; nd39 = 0; }
      const cat = formatCategoryLabel(record.categoria, record.detalhes_planejamento);
      [omS, omD].forEach(omTotals => {
        omTotals.servicosTerceiros.total += val; omTotals.servicosTerceiros.totalND33 += nd33; omTotals.servicosTerceiros.totalND39 += nd39;
        if (!omTotals.servicosTerceiros.groupedCategories[cat]) omTotals.servicosTerceiros.groupedCategories[cat] = { totalValor: 0, totalND33: 0, totalND39: 0 };
        omTotals.servicosTerceiros.groupedCategories[cat].totalValor += val;
        omTotals.servicosTerceiros.groupedCategories[cat].totalND33 += nd33;
        omTotals.servicosTerceiros.groupedCategories[cat].totalND39 += nd39;
      });
    });

    (materialPermanente as any[] || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      const val = Number(record.valor_total || 0);
      const nd52 = Number(record.valor_nd_52 || 0);
      const cat = record.categoria || 'Material Permanente';
      [omS, omD].forEach(omTotals => {
        omTotals.materialPermanente.total += val; omTotals.materialPermanente.totalND52 += nd52;
        if (!omTotals.materialPermanente.groupedCategories[cat]) omTotals.materialPermanente.groupedCategories[cat] = { totalValor: 0, totalND52: 0 };
        omTotals.materialPermanente.groupedCategories[cat].totalValor += val;
        omTotals.materialPermanente.groupedCategories[cat].totalND52 += nd52;
      });
    });

    let globalTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 0, totalOperacional: 0, totalMaterialPermanente: 0, totalAviacaoExercito: 0, totalRacoesOperacionaisGeral: 0,
      totalClasseI: 0, totalComplemento: 0, totalEtapaSolicitadaValor: 0, totalDiasEtapaSolicitada: 0, totalRefeicoesIntermediarias: 0,
      totalClasseII: 0, totalClasseII_ND30: 0, totalClasseII_ND39: 0, totalItensClasseII: 0, groupedClasseIICategories: {},
      totalClasseV: 0, totalClasseV_ND30: 0, totalClasseV_ND39: 0, totalItensClasseV: 0, groupedClasseVCategories: {},
      totalClasseVI: 0, totalClasseVI_ND30: 0, totalClasseVI_ND39: 0, totalItensClasseVI: 0, groupedClasseVICategories: {},
      totalClasseVII: 0, totalClasseVII_ND30: 0, totalClasseVII_ND39: 0, totalItensClasseVII: 0, groupedClasseVIICategories: {},
      totalClasseVIII: 0, totalClasseVIII_ND30: 0, totalClasseVIII_ND39: 0, totalItensClasseVIII: 0, groupedClasseVIIICategories: {},
      totalClasseIX: 0, totalClasseIX_ND30: 0, totalClasseIX_ND39: 0, totalItensClasseIX: 0, groupedClasseIXCategories: {},
      totalDieselValor: 0, totalGasolinaValor: 0, totalDieselLitros: 0, totalGasolinaLitros: 0, totalLubrificanteValor: 0, totalLubrificanteLitros: 0, totalCombustivel: 0,
      totalDiarias: 0, totalDiariasND15: 0, totalDiariasND30: 0, totalMilitaresDiarias: 0, totalDiasViagem: 0,
      totalVerbaOperacional: 0, totalVerbaOperacionalND30: 0, totalVerbaOperacionalND39: 0, totalEquipesVerba: 0, totalDiasVerba: 0,
      totalSuprimentoFundos: 0, totalSuprimentoFundosND30: 0, totalSuprimentoFundosND39: 0, totalEquipesSuprimento: 0, totalDiasSuprimento: 0,
      totalPassagensND33: 0, totalQuantidadePassagens: 0, totalTrechosPassagens: 0,
      totalConcessionariaND39: 0, totalConcessionariaRegistros: 0, totalConcessionariaAgua: 0, totalConcessionariaEnergia: 0,
      totalHorasVoo: 0, totalHorasVooND30: 0, totalHorasVooND39: 0, quantidadeHorasVoo: 0, groupedHorasVoo: {},
      totalMaterialConsumo: 0, totalMaterialConsumoND30: 0, totalMaterialConsumoND39: 0, groupedMaterialConsumoCategories: {},
      totalComplementoAlimentacao: 0, totalComplementoAlimentacaoND30: 0, totalComplementoAlimentacaoND39: 0, groupedComplementoCategories: {},
      totalServicosTerceiros: 0, totalServicosTerceirosND33: 0, totalServicosTerceirosND39: 0, groupedServicosTerceirosCategories: {},
      totalMaterialPermanenteND52: 0, groupedMaterialPermanenteCategories: {},
      groupedByOmSolicitante, groupedByOmDestino,
    };

    Object.values(groupedByOmSolicitante).forEach(omTotals => {
      omTotals.totalLogistica = omTotals.classeI.total + omTotals.classeII.total + omTotals.classeIII.total + omTotals.classeV.total + omTotals.classeVI.total + omTotals.classeVII.total + omTotals.classeVIII.total + omTotals.classeIX.total;
      omTotals.totalOperacional = omTotals.diarias.total + omTotals.verbaOperacional.total + omTotals.suprimentoFundos.total + omTotals.passagens.total + omTotals.concessionaria.total + omTotals.materialConsumo.total + omTotals.complementoAlimentacao.total + omTotals.servicosTerceiros.total;
      omTotals.totalMaterialPermanente = omTotals.materialPermanente.total;
      omTotals.totalGeral = omTotals.totalLogistica + omTotals.totalOperacional + omTotals.totalMaterialPermanente + omTotals.totalAviacaoExercito;
      globalTotals.totalLogisticoGeral += omTotals.totalLogistica;
      globalTotals.totalOperacional += omTotals.totalOperacional;
      globalTotals.totalMaterialPermanente += omTotals.totalMaterialPermanente;
      globalTotals.totalAviacaoExercito += omTotals.totalAviacaoExercito;
      globalTotals.totalRacoesOperacionaisGeral += omTotals.classeI.totalRacoesOperacionaisGeral;
      globalTotals.totalClasseI += omTotals.classeI.total;
      globalTotals.totalComplemento += omTotals.classeI.totalComplemento;
      globalTotals.totalEtapaSolicitadaValor += omTotals.classeI.totalEtapaSolicitadaValor;
      globalTotals.totalDiasEtapaSolicitada += omTotals.classeI.totalDiasEtapaSolicitada;
      globalTotals.totalRefeicoesIntermediarias += omTotals.classeI.totalRefeicoesIntermediarias;
      
      const mergeClass = (key: string, omGroup: any) => {
        if (!omGroup) return;
        (globalTotals as any)[`totalClasse${key}`] += omGroup.total;
        (globalTotals as any)[`totalClasse${key}_ND30`] += omGroup.totalND30;
        (globalTotals as any)[`totalClasse${key}_ND39`] += omGroup.totalND39;
        (globalTotals as any)[`totalItensClasse${key}`] += omGroup.totalItens;
        const globalGrouped = (globalTotals as any)[`groupedClasse${key}Categories`];
        Object.entries(omGroup.groupedCategories || {}).forEach(([cat, data]: [string, any]) => {
          if (!globalGrouped[cat]) globalGrouped[cat] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
          globalGrouped[cat].totalValor += data.totalValor;
          globalGrouped[cat].totalND30 += data.totalND30;
          globalGrouped[cat].totalND39 += data.totalND39;
          globalGrouped[cat].totalItens += data.totalItens;
        });
      };
      ['II', 'V', 'VI', 'VII', 'VIII', 'IX'].forEach(k => mergeClass(k, (omTotals as any)[`classe${k}`]));
      globalTotals.totalCombustivel += omTotals.classeIII.total;
      globalTotals.totalDieselValor += omTotals.classeIII.totalDieselValor;
      globalTotals.totalGasolinaValor += omTotals.classeIII.totalGasolinaValor;
      globalTotals.totalDieselLitros += omTotals.classeIII.totalDieselLitros;
      globalTotals.totalGasolinaLitros += omTotals.classeIII.totalGasolinaLitros;
      globalTotals.totalLubrificanteValor += omTotals.classeIII.totalLubrificanteValor;
      globalTotals.totalLubrificanteLitros += omTotals.classeIII.totalLubrificanteLitros;
      globalTotals.totalDiarias += omTotals.diarias.total;
      globalTotals.totalDiariasND15 += omTotals.diarias.totalND15;
      globalTotals.totalDiariasND30 += omTotals.diarias.totalND30;
      globalTotals.totalMilitaresDiarias += omTotals.diarias.totalMilitares;
      globalTotals.totalDiasViagem += omTotals.diarias.totalDiasViagem;
      globalTotals.totalVerbaOperacional += omTotals.verbaOperacional.total;
      globalTotals.totalVerbaOperacionalND30 += omTotals.verbaOperacional.totalND30;
      globalTotals.totalVerbaOperacionalND39 += omTotals.verbaOperacional.totalND39;
      globalTotals.totalEquipesVerba += omTotals.verbaOperacional.totalEquipes;
      globalTotals.totalDiasVerba += omTotals.verbaOperacional.totalDias;
      globalTotals.totalSuprimentoFundos += omTotals.suprimentoFundos.total;
      globalTotals.totalSuprimentoFundosND30 += omTotals.suprimentoFundos.totalND30;
      globalTotals.totalSuprimentoFundosND39 += omTotals.suprimentoFundos.totalND39;
      globalTotals.totalEquipesSuprimento += omTotals.suprimentoFundos.totalEquipes;
      globalTotals.totalDiasSuprimento += omTotals.suprimentoFundos.totalDias;
      globalTotals.totalPassagensND33 += omTotals.passagens.total;
      globalTotals.totalQuantidadePassagens += omTotals.passagens.totalQuantidade;
      globalTotals.totalTrechosPassagens += omTotals.passagens.totalTrechos;
      globalTotals.totalConcessionariaND39 += omTotals.concessionaria.total;
      globalTotals.totalConcessionariaRegistros += omTotals.concessionaria.totalRegistros;
      globalTotals.totalConcessionariaAgua += omTotals.concessionaria.totalAgua;
      globalTotals.totalConcessionariaEnergia += omTotals.concessionaria.totalEnergia;
      globalTotals.totalHorasVoo += omTotals.horasVoo.total;
      globalTotals.totalHorasVooND30 += omTotals.horasVoo.totalND30;
      globalTotals.totalHorasVooND39 += omTotals.horasVoo.totalND39;
      globalTotals.quantidadeHorasVoo += omTotals.horasVoo.quantidadeHV;
      Object.entries(omTotals.horasVoo.groupedHV || {}).forEach(([tipo, data]) => {
        if (!globalTotals.groupedHorasVoo[tipo]) globalTotals.groupedHorasVoo[tipo] = { totalValor: 0, totalHV: 0 };
        globalTotals.groupedHorasVoo[tipo].totalValor += data.totalValor;
        globalTotals.groupedHorasVoo[tipo].totalHV += data.totalHV;
      });
      globalTotals.totalMaterialConsumo += omTotals.materialConsumo.total;
      globalTotals.totalMaterialConsumoND30 += omTotals.materialConsumo.totalND30;
      globalTotals.totalMaterialConsumoND39 += omTotals.materialConsumo.totalND39;
      Object.entries(omTotals.materialConsumo.groupedCategories || {}).forEach(([cat, data]) => {
        if (!globalTotals.groupedMaterialConsumoCategories[cat]) globalTotals.groupedMaterialConsumoCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        globalTotals.groupedMaterialConsumoCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedMaterialConsumoCategories[cat].totalND30 += data.totalND30;
        globalTotals.groupedMaterialConsumoCategories[cat].totalND39 += data.totalND39;
      });
      globalTotals.totalComplementoAlimentacao += omTotals.complementoAlimentacao.total;
      globalTotals.totalComplementoAlimentacaoND30 += omTotals.complementoAlimentacao.totalND30;
      globalTotals.totalComplementoAlimentacaoND39 += omTotals.complementoAlimentacao.totalND39;
      Object.entries(omTotals.complementoAlimentacao.groupedCategories || {}).forEach(([cat, data]) => {
        if (!globalTotals.groupedComplementoCategories[cat]) globalTotals.groupedComplementoCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        globalTotals.groupedComplementoCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedComplementoCategories[cat].totalND30 += data.totalND30;
        globalTotals.groupedComplementoCategories[cat].totalND39 += data.totalND39;
      });
      globalTotals.totalServicosTerceiros += omTotals.servicosTerceiros.total;
      globalTotals.totalServicosTerceirosND33 += omTotals.servicosTerceiros.totalND33;
      globalTotals.totalServicosTerceirosND39 += omTotals.servicosTerceiros.totalND39;
      Object.entries(omTotals.servicosTerceiros.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, data]) => {
        if (!globalTotals.groupedServicosTerceirosCategories[cat]) globalTotals.groupedServicosTerceirosCategories[cat] = { totalValor: 0, totalND33: 0, totalND39: 0 };
        globalTotals.groupedServicosTerceirosCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedServicosTerceirosCategories[cat].totalND33 += data.totalND33;
        globalTotals.groupedServicosTerceirosCategories[cat].totalND39 += data.totalND39;
      });
      globalTotals.totalMaterialPermanenteND52 += omTotals.materialPermanente.totalND52;
      Object.entries(omTotals.materialPermanente.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, data]: [string, any]) => {
        if (!globalTotals.groupedMaterialPermanenteCategories[cat]) globalTotals.groupedMaterialPermanenteCategories[cat] = { totalValor: 0, totalND52: 0 };
        globalTotals.groupedMaterialPermanenteCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedMaterialPermanenteCategories[cat].totalND52 += data.totalND52;
      });
    });

    Object.values(groupedByOmDestino).forEach(omTotals => {
      omTotals.totalLogistica = omTotals.classeI.total + omTotals.classeII.total + omTotals.classeIII.total + omTotals.classeV.total + omTotals.classeVI.total + omTotals.classeVII.total + omTotals.classeVIII.total + omTotals.classeIX.total;
      omTotals.totalOperacional = omTotals.diarias.total + omTotals.verbaOperacional.total + omTotals.suprimentoFundos.total + omTotals.passagens.total + omTotals.concessionaria.total + omTotals.materialConsumo.total + omTotals.complementoAlimentacao.total + omTotals.servicosTerceiros.total;
      omTotals.totalMaterialPermanente = omTotals.materialPermanente.total;
      omTotals.totalGeral = omTotals.totalLogistica + omTotals.totalOperacional + omTotals.totalMaterialPermanente + omTotals.totalAviacaoExercito;
    });
    return globalTotals;
  } catch (err) { console.error("Erro crítico no processamento de totais:", err); throw err; }
};

// --- Componentes de Visualização ---

const CategoryCard = ({ label, value, icon: Icon, colorClass, nd15, nd30, nd33, nd39, nd52, extraInfo, details }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (value === 0 && !extraInfo) return null;
  return (
    <div className={cn("flex flex-col p-5 rounded-xl border border-border/50 bg-card/40 hover:bg-accent/5 transition-all group cursor-pointer min-h-[110px]", isExpanded && "ring-1 ring-primary/30 bg-accent/5 shadow-sm")} onClick={() => details && setIsExpanded(!isExpanded)}>
      <div className="flex items-center gap-4 mb-4">
        <div className={cn("p-3 rounded-lg transition-colors", colorClass)}><Icon className="h-6 w-6" /></div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold leading-none mb-2 truncate">{label}</span>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold text-foreground leading-none">{value > 0 ? formatCurrency(value) : extraInfo}</span>
            {value > 0 && extraInfo && <span className="text-[12px] font-bold text-primary mt-2">{extraInfo}</span>}
          </div>
        </div>
        {details && <ChevronDown className={cn("h-5 w-5 ml-auto text-muted-foreground transition-transform duration-200 shrink-0", isExpanded ? "rotate-180" : "rotate-0")} />}
      </div>
      {(nd15 !== undefined || nd30 !== undefined || nd33 !== undefined || nd39 !== undefined || nd52 !== undefined) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-auto pt-4 border-t border-dashed border-border/50">
          {nd15 !== undefined && nd15 > 0 && <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase font-bold">ND 15</span><span className="text-[12px] font-semibold text-purple-600 leading-none">{formatCurrency(nd15)}</span></div>}
          {nd30 !== undefined && nd30 > 0 && <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase font-bold">ND 30</span><span className="text-[12px] font-semibold text-green-600 leading-none">{formatCurrency(nd30)}</span></div>}
          {nd33 !== undefined && nd33 > 0 && <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase font-bold">ND 33</span><span className="text-[12px] font-semibold text-cyan-600 leading-none">{formatCurrency(nd33)}</span></div>}
          {nd39 !== undefined && nd39 > 0 && <div className="flex flex-col text-right"><span className="text-[10px] text-muted-foreground uppercase font-bold">ND 39</span><span className="text-[12px] font-semibold text-blue-600 leading-none">{formatCurrency(nd39)}</span></div>}
          {nd52 !== undefined && nd52 > 0 && <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase font-bold">ND 52</span><span className="text-[12px] font-semibold text-green-700 leading-none">{formatCurrency(nd52)}</span></div>}
        </div>
      )}
      {isExpanded && details && <div className="mt-5 pt-5 border-t border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">{details}</div>}
    </div>
  );
};

const OmDetailsDialog = ({ om, totals, onClose }: any) => {
  if (!om) return null;
  const renderClassDetails = (group: any, unitLabel: string = 'un.') => (
    <div className="space-y-2.5 text-[12px]">
      {Object.entries(group.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([category, data]: [string, any]) => (
        <div key={category} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0">
          <span className="font-medium w-1/2 text-left truncate pr-3">{category}</span>
          <div className="flex w-1/2 justify-between gap-3">
            <span className="font-medium text-right w-1/2 whitespace-nowrap">{formatNumber((data as any).totalItens || 0)} {unitLabel}</span>
            <span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency((data as any).totalValor)}</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={!!om} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1400px] max-h-[90vh] flex flex-col p-0 overflow-hidden tour-om-details-dialog">
        <DialogHeader className="p-8 pb-5 border-b border-border/50">
          <DialogTitle className="text-3xl font-bold">{om.omName}</DialogTitle>
          <div className="text-base font-normal text-muted-foreground">{om.ug ? `UG(s): ${om.ug.split(', ').map((u: string) => formatCodug(u)).join(', ')} | ` : ''}Total: {formatCurrency(om.totalGeral)}</div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-8 space-y-12">
          {om.totalLogistica > 0 && (
            <div>
              <h3 className="text-base font-bold text-orange-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-orange-500/20 pb-2"><div className="flex items-center gap-2"><Package className="h-5 w-5" />Aba Logística</div><span className="text-xl font-extrabold">{formatCurrency(om.totalLogistica)}</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <CategoryCard label="Classe I (Alimentação)" value={om.classeI.total} icon={Utensils} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeI.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left truncate pr-3">Complemento (Ref. Int.)</span><span className="w-1/4 text-right font-medium">{formatNumber(om.classeI.totalRefeicoesIntermediarias)}</span><span className="w-1/4 text-right font-bold text-foreground">{formatCurrency(om.classeI.totalComplemento)}</span></div><div className="flex justify-between text-muted-foreground"><span className="w-1/2 text-left truncate pr-3">Etapa Solicitada</span><span className="w-1/4 text-right font-medium">{formatNumber(om.classeI.totalDiasEtapaSolicitada)} dias</span><span className="w-1/4 text-right font-bold text-foreground">{formatCurrency(om.classeI.totalEtapaSolicitadaValor)}</span></div></div>} />
                <CategoryCard label="Classe II (Intendência)" value={om.classeII.total} icon={ClipboardList} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeII.totalND30} nd39={om.classeII.totalND39} details={renderClassDetails(om.classeII)} />
                <CategoryCard label="Classe III (Combustíveis)" value={om.classeIII.total} icon={Fuel} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeIII.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left">Óleo Diesel</span><span className="w-1/4 text-right">{formatNumber(om.classeIII.totalDieselLitros)} L</span><span className="w-1/4 text-right font-bold text-foreground">{formatCurrency(om.classeIII.totalDieselValor)}</span></div><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left">Gasolina</span><span className="w-1/4 text-right">{formatNumber(om.classeIII.totalGasolinaLitros)} L</span><span className="w-1/4 text-right font-bold text-foreground">{formatCurrency(om.classeIII.totalGasolinaValor)}</span></div><div className="flex justify-between text-muted-foreground"><span className="w-1/2 text-left">Lubrificante</span><span className="w-1/4 text-right">{formatNumber(om.classeIII.totalLubrificanteLitros, 2)} L</span><span className="w-1/4 text-right font-bold text-foreground">{formatCurrency(om.classeIII.totalLubrificanteValor)}</span></div></div>} />
                <CategoryCard label="Classe V (Armamento)" value={om.classeV.total} icon={Swords} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeV.totalND30} nd39={om.classeV.totalND39} details={renderClassDetails(om.classeV)} />
                <CategoryCard label="Classe VI (Engenharia)" value={om.classeVI.total} icon={HardHat} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeVI.totalND30} nd39={om.classeVI.totalND39} details={renderClassDetails(om.classeVI)} />
                <CategoryCard label="Classe VII (Com/Inf)" value={om.classeVII.total} icon={Radio} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeVII.totalND30} nd39={om.classeVII.totalND39} details={renderClassDetails(om.classeVII)} />
                <CategoryCard label="Classe VIII (Saúde/Remonta)" value={om.classeVIII.total} icon={HeartPulse} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeVIII.totalND30} nd39={om.classeVIII.totalND39} details={renderClassDetails(om.classeVIII)} />
                <CategoryCard label="Classe IX (Motomecanização)" value={om.classeIX.total} icon={Truck} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeIX.totalND30} nd39={om.classeIX.totalND39} details={renderClassDetails(om.classeIX, 'vtr')} />
              </div>
            </div>
          )}
          {om.totalOperacional > 0 && (
            <div>
              <h3 className="text-base font-bold text-blue-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-blue-500/20 pb-2"><div className="flex items-center gap-2"><Activity className="h-5 w-5" />Aba Operacional</div><span className="text-xl font-extrabold">{formatCurrency(om.totalOperacional)}</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <CategoryCard label="Complemento de Alimentação" value={om.complementoAlimentacao.total} icon={Utensils} colorClass="bg-blue-500/10 text-blue-600" nd30={om.complementoAlimentacao.totalND30} details={<div className="space-y-2.5 text-[12px]">{Object.entries(om.complementoAlimentacao.groupedCategories || {}).map(([cat, data]: any) => (<div key={cat} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0"><span>{cat}</span><span className="font-bold text-foreground">{formatCurrency(data.totalValor)}</span></div>))}</div>} />
                <CategoryCard label="Concessionária" value={om.concessionaria.total} icon={Droplet} colorClass="bg-blue-500/10 text-blue-600" nd39={om.concessionaria.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span>Água/Esgoto</span><span className="font-bold text-foreground">{formatCurrency(om.concessionaria.totalAgua)}</span></div><div className="flex justify-between text-muted-foreground"><span>Energia Elétrica</span><span className="font-bold text-foreground">{formatCurrency(om.concessionaria.totalEnergia)}</span></div></div>} />
                <CategoryCard label="Diárias" value={om.diarias.total} icon={Briefcase} colorClass="bg-blue-500/10 text-blue-600" nd15={om.diarias.totalND15} nd30={om.diarias.totalND30} />
                <CategoryCard label="Material de Consumo" value={om.materialConsumo.total} icon={Package} colorClass="bg-blue-500/10 text-blue-600" nd30={om.materialConsumo.totalND30} nd39={om.materialConsumo.totalND39} />
                <CategoryCard label="Passagens" value={om.passagens.total} icon={Plane} colorClass="bg-blue-500/10 text-blue-600" nd33={om.passagens.total} />
                <CategoryCard label="Serviços de Terceiros" value={om.servicosTerceiros.total} icon={ClipboardList} colorClass="bg-blue-500/10 text-blue-600" nd33={om.servicosTerceiros.totalND33} nd39={om.servicosTerceiros.totalND39} />
              </div>
            </div>
          )}
          {(om.totalAviacaoExercito > 0 || om.horasVoo.quantidadeHV > 0) && (
            <div>
              <h3 className="text-base font-bold text-purple-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-purple-500/20 pb-2"><div className="flex items-center gap-2"><Helicopter className="h-5 w-5" />Aba Aviação do Exército</div><span className="text-xl font-extrabold">{formatNumber(om.horasVoo.quantidadeHV, 2)} HV</span></h3>
              <CategoryCard label="Horas de Voo" value={0} icon={Helicopter} colorClass="bg-purple-500/10 text-purple-600" nd30={om.horasVoo.totalND30} nd39={om.horasVoo.totalND39} extraInfo={`${formatNumber(om.horasVoo.quantidadeHV, 2)} HV`} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TabDetailsProps { mode: 'logistica' | 'operacional' | 'permanente' | 'avex'; data: PTrabAggregatedTotals; }

const TabDetails = ({ mode, data }: TabDetailsProps) => {
  const valueClasses = "font-medium text-foreground text-right w-[6rem] flex-shrink-0";
  const renderClassAccordion = (key: string, title: string, icon: any, unitLabel: string, isRemonta = false) => {
    const classData = {
      total: (data as any)[`totalClasse${key.toUpperCase()}`],
      totalND30: (data as any)[`totalClasse${key.toUpperCase()}_ND30`],
      totalND39: (data as any)[`totalClasse${key.toUpperCase()}_ND39`],
      totalItens: (data as any)[`totalItensClasse${key.toUpperCase()}`],
      groupedCategories: (data as any)[`groupedClasse${key.toUpperCase()}Categories`]
    };
    if (!classData.total || classData.total === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value={`item-${key}`} className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline"><div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50"><div className="flex items-center gap-1 text-foreground">{icon}{title}</div><span className={cn(valueClasses, "text-xs mr-6")}>{formatCurrency(classData.total)}</span></div></AccordionTrigger>
          <AccordionContent className="pt-1 pb-0"><div className="space-y-1 pl-4 text-[10px]">{Object.entries(classData.groupedCategories || {}).map(([cat, d]: any) => (<div key={cat} className="space-y-1"><div className="flex justify-between text-muted-foreground font-semibold"><span>{cat}</span><span>{formatNumber(d.totalItens)} {isRemonta ? 'animais' : unitLabel} | {formatCurrency(d.totalValor)}</span></div></div>))}</div></AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  if (mode === 'logistica') {
    return (
      <div className="space-y-3 border-l-4 border-orange-500 pl-3">
        <div className="flex items-center justify-between text-xs font-semibold text-orange-600 mb-2"><span>Logística</span><span className="font-bold text-sm">{formatCurrency(data.totalLogisticoGeral)}</span></div>
        {renderClassAccordion('II', 'Classe II', <ClipboardList className="h-3 w-3 text-orange-500" />, 'un.')}
        {renderClassAccordion('V', 'Classe V', <Swords className="h-3 w-3 text-orange-500" />, 'un.')}
        {renderClassAccordion('IX', 'Classe IX', <Truck className="h-3 w-3 text-orange-500" />, 'vtr')}
      </div>
    );
  }
  if (mode === 'operacional') {
    return (
      <div className="space-y-3 border-l-4 border-blue-500 pl-3">
        <div className="flex items-center justify-between text-xs font-semibold text-blue-600 mb-2"><span>Operacional</span><span className="font-bold text-sm">{formatCurrency(data.totalOperacional)}</span></div>
        <Accordion type="single" collapsible className="w-full pt-1"><AccordionItem value="item-material-consumo" className="border-b-0" id="tour-material-consumo-row"><AccordionTrigger className="p-0 hover:no-underline tour-material-consumo-trigger"><div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50"><div className="flex items-center gap-1 text-foreground"><Package className="h-3 w-3 text-blue-500" />Material de Consumo</div><span className={cn(valueClasses, "text-xs mr-6")}>{formatCurrency(data.totalMaterialConsumo)}</span></div></AccordionTrigger><AccordionContent className="pt-1 pb-0"><div className="space-y-1 pl-4 text-[10px]">{Object.entries(data.groupedMaterialConsumoCategories || {}).map(([cat, d]: any) => (<div key={cat} className="flex justify-between"><span>{cat}</span><span>{formatCurrency(d.totalValor)}</span></div>))}</div></AccordionContent></AccordionItem></Accordion>
      </div>
    );
  }
  if (mode === 'avex') {
    return (
      <div className="space-y-3 border-l-4 border-purple-500 pl-3 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-purple-600 mb-2"><div className="flex items-center gap-2"><Helicopter className="h-3 w-3" />Aviação do Exército</div><span className="font-bold text-sm">{formatNumber(data.quantidadeHorasVoo, 2)} HV</span></div>
      </div>
    );
  }
  return null;
};

interface PTrabCostSummaryProps { ptrabId: string; onOpenCreditDialog: () => void; creditGND3: number; creditGND4: number; }

export const PTrabCostSummary = ({ ptrabId, onOpenCreditDialog, creditGND3, creditGND4 }: PTrabCostSummaryProps) => {
  const { data, isLoading, error } = useQuery<PTrabAggregatedTotals>({ queryKey: ['ptrabTotals', ptrabId], queryFn: () => fetchPTrabTotals(ptrabId), enabled: !!ptrabId, refetchInterval: 10000 });
  const [viewMode, setViewMode] = useState<'global' | 'byOm'>('global');
  const [omGroupingMode, setOmGroupingMode] = useState<'solicitante' | 'destino'>('solicitante');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOm, setSelectedOm] = useState<OmTotals | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDetailsOpen && isGhostMode()) {
      setTimeout(() => {
        const trigger = document.querySelector('.tour-material-consumo-trigger') as HTMLElement;
        if (trigger && trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
        setTimeout(() => window.dispatchEvent(new CustomEvent('tour:avancar')), 400);
      }, 150);
    }
  }, [isDetailsOpen]);

  useEffect(() => { if (viewMode === 'byOm' && isGhostMode()) setTimeout(() => window.dispatchEvent(new CustomEvent('tour:avancar')), 300); }, [viewMode]);
  useEffect(() => { if (selectedOm && isGhostMode()) setTimeout(() => window.dispatchEvent(new CustomEvent('tour:avancar')), 400); }, [selectedOm]);

  const sortedOmTotals = useMemo(() => {
    const omGroups = omGroupingMode === 'solicitante' ? data?.groupedByOmSolicitante : data?.groupedByOmDestino;
    if (!omGroups) return [];
    return Object.values(omGroups).sort((a, b) => b.totalGeral - a.totalGeral);
  }, [data, omGroupingMode]);

  if (isLoading) return <Card className="shadow-lg"><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (error || !data) return <Card className="shadow-lg border-destructive"><CardContent className="py-4 text-sm text-destructive">Erro ao carregar totais.</CardContent></Card>;

  const totalGND3Cost = data.totalLogisticoGeral + data.totalOperacional + data.totalAviacaoExercito;
  const totalGeralFinal = totalGND3Cost + data.totalMaterialPermanente;
  const saldoGND3 = creditGND3 - totalGND3Cost;
  const saldoGND4 = creditGND4 - data.totalMaterialPermanente;

  return (
    <Card className="shadow-lg tour-cost-summary-card">
      <CardHeader className="pb-2 pt-3"><CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle><CardDescription className="text-xs">Visão consolidada dos custos logísticos e orçamentários.</CardDescription></CardHeader>
      <CardContent className="space-y-4 p-0 pb-3">
        {viewMode === 'global' ? (
          <div className="w-full space-y-1 text-sm px-6 pt-3">
            <div className="flex justify-between text-orange-600 cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}><span>Aba Logística</span><span className="font-bold">{formatCurrency(data.totalLogisticoGeral)}</span></div>
            <div className="flex justify-between text-blue-600 cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}><span>Aba Operacional</span><span className="font-bold">{formatCurrency(data.totalOperacional)}</span></div>
            <div className="flex justify-between text-green-600 cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}><span>Aba Material Permanente</span><span className="font-bold">{formatCurrency(data.totalMaterialPermanente)}</span></div>
            <div className="flex justify-between text-purple-600 cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}><span>Aba Aviação do Exército</span><span className="font-bold">{formatNumber(data.quantidadeHorasVoo, 2)} HV</span></div>
          </div>
        ) : (
          <div className="w-full space-y-1 text-sm px-6 pt-3 tour-costs-by-om-list">
            {sortedOmTotals.map(om => (
              <div key={om.omKey} className={cn("flex justify-between items-center cursor-pointer p-1 hover:bg-muted/50 rounded", om.omName === "1º BIS" && "tour-mock-om-item")} onClick={() => setSelectedOm(om)}>
                <span className="font-semibold text-sm">{om.omName}</span>
                <span className="font-bold text-primary">{formatCurrency(om.totalGeral)}</span>
              </div>
            ))}
            <div className="flex gap-2 mt-4 pt-3 border-t tour-om-grouping-controls">
              <Button variant={omGroupingMode === 'solicitante' ? 'default' : 'outline'} size="sm" className="flex-1 h-7 text-[9px]" onClick={() => setOmGroupingMode('solicitante')}><Building2 className="h-3 w-3 mr-1" /> Por Solicitante</Button>
              <Button variant={omGroupingMode === 'destino' ? 'default' : 'outline'} size="sm" className="flex-1 h-7 text-[9px]" onClick={() => setOmGroupingMode('destino')}><MapPin className="h-3 w-3 mr-1" /> Por Destino</Button>
            </div>
          </div>
        )}
        <div className="w-full px-6 border-t pt-2">
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col"><span className="text-base font-bold">Total Geral</span><Button variant="ghost" size="sm" className="h-6 text-[10px] p-0 text-primary tour-btn-view-by-om" onClick={() => { setViewMode(viewMode === 'byOm' ? 'global' : 'byOm'); setIsDetailsOpen(false); }}>{viewMode === 'byOm' ? 'Voltar ao Global' : 'Ver por OM'}</Button></div>
            <div className="flex flex-col items-end"><span className="text-lg font-bold">{formatCurrency(totalGeralFinal)}</span>{viewMode === 'global' && <button className="text-primary text-xs hover:underline flex items-center gap-1" onClick={() => setIsDetailsOpen(!isDetailsOpen)}>{isDetailsOpen ? "ocultar" : "detalhar"}<ChevronDown className={cn("h-3 w-3 transition-transform", isDetailsOpen && "rotate-180")} /></button>}</div>
          </div>
          {isDetailsOpen && viewMode === 'global' && (
            <div className="space-y-4 pt-2 animate-in fade-in" ref={detailsRef}>
              <TabDetails mode="logistica" data={data} />
              <TabDetails mode="operacional" data={data} />
              <TabDetails mode="avex" data={data} />
            </div>
          )}
        </div>
        <div className="px-6 border-t pt-3 space-y-2">
          <div className="flex justify-between items-center text-sm text-muted-foreground"><h4 className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Saldo GND 3</h4><span className={cn("font-bold", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>{formatCurrency(saldoGND3)}</span></div>
          <div className="flex justify-between items-center text-sm text-muted-foreground"><h4 className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Saldo GND 4</h4><span className={cn("font-bold", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>{formatCurrency(saldoGND4)}</span></div>
          <Button onClick={onOpenCreditDialog} variant="outline" className="w-full h-8 text-xs border-primary text-primary mt-2">Informar Crédito Disponível</Button>
        </div>
      </CardContent>
      <OmDetailsDialog om={selectedOm} totals={data} onClose={() => setSelectedOm(null)} />
    </Card>
  );
};