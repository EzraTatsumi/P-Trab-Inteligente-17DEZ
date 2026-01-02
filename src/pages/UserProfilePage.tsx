import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserProfile } from "@/integrations/supabase/api";
import { profileSchema, omSchema } from "@/lib/validationSchemas";
import { Profile, ProfileFormValues } from "@/types/profiles";
import { TablesUpdate } from "@/integrations/supabase/types";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { toast } from "sonner";
import { Loader2, User, Save, Building2, ChevronDown, ChevronUp, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatCodug } from "@/lib/formatUtils";
import { Label } from "@/components/ui/label"; // Adicionado Label

const UserProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // 1. Fetch Profile Data
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserProfile,
    staleTime: 1000 * 60 * 5,
  });
  
  // 2. Fetch Military Organizations
  const { data: oms, isLoading: isLoadingOMs } = useMilitaryOrganizations();
  
  // 3. Initialize Form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: useMemo(() => {
      if (profile) {
        const omDetails = profile.om_details;
        return {
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          avatar_url: profile.avatar_url || "",
          default_diretriz_year: profile.default_diretriz_year || null,
          om_id: omDetails?.id || null,
          om_name: omDetails?.nome_om || "",
          om_ug: omDetails?.codug_om || "",
        };
      }
      return {
        first_name: "",
        last_name: "",
        avatar_url: "",
        default_diretriz_year: null,
        om_id: null,
        om_name: "",
        om_ug: "",
      };
    }, [profile]),
    values: useMemo(() => {
        if (profile) {
            const omDetails = profile.om_details;
            return {
                first_name: profile.first_name || "",
                last_name: profile.last_name || "",
                avatar_url: profile.avatar_url || "",
                default_diretriz_year: profile.default_diretriz_year || null,
                om_id: omDetails?.id || null,
                om_name: omDetails?.nome_om || "",
                om_ug: omDetails?.codug_om || "",
            };
        }
        return undefined;
    }, [profile]),
  });
  
  // 4. Mutation for saving profile
  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!profile) throw new Error("Perfil não carregado.");
      
      // 1. Update profiles table
      const profileUpdate: TablesUpdate<'profiles'> = {
        first_name: values.first_name,
        last_name: values.last_name,
        avatar_url: values.avatar_url,
        default_diretriz_year: values.default_diretriz_year,
      };
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', profile.id);
        
      if (profileError) throw profileError;
      
      // 2. Update auth.users metadata (for first/last name)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: values.first_name,
          last_name: values.last_name,
        }
      });
      
      if (authError) console.warn("Falha ao atualizar metadados do usuário:", authError);
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["militaryOrganizations"] });
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });
  
  // Efeito para tentar carregar a OM padrão se o perfil for carregado e não tiver OM definida
  useEffect(() => {
    if (profile && !isLoadingOMs && oms && oms.length > 0) {
      const currentOmId = form.getValues("om_id");
      
      // Se o perfil não tem OM definida (om_details é null ou om_id é null)
      if (!currentOmId) {
        // Tenta usar a primeira OM da lista como padrão
        const firstOM = oms[0];
        form.setValue("om_id", firstOM.id);
        form.setValue("om_name", firstOM.nome_om);
        form.setValue("om_ug", firstOM.codug_om);
        // Nota: Isso apenas preenche o formulário, não salva no DB automaticamente.
      }
    }
  }, [profile, isLoadingOMs, oms, form]);
  
  // 5. Handle OM Selection Change
  const handleOMSelect = (omId: string) => {
    const selectedOM = oms?.find(om => om.id === omId);
    if (selectedOM) {
      form.setValue("om_id", selectedOM.id);
      form.setValue("om_name", selectedOM.nome_om);
      form.setValue("om_ug", selectedOM.codug_om);
    } else {
      form.setValue("om_id", null);
      form.setValue("om_name", "");
      form.setValue("om_ug", "");
    }
  };
  
  // 6. Handle Form Submission
  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  const isLoading = isLoadingProfile || isLoadingOMs;
  const isSaving = updateProfileMutation.isPending;
  
  if (profileError) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <p className="text-destructive">Erro ao carregar perfil: {profileError.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Planos de Trabalho
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Editar Perfil do Usuário
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais e configurações padrão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados...</span>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  {/* Seção 1: Informações Pessoais */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Informações Pessoais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="first_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primeiro Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Seu primeiro nome" {...field} disabled={isSaving} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="last_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sobrenome</FormLabel>
                            <FormControl>
                              <Input placeholder="Seu sobrenome" {...field} disabled={isSaving} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="avatar_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL do Avatar (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://exemplo.com/avatar.jpg" {...field} disabled={isSaving} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Seção 2: Configurações Padrão */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      Configurações Padrão
                    </h3>
                    
                    {/* Campo de Seleção de OM */}
                    <FormField
                      control={form.control}
                      name="om_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organização Militar Padrão</FormLabel>
                          <Select 
                            onValueChange={handleOMSelect} 
                            value={field.value || ""}
                            disabled={isSaving || isLoadingOMs}
                          >
                            <FormControl>
                              <SelectTrigger id="sigla_om" className="justify-start">
                                <SelectValue placeholder="Selecione a OM">
                                  {/* Exibe o nome da OM do formulário */}
                                  {form.watch("om_name") || "Selecione a OM"}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {oms?.map((om) => (
                                <SelectItem key={om.id} value={om.id}>
                                  {om.nome_om}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Exibição do CODUG da OM Padrão */}
                    <div className="space-y-2">
                      <Label>CODUG da OM Padrão</Label>
                      <Input 
                        value={form.watch("om_ug") ? formatCodug(form.watch("om_ug")) : "N/A"} 
                        readOnly 
                        disabled 
                        className="bg-muted"
                      />
                    </div>

                    {/* Campo de Ano Padrão de Diretriz */}
                    <FormField
                      control={form.control}
                      name="default_diretriz_year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ano Padrão da Diretriz de Custeio</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Ex: 2024"
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                field.onChange(isNaN(value) ? null : value);
                              }}
                              disabled={isSaving}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving || isLoading}>
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar Alterações
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;