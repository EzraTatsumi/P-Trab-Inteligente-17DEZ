import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency } from "./formatUtils";

export interface VehicleGroup {
    tempId: string;
    groupName: string;
    groupPurpose: string | null;
    items: ItemAquisicaoServico[];
    totalValue: number;
    totalND30: number;
    totalND39: number;
}

/**
 * Calcula os totais de um grupo de veículos.
 * (Quantidade x Período x Valor Unitário)
 */
export const calculateVehicleGroupTotals = (items: ItemAquisicaoServico[]) => {
    return items.reduce((acc, item) => {
        const qty = item.quantidade || 0;
        const period = (item as any).periodo || 0;
        const vlrUnit = item.valor_unitario || 0;
        
        const totalItem = qty * period * vlrUnit;
        
        if (item.nd === '30') acc.totalND30 += totalItem;
        else acc.totalND39 += totalItem;
        
        acc.totalGeral += totalItem;
        return acc;
    }, { totalGeral: 0, totalND30: 0, totalND39: 0 });
};