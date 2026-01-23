import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OMData } from "@/lib/omUtils";

/**
 * Fetches the list of global/standard Military Organizations (OMs) 
 * that are not linked to any specific user (user_id IS NULL).
 * This list is used for public access, such as the signup page.
 * 
 * @returns Query result containing OMData[]
 */
export const useGlobalMilitaryOrganizations = () => {
    return useQuery({
        queryKey: ["globalMilitaryOrganizations"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("organizacoes_militares")
                .select("*")
                .is("user_id", null) // Filter for global OMs
                .eq("ativo", true)
                .order("nome_om", { ascending: true });

            if (error) throw error;
            return data as OMData[];
        },
        staleTime: Infinity, // These are static global data, cache indefinitely
    });
};