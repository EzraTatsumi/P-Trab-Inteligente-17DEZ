import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";

// Valores padrão para a categoria Saúde (Classe VIII)
export const defaultClasseVIIISaudeConfig: DiretrizClasseIIForm[] = [
  { categoria: "Saúde", item: "KPSI / KPTI", valor_mnt_dia: 1600.00 },
  { categoria: "Saúde", item: "KPSC / KPT Ni I", valor_mnt_dia: 22200.00 },
  { categoria: "Saúde", item: "KPSC / KPT Ni II", valor_mnt_dia: 21000.00 },
  { categoria: "Saúde", item: "KPSC I/ KPT Ni III", valor_mnt_dia: 11800.00 },
  { categoria: "Saúde", item: "KPSC Vtr Amb Bas", valor_mnt_dia: 21500.00 },
  { categoria: "Saúde", item: "KPSC Vtr Amb Avçd", valor_mnt_dia: 24500.00 },
];

// Valores padrão para a categoria Remonta/Veterinária (Classe VIII)
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
  { categoria: "Remonta/Veterinária", item: "Canino - C: Medicação (Mensal)", valor_mnt_dia: 60.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - D: Valor de Mercado (Anual)", valor_mnt_dia: 1600.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - E: Assistência Veterinária (Anual)", valor_mnt_dia: 400.00 },
  { categoria: "Remonta/Veterinária", item: "Canino - G: Custo Mnt/Dia Op (Diário)", valor_mnt_dia: 5.30 },
];