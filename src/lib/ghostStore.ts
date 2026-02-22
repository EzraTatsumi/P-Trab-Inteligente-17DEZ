"use client";

// Simulação de estado global para o tour (Ghost Mode)
export const isGhostMode = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('ghost_mode') === 'true';
};

export const setGhostMode = (active: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ghost_mode', active ? 'true' : 'false');
};

export const getActiveMission = () => {
  if (typeof window === 'undefined') return null;
  // Corrigido para bater com a chave usada no InstructionHub
  return localStorage.getItem('active_mission_id');
};

export const setActiveMission = (missionId: string | null) => {
  if (typeof window === 'undefined') return;
  if (missionId) {
    localStorage.setItem('active_mission_id', missionId);
  } else {
    localStorage.removeItem('active_mission_id');
  }
};

// Dados Mockados para o Tour
export const GHOST_DATA = {
  p_trab_exemplo: {
    id: 'ghost-ptrab-1',
    numero_ptrab: '001/2024',
    nome_operacao: 'Operação Escudo Norte',
    status: 'minuta',
    comando_militar_area: 'CMA',
    nome_om: '1º BIS',
    codug_om: '160222',
    periodo_inicio: '2024-01-01',
    periodo_fim: '2024-01-15',
    efetivo_empregado: '150',
  },
  oms_exemplo: [
    { id: 'om-1', nome_om: '1º BIS', codug_om: '160222', rm_vinculacao: '12ª RM', codug_rm_vinculacao: '160001', cidade: 'Manaus', ativo: true },
    { id: 'om-2', nome_om: '2º BFE', codug_om: '160333', rm_vinculacao: '12ª RM', codug_rm_vinculacao: '160001', cidade: 'Manaus', ativo: true },
  ],
  totais_exemplo: {
    totalLogistica: 12500.50,
    totalOperacional: 8400.00,
    totalMaterialPermanente: 0,
    quantidadeRacaoOp: 450,
    quantidadeHorasVoo: 12.5,
    credit_gnd3: 50000.00,
    credit_gnd4: 10000.00
  },
  // Mock para o Seletor de Itens (Missão 03)
  diretrizes_selector_mock: [
    {
      id: 'ghost-dir-24',
      nr_subitem: '24',
      nome_subitem: 'Material p/ Manutenção de Bens Imóveis/Instalação',
      descricao_subitem: 'Materiais para reparos e manutenção predial.',
      itens_aquisicao: [
        {
          id: 'ghost-item-cimento',
          descricao_item: 'Cimento Portland CP II-Z-32 Saco 50kg',
          descricao_reduzida: 'Cimento Portland',
          codigo_catmat: '150542',
          valor_unitario: 45.90,
          unidade_medida: 'Saco',
          numero_pregao: '10/2023',
          uasg: '160222',
          nd: '339030'
        }
      ]
    },
    {
      id: 'ghost-dir-07',
      nr_subitem: '07',
      nome_subitem: 'Gêneros de Alimentação',
      descricao_subitem: 'Itens de subsistência.',
      itens_aquisicao: []
    },
    {
      id: 'ghost-dir-16',
      nr_subitem: '16',
      nome_subitem: 'Material de Expediente',
      descricao_subitem: 'Papelaria e escritório.',
      itens_aquisicao: []
    }
  ]
};