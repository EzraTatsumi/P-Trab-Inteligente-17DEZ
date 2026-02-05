import { supabase } from "@/integrations/supabase/client";
import { MaterialConsumoSubitem, MaterialConsumoItem, MaterialConsumoSubitemInsert, MaterialConsumoSubitemUpdate, MaterialConsumoItemInsert, MaterialConsumoItemUpdate, GlobalSubitemCatalog } from "@/types/materialConsumo";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// =================================================================
// MaterialConsumoSubitem (Diretrizes do Usuário)
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

  const insertData: TablesInsert<'material_consumo_subitens'> = {
    ...data,
    user_id: user.id,
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
    .update(data as TablesUpdate<'material_consumo_subitens'>)
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
// MaterialConsumoItem (Itens de Diretrizes do Usuário)
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

  const insertData: TablesInsert<'material_consumo_itens'> = {
    ...data,
    user_id: user.id,
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
    .update(data as TablesUpdate<'material_consumo_itens'>)
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
// Share Preview (Leitura Pública/Compartilhada)
// =================================================================

/**
 * Busca um subitem específico para visualização de compartilhamento.
 * Assume que a RLS está configurada para permitir a leitura por ID.
 */
export async function fetchSharePreview(subitemId: string): Promise<MaterialConsumoSubitem | null> {
  const { data, error } = await supabase
    .from('material_consumo_subitens')
    .select('*')
    .eq('id', subitemId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
    console.error("Erro ao buscar preview de compartilhamento:", error);
    throw error;
  }

  return data as MaterialConsumoSubitem | null;
}

// =================================================================
// Catálogo Global (Leitura)
// =================================================================

/**
 * Busca todos os subitens do catálogo global (acessível por qualquer usuário autenticado).
 */
export async function fetchGlobalSubitemCatalog(): Promise<GlobalSubitemCatalog[]> {
  const { data, error } = await supabase
    .from('catalogo_subitens_global')
    .select('id, nr_subitem, nome_subitem, descricao_subitem, created_at')
    .order('nome_subitem', { ascending: true });

  if (error) {
    // Se a tabela não existir, este erro será capturado.
    console.error("Erro ao buscar catálogo global:", error);
    throw error;
  }
  
  // O cast é seguro pois a RLS permite a leitura
  return data as GlobalSubitemCatalog[];
}