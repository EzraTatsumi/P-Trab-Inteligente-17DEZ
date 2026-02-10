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
import { Switch } from "@/components/ui/switch"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
    omKey: string; // organizacao normalizada
    omName: string;
    ug: string; // Pode conter múltiplas UGs separadas por vírgula
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
    horasVoo: { total: number, totalND30: number, totalND39: number, quantidadeHV: number, groupedHV: Record<string, { totalValor: number, totalHV: number }> };
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
    totalHorasVooND30: number;
    totalHorasVooND39: number;
    quantidadeHorasVoo: number;
    groupedHorasVoo: Record<string, { totalValor: number, totalHV: number }>;
    
    totalMaterialConsumo: number;
    totalMaterialConsumoND30: number;
    totalMaterialConsumoND39: number;

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

// NOVO: Função de normalização profunda para chaves de OM
const normalizeOmName = (name: string): string => {
    if (!name) return "";
    return name
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/ª/g, "A") // Converte ordinal feminino
        .replace(/º/g, "O") // Converte ordinal masculino
        .replace(/[^A-Z0-9\s]/g, "") // Remove caracteres especiais restantes
        .replace(/\s+/g, " "); // Unifica espaços múltiplos
};

const initializeOmTotals = (omName: string, ug: string): OmTotals => ({
    omKey: normalizeOmName(omName), // Chave agora é apenas o nome normalizado
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
    materialConsumo: { total: 0, totalND30: 0, totalND39: 0 },
});

