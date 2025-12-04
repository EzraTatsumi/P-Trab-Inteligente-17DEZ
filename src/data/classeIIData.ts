import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";

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

// NOVO: Lista de itens padrão da Classe V (Armamento)
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