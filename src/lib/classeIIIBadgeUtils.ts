type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';

interface BadgeStyle {
    label: string;
    className: string;
}

export const getClasseIIICategoryLabel = (categoria: TipoEquipamento): string => {
    switch (categoria) {
        case 'GERADOR':
            return 'Gerador';
        case 'EMBARCACAO':
            return 'Embarcação';
        case 'EQUIPAMENTO_ENGENHARIA':
            return 'Equipamento de Engenharia';
        case 'MOTOMECANIZACAO':
            return 'Motomecanização';
        default:
            return categoria;
    }
};

export const getClasseIIICategoryBadgeStyle = (categoria: TipoEquipamento): BadgeStyle => {
    const baseClass = "w-fit shrink-0 text-xs font-medium";
    
    switch (categoria) {
        case 'GERADOR':
            return {
                label: getClasseIIICategoryLabel(categoria),
                className: `${baseClass} bg-yellow-600 text-white hover:bg-yellow-700`,
            };
        case 'EMBARCACAO':
            return {
                label: getClasseIIICategoryLabel(categoria),
                className: `${baseClass} bg-blue-600 text-white hover:bg-blue-700`,
            };
        case 'EQUIPAMENTO_ENGENHARIA':
            return {
                label: getClasseIIICategoryLabel(categoria),
                className: `${baseClass} bg-green-600 text-white hover:bg-green-700`,
            };
        case 'MOTOMECANIZACAO':
            return {
                label: getClasseIIICategoryLabel(categoria),
                className: `${baseClass} bg-red-600 text-white hover:bg-red-700`,
            };
        default:
            return {
                label: getClasseIIICategoryLabel(categoria),
                className: `${baseClass} bg-gray-500 text-white hover:bg-gray-600`,
            };
    }
};