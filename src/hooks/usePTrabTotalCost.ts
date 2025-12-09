import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PTrabId, ClasseIRecord, ClasseII_VIII_Record, ClasseIIIRecord } from '@/types/ptrab';

// Helper function to fetch and sum costs from a table based on p_trab_id
const fetchTotal = async <T extends Record<string, any>>(
    tableName: string, 
    ptrabId: PTrabId, 
    selectColumns: string
): Promise<T[]> => {
    const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns)
        .eq('p_trab_id', ptrabId);

    if (error) {
        console.error(`Error fetching data from ${tableName}:`, error);
        return [];
    }
    return data as T[];
};

// Helper function to calculate total cost for a PTrab ID
const calculateTotalLogistica = async (ptrabId: PTrabId): Promise<number> => {
    let totalLogistica = 0;

    // 1. Classe I (QS + QR)
    const classeIRecords = await fetchTotal<ClasseIRecord>('classe_i_registros', ptrabId, 'total_qs, total_qr');
    const totalClasseI = classeIRecords.reduce((sum, record) => sum + (record.total_qs || 0) + (record.total_qr || 0), 0);
    totalLogistica += totalClasseI;

    // 2. Classes II, V, VI, VII, VIII (ND 30 + ND 39)
    const tables = [
        'classe_ii_registros', 
        'classe_v_registros', 
        'classe_vi_registros', 
        'classe_vii_registros', 
        'classe_viii_saude_registros', 
        'classe_viii_remonta_registros'
    ];
    
    const promisesClassesII_VIII = tables.map(table => 
        fetchTotal<ClasseII_VIII_Record>(table, ptrabId, 'valor_nd_30, valor_nd_39')
    );
    
    const resultsClassesII_VIII = await Promise.all(promisesClassesII_VIII);
    
    const totalClassesII_VIII = resultsClassesII_VIII.flat().reduce((sum, record) => 
        sum + (record.valor_nd_30 || 0) + (record.valor_nd_39 || 0), 0
    );
    totalLogistica += totalClassesII_VIII;

    // 3. Classe III (Combustível + Lubrificante)
    const classeIIIRecords = await fetchTotal<ClasseIIIRecord>('classe_iii_registros', ptrabId, 'valor_total, tipo_equipamento');
    
    // Both Combustível (non-lubrificant) and Lubrificante contribute to the total logistics cost.
    const totalClasseIII = classeIIIRecords.reduce((sum, record) => {
        return sum + (record.valor_total || 0);
    }, 0);
    totalLogistica += totalClasseIII;
    
    return totalLogistica;
};


export const usePTrabTotalCost = (ptrabId: PTrabId | undefined) => {
  return useQuery<number>({
    queryKey: ['ptrabTotalCost', ptrabId],
    queryFn: () => calculateTotalLogistica(ptrabId!),
    enabled: !!ptrabId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};