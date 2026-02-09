import React, { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber, formatCodug } from "@/lib/formatUtils";
import { Package, Fuel, Utensils, Loader2, ChevronDown, HardHat, Plane, TrendingUp, Wallet, ClipboardList, Swords, Radio, Activity, HeartPulse, Truck, Briefcase, Droplet, Zap, Users } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tables } from "@/integrations/supabase/types";
import { Switch } from "@/components/ui/switch"; // Importando Switch

// Define the category constants
const CATEGORIAS_CLASSE_II = ["Equipamento Individual", "Proteção Balística", "Material de Estacionamento"];
const CATEGORIAS_CLASSE_V = ["Armt L", "Armt P", "IODCT", "DQBRN"];
const CATEGORIAS_CLASSE_VI = ["Embarcação", "Equipamento de Engenharia", "Gerador"];
const CATEGORIAS_CLASSE_VII = ["Comunicações", "Informática"];
const CATEGORIAS_CLASSE_VIII = ["Saúde", "Remonta/Veterinária"];
const CATEGORIAS_CLASSE_IX = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];

interface ItemClasse {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
}

// Tipos para a nova estrutura agrupada por OM
interface OmTotals {
    omKey: string; // organizacao|ug
    omName: string;
    ug: string;
    totalGeral: number;
    totalLogistica: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
    
    // Detalhes por Classe/Item (Subtotais)
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
    horasVoo: { total: number, quantidadeHV: number, groupedHV: Record<string, { totalValor: number, totalHV: number }> };
    materialConsumo: { total: number, totalND30: number, totalND39: number };
}

// Tipo de retorno da função de busca
interface PTrabAggregatedTotals {
    // Totais Globais (para o modo 'global')
    totalLogisticoGeral: number;
    totalOperacional: number;
    totalMaterialPermanente: number;
    totalAviacaoExercito: number;
    totalRacoesOperacionaisGeral: number;
    
    // Detalhes Globais (para o modo 'global')
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
    quantidadeHorasVoo: number;
    groupedHorasVoo: Record<string, { totalValor: number, totalHV: number }>;
    
    totalMaterialConsumo: number; // NOVO
    totalMaterialConsumoND30: number; // NOVO
    totalMaterialConsumoND39: number; // NOVO

    // Nova Estrutura Agrupada por OM
    groupedByOm: Record<string, OmTotals>;
}


