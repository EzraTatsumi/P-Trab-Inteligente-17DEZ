import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Plane, HardHat, Droplet, Sparkles, Pencil, Trash2, XCircle, Check } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { RefLPC } from "@/types/refLPC";
import { TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { ClasseIIIViaturaForm } from "@/components/ClasseIIIViaturaForm";
import { ClasseIIIGeradorForm } from "@/components/ClasseIIIGeradorForm";
import { ClasseIIIEngenhariaForm } from "@/components/ClasseIIIEngenhariaForm";
import { ClasseIIIEmbarcacaoForm } from "@/components/ClasseIIIEmbarcacaoForm";
import { formatCurrency } from "@/lib/formatUtils";
import { Tables } from "@/integrations/supabase/types";
import { Textarea } from "@/components/ui/textarea"; // Importar Textarea
import { Label } from "@/components/ui/label"; // Importar Label
import { cn } from "@/lib/utils";

type TipoEquipamento = 'MOTOMECANIZACAO' | 'GERADOR' | 'EQUIPAMENTO_ENGENHARIA' | 'EMBARCACAO' | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO';

type ClasseIIIRegistroDB = Tables<'classe_iii_registros'>;

interface ClasseIIIRegistro extends ClasseIIIRegistroDB {
  // Adicionar campos que podem ser nulos no DB mas são úteis aqui
  detalhamento_customizado: string | null;
}

interface FormInitialData {
  form: any; // Depende do tipo de equipamento
  rmFornecimento: string;
  codugRmFornecimento: string;
  omLubrificante: string;
  ugLubrificante: string;
  selectedOmLubrificanteId?: string;
  fasesAtividade: string[];
  customFaseAtividade: string;
}

export default function ClasseIIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [loading, setLoading] = useState(false);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<TipoEquipamentoDetalhado[]>([]);
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [selectedTab, setSelectedTab] = useState<TipoEquipamento>('MOTOMECANIZACAO');
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<FormInitialData | undefined>(undefined);

  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadData();
  }, [ptrabId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadRefLPC(), loadEquipamentos(), fetchRegistros()]);
    setLoading(false);
  };

  const loadRefLPC = async () => {
    try {
      const { data, error } = await supabase
        .from("p_trab_ref_lpc")
        .select("*")
        .eq("p_trab_id", ptrabId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = No rows found

      if (data) {
        setRefLPC(data as RefLPC);
      } else {
        setRefLPC(null);
        toast.warning("Referência LPC não configurada para este P Trab.");
      }
    } catch (error) {
      console.error("Erro ao carregar LPC:", error);
      toast.error("Erro ao carregar Referência LPC.");
    }
  };

  const loadEquipamentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      let anoReferencia = currentYear;

      const { data: diretrizCusteio } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (diretrizCusteio) {
        anoReferencia = diretrizCusteio.ano_referencia;
      }

      const { data, error } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true);

      if (error) throw error;

      setEquipamentosDisponiveis((data || []) as TipoEquipamentoDetalhado[]);
    } catch (error) {
      console.error("Erro ao carregar equipamentos:", error);
      toast.error("Erro ao carregar diretrizes de equipamentos.");
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    try {
      const { data, error } = await supabase
        .from("classe_iii_registros")
        .select("*, detalhamento_customizado")
        .eq("p_trab_id", ptrabId)
        .order("organizacao", { ascending: true });

      if (error) throw error;

      setRegistros((data || []) as ClasseIIIRegistro[]);
    } catch (error) {
      console.error("Erro ao carregar registros Classe III:", error);
      toast.error("Erro ao carregar registros Classe III.");
    }
  };

  const handleEditRegistro = (registro: ClasseIIIRegistro) => {
    setEditingRegistroId(registro.id);
    setSelectedTab(registro.tipo_equipamento);
    
    // 1. Reconstruir o formulário de itens (form.itens)
    const itens = (registro.itens_equipamentos || []) as any[];
    
    // 2. Determinar a OM Detentora (organizacao/ug)
    const omDetentora = registro.organizacao;
    const ugDetentora = registro.ug;
    
    // 3. Determinar a OM/UG de Lubrificante (se for lubrificante)
    let omLubrificante = "";
    let ugLubrificante = "";
    let selectedOmLubrificanteId: string | undefined = undefined;
    
    if (registro.tipo_equipamento.startsWith('LUBRIFICANTE')) {
        omLubrificante = registro.organizacao;
        ugLubrificante = registro.ug;
        // Tenta buscar o ID da OM de lubrificante (que é a OM de destino)
        supabase.from('organizacoes_militares')
            .select('id')
            .eq('nome_om', omLubrificante)
            .eq('codug_om', ugLubrificante)
            .maybeSingle()
            .then(({ data }) => {
                if (data) selectedOmLubrificanteId = data.id;
            });
    }
    
    // 4. Determinar a RM de Fornecimento (precisa ser buscada)
    let rmFornecimento = "";
    let codugRmFornecimento = "";
    
    // Para fins de edição, precisamos buscar a RM de vinculação da OM detentora
    supabase.from('organizacoes_militares')
        .select('rm_vinculacao, codug_rm_vinculacao, id')
        .eq('nome_om', omDetentora)
        .eq('codug_om', ugDetentora)
        .maybeSingle()
        .then(({ data }) => {
            if (data) {
                rmFornecimento = data.rm_vinculacao;
                codugRmFornecimento = data.codug_rm_vinculacao;
                
                // 5. Preencher o estado inicial
                const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
                const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
                const fasesAtividade = fasesSalvas.filter(f => fasesPadrao.includes(f));
                const customFaseAtividade = fasesSalvas.find(f => !fasesPadrao.includes(f)) || "";

                setInitialData({
                    form: {
                        selectedOmId: data.id,
                        organizacao: omDetentora,
                        ug: ugDetentora,
                        dias_operacao: registro.dias_operacao,
                        itens: itens,
                    },
                    rmFornecimento,
                    codugRmFornecimento,
                    omLubrificante,
                    ugLubrificante,
                    selectedOmLubrificanteId,
                    fasesAtividade,
                    customFaseAtividade,
                });
            } else {
                toast.error("Não foi possível encontrar a OM detentora para carregar a RM de fornecimento.");
            }
        })
        .catch(err => {
            console.error("Erro ao buscar OM para edição:", err);
            toast.error("Erro ao carregar dados da OM para edição.");
        });
  };

  const handleRemoverRegistro = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Registro removido com sucesso!");
      setEditingRegistroId(null);
      setInitialData(undefined);
      await fetchRegistros();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSuccess = () => {
    setInitialData(undefined);
    fetchRegistros();
  };

  // --- Handlers de Edição de Memória de Cálculo ---
  
  const handleIniciarEdicaoMemoria = (registro: ClasseIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || registro.detalhamento || "");
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: memoriaEdit,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo customizada salva!");
      handleCancelarEdicaoMemoria();
      fetchRegistros();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      fetchRegistros();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const totalGeral = registros.reduce((sum, r) => sum + (r.valor_total || 0), 0);

  const getIcon = (tipo: TipoEquipamento) => {
    switch (tipo) {
      case 'MOTOMECANIZACAO': return <Fuel className="h-5 w-5 text-amber-500" />;
      case 'GERADOR': return <Sparkles className="h-5 w-5 text-yellow-500" />;
      case 'EQUIPAMENTO_ENGENHARIA': return <HardHat className="h-5 w-5 text-stone-500" />;
      case 'EMBARCACAO': return <Plane className="h-5 w-5 text-blue-500" />;
      case 'LUBRIFICANTE_GERADOR':
      case 'LUBRIFICANTE_EMBARCACAO': return <Droplet className="h-5 w-5 text-purple-500" />;
      default: return <Fuel className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTitle = (tipo: TipoEquipamento) => {
    switch (tipo) {
      case 'MOTOMECANIZACAO': return 'Viaturas (Motomecanização)';
      case 'GERADOR': return 'Geradores';
      case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamentos de Engenharia';
      case 'EMBARCACAO': return 'Embarcações';
      case 'LUBRIFICANTE_GERADOR': return 'Lubrificante (Gerador)';
      case 'LUBRIFICANTE_EMBARCACAO': return 'Lubrificante (Embarcação)';
      default: return 'Outros';
    }
  };

  const getEquipamentosFiltrados = (tipo: TipoEquipamento) => {
    switch (tipo) {
      case 'MOTOMECANIZACAO': return equipamentosDisponiveis.filter(e => e.tipo === 'Viatura');
      case 'GERADOR': return equipamentosDisponiveis.filter(e => e.tipo === 'Gerador');
      case 'EQUIPAMENTO_ENGENHARIA': return equipamentosDisponiveis.filter(e => e.tipo === 'Engenharia');
      case 'EMBARCACAO': return equipamentosDisponiveis.filter(e => e.tipo === 'Embarcacao');
      default: return [];
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-6 w-6 text-primary" />
              Classe III - Combustíveis e Lubrificantes
            </CardTitle>
            <CardDescription>
              Configure o consumo de combustível e lubrificante para viaturas, geradores, engenharia e embarcações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {!refLPC && (
              <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p className="font-semibold">Atenção: Referência LPC não configurada.</p>
                <p className="text-sm">Configure a Referência LPC em "Configurações" para calcular os custos de combustível.</p>
              </div>
            )}

            <Tabs value={selectedTab} onValueChange={(value) => {
                setSelectedTab(value as TipoEquipamento);
                setEditingRegistroId(null);
                setInitialData(undefined);
            }}>
              <Card className="p-4">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="MOTOMECANIZACAO" className="py-2">
                    <Fuel className="h-4 w-4 mr-2" /> Viaturas
                  </TabsTrigger>
                  <TabsTrigger value="GERADOR" className="py-2">
                    <Sparkles className="h-4 w-4 mr-2" /> Geradores
                  </TabsTrigger>
                  <TabsTrigger value="EQUIPAMENTO_ENGENHARIA" className="py-2">
                    <HardHat className="h-4 w-4 mr-2" /> Engenharia
                  </TabsTrigger>
                  <TabsTrigger value="EMBARCACAO" className="py-2">
                    <Plane className="h-4 w-4 mr-2" /> Embarcações
                  </TabsTrigger>
                </TabsList>
              </Card>

              <TabsContent value="MOTOMECANIZACAO" className="mt-4">
                <ClasseIIIViaturaForm
                  ptrabId={ptrabId!}
                  refLPC={refLPC}
                  equipamentosDisponiveis={getEquipamentosFiltrados('MOTOMECANIZACAO')}
                  onSaveSuccess={handleSaveSuccess}
                  editingRegistroId={editingRegistroId}
                  setEditingRegistroId={setEditingRegistroId}
                  initialData={initialData}
                />
              </TabsContent>

              <TabsContent value="GERADOR" className="mt-4">
                <ClasseIIIGeradorForm
                  ptrabId={ptrabId!}
                  refLPC={refLPC}
                  equipamentosDisponiveis={getEquipamentosFiltrados('GERADOR')}
                  onSaveSuccess={handleSaveSuccess}
                  editingRegistroId={editingRegistroId}
                  setEditingRegistroId={setEditingRegistroId}
                  initialData={initialData}
                />
              </TabsContent>

              <TabsContent value="EQUIPAMENTO_ENGENHARIA" className="mt-4">
                <ClasseIIIEngenhariaForm
                  ptrabId={ptrabId!}
                  refLPC={refLPC}
                  equipamentosDisponiveis={getEquipamentosFiltrados('EQUIPAMENTO_ENGENHARIA')}
                  onSaveSuccess={handleSaveSuccess}
                  editingRegistroId={editingRegistroId}
                  setEditingRegistroId={setEditingRegistroId}
                  initialData={initialData}
                />
              </TabsContent>

              <TabsContent value="EMBARCACAO" className="mt-4">
                <ClasseIIIEmbarcacaoForm
                  ptrabId={ptrabId!}
                  refLPC={refLPC}
                  equipamentosDisponiveis={getEquipamentosFiltrados('EMBARCACAO')}
                  onSaveSuccess={handleSaveSuccess}
                  editingRegistroId={editingRegistroId}
                  setEditingRegistroId={setEditingRegistroId}
                  initialData={initialData}
                />
              </TabsContent>
            </Tabs>

            {/* Registros Salvos */}
            {registros.length > 0 && (
              <div className="space-y-4 pt-6 border-t">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Registros Salvos ({registros.length})</h3>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Geral</p>
                    <p className="text-2xl font-extrabold text-primary">{formatCurrency(totalGeral)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {registros.map((registro) => {
                    const isEditingMemoria = editingMemoriaId === registro.id;
                    const memoriaFinal = isEditingMemoria ? memoriaEdit : (registro.detalhamento_customizado || registro.detalhamento || "");
                    const hasCustomMemoria = !!registro.detalhamento_customizado;
                    
                    return (
                      <Card key={registro.id} className="p-4 bg-muted/30">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              {getIcon(registro.tipo_equipamento)}
                              <p className="font-semibold text-lg">{getTitle(registro.tipo_equipamento)}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {registro.organizacao} (UG: {registro.ug}) | Dias: {registro.dias_operacao}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">{registro.tipo_combustivel}</p>
                            <p className="text-xl font-bold text-primary">{formatCurrency(registro.valor_total || 0)}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Memória de Cálculo</Label>
                            {!isEditingMemoria ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleIniciarEdicaoMemoria(registro)}
                                  disabled={loading}
                                  className="gap-2"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </Button>
                                {hasCustomMemoria && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                    disabled={loading}
                                    className="gap-2 text-muted-foreground"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Restaurar
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                  disabled={loading}
                                  className="gap-2"
                                >
                                  <Check className="h-4 w-4" />
                                  Salvar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelarEdicaoMemoria}
                                  disabled={loading}
                                  className="gap-2"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          <Textarea
                            value={memoriaFinal}
                            onChange={(e) => isEditingMemoria && setMemoriaEdit(e.target.value)}
                            readOnly={!isEditingMemoria}
                            rows={10}
                            className={cn(
                              "font-mono text-xs whitespace-pre-wrap text-foreground",
                              isEditingMemoria && "border-primary focus:ring-2 focus:ring-primary"
                            )}
                          />
                        </div>

                        <div className="flex justify-end gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRegistro(registro)}
                            disabled={loading}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar Registro
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoverRegistro(registro.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}