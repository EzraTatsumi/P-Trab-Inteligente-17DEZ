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
 * Os valores refletem a tabela oficial de custos.
 */
export const defaultClasseVIConfig: DefaultLogisticaItem[] = [
  { categoria: "Gerador", item: "Gerador de Campanha", valor_mnt_dia: 2.19 },
  { categoria: "Embarcação", item: "Embarcação Guardian", valor_mnt_dia: 354.11 },
  { categoria: "Embarcação", item: "Ferry Boat", valor_mnt_dia: 38.00 },
  { categoria: "Embarcação", item: "Embarcação Regional", valor_mnt_dia: 17.02 },
  { categoria: "Embarcação", item: "Embarcação de Manobra", valor_mnt_dia: 20.66 },
  { categoria: "Embarcação", item: "Embarcação Empurrador", valor_mnt_dia: 71.80 },
  { categoria: "Embarcação", item: "Motor de Popa", valor_mnt_dia: 9.73 },
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