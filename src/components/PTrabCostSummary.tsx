import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// Define the category constants (kept for fetchPTrabTotals logic)
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
    
    totalMaterialConsumo: number;
    totalMaterialConsumoND30: number;
    totalMaterialConsumoND39: number;

    // Nova Estrutura Agrupada por OM
    groupedByOm: Record<string, OmTotals>;
}

// Tipos para a nova estrutura do componente
type AbaGlobal = {
  nome: string;
  valor: number;
  cor: string;
};

type OM = {
  nome: string;
  valor: number;
};

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
    { data: materialConsumoData, error: materialConsumoError },
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
      .from('material_consumo_registros')
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
  const safeMaterialConsumoData = materialConsumoData || [];
  
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
  
  // 9. Processamento de Material de Consumo (ND 33.90.30/39)
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
  
  return globalTotals as PTrabAggregatedTotals;
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
  
  // --- Data Transformation ---
  
  const dadosGlobal: AbaGlobal[] = useMemo(() => {
    const items: AbaGlobal[] = [
      { nome: "Aba Logística", valor: totals.totalLogisticoGeral, cor: "text-orange-600" },
      { nome: "Aba Operacional", valor: totals.totalOperacional, cor: "text-blue-600" },
      { nome: "Aba Material Permanente", valor: totals.totalMaterialPermanente, cor: "text-green-600" },
      { nome: "Aba Aviação do Exército", valor: totals.totalAviacaoExercito, cor: "text-purple-600" },
    ];
    // Filtra itens com valor zero, exceto se todos forem zero
    const hasAnyValue = items.some(item => item.valor > 0);
    return hasAnyValue ? items.filter(item => item.valor > 0) : items;
  }, [totals]);

  const dadosPorOM: OM[] = useMemo(() => {
    const omGroups = totals.groupedByOm || {}; 
    return Object.values(omGroups)
      .map(om => ({
        nome: om.omName,
        valor: om.totalGeral,
      }))
      .filter(om => om.valor > 0);
  }, [totals.groupedByOm]);
  
  // --- New Component Logic ---
  
  const [modo, setModo] = useState<"global" | "om">("global");
  
  const totalGeral = useMemo(() => {
    if (modo === "global") {
      return dadosGlobal.reduce((acc, item) => acc + item.valor, 0);
    }
    return dadosPorOM.reduce((acc, item) => acc + item.valor, 0);
  }, [modo, dadosGlobal, dadosPorOM]);

  const dadosOMOrdenados = useMemo(() => {
    return [...dadosPorOM].sort((a, b) => b.valor - a.valor);
  }, [dadosPorOM]);

  const calculatedGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
  const calculatedGND4 = totals.totalMaterialPermanente;
  
  const saldoGND3 = creditGND3 - calculatedGND3;
  const saldoGND4 = creditGND4 - calculatedGND4;
  
  return (
    <Card className="shadow-lg">
      
      {/* HEADER */}
      <CardHeader className="pb-2 pt-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">
            Resumo de Custos
          </h2>

          {/* Toggle (Adapted to shadcn/ui Switch) */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={cn(modo === "global" ? "text-primary font-semibold" : "text-muted-foreground")}>
              Global
            </span>

            <Switch
              checked={modo === "om"}
              onCheckedChange={(checked) => setModo(checked ? "om" : "global")}
              id="view-mode-toggle"
            />

            <span className={cn(modo === "om" ? "text-primary font-semibold" : "text-muted-foreground")}>
              Por OM
            </span>
          </div>
        </div>

        <CardDescription className="text-xs">
          Visão consolidada dos custos logísticos e orçamentários.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        
        {/* GLOBAL MODE */}
        {modo === "global" && (
          <div className="mt-3 space-y-3">
            {dadosGlobal.map((item) => (
              <div
                key={item.nome}
                className="flex justify-between items-center"
              >
                <span
                  className={cn("font-medium text-sm", item.cor)}
                >
                  {item.nome}
                </span>

                <span className="font-semibold text-sm text-foreground">
                  {formatCurrency(item.valor)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* POR OM MODE (MODERNO) */}
        {modo === "om" && (
          <div className="mt-3 space-y-3">
            {dadosOMOrdenados.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 text-sm">
                    Nenhuma OM com custos registrados.
                </div>
            ) : (
                dadosOMOrdenados.map((om, index) => {
                    const percentual =
                        totalGeral > 0
                        ? ((om.valor / totalGeral) * 100).toFixed(1)
                        : "0";

                    return (
                        <div
                            key={om.nome}
                            className="group bg-gray-50 hover:bg-white 
                                    transition-all duration-200
                                    border border-gray-200 
                                    rounded-lg p-3 
                                    shadow-sm hover:shadow-md"
                        >
                            <div className="flex justify-between items-center">
                                
                                {/* Lado esquerdo */}
                                <div className="flex items-center gap-3">
                                    
                                    {/* Ranking badge (Adapted to use Tailwind colors) */}
                                    <div className="w-8 h-8 rounded-md 
                                                    bg-indigo-600
                                                    text-white flex items-center 
                                                    justify-center font-semibold text-xs">
                                        {index + 1}
                                    </div>

                                    <div>
                                        <div className="font-medium text-sm text-foreground">
                                            {om.nome}
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            {percentual}% do total
                                        </div>
                                    </div>
                                </div>

                                {/* Valor */}
                                <div className="text-right">
                                    <div className="text-base font-semibold text-foreground group-hover:text-indigo-600 transition-colors">
                                        {formatCurrency(om.valor)}
                                    </div>
                                </div>
                            </div>

                            {/* Barra proporcional */}
                            <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-700"
                                        style={{ width: `${percentual}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
          </div>
        )}

        {/* TOTAL */}
        <div className="border-t border-border mt-6 pt-4 flex justify-between items-center">
          <span className="font-semibold text-base text-foreground">
            Total Geral
          </span>

          <span className="text-xl font-bold text-primary">
            {formatCurrency(totalGeral)}
          </span>
        </div>

        {/* SALDOS */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-amber-600 font-medium">
              Saldo GND 3
            </span>

            <span
              className={cn("font-semibold", saldoGND3 < 0 ? "text-red-600" : "text-green-600")}
            >
              {formatCurrency(saldoGND3)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-amber-600 font-medium">
              Saldo GND 4
            </span>

            <span
              className={cn("font-semibold", saldoGND4 < 0 ? "text-red-600" : "text-green-600")}
            >
              {formatCurrency(saldoGND4)}
            </span>
          </div>
        </div>

        {/* BOTÃO */}
        <Button 
          onClick={onOpenCreditDialog} 
          variant="outline" 
          className="mt-6 w-full border-amber-500 text-amber-600 font-medium hover:bg-amber-50 transition-all"
        >
          Informar Crédito
        </Button>
      </CardContent>
    </Card>
  );
};

export { fetchPTrabTotals };