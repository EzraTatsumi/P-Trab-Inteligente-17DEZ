import { supabase } from "@/integrations/supabase/client";
import { TablesUpdate } from "@/integrations/supabase/types";

// Define a type for the profiles table structure needed here
interface ProfileCredits {
  credit_gnd3: number;
  credit_gnd4: number;
}

/**
 * Busca os valores de crédito GND 3 e GND 4 para o usuário logado.
 * @returns Um objeto com credit_gnd3 e credit_gnd4, ou valores padrão (0) em caso de erro/não encontrado.
 */
export async function fetchUserCredits(userId: string): Promise<{ credit_gnd3: number, credit_gnd4: number }> {
  try {
    const { data, error } = await supabase
      .from('profiles' as any) // Cast to any to bypass TS error
      .select('credit_gnd3, credit_gnd4')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      throw error;
    }

    const profileData = data as unknown as ProfileCredits | null; // Cast data to the expected structure

    return {
      credit_gnd3: Number(profileData?.credit_gnd3 || 0),
      credit_gnd4: Number(profileData?.credit_gnd4 || 0),
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
  const updateData = { // Removed TablesUpdate<'profiles'> type assertion
    credit_gnd3: gnd3,
    credit_gnd4: gnd4,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles' as any) // Cast to any
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error("Erro ao atualizar créditos:", error);
    throw new Error("Falha ao salvar os créditos no banco de dados.");
  }
}