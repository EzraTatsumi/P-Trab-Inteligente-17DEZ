import { toast } from "sonner";
import { supabase } from "./client"; // Importar o cliente Supabase
import { Profile } from "@/types/profiles"; // Importar o novo tipo Profile
import { MaterialConsumoSubitem, MaterialConsumoSubitemInsert, MaterialConsumoSubitemUpdate, MaterialConsumoItem, MaterialConsumoItemInsert, MaterialConsumoItemUpdate } from "@/types/materialConsumo";

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

// --- Material Consumo Subitems CRUD ---

export async function fetchMaterialConsumoSubitems(): Promise<MaterialConsumoSubitem[]> {
  const { data, error } = await supabase
    .from('material_consumo_subitens')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error("Erro ao buscar subitens de material de consumo:", error);
    throw new Error("Falha ao carregar subitens.");
  }
  return data;
}

export async function createMaterialConsumoSubitem(subitem: MaterialConsumoSubitemInsert): Promise<MaterialConsumoSubitem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from('material_consumo_subitens')
    .insert({ ...subitem, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar subitem de material de consumo:", error);
    throw new Error("Falha ao criar subitem.");
  }
  toast.success(`Subitem "${data.nome}" criado com sucesso.`);
  return data;
}

export async function updateMaterialConsumoSubitem(id: string, subitem: MaterialConsumoSubitemUpdate): Promise<MaterialConsumoSubitem> {
  const { data, error } = await supabase
    .from('material_consumo_subitens')
    .update(subitem)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar subitem de material de consumo:", error);
    throw new Error("Falha ao atualizar subitem.");
  }
  toast.success(`Subitem "${data.nome}" atualizado com sucesso.`);
  return data;
}

export async function deleteMaterialConsumoSubitem(id: string): Promise<void> {
  const { error } = await supabase
    .from('material_consumo_subitens')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Erro ao deletar subitem de material de consumo:", error);
    throw new Error("Falha ao deletar subitem.");
  }
  toast.success("Subitem deletado com sucesso.");
}

// --- Material Consumo Items CRUD ---

export async function fetchMaterialConsumoItems(subitemId: string): Promise<MaterialConsumoItem[]> {
  const { data, error } = await supabase
    .from('material_consumo_itens')
    .select('*')
    .eq('subitem_id', subitemId)
    .order('descricao', { ascending: true });

  if (error) {
    console.error("Erro ao buscar itens de material de consumo:", error);
    throw new Error("Falha ao carregar itens.");
  }
  return data;
}

export async function createMaterialConsumoItem(item: MaterialConsumoItemInsert): Promise<MaterialConsumoItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from('material_consumo_itens')
    .insert({ ...item, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar item de material de consumo:", error);
    throw new Error("Falha ao criar item.");
  }
  toast.success(`Item "${data.descricao}" criado com sucesso.`);
  return data;
}

export async function updateMaterialConsumoItem(id: string, item: MaterialConsumoItemUpdate): Promise<MaterialConsumoItem> {
  const { data, error } = await supabase
    .from('material_consumo_itens')
    .update(item)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar item de material de consumo:", error);
    throw new Error("Falha ao atualizar item.");
  }
  toast.success(`Item "${data.descricao}" atualizado com sucesso.`);
  return data;
}

export async function deleteMaterialConsumoItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('material_consumo_itens')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Erro ao deletar item de material de consumo:", error);
    throw new Error("Falha ao deletar item.");
  }
  toast.success("Item deletado com sucesso.");
}