import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";

export interface DiretrizClasseIXUpdate {
  id: string;
  valor_mnt_dia?: number;
  valor_acionamento_mensal?: number;
}

export async function updateDiretrizClasseIX(data: DiretrizClasseIXUpdate) {
  const { id, ...updates } = data;
  
  const { error } = await supabase
    .from('diretrizes_classe_ix')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error("Error updating Classe IX directive:", error);
    toast.error("Erro ao salvar diretriz da Classe IX.");
    throw new Error(error.message);
  }
  
  return { success: true };
}

// Placeholder for fetching, assuming it exists elsewhere or will be added to this file later.
// For now, we only focus on the update function needed for the mutation.