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
import { TablesInsert } from "./types"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 

// Interface para a resposta consolidada da Edge Function
interface EdgeFunctionResponse {
  diesel: { price: number, source: string };
  gasolina: { price: number, source: string };
}

/**
 * Fetches the latest price for a given fuel type by invoking a Supabase Edge Function.
 */
export async function fetchFuelPrice(fuelType: 'diesel' | 'gasolina'): Promise<{ price: number, source: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-fuel-prices');

    if (error) {
      throw new Error(error.message || "Falha na execução da Edge Function.");
    }
    
    const responseData = data as EdgeFunctionResponse;

    if (fuelType === 'diesel') {
      if (typeof responseData.diesel?.price !== 'number' || responseData.diesel.price <= 0) {
        throw new Error("Preço do Diesel inválido recebido.");
      }
      return responseData.diesel;
    } else {
      if (typeof responseData.gasolina?.price !== 'number' || responseData.gasolina.price <= 0) {
        throw new Error("Preço da Gasolina inválido recebido.");
      }
      return responseData.gasolina;
    }

  } catch (error) {
    console.error(`Erro ao buscar preço de ${fuelType} via Edge Function:`, error);
    throw error;
  }
}

interface SharePreview {
    ptrabName: string;
    ownerName: string;
}

/**
 * Fetches the PTrab and owner name preview using the share link details.
 */
export async function fetchSharePreview(ptrabId: string, token: string): Promise<SharePreview> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-share-preview', {
            body: { ptrabId, token },
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de pré-visualização.");
        }
        
        return data as SharePreview;
    } catch (error) {
        console.error("Erro ao buscar pré-visualização de compartilhamento:", error);
        throw error;
    }
}

/**
 * Fetches the current user's profile data.
 */
export async function fetchUserProfile(): Promise<Profile> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Usuário não autenticado.");
    }

    const { data: profileData, error } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', user.id)
        .maybeSingle();

    if (error) throw error;

    if (!profileData) {
        return {
            id: user.id,
            first_name: '',
            last_name: '',
            avatar_url: '',
            updated_at: new Date().toISOString(),
            credit_gnd3: 0,
            credit_gnd4: 0,
            default_logistica_year: null,
            default_operacional_year: null,
            raw_user_meta_data: null,
            om_details: null,
        } as Profile;
    }

    return {
        ...profileData,
        om_details: null,
    } as Profile;
}

// NOVO TIPO DE RETORNO MAIS COMPLETO
interface CatalogStatus {
    description: string | null;
    shortDescription: string | null;
    isCataloged: boolean;
}

/**
 * Busca os detalhes de um item no catálogo local (CATMAT ou CATSER).
 */
export async function fetchCatalogDetails(mode: 'material' | 'servico', code: string): Promise<CatalogStatus> {
    if (!code) return { description: null, shortDescription: null, isCataloged: false };
    
    const cleanCode = code.replace(/\D/g, '');
    if (!cleanCode) return { description: null, shortDescription: null, isCataloged: false };
    
    const tableName = mode === 'material' ? 'catalogo_catmat' : 'catalogo_catser';
    
    try {
        let { data, error } = await supabase
            .from(tableName as any)
            .select('description, short_description')
            .eq('code', cleanCode)
            .maybeSingle();
            
        if (error) throw error;
        
        // Fallback para CATMAT com zeros à esquerda
        if (!data && mode === 'material') {
            const paddedCode = cleanCode.padStart(9, '0');
            if (paddedCode !== cleanCode) {
                const { data: paddedData, error: paddedError } = await supabase
                    .from(tableName as any)
                    .select('description, short_description')
                    .eq('code', paddedCode)
                    .maybeSingle();
                    
                if (paddedError) throw paddedError;
                data = paddedData;
            }
        }
        
        if (data) {
            return {
                description: data.description || null,
                shortDescription: data.short_description || null,
                isCataloged: true,
            };
        }
        
        return { description: null, shortDescription: null, isCataloged: false };
        
    } catch (error) {
        console.error(`Erro ao buscar detalhes do catálogo ${mode}:`, error);
        return { description: null, shortDescription: null, isCataloged: false };
    }
}

/**
 * Salva uma nova entrada no catálogo (CATMAT ou CATSER).
 */
export async function saveNewCatalogEntry(mode: 'material' | 'servico', code: string, description: string, shortDescription: string): Promise<void> {
    const cleanCode = code.replace(/\D/g, '');

    if (mode === 'material') {
        const { error } = await supabase.rpc('upsert_catmat_entry', {
            p_code: cleanCode,
            p_description: description,
            p_short_description: shortDescription,
        });
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('catalogo_catser' as any)
            .upsert({
                code: cleanCode,
                description: description,
                short_description: shortDescription,
                updated_at: new Date().toISOString()
            }, { onConflict: 'code' });
        if (error) throw error;
    }
}

/**
 * Busca a descrição completa de um item no PNCP.
 */
export async function fetchCatmatFullDescription(codigoItem: string, mode: 'material' | 'servico' = 'material'): Promise<{ fullDescription: string | null, nomePdm: string | null }> {
    if (!codigoItem) return { fullDescription: null, nomePdm: null };
    
    try {
        const { data, error } = await supabase.functions.invoke('fetch-catmat-details', {
            body: { codigoItem, mode }, 
        });

        if (error) throw new Error(error.message);
        
        const responseData = data as CatmatDetailsRawResult;
        
        if (responseData && responseData.descricaoItem) {
            return {
                fullDescription: responseData.descricaoItem,
                nomePdm: responseData.nomePdm || null,
            };
        }
        
        return { fullDescription: null, nomePdm: null };
    } catch (error) {
        console.error("Erro ao buscar descrição completa no PNCP:", error);
        return { fullDescription: null, nomePdm: null };
    }
}

