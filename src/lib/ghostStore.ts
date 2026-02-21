/**
 * Dados simulados para o Modo Fantasma (Tour/Demonstração)
 */

export const GHOST_DATA = {
  p_trab_exemplo: {
    id: "ghost-ptrab-01",
    numero_ptrab: "Minuta 001/2026",
    comando_militar_area: "Comando Militar da Amazônia",
    nome_om: "Cia Com Sl",
    nome_om_extenso: "Companhia de Comunicações de Selva",
    codug_om: "160324",
    rm_vinculacao: "12ª RM",
    codug_rm_vinculacao: "160069",
    nome_operacao: "OPERAÇÃO SENTINELA DA SELVA",
    periodo_inicio: "2026-05-01",
    periodo_fim: "2026-05-15",
    efetivo_empregado: "45 militares",
    acoes: "Patrulhamento de fronteira e manutenção de repetidoras de rádio.",
    status: "aberto",
    origem: "original" as const,
    comentario: "Plano em fase final de revisão técnica.",
    rotulo_versao: "Versão Alpha",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: "ghost-user",
    share_token: "ghost-token",
    shared_with: []
  },
  totais_exemplo: {
    totalLogistica: 12500.50,
    totalOperacional: 8400.00,
    totalMaterialPermanente: 3200.00,
    quantidadeRacaoOp: 120,
    quantidadeHorasVoo: 5,
    credit_gnd3: 50000.00,
    credit_gnd4: 10000.00,
    totalLogisticoGeral: 12500.50,
    totalAviacaoExercito: 0,
    totalClasseI: 5000,
    totalClasseII: 2000,
    totalClasseV: 1000,
    totalCombustivel: 4000,
    totalLubrificanteValor: 500.50
  }
};

export const isGhostMode = () => {
  return localStorage.getItem('ghost_mode') === 'true';
};

export const setGhostMode = (active: boolean) => {
  localStorage.setItem('ghost_mode', active ? 'true' : 'false');
};