import { useQuery } from "@tanstack/react-query";
import { fetchUserCredits } from "@/lib/creditUtils";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<'profiles'>;

export const useUserCredits = (userId: string | undefined) => {
  return useQuery<{ credit_gnd3: number, credit_gnd4: number }, Error>({
    queryKey: ["userCredits", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required.");
      const credits = await fetchUserCredits(userId);
      return {
        credit_gnd3: credits.credit_gnd3,
        credit_gnd4: credits.credit_gnd4,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};