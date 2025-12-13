import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";
import { DiretrizClasseIXForm } from "@/types/diretrizesClasseIX";

// --- CLASSE III EQUIPMENT FALLBACKS ---
export interface TipoEquipamentoDetalhado {
  nome: string;
  combustivel: 'GAS' | 'OD';
  consumo: number;
  unidade: 'L/h' | 'km/L';
}

export const grupoGeradores: TipoEquipamentoDetalhado[] = [
  { nome: "Gerador até 15 kva GAS", combustivel: "GAS", consumo: 1.25, unidade: "L/h" },
  { nome: "Gerador até 15 kva OD", combustivel: "OD", consumo: 4.0, unidade: "L/h" },
  { nome: "Gerador acima de 50 kva", combustivel: "OD", consumo: 20.0, unidade: "L/h" },
];

export const tipoEmbarcacoes: TipoEquipamentoDetalhado[] = [
  { nome: "Motor de popa", combustivel: "GAS", consumo: 20, unidade: "L/h" },
  { nome: "Emb Guardian 25", combustivel: "GAS", consumo: 100, unidade: "L/h" },
  { nome: "Ferryboat", combustivel: "OD", consumo: 100, unidade: "L/h" },
  { nome: "Emb Regional", combustivel: "OD", consumo: 50, unidade: "L/h" },
  { nome: "Empurradores", combustivel: "OD", consumo: 80, unidade: "L/h" },
  { nome: "Emb Manobra", combustivel: "OD", consumo: 30, unidade: "L/h" },
];

export const tipoEquipamentosEngenharia: TipoEquipamentoDetalhado[] = [
  { nome: "Retroescavadeira", combustivel: "OD", consumo: 7, unidade: "L/h" },
  { nome: "Carregadeira sobre rodas", combustivel: "OD", consumo: 16, unidade: "L/h" },
  { nome: "Motoniveladora", combustivel: "OD", consumo: 18, unidade: "L/h" },
];

export const tipoViaturas: TipoEquipamentoDetalhado[] = [
  { nome: "Vtr Adm Pqn Porte - Adm Pqn", combustivel: "GAS", consumo: 8, unidade: "km/L" },
  { nome: "Vtr Adm Pqn Porte - Pick-up", combustivel: "OD", consumo: 7, unidade: "km/L" },
  { nome: "Vtr Adm Pqn Porte - Van/Micro", combustivel: "OD", consumo: 6, unidade: "km/L" },
  { nome: "Vtr Adm Gde Porte - Cav Mec", combustivel: "OD", consumo: 1.3, unidade: "km/L" },
  { nome: "Vtr Adm Gde Porte - Ônibus/Cav Mec", combustivel: "OD", consumo: 3, unidade: "km/L" },
  { nome: "Vtr Op Leve - Marruá", combustivel: "OD", consumo: 5, unidade: "km/L" },
  { nome: "Vtr Op Gde Porte - Vtr 5 ton", combustivel: "OD", consumo: 3, unidade: "km/L" },
  { nome: "Motocicleta - até 1.000cc", combustivel: "GAS", consumo: 15, unidade: "km/L" },
  { nome: "Motocicleta - acima de 1.000cc", combustivel: "GAS", consumo: 7, unidade: "km/L" },
  { nome: "Vtr Bld SR", combustivel: "OD", consumo: 1.5, unidade: "km/L" },
  { nome: "Vtr Bld SL", combustivel: "OD", consumo: 0.5, unidade: "km/L" },
  { nome: "Vtr Bld L SR - LINCE", combustivel: "OD", consumo: 4, unidade: "km/L" },
];

// --- CLASSE II FALLBACKS ---
export const defaultClasseIIConfig: DiretrizClasseIIForm[] = [
  { categoria: "Equipamento Individual", item: "Equipamento Individual", valor_mnt_dia: 2.42 },
  { categoria: "Proteção Balística", item: "Colete balístico", valor_mnt_dia: 3.23 },
  { categoria: "Proteção Balística", item: "Capacete balístico", valor_mnt_dia: 2.56 },
  { categoria: "Material de Estacionamento", item: "Barraca de campanha", valor_mnt_dia: 7.55 },
  { categoria: "Material de Estacionamento", item: "Toldo modular", valor_mnt_dia: 1.88 },
  { categoria: "Material de Estacionamento", item: "Barraca individual", valor_mnt_dia: 0.26 },
  { categoria: "Material de Estacionamento", item: "Cama de campanha", valor_mnt_dia: 0.32 },
  { categoria: "Material de Estacionamento", item: "Marmita Térmica", valor_mnt_dia: 0.67 },
  { categoria: "Material de Estacionamento", item: "Armário", valor_mnt_dia: 0.82 },
  { categoria: "Material de Estacionamento", item: "Beliche", valor_mnt_dia: 0.66 },
  { categoria: "Material de Estacionamento", item: "Colchão", valor_mnt_dia: 0.28 },
];

