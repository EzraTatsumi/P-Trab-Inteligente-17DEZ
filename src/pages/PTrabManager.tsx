import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FileText,
  CheckCircle,
  Copy,
  GitBranch,
  MoreVertical,
  MessageSquare,
  Loader2,
  RefreshCw,
  Download,
  Upload,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatUtils";
import { sanitizeError } from "@/lib/errorUtils";
import {
  generateUniqueMinutaNumber,
  generateApprovalPTrabNumber,
  generateVariationPTrabNumber,
  isPTrabNumberDuplicate,
} from "@/lib/ptrabNumberUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";

type PTrab = Tables<'p_trab'>;
type PTrabStatus = 'minuta' | 'aberto' | 'em_andamento' | 'completo' | 'arquivado';

const yearSuffix = `/${new Date().getFullYear()}`;

const fetchPTrabs = async (userId: string): Promise<PTrab[]> => {
  const { data, error } = await supabase
    .from('p_trab')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchExistingPTrabNumbers = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('p_trab')
    .select('numero_ptrab')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map(p => p.numero_ptrab);
};

const PTrabManager = () => {
  const navigate = useNavigate();
  const { toast: shadcnToast } = useToast();
  const queryClient = useQueryClient();
  const { handleEnterToNextField } = useFormNavigation();

  const [userId, setUserId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<PTrabStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [ptrabToComment, setPTrabToComment] = useState<PTrab | null>(null);
  const [commentText, setCommentText] = useState('');

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPTrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState('');

  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [ptrabToClone, setPTrabToClone] = useState<PTrab | null>(null);
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState('');
  const [cloneVersionName, setCloneVersionName] = useState('');

  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        navigate('/login');
      }
    };
    fetchUser();
  }, [navigate]);

  const { data: pTrabs = [], isLoading } = useQuery({
    queryKey: ['pTrabs', userId],
    queryFn: () => fetchPTrabs(userId!),
    enabled: !!userId,
  });

  const { data: existingPTrabNumbers = [] } = useQuery({
    queryKey: ['existingPTrabNumbers', userId],
    queryFn: () => fetchExistingPTrabNumbers(userId!),
    enabled: !!userId,
    initialData: [],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: PTrabStatus }) => {
      const { error } = await supabase
        .from('p_trab')
        .update({ status: status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const deletePTrabMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
      queryClient.invalidateQueries({ queryKey: ['existingPTrabNumbers'] });
      toast.success("P Trab excluído com sucesso!");
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string, comment: string }) => {
      const { error } = await supabase
        .from('p_trab')
        .update({ comentario: comment, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
      toast.success("Comentário salvo com sucesso!");
      setShowCommentDialog(false);
    },
    onError: (error) => {
      toast.error(sanitizeError(error));
    },
  });

  const handleUpdateStatus = (id: string, status: PTrabStatus) => {
    updateStatusMutation.mutate({ id, status });
  };

  const handleDeletePTrab = (ptrab: PTrab) => {
    if (confirm(`Tem certeza que deseja excluir o P Trab ${ptrab.numero_ptrab}? Esta ação é irreversível.`)) {
      deletePTrabMutation.mutate(ptrab.id);
    }
  };

  const handleOpenCommentDialog = (ptrab: PTrab) => {
    setPTrabToComment(ptrab);
    setCommentText(ptrab.comentario || '');
    setShowCommentDialog(true);
  };

  const handleSaveComment = () => {
    if (ptrabToComment) {
      updateCommentMutation.mutate({ id: ptrabToComment.id, comment: commentText });
    }
  };

  const handleOpenApproveDialog = (ptrab: PTrab) => {
    const omSigla = ptrab.nome_om.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const suggestedNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omSigla);

    setPTrabToApprove(ptrab);
    setSuggestedApproveNumber(suggestedNumber);
    setShowApproveDialog(true);
  };

  const handleApproveAndNumber = async () => {
    if (!ptrabToApprove || !suggestedApproveNumber.trim()) return;

    if (isPTrabNumberDuplicate(suggestedApproveNumber, existingPTrabNumbers)) {
      toast.error("Este número de P Trab já existe. Por favor, escolha outro.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('p_trab')
        .update({
          numero_ptrab: suggestedApproveNumber,
          status: 'aberto',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ptrabToApprove.id);

      if (error) throw error;

      toast.success(`P Trab ${suggestedApproveNumber} numerado e aberto com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
      queryClient.invalidateQueries({ queryKey: ['existingPTrabNumbers'] });
      setShowApproveDialog(false);
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCloneDialog = (ptrab: PTrab) => {
    const suggestedNumber = generateVariationPTrabNumber(ptrab.numero_ptrab, existingPTrabNumbers);
    setPTrabToClone(ptrab);
    setSuggestedCloneNumber(suggestedNumber);
    setCloneVersionName(`Variação ${suggestedNumber.split('/')[0]}`);
    setShowCloneDialog(true);
  };

  const handleConfirmClone = async (versionName: string) => {
    if (!ptrabToClone || !suggestedCloneNumber.trim()) return;
    setLoading(true);

    try {
      // 1. Clonar o P Trab principal
      const { data: [newPTrab], error: ptrabError } = await supabase
        .from('p_trab')
        .insert({
          ...ptrabToClone,
          numero_ptrab: suggestedCloneNumber,
          nome_operacao: `${ptrabToClone.nome_operacao} - ${versionName}`,
          id: undefined, // ensure new ID is generated
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          comentario: null,
          status: 'minuta',
          origem: 'clonado',
        })
        .select('*');

      if (ptrabError || !newPTrab) throw ptrabError;

      const newPTrabId = newPTrab.id;

      // 2. Clonar registros dependentes (Classe I, II, III, Ref LPC)
      const dependentTables = [
        'classe_i_registros',
        'classe_ii_registros',
        'classe_iii_registros',
        'p_trab_ref_lpc',
      ];

      for (const table of dependentTables) {
        const { data: oldRecords, error: fetchError } = await supabase
          .from(table as 'classe_i_registros')
          .select('*')
          .eq('p_trab_id', ptrabToClone.id);

        if (fetchError) {
          console.error(`Erro ao buscar registros de ${table}:`, fetchError);
          continue;
        }

        if (oldRecords && oldRecords.length > 0) {
          const recordsToInsert = oldRecords.map(record => {
            const newRecord = { ...record };
            delete (newRecord as any).id;
            delete (newRecord as any).created_at;
            delete (newRecord as any).updated_at;
            (newRecord as any).p_trab_id = newPTrabId;
            return newRecord;
          });

          const { error: insertError } = await supabase.from(table as 'classe_i_registros').insert(recordsToInsert);
          if (insertError) console.error(`Erro ao inserir registros clonados de ${table}:`, insertError);
        }
      }

      toast.success(`P Trab ${suggestedCloneNumber} clonado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
      queryClient.invalidateQueries({ queryKey: ['existingPTrabNumbers'] });
      setShowCloneDialog(false);
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConsolidationDialog = () => {
    setShowConsolidationDialog(true);
  };

  const handleConfirmConsolidation = async (
    sourcePTrabIds: string[],
    targetPTrabId: string | 'new',
    newPTrabNumber?: string,
    templatePTrabId?: string
  ) => {
    if (sourcePTrabIds.length === 0) return;

    setLoading(true);
    let finalTargetPTrabId = targetPTrabId;

    try {
      // 1. Se for novo P Trab, cria o cabeçalho a partir do template
      if (targetPTrabId === 'new' && newPTrabNumber && templatePTrabId) {
        const templatePTrab = pTrabs.find(p => p.id === templatePTrabId);
        if (!templatePTrab) throw new Error("Template P Trab não encontrado.");

        const { id, created_at, updated_at, ...restOfPTrab } = templatePTrab;

        const { data: [newPTrab], error: insertPTrabError } = await supabase
          .from("p_trab")
          .insert({
            ...restOfPTrab,
            numero_ptrab: newPTrabNumber,
            user_id: userId!,
            status: 'aberto',
            origem: 'consolidado',
            comentario: `Consolidado a partir de: ${sourcePTrabIds.map(id => pTrabs.find(p => p.id === id)?.numero_ptrab).join(', ')}`,
          })
          .select('*');

        if (insertPTrabError || !newPTrab) throw insertPTrabError;
        finalTargetPTrabId = newPTrab.id;
        toast.success(`Novo P Trab ${newPTrabNumber} criado para consolidação.`);
      }

      if (finalTargetPTrabId === 'new') throw new Error("ID de destino inválido.");

      // 2. Copiar registros de Classe I, II e III dos P Trabs de origem para o P Trab de destino
      const dependentTables = [
        'classe_i_registros',
        'classe_ii_registros',
        'classe_iii_registros',
      ];

      for (const table of dependentTables) {
        for (const sourceId of sourcePTrabIds) {
          const { data: sourceRecords, error: fetchError } = await supabase
            .from(table as 'classe_i_registros')
            .select('*')
            .eq('p_trab_id', sourceId);

          if (fetchError) {
            console.error(`Erro ao buscar registros de ${table} do P Trab ${sourceId}:`, fetchError);
            continue;
          }

          if (sourceRecords && sourceRecords.length > 0) {
            const recordsToInsert = sourceRecords.map(record => {
              const newRecord = { ...record };
              delete (newRecord as any).id;
              delete (newRecord as any).created_at;
              delete (newRecord as any).updated_at;
              (newRecord as any).p_trab_id = finalTargetPTrabId;
              return newRecord;
            });

            const { error: insertError } = await supabase.from(table as 'classe_i_registros').insert(recordsToInsert);
            if (insertError) console.error(`Erro ao inserir registros consolidados de ${table}:`, insertError);
          }
        }
      }

      toast.success(`Consolidação concluída para o P Trab ${finalTargetPTrabId}!`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs'] });
      queryClient.invalidateQueries({ queryKey: ['existingPTrabNumbers'] });
      setShowConsolidationDialog(false);
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const filteredPTrabs = useMemo(() => {
    let filtered = pTrabs;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.numero_ptrab.toLowerCase().includes(lowerCaseSearch) ||
        p.nome_operacao.toLowerCase().includes(lowerCaseSearch) ||
        p.nome_om.toLowerCase().includes(lowerCaseSearch)
      );
    }

    return filtered;
  }, [pTrabs, filterStatus, searchTerm]);

  const getStatusBadge = (status: PTrabStatus) => {
    switch (status) {
      case 'minuta':
        return <Badge variant="secondary" className="bg-gray-400 hover:bg-gray-500">Minuta</Badge>;
      case 'aberto':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Aberto</Badge>;
      case 'em_andamento':
        return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">Em Andamento</Badge>;
      case 'completo':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completo</Badge>;
      case 'arquivado':
        return <Badge variant="secondary" className="bg-gray-600 hover:bg-gray-700 text-white">Arquivado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">Gerenciador de P Trabs</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['pTrabs'] })}>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Atualizar Lista</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleOpenConsolidationDialog} variant="outline">
              <GitBranch className="mr-2 h-4 w-4" />
              Consolidar P Trab
            </Button>
            <Button onClick={() => navigate("/config/ptrab-export-import")} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar/Importar
            </Button>
            <Button onClick={() => navigate("/config/diretrizes")} variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/ptrab/form")} >
              <Plus className="mr-2 h-4 w-4" />
              Novo P Trab
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Planos de Trabalho</CardTitle>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-2 gap-3">
              <Input
                type="text"
                placeholder="Pesquisar por número, operação ou OM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80"
              />
              <div className="flex items-center space-x-2">
                <Label htmlFor="status-filter" className="text-sm">
                  Filtrar por Status:
                </Label>
                <Select
                  value={filterStatus}
                  onValueChange={(value) => setFilterStatus(value as PTrabStatus | 'all')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="minuta">Minuta</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="completo">Completo</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Número</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead className="w-[150px]">OM</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando PTrabs...
                      </TableCell>
                    </TableRow>
                  ) : filteredPTrabs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum P Trab encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPTrabs.map((ptrab) => (
                      <TableRow key={ptrab.id}>
                        <TableCell className="font-medium">{ptrab.numero_ptrab}</TableCell>
                        <TableCell>{ptrab.nome_operacao}</TableCell>
                        <TableCell>{ptrab.nome_om}</TableCell>
                        <TableCell>{getStatusBadge(ptrab.status as PTrabStatus)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Preencher
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/ptrab/print?ptrabId=${ptrab.id}`)}>
                                <Download className="mr-2 h-4 w-4" />
                                Visualizar Impressão
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenCommentDialog(ptrab)}
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Comentário
                              </DropdownMenuItem>
                              {ptrab.status === 'minuta' && (
                                <DropdownMenuItem onClick={() => handleOpenApproveDialog(ptrab)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Numerar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleOpenCloneDialog(ptrab)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Clonar P Trab
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeletePTrab(ptrab)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Diálogo de Comentário */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Comentário Interno
            </DialogTitle>
            <DialogDescription>
              Adicione ou edite um comentário para o P Trab "{ptrabToComment?.numero_ptrab}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              id="comment"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Digite seu comentário aqui..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveComment} disabled={updateCommentMutation.isPending}>
              {updateCommentMutation.isPending ? "Salvando..." : "Salvar Comentário"}
            </Button>
            <Button variant="outline" onClick={() => setShowCommentDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Aprovação e Numeração */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Aprovar e Numerar P Trab
            </DialogTitle>
            <DialogDescription>
              Atribua o número oficial ao P Trab "{ptrabToApprove?.nome_operacao}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-number">Número Oficial do P Trab *</Label>
              <Input
                id="approve-number"
                value={suggestedApproveNumber}
                onChange={(e) => setSuggestedApproveNumber(e.target.value)}
                placeholder={`Ex: 1${yearSuffix}/${ptrabToApprove?.nome_om.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`}
                maxLength={50}
                onKeyDown={handleEnterToNextField}
              />
              <p className="text-xs text-muted-foreground">
                Padrão sugerido: Número/Ano/Sigla da OM.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApproveAndNumber} disabled={loading || !suggestedApproveNumber.trim()}>
              {loading ? "Aguarde..." : "Confirmar Numeração"}
            </Button>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Clonagem (Variação) */}
      <CloneVariationDialog
        open={showCloneDialog}
        onOpenChange={setShowCloneDialog}
        originalNumber={ptrabToClone?.numero_ptrab || ''}
        suggestedCloneNumber={suggestedCloneNumber}
        onConfirm={handleConfirmClone}
      />

      {/* Diálogo de Consolidação */}
      <PTrabConsolidationDialog
        open={showConsolidationDialog}
        onOpenChange={setShowConsolidationDialog}
        pTrabsList={pTrabs.map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={handleConfirmConsolidation}
        loading={loading}
      />
    </div>
  );
};

export default PTrabManager;