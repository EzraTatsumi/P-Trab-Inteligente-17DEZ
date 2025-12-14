import { cn } from "@/lib/utils";

export type CategoriaClasseIX = 'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada';

interface BadgeStyle {
  label: string;
  className: string;
}

export const getCategoryLabel = (category: string): string => {
  switch (category) {
    case 'Vtr Administrativa':
      return 'Vtr Adm';
    case 'Vtr Operacional':
      return 'Vtr Op';
    case 'Motocicleta':
      return 'Moto';
    case 'Vtr Blindada':
      return 'Blindada';
    default:
      return category;
  }
};

export const getCategoryBadgeStyle = (category: string): BadgeStyle => {
  switch (category as CategoriaClasseIX) {
    case 'Vtr Administrativa':
      return {
        label: getCategoryLabel(category),
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
      };
    case 'Vtr Operacional':
      return {
        label: getCategoryLabel(category),
        className: 'bg-green-600 hover:bg-green-700 text-white',
      };
    case 'Motocicleta':
      return {
        label: getCategoryLabel(category),
        className: 'bg-yellow-500 hover:bg-yellow-600 text-gray-900',
      };
    case 'Vtr Blindada':
      return {
        label: getCategoryLabel(category),
        className: 'bg-red-700 hover:bg-red-800 text-white',
      };
    default:
      return {
        label: category,
        className: 'bg-gray-500 hover:bg-gray-600 text-white',
      };
  }
};