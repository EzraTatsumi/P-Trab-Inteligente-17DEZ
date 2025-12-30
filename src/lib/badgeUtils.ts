import { cn } from "@/lib/utils";

type CategoriaClasse = 
  'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' |
  'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' |
  'Embarcação' | 'Equipamento de Engenharia' |
  'Comunicações' | 'Informática' |
  'Saúde' | 'Remonta/Veterinária' | // CLASSE VIII
  'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada'; // CLASSE IX

interface BadgeStyle {
  label: string;
  className: string;
}

const CATEGORY_STYLES: Record<string, BadgeStyle> = {
  // Classe II - Material de Intendência (Verde)
  'Equipamento Individual': { label: 'Eqp Individual', className: 'bg-green-600 hover:bg-green-700 text-white' },
  'Proteção Balística': { label: 'Prot Balística', className: 'bg-green-700 hover:bg-green-800 text-white' },
  'Material de Estacionamento': { label: 'Mat Estacionamento', className: 'bg-green-500 hover:bg-green-600 text-white' },

  // Classe V - Armamento (Vermelho/Marrom)
  'Armt L': { label: 'Armamento Leve', className: 'bg-red-700 hover:bg-red-800 text-white' },
  'Armt P': { label: 'Armamento Pesado', className: 'bg-red-900 hover:bg-red-950 text-white' },
  'IODCT': { label: 'IODCT', className: 'bg-red-500 hover:bg-red-600 text-white' },
  'DQBRN': { label: 'DQBRN', className: 'bg-red-400 hover:bg-red-500 text-white' },

  // Classe VI - Material de Engenharia (Laranja/Marrom)
  'Embarcação': { label: 'Embarcação', className: 'bg-yellow-700 hover:bg-yellow-800 text-white' },
  'Equipamento de Engenharia': { label: 'Eqp Engenharia', className: 'bg-yellow-800 hover:bg-yellow-900 text-white' },

  // Classe VII - Comunicações e Informática (Azul)
  'Comunicações': { label: 'Comunicações', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  'Informática': { label: 'Informática', className: 'bg-blue-800 hover:bg-blue-900 text-white' },
  
  // Classe VIII - Saúde e Remonta (Rosa/Roxo)
  'Saúde': { label: 'Saúde', className: 'bg-pink-600 hover:bg-pink-700 text-white' },
  'Remonta/Veterinária': { label: 'Remonta/Vet', className: 'bg-purple-600 hover:bg-purple-700 text-white' },
  
  // Classe IX - Motomecanização (Ciano/Verde Claro)
  'Vtr Administrativa': { label: 'Vtr Adm', className: 'bg-teal-600 hover:bg-teal-700 text-white' },
  'Vtr Operacional': { label: 'Vtr Op', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  'Motocicleta': { label: 'Moto', className: 'bg-lime-600 hover:bg-lime-700 text-white' },
  'Vtr Blindada': { label: 'Vtr Blindada', className: 'bg-gray-700 hover:bg-gray-800 text-white' },
};

/**
 * Retorna o rótulo padronizado e a classe CSS para o badge de uma categoria específica.
 */
export const getCategoryBadgeStyle = (category: string): BadgeStyle => {
  const style = CATEGORY_STYLES[category];
  if (style) {
    return style;
  }
  return { label: category, className: 'bg-gray-500 hover:bg-gray-600 text-white' };
};

/**
 * Retorna o rótulo padronizado da categoria (abreviado, conforme CATEGORY_STYLES).
 */
export const getCategoryLabel = (category: string): string => {
  return getCategoryBadgeStyle(category).label;
};

/**
 * Retorna a classe CSS para o badge.
 */
export const getCategoryClass = (category: string): string => {
  return getCategoryBadgeStyle(category).className;
};

/**
 * Retorna o rótulo completo para uma categoria de Classe II, V, VI, VII, VIII ou IX.
 * Usado principalmente em relatórios e detalhamentos.
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