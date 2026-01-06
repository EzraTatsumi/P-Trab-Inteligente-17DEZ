import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Package, Fuel, Utensils, Loader2, ChevronDown, HardHat, Plane, TrendingUp, Droplet, ClipboardList, Swords, Radio, Activity, HeartPulse, Truck, Briefcase } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Define the category constants
const CATEGORIAS_CLASSE_II = ["Equipamento Individual", "Proteção Balística", "Material de Estacionamento"];
const CATEGORIAS_CLASSE_V = ["Armt L", "Armt P", "IODCT", "DQBRN"];
const CATEGORIAS_CLASSE_VI = ["Embarcação", "Equipamento de Engenharia"];
const CATEGORIAS_CLASSE_VII = ["Comunicações", "Informática"];
const CATEGORIAS_CLASSE_VIII = ["Saúde", "Remonta/Veterinária"];
const CATEGORIAS_CLASSE_IX = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"]; // NOVO

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
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

const fetchPTrabTotals = async (ptrabId: string) => {
  // 1. Fetch Classe I totals (33.90.30)
  const { data: classeIData, error: classeIError } = await supabase
    .from('classe_i_registros')
    .select('total_qs, total_qr, complemento_qs, etapa_qs, complemento_qr, etapa_qr, efetivo, dias_operacao, nr_ref_int, quantidade_r2, quantidade_r3, categoria')
    .eq('p_trab_id', ptrabId);

  if (classeIError) throw classeIError;

  let totalClasseI = 0;
  let totalComplemento = 0;
  let totalEtapaSolicitadaValor = 0;
  let totalDiasEtapaSolicitada = 0;
  let totalRefeicoesIntermediarias = 0;
  let totalRacoesOperacionaisGeral = 0;

  (classeIData || []).forEach(record => {
    if (record.categoria === 'RACAO_QUENTE') {
        // Garantir que todos os campos numéricos sejam tratados como números
        const totalQs = Number(record.total_qs || 0);
        const totalQr = Number(record.total_qr || 0);
        const complementoQs = Number(record.complemento_qs || 0);
        const etapaQs = Number(record.etapa_qs || 0);
        const complementoQr = Number(record.complemento_qr || 0);
        const etapaQr = Number(record.etapa_qr || 0);
        const efetivo = Number(record.efetivo || 0);
        const nrRefInt = Number(record.nr_ref_int || 0);
        const diasOperacao = Number(record.dias_operacao || 0);

        totalClasseI += totalQs + totalQr;
        totalComplemento += complementoQs + complementoQr;
        totalEtapaSolicitadaValor += etapaQs + etapaQr;
        
        const diasEtapaSolicitada = calculateDiasEtapaSolicitada(diasOperacao);
        totalDiasEtapaSolicitada += diasEtapaSolicitada;
        
        totalRefeicoesIntermediarias += efetivo * nrRefInt * diasOperacao;
    } else if (record.categoria === 'RACAO_OPERACIONAL') {
        totalRacoesOperacionaisGeral += Number(record.quantidade_r2 || 0) + Number(record.quantidade_r3 || 0);
    }
  });
  
  // 2. Fetch Classe II/V/VI/VII/VIII/IX records from their respective tables
  const [
    { data: classeIIData, error: classeIIError },
    { data: classeVData, error: classeVError },
    { data: classeVIData, error: classeVIError },
    { data: classeVIIData, error: classeVIIError },
    { data: classeVIIISaudeData, error: classeVIIISaudeError },
    { data: classeVIIIRemontaData, error: classeVIIIRemontaError },
    { data: classeIXData, error: classeIXError }, // NOVO
    { data: diariaData, error: diariaError }, // NOVO: Diárias
  ] = await Promise.all([
    supabase
      .from('classe_ii_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, categoria, valor_nd_30, valor_nd_39')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('classe_v_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, categoria, valor_nd_30, valor_nd_39')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('classe_vi_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, categoria, valor_nd_30, valor_nd_39')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('classe_vii_registros')
      .select('valor_total, itens_equipamentos, dias_operacao, organizacao, categoria, valor_nd_30, valor_nd_39')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('classe_viii_saude_registros')
      .select('valor_total, itens_saude, dias_operacao, organizacao, categoria, valor_nd_30, valor_nd_39')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('classe_viii_remonta_registros')
      .select('valor_total, itens_remonta, dias_operacao, organizacao, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('classe_ix_registros') // NOVO
      .select('valor_total, itens_motomecanizacao, dias_operacao, organizacao, categoria, valor_nd_30, valor_nd_39')
      .eq('p_trab_id', ptrabId),
    supabase
      .from('diaria_registros') // NOVO: Diárias
      .select('valor_total, valor_nd_15, valor_nd_30, quantidade, dias_operacao') // Buscando ND 15 e ND 30
      .eq('p_trab_id', ptrabId),
  ]);

  if (classeIIError) throw classeIIError;
  if (classeVError) throw classeVError;
  if (classeVIError) throw classeVIError;
  if (classeVIIError) throw classeVIIError;
  if (classeVIIISaudeError) console.error("Erro ao carregar Classe VIII Saúde:", classeVIIISaudeError);
  if (classeVIIIRemontaError) console.error("Erro ao carregar Classe VIII Remonta:", classeVIIIRemontaError);
  if (classeIXError) console.error("Erro ao carregar Classe IX:", classeIXError); // NOVO
  if (diariaError) console.error("Erro ao carregar Diárias:", diariaError); // NOVO
  
  const allClasseItemsData = [
    ...(classeIIData || []),
    ...(classeVData || []),
    ...(classeVIData || []),
    ...(classeVIIData || []),
    ...(classeVIIISaudeData || []).map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde' })),
    ...(classeVIIIRemontaData || []).map(r => ({ 
        ...r, 
        itens_equipamentos: r.itens_remonta, 
        categoria: 'Remonta/Veterinária',
        animal_tipo: r.animal_tipo,
        quantidade_animais: r.quantidade_animais,
    })),
    ...(classeIXData || []).map(r => ({ // NOVO
        ...r, 
        itens_equipamentos: r.itens_motomecanizacao, 
        categoria: r.categoria,
    })),
  ];
  
  let totalClasseII = 0;
  let totalClasseII_ND30 = 0;
  let totalClasseII_ND39 = 0;
  let totalItensClasseII = 0;
  const groupedClasseIICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> = {};

  let totalClasseV = 0;
  let totalClasseV_ND30 = 0;
  let totalClasseV_ND39 = 0;
  let totalItensClasseV = 0;
  const groupedClasseVCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> = {};
  
  let totalClasseVI = 0;
  let totalClasseVI_ND30 = 0;
  let totalClasseVI_ND39 = 0;
  let totalItensClasseVI = 0;
  const groupedClasseVICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> = {};
  
  let totalClasseVII = 0;
  let totalClasseVII_ND30 = 0;
  let totalClasseVII_ND39 = 0;
  let totalItensClasseVII = 0;
  const groupedClasseVIICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> = {};
  
  let totalClasseVIII = 0;
  let totalClasseVIII_ND30 = 0;
  let totalClasseVIII_ND39 = 0;
  let totalItensClasseVIII = 0;
  const groupedClasseVIIICategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> = {};
  
  let totalClasseIX = 0; // NOVO
  let totalClasseIX_ND30 = 0; // NOVO
  let totalClasseIX_ND39 = 0; // NOVO
  let totalItensClasseIX = 0; // NOVO
  const groupedClasseIXCategories: Record<string, { totalValor: number, totalND30: number, totalND39: number, totalItens: number }> = {}; // NOVO
  
  (allClasseItemsData || []).forEach(record => {
    const category = record.categoria;
    const items = (record.itens_equipamentos || []) as ItemClasseII[];
    // Garante que a quantidade de itens é numérica
    const totalItemsCategory = items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0); 
    
    // Garante que valor_total é numérico
    const valorTotal = Number(record.valor_total || 0);
    const valorND30 = Number(record.valor_nd_30 || 0);
    const valorND39 = Number(record.valor_nd_39 || 0);

    if (CATEGORIAS_CLASSE_II.includes(category)) {
        // CLASSE II
        totalClasseII += valorTotal;
        totalClasseII_ND30 += valorND30;
        totalClasseII_ND39 += valorND39;
        totalItensClasseII += totalItemsCategory;
        
        if (!groupedClasseIICategories[category]) {
            groupedClasseIICategories[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        groupedClasseIICategories[category].totalValor += valorTotal;
        groupedClasseIICategories[category].totalND30 += valorND30;
        groupedClasseIICategories[category].totalND39 += valorND39;
        groupedClasseIICategories[category].totalItens += totalItemsCategory;

    } else if (CATEGORIAS_CLASSE_V.includes(category)) {
        // CLASSE V
        totalClasseV += valorTotal;
        totalClasseV_ND30 += valorND30;
        totalClasseV_ND39 += valorND39;
        totalItensClasseV += totalItemsCategory;

        if (!groupedClasseVCategories[category]) {
            groupedClasseVCategories[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        groupedClasseVCategories[category].totalValor += valorTotal;
        groupedClasseVCategories[category].totalND30 += valorND30;
        groupedClasseVCategories[category].totalND39 += valorND39;
        groupedClasseVCategories[category].totalItens += totalItemsCategory;
    } else if (CATEGORIAS_CLASSE_VI.includes(category)) {
        // CLASSE VI
        totalClasseVI += valorTotal;
        totalClasseVI_ND30 += valorND30;
        totalClasseVI_ND39 += valorND39;
        totalItensClasseVI += totalItemsCategory;

        if (!groupedClasseVICategories[category]) {
            groupedClasseVICategories[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        groupedClasseVICategories[category].totalValor += valorTotal;
        groupedClasseVICategories[category].totalND30 += valorND30;
        groupedClasseVICategories[category].totalND39 += valorND39;
        groupedClasseVICategories[category].totalItens += totalItemsCategory;
    } else if (CATEGORIAS_CLASSE_VII.includes(category)) {
        // CLASSE VII
        totalClasseVII += valorTotal;
        totalClasseVII_ND30 += valorND30;
        totalClasseVII_ND39 += valorND39;
        totalItensClasseVII += totalItemsCategory;

        if (!groupedClasseVIICategories[category]) {
            groupedClasseVIICategories[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        groupedClasseVIICategories[category].totalValor += valorTotal;
        groupedClasseVIICategories[category].totalND30 += valorND30;
        groupedClasseVIICategories[category].totalND39 += valorND39;
        groupedClasseVIICategories[category].totalItens += totalItemsCategory;
    } else if (CATEGORIAS_CLASSE_VIII.includes(category)) {
        // CLASSE VIII
        totalClasseVIII += valorTotal;
        totalClasseVIII_ND30 += valorND30;
        totalClasseVIII_ND39 += valorND39;
        
        let groupKey = category;
        let currentTotalItems = totalItemsCategory;
        
        if (category === 'Remonta/Veterinária') {
            const animalType = (record as any).animal_tipo;
            const quantidadeAnimais = Number((record as any).quantidade_animais || 0);
            
            if (animalType) {
                groupKey = `Remonta - ${animalType}`;
                currentTotalItems = quantidadeAnimais;
            }
        }
        
        if (category === 'Saúde') {
            groupKey = 'Saúde';
        }
        
        totalItensClasseVIII += currentTotalItems;

        if (!groupedClasseVIIICategories[groupKey]) {
            groupedClasseVIIICategories[groupKey] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        groupedClasseVIIICategories[groupKey].totalValor += valorTotal;
        groupedClasseVIIICategories[groupKey].totalND30 += valorND30;
        groupedClasseVIIICategories[groupKey].totalND39 += valorND39;
        groupedClasseVIIICategories[groupKey].totalItens += currentTotalItems;
    } else if (CATEGORIAS_CLASSE_IX.includes(category)) { // NOVO
        // CLASSE IX
        totalClasseIX += valorTotal;
        totalClasseIX_ND30 += valorND30;
        totalClasseIX_ND39 += valorND39;
        totalItensClasseIX += totalItemsCategory;

        if (!groupedClasseIXCategories[category]) {
            groupedClasseIXCategories[category] = { totalValor: 0, totalND30: 0, totalND39: 0, totalItens: 0 };
        }
        groupedClasseIXCategories[category].totalValor += valorTotal;
        groupedClasseIXCategories[category].totalND30 += valorND30;
        groupedClasseIXCategories[category].totalND39 += valorND39;
        groupedClasseIXCategories[category].totalItens += totalItemsCategory;
    }
  });
  
  // 3. Fetch Classe III totals (Combustível e Lubrificante)
  const { data: classeIIIData, error: classeIIIError } = await supabase
    .from('classe_iii_registros')
    .select('valor_total, tipo_combustivel, total_litros, tipo_equipamento')
    .eq('p_trab_id', ptrabId);

  if (classeIIIError) throw classeIIIError;

  // Combustível (ND 33.90.30) - FIX: Filter out LUBRIFICANTE_CONSOLIDADO
  const combustivelRecords = (classeIIIData || []).filter(r => 
    r.tipo_equipamento !== 'LUBRIFICANTE_CONSOLIDADO'
  );
  
  // Lubrificante (ND 33.90.30) - FIX: Filter only LUBRIFICANTE_CONSOLIDADO
  const lubrificanteRecords = (classeIIIData || []).filter(r => 
    r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO'
  );

  // Totais de Combustível (ND 33.90.30)
  const totalDieselValor = combustivelRecords
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + Number(record.valor_total || 0), 0);
    
  const totalGasolinaValor = combustivelRecords
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + Number(record.valor_total || 0), 0);
    
  const totalDieselLitros = combustivelRecords
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + Number(record.total_litros || 0), 0);
    
  const totalGasolinaLitros = combustivelRecords
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + Number(record.total_litros || 0), 0);

  const totalCombustivel = totalDieselValor + totalGasolinaValor;
  
  // Totais de Lubrificante (ND 33.90.30)
  const totalLubrificanteValor = lubrificanteRecords
    .reduce((sum, record) => sum + Number(record.valor_total || 0), 0);
    
  const totalLubrificanteLitros = lubrificanteRecords
    .reduce((sum, record) => sum + Number(record.total_litros || 0), 0);
    
  // 4. Processamento de Diárias (ND 33.90.15)
  let totalDiariasND15 = 0; // Taxa de Embarque
  let totalDiariasND30 = 0; // Diárias (valor principal)
  let totalMilitaresDiarias = 0;
  let totalDiasViagem = 0; // Novo total

  if (!diariaError) {
      (diariaData || []).forEach(record => {
          // ND 15 é a Taxa de Embarque
          totalDiariasND15 += Number(record.valor_nd_15 || 0);
          // ND 30 é o valor da Diária Base
          totalDiariasND30 += Number(record.valor_nd_30 || 0);
          totalMilitaresDiarias += Number(record.quantidade || 0);
          // O total de dias de viagem é a soma dos dias_operacao de cada registro
          totalDiasViagem += Number(record.dias_operacao || 0);
      });
  }
  
  // O total da Diária (ND 33.90.15) é a soma das duas subdivisões
  const totalDiarias = totalDiariasND15 + totalDiariasND30; 
    
  // O total logístico para o PTrab é a soma da Classe I (ND 30) + Classes (ND 30 + ND 39) + Classe III (Combustível + Lubrificante)
  const totalLogisticoGeral = totalClasseI + totalClasseII + totalClasseV + totalClasseVI + totalClasseVII + totalClasseVIII + totalClasseIX + totalCombustivel + totalLubrificanteValor;
  
  // Total Operacional (Diárias + Outros Operacionais)
  const totalOutrosOperacionais = 0; // Placeholder para outros itens operacionais
  const totalOperacional = totalDiarias + totalOutrosOperacionais;
  
  // Novos totais (placeholders)
  const totalMaterialPermanente = 0;
  const totalAviacaoExercito = 0;
  
  return {
    totalLogisticoGeral,
    totalOperacional,
    totalClasseI,
    totalClasseII,
    totalClasseII_ND30,
    totalClasseII_ND39,
    totalItensClasseII,
    groupedClasseIICategories,
    
    totalClasseV,
    totalClasseV_ND30,
    totalClasseV_ND39,
    totalItensClasseV,
    groupedClasseVCategories,
    
    totalClasseVI,
    totalClasseVI_ND30,
    totalClasseVI_ND39,
    totalItensClasseVI,
    groupedClasseVICategories,
    
    totalClasseVII,
    totalClasseVII_ND30,
    totalClasseVII_ND39,
    totalItensClasseVII,
    groupedClasseVIICategories,
    
    totalClasseVIII,
    totalClasseVIII_ND30,
    totalClasseVIII_ND39,
    totalItensClasseVIII,
    groupedClasseVIIICategories,
    
    totalClasseIX, // NOVO
    totalClasseIX_ND30, // NOVO
    totalClasseIX_ND39, // NOVO
    totalItensClasseIX, // NOVO
    groupedClasseIXCategories, // NOVO
    
    totalComplemento,
    totalEtapaSolicitadaValor,
    totalDiasEtapaSolicitada,
    totalRefeicoesIntermediarias,
    totalDieselValor,
    totalGasolinaValor,
    totalDieselLitros,
    totalGasolinaLitros,
    totalLubrificanteValor,
    totalLubrificanteLitros, // Incluído no retorno
    totalCombustivel,
    totalMaterialPermanente,
    totalAviacaoExercito,
    totalRacoesOperacionaisGeral, // NOVO: Retorna o total de rações operacionais
    
    // NOVO: Diárias
    totalDiarias,
    totalDiariasND15, // Taxa de Embarque
    totalDiariasND30, // Diárias (valor principal)
    totalMilitaresDiarias,
    totalDiasViagem, // Novo: Total de dias de viagem
  };
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000,
    initialData: {
      totalLogisticoGeral: 0,
      totalOperacional: 0,
      totalClasseI: 0,
      totalClasseII: 0,
      totalClasseII_ND30: 0,
      totalClasseII_ND39: 0,
      totalItensClasseII: 0,
      groupedClasseIICategories: {},
      totalClasseV: 0,
      totalClasseV_ND30: 0,
      totalClasseV_ND39: 0,
      totalItensClasseV: 0,
      groupedClasseVCategories: {},
      totalClasseVI: 0,
      totalClasseVI_ND30: 0,
      totalClasseVI_ND39: 0,
      totalItensClasseVI: 0,
      groupedClasseVICategories: {},
      totalClasseVII: 0,
      totalClasseVII_ND30: 0,
      totalClasseVII_ND39: 0,
      groupedClasseVIICategories: {},
      totalItensClasseVII: 0,
      totalClasseVIII: 0,
      totalClasseVIII_ND30: 0,
      totalClasseVIII_ND39: 0,
      groupedClasseVIIICategories: {},
      totalItensClasseVIII: 0,
      totalClasseIX: 0, // NOVO
      totalClasseIX_ND30: 0, // NOVO
      totalClasseIX_ND39: 0, // NOVO
      totalItensClasseIX: 0, // NOVO
      groupedClasseIXCategories: {}, // NOVO
      totalComplemento: 0,
      totalEtapaSolicitadaValor: 0,
      totalDiasEtapaSolicitada: 0,
      totalRefeicoesIntermediarias: 0,
      totalDieselValor: 0,
      totalGasolinaValor: 0,
      totalDieselLitros: 0,
      totalGasolinaLitros: 0,
      totalLubrificanteValor: 0,
      totalLubrificanteLitros: 0, // Adicionado ao initialData
      totalCombustivel: 0,
      totalMaterialPermanente: 0,
      totalAviacaoExercito: 0,
      totalRacoesOperacionaisGeral: 0, // NOVO: Adiciona ao initialData
      // NOVO: Diárias
      totalDiarias: 0,
      totalDiariasND15: 0, // Taxa de Embarque
      totalDiariasND30: 0, // Diárias (valor principal)
      totalMilitaresDiarias: 0,
      totalDiasViagem: 0, // Novo: Total de dias de viagem
    },
  });
  
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
  
  // FIX: Add nullish coalescing operator (?? {}) to ensure Object.entries receives an object
  const sortedClasseIICategories = Object.entries(totals.groupedClasseIICategories ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const sortedClasseVCategories = Object.entries(totals.groupedClasseVCategories ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const sortedClasseVICategories = Object.entries(totals.groupedClasseVICategories ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const sortedClasseVIICategories = Object.entries(totals.groupedClasseVIICategories ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const sortedClasseVIIICategories = Object.entries(totals.groupedClasseVIIICategories ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const sortedClasseIXCategories = Object.entries(totals.groupedClasseIXCategories ?? {}).sort(([a], [b]) => a.localeCompare(b)); // NOVO

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        <CardDescription className="text-xs">
          Visão consolidada dos custos logísticos e orçamentários.
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
              <span className="font-bold text-sm">{formatCurrency(totals.totalAviacaoExercito)}</span>
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
              <div className="space-y-2" ref={detailsRef}>
                
                {/* Aba Logística */}
                <div className="space-y-3 border-l-4 border-orange-500 pl-3">
                  {/* Div 602 Modificado */}
                  <div className="flex items-center justify-between text-xs font-semibold text-orange-600 mb-2">
                    <div className="flex items-center gap-2">
                        <Package className="h-3 w-3" />
                        Logística
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(totals.totalLogisticoGeral)}</span>
                  </div>
                  
                  {/* Classe I - Subsistência */}
                  <Accordion type="single" collapsible className="w-full pt-0">
                    <AccordionItem value="item-classe-i" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Utensils className="h-3 w-3 text-orange-500" />
                            Classe I
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseI)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhe 1: Valor Complemento */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">Complemento (Ref. Int.)</span>
                            <span className="w-1/4 text-right font-medium">
                              {formatNumber(totals.totalRefeicoesIntermediarias)}
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {formatCurrency(totals.totalComplemento)}
                            </span>
                          </div>
                          {/* Detalhe 2: Valor Etapa Solicitada */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">Etapa Solicitada</span>
                            <span className="w-1/4 text-right font-medium">
                              {formatNumber(totals.totalDiasEtapaSolicitada)} dias
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {formatCurrency(totals.totalEtapaSolicitadaValor)}
                            </span>
                          </div>
                          {/* Detalhe 3: Ração Operacional (Movido para debaixo da Etapa Solicitada) */}
                          {totals.totalRacoesOperacionaisGeral > 0 && (
                            <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                <span className="w-1/2 text-left text-muted-foreground">Ração Operacional (R2/R3)</span>
                                <span className="w-1/4 text-right font-medium">
                                    {formatNumber(totals.totalRacoesOperacionaisGeral)} un.
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
                  
                  {/* Classe II - Material de Intendência */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-ii" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <ClipboardList className="h-3 w-3 text-orange-500" />
                            Classe II
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseII)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhes por Categoria */}
                          {sortedClasseIICategories.map(([category, data]) => (
                            <div key={category} className="space-y-1">
                                <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                    <span className="w-1/2 text-left">{category}</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(data.totalItens)} un.
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

                  {/* Classe III - Combustíveis e Lubrificantes */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-iii" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Fuel className="h-3 w-3 text-orange-500" />
                            Classe III
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalCombustivel + totals.totalLubrificanteValor)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Linha Óleo Diesel */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">Óleo Diesel</span>
                            <span className="w-1/4 text-right font-medium">
                              {formatNumber(totals.totalDieselLitros)} L
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {formatCurrency(totals.totalDieselValor)}
                            </span>
                          </div>
                          {/* Linha Gasolina */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">Gasolina</span>
                            <span className="w-1/4 text-right font-medium">
                              {formatNumber(totals.totalGasolinaLitros)} L
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {formatCurrency(totals.totalGasolinaValor)}
                            </span>
                          </div>
                          {/* Linha Lubrificante */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">
                                Lubrificante
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {/* Corrigido: totalLubrificanteLitros agora é garantido como número */}
                              {formatNumber(Number(totals.totalLubrificanteLitros) || 0, 2)} L
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {formatCurrency(totals.totalLubrificanteValor)}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Classe V - Armamento */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-v" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Swords className="h-3 w-3 text-orange-500" />
                            Classe V
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseV)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhes por Categoria */}
                          {sortedClasseVCategories.map(([category, data]) => (
                            <div key={category} className="space-y-1">
                                <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                    <span className="w-1/2 text-left">{category}</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(data.totalItens)} un.
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
                  
                  {/* Classe VI - Material de Engenharia */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-vi" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <HardHat className="h-3 w-3 text-orange-500" />
                            Classe VI
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseVI)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhes por Categoria */}
                          {sortedClasseVICategories.map(([category, data]) => (
                            <div key={category} className="space-y-1">
                                <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                    <span className="w-1/2 text-left">{category}</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(data.totalItens)} un.
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
                  
                  {/* Classe VII - Comunicações e Informática */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-vii" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Radio className="h-3 w-3 text-orange-500" />
                            Classe VII
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseVII)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhes por Categoria */}
                          {sortedClasseVIICategories.map(([category, data]) => (
                            <div key={category} className="space-y-1">
                                <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                    <span className="w-1/2 text-left">{category}</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(data.totalItens)} un.
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
                  
                  {/* Classe VIII - Saúde e Remonta/Veterinária */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-viii" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <HeartPulse className="h-3 w-3 text-orange-500" />
                            Classe VIII
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseVIII)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhes por Categoria */}
                          {sortedClasseVIIICategories.map(([category, data]) => (
                            <div key={category} className="space-y-1">
                                <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                    <span className="w-1/2 text-left">{category}</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {/* Se for Remonta, exibe a quantidade de animais */}
                                        {category.includes('Remonta') ? `${formatNumber(data.totalItens)} animais` : `${formatNumber(data.totalItens)} un.`}
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
                  
                  {/* NOVO: Classe IX - Motomecanização */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-ix" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Truck className="h-3 w-3 text-orange-500" />
                            Classe IX
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalClasseIX)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhes por Categoria */}
                          {sortedClasseIXCategories.map(([category, data]) => (
                            <div key={category} className="space-y-1">
                                <div className="flex justify-between text-muted-foreground font-semibold pt-1">
                                    <span className="w-1/2 text-left">{category}</span>
                                    <span className="w-1/4 text-right font-medium">
                                        {formatNumber(data.totalItens)} vtr
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
                  
                  {/* Outras Abas Logísticas (Placeholder) */}
                  {/* REMOVIDO: Não haverá valores para Classes IV e X */}
                </div>

                {/* Aba Operacional (NOVO: Incluindo Diárias) */}
                <div className="space-y-3 border-l-4 border-blue-500 pl-3 pt-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-600 mb-2">
                    <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        Operacional
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(totals.totalOperacional)}</span>
                  </div>
                  
                  {/* Diárias (ND 33.90.15) */}
                  <Accordion type="single" collapsible className="w-full pt-0">
                    <AccordionItem value="item-diarias" className="border-b-0">
                      <AccordionTrigger className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Briefcase className="h-3 w-3 text-blue-500" />
                            Diárias
                          </div>
                          <span className={cn(valueClasses, "text-xs flex items-center gap-1 mr-6")}>
                            {formatCurrency(totals.totalDiarias)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhe 1: Total de Militares */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">Total de Militares</span>
                            <span className="w-1/4 text-right font-medium">
                              {formatNumber(totals.totalMilitaresDiarias)}
                            </span>
                            <span className="w-1/4 text-right font-medium text-background">
                                {formatCurrency(0)}
                            </span>
                          </div>
                          {/* Detalhe 2: Total de Dias de Viagem */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">Total de Dias de Viagem</span>
                            <span className="w-1/4 text-right font-medium">
                              {formatNumber(totals.totalDiasViagem)} dias
                            </span>
                            <span className="w-1/4 text-right font-medium text-background">
                                {formatCurrency(0)}
                            </span>
                          </div>
                          {/* Detalhe 3: Taxa de Embarque / Diárias (ND 15) */}
                          <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 mt-1">
                            <span className="w-1/2 text-left font-semibold">Taxa de Embarque / Diárias (ND 15)</span>
                            <span className="w-1/4 text-right font-medium text-green-600">
                                {formatCurrency(totals.totalDiariasND15)}
                            </span>
                            <span className="w-1/4 text-right font-medium text-blue-600">
                                {formatCurrency(totals.totalDiariasND30)}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Outros Operacionais (Placeholder) */}
                  {totals.totalOperacional - totals.totalDiarias > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50 mt-1">
                        <span className="w-1/2 text-left">Outros Itens Operacionais</span>
                        <span className="w-1/4 text-right font-medium">
                            {/* Vazio */}
                        </span>
                        <span className="w-1/4 text-right font-medium">
                            {formatCurrency(totals.totalOperacional - totals.totalDiarias)}
                        </span>
                    </div>
                  )}
                </div>
                
                {/* Aba Material Permanente (Placeholder) */}
                <div className="space-y-3 border-l-4 border-green-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                    <HardHat className="h-3 w-3" />
                    Material Permanente ({formatCurrency(totals.totalMaterialPermanente)})
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="w-1/2 text-left">Itens de Material Permanente</span>
                    <span className="w-1/4 text-right font-medium">
                      {/* Vazio */}
                    </span>
                    <span className="w-1/4 text-right font-medium">
                      {formatCurrency(totals.totalMaterialPermanente)}
                    </span>
                  </div>
                </div>
                
                {/* Aba Aviação do Exército (Placeholder) */}
                <div className="space-y-3 border-l-4 border-purple-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-600">
                    <Plane className="h-3 w-3" />
                    Aviação do Exército ({formatCurrency(totals.totalAviacaoExercito)})
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="w-1/2 text-left">Itens de Aviação</span>
                    <span className="w-1/4 text-right font-medium">
                      {/* Vazio */}
                    </span>
                    <span className="w-1/4 text-right font-medium">
                      {formatCurrency(totals.totalAviacaoExercito)}
                    </span>
                  </div>
                </div>
                
              </div>
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