import { toast } from "sonner";
import { supabase } from "./client"; // Importar o cliente Supabase
import { Profile } from "@/types/profiles"; // Importar o novo tipo Profile
import { ArpUasgSearchParams, ArpItemResult, ArpRawResult } from "@/types/pncp"; // Importa os novos tipos PNCP

// Interface para a resposta consolidada da Edge Function
interface EdgeFunctionResponse {
  diesel: { price: number, source: string };
  gasolina: { price: number, source: string };
}

/**
 * Fetches the latest price for a given fuel type by invoking a Supabase Edge Function.
 * This bypasses potential CORS issues with the external API.
 * @param fuelType 'diesel' or 'gasolina'
 * @returns The price and source information.
 */
export async function fetchFuelPrice(fuelType: 'diesel' | 'gasolina'): Promise<{ price: number, source: string }> {
  try {
    // Invoca a Edge Function para buscar os preços
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
        throw new Error("Preço da Gasolina inválido recebida.");
      }
      return responseData.gasolina;
    }

  } catch (error) {
    console.error(`Erro ao buscar preço de ${fuelType} via Edge Function:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    
    // Se for um erro de rede ou CORS, a mensagem será mais genérica
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("Edge Function failed")) {
        toast.error(`Falha ao consultar preço da ${fuelType}. Verifique a conexão ou tente novamente.`);
    } else {
        toast.error(`Falha ao consultar preço da ${fuelType}. Detalhes: ${errorMessage}`);
    }
    throw error;
  }
}

// NOVO: Interface para a pré-visualização de compartilhamento
interface SharePreview {
    ptrabName: string;
    ownerName: string;
}

/**
 * Fetches the PTrab and owner name preview using the share link details.
 * @param ptrabId The ID of the PTrab.
 * @param token The share token.
 * @returns PTrab name and owner name.
 */
export async function fetchSharePreview(ptrabId: string, token: string): Promise<SharePreview> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-share-preview', {
            body: { ptrabId, token },
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de pré-visualização.");
        }
        
        const responseData = data as SharePreview;
        
        if (!responseData.ptrabName || !responseData.ownerName) {
            throw new Error("Dados de pré-visualização incompletos.");
        }
        
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

/**
 * Fetches the current user's profile data.
 * @returns The user profile object.
 */
export async function fetchUserProfile(): Promise<Profile> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Usuário não autenticado.");
    }

    // Busca o perfil. REMOVIDO O JOIN INVÁLIDO.
    const { data: profileData, error } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!profileData) {
        // Se o perfil não existir, retorna um perfil básico
        return {
            id: user.id,
            first_name: '',
            last_name: '',
            avatar_url: '',
            updated_at: new Date().toISOString(),
            credit_gnd3: 0,
            credit_gnd4: 0,
            default_logistica_year: null, // Adicionado campo logistica
            default_operacional_year: null, // Adicionado campo operacional
            raw_user_meta_data: null,
            om_details: null, // om_details será null, pois não foi buscado
        } as Profile;
    }
    
    // Se o perfil existir, mas não tivermos a OM, precisamos buscá-la separadamente
    // Se o perfil tiver um campo om_id (que não está no esquema, mas é esperado pelo frontend), 
    // poderíamos usá-lo aqui. Como não temos, a OM padrão será carregada como null.

    return {
        ...profileData,
        om_details: null, // Força null para evitar erros de tipo, já que o JOIN falhou
    } as Profile;
}

/**
 * Busca Atas de Registro de Preços (ARPs) por UASG e período de vigência.
 * @param params Os parâmetros de busca (UASG e datas).
 * @returns Uma lista de resultados de ARP.
 */
export async function fetchArpsByUasg(params: ArpUasgSearchParams): Promise<ArpItemResult[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arps-by-uasg', {
            body: params,
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de busca de ARPs.");
        }
        
        // A API externa retorna um array de objetos.
        const responseData = data as ArpRawResult[]; 
        
        if (!Array.isArray(responseData)) {
            // Se a API retornar um objeto de erro ou vazio, tratamos como array vazio
            if (responseData && (responseData as any).error) {
                throw new Error((responseData as any).error);
            }
            return [];
        }
        
        // Mapeamento e sanitização dos dados para o tipo ArpItemResult
        const results: ArpItemResult[] = responseData.map((item: ArpRawResult) => {
            // Sanitização e Fallback para campos chave
            const numeroCompraStr = String(item.numeroCompra || '').trim();
            const anoCompraStr = String(item.anoCompra || '').trim();
            const uasgStr = String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, '');
            
            let pregaoFormatado: string;
            if (numeroCompraStr && anoCompraStr) {
                // Formata o número da compra (ex: 00001) para 000.001
                const numeroCompraFormatado = numeroCompraStr.padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2');
                const anoCompraDoisDigitos = anoCompraStr.slice(-2);
                pregaoFormatado = `${numeroCompraFormatado}/${anoCompraDoisDigitos}`;
            } else {
                pregaoFormatado = 'N/A';
            }
            
            return {
                // Usamos o idCompra como ID, ou um fallback
                id: item.idCompra || Math.random().toString(36).substring(2, 9), 
                numeroAta: item.numeroAtaRegistroPreco || 'N/A',
                objeto: item.objeto || 'Objeto não especificado',
                uasg: uasgStr,
                // CORREÇÃO APLICADA AQUI: Mapeando nomeUnidadeGerenciadora para omNome
                omNome: item.nomeUnidadeGerenciadora || `UASG ${uasgStr}`, 
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
                // Garantir que os valores sejam numéricos, caindo para 0 se inválidos
                valorTotalEstimado: parseFloat(String(item.valorTotal || 0)),
                quantidadeItens: parseInt(String(item.quantidadeItens || 0)),
                pregaoFormatado: pregaoFormatado,
            };
        });
        
        return results;

    } catch (error) {
        console.error("Erro ao buscar ARPs por UASG:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
        
        // Não exibe toast aqui, o componente que usa useQuery fará isso.
        throw new Error(`Falha ao buscar ARPs: ${errorMessage}`);
    }
}

/**
 * Busca a descrição reduzida (short_description) de um item no catálogo CATMAT.
 * @param catmatCode O código CATMAT do item.
 * @returns A descrição reduzida ou null se não for encontrada.
 */
export async function fetchCatmatShortDescription(catmatCode: string): Promise<string | null> {
    if (!catmatCode) return null;
    
    try {
        const { data, error } = await supabase
            .from('catalogo_catmat')
            .select('short_description')
            .eq('code', catmatCode)
            .maybeSingle();
            
        if (error) throw error;
        
        return data?.short_description || null;
        
    } catch (error) {
        console.error("Erro ao buscar short_description do CATMAT:", error);
        // Retorna null em caso de erro para não interromper o fluxo de importação
        return null;
    }
}