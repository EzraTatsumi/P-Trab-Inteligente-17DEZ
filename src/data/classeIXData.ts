import { DiretrizClasseIXForm } from "@/types/diretrizesClasseIX";

// Função auxiliar para limpar e converter valores monetários do formato R$ X.XXX,XX para number
const parseCurrency = (value: string): number => {
  // Remove R$, pontos de milhar e substitui vírgula decimal por ponto
  const cleanedValue = value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(cleanedValue) || 0;
};

export const defaultClasseIXConfig: DiretrizClasseIXForm[] = [
  { categoria: "Vtr Administrativa", item: "VTP Sedan Médio", valor_mnt_dia: parseCurrency("R$ 46,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTP Sedan Compacto", valor_mnt_dia: parseCurrency("R$ 29,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTP Minivan 7 Psg", valor_mnt_dia: parseCurrency("R$ 34,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTP Pick-up 4x4 Cabine Dupla", valor_mnt_dia: parseCurrency("R$ 67,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTP Van Executiva 16 Psg", valor_mnt_dia: parseCurrency("R$ 90,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTE Amb Suporte Avançado", valor_mnt_dia: parseCurrency("R$ 118,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTR Amb Simples Remoção", valor_mnt_dia: parseCurrency("R$ 90,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Administrativa", item: "VTNE VUC com carroceria baú", valor_mnt_dia: parseCurrency("R$ 69,00"), valor_acionamento_mensal: parseCurrency("R$ 650,00") },
  { categoria: "Vtr Administrativa", item: "VTP Micro-ônibus", valor_mnt_dia: parseCurrency("R$ 163,00"), valor_acionamento_mensal: parseCurrency("R$ 650,00") },
  { categoria: "Vtr Administrativa", item: "VTNE 9 t Baú", valor_mnt_dia: parseCurrency("R$ 138,00"), valor_acionamento_mensal: parseCurrency("R$ 910,00") },
  { categoria: "Vtr Administrativa", item: "VTP Ônibus Intermunicipal", valor_mnt_dia: parseCurrency("R$ 308,00"), valor_acionamento_mensal: parseCurrency("R$ 910,00") },
  { categoria: "Vtr Administrativa", item: "VTP Ônibus Rodoviário", valor_mnt_dia: parseCurrency("R$ 419,00"), valor_acionamento_mensal: parseCurrency("R$ 910,00") },
  { categoria: "Vtr Administrativa", item: "VTNE Baú 13 t", valor_mnt_dia: parseCurrency("R$ 308,00"), valor_acionamento_mensal: parseCurrency("R$ 1.200,00") },
  { categoria: "Vtr Administrativa", item: "VTNE Cav Mec 45 t", valor_mnt_dia: parseCurrency("R$ 228,00"), valor_acionamento_mensal: parseCurrency("R$ 1.200,00") },
  { categoria: "Vtr Administrativa", item: "VTNE Cav Mec 60 t", valor_mnt_dia: parseCurrency("R$ 333,00"), valor_acionamento_mensal: parseCurrency("R$ 1.200,00") },
  { categoria: "Vtr Operacional", item: "VTNE 3/4 Marruá", valor_mnt_dia: parseCurrency("R$ 154,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Operacional", item: "VTNE Pick-up VOP 2 (Mitsubishi L 200)", valor_mnt_dia: parseCurrency("R$ 78,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Operacional", item: "VTE Amb SR 4x4", valor_mnt_dia: parseCurrency("R$ 227,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Operacional", item: "VTNE 1 1/2 t AM 31 (Marruá)", valor_mnt_dia: parseCurrency("R$ 182,00"), valor_acionamento_mensal: parseCurrency("R$ 400,00") },
  { categoria: "Vtr Operacional", item: "Caminhão Op de 1,5 até 5 t (exclusive)", valor_mnt_dia: parseCurrency("R$ 182,00"), valor_acionamento_mensal: parseCurrency("R$ 650,00") },
  { categoria: "Vtr Operacional", item: "VTP Micro-ônibus", valor_mnt_dia: parseCurrency("R$ 192,00"), valor_acionamento_mensal: parseCurrency("R$ 650,00") },
  { categoria: "Vtr Operacional", item: "VTNE 5 t (WORKER/ATEGO)", valor_mnt_dia: parseCurrency("R$ 285,00"), valor_acionamento_mensal: parseCurrency("R$ 910,00") },
  { categoria: "Vtr Operacional", item: "VTP Ônibus Urbano", valor_mnt_dia: parseCurrency("R$ 308,00"), valor_acionamento_mensal: parseCurrency("R$ 910,00") },
  { categoria: "Vtr Operacional", item: "VTP Ônibus choque e rodoviário", valor_mnt_dia: parseCurrency("R$ 419,00"), valor_acionamento_mensal: parseCurrency("R$ 910,00") },
  { categoria: "Vtr Operacional", item: "VTNE Cav Mec 60 t e caminhão acima de 10 t", valor_mnt_dia: parseCurrency("R$ 454,00"), valor_acionamento_mensal: parseCurrency("R$ 1.200,00") },
  { categoria: "Vtr Operacional", item: "VR até 1,5 t", valor_mnt_dia: parseCurrency("R$ 20,09"), valor_acionamento_mensal: parseCurrency("R$ 150,00") },
  { categoria: "Vtr Operacional", item: "VR Cisterna até 1.500l", valor_mnt_dia: parseCurrency("R$ 9,15"), valor_acionamento_mensal: parseCurrency("R$ 150,00") },
  { categoria: "Vtr Operacional", item: "Cozinha de Campanha", valor_mnt_dia: parseCurrency("R$ 35,00"), valor_acionamento_mensal: parseCurrency("R$ 310,00") },
  { categoria: "Vtr Operacional", item: "VSRNE Prancha 45 t", valor_mnt_dia: parseCurrency("R$ 33,00"), valor_acionamento_mensal: parseCurrency("R$ 600,00") },
  { categoria: "Vtr Operacional", item: "VSRNE Prancha 60 t", valor_mnt_dia: parseCurrency("R$ 50,00"), valor_acionamento_mensal: parseCurrency("R$ 600,00") },
  { categoria: "Motocicleta", item: "VTP motocicleta estafeta", valor_mnt_dia: parseCurrency("R$ 5,00"), valor_acionamento_mensal: parseCurrency("R$ 200,00") },
  { categoria: "Motocicleta", item: "Vtr Mct Policial Gp III", valor_mnt_dia: parseCurrency("R$ 13,00"), valor_acionamento_mensal: parseCurrency("R$ 300,00") },
  { categoria: "Motocicleta", item: "Quadriciclo", valor_mnt_dia: parseCurrency("R$ 17,00"), valor_acionamento_mensal: parseCurrency("R$ 300,00") },
  { categoria: "Motocicleta", item: "Vtr Mct Policial Gp II", valor_mnt_dia: parseCurrency("R$ 33,00"), valor_acionamento_mensal: parseCurrency("R$ 320,00") },
  { categoria: "Motocicleta", item: "Vtr Mct Policial Gp I", valor_mnt_dia: parseCurrency("R$ 44,00"), valor_acionamento_mensal: parseCurrency("R$ 950,00") },
  { categoria: "Vtr Blindada", item: "Série Blindada Americana", valor_mnt_dia: parseCurrency("R$ 1.476,70"), valor_acionamento_mensal: parseCurrency("R$ 3.800,00") },
  { categoria: "Vtr Blindada", item: "Série Blindada Alemã", valor_mnt_dia: parseCurrency("R$ 1.011,39"), valor_acionamento_mensal: parseCurrency("R$ 48.000,00") },
  { categoria: "Vtr Blindada", item: "Série IDV", valor_mnt_dia: parseCurrency("R$ 1.656,90"), valor_acionamento_mensal: parseCurrency("R$ 4.000,00") },
  { categoria: "Vtr Blindada", item: "Série Engesa", valor_mnt_dia: parseCurrency("R$ 1.330,00"), valor_acionamento_mensal: parseCurrency("R$ 628,00") },
];