// Helper function to calculate days of requested stage (diasEtapaSolicitada)
const calculateDiasEtapaSolicitada = (diasOperacao: number): number => {
  const diasRestantesNoCiclo = diasOperacao % 30;
  const ciclosCompletos = Math.floor(diasOperacao / 30);
  
  if (diasRestantesNoCiclo <= 22 && diasOperacao >= 30) {
    return ciclosCompletos * 8;
  } else if (diasRestantesNoCiclo > 22) {
    return (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  } else {
    return 0;
  }
};

const initializeOmTotals = (omName: string, ug: string): OmTotals => ({
    omKey: `${omName}|${ug}`,
    omName,
    ug,
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
    horasVoo: { total: 0, quantidadeHV: 0, groupedHV: {} },
    materialConsumo: { total: 0, totalND30: 0, totalND39: 0 },
});

const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabAggregatedTotals> => {
  
  // Inicializa o objeto de agregação por OM
  const groupedByOm: Record<string, OmTotals> = {};
  
  const getOmTotals = (omName: string, ug: string): OmTotals => {
      const key = `${omName}|${ug}`;
      if (!groupedByOm[key]) {
          groupedByOm[key] = initializeOmTotals(omName, ug);
      }
      return groupedByOm[key];
  };
  
  // 1. Fetch Classe I totals (33.90.30)
  const { data: classeIData, error: classeIError } = await supabase
    .from('classe_i_registros')
    .select('total_qs, total_qr, complemento_qs, etapa_qs, complemento_qr, etapa_qr, efetivo, dias_operacao, nr_ref_int, quantidade_r2, quantidade_r3, categoria, organizacao, ug')
    .eq('p_trab_id', ptrabId);

  if (classeIError) {
    console.error("Erro ao carregar Classe I:", classeIError);
  }

  (classeIData || []).forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    
    if (record.categoria === 'RACAO_QUENTE') {
        const totalQs = Number(record.total_qs || 0);
        const totalQr = Number(record.total_qr || 0);
        const complementoQs = Number(record.complemento_qs || 0);
        const etapaQs = Number(record.etapa_qs || 0);
        const complementoQr = Number(record.complemento_qr || 0);
        const etapaQr = Number(record.etapa_qr || 0);
        const efetivo = Number(record.efetivo || 0);
        const nrRefInt = Number(record.nr_ref_int || 0);
        const diasOperacao = Number(record.dias_operacao || 0);

        const totalClasseI = totalQs + totalQr;
        const totalComplemento = complementoQs + complementoQr;
        const totalEtapaSolicitadaValor = etapaQs + etapaQr;
        const diasEtapaSolicitada = calculateDiasEtapaSolicitada(diasOperacao);
        const totalRefeicoesIntermediarias = efetivo * nrRefInt * diasOperacao;
        
        omTotals.classeI.total += totalClasseI;
        omTotals.classeI.totalComplemento += totalComplemento;
        omTotals.classeI.totalEtapaSolicitadaValor += totalEtapaSolicitadaValor;
        omTotals.classeI.totalDiasEtapaSolicitada += diasEtapaSolicitada;
        omTotals.classeI.totalRefeicoesIntermediarias += totalRefeicoesIntermediarias;
        omTotals.totalLogistica += totalClasseI;

    } else if (record.categoria === 'RACAO_OPERACIONAL') {
        const totalRacoesOperacionais = Number(record.quantidade_r2 || 0) + Number(record.quantidade_r3 || 0);
        omTotals.classeI.totalRacoesOperacionaisGeral += totalRacoesOperacionais;
    }
  });
  
  // 2. Fetch Classes II, V, VI, VII, VIII, IX records from their respective tables
  const [
    { data: classeIIData, error: classeIIError },
    { data: classeVData, error: classeVError },
    { data: classeVIData, error: classeVIError },
    { data: classeVIIData, error: classeVIIError },
    { data: classeVIIISaudeData, error: classeVIIISaudeError },
    { data: classeVIIIRemontaData, error: classeVIIIRemontaError },
    { data: classeIXData, error: classeIXError },
    { data: classeIIIData, error: classeIIIError },
    { data: diariaData, error: diariaError },
    { data: verbaOperacionalData, error: verbaOperacionalError },
    { data: passagemData, error: passagemError },
    { data: concessionariaData, error: concessionariaError },
    { data: horasVooData, error: horasVooError },
    { data: materialConsumoData, error: materialConsumoError }, // NOVO
  ] = await Promise.all([
    supabase
      .from('classe_ii_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39'),
    supabase
      .from('classe_v_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39'),
    supabase
      .from('classe_vi_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39'),
    supabase
      .from('classe_vii_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39'),
    supabase
      .from('classe_viii_saude_registros')
      .select('valor_total, itens_saude, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39'),
    supabase
      .from('classe_viii_remonta_registros')
      .select('valor_total, itens_remonta, dias_operacao, organizacao, ug, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais'),
    supabase
      .from('classe_ix_registros')
      .select('valor_total, itens_motomecanizacao, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39'),
    supabase
      .from('classe_iii_registros')
      .select('valor_total, tipo_combustivel, total_litros, tipo_equipamento, organizacao, ug, consumo_lubrificante_litro, preco_lubrificante'),
    supabase
      .from('diaria_registros')
      .select('valor_total, valor_nd_15, valor_taxa_embarque, quantidade, dias_operacao, valor_nd_30, organizacao, ug'), 
    supabase
      .from('verba_operacional_registros')
      .select('valor_nd_30, valor_nd_39, valor_total_solicitado, dias_operacao, quantidade_equipes, detalhamento, organizacao, ug'),
    supabase
      .from('passagem_registros')
      .select('valor_total, valor_nd_33, quantidade_passagens, is_ida_volta, origem, destino, organizacao, ug'),
    supabase
      .from('concessionaria_registros')
      .select('valor_total, valor_nd_39, dias_operacao, efetivo, categoria, organizacao, ug'),
    supabase
      .from('horas_voo_registros')
      .select('valor_total, quantidade_hv, tipo_anv, organizacao, ug'),
    supabase
      .from('material_consumo_registros') // NOVO
      .select('valor_total, valor_nd_30, valor_nd_39, organizacao, ug'),
  ]);

  // Logar erros, mas não lançar exceção
  if (classeIIError) console.error("Erro ao carregar Classe II:", classeIIError);
  if (classeVError) console.error("Erro ao carregar Classe V:", classeVError);
  if (classeVIError) console.error("Erro ao carregar Classe VI:", classeVIError);
  if (classeVIIError) console.error("Erro ao carregar Classe VII:", classeVIIError);
  if (classeVIIISaudeError) console.error("Erro ao carregar Classe VIII Saúde:", classeVIIISaudeError);
  if (classeVIIIRemontaError) console.error("Erro ao carregar Classe VIII Remonta:", classeVIIIRemontaError);
  if (classeIXError) console.error("Erro ao carregar Classe IX:", classeIXError);
  if (classeIIIError) console.error("Erro ao carregar Classe III:", classeIIIError);
  if (diariaError) console.error("Erro ao carregar Diárias:", diariaError);
  if (verbaOperacionalError) console.error("Erro ao carregar Verba Operacional/Suprimento:", verbaOperacionalError);
  if (passagemError) console.error("Erro ao carregar Passagens:", passagemError); 
  if (concessionariaError) console.error("Erro ao carregar Concessionária:", concessionariaError);
  if (horasVooError) console.error("Erro ao carregar Horas de Voo:", horasVooError);
  if (materialConsumoError) console.error("Erro ao carregar Material de Consumo:", materialConsumoError);

  // Usar arrays vazios se o fetch falhou
  const safeClasseIIData = classeIIData || [];
  const safeClasseVData = classeVData || [];
  const safeClasseVIData = classeVIData || [];
  const safeClasseVIIData = classeVIIData || [];
  const safeClasseVIIISaudeData = classeVIIISaudeData || [];
  const safeClasseVIIIRemontaData = classeVIIIRemontaData || [];
  const safeClasseIXData = classeIXData || [];
  const safeClasseIIIData = classeIIIData || [];
  const safeDiariaData = diariaData || [];
  const safeVerbaOperacionalData = verbaOperacionalData || [];
  const safePassagemData = passagemData || []; 
  const safeConcessionariaData = concessionariaData || [];
  const safeHorasVooData = horasVooData || [];
  const safeMaterialConsumoData = materialConsumoData || []; // NOVO
  
  // Processamento de Classes Diversas (II, V, VI, VII, VIII, IX)
  const allClasseItemsData = [
    ...safeClasseIIData.map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, classe: 'II' })),
    ...safeClasseVData.map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, classe: 'V' })),
    ...safeClasseVIData.map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, classe: 'VI' })),
    ...safeClasseVIIData.map(r => ({ ...r, itens_equipamentos: r.itens_equipamentos, classe: 'VII' })),
    ...safeClasseVIIISaudeData.map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde', classe: 'VIII' })),
    ...safeClasseVIIIRemontaData.map(r => ({ 
        ...r, 
        itens_equipamentos: r.itens_remonta, 
        categoria: 'Remonta/Veterinária',
        animal_tipo: r.animal_tipo,
        quantidade_animais: r.quantidade_animais,
        classe: 'VIII'
    })),
    ...safeClasseIXData.map(r => ({ 
        ...r, 
        itens_equipamentos: r.itens_motomecanizacao, 
        categoria: r.categoria,
        classe: 'IX'
    })),
  ];
  
  allClasseItemsData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const category = record.categoria;
    const items = (record.itens_equipamentos || []) as unknown as ItemClasse[]; 
    const totalItemsCategory = items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0); 
    
    const valorTotal = Number(record.valor_total || 0);
    const valorND30 = Number(record.valor_nd_30 || 0);
    const valorND39 = Number(record.valor_nd_39 || 0);
    
    omTotals.totalLogistica += valorTotal;

    const updateCategoryTotals = (group: OmTotals[keyof OmTotals] & { groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> }) => {
        group.total += valorTotal;
        group.totalND30 += valorND30;
        group.totalND39 += valorND39;
        group.totalItens += totalItemsCategory;

        let groupKey = category;
        let currentTotalItems = totalItemsCategory;
        
        if (record.classe === 'VIII' && category === 'Remonta/Veterinária') {
            const animalType = (record as any).animal_tipo;
            const quantidadeAnimais = Number((record as any).quantidade_animais || 0);
            if (animalType) {
                groupKey = `Remonta - ${animalType}`;
                currentTotalItems = quantidadeAnimais;
            }
        }
        
        if (!group.groupedCategories[groupKey]) {
            group.groupedCategories[groupKey] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        group.groupedCategories[groupKey].totalValor += valorTotal;
        group.groupedCategories[groupKey].totalND30 += valorND30;
        group.groupedCategories[groupKey].totalND39 += valorND39;
        group.groupedCategories[groupKey].totalItens += currentTotalItems;
    };

    if (record.classe === 'II') updateCategoryTotals(omTotals.classeII);
    else if (record.classe === 'V') updateCategoryTotals(omTotals.classeV);
    else if (record.classe === 'VI') updateCategoryTotals(omTotals.classeVI);
    else if (record.classe === 'VII') updateCategoryTotals(omTotals.classeVII);
    else if (record.classe === 'VIII') updateCategoryTotals(omTotals.classeVIII);
    else if (record.classe === 'IX') updateCategoryTotals(omTotals.classeIX);
  });
  
  // 3. Processamento de Classe III (Combustível e Lubrificante)
  safeClasseIIIData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const valorTotal = Number(record.valor_total || 0);
    const totalLitros = Number(record.total_litros || 0);
    
    omTotals.totalLogistica += valorTotal;
    omTotals.classeIII.total += valorTotal;

    if (record.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') {
        omTotals.classeIII.totalLubrificanteValor += valorTotal;
        omTotals.classeIII.totalLubrificanteLitros += totalLitros;
    } else {
        if (record.tipo_combustivel === 'DIESEL' || record.tipo_combustivel === 'OD') {
            omTotals.classeIII.totalDieselValor += valorTotal;
            omTotals.classeIII.totalDieselLitros += totalLitros;
        } else if (record.tipo_combustivel === 'GASOLINA' || record.tipo_combustivel === 'GAS') {
            omTotals.classeIII.totalGasolinaValor += valorTotal;
            omTotals.classeIII.totalGasolinaLitros += totalLitros;
        }
    }
  });
  
  // 4. Processamento de Diárias (ND 33.90.15)
  safeDiariaData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const totalGeral = Number(record.valor_nd_15 || 0);
    const taxaEmbarque = Number(record.valor_taxa_embarque || 0);
    const valorND30 = Number(record.valor_nd_30 || 0);
    const quantidade = Number(record.quantidade || 0);
    const diasOperacao = Number(record.dias_operacao || 0);
    
    omTotals.diarias.total += totalGeral + valorND30; // Total Diária (ND 15 + ND 30)
    omTotals.diarias.totalND15 += totalGeral - taxaEmbarque;
    omTotals.diarias.totalND30 += taxaEmbarque + valorND30; // Taxa de Embarque + ND 30
    omTotals.diarias.totalMilitares += quantidade;
    omTotals.diarias.totalDiasViagem += diasOperacao;
    omTotals.totalOperacional += totalGeral + valorND30;
  });
  
  // 5. Processamento de Verba Operacional e Suprimento de Fundos
  safeVerbaOperacionalData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const valorND30 = Number(record.valor_nd_30 || 0);
    const valorND39 = Number(record.valor_nd_39 || 0);
    const total = valorND30 + valorND39;
    const quantidadeEquipes = Number(record.quantidade_equipes || 0);
    const diasOperacao = Number(record.dias_operacao || 0);
    
    omTotals.totalOperacional += total;

    if (record.detalhamento === 'Suprimento de Fundos') {
        omTotals.suprimentoFundos.total += total;
        omTotals.suprimentoFundos.totalND30 += valorND30;
        omTotals.suprimentoFundos.totalND39 += valorND39;
        omTotals.suprimentoFundos.totalEquipes += quantidadeEquipes;
        omTotals.suprimentoFundos.totalDias += diasOperacao;
    } else {
        omTotals.verbaOperacional.total += total;
        omTotals.verbaOperacional.totalND30 += valorND30;
        omTotals.verbaOperacional.totalND39 += valorND39;
        omTotals.verbaOperacional.totalEquipes += quantidadeEquipes;
        omTotals.verbaOperacional.totalDias += diasOperacao;
    }
  });
  
  // 6. Processamento de Passagens (ND 33.90.33)
  safePassagemData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const valorND33 = Number(record.valor_nd_33 || 0);
    const quantidade = Number(record.quantidade_passagens || 0);
    
    omTotals.passagens.total += valorND33;
    omTotals.passagens.totalQuantidade += quantidade;
    omTotals.passagens.totalTrechos += 1; 
    omTotals.totalOperacional += valorND33;
  });
  
  // 7. Processamento de Concessionária (ND 33.90.39)
  safeConcessionariaData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const valorND39 = Number(record.valor_nd_39 || 0);
    
    omTotals.concessionaria.total += valorND39;
    omTotals.concessionaria.totalRegistros += 1;
    omTotals.totalOperacional += valorND39;
    
    if (record.categoria === 'Água/Esgoto') {
        omTotals.concessionaria.totalAgua += valorND39;
    } else if (record.categoria === 'Energia Elétrica') {
        omTotals.concessionaria.totalEnergia += valorND39;
    }
  });
  
  // 8. Processamento de Horas de Voo (AvEx)
  safeHorasVooData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const valorTotal = Number(record.valor_total || 0);
    const quantidadeHv = Number(record.quantidade_hv || 0);
    const tipoAnv = record.tipo_anv || 'Não Especificado';
    
    omTotals.horasVoo.total += valorTotal;
    omTotals.horasVoo.quantidadeHV += quantidadeHv;
    omTotals.totalOperacional += valorTotal;
    omTotals.totalAviacaoExercito += valorTotal;
    
    if (!omTotals.horasVoo.groupedHV[tipoAnv]) {
        omTotals.horasVoo.groupedHV[tipoAnv] = { totalValor: 0, totalHV: 0 };
    }
    omTotals.horasVoo.groupedHV[tipoAnv].totalValor += valorTotal;
    omTotals.horasVoo.groupedHV[tipoAnv].totalHV += quantidadeHv;
  });
  
  // 9. Processamento de Material de Consumo (ND 33.90.30/39) - NOVO
  safeMaterialConsumoData.forEach(record => {
    const omTotals = getOmTotals(record.organizacao, record.ug);
    const valorTotal = Number(record.valor_total || 0);
    const valorND30 = Number(record.valor_nd_30 || 0);
    const valorND39 = Number(record.valor_nd_39 || 0);
    
    omTotals.materialConsumo.total += valorTotal;
    omTotals.materialConsumo.totalND30 += valorND30;
    omTotals.materialConsumo.totalND39 += valorND39;
    omTotals.totalOperacional += valorTotal;
  });
  
  // 10. Consolidação Final e Totais Globais
  let globalTotals: PTrabAggregatedTotals = {
      totalLogisticoGeral: 0,
      totalOperacional: 0,
      totalMaterialPermanente: 0,
      totalAviacaoExercito: 0,
      totalRacoesOperacionaisGeral: 0,
      
      totalClasseI: 0,
      totalComplemento: 0,
      totalEtapaSolicitadaValor: 0,
      totalDiasEtapaSolicitada: 0,
      totalRefeicoesIntermediarias: 0,
      
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
      totalHorasVoo: 0, quantidadeHorasVoo: 0, groupedHorasVoo: {},
      totalMaterialConsumo: 0, totalMaterialConsumoND30: 0, totalMaterialConsumoND39: 0,
      
      groupedByOm,
  };
  
  // Itera sobre os totais por OM para calcular os totais globais
  Object.values(groupedByOm).forEach(omTotals => {
      // Atualiza o total geral da OM
      omTotals.totalLogistica = omTotals.classeI.total + omTotals.classeII.total + omTotals.classeIII.total + omTotals.classeV.total + omTotals.classeVI.total + omTotals.classeVII.total + omTotals.classeVIII.total + omTotals.classeIX.total;
      omTotals.totalOperacional = omTotals.diarias.total + omTotals.verbaOperacional.total + omTotals.suprimentoFundos.total + omTotals.passagens.total + omTotals.concessionaria.total + omTotals.horasVoo.total + omTotals.materialConsumo.total;
      omTotals.totalGeral = omTotals.totalLogistica + omTotals.totalOperacional + omTotals.totalMaterialPermanente;
      
      // Soma para os totais globais
      globalTotals.totalLogisticoGeral += omTotals.totalLogistica;
      globalTotals.totalOperacional += omTotals.totalOperacional;
      globalTotals.totalMaterialPermanente += omTotals.totalMaterialPermanente;
      globalTotals.totalAviacaoExercito += omTotals.totalAviacaoExercito;
      globalTotals.totalRacoesOperacionaisGeral += omTotals.classeI.totalRacoesOperacionaisGeral;
      
      // Detalhes Globais (apenas para manter a compatibilidade do modo 'global')
      globalTotals.totalClasseI += omTotals.classeI.total;
      globalTotals.totalComplemento += omTotals.classeI.totalComplemento;
      globalTotals.totalEtapaSolicitadaValor += omTotals.classeI.totalEtapaSolicitadaValor;
      globalTotals.totalDiasEtapaSolicitada += omTotals.classeI.totalDiasEtapaSolicitada;
      globalTotals.totalRefeicoesIntermediarias += omTotals.classeI.totalRefeicoesIntermediarias;
      
      // Classes Diversas (Global)
      const mergeClassTotals = (globalGroup: any, omGroup: any) => {
          globalGroup.total += omGroup.total;
          globalGroup.totalND30 += omGroup.totalND30;
          globalGroup.totalND39 += omGroup.totalND39;
          globalGroup.totalItens += omGroup.totalItens;
          
          Object.entries(omGroup.groupedCategories).forEach(([category, data]: [string, any]) => {
              if (!globalGroup.groupedCategories[category]) {
                  globalGroup.groupedCategories[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
              }
              globalGroup.groupedCategories[category].totalValor += data.totalValor;
              globalGroup.groupedCategories[category].totalND30 += data.totalND30;
              globalGroup.groupedCategories[category].totalND39 += data.totalND39;
              globalGroup.groupedCategories[category].totalItens += data.totalItens;
          });
      };
      
      mergeClassTotals({ total: globalTotals.totalClasseII, totalND30: globalTotals.totalClasseII_ND30, totalND39: globalTotals.totalClasseII_ND39, totalItens: globalTotals.totalItensClasseII, groupedCategories: globalTotals.groupedClasseIICategories }, omTotals.classeII);
      mergeClassTotals({ total: globalTotals.totalClasseV, totalND30: globalTotals.totalClasseV_ND30, totalND39: globalTotals.totalClasseV_ND39, totalItens: globalTotals.totalItensClasseV, groupedCategories: globalTotals.groupedClasseVCategories }, omTotals.classeV);
      mergeClassTotals({ total: globalTotals.totalClasseVI, totalND30: globalTotals.totalClasseVI_ND30, totalND39: globalTotals.totalClasseVI_ND39, totalItens: globalTotals.totalItensClasseVI, groupedCategories: globalTotals.groupedClasseVICategories }, omTotals.classeVI);
      mergeClassTotals({ total: globalTotals.totalClasseVII, totalND30: globalTotals.totalClasseVII_ND30, totalND39: globalTotals.totalClasseVII_ND39, totalItens: globalTotals.totalItensClasseVII, groupedCategories: globalTotals.groupedClasseVIICategories }, omTotals.classeVII);
      mergeClassTotals({ total: globalTotals.totalClasseVIII, totalND30: globalTotals.totalClasseVIII_ND30, totalND39: globalTotals.totalClasseVIII_ND39, totalItens: globalTotals.totalItensClasseVIII, groupedCategories: globalTotals.groupedClasseVIIICategories }, omTotals.classeVIII);
      mergeClassTotals({ total: globalTotals.totalClasseIX, totalND30: globalTotals.totalClasseIX_ND30, totalND39: globalTotals.totalClasseIX_ND39, totalItens: globalTotals.totalItensClasseIX, groupedCategories: globalTotals.groupedClasseIXCategories }, omTotals.classeIX);
      
      // Classe III (Global)
      globalTotals.totalCombustivel += omTotals.classeIII.total;
      globalTotals.totalDieselValor += omTotals.classeIII.totalDieselValor;
      globalTotals.totalGasolinaValor += omTotals.classeIII.totalGasolinaValor;
      globalTotals.totalDieselLitros += omTotals.classeIII.totalDieselLitros;
      globalTotals.totalGasolinaLitros += omTotals.classeIII.totalGasolinaLitros;
      globalTotals.totalLubrificanteValor += omTotals.classeIII.totalLubrificanteValor;
      globalTotals.totalLubrificanteLitros += omTotals.classeIII.totalLubrificanteLitros;
      
      // Operacional (Global)
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
      globalTotals.quantidadeHorasVoo += omTotals.horasVoo.quantidadeHV;
      
      Object.entries(omTotals.horasVoo.groupedHV).forEach(([tipoAnv, data]) => {
          if (!globalTotals.groupedHorasVoo[tipoAnv]) {
              globalTotals.groupedHorasVoo[tipoAnv] = { totalValor: 0, totalHV: 0 };
          }
          globalTotals.groupedHorasVoo[tipoAnv].totalValor += data.totalValor;
          globalTotals.groupedHorasVoo[tipoAnv].totalHV += data.totalHV;
      });
      
      globalTotals.totalMaterialConsumo += omTotals.materialConsumo.total;
      globalTotals.totalMaterialConsumoND30 += omTotals.materialConsumo.totalND30;
      globalTotals.totalMaterialConsumoND39 += omTotals.materialConsumo.totalND39;
  });
  
  // O total logístico para o PTrab é a soma da Classe I (ND 30) + Classes (ND 30 + ND 39) + Classe III (Combustível + Lubrificante)
  // Já calculado na iteração acima (globalTotals.totalLogisticoGeral)
  
  // Total Operacional (Diárias + Verba Operacional + Suprimento de Fundos + Passagens + Concessionária + Horas de Voo + Material Consumo)
  // Já calculado na iteração acima (globalTotals.totalOperacional)
  
  return globalTotals as PTrabAggregatedTotals;
};

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void;
  creditGND3: number;
  creditGND4: number;
}

