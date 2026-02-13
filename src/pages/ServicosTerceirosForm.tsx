import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Plus, Trash2, FileText, Info, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ServicoTerceiroRegistro, 
  calculateServicoTotals, 
  generateServicoMemoriaCalculo 
} from "@/lib/servicosTerceirosUtils";
import { formatCurrency } from "@/lib/formatUtils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import ServicosTerceirosMemoria from "@/components/ServicosTerceirosMemoria";
import PageMetadata from "@/components/PageMetadata";

const ServicosTerceirosForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user, isLoading: loadingSession } = useSession();
  const queryClient = useQueryClient();

  const [loadingPTrab, setLoadingPTrab] = useState(true);
  const [ptrabData, setPtrabData] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMemoriaOpen, setIsMemoriaOpen] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<ServicoTerceiroRegistro | null>(null);

  // Form state
  const [categoria, setCategoria] = useState("");
  const [organizacao, setOrganizacao] = useState("");
  const [ug, setUg] = useState("");
  const [omDetentora, setOmDetentora] = useState("");
  const [ugDetentora, setUgDetentora] = useState("");
  const [diasOperacao, setDiasOperacao] = useState(1);
  const [efetivo, setEfetivo] = useState(0);
  const [faseAtividade, setFaseAtividade] = useState("");
  const [detalhamentoCustomizado, setDetalhamentoCustomizado] = useState("");
  
  // Itens de aquisição
  const [itens, setItens] = useState<any[]>([]);
  const [novoItem, setNovoItem] = useState({
    descricao_item: "",
    quantidade: 1,
    unidade_medida: "UN",
    valor_unitario: 0,
    nd: "39",
    numero_pregao: "",
    uasg: ""
  });

  const { data: registros, isLoading: isLoadingRegistros } = useQuery({
    queryKey: ['servicosTerceiros', ptrabId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos_terceiros_registros')
        .select('*')
        .eq('p_trab_id', ptrabId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ServicoTerceiroRegistro[];
    },
    enabled: !!ptrabId,
  });

  useEffect(() => {
    const loadPTrab = async () => {
      if (!ptrabId) {
        toast.error("P Trab não selecionado");
        navigate('/ptrab');
        return;
      }

      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .eq('id', ptrabId)
        .single();

      if (error || !data) {
        toast.error("Não foi possível carregar o P Trab");
        navigate('/ptrab');
        return;
      }

      setPtrabData(data);
      setOrganizacao(data.nome_om);
      setUg(data.codug_om || "");
      setEfetivo(Number(data.efetivo_empregado) || 0);
      setLoadingPTrab(false);
    };

    loadPTrab();
  }, [ptrabId, navigate]);

  const saveMutation = useMutation({
    mutationFn: async (newRegistro: any) => {
      const { data, error } = await supabase
        .from('servicos_terceiros_registros')
        .insert([newRegistro])
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicosTerceiros', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
      toast.success("Registro salvo com sucesso!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('servicos_terceiros_registros')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicosTerceiros', ptrabId] });
      queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
      toast.success("Registro excluído!");
    }
  });

  const resetForm = () => {
    setCategoria("");
    setOmDetentora("");
    setUgDetentora("");
    setDiasOperacao(1);
    setFaseAtividade("");
    setDetalhamentoCustomizado("");
    setItens([]);
    setNovoItem({
      descricao_item: "",
      quantidade: 1,
      unidade_medida: "UN",
      valor_unitario: 0,
      nd: "39",
      numero_pregao: "",
      uasg: ""
    });
  };

  const handleAddItem = () => {
    if (!novoItem.descricao_item || novoItem.valor_unitario <= 0) {
      toast.error("Preencha a descrição e o valor unitário do item.");
      return;
    }
    setItens([...itens, { ...novoItem, id: crypto.randomUUID() }]);
    setNovoItem({
      descricao_item: "",
      quantidade: 1,
      unidade_medida: "UN",
      valor_unitario: 0,
      nd: "39",
      numero_pregao: "",
      uasg: ""
    });
  };

  const handleRemoveItem = (id: string) => {
    setItens(itens.filter(i => i.id !== id));
  };

  const handleSave = () => {
    if (!categoria || itens.length === 0) {
      toast.error("Selecione uma categoria e adicione pelo menos um item.");
      return;
    }

    const totals = calculateServicoTotals(itens);
    
    const newRegistro = {
      p_trab_id: ptrabId,
      organizacao,
      ug,
      om_detentora: omDetentora || organizacao,
      ug_detentora: ugDetentora || ug,
      dias_operacao: diasOperacao,
      efetivo,
      fase_atividade: faseAtividade,
      categoria,
      detalhes_planejamento: { itens_selecionados: itens },
      valor_total: totals.totalGeral,
      valor_nd_30: totals.totalND30,
      valor_nd_39: totals.totalND39,
      detalhamento_customizado: detalhamentoCustomizado
    };

    saveMutation.mutate(newRegistro);
  };

  const handleViewMemoria = (registro: ServicoTerceiroRegistro) => {
    setSelectedRegistro(registro);
    setIsMemoriaOpen(true);
  };

  if (loadingSession || loadingPTrab || isLoadingRegistros) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <PageMetadata 
        title="Serviços de Terceiros e Locações" 
        description="Gerenciamento de registros de serviços de terceiros e locações para o P Trab."
      />
      
      <div className="container max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao P Trab
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Registro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Novo Planejamento de Serviço/Locação</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes do serviço ou locação para este P Trab.
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Categoria do Serviço</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="locacao-viaturas">Locação de Viaturas</SelectItem>
                        <SelectItem value="locacao-equipamentos">Locação de Equipamentos</SelectItem>
                        <SelectItem value="locacao-estruturas">Locação de Estruturas (Tendas/Banheiros)</SelectItem>
                        <SelectItem value="servicos-manutencao">Serviços de Manutenção</SelectItem>
                        <SelectItem value="servicos-limpeza">Serviços de Limpeza/Conservação</SelectItem>
                        <SelectItem value="outros-servicos">Outros Serviços de Terceiros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Fase da Atividade</Label>
                    <Input 
                      placeholder="Ex: Concentração, Execução..." 
                      value={faseAtividade}
                      onChange={(e) => setFaseAtividade(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dias de Operação</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={diasOperacao}
                      onChange={(e) => setDiasOperacao(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Efetivo Atendido</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      value={efetivo}
                      onChange={(e) => setEfetivo(Number(e.target.value))}
                    />
                  </div>

                  <div className="col-span-2 space-y-4 border p-4 rounded-lg bg-muted/30">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Itens de Aquisição / Lotes
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs">Descrição do Item/Serviço</Label>
                        <Input 
                          placeholder="Ex: Locação de Van 15 lugares" 
                          value={novoItem.descricao_item}
                          onChange={(e) => setNovoItem({...novoItem, descricao_item: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Natureza de Despesa</Label>
                        <Select 
                          value={novoItem.nd} 
                          onValueChange={(v) => setNovoItem({...novoItem, nd: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">33.90.30 (Consumo)</SelectItem>
                            <SelectItem value="39">33.90.39 (Serviço)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={novoItem.quantidade}
                          onChange={(e) => setNovoItem({...novoItem, quantidade: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Unitário</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={novoItem.valor_unitario}
                          onChange={(e) => setNovoItem({...novoItem, valor_unitario: Number(e.target.value)})}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="secondary" className="w-full" onClick={handleAddItem}>
                          Adicionar Item
                        </Button>
                      </div>
                    </div>

                    {itens.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label className="text-xs font-bold">Itens Adicionados:</Label>
                        {itens.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-background p-2 rounded border text-sm">
                            <div className="flex-1">
                              <span className="font-medium">{item.descricao_item}</span>
                              <div className="text-xs text-muted-foreground">
                                {item.quantidade} x {formatCurrency(item.valor_unitario)} | ND: {item.nd}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Observações / Detalhamento Adicional</Label>
                    <Textarea 
                      placeholder="Informações complementares para a memória de cálculo..." 
                      value={detalhamentoCustomizado}
                      onChange={(e) => setDetalhamentoCustomizado(e.target.value)}
                    />
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Registro
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registros de Serviços e Locações</CardTitle>
            <CardDescription>
              Lista de todos os serviços planejados para este P Trab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {registros && registros.length > 0 ? (
              <div className="space-y-4">
                {registros.map((reg) => (
                  <div key={reg.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/20 transition-colors gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {reg.categoria.replace('-', ' ')}
                        </Badge>
                        <span className="font-semibold">{formatCurrency(reg.valor_total)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {reg.fase_atividade || 'Fase não informada'} • {reg.dias_operacao} dias • {reg.efetivo} militares
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewMemoria(reg)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Memória
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteMutation.mutate(reg.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Info className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum registro encontrado</h3>
                <p className="text-muted-foreground">Comece adicionando um novo planejamento de serviço ou locação.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedRegistro && (
        <ServicosTerceirosMemoria
          open={isMemoriaOpen}
          onOpenChange={setIsMemoriaOpen}
          registro={selectedRegistro}
          ptrabData={ptrabData}
        />
      )}
    </div>
  );
};

export default ServicosTerceirosForm;