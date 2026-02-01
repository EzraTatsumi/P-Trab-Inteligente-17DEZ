import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

/**
 * Clones an existing PTrab record and all its associated records (classes I-IX, passagens, diárias, etc.).
 * 
 * @param oldPTrabId The ID of the PTrab to clone.
 * @param newUserId The ID of the user who will own the new PTrab.
 * @param newNumeroPTrab The new PTrab number (e.g., suggested clone number).
 * @param newRotuloVersao The version label (e.g., 'Variação 1.0').
 * @returns The ID of the newly created PTrab.
 */
export async function clonePTrab(
    oldPTrabId: string,
    newUserId: string,
    newNumeroPTrab: string,
    newRotuloVersao: string
): Promise<string> {
    
    const { data, error } = await supabase.rpc('clone_ptrab_with_records', {
        old_ptrab_id: oldPTrabId,
        new_user_id: newUserId,
        new_numero_ptrab: newNumeroPTrab,
        new_rotulo_versao: newRotuloVersao,
    });

    if (error) {
        console.error("Error cloning PTrab:", error);
        throw new Error(`Falha ao clonar P Trab: ${error.message}`);
    }

    // The RPC returns the new PTrab ID
    return data as string;
}