// --- CLASSE V FALLBACKS ---
export const defaultClasseVConfig: DiretrizClasseIIForm[] = [
  { categoria: "Armt L", item: "Fuzil 5,56mm IA2 IMBEL", valor_mnt_dia: 1.40 },
  { categoria: "Armt L", item: "Fuzil 7,62mm", valor_mnt_dia: 1.50 },
  { categoria: "Armt L", item: "Pistola 9 mm", valor_mnt_dia: 0.40 },
  { categoria: "Armt L", item: "Metralhadora FN MINIMI 5,56 x 45mm", valor_mnt_dia: 10.60 },
  { categoria: "Armt L", item: "Metralhadora FN MINIMI 7,62 x 51mm", valor_mnt_dia: 11.00 },
  { categoria: "Armt P", item: "Obuseiro", valor_mnt_dia: 175.00 },
  { categoria: "IODCT", item: "OVN", valor_mnt_dia: 9.50 },
  { categoria: "DQBRN", item: "Falcon 4GS", valor_mnt_dia: 723.30 },
];

// --- CLASSE VI FALLBACKS ---
export const defaultClasseVIConfig: DiretrizClasseIIForm[] = [
  // Embarcação
  { categoria: "Embarcação", item: "Gerador de Campanha", valor_mnt_dia: 2.19 },
  { categoria: "Embarcação", item: "Embarcação Guardian", valor_mnt_dia: 354.11 },
  { categoria: "Embarcação", item: "Ferry Boat", valor_mnt_dia: 38.00 },
  { categoria: "Embarcação", item: "Embarcação Regional", valor_mnt_dia: 17.02 },
  { categoria: "Embarcação", item: "Embarcação de Manobra", valor_mnt_dia: 20.66 },
  { categoria: "Embarcação", item: "Embarcação Empurrador", valor_mnt_dia: 71.80 },
  { categoria: "Embarcação", item: "Motor de Popa", valor_mnt_dia: 9.73 },
  // Equipamento de Engenharia
  { categoria: "Equipamento de Engenharia", item: "Carregadeira de Pneus", valor_mnt_dia: 74.33 },
  { categoria: "Equipamento de Engenharia", item: "Carreta Hidrl de Perfuraçao de rocha", valor_mnt_dia: 280.17 },
  { categoria: "Equipamento de Engenharia", item: "Escavadeira Hidráulica", valor_mnt_dia: 133.70 },
  { categoria: "Equipamento de Engenharia", item: "Guindaste com lança telescópica RT", valor_mnt_dia: 174.38 },
  { categoria: "Equipamento de Engenharia", item: "Minicarregadeira (SkidSteer)", valor_mnt_dia: 97.24 },
  { categoria: "Equipamento de Engenharia", item: "Miniescavadeira (2.001 a 4.000kg)", valor_mnt_dia: 65.34 },
  { categoria: "Equipamento de Engenharia", item: "Miniescavadeira (850 a 2.000kg)", valor_mnt_dia: 41.34 },
  { categoria: "Equipamento de Engenharia", item: "Trator Agrícola", valor_mnt_dia: 87.95 },
  { categoria: "Equipamento de Engenharia", item: "Trator de Esteiras", valor_mnt_dia: 189.51 },
  { categoria: "Equipamento de Engenharia", item: "Motoniveladora", valor_mnt_dia: 86.35 },
];

// --- CLASSE VII FALLBACKS ---
export const defaultClasseVIIConfig: DiretrizClasseIIForm[] = [
  // Comunicações
  { categoria: "Comunicações", item: "RF-7800V-HH (VAA)", valor_mnt_dia: 25.88 },
  { categoria: "Comunicações", item: "RF-7800V-HH", valor_mnt_dia: 10.45 },
  { categoria: "Comunicações", item: "RF-7800H-MP", valor_mnt_dia: 36.81 },
  { categoria: "Comunicações", item: "7800H-V002", valor_mnt_dia: 89.47 },
  { categoria: "Comunicações", item: "MOTOBRIDGE", valor_mnt_dia: 40.23 },
  { categoria: "Comunicações", item: "APX 2000", valor_mnt_dia: 3.77 },
  { categoria: "Comunicações", item: "APX 2500", valor_mnt_dia: 4.42 },
  { categoria: "Comunicações", item: "GTR 8000", valor_mnt_dia: 50.41 },
  { categoria: "Comunicações", item: "Terminal Leve SISCOMSAT", valor_mnt_dia: 111.06 },
  { categoria: "Comunicações", item: "SRDT", valor_mnt_dia: 305.69 },
  // Informática
  { categoria: "Informática", item: "Ativos de rede/servidor", valor_mnt_dia: 10.95 },
  { categoria: "Informática", item: "Desktop", valor_mnt_dia: 5.48 },
  { categoria: "Informática", item: "Notebook", valor_mnt_dia: 7.34 },
  { categoria: "Informática", item: "Impressora Multifuncional", valor_mnt_dia: 4.10 },
  { categoria: "Informática", item: "Tablet e Smartphone", valor_mnt_dia: 8.22 },
];

