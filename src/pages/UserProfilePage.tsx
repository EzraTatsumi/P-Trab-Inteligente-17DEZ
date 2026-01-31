import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesUpdate, Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, LogOut } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Separator } from "@/components/ui/separator";
import { sanitizeError } from "@/lib/errorUtils";

type ProfileRow = Tables<'profiles'>;
type AuthUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];

interface UserProfileData {
  id: string;
  first_name: string;
  last_name: string;
  posto_graduacao: string;
  nome_om: string;
  telefone: string;
  default_logistica_year: number | null;
  default_operacional_year: number | null;
}

const profileSchema = z.object({
  first_name: z.string().min(1, "Nome é obrigatório."),
  last_name: z.string().min(1, "Sobrenome é obrigatório."),
  posto_graduacao: z.string().min(1, "Posto/Graduação é obrigatório."),
  nome_om: z.string().min(1, "Nome da OM é obrigatório."),
  telefone: z.string().optional().nullable(),
  default_logistica_year: z.number().nullable(),
  default_operacional_year: z.number().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR + 2 - i);

async function fetchUserProfileData(authUser: AuthUser): Promise<UserProfileData> {
  if (!authUser) throw new Error("Usuário não autenticado.");

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  const authMetaData = authUser.user_metadata as any;

  if (profileError) {
    // Se o perfil não existir (erro 406/PGRST116), retorna dados baseados no auth user
    if (profileError.code === 'PGRST116' || profileError.details?.includes('0 rows')) {
        return {
            id: authUser.id,
            first_name: authMetaData?.first_name || '',
            last_name: authMetaData?.last_name || '',
            posto_graduacao: authMetaData?.posto_graduacao || '',
            nome_om: authMetaData?.nome_om || '',
            telefone: authMetaData?.telefone || '',
            default_logistica_year: null,
            default_operacional_year: null,
        };
    }
    console.error("Error fetching profile:", profileError);
    throw profileError;
  }
  
  // Se o perfil existir (profileData é ProfileRow)
  
  // Linha 95 (metaData)
  const metaData = profileData.raw_user_meta_data as any; 
  
  // Linhas 97-104 (Retorno corrigido)
  return {
      id: profileData.id, 
      first_name: profileData.first_name || '', 
      last_name: profileData.last_name || '', 
      posto_graduacao: metaData?.posto_graduacao || '',
      nome_om: metaData?.nome_om || '',
      telefone: metaData?.telefone || '', 
      default_logistica_year: profileData.default_logistica_year, // FIX: default_diretriz_year -> default_logistica_year
      default_operacional_year: profileData.default_operacional_year,
  };
}


const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<UserProfileData | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      posto_graduacao: '',
      nome_om: '',
      telefone: '',
      default_logistica_year: null,
      default_operacional_year: null,
    },
  });
  
  const defaultLogisticaYear = watch('default_logistica_year');
  const defaultOperacionalYear = watch('default_operacional_year');

  const loadProfile = useCallback(async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchUserProfileData(user);
      setInitialData(data);
      reset(data);
    } catch (error: any) {
      toast.error("Erro ao carregar perfil.", { description: sanitizeError(error) });
    } finally {
      setLoading(false);
    }
  }, [user, navigate, reset]);

  useEffect(() => {
    if (!isSessionLoading && user) {
      loadProfile();
    } else if (!isSessionLoading && !user) {
      navigate("/login");
    }
  }, [isSessionLoading, user, loadProfile, navigate]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    try {
      // 1. Update auth user metadata (for institutional fields)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          posto_graduacao: data.posto_graduacao,
          nome_om: data.nome_om,
          telefone: data.telefone,
        },
      });

      if (authError) throw authError;

      // 2. Update public.profiles table (for custom fields and defaults)
      const profileUpdate: TablesUpdate<'profiles'> = {
        first_name: data.first_name,
        last_name: data.last_name,
        default_logistica_year: data.default_logistica_year,
        default_operacional_year: data.default_operacional_year,
        // Update raw_user_meta_data to store institutional fields in the profile table as well
        raw_user_meta_data: {
            posto_graduacao: data.posto_graduacao,
            nome_om: data.nome_om,
            telefone: data.telefone,
        } as Json,
      };
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileUpdate)
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success("Perfil atualizado com sucesso!");
      loadProfile(); // Reload to ensure consistency
    } catch (error: any) {
      toast.error("Falha ao salvar perfil.", { description: sanitizeError(error) });
      console.error("Save error:", error);
    }
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Configuração de Perfil</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados Pessoais e Institucionais</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nome</Label>
                  <Input id="first_name" {...register("first_name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Sobrenome (Nome de Guerra)</Label>
                  <Input id="last_name" {...register("last_name")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="posto_graduacao">Posto/Graduação</Label>
                  <Input id="posto_graduacao" {...register("posto_graduacao")} placeholder="Ex: Cap, 1º Sgt, Cel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome_om">Sigla da OM</Label>
                  <Input id="nome_om" {...register("nome_om")} placeholder="Ex: Cia C 23 Bda Inf Sl" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone (Opcional)</Label>
                <Input id="telefone" {...register("telefone")} placeholder="Ex: (91) 99999-9999" />
              </div>

              <Separator />

              <h3 className="text-lg font-semibold pt-2">Configurações Padrão</h3>
              <p className="text-sm text-muted-foreground">
                Defina o ano de referência padrão para as diretrizes de custeio e operacionais ao criar novos P Trabs.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_logistica_year">Ano Padrão Logística (Custeio)</Label>
                  <Select
                    value={defaultLogisticaYear?.toString() || ""}
                    onValueChange={(value) => setValue("default_logistica_year", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger id="default_logistica_year">
                      <SelectValue placeholder="Ano Atual" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEAR_OPTIONS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="default_operacional_year">Ano Padrão Operacional (Diárias/Verbas)</Label>
                  <Select
                    value={defaultOperacionalYear?.toString() || ""}
                    onValueChange={(value) => setValue("default_operacional_year", value ? parseInt(value) : null)}
                  >
                    <SelectTrigger id="default_operacional_year">
                      <SelectValue placeholder="Ano Atual" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEAR_OPTIONS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;