const fetchPTrabTotals = async (ptrabId: string): Promise<PTrabAggregatedTotals> => {
  try {
    // Inicializa o objeto de agregação por OM
    const groupedByOm: Record<string, OmTotals> = {};
    
    const getOmTotals = (omName: string, ug: string): OmTotals => {
        const cleanName = (omName || "").trim();
        const cleanUg = (ug || "").trim();
        const key = normalizeOmName(cleanName); // Agrupa apenas pelo nome normalizado
        
        if (!groupedByOm[key]) {
            groupedByOm[key] = initializeOmTotals(cleanName, cleanUg);
        } else {
            // Se a OM já existe mas a UG é diferente, adiciona à lista de UGs exibidas
            const currentUgs = groupedByOm[key].ug.split(', ');
            if (cleanUg && !currentUgs.includes(cleanUg)) {
                groupedByOm[key].ug = [...currentUgs, cleanUg].join(', ');
            }
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

      } else if (record.categoria === 'RACAO_OPERACIONAL') {
          const totalRacoesOperacionais = Number(record.quantidade_r2 || 0) + Number(record.quantidade_r3 || 0);
          omTotals.classeI.totalRacoesOperacionaisGeral += totalRacoesOperacionais;
      }
    });
    
    // 2. Fetch Classes II, V, VI, VII, VIII, IX records from their respective tables
    // CORREÇÃO: Adicionado .eq('p_trab_id', ptrabId) em todas as consultas para filtrar pelo P Trab atual
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
        .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_v_registros')
        .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_vi_registros')
        .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_vii_registros')
        .select('valor_total, itens_equipamentos, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_viii_saude_registros')
        .select('valor_total, itens_saude, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_viii_remonta_registros')
        .select('valor_total, itens_remonta, dias_operacao, organizacao, ug, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_ix_registros')
        .select('valor_total, itens_motomecanizacao, dias_operacao, organizacao, ug, categoria, valor_nd_30, valor_nd_39')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('classe_iii_registros')
        .select('valor_total, tipo_combustivel, total_litros, tipo_equipamento, organizacao, ug, consumo_lubrificante_litro, preco_lubrificante')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('diaria_registros')
        .select('valor_total, valor_nd_15, valor_taxa_embarque, quantidade, dias_operacao, valor_nd_30, organizacao, ug')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('verba_operacional_registros')
        .select('valor_nd_30, valor_nd_39, valor_total_solicitado, dias_operacao, quantidade_equipes, detalhamento, organizacao, ug')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('passagem_registros')
        .select('valor_total, valor_nd_33, quantidade_passagens, is_ida_volta, origem, destino, organizacao, ug')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('concessionaria_registros')
        .select('valor_total, valor_nd_39, dias_operacao, efetivo, categoria, organizacao, ug')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('horas_voo_registros')
        .select('valor_total, valor_nd_30, valor_nd_39, quantidade_hv, tipo_anv, organizacao, ug')
        .eq('p_trab_id', ptrabId),
      supabase
        .from('material_consumo_registros')
        .select('valor_total, valor_nd_30, valor_nd_39, organizacao, ug')
        .eq('p_trab_id', ptrabId),
    ]);

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
      ...safeClasseIIData.map(r => ({ ...r, classe: 'II' })),
      ...safeClasseVData.map(r => ({ ...r, classe: 'V' })),
      ...safeClasseVIData.map(r => ({ ...r, classe: 'VI' })),
      ...safeClasseVIIData.map(r => ({ ...r, classe: 'VII' })),
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
      
      const updateCategoryTotals = (group: { total: number, totalND30: number, totalND39: number, totalItens: number, groupedCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> }) => {
          if (!group) return;
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
      
      omTotals.diarias.total += totalGeral + valorND30;
      omTotals.diarias.totalND15 += totalGeral - taxaEmbarque;
      omTotals.diarias.totalND30 += taxaEmbarque + valorND30;
      omTotals.diarias.totalMilitares += quantidade;
      omTotals.diarias.totalDiasViagem += diasOperacao;
    });
    
    // 5. Processamento de Verba Operacional e Suprimento de Fundos
    safeVerbaOperacionalData.forEach(record => {
      const omTotals = getOmTotals(record.organizacao, record.ug);
      const valorND30 = Number(record.valor_nd_30 || 0);
      const valorND39 = Number(record.valor_nd_39 || 0);
      const total = valorND30 + valorND39;
      const quantidadeEquipes = Number(record.quantidade_equipes || 0);
      const diasOperacao = Number(record.dias_operacao || 0);
      
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
    });
    
    // 7. Processamento de Concessionária (ND 33.90.39)
    safeConcessionariaData.forEach(record => {
      const omTotals = getOmTotals(record.organizacao, record.ug);
      const valorND39 = Number(record.valor_nd_39 || 0);
      
      omTotals.concessionaria.total += valorND39;
      omTotals.concessionaria.totalRegistros += 1;
      
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
      const valorND30 = Number(record.valor_nd_30 || 0);
      const valorND39 = Number(record.valor_nd_39 || 0);
      const quantidadeHv = Number(record.quantidade_hv || 0);
      const tipoAnv = record.tipo_anv || 'Não Especificado';
      
      omTotals.horasVoo.total += valorTotal;
      omTotals.horasVoo.totalND30 += valorND30;
      omTotals.horasVoo.totalND39 += valorND39;
      omTotals.horasVoo.quantidadeHV += quantidadeHv;
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
    });
    
    // 10. Consolidação Final e Totais Globais
    // IMPORTANTE: O total global agora é calculado SOMANDO os totais das OMs já consolidadas
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
        
        totalHorasVoo: 0, totalHorasVooND30: 0, totalHorasVooND39: 0, quantidadeHorasVoo: 0, groupedHorasVoo: {},
        totalMaterialConsumo: 0, totalMaterialConsumoND30: 0, totalMaterialConsumoND39: 0,
        
        groupedByOm,
    };
    
    // Itera sobre os totais por OM para calcular os totais globais
    Object.values(groupedByOm).forEach(omTotals => {
        // Atualiza o total geral da OM
        omTotals.totalLogistica = omTotals.classeI.total + omTotals.classeII.total + omTotals.classeIII.total + omTotals.classeV.total + omTotals.classeVI.total + omTotals.classeVII.total + omTotals.classeVIII.total + omTotals.classeIX.total;
        omTotals.totalOperacional = omTotals.diarias.total + omTotals.verbaOperacional.total + omTotals.suprimentoFundos.total + omTotals.passagens.total + omTotals.concessionaria.total + omTotals.materialConsumo.total;
        omTotals.totalGeral = omTotals.totalLogistica + omTotals.totalOperacional + omTotals.totalMaterialPermanente + omTotals.totalAviacaoExercito;
        
        // Soma para os totais globais
        globalTotals.totalLogisticoGeral += omTotals.totalLogistica;
        globalTotals.totalOperacional += omTotals.totalOperacional;
        globalTotals.totalMaterialPermanente += omTotals.totalMaterialPermanente;
        globalTotals.totalAviacaoExercito += omTotals.totalAviacaoExercito;
        globalTotals.totalRacoesOperacionaisGeral += omTotals.classeI.totalRacoesOperacionaisGeral;
        
        // Detalhes Globais
        globalTotals.totalClasseI += omTotals.classeI.total;
        globalTotals.totalComplemento += omTotals.classeI.totalComplemento;
        globalTotals.totalEtapaSolicitadaValor += omTotals.classeI.totalEtapaSolicitadaValor;
        globalTotals.totalDiasEtapaSolicitada += omTotals.classeI.totalDiasEtapaSolicitada;
        globalTotals.totalRefeicoesIntermediarias += omTotals.classeI.totalRefeicoesIntermediarias;
        
        // Classes Diversas (Global)
        const mergeClassTotals = (globalKey: 'ClasseII' | 'ClasseV' | 'ClasseVI' | 'ClasseVII' | 'ClasseVIII' | 'ClasseIX', omGroup: any) => {
            const totalKey = `total${globalKey}` as keyof PTrabAggregatedTotals;
            const nd30Key = `total${globalKey}_ND30` as keyof PTrabAggregatedTotals;
            const nd39Key = `total${globalKey}_ND39` as keyof PTrabAggregatedTotals;
            const itensKey = `totalItens${globalKey}` as keyof PTrabAggregatedTotals;
            const groupedKey = `grouped${globalKey}Categories` as keyof PTrabAggregatedTotals;
            
            (globalTotals[totalKey] as number) += omGroup.total;
            (globalTotals[nd30Key] as number) += omGroup.totalND30;
            (globalTotals[nd39Key] as number) += omGroup.totalND39;
            (globalTotals[itensKey] as number) += omGroup.totalItens;
            
            const globalGrouped = globalTotals[groupedKey] as Record<string, any>;
            
            Object.entries(omGroup.groupedCategories).forEach(([category, data]: [string, any]) => {
                if (!globalGrouped[category]) {
                    globalGrouped[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
                }
                globalGrouped[category].totalValor += data.totalValor;
                globalGrouped[category].totalND30 += data.totalND30;
                globalGrouped[category].totalND39 += data.totalND39;
                globalGrouped[category].totalItens += data.totalItens;
            });
        };
        
        mergeClassTotals('ClasseII', omTotals.classeII);
        mergeClassTotals('ClasseV', omTotals.classeV);
        mergeClassTotals('ClasseVI', omTotals.classeVI);
        mergeClassTotals('ClasseVII', omTotals.classeVII);
        mergeClassTotals('ClasseVIII', omTotals.classeVIII);
        mergeClassTotals('ClasseIX', omTotals.classeIX);
        
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
        globalTotals.totalHorasVooND30 += omTotals.horasVoo.totalND30;
        globalTotals.totalHorasVooND39 += omTotals.horasVoo.totalND39;
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
  } catch (err) {
    console.error("Erro crítico no processamento de totais:", err);
    throw err;
  }
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

// Função auxiliar para obter dados de classe I de forma unificada
const getClasseIData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['classeI'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).classeI;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalClasseI,
        totalComplemento: globalData.totalComplemento,
        totalEtapaSolicitadaValor: globalData.totalEtapaSolicitadaValor,
        totalDiasEtapaSolicitada: globalData.totalDiasEtapaSolicitada,
        totalRefeicoesIntermediarias: globalData.totalRefeicoesIntermediarias,
        totalRacoesOperacionaisGeral: globalData.totalRacoesOperacionaisGeral,
    };
};

