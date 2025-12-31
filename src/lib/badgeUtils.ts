import { cn } from "@/lib/utils";

// Define os estilos e rótulos para as categorias de PTrab
export const getCategoryBadgeStyle = (category: string) => {
  switch (category) {
    case "Classe I":
    case "RACAO_QUENTE":
    case "RACAO_OPERACIONAL":
      return { className: "bg-red-500 hover:bg-red-600", label: "Classe I" };
    case "Classe II":
    case "Equipamento Individual":
    case "Proteção Balística":
    case "Material de Estacionamento":
      return { className: "bg-yellow-500 hover:bg-yellow-600", label: "Classe II" };
    case "Classe III":
    case "Viatura":
    case "Embarcação":
    case "Gerador":
    case "Equipamento de Engenharia":
      return { className: "bg-blue-500 hover:bg-blue-600", label: "Classe III" };
    case "Classe V":
    case "Munição":
      return { className: "bg-purple-500 hover:bg-purple-600", label: "Classe V" };
    case "Classe VI":
    case "Material de Saúde":
      return { className: "bg-pink-500 hover:bg-pink-600", label: "Classe VI" };
    case "Classe VII":
    case "Material de Engenharia":
      return { className: "bg-indigo-500 hover:bg-indigo-600", label: "Classe VII" };
    case "Classe VIII":
    case "Saúde - KPSI/KPT":
    case "Remonta":
      return { className: "bg-teal-500 hover:bg-teal-600", label: "Classe VIII" };
    case "Classe IX":
    case "Motomecanização":
      return { className: "bg-orange-500 hover:bg-orange-600", label: "Classe IX" };
    default:
      return { className: "bg-gray-500 hover:bg-gray-600", label: category };
  }
};

// Função para obter o rótulo completo da categoria
export const getCategoryLabel = (category: string): string => {
  switch (category) {
    case "Equipamento Individual":
      return "Equipamento Individual";
    case "Proteção Balística":
      return "Proteção Balística";
    case "Material de Estacionamento":
      return "Material de Estacionamento"; // Retorna por extenso
    case "Viatura":
      return "Viatura";
    case "Embarcação":
      return "Embarcação";
    case "Gerador":
      return "Gerador";
    case "Equipamento de Engenharia":
      return "Equipamento de Engenharia";
    case "Munição":
      return "Munição";
    case "Material de Saúde":
      return "Material de Saúde";
    case "Material de Engenharia":
      return "Material de Engenharia";
    case "Saúde - KPSI/KPT":
      return "Saúde - KPSI/KPT";
    case "Remonta":
      return "Remonta";
    case "Motomecanização":
      return "Motomecanização";
    default:
      return category;
  }
};

// Função para obter o rótulo curto da categoria (para uso em abas, etc.)
export const getCategoryShortLabel = (category: string): string => {
  switch (category) {
    case "Equipamento Individual":
      return "Individual";
    case "Proteção Balística":
      return "Balística";
    case "Material de Estacionamento":
      return "Estacionamento";
    case "Viatura":
      return "Viatura";
    case "Embarcação":
      return "Embarcação";
    case "Gerador":
      return "Gerador";
    case "Equipamento de Engenharia":
      return "Engenharia";
    case "Munição":
      return "Munição";
    case "Material de Saúde":
      return "Saúde";
    case "Material de Engenharia":
      return "Engenharia";
    case "Saúde - KPSI/KPT":
      return "Saúde";
    case "Remonta":
      return "Remonta";
    case "Motomecanização":
      return "Motomecanização";
    default:
      return category;
  }
};

/**
 * Helper function to get the label for Classe II/V/VI/VII/VIII/IX categories, 
 * often used in calculation utilities where the category key is the input.
 * This function ensures full names for Vtr categories needed for pluralization logic.
 */
export const getClasseIILabel = (category: string): string => {
    switch (category) {
        case 'Vtr Administrativa': return 'Viatura Administrativa';
        case 'Vtr Operacional': return 'Viatura Operacional';
        case 'Motocicleta': return 'Motocicleta';
        case 'Vtr Blindada': return 'Viatura Blindada';
        case 'Equipamento Individual': return 'Equipamento Individual';
        case 'Proteção Balística': return 'Proteção Balística';
        case 'Material de Estacionamento': return 'Material de Estacionamento';
        case 'Armt L': return 'Armamento Leve';
        case 'Armt P': return 'Armamento Pesado';
        case 'IODCT': return 'IODCT';
        case 'DQBRN': return 'DQBRN';
        case 'Gerador': return 'Gerador';
        case 'Embarcação': return 'Embarcação';
        case 'Equipamento de Engenharia': return 'Equipamento de Engenharia';
        case 'Comunicações': return 'Comunicações';
        case 'Informática': return 'Informática';
        case 'Saúde': return 'Saúde';
        case 'Remonta/Veterinária': return 'Remonta/Veterinária';
        default: return category;
    }
};