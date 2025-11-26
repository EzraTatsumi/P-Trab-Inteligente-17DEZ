import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { DiretrizCusteio } from "@/types/diretrizes";
import { DiretrizEquipamentoForm } from "@/types/diretrizesEquipamentos";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

const defaultGeradorConfig: DiretrizEquipamentoForm[] = [
  { nome_equipamento: "Gerador até 15 kva GAS", tipo_combustivel: "GAS", consumo: 1.25, unidade: "L/h" },
  { nome: "Gerador até 15 kva OD", tipo_combustivel: "OD", consumo: 4.0, unidade: "L/h" },
  { nome_equipamento: "Gerador acima de 50 kva", tipo_combustivel: "OD", consumo: 20.0, unidade: "L/h" },
];

const defaultEmbarcacaoConfig: DiretrizEquipamentoForm[] = [
  { nome_equipamento: "Motor de popa", tipo_combustivel: "GAS", consumo: 20, unidade: "L/h" },
  { nome_equipamento: "Emb Guardian 25", tipo_combustivel: "GAS", consumo: 100, unidade: "L/h" },
  { nome_equipamento: "Ferryboat", tipo_combustivel: "OD", consumo: 100, unidade: "L/h" },
  { nome_equipamento: "Emb Regional", tipo_combustivel: "OD", consumo: 50, unidade: "L/h" },
  { nome_equipamento: "Empurradores", tipo_combustivel: "OD", consumo: 80, unidade: "L/h" },
  { nome_equipamento: "Emb Manobra", tipo_combustivel: "OD", consumo: 30, unidade: "L/h" },
];

const defaultMotomecanizacaoConfig: DiretrizEquipamentoForm[] = [
  { nome_equipamento: "Vtr Adm Pqn Porte - Adm Pqn", tipo_combustivel: "GAS", consumo: 8, unidade: "km/L" },
  { nome_equipamento: "Vtr Adm Pqn Porte - Pick-up", tipo_combustivel: "OD", consumo: 7, unidade: "km/L" },
  { nome_equipamento: "Vtr Adm Pqn Porte - Van/Micro", tipo_combustivel: "OD", consumo: 6, unidade: "km/L" },
  { nome_equipamento: "Vtr Op Leve - Marruá", tipo_combustivel: "OD", consumo: 5, unidade: "km/L" },
  { nome_equipamento: "Vtr Op Gde Porte - Vtr 5 ton", tipo_combustivel: "OD", consumo: 3, unidade: "km/L" },
  { nome_equipamento: "Motocicleta - até 1.000cc", tipo_combustivel: "GAS", consumo: 15, unidade: "km/L" },
];

const defaultDiretrizes = (year: number) => ({
  ano_referencia: year,
  classe_i_valor_qs: 9.00,
  classe_i_valor_qr: 6.00,
  classe_iii_fator_gerador: 0.15,
  classe_iii_fator_embarcacao: 0.30,
  classe_iii_fator_equip_engenharia: 0.20,
  observacoes: "",
});

const DiretrizesCusteioPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showClasseIAlimentacaoConfig, setShowClasseIAlimentacaoConfig] = useState(false);
  const [showClasseIIIGeradoresConfig, setShowClasseIIIGeradoresConfig] = useState(false);
  const [showClasseIIIEmbarcacoesConfig, setShowClasseIIIEmbarcacoesConfig] = useState(false);
  const [showClasseIIIMotomecanizacaoConfig, setShowClasseIIIMotomecanizacaoConfig] = useState(false); // NOVO ESTADO
  
  const [geradorConfig, setGeradorConfig] = useState<DiretrizEquipamentoForm[]>(defaultGeradorConfig);
  const [embarcacaoConfig, setEmbarcacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultEmbarcacaoConfig);
  const [motomecanizacaoConfig, setMotomecanizacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultMotomecanizacaoConfig); // NOVO ESTADO
  
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizCusteio>>(defaultDiretrizes(new Date().getFullYear()));
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    checkAuthAndLoadYears();
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola para o topo ao carregar
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadDiretrizesForYear(selectedYear);
    }
  }, [selectedYear]);

  const checkAuthAndLoadYears = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }
    await loadAvailableYears();
  };

  const loadAvailableYears = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false });

      if (error) throw error;

      const years = data ? data.map(d => d.ano_referencia) : [];
      const currentYear = new Date().getFullYear();
      
      const uniqueYears = Array.from(new Set([...years, currentYear])).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

      setSelectedYear(uniqueYears.length > 0 ? uniqueYears[0] : currentYear);

    } catch (error: any) {
      console.error("Erro ao carregar anos disponíveis:", error);
      toast.error("Erro ao carregar anos disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const loadDiretrizesForYear = async (year: number) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDiretrizes({
          id: data.id,
          user_id: data.user_id,
          ano_referencia: data.ano_referencia,
          classe_i_valor_qs: data.classe_i_valor_qs,
          classe_i_valor_qr: data.classe_i_valor_qr,
          classe_iii_fator_gerador: data.classe_iii_fator_gerador,
          classe_iii_fator_embarcacao: data.classe_iii_fator_embarcacao,
          classe_iii_fator_equip_engenharia: data.classe_iii_fator_equip_engenharia,
          observacoes: data.observacoes || "",
        });

        // Carregar Geradores
        const { data: geradoresData } = await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .select("*")
          .eq("user_id", user.id)
          .eq("ano_referencia", data.ano_referencia)
          .eq("categoria", "GERADOR")
          .eq("ativo", true);

        if (geradoresData && geradoresData.length > 0) {
          setGeradorConfig(geradoresData.map(eq => ({
            nome_equipamento: eq.nome_equipamento,
            tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
            consumo: Number(eq.consumo),
            unidade: eq.unidade as 'L/h' | 'km/L',
          })));
        } else {
          setGeradorConfig(defaultGeradorConfig);
        }

        // Carregar Embarcações
        const { data: embarcacoesData } = await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .select("*")
          .eq("user_id", user.id)
          .eq("ano_referencia", data.ano_referencia)
          .eq("categoria", "EMBARCACAO")
          .eq("ativo", true);

        if (embarcacoesData && embarcacoesData.length > 0) {
          setEmbarcacaoConfig(embarcacoesData.map(eq => ({
            nome_equipamento: eq.nome_equipamento,
            tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
            consumo: Number(eq.consumo),
            unidade: eq.unidade as 'L/h' | 'km/L',
          })));
        } else {
          setEmbarcacaoConfig(defaultEmbarcacaoConfig);
        }
        
        // Carregar Motomecanização (NOVO)
        const { data: motomecanizacaoData } = await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .select("*")
          .eq("user_id", user.id)
          .eq("ano_referencia", data.ano_referencia)
          .eq("categoria", "MOTOMECANIZACAO")
          .eq("ativo", true);

        if (motomecanizacaoData && motomecanizacaoData.length > 0) {
          setMotomecanizacaoConfig(motomecanizacaoData.map(eq => ({
            nome_equipamento: eq.nome_equipamento,
            tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
            consumo: Number(eq.consumo),
            unidade: eq.unidade as 'L/h' | 'km/L',
          })));
        } else {
          setMotomecanizacaoConfig(defaultMotomecanizacaoConfig);
        }

      } else {
        setDiretrizes(defaultDiretrizes(year));
        setGeradorConfig(defaultGeradorConfig);
        setEmbarcacaoConfig(defaultEmbarcacaoConfig);
        setMotomecanizacaoConfig(defaultMotomecanizacaoConfig); // Reset Motomecanização
      }
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
      toast.error("Erro ao carregar diretrizes para o ano selecionado");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      if (!diretrizes.ano_referencia) {
        toast.error("Informe o ano de referência");
        return;
      }
      if ((diretrizes.classe_i_valor_qs || 0) <= 0 || (diretrizes.classe_i_valor_qr || 0) <= 0) {
        toast.error("Valores de Classe I devem ser maiores que zero");
        return;
      }

      const diretrizData = {
        user_id: user.id,
        ano_referencia: diretrizes.ano_referencia,
        classe_i_valor_qs: diretrizes.classe_i_valor_qs,
        classe_i_valor_qr: diretrizes.classe_i_valor_qr,
        classe_iii_fator_gerador: diretrizes.classe_iii_fator_gerador,
        classe_iii_fator_embarcacao: diretrizes.classe_iii_fator_embarcacao,
        classe_iii_fator_equip_engenharia: diretrizes.classe_iii_fator_equip_engenharia,
        observacoes: diretrizes.observacoes,
      };

      if (diretrizes.id) {
        const { error } = await supabase
          .from("diretrizes_custeio")
          .update(diretrizData)
          .eq("id", diretrizes.id);
        if (error) throw error;
        toast.success("Diretrizes atualizadas!");
      } else {
        const { error } = await supabase
          .from("diretrizes_custeio")
          .insert([diretrizData]);
        if (error) throw error;
        toast.success("Diretrizes criadas!");
      }

      // --- SALVAR EQUIPAMENTOS ---
      
      const saveEquipamentos = async (categoria: 'GERADOR' | 'EMBARCACAO' | 'MOTOMECANIZACAO' | 'EQUIPAMENTO_ENGENHARIA', config: DiretrizEquipamentoForm[]) => {
        // 1. Deletar antigos
        await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .delete()
          .eq("user_id", user.id)
          .eq("ano_referencia", diretrizes.ano_referencia!)
          .eq("categoria", categoria);

        // 2. Inserir novos
        const equipamentosParaSalvar = config
          .filter(g => g.nome_equipamento && g.consumo > 0)
          .map(g => ({
            user_id: user.id,
            ano_referencia: diretrizes.ano_referencia,
            categoria: categoria,
            ...g,
          }));

        if (equipamentosParaSalvar.length > 0) {
          const { error: eqError } = await supabase
            .from("diretrizes_equipamentos_classe_iii")
            .insert(equipamentosParaSalvar);
          if (eqError) throw eqError;
        }
      };

      await saveEquipamentos("GERADOR", geradorConfig);
      await saveEquipamentos("EMBARCACAO", embarcacaoConfig);
      await saveEquipamentos("MOTOMECANIZACAO", motomecanizacaoConfig); // SALVAR MOTOMECANIZAÇÃO

      await loadAvailableYears();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("Já existe uma diretriz para este ano");
      } else {
        toast.error(sanitizeError(error));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2"> {/* Ajustado mb-4 para mb-2 */}
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Planos de Trabalho
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Configurações da Diretriz de Custeio</CardTitle>
            <CardDescription>Diretrizes de Custeio (COLOG)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}> {/* Adicionado a tag form aqui */}
              <div className="space-y-2 mb-6"> {/* Adicionado mb-6 aqui */}
                <Label>Ano de Referência</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 mt-6"> {/* Adicionado mt-6 aqui */}
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIAlimentacaoConfig(!showClasseIAlimentacaoConfig)}
                >
                  <h3 className="text-lg font-semibold">Classe I - Alimentação</h3>
                  {showClasseIAlimentacaoConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIAlimentacaoConfig && (
                  <div className="space-y-4 mt-2"> {/* Content of Classe I */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor QS</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                            value={diretrizes.classe_i_valor_qs?.toFixed(2)}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_i_valor_qs: parseFloat(e.target.value) || 0 })}
                            onKeyDown={handleEnterToNextField}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$/dia</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Valor QR</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                            value={diretrizes.classe_i_valor_qr?.toFixed(2)}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_i_valor_qr: parseFloat(e.target.value) || 0 })}
                            onKeyDown={handleEnterToNextField}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$/dia</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-6"> {/* Adicionado mt-6 aqui */}
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIIGeradoresConfig(!showClasseIIIGeradoresConfig)}
                >
                  <h3 className="text-lg font-semibold">Classe III - Geradores</h3>
                  {showClasseIIIGeradoresConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIIGeradoresConfig && (
                  <Card>
                    <CardContent className="space-y-4 pt-4"> {/* Content of Classe III */}
                      {geradorConfig.map((gerador, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
                          <div className="col-span-5">
                            <Label className="text-xs">Nome do Gerador</Label>
                            <Input
                              value={gerador.nome_equipamento}
                              onChange={(e) => {
                                const novosGeradores = [...geradorConfig];
                                novosGeradores[index] = { ...novosGeradores[index], nome_equipamento: e.target.value };
                                setGeradorConfig(novosGeradores);
                              }}
                              placeholder="Ex: Gerador até 15 kva GAS"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Combustível</Label>
                            <Select
                              value={gerador.tipo_combustivel}
                              onValueChange={(val: 'GAS' | 'OD') => {
                                const novosGeradores = [...geradorConfig];
                                novosGeradores[index] = { ...novosGeradores[index], tipo_combustivel: val };
                                setGeradorConfig(novosGeradores);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GAS">Gasolina</SelectItem>
                                <SelectItem value="OD">Diesel</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Consumo</Label>
                            <Input
                              type="number"
                              step="0.01"
                              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={gerador.consumo}
                              onChange={(e) => {
                                const novosGeradores = [...geradorConfig];
                                novosGeradores[index] = { ...novosGeradores[index], consumo: parseFloat(e.target.value) || 0 };
                                setGeradorConfig(novosGeradores);
                              }}
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unidade</Label>
                            <Input value="L/h" disabled className="bg-muted text-muted-foreground" onKeyDown={handleEnterToNextField} />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setGeradorConfig(geradorConfig.filter((_, i) => i !== index))}
                              type="button"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setGeradorConfig([
                          ...geradorConfig,
                          { nome_equipamento: "", tipo_combustivel: "GAS", consumo: 0, unidade: "L/h" }
                        ])} 
                        className="w-full"
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Gerador
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIIEmbarcacoesConfig(!showClasseIIIEmbarcacoesConfig)}
                >
                  <h3 className="text-lg font-semibold">Classe III - Embarcação</h3>
                  {showClasseIIIEmbarcacoesConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIIEmbarcacoesConfig && (
                  <Card>
                    <CardContent className="space-y-4 pt-4">
                      {embarcacaoConfig.map((embarcacao, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
                          <div className="col-span-5">
                            <Label className="text-xs">Tipo de Embarcação</Label>
                            <Input
                              value={embarcacao.nome_equipamento}
                              onChange={(e) => {
                                const novasEmbarcacoes = [...embarcacaoConfig];
                                novasEmbarcacoes[index] = { ...novasEmbarcacoes[index], nome_equipamento: e.target.value };
                                setEmbarcacaoConfig(novasEmbarcacoes);
                              }}
                              placeholder="Ex: Motor de popa"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Combustível</Label>
                            <Select
                              value={embarcacao.tipo_combustivel}
                              onValueChange={(val: 'GAS' | 'OD') => {
                                const novasEmbarcacoes = [...embarcacaoConfig];
                                novasEmbarcacoes[index] = { ...novasEmbarcacoes[index], tipo_combustivel: val };
                                setEmbarcacaoConfig(novasEmbarcacoes);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GAS">Gasolina</SelectItem>
                                <SelectItem value="OD">Diesel</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Consumo</Label>
                            <Input
                              type="number"
                              step="0.01"
                              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={embarcacao.consumo}
                              onChange={(e) => {
                                const novasEmbarcacoes = [...embarcacaoConfig];
                                novasEmbarcacoes[index] = { ...novasEmbarcacoes[index], consumo: parseFloat(e.target.value) || 0 };
                                setEmbarcacaoConfig(novasEmbarcacoes);
                              }}
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unidade</Label>
                            <Input value="L/h" disabled className="bg-muted text-muted-foreground" onKeyDown={handleEnterToNextField} />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEmbarcacaoConfig(embarcacaoConfig.filter((_, i) => i !== index))}
                              type="button"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setEmbarcacaoConfig([
                          ...embarcacaoConfig,
                          { nome_equipamento: "", tipo_combustivel: "GAS", consumo: 0, unidade: "L/h" }
                        ])} 
                        className="w-full"
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Embarcação
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* NOVO BLOCO: CLASSE III - MOTOMECANIZAÇÃO */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIIMotomecanizacaoConfig(!showClasseIIIMotomecanizacaoConfig)}
                >
                  <h3 className="text-lg font-semibold">Classe III - Motomecanização (Viaturas)</h3>
                  {showClasseIIIMotomecanizacaoConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIIMotomecanizacaoConfig && (
                  <Card>
                    <CardContent className="space-y-4 pt-4">
                      {motomecanizacaoConfig.map((viatura, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
                          <div className="col-span-5">
                            <Label className="text-xs">Tipo de Viatura</Label>
                            <Input
                              value={viatura.nome_equipamento}
                              onChange={(e) => {
                                const novasViaturas = [...motomecanizacaoConfig];
                                novasViaturas[index] = { ...novasViaturas[index], nome_equipamento: e.target.value };
                                setMotomecanizacaoConfig(novasViaturas);
                              }}
                              placeholder="Ex: Vtr Adm Pqn Porte - Adm Pqn"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Combustível</Label>
                            <Select
                              value={viatura.tipo_combustivel}
                              onValueChange={(val: 'GAS' | 'OD') => {
                                const novasViaturas = [...motomecanizacaoConfig];
                                novasViaturas[index] = { ...novasViaturas[index], tipo_combustivel: val };
                                setMotomecanizacaoConfig(novasViaturas);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GAS">Gasolina</SelectItem>
                                <SelectItem value="OD">Diesel</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Consumo</Label>
                            <Input
                              type="number"
                              step="0.01"
                              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={viatura.consumo}
                              onChange={(e) => {
                                const novasViaturas = [...motomecanizacaoConfig];
                                novasViaturas[index] = { ...novasViaturas[index], consumo: parseFloat(e.target.value) || 0 };
                                setMotomecanizacaoConfig(novasViaturas);
                              }}
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unidade</Label>
                            <Input value="km/L" disabled className="bg-muted text-muted-foreground" onKeyDown={handleEnterToNextField} />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMotomecanizacaoConfig(motomecanizacaoConfig.filter((_, i) => i !== index))}
                              type="button"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setMotomecanizacaoConfig([
                          ...motomecanizacaoConfig,
                          { nome_equipamento: "", tipo_combustivel: "GAS", consumo: 0, unidade: "km/L" }
                        ])} 
                        className="w-full"
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Viatura
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-2 border-t pt-4 mt-6"> {/* Adicionado mt-6 aqui */}
                <Label>Observações</Label>
                <Textarea
                  value={diretrizes.observacoes}
                  onChange={(e) => setDiretrizes({ ...diretrizes, observacoes: e.target.value })}
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <Button type="submit" className="w-full mt-6">Salvar Diretrizes</Button> {/* Botão de submit do formulário */}
            </form> {/* Fechamento da tag form */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiretrizesCusteioPage;