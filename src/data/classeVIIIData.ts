export interface ItemSaude {
  item: string;
  valor_unitario: number;
}

export const defaultClasseVIIISaudeConfig: ItemSaude[] = [
  { item: "KPSI / KPTI", valor_unitario: 1600.00 },
  { item: "KPSC / KPT Ni I", valor_unitario: 22200.00 },
  { item: "KPSC / KPT Ni II", valor_unitario: 21000.00 },
  { item: "KPSC I/ KPT Ni III", valor_unitario: 11800.00 },
  { item: "KPSC Vtr Amb Bas", valor_unitario: 21500.00 },
  { item: "KPSC Vtr Amb Avçd", valor_unitario: 24500.00 },
];