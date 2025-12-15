import { toast } from "sonner";
import { supabase } from "./client"; // Importar o cliente Supabase
import { RefLPC } from "@/types/refLPC";

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

/**
 * Fetches the latest RefLPC record associated with a specific PTrab ID.
 * @param pTrabId The ID of the PTrab.
 * @returns The RefLPC data or undefined if not found.
 */
export async function getRefLPC(pTrabId: string): Promise<RefLPC | undefined> {
  try {
    const { data, error } = await supabase
      .from('p_trab_ref_lpc')
      .select('*')
      .eq('p_trab_id', pTrabId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return data as RefLPC;
    }
    return undefined;
  } catch (error) {
    console.error("Erro ao buscar RefLPC:", error);
    // Não exibe toast aqui, pois a ausência de RefLPC é um estado normal.
    return undefined;
  }
}