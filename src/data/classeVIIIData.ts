import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";

// --- SAÚDE (KPSI/KPT) ---
export const defaultClasseVIIISaudeConfig: DiretrizClasseIIForm[] = [
  { categoria: "Saúde - KPSI/KPT", item: "KPSI / KPTI", valor_mnt_dia: 1600.00 },
  { categoria: "Saúde - KPSI/KPT", item: "KPSC / KPT Ni I", valor_mnt_dia: 22200.00 },
  { categoria: "Saúde - KPSI/KPT", item: "KPSC / KPT Ni II", valor_mnt_dia: 21000.00 },
  { categoria: "Saúde - KPSI/KPT", item: "KPSC I/ KPT Ni III", valor_mnt_dia: 11800.00 },
  { categoria: "Saúde - KPSI/KPT", item: "KPSC Vtr Amb Bas", valor_mnt_dia: 21500.00 },
  { categoria: "Saúde - KPSI/KPT", item: "KPSC Vtr Amb Avçd", valor_mnt_dia: 24500.00 },
];

// --- REMONTA/VETERINÁRIA (Itens B, C, D, E, G) ---
// Item G (Manutenção por Dia de Operação - usado em cálculos de Classe II/V/VI/VII)
export const defaultClasseVIIIRemontaMntDiaConfig: DiretrizClasseIIForm[] = [
  { categoria: "Remonta - Mnt/Dia", item: "Cavalo", valor_mnt_dia: 29.50 },
  { categoria: "Remonta - Mnt/Dia", item: "Cão", valor_mnt_dia: 5.30 },
];

// Itens B, C, D, E (Usados para o cálculo complexo de Remonta)
export interface RemontaItem {
  item: string;
  animal_tipo: 'Equino' | 'Canino';
  categoria: 'B' | 'C' | 'D' | 'E';
  valor: number;
  unidade: 'ano' | 'mês' | 'animal' | '5 cães/ano';
}

export const defaultRemontaComplexItems: RemontaItem[] = [
  // Item B (Anual)
  { item: "Encilhagem e Proteção", animal_tipo: "Equino", categoria: "B", valor: 1500.00, unidade: "ano" },
  { item: "Selas", animal_tipo: "Equino", categoria: "B", valor: 2000.00, unidade: "ano" },
  { item: "Material de Condução", animal_tipo: "Canino", categoria: "B", valor: 2500.00, unidade: "5 cães/ano" },

  // Item C (Mensal)
  { item: "Medicamentos e Ferrageamento", animal_tipo: "Equino", categoria: "C", valor: 90.00, unidade: "mês" },
  { item: "Medicamentos", animal_tipo: "Canino", categoria: "C", valor: 60.00, unidade: "mês" },
  { item: "Alimentação Volumoso/Sal Mineral", animal_tipo: "Equino", categoria: "C", valor: 795.00, unidade: "mês" },
  { item: "Alimentação Reforço Ração", animal_tipo: "Canino", categoria: "C", valor: 99.00, unidade: "mês" },

  // Item D (Valor de Mercado 20% - ND 33.90.39)
  { item: "Valor de Mercado (20%)", animal_tipo: "Equino", categoria: "D", valor: 7200.00, unidade: "animal" }, // 36000 * 0.2
  { item: "Valor de Mercado (20%)", animal_tipo: "Canino", categoria: "D", valor: 8000.00, unidade: "animal" }, // 40000 * 0.2

  // Item E (Assistência Veterinária 20% - ND 33.90.39)
  { item: "Assistência Veterinária (20%)", animal_tipo: "Equino", categoria: "E", valor: 4000.00, unidade: "animal" }, // 20000 * 0.2
  { item: "Assistência Veterinária (20%)", animal_tipo: "Canino", categoria: "E", valor: 2000.00, unidade: "animal" }, // 10000 * 0.2
];