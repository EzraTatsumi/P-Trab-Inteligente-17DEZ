"use client";

export const GHOST_DATA = {
  // Missão 01 e 03: Dados do P Trab
  p_trab_exemplo: {
    id: "ghost-ptrab-123",
    numero_ptrab: "Minuta 001/2026",
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
    comentario: "P Trab em fase final de revisão técnica.",
  } as any,

  // Missão 02: Dados de Diretrizes e PNCP
  missao_02: {
    subitens_lista: [
      {
        id: "ghost-subitem-22",
        nr_subitem: "22",
        nome_subitem: "Material de Limpeza",
        descricao_subitem: "Itens para higiene e conservação",
        itens_aquisicao: [
          {
            id: "ghost-item-detergente",
            descricao_item: "Detergente Líquido Neutro 500ml",
            valor_unitario: 2.45,
            numero_pregao: "010/2025",
            uasg: "160222",
            codigo_catmat: "445566"
          }
        ]
      },
      {
        id: "ghost-subitem-07",
        nr_subitem: "07",
        nome_subitem: "Gêneros de Alimentação",
        descricao_subitem: "Itens para subsistência",
        itens_aquisicao: [
          {
            id: "ghost-item-arroz",
            descricao_item: "Arroz Agulhinha Tipo 1 - Pacote 5kg",
            valor_unitario: 28.90,
            numero_pregao: "005/2025",
            uasg: "160222",
            codigo_catmat: "150544"
          }
        ]
      }
    ],
    // Resultado da busca por UASG no PNCP
    arp_search_results: [
      {
        id: "ghost-compra-1",
        numeroAta: "05/2025",
        objeto: "Aquisição de materiais de construção civil para obras de engenharia.",
        uasg: "160222",
        omNome: "1º Batalhão de Engenharia de Construção",
        dataVigenciaInicial: "2025-01-01",
        dataVigenciaFinal: "2025-12-31",
        valorTotalEstimado: 150000.00,
        quantidadeItens: 12,
        pregaoFormatado: "000.005/25",
        numeroControlePncpAta: "160222-ARP-001-2025",
      }
    ],
    // Itens detalhados da ARP
    arp_detailed_items: [
      {
        id: "ghost-item-cimento",
        numeroAta: "05/2025",
        codigoItem: "123456",
        descricaoItem: "Cimento Portland CP II-Z-32, Resistência à Compressão 32 MPa, Saco 50kg",
        valorUnitario: 42.50,
        quantidadeHomologada: 5000,
        numeroControlePncpAta: "160222-ARP-001-2025",
        pregaoFormatado: "000.005/25",
        uasg: "160222",
        omNome: "1º Batalhão de Engenharia de Construção",
        dataVigenciaInicial: "2025-01-01",
        dataVigenciaFinal: "2025-12-31",
      }
    ],
    item_cimento: {
      id: "ghost-item-cimento",
      codigo_catmat: "123456",
      descricao_item: "Cimento Portland CP II-Z-32, Resistência à Compressão 32 MPa, Saco 50kg",
      descricao_reduzida: "Cimento Portland 50kg",
      unidade_medida: "Saco",
      valor_unitario: 42.50,
      numero_pregao: "005/2025",
      uasg: "160222",
      nd: "30",
    }
  },

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