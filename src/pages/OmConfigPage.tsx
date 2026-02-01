import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Upload, Check, X, ChevronDown, ChevronUp, Download, Building2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { OMData, omSchema } from "@/lib/omUtils";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import * as z from "zod";
import { formatCodug } from "@/lib/formatUtils"; // Importar formatCodug (usado para strings de CODUG)

const fetchOMs = async (): Promise<OMData[]> => {
  const { data, error } = await supabase
    .from("organizacoes_militares")
    .select("*")
    .order("nome_om", { ascending: true });

  if (error) throw error;
  return data as OMData[];
};

const OmConfigPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { handleEnterToNextField } = useFormNavigation();
  
  // 1. Criar a referência para o formulário
  const formRef = useRef<HTMLFormElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false); // Estado para controlar o colapso do formulário
  const [formData, setFormData] = useState<z.infer<typeof omSchema>>({
    nome_om: "",
    codug_om: "",
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    cidade: "", // Adicionado cidade
    ativo: true,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [omToDelete, setOmToDelete] = useState<OMData | null>(null);
  
  // NOVO ESTADO: Filtro de pesquisa
  const [searchTerm, setSearchTerm] = useState("");

  const { data: oms, isLoading, error } = useQuery({
    queryKey: ["organizacoesMilitares"],
    queryFn: fetchOMs,
  });
  
  // Lógica de Filtragem
  const filteredOms = useMemo(() => {
    if (!oms) return [];
    if (!searchTerm) return oms;

    const lowerCaseSearch = searchTerm.toLowerCase();

    return oms.filter(om => 
      om.nome_om.toLowerCase().includes(lowerCaseSearch) ||
      om.codug_om.toLowerCase().includes(lowerCaseSearch) ||
      om.rm_vinculacao.toLowerCase().includes(lowerCaseSearch) ||
      om.codug_rm_vinculacao.toLowerCase().includes(lowerCaseSearch) ||
      om.cidade?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [oms, searchTerm]);


  // Efeito para abrir o formulário se estiver em modo de edição
  useEffect(() => {
    if (editingId) {
      setIsFormOpen(true);
    }
  }, [editingId]);

  // Tipo de dados para a mutação (inclui o ID opcional)
  type OmMutationData = (TablesInsert<'organizacoes_militares'> | TablesUpdate<'organizacoes_militares'>) & { id?: string };

  const mutation = useMutation({
    mutationFn: async (data: OmMutationData) => {
      if (data.id) {
        // Modo Edição
        const { id, ...updateData } = data;
        const { error } = await supabase
          .from("organizacoes_militares")
          .update(updateData as TablesUpdate<'organizacoes_militares'>)
          .eq("id", id);
        if (error) throw error;
      } else {
        // Modo Inserção
        const { error } = await supabase
          .from("organizacoes_militares")
          .insert(data as TablesInsert<'organizacoes_militares'>[]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizacoesMilitares"] });
      toast.success(`OM ${editingId ? "atualizada" : "adicionada"} com sucesso!`);
      resetForm();
      setIsFormOpen(false); // Fechar o formulário após o sucesso
    },
    onError: (err) => {
      toast.error(sanitizeError(err));
    },
  });

  const handleDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organizacoes_militares")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizacoesMilitares"] });
      toast.success("OM excluída com sucesso!");
      setOmToDelete(null);
      setShowDeleteDialog(false);
    },
    onError: (err) => {
      toast.error(sanitizeError(err));
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nome_om: "",
      codug_om: "",
      rm_vinculacao: "",
      codug_rm_vinculacao: "",
      cidade: "", // Resetar cidade
      ativo: true,
    });
  };

  const handleEdit = (om: OMData) => {
    setEditingId(om.id);
    setFormData({
      nome_om: om.nome_om,
      codug_om: om.codug_om,
      rm_vinculacao: om.rm_vinculacao,
      codug_rm_vinculacao: om.codug_rm_vinculacao,
      cidade: om.cidade || "", // Carregar cidade
      ativo: om.ativo,
    });
    
    // 4. Rolar para o formulário após definir o estado
    // Usamos setTimeout para garantir que o Collapsible tenha tempo de abrir (se estiver fechado)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleConfirmDelete = (om: OMData) => {
    setOmToDelete(om);
    setShowDeleteDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      omSchema.parse(formData);
      
      // Adiciona o ID ao objeto de dados se estiver em modo de edição
      const dataToMutate: OmMutationData = editingId 
        ? { ...formData, id: editingId } 
        : formData;
        
      mutation.mutate(dataToMutate);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Erro de validação desconhecido.");
      }
    }
  };

  const handleToggleActive = (om: OMData) => {
    // Usamos o ID da OM para a mutação de toggle
    mutation.mutate({ ...om, id: om.id, ativo: !om.ativo });
  };

  // Função para alternar o formulário e resetar se estiver fechando
  const handleToggleForm = () => {
    if (isFormOpen) {
      resetForm();
    } else {
      // Rolar para o formulário ao abrir
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    setIsFormOpen(!isFormOpen);
  };
  
  // Função para fechar o formulário e resetar o estado (usada pelo botão Cancelar interno)
  const handleCancelForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-destructive">Erro ao carregar OMs: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Organizações Militares (CODUG)</CardTitle>
            <CardDescription>
              Cadastre e gerencie as OMs e seus respectivos CODUGs para uso nos Planos de Trabalho.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Controles de Ação (Nova OM e Importação) */}
            <div className="flex justify-end items-center">
              <div className="flex gap-2">
                <Button 
                  variant={isFormOpen ? "secondary" : "default"} 
                  onClick={handleToggleForm}
                  className="w-[150px]"
                >
                  {isFormOpen ? (
                    <>
                      Fechar
                      <X className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Nova OM
                      <Plus className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => navigate("/config/om/bulk-upload")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Importar CSV/XLSX
                </Button>
              </div>
            </div>

            {/* Formulário de Cadastro/Edição (Colapsável) */}
            <Collapsible
              open={isFormOpen}
              onOpenChange={setIsFormOpen}
              className="space-y-4"
            >
              <CollapsibleContent>
                <h3 className="text-lg font-semibold mb-4">
                  {editingId ? "Editar OM" : "Cadastro de Nova OM"}
                </h3>
                {/* 3. Anexar a referência ao formulário */}
                <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/50">
                  
                  <div className="space-y-2">
                    <Label htmlFor="nome_om">Nome da OM (Sigla) *</Label>
                    <Input
                      id="nome_om"
                      value={formData.nome_om}
                      onChange={(e) => setFormData({ ...formData, nome_om: e.target.value })}
                      placeholder="Ex: 23ª Bda Inf Sl"
                      required
                      onKeyDown={handleEnterToNextField}
                      disabled={mutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codug_om">CODUG da OM *</Label>
                    <Input
                      id="codug_om"
                      value={formData.codug_om}
                      onChange={(e) => setFormData({ ...formData, codug_om: e.target.value })}
                      placeholder="Ex: 160001"
                      required
                      onKeyDown={handleEnterToNextField}
                      disabled={mutation.isPending}
                    />
                  </div>
                  
                  {/* CAMPO: CIDADE */}
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade da OM *</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      placeholder="Ex: Marabá/PA"
                      required
                      onKeyDown={handleEnterToNextField}
                      disabled={mutation.isPending}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rm_vinculacao">RM de Vinculação *</Label>
                    <Input
                      id="rm_vinculacao"
                      value={formData.rm_vinculacao}
                      onChange={(e) => setFormData({ ...formData, rm_vinculacao: e.target.value })}
                      placeholder="Ex: 8ª RM"
                      required
                      onKeyDown={handleEnterToNextField}
                      disabled={mutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codug_rm_vinculacao">CODUG da RM *</Label>
                    <Input
                      id="codug_rm_vinculacao"
                      value={formData.codug_rm_vinculacao}
                      onChange={(e) => setFormData({ ...formData, codug_rm_vinculacao: e.target.value })}
                      placeholder="Ex: 160000"
                      required
                      onKeyDown={handleEnterToNextField}
                      disabled={mutation.isPending}
                    />
                  </div>
                  
                  <div className="col-span-full flex justify-end gap-2 pt-2">
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {editingId ? "Atualizar OM" : "Adicionar OM"}
                    </Button>
                    {/* Botão Cancelar (substitui o antigo 'Cancelar Edição' e fecha o formulário) */}
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancelForm} 
                      disabled={mutation.isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CollapsibleContent>
            </Collapsible>

            {/* Tabela de OMs Cadastradas */}
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-4">OMs Cadastradas ({oms?.length || 0})</h3>
              
              {/* NOVO: Campo de Pesquisa */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por OM, CODUG, RM ou Cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">OM (Sigla)</TableHead>
                      <TableHead className="w-[30%]">Cidade</TableHead>
                      <TableHead className="w-[15%]">CODUG</TableHead>
                      <TableHead className="w-[10%]">RM</TableHead>
                      <TableHead className="w-[15%] whitespace-nowrap">CODUG RM</TableHead>
                      <TableHead className="w-[15%] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : (filteredOms && filteredOms.length > 0) ? (
                      (filteredOms || []).map((om) => (
                        <TableRow key={om.id}>
                          <TableCell className="font-medium whitespace-nowrap">{om.nome_om}</TableCell>
                          <TableCell className="break-words">{om.cidade}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatCodug(om.codug_om)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{om.rm_vinculacao}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatCodug(om.codug_rm_vinculacao)}
                          </TableCell>
                          <TableCell className="text-right space-x-2 whitespace-nowrap">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => handleEdit(om)}
                              disabled={mutation.isPending || handleDeleteMutation.isPending}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              onClick={() => handleConfirmDelete(om)}
                              disabled={mutation.isPending || handleDeleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {oms && oms.length > 0 && searchTerm ? 
                                `Nenhuma OM encontrada para o termo "${searchTerm}".` :
                                `Nenhuma Organização Militar cadastrada. Use o botão "Nova OM" ou "Importar CSV/XLSX" para começar.`
                            }
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OM <span className="font-bold">{omToDelete?.nome_om}</span>? Esta ação é irreversível e pode afetar P Trabs existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={handleDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => omToDelete && handleDeleteMutation.mutate(omToDelete.id)}
              disabled={handleDeleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {handleDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OmConfigPage;