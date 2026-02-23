"use client";

export const GHOST_DATA = {
  // Missão 01 e 03: Dados do P Trab
  p_trab_exemplo: {
    id: "ghost-ptrab-123",
    numero_ptrab: "Minuta 001/2026",
    nome_operacao: "OPERAÇÃO SENTINELA",
    comando_militar_area: "Comando Militar do Leste",
    nome_om: "1º BIS",
    nome_om_extenso: "1º Batalhão de Infantaria de Selva",
    codug_om: "160222",
    rm_vinculacao: "12ª RM",
    codug_rm_vinculacao: "160060",
    periodo_inicio: "2026-03-01",
    periodo_fim: "2026-03-15",
    efetivo_empregado: "150 militares",
    acoes: "Patrulhamento de fronteira e reconnaissance de área.",
    status: "aberto",
    origem: "original",
    updated_at: new Date().toISOString(),
    user_id: "ghost-user",
    comentario: "P Trab em fase final de revisão técnica.",
  } as any,

  // Missão 02: Configuração de Diretrizes (Estado Inicial)
  missao_02: {
    subitens_lista: [
      {
        id: "ghost-subitem-22",
        nr_subitem: "22",
        nome_subitem: "Material de Limpeza",
        descricao_subitem: "Itens para higiene e conservação das instalações",
        ativo: true,
        itens_aquisicao: [
          {
            id: "ghost-item-detergente",
            descricao_item: "Detergente Líquido Neutro 500ml",
            descricao_reduzida: "Detergente Neutro 500ml",
            valor_unitario: 2.45,
            numero_pregao: "010/2025",
            uasg: "160222",
            codigo_catmat: "445566",
            quantidade: 0,
            valor_total: 0,
            nd: "30"
          }
        ]
      },
      {
        id: "ghost-subitem-16",
        nr_subitem: "16",
        nome_subitem: "Material de Expediente",
        descricao_subitem: "Suprimentos para atividades administrativas",
        ativo: true,
        itens_aquisicao: [
          {
            id: "ghost-item-papel",
            descricao_item: "Papel A4 Branco - Resma 500 folhas",
            descricao_reduzida: "Papel A4 Resma",
            valor_unitario: 28.90,
            numero_pregao: "005/2025",
            uasg: "160222",
            codigo_catmat: "150544",
            quantidade: 0,
            valor_total: 0,
            nd: "30"
          }
        ]
      }
    ],
    // Resultado da busca por UASG no PNCP (Simulação de Importação)
    arp_search_results: [
      {
        id: "ghost-compra-1",
        numeroAta: "05/2025",
        objeto: "Aquisição de materiais de construção civil para obras de engenharia.",
        uasg: "160222",
        omNome: "1º BIS",
        dataVigenciaInicial: "2025-01-01",
        dataVigenciaFinal: "2025-12-31",
        valorTotalEstimado: 150000.00,
        quantidadeItens: 12,
        pregaoFormatado: "000.005/25",
        numeroControlePncpAta: "160222-ARP-001-2025",
      }
    ],
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
        omNome: "1º BIS",
        dataVigenciaInicial: "2025-01-01",
        dataVigenciaFinal: "2025-12-31",
      }
    ]
  },

  // Missão 03: Dados para o formulário de P Trab (Já com o item criado na Missão 2)
  missao_03: {
    subitens_lista: [
      {
        id: "ghost-subitem-24",
        nr_subitem: "24",
        nome_subitem: "Material p/ Manutenção de Bens Imóveis/Instalação",
        descricao_subitem: "Materiais para reparos e conservação predial",
        ativo: true,
        itens_aquisicao: [
          {
            id: "ghost-item-cimento",
            descricao_item: "Cimento Portland CP II-Z-32, Resistência à Compressão 32 MPa, Saco 50kg",
            descricao_reduzida: "Cimento Portland 50kg",
            valor_unitario: 42.50,
            numero_pregao: "005/2025",
            uasg: "160222",
            codigo_catmat: "123456",
            quantidade: 0,
            valor_total: 0,
            nd: "30"
          }
        ]
      },
      {
        id: "ghost-subitem-22",
        nr_subitem: "22",
        nome_subitem: "Material de Limpeza",
        descricao_subitem: "Itens para higiene e conservação das instalações",
        ativo: true,
        itens_aquisicao: [
          {
            id: "ghost-item-detergente",
            descricao_item: "Detergente Líquido Neutro 500ml",
            descricao_reduzida: "Detergente Neutro 500ml",
            valor_unitario: 2.45,
            numero_pregao: "010/2025",
            uasg: "160222",
            codigo_catmat: "445566",
            quantidade: 0,
            valor_total: 0,
            nd: "30"
          }
        ]
      },
      {
        id: "ghost-subitem-16",
        nr_subitem: "16",
        nome_subitem: "Material de Expediente",
        descricao_subitem: "Suprimentos para atividades administrativas",
        ativo: true,
        itens_aquisicao: [
          {
            id: "ghost-item-papel",
            descricao_item: "Papel A4 Branco - Resma 500 folhas",
            descricao_reduzida: "Papel A4 Resma",
            valor_unitario: 28.90,
            numero_pregao: "005/2025",
            uasg: "160222",
            codigo_catmat: "150544",
            quantidade: 0,
            valor_total: 0,
            nd: "30"
          }
        ]
      }
    ]
  },

  // Missão 06: Dados detalhados para o Relatório
  missao_06: {
    material_consumo_registros: [
      {
        id: "ghost-reg-material-construcao",
        p_trab_id: "ghost-ptrab-123",
        organizacao: "1º BIS",
        ug: "160222",
        om_detentora: "1º BIS",
        ug_detentora: "160222",
        dias_operacao: 15,
        efetivo: 150,
        fase_atividade: "Execução",
        group_name: "Material de Construção",
        valor_total: 212.50,
        valor_nd_30: 212.50,
        valor_nd_39: 0,
        detalhamento_customizado: "33.90.30 - Aquisição de Material de Construção para atender 150 militares do 1º BIS, durante 15 dias de execucao.\n\nCálculo:\nFórmula: Qtd do item x Valor do item.\n- 5 Cimento Portland 50kg x R$ 42,50/unid. = R$ 212,50.\n\nTotal: R$ 212,50.\n(Pregão 5/2025 - UASG 160.222)",
        itens_aquisicao: [
          {
            id: "ghost-item-cimento",
            descricao_item: "Cimento Portland CP II-Z-32, Resistência à Compressão 32 MPa, Saco 50kg",
            descricao_reduzida: "Cimento Portland 50kg",
            valor_unitario: 42.50,
            numero_pregao: "005/2025",
            uasg: "160222",
            codigo_catmat: "123456",
            quantidade: 5,
            valor_total: 212.50,
            nd: "30"
          }
        ]
      }
    ],
    // Outras tabelas vazias para o mock
    diaria_registros: [],
    passagem_registros: [],
    verba_operacional_registros: [],
    concessionaria_registros: [],
    horas_voo_registros: [],
    material_permanente_registros: [],
    servicos_terceiros_registros: [],
    complemento_alimentacao_registros: [],
  },

  oms_exemplo: [
    { id: "om-1", nome_om: "1º BIS", codug_om: "160222", rm_vinculacao: "12ª RM", codug_rm_vinculacao: "160060", cidade: "Manaus/AM", ativo: true },
    { id: "om-2", nome_om: "2º BIS", codug_om: "160223", rm_vinculacao: "12ª RM", codug_rm_vinculacao: "160060", cidade: "Belém/PA", ativo: true },
    { id: "om-3", nome_om: "3º BIS", codug_om: "160224", rm_vinculacao: "12ª RM", codug_rm_vinculacao: "160060", cidade: "Marabá/PA", ativo: true },
  ],

  totais_exemplo: {
    totalLogisticoGeral: 45000.50,
    totalOperacional: 212.50, 
    totalMaterialPermanente: 8900.00,
    totalAviacaoExercito: 0,
    totalClasseI: 15000,
    totalClasseII: 5000,
    totalClasseV: 2000,
    totalCombustivel: 18000,
    totalLubrificanteValor: 5000.50,
    credit_gnd3: 150000.00,
    credit_gnd4: 50000.00,
    totalMaterialConsumo: 212.50,
    totalMaterialConsumoND30: 212.50,
    groupedMaterialConsumoCategories: {
      "Material de Construção": { totalValor: 212.50, totalND30: 212.50, totalND39: 0 }
    }
  } as any
};

export const isGhostMode = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('is_ghost_mode') === 'true';
};

export const getActiveMission = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('active_mission_id');
};