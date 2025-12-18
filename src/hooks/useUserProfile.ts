import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { sanitizeError } from "@/lib/errorUtils";

// Tipo de dados do perfil (incluindo metadados)
export interface UserProfile extends Tables<'profiles'> {
  email: string;
  posto_graduacao: string;
  nome_om: string;
}

// Tipo de dados para o formulário de atualização
export interface UserProfileForm {
  first_name: string;
  last_name: string;
  posto_graduacao: string;
  nome_om: string;
}

const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  // 1. Buscar dados do perfil (tabela public.profiles)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    throw new Error("Falha ao carregar dados do perfil.");
  }
  
  // 2. Buscar email do auth.users (não acessível diretamente via RLS, mas podemos usar o cliente autenticado)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
      throw new Error("Usuário não autenticado.");
  }
  
  // 3. Extrair metadados (posto_graduacao e nome_om)
  const rawMetadata = profileData.raw_user_meta_data as { posto_graduacao?: string, nome_om?: string } | undefined;

  return {
    ...profileData,
    email: user.email || '',
    posto_graduacao: rawMetadata?.posto_graduacao || '',
    nome_om: rawMetadata?.nome_om || '',
  } as UserProfile;
};

const updateProfile = async (userId: string, formData: UserProfileForm) => {
  // 1. Atualizar a tabela profiles (first_name, last_name)
  const profileUpdate: TablesUpdate<'profiles'> = {
    first_name: formData.first_name,
    last_name: formData.last_name,
  };
  
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', userId);

  if (profileError) {
    throw profileError;
  }
  
  // 2. Atualizar metadados do usuário (posto_graduacao, nome_om)
  // Nota: Estes campos são armazenados em auth.users.raw_user_meta_data.
  // A atualização deve ser feita via `supabase.auth.updateUser`.
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      posto_graduacao: formData.posto_graduacao,
      nome_om: formData.nome_om,
    }
  });
  
  if (authError) {
    throw authError;
  }
};

export const useUserProfile = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const profileQuery = useQuery<UserProfile, Error>({
    queryKey: ['userProfile', user?.id],
    queryFn: () => fetchUserProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateProfileMutation = useMutation({
    mutationFn: (formData: UserProfileForm) => updateProfile(user!.id, formData),
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      // Invalida a query para forçar o refetch e atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
      // Também invalida a sessão para atualizar o user_metadata no SessionContextProvider
      queryClient.invalidateQueries({ queryKey: ['supabaseSession'] }); 
    },
    onError: (error) => {
      console.error("Update profile error:", error);
      toast.error(sanitizeError(error) || "Falha ao atualizar o perfil.");
    },
  });

  return {
    profileQuery,
    updateProfileMutation,
  };
};