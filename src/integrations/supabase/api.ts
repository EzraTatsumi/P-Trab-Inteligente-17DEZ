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

interface EdgeFunctionResponse {
  diesel: { price: number, source: string };
  gasolina: { price: number, source: string };
}

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
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("Edge Function failed")) {
        toast.error(`Falha ao consultar preço da ${fuelType}. Verifique a conexão ou tente novamente.`);
    } else {
        toast.error(`Falha ao consultar preço da ${fuelType}. Detalhes: ${errorMessage}`);
    }
    throw error;
  }
}

interface SharePreview {
    ptrabName: string;
    ownerName: string;
}

export async function fetchSharePreview(ptrabId: string, token: string): Promise<SharePreview> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-share-preview', {
            body: { ptrabId, token },
        });
        if (error) throw new Error(error.message || "Falha na execução da Edge Function de pré-visualização.");
        const responseData = data as SharePreview;
        if (!responseData.ptrabName || !responseData.ownerName) throw new Error("Dados de pré-visualização incompletos.");
        return responseData;
    } catch (error) {
        console.error("Erro ao buscar pré-visualização de compartilhamento:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
        if (errorMessage.includes("P Trab not found or token invalid")) {
            toast.error("Link inválido ou expirado.");
        } else {
            toast.error(`Falha ao carregar pré-visualização. Detalhes: ${errorMessage}`);
        }
        throw error;
    }
}

export async function fetchUserProfile(): Promise<Profile> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado.");
    const { data: profileData, error } = await supabase.from('profiles').select(`*`).eq('id', user.id).maybeSingle();
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
    return { ...profileData, om_details: null } as Profile;
}

interface CatalogEntryStatus {
    description: string | null;
    shortDescription: string | null;
    isCataloged: boolean;
}

export async function fetchCatalogEntry(codigo: string, mode: 'material' | 'servico'): Promise<CatalogEntryStatus> {
    if (!codigo) return { description: null, shortDescription: null, isCataloged: false };
    const table = mode === 'material' ? 'catalogo_catmat' : 'catalogo_catser';
    const cleanCode = codigo.replace(/\D/g, '');
    if (!cleanCode) return { description: null, shortDescription: null, isCataloged: false };
    
    try {
        let { data, error } = await (supabase.from(table as any))
            .select('description, short_description')
            .eq('code', cleanCode)
            .maybeSingle();

        if (error) throw error;
        
        if (!data) {
            const paddedCode = cleanCode.padStart(9, '0');
            if (paddedCode !== cleanCode) {
                const { data: paddedData, error: paddedError } = await (supabase.from(table as any))
                    .select('description, short_description')
                    .eq('code', paddedCode)
                    .maybeSingle();
                if (paddedError) throw paddedError;
                data = paddedData;
            }
        }

        if (data) {
            const typedData = data as unknown as { description: string | null, short_description: string | null };
            return {
                description: typedData.description || null,
                shortDescription: typedData.short_description || null,
                isCataloged: true,
            };
        }
        return { description: null, shortDescription: null, isCataloged: false };
    } catch (error) {
        console.error(`Erro ao buscar entrada do catálogo ${mode}:`, error);
        return { description: null, shortDescription: null, isCataloged: false };
    }
}

export async function saveNewCatalogEntry(code: string, description: string, shortDescription: string, mode: 'material' | 'servico'): Promise<void> {
    const cleanCode = code.replace(/\D/g, '');
    if (mode === 'material') {
        const { error } = await supabase.rpc('upsert_catmat_entry', {
            p_code: cleanCode,
            p_description: description,
            p_short_description: shortDescription,
        });
        if (error) throw error;
    } else {
        const { error } = await (supabase.from('catalogo_catser' as any)).upsert({
            code: cleanCode,
            description: description,
            short_description: shortDescription,
            updated_at: new Date().toISOString()
        }, { onConflict: 'code' });
        if (error) throw error;
    }
}

