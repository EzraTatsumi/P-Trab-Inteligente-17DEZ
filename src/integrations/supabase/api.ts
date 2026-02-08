import { toast } from "sonner";
import { supabase } from "./client"; // Importar o cliente Supabase
import { Profile } from "@/types/profiles"; // Importar o novo tipo Profile
import { 
    ArpUasgSearchParams, 
    ArpItemResult, 
    ArpRawResult, 
    DetailedArpItem, 
    DetailedArpRawResult, 
    CatmatDetailsRawResult,
    PriceStatsSearchParams, // NOVO
    PriceStatsResult, // NOVO
    PriceItemDetail, // NOVO
} from "@/types/pncp"; // Importa os novos tipos PNCP
import { formatPregao } from "@/lib/formatUtils";
import { TablesInsert } from "./types"; // Importar TablesInsert
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; // NOVO: Importar ItemAquisicao

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
        throw new Error("Preço da Gasolina inválido recebido.");
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
 * Busca a descrição reduzida de um item no catálogo CATMAT.
 * @param codigoCatmat O código CATMAT (string).
 * @returns A descrição reduzida (short_description) ou null.
 */
export async function fetchCatmatShortDescription(codigoCatmat: string): Promise<string | null> {
    if (!codigoCatmat) return null;
    
    // Remove caracteres não numéricos.
    const cleanCode = codigoCatmat.replace(/\D/g, '');
    
    // Se o código limpo for vazio, retorna null
    if (!cleanCode) return null;
    
    try {
        const { data, error } = await supabase
            .from('catalogo_catmat')
            .select('short_description')
            .eq('code', cleanCode)
            .maybeSingle();
            
        if (error) throw error;
        
        // Se a busca falhar, tentamos buscar o código preenchido com zeros à esquerda (9 dígitos)
        if (!data?.short_description) {
            const paddedCode = cleanCode.padStart(9, '0');
            if (paddedCode !== cleanCode) {
                const { data: paddedData, error: paddedError } = await supabase
                    .from('catalogo_catmat')
                    .select('short_description')
                    .eq('code', paddedCode)
                    .maybeSingle();
                    
                if (paddedError) throw paddedError;
                return paddedData?.short_description || null;
            }
        }
        
        return data?.short_description || null;
        
    } catch (error) {
        console.error("Erro ao buscar descrição reduzida do CATMAT:", error);
        // Não lança erro fatal, apenas retorna null para que o processo de importação continue
        return null;
    }
}

/**
 * Saves a new or updates an existing CATMAT entry with a short description.
 * This is used when importing PNCP items where the CATMAT code is new or lacks a short description.
 * @param code The CATMAT code (string).
 * @param description The full description (from PNCP).
 * @param shortDescription The user-provided short description.
 */
export async function saveNewCatmatEntry(code: string, description: string, shortDescription: string): Promise<void> {
    const cleanCode = code.replace(/\D/g, ''); // Ensure code is clean digits

    // Chamada à função RPC para UPSERT no catalogo_catmat
    const { error } = await supabase.rpc('upsert_catmat_entry', {
        p_code: cleanCode,
        p_description: description,
        p_short_description: shortDescription,
    });

    if (error) {
        console.error("Erro ao salvar nova entrada CATMAT via RPC:", error);
        throw new Error("Falha ao salvar o item no catálogo CATMAT.");
    }
}

/**
 * Busca a descrição completa de um item CATMAT no PNCP (4_consultarItemMaterial).
 * @param codigoCatmat O código CATMAT (string).
 * @returns Um objeto contendo a descrição completa (fullDescription) e o nome PDM (nomePdm), ou null.
 */
