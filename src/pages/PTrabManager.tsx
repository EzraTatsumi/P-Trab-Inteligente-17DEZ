import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, LogOut, FileText, Printer, Settings, MoreVertical, Pencil, Copy, Download, MessageSquare, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatUtils";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PTrabConsolidationDialog } from "@/components/PTrabConsolidationDialog";
import { sanitizeError } from "@/lib/errorUtils";
import { Loader2 } from "@/components/ui/loader";

type PTrab = Tables<'p_trab'>;
type ClasseIRegistro = Tables<'classe_i_registros'>;
type ClasseIIIRegistro = Tables<'classe_iii_registros'>;

interface PTrabSummary extends PTrab {
  total_classe_i: number;
  total_classe_ii: number;
  total_classe_iii: number;
}

export default function PTrabManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ptrabs, setPtrabs] = useState<PTrabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConsolidationDialogOpen, setIsConsolidationDialogOpen] = useState(false);
  const [sourcePTrabId, setSourcePTrabId] = useState<string | null>(null);
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPTrabs();
    }
  }, [user]);

  const fetchPTrabs = async () => {
    setLoading(true);
    try {
      const { data: ptrabData, error: ptrabError } = await supabase
        .from("p_trab")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (ptrabError) throw ptrabError;

      const summaries: PTrabSummary[] = await Promise.all(
        (ptrabData || []).map(async (ptrab) => {
          let totalClasseI = 0;
          let totalClasseII = 0;
          let totalClasseIII = 0;

          // Fetch Classe I costs
          const { data: classeIData } = await supabase
            .from('classe_i_registros')
            .select('total_qs, total_qr')
            .eq('p_trab_id', ptrab.id);
          
          totalClasseI = (classeIData || []).reduce((sum, record) => sum + (Number(record.total_qs) || 0) + (Number(record.total_qr) || 0), 0);

          // Fetch Classe II costs
          // Usando 'as any' para contornar o erro de sobrecarga do Supabase Client
          const { data: classeIIData } = await supabase
            .from('classe_ii_registros' as any)
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
          
          totalClasseII = (classeIIData || []).reduce((sum, record) => sum + record.valor_total, 0);

          // Fetch Classe III costs
          const { data: classeIIIData } = await supabase
            .from('classe_iii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
          
          totalClasseIII = (classeIIIData || []).reduce((sum, record) => sum + (record.valor_total || 0), 0);

          return {
            ...ptrab,
            total_classe_i: totalClasseI,
            total_classe_ii: totalClasseII,
            total_classe_iii: totalClasseIII,
          };
        })
      );

      setPtrabs(summaries);
    } catch (error) {
      console.error("Erro ao carregar P Trabs:", error);
      toast.error("Erro ao carregar Planos de Trabalho.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    navigate("/ptrab/form");
  };

  const handleEdit = (id: string) => {
    navigate(`/ptrab/form?ptrabId=${id}`);
  };

  const handlePrint = (id: string) => {
    navigate(`/ptrab/print?ptrabId=${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este P Trab e todos os seus registros de custos?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("p_trab")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("P Trab deletado com sucesso!");
      fetchPTrabs();
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (ptrab: PTrabSummary) => {
    if (!user) return;
    if (!confirm(`Deseja duplicar o P Trab: ${ptrab.numero_ptrab} - ${ptrab.nome_operacao}?`)) return;

    setLoading(true);
    try {
      // 1. Duplicar o registro principal do P Trab
      const newPTrabData = {
        ...ptrab,
        numero_ptrab: `CÓPIA ${ptrab.numero_ptrab}`,
        nome_operacao: `CÓPIA ${ptrab.nome_operacao}`,
        status: 'aberto' as const,
        valor_total: 0,
        user_id: user.id,
        created_at: undefined,
        updated_at: undefined,
        id: undefined,
      };

      const { data: newPTrab, error: ptrabError } = await supabase
        .from("p_trab")
        .insert([newPTrabData])
        .select()
        .single();

      if (ptrabError) throw ptrabError;
      const newPTrabId = newPTrab.id;

      // 2. Duplicar registros de Classe I
      const { data: classeIData } = await supabase
        .from('classe_i_registros')
        .select('*')
        .eq('p_trab_id', ptrab.id);
      
      if (classeIData && classeIData.length > 0) {
        const recordsToInsert = classeIData.map(record => {
          const { id, created_at, updated_at, ...restOfRecord } = record;
          return { ...restOfRecord, p_trab_id: newPTrabId };
        });
        const { error } = await supabase.from("classe_i_registros").insert(recordsToInsert);
        if (error) throw error;
      }

      // 3. Duplicar registros de Classe II
      // Usando 'as any' para contornar o erro de sobrecarga do Supabase Client
      const { data: classeIIData } = await supabase
        .from("classe_ii_registros" as any)
        .select("*, itens_equipamentos")
        .eq("p_trab_id", ptrab.id);
      
      if (classeIIData && classeIIData.length > 0) {
        const recordsToInsert = (classeIIData as any[]).map(record => {
          const { id, created_at, updated_at, ...restOfRecord } = record;
          return { 
            ...restOfRecord, 
            p_trab_id: newPTrabId,
            // Garantir que JSONB seja copiado corretamente
            itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
          };
        });
        const { error } = await supabase.from("classe_ii_registros" as any).insert(recordsToInsert);
        if (error) throw error;
      }

      // 4. Duplicar registros de Classe III
      const { data: classeIIIData } = await supabase
        .from('classe_iii_registros')
        .select('*')
        .eq('p_trab_id', ptrab.id);
      
      if (classeIIIData && classeIIIData.length > 0) {
        const recordsToInsert = classeIIIData.map(record => {
          const { id, created_at, updated_at, ...restOfRecord } = record;
          return { 
            ...restOfRecord, 
            p_trab_id: newPTrabId,
            // Garantir que JSONB seja copiado corretamente
            itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
            dias_operacao: record.dias_operacao ?? 0,
            valor_total: record.valor_total ?? 0,
          };
        });
        const { error } = await supabase.from("classe_iii_registros").insert(recordsToInsert);
        if (error) throw error;
      }

      toast.success("P Trab duplicado com sucesso!");
      fetchPTrabs();
    } catch (error) {
      console.error("Erro ao duplicar P Trab:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConsolidation = (id: string) => {
    setSourcePTrabId(id);
    setIsConsolidationDialogOpen(true);
  };

  const handleConsolidationSuccess = () => {
    fetchPTrabs();
  };

  const getStatusBadge = (status: PTrab['status']) => {
    switch (status) {
      case 'aberto': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Aberto</span>;
      case 'em_andamento': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">Em Andamento</span>;
      case 'concluido': return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-600">Concluído</span>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Gerenciamento de P-Trabs</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/config")}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Meus Planos de Trabalho</CardTitle>
            <Button onClick={handleCreateNew} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Novo P-Trab
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : ptrabs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum Plano de Trabalho encontrado. Crie o primeiro!
              </p>
            ) : (
              <div className="space-y-4">
                {ptrabs.map((ptrab) => (
                  <Card key={ptrab.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-primary cursor-pointer hover:underline" onClick={() => handleEdit(ptrab.id)}>
                            {ptrab.numero_ptrab} - {ptrab.nome_operacao}
                          </h3>
                          {getStatusBadge(ptrab.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ptrab.organizacao} ({ptrab.codug_om}) | {ptrab.comando_militar_area}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Início: {ptrab.data_inicio} | Fim: {ptrab.data_fim}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="text-2xl font-extrabold text-primary">
                          {formatCurrency(ptrab.total_classe_i + ptrab.total_classe_ii + ptrab.total_classe_iii)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Custo Total
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="ml-4 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(ptrab.id)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar Dados
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/ptrab/classe-i?ptrabId=${ptrab.id}`)}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Detalhar Custos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrint(ptrab.id)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Gerar PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDuplicate(ptrab)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar P-Trab
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenConsolidation(ptrab.id)}>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Consolidar Dados
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(ptrab.id)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                        <span className="text-green-600">C-I: {formatCurrency(ptrab.total_classe_i)}</span>
                        <span className="text-blue-600">C-II: {formatCurrency(ptrab.total_classe_ii)}</span>
                        <span className="text-amber-600">C-III: {formatCurrency(ptrab.total_classe_iii)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {sourcePTrabId && (
        <PTrabConsolidationDialog
          open={isConsolidationDialogOpen}
          onOpenChange={setIsConsolidationDialogOpen}
          sourcePTrabId={sourcePTrabId}
          onConsolidateSuccess={handleConsolidationSuccess}
        />
      )}
    </div>
  );
}