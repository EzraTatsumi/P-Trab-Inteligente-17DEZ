"use client";

import { PTrabData } from "./ptrabUtils";

export const GHOST_DATA = {
  // Missão 01 e 03: Dados do P Trab
  p_trab_exemplo: {
    id: "ghost-ptrab-123",
    numero_ptrab: "001/2026 - SIMULAÇÃO",
    nome_operacao: "OPERAÇÃO SENTINELA",
    comando_militar_area: "Comando Militar do Leste",
    nome_om: "1º Btl Inf Selva",
    nome_om_extenso: "1º Batalhão de Infantaria de Selva",
    codug_om: "160222",
    rm_vinculacao: "12ª RM",
    codug_rm_vinculacao: "160060",
    periodo_inicio: "2026-03-01",
    periodo_fim: "2026-03-15",
    efetivo_empregado: "150 militares",
    acoes: "Patrulhamento de fronteira e reconhecimento de área.",
    status: "aberto",
    origem: "original",
    updated_at: new Date().toISOString(),
    user_id: "ghost-user",
  } as any,

  // Missão 02: Item do PNCP (Material de Construção)
  item_pncp_exemplo: {
    id: "ghost-item-999",
    codigo_catmat: "123456",
    descricao_item: "Cimento Portland CP II-Z-32, saco com 50kg",
    nome_reduzido: "Cimento Portland 50kg",
    unidade_medida: "Saco",
    valor_unitario: 42.50,
    numero_pregao: "001/2025",
    uasg: "160222",
    nd: "30",
  },

  // Missão 04: Totais para o Resumo de Custos
  totais_exemplo: {
    totalLogistica: 45000.50,
    totalOperacional: 12500.00,
    totalMaterialPermanente: 8900.00,
    quantidadeRacaoOp: 450,
    quantidadeHorasVoo: 12,
    credit_gnd3: 150000.00,
    credit_gnd4: 50000.00,
  }
};

export const isGhostMode = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('is_ghost_mode') === 'true';
};

export const getActiveMission = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('active_mission_id');
};