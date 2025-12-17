import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { preparePTrabForCloning } from "@/lib/ptrabCloneUtils";

export type PTrabRow = Tables<'p_trab'>;

// Interface usada no frontend para incluir os totais calculados
export interface PTrabWithTotals extends PTrabRow {
  totalLogistica?: number;
  totalOperacional?: number;
  totalMaterialPermanente?: number;
  totalAviacaoExercito?: number;
  totalGeral?: number;
}

/**
 * Fetches a single PTrab record by ID.
 */
export async function fetchPTrabDetails(id: string): Promise<PTrabRow> {
  const { data, error } = await supabase
    .from('p_trab')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching PTrab details:", error);
    throw new Error(`Failed to load PTrab: ${error.message}`);
  }
  return data;
}

/**
 * Updates an existing PTrab record.
 */
export async function updatePTrab(id: string, data: Partial<PTrabRow>): Promise<PTrabRow> {
  const { data: updatedPTrab, error } = await supabase
    .from('p_trab')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating PTrab:", error);
    throw new Error(`Failed to update PTrab: ${error.message}`);
  }
  return updatedPTrab;
}

/**
 * Deletes a PTrab record by ID.
 */
export async function deletePTrab(id: string): Promise<void> {
  const { error } = await supabase
    .from('p_trab')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting PTrab:", error);
    throw new Error(`Failed to delete PTrab: ${error.message}`);
  }
}

/**
 * Clones an existing PTrab record for a new user or the same user.
 */
export async function clonePTrab(sourceId: string, userId: string): Promise<PTrabRow> {
  const { data: sourcePTrab, error: fetchError } = await supabase
    .from('p_trab')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (fetchError || !sourcePTrab) {
    throw new Error(`Source PTrab not found: ${fetchError?.message}`);
  }

  const dataToInsert = preparePTrabForCloning(sourcePTrab, userId);

  const { data: newPTrab, error: insertError } = await supabase
    .from('p_trab')
    .insert(dataToInsert)
    .select()
    .single();

  if (insertError) {
    console.error("Error cloning PTrab:", insertError);
    throw new Error(`Failed to clone PTrab: ${insertError.message}`);
  }
  
  // Nota: A clonagem de registros relacionados (Classes I, II, etc.) deve ser tratada separadamente.
  // Por enquanto, apenas o registro principal do PTrab é clonado.

  return newPTrab;
}

/**
 * Updates the status of a PTrab record.
 */
export async function updatePTrabStatus(id: string, status: PTrabRow['status']): Promise<PTrabRow> {
  const { data: updatedPTrab, error } = await supabase
    .from('p_trab')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating PTrab status:", error);
    throw new Error(`Failed to update PTrab status: ${error.message}`);
  }
  return updatedPTrab;
}