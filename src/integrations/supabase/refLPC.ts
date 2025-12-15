import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefLPCData } from "@/schemas/refLPC";

export async function getRefLPC(p_trab_id: string) {
  const { data, error } = await supabase
    .from("p_trab_ref_lpc")
    .select("*")
    .eq("p_trab_id", p_trab_id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Error fetching RefLPC:", error);
    toast.error("Erro ao buscar referência LPC.");
    return null;
  }

  return data as RefLPCData | null;
}

export async function saveRefLPC(data: RefLPCData) {
  const { id, ...updateData } = data;

  if (id) {
    // Update existing record
    const { data: updatedData, error } = await supabase
      .from("p_trab_ref_lpc")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating RefLPC:", error);
      toast.error("Erro ao atualizar referência LPC.");
      return null;
    }
    toast.success("Referência LPC atualizada com sucesso!");
    return updatedData as RefLPCData;
  } else {
    // Insert new record
    const { data: insertedData, error } = await supabase
      .from("p_trab_ref_lpc")
      .insert(updateData)
      .select()
      .single();

    if (error) {
      console.error("Error inserting RefLPC:", error);
      toast.error("Erro ao salvar referência LPC.");
      return null;
    }
    toast.success("Referência LPC salva com sucesso!");
    return insertedData as RefLPCData;
  }
}