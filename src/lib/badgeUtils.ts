import { cn } from "@/lib/utils";

type CategoriaClasse = 
  'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' |
  'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' |
  'Embarcação' | 'Equipamento de Engenharia' |
  'Comunicações' | 'Informática';

interface BadgeStyle {
  label: string;
  className: string;
}

const CATEGORY_STYLES: Record<CategoriaClasse, BadgeStyle> = {
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
};

/**
 * Retorna o rótulo padronizado e a classe CSS para o badge de uma categoria específica.
 */
export const getCategoryBadgeStyle = (category: string): BadgeStyle => {
  const style = CATEGORY_STYLES[category as CategoriaClasse];
  if (style) {
    return style;
  }
  return { label: category, className: 'bg-gray-500 hover:bg-gray-600 text-white' };
};

/**
 * Retorna o rótulo padronizado da categoria.
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