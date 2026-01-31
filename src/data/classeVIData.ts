import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";

// Definindo um tipo mais abrangente para os itens logísticos padrão,
// incluindo todas as categorias presentes neste arquivo, como 'Gerador'.
export type DefaultLogisticaItem = {
    categoria: 
        | "Embarcação" 
        | "Equipamento de Engenharia" 
        | "Gerador" // Adicionado para resolver o erro
        | "Equipamento Individual" 
        | "Proteção Balística" 
        | "Material de Estacionamento" 
        | "Armt L" 
        | "Armt P" 
        | "IODCT" 
        | "DQBRN" 
        | "Comunicações" 
        | "Informática" 
        | "Saúde" 
        | "Remonta/Veterinária";
    item: string;
    valor_mnt_dia: number;
};

/**
 * Configuração padrão de itens de Classe VI (Material de Engenharia) para uso quando não há diretrizes personalizadas.
 * Os valores são fictícios e devem ser substituídos por diretrizes reais do usuário.
 */
export const defaultClasseVIConfig: DefaultLogisticaItem[] = [
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