/**
 * Busca Atas de Registro de Preços (ARPs) por UASG.
 */
export async function fetchArpsByUasg(params: ArpUasgSearchParams): Promise<ArpItemResult[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arps-by-uasg', {
            body: params,
        });

        if (error) throw new Error(error.message);
        
        const responseData = data as ArpRawResult[]; 
        
        if (!Array.isArray(responseData)) return [];
        
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
    } catch (error) {
        console.error("Erro ao buscar ARPs por UASG:", error);
        throw error;
    }
}

/**
 * Busca itens detalhados de uma ARP por código.
 */
export async function fetchArpItemsByCatmat(params: { codigoItem: string, dataVigenciaInicialMin: string, dataVigenciaInicialMax: string }): Promise<DetailedArpItem[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-catmat', {
            body: params,
        });

        if (error) throw new Error(error.message);
        
        const responseData = data as DetailedArpRawResult[]; 
        if (!Array.isArray(responseData)) return [];
        
        return responseData.map((item: DetailedArpRawResult) => {
            const numeroCompraStr = String(item.numeroCompra || '').trim();
            const anoCompraStr = String(item.anoCompra || '').trim();
            let pregaoFormatado = 'N/A';
            if (numeroCompraStr && anoCompraStr) {
                pregaoFormatado = `${numeroCompraStr.padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2')}/${anoCompraStr.slice(-2)}`;
            }
            
            return {
                id: `${item.numeroControlePncpAta}-${item.numeroItem}`, 
                numeroAta: item.numeroAtaRegistroPreco || 'N/A',
                codigoItem: String(item.codigoItem || 'N/A'),
                descricaoItem: item.descricaoItem || 'Descrição não disponível',
                valorUnitario: parseFloat(String(item.valorUnitario || 0)),
                quantidadeHomologada: parseInt(String(item.quantidadeHomologadaItem || 0)),
                numeroControlePncpAta: item.numeroControlePncpAta,
                pregaoFormatado: pregaoFormatado,
                uasg: String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, ''),
                omNome: item.nomeUnidadeGerenciadora || 'N/A',
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
            };
        });
    } catch (error) {
        console.error("Erro ao buscar itens detalhados por código:", error);
        throw error;
    }
}

/**
 * Busca os itens detalhados de uma ARP específica.
 */
export async function fetchArpItemsById(numeroControlePncpAta: string): Promise<DetailedArpItem[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-id', {
            body: { numeroControlePncpAta },
        });

        if (error) throw new Error(error.message);
        
        const responseData = data as DetailedArpRawResult[]; 
        if (!Array.isArray(responseData)) return [];
        
        return responseData.map((item: DetailedArpRawResult) => {
            const numeroCompraStr = String(item.numeroCompra || '').trim();
            const anoCompraStr = String(item.anoCompra || '').trim();
            let pregaoFormatado = 'N/A';
            if (numeroCompraStr && anoCompraStr) {
                pregaoFormatado = `${numeroCompraStr.padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2')}/${anoCompraStr.slice(-2)}`;
            }
            
            return {
                id: `${item.numeroControlePncpAta}-${item.numeroItem}`, 
                numeroAta: item.numeroAtaRegistroPreco || 'N/A',
                codigoItem: String(item.codigoItem || 'N/A'),
                descricaoItem: item.descricaoItem || 'Descrição não disponível',
                valorUnitario: parseFloat(String(item.valorUnitario || 0)),
                quantidadeHomologada: parseInt(String(item.quantidadeHomologadaItem || 0)),
                numeroControlePncpAta: item.numeroControlePncpAta,
                pregaoFormatado: pregaoFormatado,
                uasg: String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, ''),
                omNome: item.nomeUnidadeGerenciadora || 'N/A',
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
            };
        });
    } catch (error) {
        console.error("Erro ao buscar itens detalhados da ARP:", error);
        throw error;
    }
}

/**
 * Busca todos os itens de aquisição existentes para um ano e usuário.
 */
export async function fetchAllExistingAcquisitionItems(year: number, userId: string, mode: 'material' | 'servico' = 'material'): Promise<ItemAquisicao[]> {
    if (!year || year <= 0) return [];
    
    const tableName = mode === 'material' ? 'diretrizes_material_consumo' : 'diretrizes_servicos_terceiros';
    
    try {
        const { data, error } = await supabase
            .from(tableName as any)
            .select('itens_aquisicao')
            .eq('user_id', userId)
            .eq('ano_referencia', year);

        if (error) throw error;

        return (data || []).flatMap(diretriz => {
            return (diretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        });
    } catch (error) {
        console.error("Erro ao buscar itens existentes:", error);
        throw error;
    }
}

/**
 * Busca estatísticas de preço no PNCP.
 */
export async function fetchPriceStats(params: PriceStatsSearchParams): Promise<PriceStatsResult> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-price-stats', {
            body: params,
        });

        if (error) throw new Error(error.message);
        return data as PriceStatsResult; 
    } catch (error) {
        console.error("Erro ao buscar estatísticas de preço:", error);
        throw error;
    }
}