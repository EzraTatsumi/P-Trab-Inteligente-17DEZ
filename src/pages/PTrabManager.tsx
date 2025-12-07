import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MoreVertical, Loader2, Eye, Printer, Share2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { ShareDialog } from "@/components/ShareDialog";
import { Badge } from "@/components/ui/badge";

interface PTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
  status: string;
  created_at: string;
  share_token: string;
}

const PTrabManager = () => {
  const navigate = useNavigate();
  const { user, loading: loadingSession } = useSession();
  const [ptrabs, setPtrabs] = useState<PTrab[]>([]);
  const [loading, setLoading] = useState(true);
  
  // NOVO ESTADO: Gerenciamento do diálogo de compartilhamento
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedPTrabToShare, setSelectedPTrabToShare] = useState<{ id: string, token: string, name: string } | null>(null);

  useEffect(() => {
    if (!loadingSession && user) {
      fetchPTrabs();
    } else if (!loadingSession && !user) {
      navigate('/login');
    }
  }, [user, loadingSession, navigate]);

  const fetchPTrabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('p_trab')
        .select('id, numero_ptrab, nome_operacao, status, created_at, share_token')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPtrabs(data || []);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('p_trab')
        .insert({ 
          user_id: user.id, 
          numero_ptrab: 'Novo P Trab', 
          comando_militar_area: 'CMT', 
          nome_om: 'OM', 
          nome_operacao: 'Nova Operação', 
          periodo_inicio: new Date().toISOString().split('T')[0],
          periodo_fim: new Date().toISOString().split('T')[0],
          efetivo_empregado: '0',
          status: 'aberto',
        })
        .select('id')
        .single();

      if (error) throw error;
      toast.success("Novo P Trab criado!");
      navigate(`/ptrab/form?ptrabId=${data.id}`);
    } catch (error: any) {
      toast.error(sanitizeError(error));
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, numero: string) => {
    if (!confirm(`Tem certeza que deseja deletar o P Trab ${numero}? Esta ação é irreversível.`)) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(`P Trab ${numero} deletado com sucesso!`);
      fetchPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
      setLoading(false);
    }
  };
  
  const handleShare = (ptrab: PTrab) => {
    setSelectedPTrabToShare({
      id: ptrab.id,
      token: ptrab.share_token,
      name: `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`,
    });
    setIsShareDialogOpen(true);
  };

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string, className: string }> = {
      aberto: { label: 'Minuta', className: 'bg-gray-500 hover:bg-gray-600 text-white' },
      em_andamento: { label: 'Em Andamento', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
      aprovado: { label: 'Aprovado', className: 'bg-green-600 hover:bg-green-700 text-white' },
      arquivado: { label: 'Arquivado', className: 'bg-purple-600 hover:bg-purple-700 text-white' },
    };
    const { label, className } = statusMap[status] || statusMap.aberto;
    return <Badge className={className}>{label}</Badge>;
  };

  if (loadingSession || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando Planos de Trabalho...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Gerenciamento de Planos de Trabalho</CardTitle>
            <Button onClick={handleCreateNew} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Novo P Trab
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Nº P Trab</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ptrabs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhum Plano de Trabalho encontrado. Crie um novo para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  ptrabs.map((ptrab) => (
                    <TableRow key={ptrab.id}>
                      <TableCell className="font-medium">{ptrab.numero_ptrab}</TableCell>
                      <TableCell>{ptrab.nome_operacao}</TableCell>
                      <TableCell>{renderStatusBadge(ptrab.status)}</TableCell>
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
                            
                            <DropdownMenuItem onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar Detalhes
                            </DropdownMenuItem>
                            
                            {/* BOTÃO: Compartilhar (Chama a nova função) */}
                            <DropdownMenuItem 
                              onClick={() => handleShare(ptrab)} 
                              className="cursor-pointer"
                            >
                              <Share2 className="mr-2 h-4 w-4" />
                              Compartilhar
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => navigate(`/ptrab/print?ptrabId=${ptrab.id}`)} className="cursor-pointer">
                              <Printer className="mr-2 h-4 w-4" />
                              Visualizar Impressão
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => handleDelete(ptrab.id, ptrab.numero_ptrab)} className="cursor-pointer text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Deletar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Compartilhamento */}
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        ptrabId={selectedPTrabToShare?.id || null}
        shareToken={selectedPTrabToShare?.token || null}
        ptrabName={selectedPTrabToShare?.name || null}
      />
    </div>
  );
};

export default PTrabManager;