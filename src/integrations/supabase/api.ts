import { toast } from "sonner";

const DIESEL_API_URL = "https://api-preco-combustivel.onrender.com/diesel";
const GASOLINA_API_URL = "https://api-preco-combustivel.onrender.com/gasolina";

interface PriceResponse {
  preco: number; // Corrigido para 'preco'
}

/**
 * Fetches the latest price for a given fuel type from the external API.
 * @param fuelType 'diesel' or 'gasolina'
 * @returns The price and source information.
 */
export async function fetchFuelPrice(fuelType: 'diesel' | 'gasolina'): Promise<{ price: number, source: string }> {
  const url = fuelType === 'diesel' ? DIESEL_API_URL : GASOLINA_API_URL;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      // Se a resposta não for OK, lança um erro com o status
      throw new Error(`Falha na requisição: Status ${response.status} - ${response.statusText}`);
    }
    
    const data: PriceResponse = await response.json();
    
    if (typeof data.preco !== 'number') {
        throw new Error("Formato de resposta inválido: campo 'preco' ausente ou não numérico.");
    }
    
    return {
      price: data.preco,
      source: "ANP (API Externa)", // Definindo a fonte conforme solicitado
    };
  } catch (error) {
    console.error(`Erro ao buscar preço de ${fuelType}:`, error);
    
    let errorMessage = "Verifique sua conexão com a internet.";
    if (error instanceof Error) {
        // Se for um erro de requisição (ex: status 404, 500), mostra a mensagem detalhada
        if (error.message.includes("Falha na requisição")) {
            errorMessage = error.message;
        } else if (error.message.includes("Formato de resposta inválido")) {
            errorMessage = error.message;
        }
    }
    
    toast.error(`Falha ao consultar preço da ${fuelType}. ${errorMessage}`);
    throw error;
  }
}