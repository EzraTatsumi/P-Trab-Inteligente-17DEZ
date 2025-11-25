import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Pencil, Trash2, Power, UploadCloud } from "lucide-react"; // Importar UploadCloud
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { OMData, formatCODUG, validateCODUG, searchOMs, getUniqueRMs } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

const OmConfigPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handleEnterToNextField } = useFormNavigation();

  const [oms, setOms] = useState<OMData[]>([]);
  const [filteredOms, setFilteredOms] = useState<OMData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRM, setFilterRM] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [uniqueRMs, setUniqueRMs] = useState<string[]>([]);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOM, setEditingOM] = useState<OMData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [omToDelete, setOmToDelete] = useState<OMData | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nome_om: "",
    codug_om: "",
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    ativo: true,
  });

  useEffect(() => {
    loadOMs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [oms, searchTerm, filterRM, filterStatus]);

  const loadOMs = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .eq('user_id', session.session.user.id) // Filtrar por user_id
        .order('nome_om');

      if (error) throw error;

      const omsData = (data || []) as OMData[];
      setOms(omsData);
      setUniqueRMs(getUniqueRMs(omsData));
    } catch (error: any) {
      toast({
        title: "Erro ao carregar OMs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...oms];

    // Filtro de busca
    if (searchTerm) {
      filtered = searchOMs(searchTerm, filtered);
    }

    // Filtro por RM
    if (filterRM !== "all") {
      filtered = filtered.filter(om => om.rm_vinculacao === filterRM);
    }

    // Filtro por status
    if (filterStatus === "active") {
      filtered = filtered.filter(om => om.ativo !== false);
    } else if (filterStatus === "inactive") {
      filtered = filtered.filter(om => om.ativo === false);
    }

    setFilteredOms(filtered);
  };

  const handleOpenDialog = (om?: OMData) => {
    if (om) {
      setEditingOM(om);
      setFormData({
        nome_om: om.nome_om,
        codug_om: om.codug_om,
        rm_vinculacao: om.rm_vinculacao,
        codug_rm_vinculacao: om.codug_rm_vinculacao,
        ativo: om.ativo !== false,
      });
    } else {
      setEditingOM(null);
      setFormData({
        nome_om: "",
        codug_om: "",
        rm_vinculacao: "",
        codug_rm_vinculacao: "",
        ativo: true,
      });
    }
    setDialogOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola para o topo ao abrir o diálogo
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingOM(null);
    setFormData({
      nome_om: "",
      codug_om: "",
      rm_vinculacao: "",
      codug_rm_vinculacao: "",
      ativo: true,
    });
  };

  const handleSave = async () => {
    // Validações
    if (!formData.nome_om.trim()) {
      toast({
        title: "Erro de validação",
        description: "Nome da OM é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!validateCODUG(formData.codug_om)) {
      toast({
        title: "Erro de validação",
        description: "CODUG da OM deve estar no formato XXX.XXX",
        variant: "destructive",
      });
      return;
    }

    if (!formData.rm_vinculacao.trim()) {
      toast({
        title: "Erro de validação",
        description: "RM de Vinculação é obrigatória.",
        variant: "destructive",
      });
      return;
    }

    if (!validateCODUG(formData.codug_rm_vinculacao)) {
      toast({
        title: "Erro de validação",
        description: "CODUG da RM deve estar no formato XXX.XXX",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({
          title: "Erro de autenticação",
          description: "Sessão expirada. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      if (editingOM) {
        // Atualizar
        const { error } = await supabase
          .from('organizacoes_militares')
          .update({
            nome_om: formData.nome_om.trim(),
            codug_om: formData.codug_om,
            rm_vinculacao: formData.rm_vinculacao.trim(),
            codug_rm_vinculacao: formData.codug_rm_vinculacao,
            ativo: formData.ativo,
          })
          .eq('id', editingOM.id)
          .eq('user_id', session.session.user.id); // Garantir que só o próprio usuário edite

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "OM atualizada com sucesso!",
        });
      } else {
        // Criar
        const { error } = await supabase
          .from('organizacoes_militares')
          .insert({
            user_id: session.session.user.id,
            nome_om: formData.nome_om.trim(),
            codug_om: formData.codug_om,
            rm_vinculacao: formData.rm_vinculacao.trim(),
            codug_rm_vinculacao: formData.codug_rm_vinculacao,
            ativo: formData.ativo,
          });

        if (error) {
          if (error.code === '23505') {
            toast({
              title: "Erro",
              description: "Já existe uma OM com este CODUG para o seu usuário.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "OM criada com sucesso!",
        });
      }

      handleCloseDialog();
      loadOMs();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (om: OMData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({
          title: "Erro de autenticação",
          description: "Sessão expirada. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('organizacoes_militares')
        .update({ ativo: !om.ativo })
        .eq('id', om.id)
        .eq('user_id', session.session.user.id); // Garantir que só o próprio usuário altere

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `OM ${om.ativo ? 'desativada' : 'ativada'} com sucesso!`,
      });

      loadOMs();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (om: OMData) => {
    setOmToDelete(om);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!omToDelete) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast({
          title: "Erro de autenticação",
          description: "Sessão expirada. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('organizacoes_militares')
        .delete()
        .eq('id', omToDelete.id)
        .eq('user_id', session.session.user.id); // Garantir que só o próprio usuário exclua

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "OM excluída com sucesso!",
      });

      setDeleteDialogOpen(false);
      setOmToDelete(null);
      loadOMs();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2"> {/* Agrupando botões de ação */}
            <Button onClick={() => navigate("/config/om/bulk-upload")} variant="outline"> {/* Novo botão */}
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload em Massa
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova OM
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Organizações Militares (CODUG)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Buscar</Label>
                <Input
                  placeholder="Nome ou CODUG..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Label>Filtrar por RM</Label>
                <Select value={filterRM} onValueChange={setFilterRM}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as RMs</SelectItem>
                    {uniqueRMs.map(rm => (
                      <SelectItem key={rm} value={rm}>{rm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabela */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da OM</TableHead>
                    <TableHead>CODUG OM</TableHead>
                    <TableHead>RM Vinculação</TableHead>
                    <TableHead>CODUG RM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredOms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma OM encontrada. Clique em "Nova OM" para adicionar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOms.map((om) => (
                      <TableRow key={om.id}>
                        <TableCell className="font-medium">{om.nome_om}</TableCell>
                        <TableCell>{om.codug_om}</TableCell>
                        <TableCell>{om.rm_vinculacao}</TableCell>
                        <TableCell>{om.codug_rm_vinculacao}</TableCell>
                        <TableCell>
                          <Badge variant={om.ativo !== false ? "default" : "secondary"}>
                            {om.ativo !== false ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(om)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(om)}
                              title={om.ativo ? "Desativar" : "Ativar"}
                            >
                              <Power className={`h-4 w-4 ${om.ativo ? 'text-green-600' : 'text-gray-400'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(om)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingOM ? 'Editar OM' : 'Nova OM'}</DialogTitle>
            <DialogDescription>
              {editingOM 
                ? 'Edite as informações da Organização Militar.'
                : 'Adicione uma nova Organização Militar ao sistema.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome_om">Nome da OM *</Label>
                <Input
                  id="nome_om"
                  value={formData.nome_om}
                  onChange={(e) => setFormData({ ...formData, nome_om: e.target.value })}
                  onKeyDown={handleEnterToNextField}
                  placeholder="Ex: Cmdo 23ª Bda Inf Sl"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="codug_om">CODUG da OM *</Label>
                <Input
                  id="codug_om"
                  value={formData.codug_om}
                  onChange={(e) => setFormData({ ...formData, codug_om: formatCODUG(e.target.value) })}
                  onKeyDown={handleEnterToNextField}
                  placeholder="XXX.XXX"
                  maxLength={7}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rm_vinculacao">RM de Vinculação *</Label>
                <Input
                  id="rm_vinculacao"
                  value={formData.rm_vinculacao}
                  onChange={(e) => setFormData({ ...formData, rm_vinculacao: e.target.value })}
                  onKeyDown={handleEnterToNextField}
                  placeholder="Ex: 8º RM"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="codug_rm">CODUG da RM *</Label>
                <Input
                  id="codug_rm"
                  value={formData.codug_rm_vinculacao}
                  onChange={(e) => setFormData({ ...formData, codug_rm_vinculacao: formatCODUG(e.target.value) })}
                  onKeyDown={handleEnterToNextField}
                  placeholder="XXX.XXX"
                  maxLength={7}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">OM Ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingOM ? 'Salvar Alterações' : 'Criar OM'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OM "{omToDelete?.nome_om}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOmToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OmConfigPage;