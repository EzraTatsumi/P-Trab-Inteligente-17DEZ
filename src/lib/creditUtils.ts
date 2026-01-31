import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<'profiles'>;

/**
 * Busca os créditos atuais do usuário.
 */
export async function fetchUserCredits(userId: string): Promise<{ credit_gnd3: number, credit_gnd4: number }> {
    const { data, error } = await supabase
        .from('profiles')
        .select('credit_gnd3, credit_gnd4')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Error fetching user credits:", error);
        throw new Error("Failed to fetch user credits.");
    }

    return {
        credit_gnd3: data.credit_gnd3,
        credit_gnd4: data.credit_gnd4,
    };
}

/**
 * Atualiza os créditos do usuário.
 */
export async function updateUserCredits(userId: string, gnd3Change: number, gnd4Change: number) {
    // Busca os créditos atuais
    const currentCredits = await fetchUserCredits(userId);

    const newGnd3 = currentCredits.credit_gnd3 + gnd3Change;
    const newGnd4 = currentCredits.credit_gnd4 + gnd4Change;

    const { error } = await supabase
        .from('profiles')
        .update({ 
            credit_gnd3: newGnd3, 
            credit_gnd4: newGnd4,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) {
        console.error("Error updating user credits:", error);
        throw new Error("Failed to update user credits.");
    }
}