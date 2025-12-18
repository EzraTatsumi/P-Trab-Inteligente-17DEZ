import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  credit_gnd3: number;
  credit_gnd4: number;
  default_diretriz_year: number | null;
  raw_user_meta_data: any;
}

// Modified fetchProfile to accept userId
const fetchProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data as Profile;
};

const updateProfile = async (profileData: Partial<Profile>): Promise<Profile> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(profileData)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
};

export const useProfile = () => {
  const { user, loading: loadingSession } = useSession();
  
  return useQuery<Profile, Error>({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    // Enable query only if user ID is available and session is not loading
    enabled: !!user?.id && !loadingSession, 
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, Partial<Profile>>({
    mutationFn: updateProfile,
    onSuccess: (newProfile) => {
      // Invalidate the query to ensure fresh data if needed, or set the data directly
      queryClient.setQueryData(["profile", newProfile.id], newProfile);
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar perfil: ${error.message}`);
    },
  });
};