// Função auxiliar para obter dados de classe III de forma unificada
const getClasseIIIData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['classeIII'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).classeIII;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalCombustivel,
        totalDieselValor: globalData.totalDieselValor,
        totalGasolinaValor: globalData.totalGasolinaValor,
        totalDieselLitros: globalData.totalDieselLitros,
        totalGasolinaLitros: globalData.totalGasolinaLitros,
        totalLubrificanteValor: globalData.totalLubrificanteValor,
        totalLubrificanteLitros: globalData.totalLubrificanteLitros,
    };
};

// Função auxiliar para obter dados de Diárias de forma unificada
const getDiariasData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['diarias'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).diarias;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalDiarias,
        totalND15: globalData.totalDiariasND15,
        totalND30: globalData.totalDiariasND30,
        totalMilitares: globalData.totalMilitaresDiarias,
        totalDiasViagem: globalData.totalDiasViagem,
    };
};

// Função auxiliar para obter dados de Verba Operacional de forma unificada
const getVerbaOperacionalData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['verbaOperacional'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).verbaOperacional;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalVerbaOperacional,
        totalND30: globalData.totalVerbaOperacionalND30,
        totalND39: globalData.totalVerbaOperacionalND39,
        totalEquipes: globalData.totalEquipesVerba,
        totalDias: globalData.totalDiasVerba,
    };
};

// Função auxiliar para obter dados de Suprimento de Fundos de forma unificada
const getSuprimentoFundosData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['suprimentoFundos'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).suprimentoFundos;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalSuprimentoFundos,
        totalND30: globalData.totalSuprimentoFundosND30,
        totalND39: globalData.totalSuprimentoFundosND39,
        totalEquipes: globalData.totalEquipesSuprimento,
        totalDias: globalData.totalDiasSuprimento,
    };
};

// Função auxiliar para obter dados de Passagens de forma unificada
const getPassagensData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['passagens'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).passagens;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalPassagensND33,
        totalQuantidade: globalData.totalQuantidadePassagens,
        totalTrechos: globalData.totalTrechosPassagens,
    };
};

// Função auxiliar para obter dados de Concessionária de forma unificada
const getConcessionariaData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['concessionaria'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).concessionaria;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalConcessionariaND39,
        totalAgua: globalData.totalConcessionariaAgua,
        totalEnergia: globalData.totalConcessionariaEnergia,
        totalRegistros: globalData.totalConcessionariaRegistros,
    };
};

// Função auxiliar para obter dados de Horas Voo de forma unificada
const getHorasVooData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['horasVoo'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).horasVoo;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalHorasVoo,
        totalND30: globalData.totalHorasVooND30, 
        totalND39: globalData.totalHorasVooND39,
        quantidadeHV: globalData.quantidadeHorasVoo,
        groupedHV: globalData.groupedHorasVoo,
    };
};

