import { supabase } from "@/integrations/supabase/client";
import { 
  MaterialConsumoSubitem, 
  MaterialConsumoItem, 
  MaterialConsumoSubitemInsert, 
  MaterialConsumoSubitemUpdate, 
  MaterialConsumoItemInsert, 
  MaterialConsumoItemUpdate,
  GlobalSubitemCatalog,
} from "@/types/materialConsumo";
import { Tables } from "@/integrations/supabase/types";

// =================================================================
// FUNÇÕES DE SUBITEM (Personalizado do Usuário)
// =================================================================

export async function fetchMaterialConsumoSubitems(): Promise<MaterialConsumoSubitem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('material_consumo_subitens')
    .select('*')
    .eq('user_id', user.id)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as MaterialConsumoSubitem[];
}

export async function createMaterialConsumoSubitem(data: MaterialConsumoSubitemInsert): Promise<MaterialConsumoSubitem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const insertData: Tables<'material_consumo_subitens'> = {
    ...data,
    user_id: user.id,
    nr_subitem: data.nr_subitem || null,
    descricao: data.descricao || null,
  };

  const { data: newSubitem, error } = await supabase
    .from('material_consumo_subitens')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;
  return newSubitem as MaterialConsumoSubitem;
}

export async function updateMaterialConsumoSubitem(id: string, data: MaterialConsumoSubitemUpdate): Promise<void> {
  const { error } = await supabase
    .from('material_consumo_subitens')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMaterialConsumoSubitem(id: string): Promise<void> {
  const { error } = await supabase
    .from('material_consumo_subitens')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =================================================================
// FUNÇÕES DE ITEM (Personalizado do Usuário)
// =================================================================

export async function fetchMaterialConsumoItems(subitemId: string): Promise<MaterialConsumoItem[]> {
  const { data, error } = await supabase
    .from('material_consumo_itens')
    .select('*')
    .eq('subitem_id', subitemId)
    .order('descricao', { ascending: true });

  if (error) throw error;
  return data as MaterialConsumoItem[];
}

export async function createMaterialConsumoItem(data: MaterialConsumoItemInsert): Promise<MaterialConsumoItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const insertData: Tables<'material_consumo_itens'> = {
    ...data,
    user_id: user.id,
    pregao: data.pregao || null,
    uasg: data.uasg || null,
  };

  const { data: newItem, error } = await supabase
    .from('material_consumo_itens')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;
  return newItem as MaterialConsumoItem;
}

export async function updateMaterialConsumoItem(id: string, data: MaterialConsumoItemUpdate): Promise<void> {
  const { error } = await supabase
    .from('material_consumo_itens')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMaterialConsumoItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('material_consumo_itens')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// =================================================================
// FUNÇÃO DE CATÁLOGO GLOBAL (NOVA)
// =================================================================

/**
 * Busca todos os subitens do catálogo global (leitura pública).
 */
export async function fetchGlobalSubitemCatalog(): Promise<GlobalSubitemCatalog[]> {
  // Não precisa de user_id, pois o RLS permite leitura pública (true)
  const { data, error } = await supabase
    .from('catalogo_subitens_global')
    .select('id, nr_subitem, nome_subitem, descricao_subitem, created_at')
    .order('nome_subitem', { ascending: true });

  if (error) {
    console.error("Erro ao buscar catálogo global:", error);
    // Retorna array vazio em caso de erro para não quebrar o app
    return []; 
  }
  
  // Mapeia os nomes das colunas do DB para o tipo GlobalSubitemCatalog
  return (data || []).map(d => ({
    id: d.id,
    nr_subitem: d.nr_subitem,
    nome_subitem: d.nome_subitem,
    descricao_subitem: d.descricao_subitem,
    created_at: d.created_at,
  })) as GlobalSubitemCatalog[];
}