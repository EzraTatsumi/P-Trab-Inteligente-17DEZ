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
  materialConsumo: { total: 0, totalND30: number, totalND39: number, groupedCategories: {} },
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
  // Lógica de Mock para o Ghost Mode (Missão 04)
  if (isGhostMode()) {
    const mockTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 45000.50,
      totalOperacional: 1250.50,
      totalMaterialPermanente: 8900.00,
      totalAviacaoExercito: 15400.00, // Simula valor para 70 HV
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
          totalGeral: 1250.50 + 15400.00, // Material + AvEx
          totalOperacional: 1250.50,
          totalAviacaoExercito: 15400.00,
          materialConsumo: {
            total: 1250.50,
            totalND30: 1250.50,
            totalND39: 0,
            groupedCategories: {
              "Material de Construção": { totalValor: 1250.50, totalND30: 1250.50, totalND39: 0 }
            }
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
            total: 1250.50,
            totalND30: 1250.50,
            totalND39: 0,
            groupedCategories: {
              "Material de Construção": { totalValor: 1250.50, totalND30: 1250.50, totalND39: 0 }
            }
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

    // --- 11. Horas de Voo (AvEx) ---
    (horasVoo || []).forEach(record => {
      const omS = getOmTotals(record.organizacao, record.ug, 'solicitante');
      const omD = getOmTotals(record.om_detentora || record.organizacao, record.ug_detentora || record.ug, 'destino');
      [omS, omD].forEach(omTotals => {
        const val30 = Number(record.valor_nd_30 || 0);
        const val39 = Number(record.valor_nd_39 || 0);
        const total = val30 + val39;
        
        // Atualiza o campo robusto para agregação direta
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
        if (!omTotals.materialConsumo.groupedCategories[cat]) {
          omTotals.materialConsumo.groupedCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        }
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
        if (!omS.complementoAlimentacao.groupedCategories['Gênero Alimentício']) {
          omS.complementoAlimentacao.groupedCategories['Gênero Alimentício'] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        }
        omS.complementoAlimentacao.groupedCategories['Gênero Alimentício'].totalValor += totalGeral;
        omS.complementoAlimentacao.groupedCategories['Gênero Alimentício'].totalND30 += totalGeral;
        const omD_QS = getOmTotals(record.om_qs || record.organizacao, record.ug_qs || record.ug, 'destino');
        omD_QS.complementoAlimentacao.total += totalQS;
        omD_QS.complementoAlimentacao.totalND30 += totalQS;
        if (!omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)']) {
          omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)'] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        }
        omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)'].totalValor += totalQS;
        omD_QS.complementoAlimentacao.groupedCategories['Gênero Alimentício (QS)'].totalND30 += totalQS;
        const omD_QR = getOmTotals(record.om_qr || record.organizacao, record.ug_qr || record.ug, 'destino');
        omD_QR.complementoAlimentacao.total += totalQR;
        omD_QR.complementoAlimentacao.totalND30 += totalQR;
        if (!omD_QR.complementoAlimentacao.groupedCategories['Gênero Alimentício (QR)']) {
          omD_QR.complementoAlimentacao.groupedCategories['Gênero Alimentício (QR)'] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        }
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
          if (!omTotals.complementoAlimentacao.groupedCategories[cat]) {
            omTotals.complementoAlimentacao.groupedCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
          }
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
      let nd33 = Number(record.valor_nd_30 || 0); 
      let nd39 = Number(record.valor_nd_39 || 0);
      if (['fretamento-aereo', 'locacao-veiculos', 'transporte-coletivo'].includes(record.categoria)) {
        nd33 = val;
        nd39 = 0;
      }
      const cat = formatCategoryLabel(record.categoria, record.detalhes_planejamento);
      [omS, omD].forEach(omTotals => {
        omTotals.servicosTerceiros.total += val;
        omTotals.servicosTerceiros.totalND33 += nd33;
        omTotals.servicosTerceiros.totalND39 += nd39;
        if (!omTotals.servicosTerceiros.groupedCategories[cat]) {
          omTotals.servicosTerceiros.groupedCategories[cat] = { totalValor: 0, totalND33: 0, totalND39: 0 };
        }
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
        omTotals.materialPermanente.total += val;
        omTotals.materialPermanente.totalND52 += nd52;
        if (!omTotals.materialPermanente.groupedCategories[cat]) {
          omTotals.materialPermanente.groupedCategories[cat] = { totalValor: 0, totalND52: 0 };
        }
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
        if (!globalTotals.groupedMaterialConsumoCategories[cat]) {
          globalTotals.groupedMaterialConsumoCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        }
        globalTotals.groupedMaterialConsumoCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedMaterialConsumoCategories[cat].totalND30 += data.totalND30;
        globalTotals.groupedMaterialConsumoCategories[cat].totalND39 += data.totalND39;
      });
      
      globalTotals.totalComplementoAlimentacao += omTotals.complementoAlimentacao.total;
      globalTotals.totalComplementoAlimentacaoND30 += omTotals.complementoAlimentacao.totalND30;
      globalTotals.totalComplementoAlimentacaoND39 += omTotals.complementoAlimentacao.totalND39;
      Object.entries(omTotals.complementoAlimentacao.groupedCategories || {}).forEach(([cat, data]) => {
        if (!globalTotals.groupedComplementoCategories[cat]) {
          globalTotals.groupedComplementoCategories[cat] = { totalValor: 0, totalND30: 0, totalND39: 0 };
        }
        globalTotals.groupedComplementoCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedComplementoCategories[cat].totalND30 += data.totalND30;
        globalTotals.groupedComplementoCategories[cat].totalND39 += data.totalND39;
      });

      globalTotals.totalServicosTerceiros += omTotals.servicosTerceiros.total;
      globalTotals.totalServicosTerceirosND33 += omTotals.servicosTerceiros.totalND33;
      globalTotals.totalServicosTerceirosND39 += omTotals.servicosTerceiros.totalND39;
      Object.entries(omTotals.servicosTerceiros.groupedCategories || {}).forEach(([cat, data]) => {
        if (!globalTotals.groupedServicosTerceirosCategories[cat]) {
          globalTotals.groupedServicosTerceirosCategories[cat] = { totalValor: 0, totalND33: 0, totalND39: 0 };
        }
        globalTotals.groupedServicosTerceirosCategories[cat].totalValor += data.totalValor;
        globalTotals.groupedServicosTerceirosCategories[cat].totalND33 += data.totalND33;
        globalTotals.groupedServicosTerceirosCategories[cat].totalND39 += data.totalND39;
      });

      globalTotals.totalMaterialPermanenteND52 += omTotals.materialPermanente.totalND52;
      Object.entries(omTotals.materialPermanente.groupedCategories || {}).forEach(([cat, data]: [string, any]) => {
        if (!globalTotals.groupedMaterialPermanenteCategories[cat]) {
          globalTotals.groupedMaterialPermanenteCategories[cat] = { totalValor: 0, totalND52: 0 };
        }
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
  } catch (err) {
    console.error("Erro crítico no processamento de totais:", err);
    throw err;
  }
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
  const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const omGND3Total = om.totalLogistica + om.totalOperacional + om.totalAviacaoExercito;
  const impactPercentage = totalGND3 > 0 ? ((omGND3Total / totalGND3) * 100).toFixed(1) : '0.0';

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
          <div className="text-base font-normal text-muted-foreground">
            {om.ug ? `UG(s): ${om.ug.split(', ').map((u: string) => formatCodug(u)).join(', ')} | ` : ''}Total: {formatCurrency(om.totalGeral)}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-8 space-y-12">
          {om.totalLogistica > 0 && (
            <div>
              <h3 className="text-base font-bold text-orange-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-orange-500/20 pb-2">
                <div className="flex items-center gap-2"><Package className="h-5 w-5" />Aba Logística</div>
                <span className="text-xl font-extrabold">{formatCurrency(om.totalLogistica)}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <CategoryCard label="Classe I (Alimentação)" value={om.classeI.total} icon={Utensils} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeI.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left truncate pr-3">Complemento (Ref. Int.)</span><span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeI.totalRefeicoesIntermediarias)}</span><span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeI.totalComplemento)}</span></div><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left truncate pr-3">Etapa Solicitada</span><span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeI.totalDiasEtapaSolicitada)} dias</span><span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeI.totalEtapaSolicitadaValor)}</span></div>{om.classeI.totalRacoesOperacionaisGeral > 0 && <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1"><span className="w-1/2 text-left truncate pr-3">Ração Operacional (R2/R3)</span><span className="w-1/4 text-right font-medium whitespace-nowrap">{om.classeI.totalRacoesOperacionaisGeral} un.</span><span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(0)}</span></div>}</div>} />
                <CategoryCard label="Classe II (Intendência)" value={om.classeII.total} icon={ClipboardList} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeII.totalND30} nd39={om.classeII.totalND39} details={renderClassDetails(om.classeII)} />
                <CategoryCard label="Classe III (Combustíveis)" value={om.classeIII.total} icon={Fuel} colorClass="bg-orange-500/10 text-orange-600" nd30={om.classeIII.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left truncate pr-3">Óleo Diesel</span><span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeIII.totalDieselLitros)} L</span><span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeIII.totalDieselValor)}</span></div><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="w-1/2 text-left truncate pr-3">Gasolina</span><span className="w-1/4 text-right font-medium">{formatNumber(om.classeIII.totalGasolinaLitros)} L</span><span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeIII.totalGasolinaValor)}</span></div><div className="flex justify-between text-muted-foreground"><span className="w-1/2 text-left truncate pr-3">Lubrificante</span><span className="w-1/4 text-right font-medium">{formatNumber(om.classeIII.totalLubrificanteLitros || 0, 2)} L</span><span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeIII.totalLubrificanteValor)}</span></div></div>} />
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
              <h3 className="text-base font-bold text-blue-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-blue-500/20 pb-2">
                <div className="flex items-center gap-2"><Activity className="h-5 w-5" />Aba Operacional</div>
                <span className="text-xl font-extrabold">{formatCurrency(om.totalOperacional)}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <CategoryCard label="Complemento de Alimentação" value={om.complementoAlimentacao.total} icon={Utensils} colorClass="bg-blue-500/10 text-blue-600" nd30={om.complementoAlimentacao.totalND30} nd39={om.complementoAlimentacao.totalND39} details={<div className="space-y-2.5 text-[12px]">{Object.entries(om.complementoAlimentacao.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, data]: any) => (<div key={cat} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0"><span className="font-medium w-1/2 text-left truncate pr-3">{cat}</span><span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency(data.totalValor)}</span></div>))}</div>} />
                <CategoryCard label="Concessionária" value={om.concessionaria.total} icon={Droplet} colorClass="bg-blue-500/10 text-blue-600" nd39={om.concessionaria.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="truncate pr-3">Água/Esgoto</span><span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(om.concessionaria.totalAgua)}</span></div><div className="flex justify-between text-muted-foreground"><span className="truncate pr-3">Energia Elétrica</span><span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(om.concessionaria.totalEnergia)}</span></div></div>} />
                <CategoryCard label="Diárias" value={om.diarias.total} icon={Briefcase} colorClass="bg-blue-500/10 text-blue-600" nd15={om.diarias.totalND15} nd30={om.diarias.totalND30} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="truncate pr-3">Militares</span><span className="font-bold text-foreground whitespace-nowrap">{om.diarias.totalMilitares}</span></div><div className="flex justify-between text-muted-foreground"><span className="truncate pr-3">Dias de Viagem</span><span className="font-bold text-foreground whitespace-nowrap">{om.diarias.totalDiasViagem}</span></div></div>} />
                <CategoryCard label="Material de Consumo" value={om.materialConsumo.total} icon={Package} colorClass="bg-blue-500/10 text-blue-600" nd30={om.materialConsumo.totalND30} nd39={om.materialConsumo.totalND39} details={<div className="space-y-2.5 text-[12px]">{Object.entries(om.materialConsumo.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, data]: any) => (<div key={cat} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0"><span className="font-medium w-1/2 text-left truncate pr-3">{cat}</span><span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency(data.totalValor)}</span></div>))}</div>} />
                <CategoryCard label="Passagens" value={om.passagens.total} icon={Plane} colorClass="bg-blue-500/10 text-blue-600" nd33={om.passagens.total} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="truncate pr-3">Quantidade</span><span className="font-bold text-foreground whitespace-nowrap">{om.passagens.totalQuantidade} un.</span></div><div className="flex justify-between text-muted-foreground"><span className="truncate pr-3">Trechos</span><span className="font-bold text-foreground whitespace-nowrap">{om.passagens.totalTrechos}</span></div></div>} />
                <CategoryCard label="Serviços de Terceiros/Locações" value={om.servicosTerceiros.total} icon={ClipboardList} colorClass="bg-blue-500/10 text-blue-600" nd33={om.servicosTerceiros.totalND33} nd39={om.servicosTerceiros.totalND39} details={<div className="space-y-2.5 text-[12px]">{Object.entries(om.servicosTerceiros.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, data]: any) => (<div key={cat} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0"><span className="font-medium w-1/2 text-left truncate pr-3">{cat}</span><div className="flex w-1/2 justify-between gap-3"><span className="font-bold text-foreground text-right w-full whitespace-nowrap">{formatCurrency(data.totalValor)}</span></div></div>))}</div>} />
                <CategoryCard label="Suprimento de Fundos" value={om.suprimentoFundos.total} icon={Wallet} colorClass="bg-blue-500/10 text-blue-600" nd30={om.suprimentoFundos.totalND30} nd39={om.suprimentoFundos.totalND39} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="truncate pr-3">Equipes</span><span className="font-bold text-foreground whitespace-nowrap">{om.suprimentoFundos.totalEquipes}</span></div><div className="flex justify-between text-muted-foreground"><span className="truncate pr-3">Dias</span><span className="font-bold text-foreground whitespace-nowrap">{om.suprimentoFundos.totalDias}</span></div></div>} />
                <CategoryCard label="Verba Operacional" value={om.verbaOperacional.total} icon={Activity} colorClass="bg-blue-500/10 text-blue-600" nd30={om.verbaOperacional.totalND30} nd39={om.verbaOperacional.totalND39} details={<div className="space-y-2.5 text-[12px]"><div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2"><span className="truncate pr-3">Equipes</span><span className="font-bold text-foreground whitespace-nowrap">{om.verbaOperacional.totalEquipes}</span></div><div className="flex justify-between text-muted-foreground"><span className="truncate pr-3">Dias</span><span className="font-bold text-foreground whitespace-nowrap">{om.verbaOperacional.totalDias}</span></div></div>} />
              </div>
            </div>
          )}
          {om.totalMaterialPermanente > 0 && (
            <div>
              <h3 className="text-base font-bold text-green-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-green-500/20 pb-2">
                <div className="flex items-center gap-2"><HardHat className="h-5 w-5" />Aba Material Permanente</div>
                <span className="text-xl font-extrabold">{formatCurrency(om.totalMaterialPermanente)}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <CategoryCard label="Material Permanente" value={om.materialPermanente.total} icon={HardHat} colorClass="bg-green-500/10 text-green-600" nd52={om.materialPermanente.totalND52} details={<div className="space-y-2.5 text-[12px]">{Object.entries(om.materialPermanente.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, data]: any) => (<div key={cat} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0"><span className="font-medium w-1/2 text-left truncate pr-3">{cat}</span><span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency(data.totalValor)}</span></div>))}</div>} />
              </div>
            </div>
          )}
          {(om.totalAviacaoExercito > 0 || om.horasVoo.quantidadeHV > 0) && (
            <div>
              <h3 className="text-base font-bold text-purple-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-purple-500/20 pb-2">
                <div className="flex items-center gap-2"><Helicopter className="h-5 w-5" />Aba Aviação do Exército</div>
                <span className="text-xl font-extrabold">{formatNumber(om.horasVoo.quantidadeHV, 2)} HV</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <CategoryCard label="Horas de Voo" value={0} icon={Helicopter} colorClass="bg-purple-500/10 text-purple-600" nd30={om.horasVoo.totalND30} nd39={om.horasVoo.totalND39} extraInfo={`${formatNumber(om.horasVoo.quantidadeHV, 2)} HV`} details={<div className="space-y-2.5 text-[12px]">{Object.entries(om.horasVoo.groupedHV || {}).sort(([a], [b]) => a.localeCompare(b)).map(([tipo, data]: any) => (<div key={tipo} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0"><span className="font-medium w-1/2 text-left truncate pr-3">{tipo}</span><div className="flex w-1/2 justify-between gap-3"><span className="font-medium text-right w-1/2 whitespace-nowrap">{formatNumber(data.totalHV, 2)} HV</span><span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency(data.totalValor)}</span></div></div>))}</div>} />
              </div>
            </div>
          )}
        </div>
        <div className="p-8 pt-5 border-t border-border/30 bg-muted/20">
          <div className="flex justify-between items-end mb-3"><span className="text-[11px] font-bold text-muted-foreground uppercase">Impacto no Orçamento GND 3</span><span className="text-sm font-bold text-primary">{impactPercentage}%</span></div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden"><div className="bg-primary h-full transition-all duration-700 ease-out" style={{ width: `${impactPercentage}%` }} /></div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TabDetailsProps { mode: 'logistica' | 'operacional' | 'permanente' | 'avex'; data: PTrabAggregatedTotals; }

const TabDetails = ({ mode, data }: TabDetailsProps) => {
  const valueClasses = "font-medium text-foreground text-right w-[6rem] flex-shrink-0";

  const renderClassAccordion = (key: string, title: string, icon: any, unitLabel: string, isRemonta = false) => {
    const g = data as PTrabAggregatedTotals;
    const classData = {
      total: (g as any)[`totalClasse${key.toUpperCase()}`],
      totalND30: (g as any)[`totalClasse${key.toUpperCase()}_ND30`],
      totalND39: (g as any)[`totalClasse${key.toUpperCase()}_ND39`],
      totalItens: (g as any)[`totalItensClasse${key.toUpperCase()}`],
      groupedCategories: (g as any)[`groupedClasse${key.toUpperCase()}Categories`]
    };

    if (!classData.total || classData.total === 0) return null;

    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value={`item-${key}`} className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground">{icon}{title}</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(classData.total)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              {Object.entries(classData.groupedCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, d]: any) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                    <span className="w-1/2 text-left">{cat}</span>
                    <span className="w-1/4 text-right font-medium">{formatNumber(d.totalItens)} {isRemonta ? 'animais' : unitLabel}</span>
                    <span className="w-1/4 text-right font-medium">{formatCurrency(d.totalValor)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[9px] pl-2">
                    <span className="w-1/2 text-left">ND 30 / ND 39</span>
                    <span className="w-1/4 text-right text-green-600 font-medium">{formatCurrency(d.totalND30)}</span>
                    <span className="w-1/4 text-right text-blue-600 font-medium">{formatCurrency(d.totalND39)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderClasseI = () => {
    const c = data;
    if (c.totalClasseI === 0 && c.totalRacoesOperacionaisGeral === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-0">
        <AccordionItem value="item-classe-i" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground"><Utensils className="h-3 w-3 text-orange-500" />Classe I</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(c.totalClasseI)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Complemento (Ref. Int.)</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(c.totalRefeicoesIntermediarias)}</span>
                <span className="w-1/4 text-right font-medium">{formatCurrency(c.totalComplemento)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Etapa Solicitada</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(c.totalDiasEtapaSolicitada)} dias</span>
                <span className="w-1/4 text-right font-medium">{formatCurrency(c.totalEtapaSolicitadaValor)}</span>
              </div>
              {c.totalRacoesOperacionaisGeral > 0 && (
                <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                  <span className="w-1/2 text-left text-muted-foreground">Ração Operacional (R2/R3)</span>
                  <span className="w-1/4 text-right font-medium">{formatNumber(c.totalRacoesOperacionaisGeral)} un.</span>
                  <span className="w-1/4 text-right font-medium text-foreground">{formatCurrency(0)}</span>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderClasseIII = () => {
    const c = data;
    if (c.totalCombustivel === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value="item-classe-iii" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground"><Fuel className="h-3 w-3 text-orange-500" />Classe III</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(c.totalCombustivel)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Óleo Diesel</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(c.totalDieselLitros)} L</span>
                <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(c.totalDieselValor)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Gasolina</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(c.totalGasolinaLitros)} L</span>
                <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(c.totalGasolinaValor)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Lubrificante</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(c.totalLubrificanteLitros || 0, 2)} L</span>
                <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(c.totalLubrificanteValor)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderDiarias = () => {
    const d = data;
    if (d.totalDiarias === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-0">
        <AccordionItem value="item-diarias" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground"><Briefcase className="h-3 w-3 text-blue-500" />Diárias</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(d.totalDiarias)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Total de Militares</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(d.totalMilitaresDiarias)}</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Total de Dias de Viagem</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(d.totalDiasViagem)} dias</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
              </div>
              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                <span className="w-1/2 text-left font-semibold">Diárias (ND 15) / Taxa Embarque + ND 30</span>
                <span className="w-1/4 text-right font-medium text-green-600">{formatCurrency(d.totalDiariasND15)}</span>
                <span className="w-1/4 text-right font-medium text-blue-600">{formatCurrency(d.totalDiariasND30)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderVerbaSuprimento = (key: string, title: string) => {
    const g = key === 'verbaOperacional' ? data.totalVerbaOperacional : data.totalSuprimentoFundos;
    const nd30 = key === 'verbaOperacional' ? data.totalVerbaOperacionalND30 : data.totalSuprimentoFundosND30;
    const nd39 = key === 'verbaOperacional' ? data.totalVerbaOperacionalND39 : data.totalSuprimentoFundosND39;
    const equipes = key === 'verbaOperacional' ? data.totalEquipesVerba : data.totalEquipesSuprimento;
    const dias = key === 'verbaOperacional' ? data.totalDiasVerba : data.totalDiasSuprimento;

    if (g === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value={`item-${key}`} className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground">{key === 'verbaOperacional' ? <ClipboardList className="h-3 w-3 text-blue-500" /> : <Wallet className="h-3 w-3 text-blue-500" />}{title}</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(g)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Total de Equipes</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(equipes)}</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Total de Dias</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(dias)} dias</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
              </div>
              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                <span className="w-1/2 text-left font-semibold">ND 30 / ND 39</span>
                <span className="w-1/4 text-right font-medium text-green-600">{formatCurrency(nd30)}</span>
                <span className="w-1/4 text-right font-medium text-blue-600">{formatCurrency(nd39)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderPassagens = () => {
    const p = data;
    if (p.totalPassagensND33 === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value="item-passagens" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground"><Plane className="h-3 w-3 text-blue-500" />Passagens</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(p.totalPassagensND33)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Total de Passagens</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(p.totalQuantidadePassagens)} un.</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="w-1/2 text-left">Total de Trechos Registrados</span>
                <span className="w-1/4 text-right font-medium">{formatNumber(p.totalTrechosPassagens)}</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
              </div>
              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                <span className="w-1/2 text-left font-semibold">ND 33 (Passagens)</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
                <span className="w-1/4 text-right font-medium text-green-600">{formatCurrency(p.totalPassagensND33)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderConcessionaria = () => {
    const c = data;
    if (c.totalConcessionariaND39 === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value="item-concessionaria" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground"><Droplet className="h-3 w-3 text-blue-500" />Concessionária</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(c.totalConcessionariaND39)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              {c.totalConcessionariaAgua > 0 && <div className="flex justify-between text-muted-foreground"><span className="w-1/2 text-left">Água/Esgoto</span><span className="w-1/4 text-right font-medium text-background"></span><span className="w-1/4 text-right font-medium">{formatCurrency(c.totalConcessionariaAgua)}</span></div>}
              {c.totalConcessionariaEnergia > 0 && <div className="flex justify-between text-muted-foreground"><span className="w-1/2 text-left">Energia Elétrica</span><span className="w-1/4 text-right font-medium text-background"></span><span className="w-1/4 text-right font-medium">{formatCurrency(c.totalConcessionariaEnergia)}</span></div>}
              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                <span className="w-1/2 text-left font-semibold">ND 39 (Serviços de Terceiros)</span>
                <span className="w-1/4 text-right font-medium text-background"></span>
                <span className="w-1/4 text-right font-medium text-blue-600">{formatCurrency(c.totalConcessionariaND39)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderMaterialConsumo = () => {
    const m = data;
    if (m.totalMaterialConsumo === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1 tour-accordion-material-consumo">
        <AccordionItem value="item-material-consumo" className="border-b-0" id="tour-material-consumo-row">
          <AccordionTrigger className="p-0 hover:no-underline tour-material-consumo-trigger">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground"><Package className="h-3 w-3 text-blue-500" />Material de Consumo</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(m.totalMaterialConsumo)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px] tour-material-consumo-details">
              {Object.entries(m.groupedMaterialConsumoCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, d]: any) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                    <span className="w-1/2 text-left">{cat}</span>
                    <span className="w-1/2 text-right font-medium">{formatCurrency(d.totalValor)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[9px] pl-2">
                    <span className="w-1/2 text-left">ND 30 / ND 39</span>
                    <span className="w-1/4 text-right text-green-600 font-medium">{formatCurrency(d.totalND30)}</span>
                    <span className="w-1/4 text-right text-blue-600 font-medium">{formatCurrency(d.totalND39)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderComplementoAlimentacao = () => {
    const c = data;
    if (c.totalComplementoAlimentacao === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value="item-complemento-alimentacao" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground text-left flex-1"><Utensils className="h-3 w-3 text-blue-500" />Complemento de Alimentação</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(c.totalComplementoAlimentacao)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              {Object.entries(c.groupedComplementoCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, d]: any) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                    <span className="w-1/2 text-left">{cat}</span>
                    <span className="w-1/2 text-right font-medium">{formatCurrency(d.totalValor)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[9px] pl-2">
                    <span className="w-1/2 text-left">ND 30 / ND 39</span>
                    <span className="w-1/4 text-right text-green-600 font-medium">{formatCurrency(d.totalND30)}</span>
                    <span className="w-1/4 text-right text-blue-600 font-medium">{formatCurrency(d.totalND39)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderServicosTerceiros = () => {
    const s = data;
    if (s.totalServicosTerceiros === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value="item-servicos-terceiros" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground text-left flex-1"><ClipboardList className="h-3 w-3 text-blue-500" />Serviços de Terceiros/Locações</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(s.totalServicosTerceiros)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              {Object.entries(s.groupedServicosTerceirosCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, d]: any) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                    <span className="w-1/2 text-left">{cat}</span>
                    <span className="w-1/2 text-right font-medium">{formatCurrency(d.totalValor)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[9px] pl-2">
                    <span className="w-1/2 text-left">ND 33 / ND 39</span>
                    <span className="w-1/4 text-right text-cyan-600 font-medium">{formatCurrency(d.totalND33)}</span>
                    <span className="w-1/4 text-right text-blue-600 font-medium">{formatCurrency(d.totalND39)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderMaterialPermanente = () => {
    const p = data;
    if (p.totalMaterialPermanente === 0) return null;
    return (
      <Accordion type="single" collapsible className="w-full pt-1">
        <AccordionItem value="item-material-permanente" className="border-b-0">
          <AccordionTrigger className="p-0 hover:no-underline">
            <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
              <div className="flex items-center gap-1 text-foreground text-left flex-1"><HardHat className="h-3 w-3 text-green-600" />Material Permanente</div>
              <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>{formatCurrency(p.totalMaterialPermanente)}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            <div className="space-y-1 pl-4 text-[10px]">
              {Object.entries(p.groupedMaterialPermanenteCategories || {}).sort(([a], [b]) => a.localeCompare(b)).map(([cat, d]: any) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                    <span className="w-1/2 text-left">{cat}</span>
                    <span className="w-1/2 text-right font-medium">{formatCurrency(d.totalValor)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[9px] pl-2">
                    <span className="w-1/2 text-left">ND 52</span>
                    <span className="w-1/2 text-right text-green-700 font-medium">{formatCurrency(d.totalND52)}</span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  if (mode === 'logistica') {
    const total = data.totalLogisticoGeral;
    return (
      <div className="space-y-3 border-l-4 border-orange-500 pl-3">
        <div className="flex items-center justify-between text-xs font-semibold text-orange-600 mb-2">
          <div className="flex items-center gap-2"><Package className="h-3 w-3" />Logística</div>
          <span className="font-bold text-sm">{formatCurrency(total)}</span>
        </div>
        {renderClasseI()}
        {renderClassAccordion('II', 'Classe II', <ClipboardList className="h-3 w-3 text-orange-500" />, 'un.')}
        {renderClasseIII()}
        {renderClassAccordion('V', 'Classe V', <Swords className="h-3 w-3 text-orange-500" />, 'un.')}
        {renderClassAccordion('VI', 'Classe VI', <HardHat className="h-3 w-3 text-orange-500" />, 'un.')}
        {renderClassAccordion('VII', 'Classe VII', <Radio className="h-3 w-3 text-orange-500" />, 'un.')}
        {renderClassAccordion('VIII', 'Classe VIII', <HeartPulse className="h-3 w-3 text-orange-500" />, 'un.', true)}
        {renderClassAccordion('IX', 'Classe IX', <Truck className="h-3 w-3 text-orange-500" />, 'vtr')}
      </div>
    );
  }

  if (mode === 'operacional') {
    const total = data.totalOperacional;
    return (
      <div className="space-y-3 border-l-4 border-blue-500 pl-3">
        <div className="flex items-center justify-between text-xs font-semibold text-blue-600 mb-2">
          <div className="flex items-center gap-2"><Activity className="h-3 w-3" />Operacional</div>
          <span className="font-bold text-sm">{formatCurrency(total)}</span>
        </div>
        {renderComplementoAlimentacao()}
        {renderDiarias()}
        {renderPassagens()}
        {renderServicosTerceiros()}
        {renderVerbaSuprimento('verbaOperacional', 'Verba Operacional')}
        {renderVerbaSuprimento('suprimentoFundos', 'Suprimento de Fundos')}
        {renderConcessionaria()}
        {renderMaterialConsumo()}
      </div>
    );
  }

  if (mode === 'permanente') {
    const total = data.totalMaterialPermanente;
    if (total === 0) return null;
    return (
      <div className="space-y-3 border-l-4 border-green-500 pl-3 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-green-600 mb-2">
          <div className="flex items-center gap-2"><HardHat className="h-3 w-3" />Material Permanente</div>
          <span className="font-bold text-sm">{formatCurrency(total)}</span>
        </div>
        {renderMaterialPermanente()}
      </div>
    );
  }

  if (mode === 'avex') {
    const h = data;
    if (h.totalHorasVoo === 0 && h.quantidadeHorasVoo === 0) return null;
    return (
      <div className="space-y-3 border-l-4 border-purple-500 pl-3 pt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-purple-600 mb-2">
          <div className="flex items-center gap-2"><Helicopter className="h-3 w-3" />Aviação do Exército</div>
          <span className="font-bold text-sm">{formatNumber(h.quantidadeHorasVoo, 2)} HV</span>
        </div>
        <div className="space-y-1 pl-4 text-[10px]">
          {Object.entries(h.groupedHorasVoo || {}).sort(([a], [b]) => a.localeCompare(b)).map(([tipo, d]: any) => (
            <div key={tipo} className="flex justify-between text-muted-foreground">
              <span className="w-1/2 text-left">{tipo}</span>
              <span className="w-1/4 text-right font-medium text-background"></span>
              <span className="w-1/4 text-right font-medium">{formatNumber(d.totalHV, 2)} HV</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

interface PTrabCostSummaryProps { ptrabId: string; onOpenCreditDialog: () => void; creditGND3: number; creditGND4: number; }

export const PTrabCostSummary = ({ ptrabId, onOpenCreditDialog, creditGND3, creditGND4 }: PTrabCostSummaryProps) => {
  const { data, isLoading, error } = useQuery<PTrabAggregatedTotals>({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000,
  });

  const [viewMode, setViewMode] = useState<'global' | 'byOm'>('global');
  const [omGroupingMode, setOmGroupingMode] = useState<'solicitante' | 'destino'>('solicitante');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOm, setSelectedOm] = useState<OmTotals | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Lógica de avanço automático do tour ao abrir detalhes
  useEffect(() => {
    if (isDetailsOpen && isGhostMode()) {
      // 1. Auto-expande a subseção de Material de Consumo para o tour
      setTimeout(() => {
        const trigger = document.querySelector('.tour-material-consumo-trigger') as HTMLElement;
        if (trigger) {
          const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
          if (!isExpanded) trigger.click();
        }
        
        // 2. Dispara o evento de avanço do tour após a animação
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tour:avancar'));
        }, 400);
      }, 150);
    }
  }, [isDetailsOpen]);

  // Lógica de avanço automático do tour ao mudar para visão por OM
  useEffect(() => {
    if (viewMode === 'byOm' && isGhostMode()) {
      // Pequeno delay para o React renderizar a lista de OMs antes de iluminar
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }, 300);
    }
  }, [viewMode]);

  // Lógica de avanço automático do tour ao abrir detalhes da OM
  useEffect(() => {
    if (selectedOm && isGhostMode()) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }, 400);
    }
  }, [selectedOm]);

  // Expondo funções para o tour
  useEffect(() => {
    (window as any).expandCostDetails = () => {
      setIsDetailsOpen(true);
      setViewMode('global');
    };
    (window as any).switchToByOmView = () => {
      setViewMode('byOm');
      setIsDetailsOpen(false);
    };
    return () => {
      delete (window as any).expandCostDetails;
      delete (window as any).switchToByOmView;
    };
  }, []);

  const sortedOmTotals = useMemo(() => {
    const omGroups = omGroupingMode === 'solicitante' ? data?.groupedByOmSolicitante : data?.groupedByOmDestino;
    if (!omGroups) return [];
    return Object.values(omGroups).sort((a, b) => b.totalGeral - a.totalGeral);
  }, [data, omGroupingMode]);

  const handleSummaryClick = () => {
    const newState = !isDetailsOpen;
    setIsDetailsOpen(newState);
    if (newState) {
      setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  if (isLoading) return (
    <Card className="shadow-lg">
      <CardHeader className="py-3"><CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle></CardHeader>
      <CardContent className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Calculando...</span>
      </CardContent>
    </Card>
  );

  if (error || !data) return (
    <Card className="shadow-lg border-destructive">
      <CardHeader className="py-3"><CardTitle className="text-xl font-bold text-destructive">Erro no Cálculo</CardTitle></CardHeader>
      <CardContent className="py-4"><p className="text-sm text-muted-foreground">Ocorreu um erro ao buscar os dados de custeio.</p></CardContent>
    </Card>
  );

  const totals = data;
  const totalGND3Cost = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const totalGeralFinal = totalGND3Cost + totals.totalMaterialPermanente;
  const saldoGND3 = creditGND3 - totalGND3Cost;
  const saldoGND4 = creditGND4 - totals.totalMaterialPermanente;

  const renderCostSummary = () => {
    if (viewMode === 'global') {
      return (
        <div className="w-full space-y-1 text-sm px-6 pt-3">
          <div className="flex justify-between text-orange-600 cursor-pointer" onClick={handleSummaryClick}>
            <span className="font-semibold text-sm">Aba Logística</span>
            <span className="font-bold text-sm">{formatCurrency(totals.totalLogisticoGeral)}</span>
          </div>
          <div className="flex justify-between text-blue-600 cursor-pointer" onClick={handleSummaryClick}>
            <span className="font-semibold text-sm">Aba Operacional</span>
            <span className="font-bold text-sm">{formatCurrency(totals.totalOperacional)}</span>
          </div>
          <div className="flex justify-between text-green-600 cursor-pointer" onClick={handleSummaryClick}>
            <span className="font-semibold text-sm">Aba Material Permanente</span>
            <span className="font-bold text-sm">{formatCurrency(totals.totalMaterialPermanente)}</span>
          </div>
          <div className="flex justify-between text-purple-600 cursor-pointer" onClick={handleSummaryClick}>
            <span className="font-semibold text-sm">Aba Aviação do Exército</span>
            <div className="flex flex-col items-end">
              <span className="font-bold text-sm">{formatNumber(totals.quantidadeHorasVoo, 2)} HV</span>
            </div>
          </div>
        </div>
      );
    } else {
      if (sortedOmTotals.length === 0) return <div className="w-full space-y-1 text-sm px-6 pt-3 text-muted-foreground">Nenhuma OM com custos registrados.</div>;
      const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
      return (
        <div className="w-full space-y-1 text-sm px-6 pt-3 tour-costs-by-om-list">
          {sortedOmTotals.map(om => {
            const omGND3Total = om.totalLogistica + om.totalOperacional + om.totalAviacaoExercito;
            const impactPercentage = totalGND3 > 0 ? ((omGND3Total / totalGND3) * 100).toFixed(1) : '0.0';
            return (
              <div key={om.omKey} className={cn("flex justify-between items-center text-foreground cursor-pointer p-1 rounded-md transition-colors hover:bg-muted/50", om.omName === "1º BIS" && "tour-mock-om-item")} onClick={() => setSelectedOm(om)}>
                <span className="font-semibold text-sm text-foreground">{om.omName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground/80">({impactPercentage}%)</span>
                  <span className="font-bold text-sm text-primary">{formatCurrency(om.totalGeral)}</span>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 mt-4 pt-3 border-t border-border/50 tour-om-grouping-controls">
            <Button variant={omGroupingMode === 'solicitante' ? 'default' : 'outline'} size="sm" className="flex-1 h-8 text-[10px] gap-1.5" onClick={() => setOmGroupingMode('solicitante')}>
              <Building2 className="h-3 w-3" /> Por OM Solicitante
            </Button>
            <Button variant={omGroupingMode === 'destino' ? 'default' : 'outline'} size="sm" className="flex-1 h-8 text-[10px] gap-1.5" onClick={() => setOmGroupingMode('destino')}>
              <MapPin className="h-3 w-3" /> Por OM Destino
            </Button>
          </div>
        </div>
      );
    }
  };

  return (
    <Card className="shadow-lg tour-cost-summary-card">
      <CardHeader className="pb-2 pt-3">
        <div className="flex justify-between items-center"><CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle></div>
        <CardDescription className="text-xs">Visão consolidada dos custos logísticos e orçamentários.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-3">
        {renderCostSummary()}
        <div className="w-full px-6 pt-0">
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground border-t border-border/50 py-2">
            <div className="flex flex-col items-start gap-1">
              <span className="text-base font-bold text-foreground">Total Geral</span>
              <Button 
                variant={viewMode === 'byOm' ? 'default' : 'outline'} 
                size="sm" 
                className="h-6 text-[10px] px-2 tour-btn-view-by-om" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setViewMode(viewMode === 'byOm' ? 'global' : 'byOm'); 
                  setIsDetailsOpen(false); 
                  setSelectedOm(null); 
                }}
              >
                {viewMode === 'byOm' ? 'Voltar ao Global' : 'Ver por OM'}
              </Button>
            </div>
            <div className="flex flex-col items-end gap-0">
              <span className="text-lg font-bold text-foreground">{formatCurrency(totalGeralFinal)}</span>
              {viewMode === 'global' && (
                <button 
                  className="font-semibold text-primary flex items-center gap-1 text-xs lowercase hover:underline"
                  onClick={handleSummaryClick}
                >
                  {isDetailsOpen ? "menos detalhes" : "mais detalhes"}
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isDetailsOpen ? "rotate-180" : "rotate-0")} />
                </button>
              )}
            </div>
          </div>
          
          {isDetailsOpen && viewMode === 'global' && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200" ref={detailsRef}>
              <TabDetails mode="logistica" data={totals} />
              <div className="pt-4"><TabDetails mode="operacional" data={totals} /></div>
              <div className="pt-4"><TabDetails mode="permanente" data={totals} /></div>
              <div className="pt-4"><TabDetails mode="avex" data={totals} /></div>
            </div>
          )}
        </div>
        
        <div className="px-6 pt-0 border-t border-border/50 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Saldo GND 3</h4>
            <span className={cn("font-bold text-lg", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>{formatCurrency(saldoGND3)}</span>
          </div>
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Saldo GND 4</h4>
            <span className={cn("font-bold text-lg", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>{formatCurrency(saldoGND4)}</span>
          </div>
          <Button onClick={onOpenCreditDialog} variant="outline" className="w-full mt-2 border-primary text-primary hover:bg-primary/10 h-8 text-sm">Informar Crédito</Button>
        </div>
      </CardContent>
      <OmDetailsDialog om={selectedOm} totals={totals} onClose={() => setSelectedOm(null)} />
    </Card>
  );
};