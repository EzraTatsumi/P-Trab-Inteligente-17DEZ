import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";

/**
 * Configuração padrão de itens de Classe VI (Material de Engenharia) para uso quando não há diretrizes personalizadas.
 * Os valores são fictícios e devem ser substituídos por diretrizes reais do usuário.
 */
export const defaultClasseVIConfig: DiretrizClasseIIForm[] = [
  // Embarcação
  {
    categoria: "Embarcação",
    item: "Motor de Popa 40HP (Manutenção)",
    valor_mnt_dia: 1.50,
  },
  {
    categoria: "Embarcação",
    item: "Bote de Assalto (Manutenção)",
    valor_mnt_dia: 0.80,
  },
  // Equipamento de Engenharia
  {
    categoria: "Equipamento de Engenharia",
    item: "Retroescavadeira (Manutenção)",
    valor_mnt_dia: 15.00,
  },
  {
    categoria: "Equipamento de Engenharia",
    item: "Trator de Esteira (Manutenção)",
    valor_mnt_dia: 25.00,
  },
  // Gerador (NOVA CATEGORIA)
  {
    categoria: "Gerador",
    item: "Gerador de Campanha 15 kVA (Manutenção)",
    valor_mnt_dia: 5.00,
  },
  {
    categoria: "Gerador",
    item: "Gerador de Campanha 50 kVA (Manutenção)",
    valor_mnt_dia: 12.00,
  },
];