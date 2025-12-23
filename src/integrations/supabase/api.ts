import { toast } from "sonner";
import { supabase } from "./client"; // Importar o cliente Supabase

// Interface para a resposta consolidada da Edge Function
interface EdgeFunctionResponse {
  diesel: { price: number, source: string };
  gasolina: { price: number, source: string };
}

// NOVO: Interface para a Referência LPC
interface RefLPC {
  id: string;
  p_trab_id: string;
  data_inicio_consulta: string;
  data_fim_consulta: string;
  ambito: 'Nacional' | 'Estadual' | 'Municipal';
  nome_local: string | null;
  preco_diesel: number;
  preco_gasolina: number;
  source: 'Manual' | 'API';
  created_at: string;
  updated_at: string;
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
 * Fetches the RefLPC record for a given PTrab ID.
 * @param ptrabId The ID of the PTrab.
 * @returns RefLPC object or null if not found.
 */
export async function fetchRefLPC(ptrabId: string): Promise<RefLPC | null> {
    const { data, error } = await supabase
        .from('p_trab_ref_lpc')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching RefLPC:", error);
        throw error;
    }
    
    // Ensure numeric fields are treated as numbers if they exist
    if (data) {
        return {
            ...data,
            preco_diesel: Number(data.preco_diesel),
            preco_gasolina: Number(data.preco_gasolina),
            source: data.source as 'Manual' | 'API',
        } as RefLPC;
    }

    return null;
}