// --- CLASSE VIII FALLBACKS ---
export const defaultClasseVIIISaudeConfig: DiretrizClasseIIForm[] = [
  { categoria: "Saúde", item: "KPSI / KPTI", valor_mnt_dia: 1600.00 },
  { categoria: "Saúde", item: "KPSC / KPT Ni I", valor_mnt_dia: 22200.00 },
  { categoria: "Saúde", item: "KPSC / KPT Ni II", valor_mnt_dia: 21000.00 },
  { categoria: "Saúde", item: "KPSC I/ KPT Ni III", valor_mnt_dia: 11800.00 },
  { categoria: "Saúde", item: "KPSC Vtr Amb Bas", valor_mnt_dia: 21500.00 },
  { categoria: "Saúde", item: "KPSC Vtr Amb Avçd", valor_mnt_dia: 24500.00 },
];

export const defaultClasseVIIIRemontaConfig: DiretrizClasseIIForm[] = [
  // Equinos
  { categoria: "Remonta/Veterinária", item: "Equino - B: Encilhagem/Selas (Anual)", valor_mnt_dia: 1750.00 },
  { categoria: "Remonta/Veterinária", item: "Equino - C: Medicamento/Ferrageamento (Mensal)", valor_mnt_dia: 90.00 },
  { categoria: "Remonta/Veterinária", item: "Equino - C: Alimentação (Mensal)", valor_mnt_dia: 795.00 },
  { categoria: "Remonta/Veterinária", item: "Equino - D: Reposição/Desgaste (Anual)", valor_mnt_dia: 7200.00 },
  { categoria: "Remonta/Veterinária", item: "Equino - E: Assistência Veterinária (Anual)", valor_mnt_dia: 4000.00 },
  { categoria: "Remonta/Veterinária", item: "Equino - G: Custo Mnt/Dia Op (Diário)", valor_mnt_dia: 29.50 },
  // Caninos (Itens detalhados)
  { categoria: "Remonta/Veterinária", item: "Canino - B: Material de Condução (Anual)", valor_mnt_dia: 500.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - C: Alimentação (Mensal)", valor_mnt_dia: 99.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - D: Valor de Mercado (Anual)", valor_mnt_dia: 1600.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - E: Assistência Veterinária (Anual)", valor_mnt_dia: 400.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - G: Custo Mnt/Dia Op (Diário)", valor_mnt_dia: 5.30 },
];

