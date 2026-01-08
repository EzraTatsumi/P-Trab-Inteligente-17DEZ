import { useMemo } from 'react';
import { PTrab, PTrabTotals } from '@/types/ptrab';

// Helper function to safely parse numeric values
const parseNumeric = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const usePTrabCalculations = (pTrab: PTrab | undefined): PTrabTotals => {
  return useMemo(() => {
    if (!pTrab) {
      return {
        totalDiariasND15: 0,
        totalDiariasND30: 0,
        totalDiariasTaxaEmbarque: 0,
        totalDiariasValorDiaria: 0,
        totalClasseI: 0,
        totalClasseII: 0,
        totalClasseIII: 0,
        totalClasseV: 0,
        totalClasseVI: 0,
        totalClasseVII: 0,
        totalClasseVIIISaude: 0,
        totalClasseVIIIRemonta: 0,
        totalClasseIX: 0,
        totalGeral: 0,
      };
    }

    // --- Diarias Calculation (Classe ND 15) ---
    const diariaTotals = pTrab.diaria_registros.reduce((acc, record) => {
      const valor_nd_15 = parseNumeric(record.valor_nd_15);
      const valor_nd_30 = parseNumeric(record.valor_nd_30);
      const valor_total = parseNumeric(record.valor_total);
      const valor_taxa_embarque = parseNumeric(record.valor_taxa_embarque);

      acc.totalDiariasND15 += valor_nd_15;
      acc.totalDiariasND30 += valor_nd_30; 

      // Calculate specific breakdown requested by user
      acc.totalDiariasTaxaEmbarque += valor_taxa_embarque;
      // Main daily allowance value = Total value - Taxa de Embarque
      acc.totalDiariasValorDiaria += valor_total - valor_taxa_embarque;

      return acc;
    }, {
      totalDiariasND15: 0,
      totalDiariasND30: 0,
      totalDiariasTaxaEmbarque: 0,
      totalDiariasValorDiaria: 0,
    });

    // --- Placeholder for other class calculations (assuming they exist) ---
    // NOTE: These should be replaced with actual calculation logic if available
    const totalClasseI = 0; 
    const totalClasseII = 0; 
    const totalClasseIII = 0; 
    const totalClasseV = 0; 
    const totalClasseVI = 0; 
    const totalClasseVII = 0; 
    const totalClasseVIIISaude = 0; 
    const totalClasseVIIIRemonta = 0; 
    const totalClasseIX = 0; 

    const totalGeral = diariaTotals.totalDiariasND15 + diariaTotals.totalDiariasND30 + totalClasseI + totalClasseII + totalClasseIII + totalClasseV + totalClasseVI + totalClasseVII + totalClasseVIIISaude + totalClasseVIIIRemonta + totalClasseIX;

    const totals: PTrabTotals = {
      ...diariaTotals,
      totalClasseI,
      totalClasseII,
      totalClasseIII,
      totalClasseV,
      totalClasseVI,
      totalClasseVII,
      totalClasseVIIISaude,
      totalClasseVIIIRemonta,
      totalClasseIX,
      totalGeral,
    };

    return totals;
  }, [pTrab]);
};