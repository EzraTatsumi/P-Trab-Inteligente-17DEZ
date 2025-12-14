type CategoriaIX = 'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada';

interface BadgeStyle {
  className: string;
  label: string;
}

const CATEGORY_MAP: Record<CategoriaIX, { label: string, className: string }> = {
  'Vtr Administrativa': {
    label: 'Vtr Adm',
    className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  },
  'Vtr Operacional': {
    label: 'Vtr Op',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  'Motocicleta': {
    label: 'Moto',
    className: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  },
  'Vtr Blindada': {
    label: 'Blindada',
    className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  },
};

export const getClasseIXBadgeStyle = (categoria: string): BadgeStyle => {
  const ixCategory = categoria as CategoriaIX;
  
  if (CATEGORY_MAP[ixCategory]) {
    return CATEGORY_MAP[ixCategory];
  }

  // Fallback default style if needed, though all categories in this context should match
  return {
    label: categoria,
    className: 'bg-gray-100 text-gray-800 border-gray-300',
  };
};