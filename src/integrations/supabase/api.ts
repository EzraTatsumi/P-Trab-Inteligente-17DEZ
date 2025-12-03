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
      throw new Error(`Failed to fetch ${fuelType} price: ${response.statusText}`);
    }
    const data: PriceResponse = await response.json();
    
    if (typeof data.preco !== 'number') {
        throw new Error("Invalid response format from external API: 'preco' field missing or invalid.");
    }
    
    return {
      price: data.preco,
      source: "ANP (API Externa)", // Definindo a fonte conforme solicitado
    };
  } catch (error) {
    console.error(`Error fetching ${fuelType} price:`, error);
    toast.error(`Falha ao consultar preço da ${fuelType}. Verifique a conexão.`);
    throw error;
  }
}