export async function fetchCatmatFullDescription(codigoCatmat: string): Promise<{ fullDescription: string | null, nomePdm: string | null }> {
    if (!codigoCatmat) return { fullDescription: null, nomePdm: null };
    
    try {
        const { data, error } = await supabase.functions.invoke('fetch-catmat-details', {
            body: { codigoItem: codigoCatmat },
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de busca de detalhes CATMAT.");
        }
        
        const responseData = data as CatmatDetailsRawResult;
        
        // A Edge Function retorna o objeto detalhado ou um objeto vazio {} se não encontrar.
        if (responseData && responseData.descricaoItem) {
            return {
                fullDescription: responseData.descricaoItem,
                nomePdm: responseData.nomePdm || null,
            };
        }
        
        return { fullDescription: null, nomePdm: null };

    } catch (error) {
        console.error("Erro ao buscar descrição completa do CATMAT:", error);
        // Não lança erro fatal, apenas retorna null para que o processo de importação continue
        return { fullDescription: null, nomePdm: null };
    }
}

// =================================================================
// FUNÇÕES PARA CONSULTA PNCP (ARP)
// =================================================================

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
                omNome: item.nomeUnidadeGerenciadora || `UASG ${uasgStr}`, 
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
                // Garantir que os valores sejam numéricos, caindo para 0 se inválidos
                valorTotalEstimado: parseFloat(String(item.valorTotal || 0)),
                quantidadeItens: parseInt(String(item.quantidadeItens || 0)),
                pregaoFormatado: pregaoFormatado,
                // Mapeando o campo crucial
                numeroControlePncpAta: item.numeroControlePncpAta || '', 
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
 * Busca itens detalhados de uma Ata de Registro de Preços (ARP) por código CATMAT/CATSER e período de vigência.
 * @param params Os parâmetros de busca (codigoItem e datas).
 * @returns Uma lista de itens detalhados da ARP (DetailedArpItem[]).
 */
export async function fetchArpItemsByCatmat(params: { codigoItem: string, dataVigenciaInicialMin: string, dataVigenciaInicialMax: string }): Promise<DetailedArpItem[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-catmat', {
            body: params,
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de busca de itens por CATMAT.");
        }
        
        // A API externa retorna um array de objetos DetailedArpRawResult
        const responseData = data as DetailedArpRawResult[]; 
        
        if (!Array.isArray(responseData)) {
            if (responseData && (responseData as any).error) {
                throw new Error((responseData as any).error);
            }
            return [];
        }
        
        // Mapeamento e sanitização dos dados para o tipo DetailedArpItem
        const results: DetailedArpItem[] = responseData.map((item: DetailedArpRawResult) => {
            
            // Recalcula o Pregão formatado, pois o item detalhado não o traz pronto
            const numeroCompraStr = String(item.numeroCompra || '').trim();
            const anoCompraStr = String(item.anoCompra || '').trim();
            let pregaoFormatado: string;
            if (numeroCompraStr && anoCompraStr) {
                const numeroCompraFormatado = numeroCompraStr.padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2');
                const anoCompraDoisDigitos = anoCompraStr.slice(-2);
                pregaoFormatado = `${numeroCompraFormatado}/${anoCompraDoisDigitos}`;
            } else {
                pregaoFormatado = 'N/A';
            }
            
            const uasgStr = String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, '');
            
            return {
                // ID único: Combinação do controle da ARP e o número do item
                id: `${item.numeroControlePncpAta}-${item.numeroItem}`, 
                numeroAta: item.numeroAtaRegistroPreco || 'N/A',
                codigoItem: String(item.codigoItem || 'N/A'),
                descricaoItem: item.descricaoItem || 'Descrição não disponível',
                valorUnitario: parseFloat(String(item.valorUnitario || 0)),
                quantidadeHomologada: parseInt(String(item.quantidadeHomologadaItem || 0)),
                numeroControlePncpAta: item.numeroControlePncpAta,
                pregaoFormatado: pregaoFormatado,
                uasg: uasgStr,
                // NOVOS CAMPOS MAPEADOS:
                omNome: item.nomeUnidadeGerenciadora || `UASG ${uasgStr}`,
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
            };
        });
        
        return results;

    } catch (error) {
        console.error("Erro ao buscar itens detalhados da ARP por CATMAT:", error);
        throw new Error(`Falha ao buscar itens detalhados: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
}

/**
 * Busca os itens detalhados de uma Ata de Registro de Preços (ARP) específica.
 * @param numeroControlePncpAta O número de controle PNCP da ARP.
 * @returns Uma lista de itens detalhados da ARP.
 */
export async function fetchArpItemsById(numeroControlePncpAta: string): Promise<DetailedArpItem[]> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-arp-items-by-id', {
            body: { numeroControlePncpAta },
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de busca de itens detalhados.");
        }
        
        const responseData = data as DetailedArpRawResult[]; 
        
        if (!Array.isArray(responseData)) {
            if (responseData && (responseData as any).error) {
                throw new Error((responseData as any).error);
            }
            return [];
        }
        
        // Mapeamento e sanitização dos dados para o tipo DetailedArpItem
        const results: DetailedArpItem[] = responseData.map((item: DetailedArpRawResult) => {
            
            // Recalcula o Pregão formatado, pois o item detalhado não o traz pronto
            const numeroCompraStr = String(item.numeroCompra || '').trim();
            const anoCompraStr = String(item.anoCompra || '').trim();
            let pregaoFormatado: string;
            if (numeroCompraStr && anoCompraStr) {
                const numeroCompraFormatado = numeroCompraStr.padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2');
                const anoCompraDoisDigitos = anoCompraStr.slice(-2);
                pregaoFormatado = `${numeroCompraFormatado}/${anoCompraDoisDigitos}`;
            } else {
                pregaoFormatado = 'N/A';
            }
            
            const uasgStr = String(item.codigoUnidadeGerenciadora || '').replace(/\D/g, '');
            
            return {
                // ID único: Combinação do controle da ARP e o número do item
                id: `${item.numeroControlePncpAta}-${item.numeroItem}`, 
                numeroAta: item.numeroAtaRegistroPreco || 'N/A',
                codigoItem: String(item.codigoItem || 'N/A'),
                descricaoItem: item.descricaoItem || 'Descrição não disponível',
                valorUnitario: parseFloat(String(item.valorUnitario || 0)),
                quantidadeHomologada: parseInt(String(item.quantidadeHomologadaItem || 0)),
                numeroControlePncpAta: item.numeroControlePncpAta,
                pregaoFormatado: pregaoFormatado,
                uasg: uasgStr,
                // NOVOS CAMPOS MAPEADOS:
                omNome: item.nomeUnidadeGerenciadora || `UASG ${uasgStr}`,
                dataVigenciaInicial: item.dataVigenciaInicial || 'N/A',
                dataVigenciaFinal: item.dataVigenciaFinal || 'N/A',
            };
        });
        
        return results;

    } catch (error) {
        console.error("Erro ao buscar itens detalhados da ARP:", error);
        throw new Error(`Falha ao buscar itens detalhados: ${error instanceof Error ? error.message : "Erro desconhecido."}`);
    }
}

/**
 * Fetches all acquisition items from all 'diretrizes_material_consumo' for a given year and user.
 * This is used for checking duplications during PNCP import.
 * @param year The reference year.
 * @param userId The ID of the current user.
 * @returns A flattened array of all existing ItemAquisicao objects.
 */
export async function fetchAllExistingAcquisitionItems(year: number, userId: string): Promise<ItemAquisicao[]> {
    // Adiciona validação para garantir que o ano é um número válido
    if (!year || typeof year !== 'number' || year <= 0) {
        console.warn("fetchAllExistingAcquisitionItems called with invalid year:", year);
        return [];
    }
    
    try {
        const { data, error } = await supabase
            .from('diretrizes_material_consumo')
            .select('itens_aquisicao')
            .eq('user_id', userId)
            .eq('ano_referencia', year);

        if (error) throw error;

        // Flatten the array of arrays (itens_aquisicao is a JSONB array in the DB)
        const allItems = (data || []).flatMap(diretriz => {
            // Ensure the JSONB field is treated as an array of ItemAquisicao
            return (diretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        });

        return allItems;

    } catch (error) {
        console.error("Erro ao buscar todos os itens de aquisição existentes:", error);
        throw new Error("Falha ao carregar itens de aquisição existentes para verificação de duplicidade.");
    }
}

/**
 * Busca estatísticas de preço (Mínimo, Máximo, Médio, Mediana) para um item CATMAT/CATSER.
 * @param params Os parâmetros de busca (codigoItem e datas opcionais).
 * @returns O resultado das estatísticas de preço.
 */
export async function fetchPriceStats(params: PriceStatsSearchParams): Promise<PriceStatsResult> {
    try {
        const { data, error } = await supabase.functions.invoke('fetch-price-stats', {
            body: params,
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de busca de estatísticas de preço.");
        }
        
        const responseData = data as PriceStatsResult; 
        
        if ((responseData as any).error) {
            throw new Error((responseData as any).error);
        }
        
        return responseData;

    } catch (error) {
        console.error("Erro ao buscar estatísticas de preço:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
        
        throw new Error(`Falha ao buscar estatísticas de preço: ${errorMessage}`);
    }
}

/**
 * Busca a lista detalhada de itens que compõem as estatísticas de preço.
 * @param params Os parâmetros de busca (codigoItem e datas opcionais).
 * @returns Uma lista de itens detalhados de preço.
 */
export async function fetchPriceStatsDetails(params: PriceStatsSearchParams): Promise<PriceItemDetail[]> {
    try {
        // NOTE: Assumimos que existe uma Edge Function 'fetch-price-stats-details'
        // que retorna a lista bruta de itens de preço.
        const { data, error } = await supabase.functions.invoke('fetch-price-stats-details', {
            body: params,
        });

        if (error) {
            throw new Error(error.message || "Falha na execução da Edge Function de busca de detalhes de preço.");
        }
        
        const responseData = data as PriceItemDetail[]; 
        
        if ((responseData as any).error) {
            throw new Error((responseData as any).error);
        }
        
        // Mapeamento e sanitização (assumindo que a Edge Function já retorna o formato PriceItemDetail)
        return Array.isArray(responseData) ? responseData : [];

    } catch (error) {
        console.error("Erro ao buscar detalhes de estatísticas de preço:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
        
        throw new Error(`Falha ao buscar detalhes de preço: ${errorMessage}`);
    }
}