// Função auxiliar para obter dados de Material Consumo de forma unificada
const getMaterialConsumoData = (data: OmTotals | PTrabAggregatedTotals): OmTotals['materialConsumo'] => {
    if ((data as OmTotals).omKey) {
        return (data as OmTotals).materialConsumo;
    }
    // Modo Global
    const globalData = data as PTrabAggregatedTotals;
    return {
        total: globalData.totalMaterialConsumo,
        totalND30: globalData.totalMaterialConsumoND30,
        totalND39: globalData.totalMaterialConsumoND39,
    };
};

// NOVO COMPONENTE: CategoryCard
const CategoryCard = ({ 
  label, 
  value, 
  icon: Icon, 
  colorClass, 
  nd15,
  nd30, 
  nd33,
  nd39,
  extraInfo,
  details
}: { 
  label: string, 
  value: number, 
  icon: any, 
  colorClass: string,
  nd15?: number,
  nd30?: number,
  nd33?: number,
  nd39?: number,
  extraInfo?: string,
  details?: React.ReactNode
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Exibe o card se houver valor financeiro OU se houver informação extra (ex: HVs)
  if (value === 0 && !extraInfo) return null;

  return (
    <div 
      className={cn(
        "flex flex-col p-5 rounded-xl border border-border/50 bg-card/40 hover:bg-accent/5 transition-all group cursor-pointer min-h-[110px]",
        isExpanded && "ring-1 ring-primary/30 bg-accent/5 shadow-sm"
      )}
      onClick={() => details && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={cn("p-3 rounded-lg transition-colors", colorClass)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold leading-none mb-2 truncate">
            {label}
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold text-foreground leading-none">
              {value > 0 ? formatCurrency(value) : extraInfo}
            </span>
            {value > 0 && extraInfo && (
              <span className="text-[12px] font-bold text-primary mt-2">
                {extraInfo}
              </span>
            )}
          </div>
        </div>
        {details && (
          <ChevronDown className={cn(
            "h-5 w-5 ml-auto text-muted-foreground transition-transform duration-200 shrink-0",
            isExpanded ? "rotate-180" : "rotate-0"
          )} />
        )}
      </div>
      
      {(nd15 !== undefined || nd30 !== undefined || nd33 !== undefined || nd39 !== undefined) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-auto pt-4 border-t border-dashed border-border/50">
          {nd15 !== undefined && nd15 > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">ND 15</span>
              <span className="text-[12px] font-semibold text-purple-600 leading-none">{formatCurrency(nd15)}</span>
            </div>
          )}
          {nd30 !== undefined && nd30 > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">ND 30</span>
              <span className="text-[12px] font-semibold text-green-600 leading-none">{formatCurrency(nd30)}</span>
            </div>
          )}
          {nd33 !== undefined && nd33 > 0 && (
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">ND 33</span>
              <span className="text-[12px] font-semibold text-cyan-600 leading-none">{formatCurrency(nd33)}</span>
            </div>
          )}
          {nd39 !== undefined && nd39 > 0 && (
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">ND 39</span>
              <span className="text-[12px] font-semibold text-blue-600 leading-none">{formatCurrency(nd39)}</span>
            </div>
          )}
        </div>
      )}

      {isExpanded && details && (
        <div className="mt-5 pt-5 border-t border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
          {details}
        </div>
      )}
    </div>
  );
};

// NOVO COMPONENTE: Dialog para exibir detalhes da OM
interface OmDetailsDialogProps {
    om: OmTotals | null;
    totals: PTrabAggregatedTotals;
    onClose: () => void;
}

