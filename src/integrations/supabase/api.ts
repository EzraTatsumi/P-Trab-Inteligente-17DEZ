import { toast } from "sonner";
import { supabase } from "./client"; 
import { Profile } from "@/types/profiles"; 
import { 
    ArpUasgSearchParams, 
    ArpItemResult, 
    ArpRawResult, 
    DetailedArpItem, 
    DetailedArpRawResult, 
    CatmatDetailsRawResult,
    PriceStatsSearchParams, 
    PriceStatsResult, 
} from "@/types/pncp"; 
import { formatPregao } from "@/lib/formatUtils";
import { TablesInsert, TablesUpdate } from "./types"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";

/**
 * Busca ARPs no PNCP por UASG.
 * Se estiver no modo Ghost e a UASG for 160222, retorna dados simulados.
 */
export async function fetchArpsByUasg(params: ArpUasgSearchParams): Promise<ArpItemResult[]> {
    const cleanUasg = String(params.uasg || '').trim();
    
    // Prioridade Total para o Modo Treinamento (Missão 02)
    if (isGhostMode() && cleanUasg === '160222') {
        console.log("[GhostMode] Retornando resultados simulados para UASG 160222");
        return GHOST_DATA.missao_02.arp_search_results;
    }

    try {
        const { data, error } = await supabase.functions.invoke('fetch-arps-by-uasg', { 
            body: { ...params, uasg: cleanUasg } 
        });

        if (error) {
            throw error;
        }

        const responseData = data as ArpRawResult[]; 
        if (!Array.isArray(responseData)) {
            return [];
        }

        return responseData.map((item: ArpRawResult) => {
            const numeroCompraStr = String(item.numeroCompra || '').trim();
            const anoCompraStr = String(item.anoCompra || '').trim();
            const uasgStr = String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, '');
            let pregaoFormatado = 'N/A';
            if (numeroCompraStr && anoCompraStr) {
                const numeroCompraFormatado = numeroCompraStr.padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2');
                pregaoFormatado = `${numeroCompraFormatado}/${anoCompraStr.slice(-2)}`;
            }
            return {
                id: item.idCompra || Math.random().toString(36).substring(2, 9), 
                numeroAta: item.numeroAtaRegistroPreco || 'N/A',
                objeto: item.objeto || 'Objeto não especificado',
                uasg: uasgStr,
                omNome: item.nomeUnidadeGerenciadora || `UASG ${uasgStr}`, 
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
                valorTotalEstimado: parseFloat(String(item.valorTotal || 0)),
                quantidadeItens: parseInt(String(item.quantidadeItens || 0)),
                pregaoFormatado: pregaoFormatado,
                numeroControlePncpAta: item.numeroControlePncpAta || '', 
            };
        });
    } catch (error: any) {
        console.error("Erro na busca PNCP:", error);
        // Garante uma mensagem de erro legível se não for Ghost Mode
        const msg = error.message || "Erro de conexão com a API do PNCP.";
        throw new Error(msg);
    }
}

// ... (restante do arquivo mantido exatamente como estava)
export async function fetchFuelPrice(fuelType: 'diesel' | 'gasolina'): Promise<{ price: number, source: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-fuel-prices');
    if (error) throw new Error(error.message || "Falha na execução da Edge Function.");
    const responseData = data as EdgeFunctionResponse;
    if (fuelType === 'diesel') {
      if (typeof responseData.diesel?.price !== 'number' || responseData.diesel.price <= 0) throw new Error("Preço do Diesel inválido recebido.");
      return responseData.diesel;
    } else {
      if (typeof responseData.gasolina?.price !== 'number' || responseData.gasolina.price <= 0) throw new Error("Preço da Gasolina inválido recebido.");
      return responseData.gasolina;
    }
  } catch (error) {
    console.error(`Erro ao buscar preço de ${fuelType} via Edge Function:`, error);
    throw error;
  }
}

export async function fetchUserProfile(): Promise<Profile> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado.");
    const { data: profileData, error } = await supabase.from('profiles').select(`*`).eq('id', user.id).maybeSingle();
    if (error) throw error;
    return profileData as Profile;
}

export async function fetchCatalogEntry(codigo: string, mode: 'material' | 'servico'): Promise<any> {
    const table = mode === 'material' ? 'catalogo_catmat' : 'catalogo_catser';
    const cleanCode = codigo.replace(/\D/g, '');
    const { data, error } = await supabase.from(table as any).select('description, short_description').eq('code', cleanCode).maybeSingle();
    if (error) throw error;
    return data;
}

export async function saveNewCatalogEntry(code: string, description: string, shortDescription: string, mode: 'material' | 'servico'): Promise<void> {
    const cleanCode = code.replace(/\D/g, '');
    if (mode === 'material') {
        await supabase.rpc('upsert_catmat_entry', { p_code: cleanCode, p_description: description, p_short_description: shortDescription });
    } else {
        await (supabase.from('catalogo_catser' as any)).upsert({ code: cleanCode, description: description, short_description: shortDescription, updated_at: new Date().toISOString() });
    }
}

export async function fetchCatalogFullDescription(codigo: string, mode: 'material' | 'servico'): Promise<any> {
    const { data, error } = await supabase.functions.invoke('fetch-catmat-details', { body: { codigoItem: codigo, type: mode } });
    if (error) throw error;
    return data;
}

export async function fetchArpItemsByCatmat(params: any): Promise<DetailedArpItem[]> {
    const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-catmat', { body: params });
    if (error) throw error;
    return (data as any[]).map(item => ({
        ...item,
        id: `${item.numeroControlePncpAta}-${item.numeroItem}`,
        valorUnitario: parseFloat(String(item.valorUnitario || 0)),
        uasg: String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, '')
    }));
}

export async function fetchArpItemsById(numeroControlePncpAta: string): Promise<DetailedArpItem[]> {
    if (isGhostMode() && numeroControlePncpAta === '160222-ARP-001-2025') {
        return GHOST_DATA.missao_02.arp_detailed_items;
    }
    const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-id', { body: { numeroControlePncpAta } });
    if (error) throw error;
    return (data as any[]).map(item => ({
        ...item,
        id: `${item.numeroControlePncpAta}-${item.numeroItem}`,
        valorUnitario: parseFloat(String(item.valorUnitario || 0)),
        uasg: String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, '')
    }));
}

export async function fetchAllExistingAcquisitionItems(year: number, userId: string, mode: string): Promise<any[]> {
    let table = 'diretrizes_material_consumo';
    if (mode === 'servico') table = 'diretrizes_servicos_terceiros';
    if (mode === 'permanente') table = 'diretrizes_material_permanente';
    const { data, error } = await supabase.from(table as any).select('itens_aquisicao').eq('user_id', userId).eq('ano_referencia', year);
    if (error) throw error;
    return (data || []).flatMap(d => (d as any).itens_aquisicao || []);
}

export async function fetchPriceStats(params: any): Promise<PriceStatsResult> {
    const { data, error } = await supabase.functions.invoke('fetch-price-stats', { body: params });
    if (error) throw error;
    return data as PriceStatsResult;
}