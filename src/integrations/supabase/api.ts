import { toast } from "sonner";
import { supabase } from "./client"; // Importar o cliente Supabase
import { Profile } from "@/types/profiles"; // Importar o novo tipo Profile

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

    // Busca o perfil e a OM padrão do usuário (se houver)
    const { data: profileData, error } = await supabase
        .from('profiles')
        .select(`
            *,
            om_details:organizacoes_militares(id, nome_om, codug_om)
        `)
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!profileData) {
        // Se o perfil não existir, retorna um perfil básico (pode acontecer logo após o signup)
        return {
            id: user.id,
            first_name: '',
            last_name: '',
            avatar_url: '',
            updated_at: new Date().toISOString(),
            credit_gnd3: 0,
            credit_gnd4: 0,
            default_diretriz_year: null,
            raw_user_meta_data: null,
            om_details: null,
        } as Profile;
    }

    // O Supabase retorna om_details como um array se for um join, mas como maybeSingle, deve ser um objeto ou null.
    // Se o campo om_details for um array (devido a um join implícito), pegamos o primeiro elemento.
    const omDetails = Array.isArray(profileData.om_details) ? profileData.om_details[0] : profileData.om_details;

    return {
        ...profileData,
        om_details: omDetails,
    } as Profile;
}