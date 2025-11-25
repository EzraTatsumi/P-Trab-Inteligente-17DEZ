import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Verifica o status de um PTrab e o atualiza para 'em_andamento' se estiver 'aberto'.
 * @param ptrabId O ID do Plano de Trabalho.
 */
export async function updatePTrabStatusIfAberto(ptrabId: string) {
  try {
    const { data: ptrab, error: fetchError } = await supabase
      .from('p_trab')
      .select('status')
      .eq('id', ptrabId)
      .single();

    if (fetchError) {
      console.error("Erro ao buscar status do PTrab:", fetchError);
      return;
    }

    if (ptrab.status === 'aberto') {
      const { error: updateError } = await supabase
        .from('p_trab')
        .update({ status: 'em_andamento' })
        .eq('id', ptrabId);

      if (updateError) {
        console.error("Erro ao atualizar status do PTrab para 'em_andamento':", updateError);
        toast.error("Erro ao atualizar status do PTrab.");
      } else {
        toast.success("Status do PTrab atualizado para 'Em Andamento'!");
      }
    }
  } catch (error) {
    console.error("Erro inesperado ao atualizar status do PTrab:", error);
  }
}