export async function fetchCatalogFullDescription(codigo: string, mode: 'material' | 'servico'): Promise<{ fullDescription: string | null, nomePdm: string | null }> {
    if (!codigo) return { fullDescription: null, nomePdm: null };
    try {
        const { data, error } = await supabase.functions.invoke('fetch-catmat-details', {
            body: { codigoItem: codigo, type: mode === 'material' ? 'material' : 'servico' },
        });
        if (error) throw new Error(error.message || "Falha na execução da Edge Function de busca de detalhes.");
        const responseData = data as CatmatDetailsRawResult;
        if (responseData && responseData.descricaoItem) {
            return {
                fullDescription: responseData.descricaoItem,
                nomePdm: responseData.nomePdm || null,
            };
        }
        return { fullDescription: null, nomePdm: null };
    } catch (error) {
        console.error(`Erro ao buscar descrição completa do ${mode}:`, error);
        return { fullDescription: null, nomePdm: null };
    }
}

export async function fetchArpsByUasg(params: ArpUasgSearchParams): Promise<ArpItemResult[]> {
    if (isGhostMode() && params.uasg === '160222') {
        return GHOST_DATA.missao_02.arp_search_results;
    }

    try {
        const { data, error } = await supabase.functions.invoke('fetch-arps-by-uasg', { body: params });
        if (error) {
            if (error.message?.includes("JPA EntityManager") || error.message?.includes("400") || error.message?.includes("non-2xx")) {
                throw new Error("O servidor do PNCP está instável no momento.");
            }
            throw new Error(error.message || "Falha na execução da Edge Function.");
        }
        const responseData = data as ArpRawResult[]; 
        if (!Array.isArray(responseData)) {
            if (responseData && (responseData as any).error) throw new Error((responseData as any).error);
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
    } catch (error) {
        console.error("Erro ao buscar ARPs por UASG:", error);
        throw new Error(`Falha ao buscar ARPs: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
}

export async function fetchArpItemsByCatmat(params: { codigoItem: string, dataVigenciaInicialMin: string, dataVigenciaInicialMax: string }): Promise<DetailedArpItem[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-catmat', { body: params });
        if (error) throw new Error(error.message || "Falha na execução da Edge Function.");
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
                omNome: item.nomeUnidadeGerenciadora || `UASG ${item.codigoUnidadeGerenciadora}`,
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
            };
        });
    } catch (error) {
        console.error("Erro ao buscar itens detalhados da ARP por CATMAT:", error);
        throw new Error(`Falha ao buscar itens detalhados: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
}

export async function fetchArpItemsById(numeroControlePncpAta: string): Promise<DetailedArpItem[]> {
    if (isGhostMode() && numeroControlePncpAta === '160222-ARP-001-2025') {
        return GHOST_DATA.missao_02.arp_detailed_items;
    }

    try {
        const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-id', { body: { numeroControlePncpAta } });
        if (error) throw new Error(error.message || "Falha na execução da Edge Function.");
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
                omNome: item.nomeUnidadeGerenciadora || `UASG ${item.codigoUnidadeGerenciadora}`,
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
            };
        });
    } catch (error) {
        console.error("Erro ao buscar itens detalhados da ARP:", error);
        throw new Error(`Falha ao buscar itens detalhados: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
}

export async function fetchAllExistingAcquisitionItems(year: number, userId: string, mode: 'material' | 'servico' | 'permanente'): Promise<ItemAquisicao[]> {
    if (!year || typeof year !== 'number' || year <= 0) return [];
    
    let table = 'diretrizes_material_consumo';
    if (mode === 'servico') table = 'diretrizes_servicos_terceiros';
    if (mode === 'permanente') table = 'diretrizes_material_permanente';

    try {
        const { data, error } = await (supabase.from(table as any))
            .select('itens_aquisicao')
            .eq('user_id', userId)
            .eq('ano_referencia', year);

        if (error) throw error;

        return (data || []).flatMap(diretriz => {
            const typedDiretriz = diretriz as unknown as { itens_aquisicao: any };
            return (typedDiretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        });
    } catch (error) {
        console.error("Erro ao buscar todos os itens de aquisição existentes:", error);
        throw new Error("Falha ao carregar itens de aquisição existentes para verificação de duplicidade.");
    }
}

export async function fetchPriceStats(params: PriceStatsSearchParams): Promise<PriceStatsResult> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-price-stats', { body: params });
        if (error) throw new Error(error.message || "Falha na execução da Edge Function.");
        const responseData = data as PriceStatsResult; 
        if ((responseData as any).error) throw new Error((responseData as any).error);
        return responseData;
    } catch (error) {
        console.error("Erro ao buscar estatísticas de preço:", error);
        throw new Error(`Falha ao buscar estatísticas de preço: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
}