// --- CLASSE IX FALLBACKS ---
export const defaultClasseIXConfig: DiretrizClasseIXForm[] = [
  { categoria: "Vtr Administrativa", item: "VTP Sedan Médio", valor_mnt_dia: 46.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTP Sedan Compacto", valor_mnt_dia: 29.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTP Minivan 7 Psg", valor_mnt_dia: 34.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTP Pick-up 4x4 Cabine Dupla", valor_mnt_dia: 67.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTP Van Executiva 16 Psg", valor_mnt_dia: 90.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTE Amb Suporte Avançado", valor_mnt_dia: 118.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTR Amb Simples Remoção", valor_mnt_dia: 90.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Administrativa", item: "VTNE VUC com carroceria baú", valor_mnt_dia: 69.00, valor_acionamento_mensal: 650.00 },
  { categoria: "Vtr Administrativa", item: "VTP Micro-ônibus", valor_mnt_dia: 163.00, valor_acionamento_mensal: 650.00 },
  { categoria: "Vtr Administrativa", item: "VTNE 9 t Baú", valor_mnt_dia: 138.00, valor_acionamento_mensal: 910.00 },
  { categoria: "Vtr Administrativa", item: "VTP Ônibus Intermunicipal", valor_mnt_dia: 308.00, valor_acionamento_mensal: 910.00 },
  { categoria: "Vtr Administrativa", item: "VTP Ônibus Rodoviário", valor_mnt_dia: 419.00, valor_acionamento_mensal: 910.00 },
  { categoria: "Vtr Administrativa", item: "VTNE Baú 13 t", valor_mnt_dia: 308.00, valor_acionamento_mensal: 1200.00 },
  { categoria: "Vtr Administrativa", item: "VTNE Cav Mec 45 t", valor_mnt_dia: 228.00, valor_acionamento_mensal: 1200.00 },
  { categoria: "Vtr Administrativa", item: "VTNE Cav Mec 60 t", valor_mnt_dia: 333.00, valor_acionamento_mensal: 1200.00 },
  { categoria: "Vtr Operacional", item: "VTNE 3/4 Marruá", valor_mnt_dia: 154.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Operacional", item: "VTNE Pick-up VOP 2 (Mitsubishi L 200)", valor_mnt_dia: 78.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Operacional", item: "VTE Amb SR 4x4", valor_mnt_dia: 227.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Operacional", item: "VTNE 1 1/2 t AM 31 (Marruá)", valor_mnt_dia: 182.00, valor_acionamento_mensal: 400.00 },
  { categoria: "Vtr Operacional", item: "Caminhão Op de 1,5 até 5 t (exclusive)", valor_mnt_dia: 182.00, valor_acionamento_mensal: 650.00 },
  { categoria: "Vtr Operacional", item: "VTP Micro-ônibus", valor_mnt_dia: 192.00, valor_acionamento_mensal: 650.00 },
  { categoria: "Vtr Operacional", item: "VTNE 5 t (WORKER/ATEGO)", valor_mnt_dia: 285.00, valor_acionamento_mensal: 910.00 },
  { categoria: "Vtr Operacional", item: "VTP Ônibus Urbano", valor_mnt_dia: 308.00, valor_acionamento_mensal: 910.00 },
  { categoria: "Vtr Operacional", item: "VTP Ônibus choque e rodoviário", valor_mnt_dia: 419.00, valor_acionamento_mensal: 910.00 },
  { categoria: "Vtr Operacional", item: "VTNE Cav Mec 60 t e caminhão acima de 10 t", valor_mnt_dia: 454.00, valor_acionamento_mensal: 1200.00 },
  { categoria: "Vtr Operacional", item: "VR até 1,5 t", valor_mnt_dia: 20.09, valor_acionamento_mensal: 150.00 },
  { categoria: "Vtr Operacional", item: "VR Cisterna até 1.500l", valor_mnt_dia: 9.15, valor_acionamento_mensal: 150.00 },
  { categoria: "Vtr Operacional", item: "Cozinha de Campanha", valor_mnt_dia: 35.00, valor_acionamento_mensal: 310.00 },
  { categoria: "Vtr Operacional", item: "VSRNE Prancha 45 t", valor_mnt_dia: 33.00, valor_acionamento_mensal: 600.00 },
  { categoria: "Vtr Operacional", item: "VSRNE Prancha 60 t", valor_mnt_dia: 50.00, valor_acionamento_mensal: 600.00 },
  { categoria: "Motocicleta", item: "VTP motocicleta estafeta", valor_mnt_dia: 5.00, valor_acionamento_mensal: 200.00 },
  { categoria: "Motocicleta", item: "Vtr Mct Policial Gp III", valor_mnt_dia: 13.00, valor_acionamento_mensal: 300.00 },
  { categoria: "Motocicleta", item: "Quadriciclo", valor_mnt_dia: 17.00, valor_acionamento_mensal: 300.00 },
  { categoria: "Motocicleta", item: "Vtr Mct Policial Gp II", valor_mnt_dia: 33.00, valor_acionamento_mensal: 320.00 },
  { categoria: "Motocicleta", item: "Vtr Mct Policial Gp I", valor_mnt_dia: 44.00, valor_acionamento_mensal: 950.00 },
  { categoria: "Vtr Blindada", item: "Série Blindada Americana", valor_mnt_dia: 1476.70, valor_acionamento_mensal: 3800.00 },
  { categoria: "Vtr Blindada", item: "Série Blindada Alemã", valor_mnt_dia: 1011.39, valor_acionamento_mensal: 48000.00 },
  { categoria: "Vtr Blindada", item: "Série IDV", valor_mnt_dia: 1656.90, valor_acionamento_mensal: 4000.00 },
  { categoria: "Vtr Blindada", item: "Série Engesa", valor_mnt_dia: 1330.00, valor_acionamento_mensal: 628.00 },
];

export const defaultDirectives = {
    defaultClasseIIConfig,
    defaultClasseVConfig,
    defaultClasseVIConfig,
    defaultClasseVIIConfig,
    defaultClasseVIIISaudeConfig,
    defaultClasseVIIIRemontaConfig,
    defaultClasseIXConfig,
    grupoGeradores,
    tipoEmbarcacoes,
    tipoEquipamentosEngenharia,
    tipoViaturas,
};