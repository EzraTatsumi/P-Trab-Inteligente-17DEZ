import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeError } from "./errorUtils";

/**
 * Verifica se o usuário tem crédito suficiente para uma operação.
 * @param userId ID do usuário
 * @param requiredAmount Quantidade de crédito necessária
 * @returns true se tiver crédito, false caso contrário
 */
export async function checkUserCredit(userId: string, requiredAmount: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('credit')
      .eq('id', userId)
      .single();

    if (error) throw error;

    if (data.credit >= requiredAmount) {
      return true;
    } else {
      toast.error(`Crédito insuficiente. Necessário: ${requiredAmount}, Disponível: ${data.credit}.`);
      return false;
    }
  } catch (error) {
    console.error("Erro ao verificar crédito:", error);
    toast.error(sanitizeError(error));
    return false;
  }
}

/**
 * Deduz o crédito do usuário após uma operação bem-sucedida.
 * @param userId ID do usuário
 * @param amountToDeduct Quantidade a deduzir
 */
export async function deductUserCredit(userId: string, amountToDeduct: number): Promise<void> {
  try {
    const { error } = await supabase.rpc('deduct_user_credit', {
      p_user_id: userId,
      p_amount: amountToDeduct,
    });

    if (error) throw error;
    
  } catch (error) {
    console.error("Erro ao deduzir crédito:", error);
    toast.error(sanitizeError(error));
    throw new Error("Falha ao deduzir crédito.");
  }
}