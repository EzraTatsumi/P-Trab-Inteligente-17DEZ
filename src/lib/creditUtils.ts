import { supabase } from "@/integrations/supabase/client";
import { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Busca os valores de crédito GND 3 e GND 4 para o usuário logado.
 * @returns Um objeto com credit_gnd3 e credit_gnd4, ou valores padrão (0) em caso de erro/não encontrado.
 */
export async function fetchUserCredits(userId: string): Promise<{ credit_gnd3: number, credit_gnd4: number }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('credit_gnd3, credit_gnd4')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      throw error;
    }

    return {
      credit_gnd3: Number(data?.credit_gnd3 || 0),
      credit_gnd4: Number(data?.credit_gnd4 || 0),
    };
  } catch (error) {
    console.error("Erro ao buscar créditos do usuário:", error);
    return { credit_gnd3: 0, credit_gnd4: 0 };
  }
}

/**
 * Atualiza os valores de crédito GND 3 e GND 4 para o usuário logado.
 */
export async function updateUserCredits(userId: string, gnd3: number, gnd4: number) {
  const updateData: TablesUpdate<'profiles'> = {
    credit_gnd3: gnd3,
    credit_gnd4: gnd4,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error("Erro ao atualizar créditos:", error);
    throw new Error("Falha ao salvar os créditos no banco de dados.");
  }
}