// Componente auxiliar para renderizar os detalhes de uma aba (Logística ou Operacional)
interface TabDetailsProps {
    mode: 'logistica' | 'operacional' | 'permanente' | 'avex';
    data: OmTotals | PTrabAggregatedTotals;
}

const TabDetails = ({ mode, data }: TabDetailsProps) => {
    const valueClasses = "font-medium text-foreground text-right w-[6rem]"; 
    
    // Função auxiliar para obter dados de classe (funciona para OmTotals e PTrabAggregatedTotals)
    const getClassData = (key: keyof OmTotals | keyof PTrabAggregatedTotals) => {
        // Se for OmTotals, a chave é direta (ex: data.classeII)
        if ((data as OmTotals).omKey) {
            return (data as OmTotals)[key as keyof OmTotals];
        }
        // Se for PTrabAggregatedTotals, a chave pode ser direta (ex: data.totalClasseII) ou agrupada (ex: data.groupedClasseIICategories)
        return data;
    };
    
    // Função auxiliar para obter dados de categoria (funciona para OmTotals e PTrabAggregatedTotals)
    const getGroupedCategories = (key: 'classeII' | 'classeV' | 'classeVI' | 'classeVII' | 'classeVIII' | 'classeIX') => {
        if ((data as OmTotals).omKey) {
            return (data as OmTotals)[key].groupedCategories;
        }
        // Mapeamento de chaves globais para o objeto de categorias
        const globalKeyMap = {
            classeII: 'groupedClasseIICategories',
            classeV: 'groupedClasseVCategories',
            classeVI: 'groupedClasseVICategories',
            classeVII: 'groupedClasseVIICategories',
            classeVIII: 'groupedClasseVIIICategories',
            classeIX: 'groupedClasseIXCategories',
        };
        return (data as PTrabAggregatedTotals)[globalKeyMap[key] as keyof PTrabAggregatedTotals] as Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }>;
    };
    
    // Função auxiliar para obter o total da classe (funciona para OmTotals e PTrabAggregatedTotals)
    const getClassTotal = (key: 'classeI' | 'classeII' | 'classeV' | 'classeVI' | 'classeVII' | 'classeVIII' | 'classeIX' | 'classeIII') => {
        if ((data as OmTotals).omKey) {
            return (data as OmTotals)[key].total;
        }
        // Mapeamento de chaves globais para o total
        const globalKeyMap = {
            classeI: 'totalClasseI',
            classeII: 'totalClasseII',
            classeV: 'totalClasseV',
            classeVI: 'totalClasseVI',
            classeVII: 'totalClasseVII',
            classeVIII: 'totalClasseVIII',
            classeIX: 'totalClasseIX',
            classeIII: 'totalCombustivel',
        };
        return (data as PTrabAggregatedTotals)[globalKeyMap[key] as keyof PTrabAggregatedTotals] as number;
    };
    
    // Função auxiliar para obter o total operacional (funciona para OmTotals e PTrabAggregatedTotals)
    const getOpTotal = (key: 'diarias' | 'verbaOperacional' | 'suprimentoFundos' | 'passagens' | 'concessionaria' | 'horasVoo' | 'materialConsumo') => {
        if ((data as OmTotals).omKey) {
            return (data as OmTotals)[key].total;
        }
        // Mapeamento de chaves globais para o total
        const globalKeyMap = {
            diarias: 'totalDiarias',
            verbaOperacional: 'totalVerbaOperacional',
            suprimentoFundos: 'totalSuprimentoFundos',
            passagens: 'totalPassagensND33',
            concessionaria: 'totalConcessionariaND39',
            horasVoo: 'totalHorasVoo',
            materialConsumo: 'totalMaterialConsumo',
        };
        return (data as PTrabAggregatedTotals)[globalKeyMap[key] as keyof PTrabAggregatedTotals] as number;
    };
    
    const renderClassAccordion = (
        key: 'classeII' | 'classeV' | 'classeVI' | 'classeVII' | 'classeVIII' | 'classeIX', 
        title: string, 
        icon: React.ReactNode, 
        unitLabel: string,
        isRemonta: boolean = false
    ) => {
        const classData = getClassData(key) as OmTotals['classeII'];
        const total = classData.total;
        const groupedCategories = getGroupedCategories(key);
        const sortedCategories = Object.entries(groupedCategories).sort(([a], [b]) => a.localeCompare(b));
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value={`item-${key}`} className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                {icon}
                                {title}
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            {sortedCategories.map(([category, data]) => (
                                <div key={category} className="space-y-1">
                                    <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                        <span className="w-1/2 text-left">{category}</span>
                                        <span className="w-1/4 text-right font-medium">
                                            {formatNumber(data.totalItens)} {isRemonta ? 'animais' : unitLabel}
                                        </span>
                                        <span className="w-1/4 text-right font-medium">
                                            {formatCurrency(data.totalValor)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-muted-foreground text-[9px] pl-2">
                                        <span className="w-1/2 text-left">ND 30 / ND 39</span>
                                        <span className="w-1/4 text-right text-green-600 font-medium">
                                            {formatCurrency(data.totalND30)}
                                        </span>
                                        <span className="w-1/4 text-right text-blue-600 font-medium">
                                            {formatCurrency(data.totalND39)}
                                        </span>
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
        const classeI = getClassData('classeI') as OmTotals['classeI'];
        const total = classeI.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-0">
                <AccordionItem value="item-classe-i" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Utensils className="h-3 w-3 text-orange-500" />
                                Classe I
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            {/* Detalhe 1: Valor Complemento */}
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Complemento (Ref. Int.)</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(classeI.totalRefeicoesIntermediarias)}
                                </span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatCurrency(classeI.totalComplemento)}
                                </span>
                            </div>
                            {/* Detalhe 2: Valor Etapa Solicitada */}
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Etapa Solicitada</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(classeI.totalDiasEtapaSolicitada)} dias
                                </span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatCurrency(classeI.totalEtapaSolicitadaValor)}
                                </span>
                            </div>
                            {/* Detalhe 3: Ração Operacional */}
                            {classeI.totalRacoesOperacionaisGeral > 0 && (
                                <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                    <span className="w-1/2 text-left text-muted-foreground">Ração Operacional (R2/R3)</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(classeI.totalRacoesOperacionaisGeral)} un.
                                    </span>
                                    <span className="w-1/4 text-right font-medium text-background">
                                        {formatCurrency(0)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderClasseIII = () => {
        const classeIII = getClassData('classeIII') as OmTotals['classeIII'];
        const total = classeIII.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value="item-classe-iii" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Fuel className="h-3 w-3 text-orange-500" />
                                Classe III
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            {/* Linha Óleo Diesel */}
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Óleo Diesel</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(classeIII.totalDieselLitros)} L
                                </span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatCurrency(classeIII.totalDieselValor)}
                                </span>
                            </div>
                            {/* Linha Gasolina */}
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Gasolina</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(classeIII.totalGasolinaLitros)} L
                                </span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatCurrency(classeIII.totalGasolinaValor)}
                                </span>
                            </div>
                            {/* Linha Lubrificante */}
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">
                                    Lubrificante
                                </span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(classeIII.totalLubrificanteLitros || 0, 2)} L
                                </span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatCurrency(classeIII.totalLubrificanteValor)}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderDiarias = () => {
        const diarias = getClassData('diarias') as OmTotals['diarias'];
        const total = diarias.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-0">
                <AccordionItem value="item-diarias" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Briefcase className="h-3 w-3 text-blue-500" />
                                Diárias
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Total de Militares</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(diarias.totalMilitares)}
                                </span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Total de Dias de Viagem</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(diarias.totalDiasViagem)} dias
                                </span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                            </div>
                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                <span className="w-1/2 text-left font-semibold">Diárias (ND 15) / Taxa Embarque + ND 30</span>
                                <span className="w-1/4 text-right font-medium text-green-600">
                                    {formatCurrency(diarias.totalND15)}
                                </span>
                                <span className="w-1/4 text-right font-medium text-blue-600">
                                    {formatCurrency(diarias.totalND30)}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderVerbaSuprimento = (key: 'verbaOperacional' | 'suprimentoFundos', title: string) => {
        const group = getClassData(key) as OmTotals['verbaOperacional'];
        const total = group.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value={`item-${key}`} className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                {key === 'verbaOperacional' ? <ClipboardList className="h-3 w-3 text-blue-500" /> : <Wallet className="h-3 w-3 text-blue-500" />}
                                {title}
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Total de Equipes</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(group.totalEquipes)}
                                </span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Total de Dias</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(group.totalDias)} dias
                                </span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                            </div>
                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                <span className="w-1/2 text-left font-semibold">ND 30 / ND 39</span>
                                <span className="w-1/4 text-right font-medium text-green-600">
                                    {formatCurrency(group.totalND30)}
                                </span>
                                <span className="w-1/4 text-right font-medium text-blue-600">
                                    {formatCurrency(group.totalND39)}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderPassagens = () => {
        const passagens = getClassData('passagens') as OmTotals['passagens'];
        const total = passagens.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value="item-passagens" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Plane className="h-3 w-3 text-blue-500" />
                                Passagens
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Total de Passagens</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(passagens.totalQuantidade)} un.
                                </span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span className="w-1/2 text-left">Total de Trechos Registrados</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(passagens.totalTrechos)}
                                </span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                            </div>
                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                <span className="w-1/2 text-left font-semibold">ND 33 (Passagens)</span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                                <span className="w-1/4 text-right font-medium text-green-600">
                                    {formatCurrency(total)}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderConcessionaria = () => {
        const concessionaria = getClassData('concessionaria') as OmTotals['concessionaria'];
        const total = concessionaria.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value="item-concessionaria" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Droplet className="h-3 w-3 text-blue-500" />
                                Concessionária
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            {concessionaria.totalAgua > 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span className="w-1/2 text-left">Água/Esgoto</span>
                                    <span className="w-1/4 text-right font-medium text-background"></span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatCurrency(concessionaria.totalAgua)}
                                    </span>
                                </div>
                            )}
                            {concessionaria.totalEnergia > 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                    <span className="w-1/2 text-left">Energia Elétrica</span>
                                    <span className="w-1/4 text-right font-medium text-background"></span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatCurrency(concessionaria.totalEnergia)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                <span className="w-1/2 text-left font-semibold">ND 39 (Serviços de Terceiros)</span>
                                <span className="w-1/4 text-right font-medium text-background"></span>
                                <span className="w-1/4 text-right font-medium text-blue-600">
                                    {formatCurrency(total)}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderMaterialConsumo = () => {
        const materialConsumo = getClassData('materialConsumo') as OmTotals['materialConsumo'];
        const total = materialConsumo.total;
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value="item-material-consumo" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Package className="h-3 w-3 text-blue-500" />
                                Material de Consumo
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatCurrency(total)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                <span className="w-1/2 text-left font-semibold">ND 30 / ND 39</span>
                                <span className="w-1/4 text-right font-medium text-green-600">
                                    {formatCurrency(materialConsumo.totalND30)}
                                </span>
                                <span className="w-1/4 text-right font-medium text-blue-600">
                                    {formatCurrency(materialConsumo.totalND39)}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };
    
    const renderHorasVoo = () => {
        const horasVoo = getClassData('horasVoo') as OmTotals['horasVoo'];
        const total = horasVoo.total;
        const groupedHV = horasVoo.groupedHV;
        const sortedHV = Object.entries(groupedHV).sort(([a], [b]) => a.localeCompare(b));
        
        if (total === 0) return null;
        
        return (
            <Accordion type="single" collapsible className="w-full pt-1">
                <AccordionItem value="item-horas-voo" className="border-b-0">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                            <div className="flex items-center gap-1 text-foreground">
                                <Plane className="h-3 w-3 text-purple-500" />
                                Horas de Voo (AvEx)
                            </div>
                            <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                                {formatNumber(horasVoo.quantidadeHV, 2)} HV
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                            {sortedHV.map(([tipoAnv, data]) => (
                                <div key={tipoAnv} className="flex justify-between text-muted-foreground">
                                    <span className="w-1/2 text-left">{tipoAnv}</span>
                                    <span className="w-1/4 text-right font-medium text-background"></span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(data.totalHV, 2)} HV
                                    </span>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    };

    if (mode === 'logistica') {
        const totalLogistica = (data as OmTotals).omKey ? (data as OmTotals).totalLogistica : (data as PTrabAggregatedTotals).totalLogisticoGeral;
        
        return (
            <div className="space-y-3 border-l-4 border-orange-500 pl-3">
                <div className="flex items-center justify-between text-xs font-semibold text-orange-600 mb-2">
                    <div className="flex items-center gap-2">
                        <Package className="h-3 w-3" />
                        Logística
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(totalLogistica)}</span>
                </div>
                
                {renderClasseI()}
                {renderClassAccordion('classeII', 'Classe II', <ClipboardList className="h-3 w-3 text-orange-500" />, 'un.')}
                {renderClasseIII()}
                {renderClassAccordion('classeV', 'Classe V', <Swords className="h-3 w-3 text-orange-500" />, 'un.')}
                {renderClassAccordion('classeVI', 'Classe VI', <HardHat className="h-3 w-3 text-orange-500" />, 'un.')}
                {renderClassAccordion('classeVII', 'Classe VII', <Radio className="h-3 w-3 text-orange-500" />, 'un.')}
                {renderClassAccordion('classeVIII', 'Classe VIII', <HeartPulse className="h-3 w-3 text-orange-500" />, 'un.', true)}
                {renderClassAccordion('classeIX', 'Classe IX', <Truck className="h-3 w-3 text-orange-500" />, 'vtr')}
            </div>
        );
    }
    
    if (mode === 'operacional') {
        const totalOperacional = (data as OmTotals).omKey ? (data as OmTotals).totalOperacional : (data as PTrabAggregatedTotals).totalOperacional;
        
        return (
            <div className="space-y-3 border-l-4 border-blue-500 pl-3">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-600 mb-2">
                    <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        Operacional
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(totalOperacional)}</span>
                </div>
                
                {renderDiarias()}
                {renderPassagens()}
                {renderVerbaSuprimento('verbaOperacional', 'Verba Operacional')}
                {renderVerbaSuprimento('suprimentoFundos', 'Suprimento de Fundos')}
                {renderConcessionaria()}
                {renderMaterialConsumo()}
                
                {/* Outros Operacionais (Placeholder) */}
                {/* A lógica de "Outros" é complexa de calcular aqui, então vamos focar nos itens implementados */}
            </div>
        );
    }
    
    if (mode === 'permanente') {
        const totalMaterialPermanente = (data as OmTotals).omKey ? (data as OmTotals).totalMaterialPermanente : (data as PTrabAggregatedTotals).totalMaterialPermanente;
        
        if (totalMaterialPermanente === 0) return null;
        
        return (
            <div className="space-y-3 border-l-4 border-green-500 pl-3">
                <div className="flex items-center justify-between text-xs font-semibold text-green-600 mb-2">
                    <div className="flex items-center gap-2">
                        <HardHat className="h-3 w-3" />
                        Material Permanente
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(totalMaterialPermanente)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="w-1/2 text-left">Itens de Material Permanente</span>
                    <span className="w-1/4 text-right font-medium"></span>
                    <span className="w-1/4 text-right font-medium">
                        {formatCurrency(totalMaterialPermanente)}
                    </span>
                </div>
            </div>
        );
    }
    
    if (mode === 'avex') {
        const totalAviacaoExercito = (data as OmTotals).omKey ? (data as OmTotals).totalAviacaoExercito : (data as PTrabAggregatedTotals).totalAviacaoExercito;
        const quantidadeHorasVoo = (data as OmTotals).omKey ? (data as OmTotals).horasVoo.quantidadeHV : (data as PTrabAggregatedTotals).quantidadeHorasVoo;
        
        if (totalAviacaoExercito === 0) return null;
        
        return (
            <div className="space-y-3 border-l-4 border-purple-500 pl-3">
                <div className="flex items-center justify-between text-xs font-semibold text-purple-600 mb-2">
                    <div className="flex items-center gap-2">
                        <Plane className="h-3 w-3" />
                        Aviação do Exército
                    </div>
                    <span className="font-bold text-sm">
                        {formatNumber(quantidadeHorasVoo, 2)} HV
                    </span>
                </div>
                {renderHorasVoo()}
            </div>
        );
    }
    
    return null;
};


export const PTrabCostSummary = ({ 
  ptrabId, 
  onOpenCreditDialog,
  creditGND3,
  creditGND4,
}: PTrabCostSummaryProps) => {
  const { data, isLoading, error } = useQuery<PTrabAggregatedTotals>({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000,
    initialData: {
        totalLogisticoGeral: 0,
        totalOperacional: 0,
        totalMaterialPermanente: 0,
        totalAviacaoExercito: 0,
        totalRacoesOperacionaisGeral: 0,
        totalClasseI: 0,
        totalComplemento: 0,
        totalEtapaSolicitadaValor: 0,
        totalDiasEtapaSolicitada: 0,
        totalRefeicoesIntermediarias: 0,
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
        totalHorasVoo: 0, quantidadeHorasVoo: 0, groupedHorasVoo: {},
        totalMaterialConsumo: 0, totalMaterialConsumoND30: 0, totalMaterialConsumoND39: 0,
        groupedByOm: {},
    },
  });
  
  // NOVO ESTADO: Modo de visualização (global ou por OM)
  const [viewMode, setViewMode] = useState<'global' | 'byOm'>('global');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const handleSummaryClick = () => {
    const newState = !isDetailsOpen;
    setIsDetailsOpen(newState);
    
    if (newState) {
      setTimeout(() => {
          detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); 
    }
  };


  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="py-3">
          <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Calculando...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg border-destructive">
        <CardHeader className="py-3">
          <CardTitle className="text-xl font-bold text-destructive">Erro no Cálculo</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Ocorreu um erro ao buscar os dados de custeio.</p>
        </CardContent>
      </Card>
    );
  }
  
  const totals = data!;
  
  const totalGeralFinal = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalMaterialPermanente + totals.totalAviacaoExercito;

  const saldoGND3 = creditGND3 - (totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito);
  const saldoGND4 = creditGND4 - totals.totalMaterialPermanente;

  const valueClasses = "font-medium text-foreground text-right w-[6rem]"; 
  
  // Prepara os dados agrupados por OM para iteração
  const sortedOmTotals = useMemo(() => {
      return Object.values(totals.groupedByOm).sort((a, b) => a.omName.localeCompare(b.omName));
  }, [totals.groupedByOm]);
  
  // Componente para renderizar os detalhes no modo GLOBAL
  const renderGlobalDetails = () => (
    <div className="space-y-2" ref={detailsRef}>
        
        {/* Aba Logística */}
        <TabDetails mode="logistica" data={totals} />

        {/* Aba Operacional */}
        <div className="pt-4">
            <TabDetails mode="operacional" data={totals} />
        </div>
        
        {/* Aba Material Permanente */}
        <div className="pt-4">
            <TabDetails mode="permanente" data={totals} />
        </div>
        
        {/* Aba Aviação do Exército */}
        <div className="pt-4">
            <TabDetails mode="avex" data={totals} />
        </div>
    </div>
  );
  
  // Componente para renderizar os detalhes no modo POR OM
  const renderOmDetails = () => (
    <div className="space-y-4" ref={detailsRef}>
        {sortedOmTotals.map(om => (
            <Accordion type="single" collapsible key={om.omKey}>
                <AccordionItem value={om.omKey} className="border-b">
                    <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-sm font-bold text-foreground">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                {om.omName} ({formatCodug(om.ug)})
                            </div>
                            <span className="text-lg font-extrabold text-primary">
                                {formatCurrency(om.totalGeral)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-0">
                        <div className="space-y-4 pl-4 border-l border-border/50">
                            {/* Sub-resumo por Aba dentro da OM */}
                            <TabDetails mode="logistica" data={om} />
                            <TabDetails mode="operacional" data={om} />
                            {om.totalMaterialPermanente > 0 && <TabDetails mode="permanente" data={om} />}
                            {om.totalAviacaoExercito > 0 && <TabDetails mode="avex" data={om} />}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        ))}
    </div>
  );

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        <CardDescription className="text-xs flex justify-between items-center">
          Visão consolidada dos custos logísticos e orçamentários.
          
          {/* NOVO: Toggle de Visualização */}
          <div className="flex items-center space-x-2 text-xs font-medium text-muted-foreground">
            <span className={cn(viewMode === 'global' && 'text-primary font-semibold')}>Global</span>
            <Switch
              checked={viewMode === 'byOm'}
              onCheckedChange={(checked) => {
                setViewMode(checked ? 'byOm' : 'global');
                setIsDetailsOpen(false); // Fecha detalhes ao trocar o modo
              }}
              id="view-mode-toggle"
            />
            <span className={cn(viewMode === 'byOm' && 'text-primary font-semibold')}>Por OM</span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-3">
        
        {/* Resumo de Custos (sempre visível) */}
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
              <span className="font-bold text-sm">
                {formatNumber(totals.quantidadeHorasVoo, 2)} HV
              </span>
            </div>
        </div>
        
        {/* Accordion para Detalhes */}
        <Accordion 
          type="single" 
          collapsible 
          className="w-full px-6 pt-0"
          value={isDetailsOpen ? "summary-details" : undefined}
          onValueChange={(value) => setIsDetailsOpen(value === "summary-details")}
        >
          <AccordionItem value="summary-details" className="border-b-0">
            
            {/* Accordion Trigger Principal: Contém o Total Geral e o botão Mais Detalhes */}
            <AccordionTrigger 
              simple
              className="py-0 px-0 hover:no-underline flex items-center justify-between w-full text-xs text-muted-foreground border-t border-border/50"
              onClick={(e) => {
                e.preventDefault(); 
                handleSummaryClick();
              }}
            >
              <div className="flex justify-between items-center w-full">
                <span className="text-base font-bold text-foreground">Total Geral</span>
                <div className="flex flex-col items-end gap-0">
                    <span className="text-lg font-bold text-foreground">{formatCurrency(totalGeralFinal)}</span>
                    <span className="font-semibold text-primary flex items-center gap-1 text-xs lowercase">
                        {isDetailsOpen ? "menos detalhes" : "mais detalhes"}
                        <ChevronDown className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200",
                          isDetailsOpen ? "rotate-180" : "rotate-0"
                        )} />
                    </span>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="pt-2 pb-0">
              {/* RENDERIZAÇÃO CONDICIONAL */}
              {viewMode === 'global' ? renderGlobalDetails() : renderOmDetails()}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {/* Seção de Crédito (abaixo do Accordion) */}
        <div className="px-6 pt-0 border-t border-border/50 space-y-2 mt-[-1.5rem]">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-accent flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Saldo GND 3
                </h4>
                <span className={cn("font-bold text-lg", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(saldoGND3)}
                </span>
            </div>
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-accent flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Saldo GND 4
                </h4>
                <span className={cn("font-bold text-lg", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(saldoGND4)}
                </span >
            </div>
            <Button 
                onClick={onOpenCreditDialog} 
                variant="outline" 
                className="w-full mt-2 border-accent text-accent hover:bg-accent/10 h-8 text-sm"
            >
                Informar Crédito
            </Button>
        </div>
        
      </CardContent>
    </Card>
  );
};

export { fetchPTrabTotals };