const OmDetailsDialog = ({ om, totals, onClose }: OmDetailsDialogProps) => {
    if (!om) return null;
    
    // Calculate impact percentage
    const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;
    const omGND3Total = om.totalLogistica + om.totalOperacional + om.totalAviacaoExercito;
    const impactPercentage = totalGND3 > 0 ? ((omGND3Total / totalGND3) * 100).toFixed(1) : '0.0';

    const renderClassDetails = (group: any, unitLabel: string = 'un.') => (
      <div className="space-y-2.5 text-[12px]">
        {Object.entries(group.groupedCategories).sort(([a], [b]) => a.localeCompare(b)).map(([category, data]: [string, any]) => (
          <div key={category} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0">
            <span className="font-medium w-1/2 text-left truncate pr-3">{category}</span>
            <div className="flex w-1/2 justify-between gap-3">
              <span className="font-medium text-right w-1/2 whitespace-nowrap">{formatNumber(data.totalItens)} {unitLabel}</span>
              <span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency(data.totalValor)}</span>
            </div>
          </div>
        ))}
      </div>
    );

    return (
        <Dialog open={!!om} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[1400px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-8 pb-5 border-b border-border/50">
                    <DialogTitle className="text-3xl font-bold">{om.omName}</DialogTitle>
                    <DialogDescription className="text-base">
                        UG(s): {om.ug.split(', ').map(u => formatCodug(u)).join(', ')} | Total: {formatCurrency(om.totalGeral)}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-12">
                    {/* Bloco Logística */}
                    {om.totalLogistica > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-orange-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-orange-500/20 pb-2">
                                <div className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Aba Logística
                                </div>
                                <span className="text-xl font-extrabold">{formatCurrency(om.totalLogistica)}</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                <CategoryCard 
                                    label="Classe I (Alimentação)" 
                                    value={om.classeI.total} 
                                    icon={Utensils} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeI.total}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="w-1/2 text-left truncate pr-3">Complemento (Ref. Int.)</span>
                                          <span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeI.totalRefeicoesIntermediarias)}</span>
                                          <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeI.totalComplemento)}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="w-1/2 text-left truncate pr-3">Etapa Solicitada</span>
                                          <span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeI.totalDiasEtapaSolicitada)} dias</span>
                                          <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeI.totalEtapaSolicitadaValor)}</span>
                                        </div>
                                        {om.classeI.totalRacoesOperacionaisGeral > 0 && (
                                          <div className="flex justify-between text-muted-foreground">
                                            <span className="w-1/2 text-left truncate pr-3">Ração Operacional (R2/R3)</span>
                                            <span className="w-1/4 text-right font-medium whitespace-nowrap">{om.classeI.totalRacoesOperacionaisGeral} un.</span>
                                            <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(0)}</span>
                                          </div>
                                        )}
                                      </div>
                                    }
                                />
                                <CategoryCard 
                                    label="Classe II (Intendência)" 
                                    value={om.classeII.total} 
                                    icon={ClipboardList} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeII.totalND30}
                                    nd39={om.classeII.totalND39}
                                    details={renderClassDetails(om.classeII)}
                                />
                                <CategoryCard 
                                    label="Classe III (Combustíveis)" 
                                    value={om.classeIII.total} 
                                    icon={Fuel} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeIII.total}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="w-1/2 text-left truncate pr-3">Óleo Diesel</span>
                                          <span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeIII.totalDieselLitros)} L</span>
                                          <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeIII.totalDieselValor)}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="w-1/2 text-left truncate pr-3">Gasolina</span>
                                          <span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeIII.totalGasolinaLitros)} L</span>
                                          <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeIII.totalGasolinaValor)}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span className="w-1/2 text-left truncate pr-3">Lubrificante</span>
                                          <span className="w-1/4 text-right font-medium whitespace-nowrap">{formatNumber(om.classeIII.totalLubrificanteLitros, 2)} L</span>
                                          <span className="w-1/4 text-right font-bold text-foreground whitespace-nowrap">{formatCurrency(om.classeIII.totalLubrificanteValor)}</span>
                                        </div>
                                      </div>
                                    }
                                />
                                <CategoryCard 
                                    label="Classe V (Armamento)" 
                                    value={om.classeV.total} 
                                    icon={Swords} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeV.totalND30}
                                    nd39={om.classeV.totalND39}
                                    details={renderClassDetails(om.classeV)}
                                />
                                <CategoryCard 
                                    label="Classe VI (Engenharia)" 
                                    value={om.classeVI.total} 
                                    icon={HardHat} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeVI.totalND30}
                                    nd39={om.classeVI.totalND39}
                                    details={renderClassDetails(om.classeVI)}
                                />
                                <CategoryCard 
                                    label="Classe VII (Com/Inf)" 
                                    value={om.classeVII.total} 
                                    icon={Radio} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeVII.totalND30}
                                    nd39={om.classeVII.totalND39}
                                    details={renderClassDetails(om.classeVII)}
                                />
                                <CategoryCard 
                                    label="Classe VIII (Saúde/Remonta)" 
                                    value={om.classeVIII.total} 
                                    icon={HeartPulse} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeVIII.totalND30}
                                    nd39={om.classeVIII.totalND39}
                                    details={renderClassDetails(om.classeVIII)}
                                />
                                <CategoryCard 
                                    label="Classe IX (Motomecanização)" 
                                    value={om.classeIX.total} 
                                    icon={Truck} 
                                    colorClass="bg-orange-500/10 text-orange-600"
                                    nd30={om.classeIX.totalND30}
                                    nd39={om.classeIX.totalND39}
                                    details={renderClassDetails(om.classeIX, 'vtr')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Bloco Operacional */}
                    {om.totalOperacional > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-blue-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-blue-500/20 pb-2">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-5 w-5" />
                                    Aba Operacional
                                </div>
                                <span className="text-xl font-extrabold">{formatCurrency(om.totalOperacional)}</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                <CategoryCard 
                                    label="Concessionária" 
                                    value={om.concessionaria.total} 
                                    icon={Droplet} 
                                    colorClass="bg-blue-500/10 text-blue-600"
                                    nd39={om.concessionaria.total}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="truncate pr-3">Água/Esgoto</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(om.concessionaria.totalAgua)}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span className="truncate pr-3">Energia Elétrica</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(om.concessionaria.totalEnergia)}</span>
                                        </div>
                                      </div>
                                    }
                                />
                                <CategoryCard 
                                    label="Diárias" 
                                    value={om.diarias.total} 
                                    icon={Briefcase} 
                                    colorClass="bg-blue-500/10 text-blue-600"
                                    nd15={om.diarias.totalND15}
                                    nd30={om.diarias.totalND30}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="truncate pr-3">Militares</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.diarias.totalMilitares}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span className="truncate pr-3">Dias de Viagem</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.diarias.totalDiasViagem}</span>
                                        </div>
                                      </div>
                                    }
                                />
                                <CategoryCard 
                                    label="Material de Consumo" 
                                    value={om.materialConsumo.total} 
                                    icon={Package} 
                                    colorClass="bg-blue-500/10 text-blue-600"
                                    nd30={om.materialConsumo.totalND30}
                                    nd39={om.materialConsumo.totalND39}
                                />
                                <CategoryCard 
                                    label="Passagens" 
                                    value={om.passagens.total} 
                                    icon={Plane} 
                                    colorClass="bg-blue-500/10 text-blue-600"
                                    nd33={om.passagens.total}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="truncate pr-3">Quantidade</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.passagens.totalQuantidade} un.</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span className="truncate pr-3">Trechos</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.passagens.totalTrechos}</span>
                                        </div>
                                      </div>
                                    }
                                />
                                <CategoryCard 
                                    label="Suprimento de Fundos" 
                                    value={om.suprimentoFundos.total} 
                                    icon={Wallet} 
                                    colorClass="bg-blue-500/10 text-blue-600"
                                    nd30={om.suprimentoFundos.totalND30}
                                    nd39={om.suprimentoFundos.totalND39}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="truncate pr-3">Equipes</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.suprimentoFundos.totalEquipes}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span className="truncate pr-3">Dias</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.suprimentoFundos.totalDias}</span>
                                        </div>
                                      </div>
                                    }
                                />
                                <CategoryCard 
                                    label="Verba Operacional" 
                                    value={om.verbaOperacional.total} 
                                    icon={Activity} 
                                    colorClass="bg-blue-500/10 text-blue-600"
                                    nd30={om.verbaOperacional.totalND30}
                                    nd39={om.verbaOperacional.totalND39}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        <div className="flex justify-between text-muted-foreground border-b border-border/20 pb-2">
                                          <span className="truncate pr-3">Equipes</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.verbaOperacional.totalEquipes}</span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span className="truncate pr-3">Dias</span>
                                          <span className="font-bold text-foreground whitespace-nowrap">{om.verbaOperacional.totalDias}</span>
                                        </div>
                                      </div>
                                    }
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* Bloco Aviação do Exército */}
                    {(om.totalAviacaoExercito > 0 || om.horasVoo.quantidadeHV > 0) && (
                        <div>
                            <h3 className="text-base font-bold text-purple-600 uppercase tracking-wider mb-5 flex items-center justify-between border-b border-purple-500/20 pb-2">
                                <div className="flex items-center gap-2">
                                    <Plane className="h-5 w-5" />
                                    Aba Aviação do Exército
                                </div>
                                <span className="text-xl font-extrabold">{formatCurrency(om.totalAviacaoExercito)}</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                <CategoryCard 
                                    label="Horas de Voo" 
                                    value={om.horasVoo.total} 
                                    icon={Zap} 
                                    colorClass="bg-purple-500/10 text-purple-600"
                                    nd30={om.horasVoo.totalND30}
                                    nd39={om.horasVoo.totalND39}
                                    extraInfo={`${formatNumber(om.horasVoo.quantidadeHV, 2)} HV`}
                                    details={
                                      <div className="space-y-2.5 text-[12px]">
                                        {Object.entries(om.horasVoo.groupedHV).sort(([a], [b]) => a.localeCompare(b)).map(([tipoAnv, data]) => (
                                          <div key={tipoAnv} className="flex justify-between text-muted-foreground border-b border-border/20 pb-2 last:border-0">
                                            <span className="font-medium w-1/2 text-left truncate pr-3">{tipoAnv}</span>
                                            <div className="flex w-1/2 justify-between gap-3">
                                              <span className="font-medium text-right w-1/2 whitespace-nowrap">{formatNumber(data.totalHV, 2)} HV</span>
                                              <span className="font-bold text-foreground text-right w-1/2 whitespace-nowrap">{formatCurrency(data.totalValor)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Indicador de impacto da OM no total geral */}
                <div className="p-8 pt-5 border-t border-border/30 bg-muted/20">
                    <div className="flex justify-between items-end mb-3">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">Impacto no Orçamento GND 3</span>
                        <span className="text-sm font-bold text-primary">{impactPercentage}%</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
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


const TabDetails = ({ mode, data }: TabDetailsProps) => {
    const valueClasses = "font-medium text-foreground text-right w-[6rem]"; 
    
    // Função auxiliar para obter dados de classe (funciona para OmTotals e PTrabAggregatedTotals)
    const getClassData = (key: 'classeII' | 'classeV' | 'classeVI' | 'classeVII' | 'classeVIII' | 'classeIX') => {
        if ((data as OmTotals).omKey) {
            return (data as OmTotals)[key];
        }
        // Mapeamento de chaves globais para o objeto de classe
        const globalKeyMap = {
            classeII: { total: (data as PTrabAggregatedTotals).totalClasseII, totalND30: (data as PTrabAggregatedTotals).totalClasseII_ND30, totalND39: (data as PTrabAggregatedTotals).totalClasseII_ND39, totalItens: (data as PTrabAggregatedTotals).totalItensClasseII, groupedCategories: (data as PTrabAggregatedTotals).groupedClasseIICategories },
            classeV: { total: (data as PTrabAggregatedTotals).totalClasseV, totalND30: (data as PTrabAggregatedTotals).totalClasseV_ND30, totalND39: (data as PTrabAggregatedTotals).totalClasseV_ND39, totalItens: (data as PTrabAggregatedTotals).totalItensClasseV, groupedCategories: (data as PTrabAggregatedTotals).groupedClasseVCategories },
            classeVI: { total: (data as PTrabAggregatedTotals).totalClasseVI, totalND30: (data as PTrabAggregatedTotals).totalClasseVI_ND30, totalND39: (data as PTrabAggregatedTotals).totalClasseVI_ND39, totalItens: (data as PTrabAggregatedTotals).totalItensClasseVI, groupedCategories: (data as PTrabAggregatedTotals).groupedClasseVICategories },
            classeVII: { total: (data as PTrabAggregatedTotals).totalClasseVII, totalND30: (data as PTrabAggregatedTotals).totalClasseVII_ND30, totalND39: (data as PTrabAggregatedTotals).totalClasseVII_ND39, totalItens: (data as PTrabAggregatedTotals).totalItensClasseVII, groupedCategories: (data as PTrabAggregatedTotals).groupedClasseVIICategories },
            classeVIII: { total: (data as PTrabAggregatedTotals).totalClasseVIII, totalND30: (data as PTrabAggregatedTotals).totalClasseVIII_ND30, totalND39: (data as PTrabAggregatedTotals).totalClasseVIII_ND39, totalItens: (data as PTrabAggregatedTotals).totalItensClasseVIII, groupedCategories: (data as PTrabAggregatedTotals).groupedClasseVIIICategories },
            classeIX: { total: (data as PTrabAggregatedTotals).totalClasseIX, totalND30: (data as PTrabAggregatedTotals).totalClasseIX_ND30, totalND39: (data as PTrabAggregatedTotals).totalClasseIX_ND39, totalItens: (data as PTrabAggregatedTotals).totalItensClasseIX, groupedCategories: (data as PTrabAggregatedTotals).groupedClasseIXCategories },
        };
        return globalKeyMap[key] as OmTotals['classeII'];
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
    
    const renderClassAccordion = (
        key: 'classeII' | 'classeV' | 'classeVI' | 'classeVII' | 'classeVIII' | 'classeIX', 
        title: string, 
        icon: React.ReactNode, 
        unitLabel: string,
        isRemonta: boolean = false
    ) => {
        const classData = getClassData(key);
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
        const classeI = getClasseIData(data);
        const total = classeI.total;
        
        if (total === 0 && classeI.totalRacoesOperacionaisGeral === 0) return null;
        
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
                                    <span className="w-1/4 text-right font-medium text-foreground">
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
        const classeIII = getClasseIIIData(data);
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
        const diarias = getDiariasData(data);
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
        const group = key === 'verbaOperacional' ? getVerbaOperacionalData(data) : getSuprimentoFundosData(data);
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
        const passagens = getPassagensData(data);
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
        const concessionaria = getConcessionariaData(data);
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
        const materialConsumo = getMaterialConsumoData(data);
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
            </div>
        );
    }
    
    if (mode === 'permanente') {
        const totalMaterialPermanente = (data as OmTotals).omKey ? (data as OmTotals).totalMaterialPermanente : (data as PTrabAggregatedTotals).totalMaterialPermanente;
        
        if (totalMaterialPermanente === 0) return null;
        
        return (
            <div className="space-y-3 border-l-4 border-green-500 pl-3 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-green-600 mb-2">
                    <div className="flex items-center gap-2">
                        <HardHat className="h-3 w-3" />
                        Material Permanente
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(totalMaterialPermanente)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="w-1/2 text-left">Itens de Material Permanente</span>
                    <span className="w-1/4 text-right font-medium">
                        {/* Vazio */}
                    </span>
                    <span className="w-1/4 text-right font-medium">
                        {formatCurrency(totalMaterialPermanente)}
                    </span>
                </div>
            </div>
        );
    }
    
    if (mode === 'avex') {
        const horasVoo = getHorasVooData(data);
        const totalAviacaoExercito = horasVoo.total;
        const quantidadeHorasVoo = horasVoo.quantidadeHV;
        const sortedHorasVoo = Object.entries(horasVoo.groupedHV).sort(([a], [b]) => a.localeCompare(b));
        
        if (totalAviacaoExercito === 0 && quantidadeHorasVoo === 0) return null;
        
        return (
            <div className="space-y-3 border-l-4 border-purple-500 pl-3 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-purple-600 mb-2">
                    <div className="flex items-center gap-2">
                        <Plane className="h-3 w-3" />
                        Aviação do Exército
                    </div>
                    <span className="font-bold text-sm">
                        {formatNumber(quantidadeHorasVoo, 2)} HV
                    </span>
                </div>
                
                {/* Detalhes por Tipo de Aeronave */}
                <div className="space-y-1 pl-4 text-[10px]">
                    {sortedHorasVoo.map(([tipoAnv, data]) => (
                        <div key={tipoAnv} className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">{tipoAnv}</span>
                            <span className="w-1/4 text-right font-medium text-background"></span>
                            <span className="w-1/4 text-right font-medium">
                                {formatNumber(data.totalHV, 2)} HV
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    
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
        totalHorasVoo: 0, totalHorasVooND30: 0, totalHorasVooND39: 0, quantidadeHorasVoo: 0, groupedHorasVoo: {},
        totalMaterialConsumo: 0, totalMaterialConsumoND30: 0, totalMaterialConsumoND39: 0,
        groupedByOm: {},
    },
  });
  
  const [viewMode, setViewMode] = useState<'global' | 'byOm'>('global');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOm, setSelectedOm] = useState<OmTotals | null>(null);
  
  const detailsRef = useRef<HTMLDivElement>(null);

  const sortedOmTotals = useMemo(() => {
      const omGroups = data?.groupedByOm || {}; 
      return Object.values(omGroups).sort((a, b) => b.totalGeral - a.totalGeral);
  }, [data?.groupedByOm]);

  const handleSummaryClick = () => {
    const newState = !isDetailsOpen;
    setIsDetailsOpen(newState);
    
    if (newState) {
      setTimeout(() => {
          detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); 
    }
  };
  
  const handleOmClick = (om: OmTotals) => {
      setSelectedOm(om);
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

  const renderGlobalDetails = () => (
    <div className="space-y-2" ref={detailsRef}>
        <TabDetails mode="logistica" data={totals} />
        <div className="pt-4">
            <TabDetails mode="operacional" data={totals} />
        </div>
        <div className="pt-4">
            <TabDetails mode="permanente" data={totals} />
        </div>
        <div className="pt-4">
            <TabDetails mode="avex" data={totals} />
        </div>
    </div>
  );
  
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
                  <span className="font-bold text-sm">
                    {formatNumber(totals.quantidadeHorasVoo, 2)} HV
                  </span>
                </div>
            </div>
          );
      } else {
          if (sortedOmTotals.length === 0) {
              return (
                  <div className="w-full space-y-1 text-sm px-6 pt-3 text-muted-foreground">
                      Nenhuma OM com custos registrados.
                  </div>
              );
          }
          
          const totalGND3 = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito;

          return (
              <div className="w-full space-y-1 text-sm px-6 pt-3">
                  {sortedOmTotals.map(om => {
                      const omGND3Total = om.totalLogistica + om.totalOperacional + om.totalAviacaoExercito;
                      const impactPercentage = totalGND3 > 0 ? ((omGND3Total / totalGND3) * 100).toFixed(1) : '0.0';
                      
                      return (
                          <div 
                              key={om.omKey} 
                              className="flex justify-between items-center text-foreground cursor-pointer p-1 rounded-md transition-colors hover:bg-muted/50" 
                              onClick={() => handleOmClick(om)}
                          >
                              <span className="font-semibold text-sm text-foreground">{om.omName}</span>
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground/80">({impactPercentage}%)</span>
                                  <span className="font-bold text-sm text-primary">{formatCurrency(om.totalGeral)}</span> 
                              </div>
                          </div>
                      );
                  })}
              </div>
          );
      }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2 pt-3">
        <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Visão consolidada dos custos logísticos e orçamentários.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-3">
        {renderCostSummary()}
        <Accordion 
          type="single" 
          collapsible 
          className="w-full px-6 pt-0"
          value={isDetailsOpen ? "summary-details" : undefined}
          onValueChange={(value) => {
              if (viewMode === 'global') {
                  setIsDetailsOpen(value === "summary-details");
              }
          }}
        >
          <AccordionItem value="summary-details" className="border-b-0">
            <AccordionTrigger 
              simple
              className="py-0 px-0 hover:no-underline flex items-center justify-between w-full text-xs text-muted-foreground border-t border-border/50"
              onClick={(e) => {
                e.preventDefault(); 
                if (viewMode === 'global') {
                    handleSummaryClick();
                }
              }}
            >
              <div className="flex justify-between items-center w-full py-2">
                <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground">Total Geral</span>
                    <Button
                        variant={viewMode === 'byOm' ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-[10px] px-2"
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
                        <span className="font-semibold text-primary flex items-center gap-1 text-xs lowercase">
                            {isDetailsOpen ? "menos detalhes" : "mais detalhes"}
                            <ChevronDown className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-200",
                              isDetailsOpen ? "rotate-180" : "rotate-0"
                            )} />
                        </span>
                    )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-0">
              {viewMode === 'global' && renderGlobalDetails()}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
      <OmDetailsDialog 
          om={selectedOm} 
          totals={totals} 
          onClose={() => setSelectedOm(null)} 
      />
    </Card>
  );
};

export { fetchPTrabTotals };