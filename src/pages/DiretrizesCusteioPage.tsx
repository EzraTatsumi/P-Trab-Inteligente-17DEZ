import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft, Fuel, Package } from "lucide-react";
import { DiretrizCusteio } from "@/types/diretrizes";
import { DiretrizEquipamentoForm } from "@/types/diretrizesEquipamentos";
import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { tipoViaturas, tipoEquipamentosEngenharia } from "@/data/classeIIIData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const defaultGeradorConfig: DiretrizEquipamentoForm[] = [
  { nome_equipamento: "Gerador até 15 kva GAS", tipo_combustivel: "GAS", consumo: 1.25, unidade: "L/h" },
  { nome_equipamento: "Gerador até 15 kva OD", tipo_combustivel: "OD", consumo: 4.0, unidade: "L/h" },
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

const defaultMotomecanizacaoConfig: DiretrizEquipamentoForm[] = tipoViaturas.map(v => ({
  nome_equipamento: v.nome,
  tipo_combustivel: v.combustivel,
  consumo: v.consumo,
  unidade: v.unidade,
}));

const defaultEquipamentosEngenhariaConfig: DiretrizEquipamentoForm[] = tipoEquipamentosEngenharia.map(e => ({
  nome_equipamento: e.nome,
  tipo_combustivel: e.combustivel,
  consumo: e.consumo,
  unidade: e.unidade,
}));

const defaultClasseIIConfig: DiretrizClasseIIForm[] = [
  { categoria: "Equipamento Individual", item: "Equipamento Individual", valor_mnt_dia: 2.42 },
  { categoria: "Proteção Balística", item: "Colete balístico", valor_mnt_dia: 3.23 },
  { categoria: "Proteção Balística", item: "Capacete balístico", valor_mnt_dia: 2.56 },
  { categoria: "Material de Estacionamento", item: "Barraca de campanha", valor_mnt_dia: 7.55 },
  { categoria: "Material de Estacionamento", item: "Toldo modular", valor_mnt_dia: 1.88 },
  { categoria: "Material de Estacionamento", item: "Barraca individual", valor_mnt_dia: 0.26 },
  { categoria: "Material de Estacionamento", item: "Cama de campanha", valor_mnt_dia: 0.32 },
  { categoria: "Material de Estacionamento", item: "Marmita Térmica", valor_mnt_dia: 0.67 },
  { categoria: "Material de Estacionamento", item: "Armário", valor_mnt_dia: 0.82 },
  { categoria: "Material de Estacionamento", item: "Beliche", valor_mnt_dia: 0.66 },
  { categoria: "Material de Estacionamento", item: "Colchão", valor_mnt_dia: 0.28 },
];

const CATEGORIAS_CLASSE_II = [
  "Equipamento Individual",
  "Proteção Balística",
  "Material de Estacionamento",
];

const CATEGORIAS_CLASSE_III = [
  { key: "GERADOR", label: "Geradores" },
  { key: "EMBARCACAO", label: "Embarcações" },
  { key: "MOTOMECANIZACAO", label: "Motomecanização" },
  { key: "EQUIPAMENTO_ENGENHARIA", label: "Engenharia" },
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
  const [showClasseIIConfig, setShowClasseIIConfig] = useState(false);
  const [showClasseIIIConfig, setShowClasseIIIConfig] = useState(false); // NOVO ESTADO PARA CLASSE III
  
  const [geradorConfig, setGeradorConfig] = useState<DiretrizEquipamentoForm[]>(defaultGeradorConfig);
  const [embarcacaoConfig, setEmbarcacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultEmbarcacaoConfig);
  const [motomecanizacaoConfig, setMotomecanizacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultMotomecanizacaoConfig);
  const [equipamentosEngenhariaConfig, setEquipamentosEngenhariaConfig] = useState<DiretrizEquipamentoForm[]>(defaultEquipamentosEngenhariaConfig);
  
  const [classeIIConfig, setClasseIIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseIIConfig);
  
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizCusteio>>(defaultDiretrizes(new Date().getFullYear()));
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedClasseIITab, setSelectedClasseIITab] = useState<string>(CATEGORIAS_CLASSE_II[0]);
  const [selectedClasseIIITab, setSelectedClasseIIITab] = useState<string>(CATEGORIAS_CLASSE_III[0].key); // Novo estado para a aba Classe III
  
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    checkAuthAndLoadYears();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      } else {
        setDiretrizes(defaultDiretrizes(year));
      }
      
      // --- Carregar Classe II ---
      const { data: classeIIData } = await supabase
        .from("diretrizes_classe_ii")
        .select("categoria, item, valor_mnt_dia")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .eq("ativo", true);

      if (classeIIData && classeIIData.length > 0) {
        setClasseIIConfig(classeIIData.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseIIConfig(defaultClasseIIConfig);
      }

      // --- Carregar Classe III - Geradores ---
      const { data: equipamentosData } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .eq("categoria", "GERADOR")
        .eq("ativo", true);

      if (equipamentosData && equipamentosData.length > 0) {
        setGeradorConfig(equipamentosData.map(eq => ({
          nome_equipamento: eq.nome_equipamento,
          tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
          consumo: Number(eq.consumo),
          unidade: eq.unidade as 'L/h' | 'km/L',
        })));
      } else {
        setGeradorConfig(defaultGeradorConfig);
      }

      // --- Carregar Classe III - Embarcações ---
      const { data: embarcacoesData } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
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
      
      // --- Carregar Classe III - Motomecanização ---
      const { data: motomecanizacaoData } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
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

      // --- Carregar Classe III - Equipamentos de Engenharia ---
      const { data: engenhariaData } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .eq("categoria", "EQUIPAMENTO_ENGENHARIA")
        .eq("ativo", true);

      if (engenhariaData && engenhariaData.length > 0) {
        setEquipamentosEngenhariaConfig(engenhariaData.map(eq => ({
          nome_equipamento: eq.nome_equipamento,
          tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
          consumo: Number(eq.consumo),
          unidade: eq.unidade as 'L/h' | 'km/L',
        })));
      } else {
        setEquipamentosEngenhariaConfig(defaultEquipamentosEngenhariaConfig);
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

      // 1. Salvar Diretrizes de Custeio (Valores e Fatores)
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
      
      // 2. Salvar Configurações de Equipamentos (Classe III)
      const categoriasClasseIII = ["GERADOR", "EMBARCACAO", "MOTOMECANIZACAO", "EQUIPAMENTO_ENGENHARIA"];
      const configsClasseIII = {
        "GERADOR": geradorConfig,
        "EMBARCACAO": embarcacaoConfig,
        "MOTOMECANIZACAO": motomecanizacaoConfig,
        "EQUIPAMENTO_ENGENHARIA": equipamentosEngenhariaConfig,
      };

      for (const categoria of categoriasClasseIII) {
        // Deletar registros antigos da categoria
        await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .delete()
          .eq("user_id", user.id)
          .eq("ano_referencia", diretrizes.ano_referencia!)
          .eq("categoria", categoria);

        // Inserir novos registros
        const configList = configsClasseIII[categoria as keyof typeof configsClasseIII];
        const equipamentosParaSalvar = configList
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
      }
      
      // 3. Salvar Configurações de Classe II
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const classeIIParaSalvar = classeIIConfig
        .filter(item => item.item && item.valor_mnt_dia >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: diretrizes.ano_referencia,
          categoria: item.categoria,
          item: item.item,
          valor_mnt_dia: item.valor_mnt_dia,
          ativo: true,
        }));
        
      if (classeIIParaSalvar.length > 0) {
        const { error: c2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(classeIIParaSalvar);
        if (c2Error) throw c2Error;
      }

      await loadAvailableYears();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("Já existe uma diretriz para este ano");
      } else {
        toast.error(sanitizeError(error));
      }
    }
  };
  
  // Função genérica para adicionar item (Classe III)
  const handleAddItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, unidade: 'L/h' | 'km/L') => {
    setConfig([
      ...config,
      { nome_equipamento: "", tipo_combustivel: "OD", consumo: 0, unidade: unidade }
    ]);
  };

  // Função genérica para remover item (Classe III)
  const handleRemoveItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  // Função genérica para atualizar item (Classe III)
  const handleUpdateItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, index: number, field: keyof DiretrizEquipamentoForm, value: any) => {
    const novosItens = [...config];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setConfig(novosItens);
  };
  
  // --- Funções de Gerenciamento da Classe II ---
  const handleAddClasseIIItem = (categoria: DiretrizClasseIIForm['categoria']) => {
    setClasseIIConfig(prev => [
      ...prev,
      { categoria: categoria, item: "", valor_mnt_dia: 0 } as DiretrizClasseIIForm
    ]);
  };

  const handleRemoveClasseIIItem = (index: number) => {
    setClasseIIConfig(classeIIConfig.filter((_, i) => i !== index));
  };

  const handleUpdateClasseIIItem = (index: number, field: keyof DiretrizClasseIIForm, value: any) => {
    const novosItens = [...classeIIConfig];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setClasseIIConfig(novosItens);
  };
  
  // Função para renderizar a lista de itens da Classe II por categoria
  const renderClasseIIList = (categoria: DiretrizClasseIIForm['categoria']) => {
    const filteredItems = classeIIConfig.filter(item => item.categoria === categoria);
    
    return (
      <div className="space-y-4 pt-4">
        {filteredItems.map((item, index) => {
          // Encontrar o índice original no array completo para permitir a atualização/remoção
          const indexToUse = classeIIConfig.findIndex(c => c.item === item.item && c.categoria === item.categoria);
          
          const handleUpdateFilteredItem = (field: keyof DiretrizClasseIIForm, value: any) => {
            const indexInMainArray = classeIIConfig.findIndex(c => c === item);
            if (indexInMainArray !== -1) {
              handleUpdateClasseIIItem(indexInMainArray, field, value);
            }
          };

          const handleRemoveFilteredItem = () => {
            const indexInMainArray = classeIIConfig.findIndex(c => c === item);
            if (indexInMainArray !== -1) {
              handleRemoveClasseIIItem(indexInMainArray);
            }
          };
          
          return (
            <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
              <div className="col-span-8">
                <Label className="text-xs">Item</Label>
                <Input
                  value={item.item}
                  onChange={(e) => handleUpdateFilteredItem('item', e.target.value)}
                  placeholder="Ex: Colete balístico"
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Valor Mnt/Dia (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={item.valor_mnt_dia === 0 ? "" : item.valor_mnt_dia}
                  onChange={(e) => handleUpdateFilteredItem('valor_mnt_dia', parseFloat(e.target.value) || 0)}
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFilteredItem}
                  type="button"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleAddClasseIIItem(categoria)} 
          className="w-full"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>
      </div>
    );
  };
  
  // Função para renderizar a lista de itens da Classe III por categoria
  const renderClasseIIIList = (categoria: string, config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>) => {
    const unidade = categoria === 'MOTOMECANIZACAO' ? 'km/L' : 'L/h';
    
    return (
      <div className="space-y-4 pt-4">
        {config.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
            <div className="col-span-5">
              <Label className="text-xs">Nome do Equipamento</Label>
              <Input
                value={item.nome_equipamento}
                onChange={(e) => handleUpdateItem(config, setConfig, index, 'nome_equipamento', e.target.value)}
                placeholder="Ex: Retroescavadeira"
                onKeyDown={handleEnterToNextField}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Combustível</Label>
              <Select
                value={item.tipo_combustivel}
                onValueChange={(val: 'GAS' | 'OD') => handleUpdateItem(config, setConfig, index, 'tipo_combustivel', val)}
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
                value={item.consumo === 0 ? "" : item.consumo}
                onChange={(e) => handleUpdateItem(config, setConfig, index, 'consumo', parseFloat(e.target.value) || 0)}
                onKeyDown={handleEnterToNextField}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Unidade</Label>
              <Input value={unidade} disabled className="bg-muted text-muted-foreground" onKeyDown={handleEnterToNextField} />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveItem(config, setConfig, index)}
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
          onClick={() => handleAddItem(config, setConfig, unidade as 'L/h' | 'km/L')} 
          className="w-full"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Equipamento
        </Button>
      </div>
    );
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
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Planos de Trabalho
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Configurações da Diretriz de Custeio</CardTitle>
            <CardDescription>Diretrizes de Custeio (COLOG)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
              <div className="space-y-2 mb-6">
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

              {/* SEÇÃO CLASSE I - ALIMENTAÇÃO */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIAlimentacaoConfig(!showClasseIAlimentacaoConfig)}
                >
                  <h3 className="text-lg font-semibold">Classe I - Alimentação</h3>
                  {showClasseIAlimentacaoConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIAlimentacaoConfig && (
                  <div className="space-y-4 mt-2">
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
              
              {/* SEÇÃO CLASSE II - MATERIAL DE INTENDÊNCIA */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIConfig(!showClasseIIConfig)}
                >
                  <h3 className="text-lg font-semibold">
                    Classe II - Material de Intendência
                  </h3>
                  {showClasseIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIConfig && (
                  <Card>
                    <CardContent className="pt-4">
                      <Tabs value={selectedClasseIITab} onValueChange={setSelectedClasseIITab}>
                        <TabsList className="grid w-full grid-cols-3">
                          {CATEGORIAS_CLASSE_II.map(cat => (
                            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                          ))}
                        </TabsList>
                        
                        {CATEGORIAS_CLASSE_II.map(cat => (
                          <TabsContent key={cat} value={cat}>
                            {renderClasseIIList(cat as DiretrizClasseIIForm['categoria'])}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* SEÇÃO CLASSE III - COMBUSTÍVEIS E LUBRIFICANTES */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIIConfig(!showClasseIIIConfig)}
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Fuel className="h-5 w-5 text-primary" />
                    Classe III - Combustíveis e Lubrificantes
                  </h3>
                  {showClasseIIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIIConfig && (
                  <Card>
                    <CardContent className="pt-4">
                      <Tabs value={selectedClasseIIITab} onValueChange={setSelectedClasseIIITab}>
                        <TabsList className="grid w-full grid-cols-4">
                          {CATEGORIAS_CLASSE_III.map(cat => (
                            <TabsTrigger key={cat.key} value={cat.key}>{cat.label}</TabsTrigger>
                          ))}
                        </TabsList>
                        
                        <TabsContent value="GERADOR">
                          {renderClasseIIIList("GERADOR", geradorConfig, setGeradorConfig)}
                        </TabsContent>
                        <TabsContent value="EMBARCACAO">
                          {renderClasseIIIList("EMBARCACAO", embarcacaoConfig, setEmbarcacaoConfig)}
                        </TabsContent>
                        <TabsContent value="MOTOMECANIZACAO">
                          {renderClasseIIIList("MOTOMECANIZACAO", motomecanizacaoConfig, setMotomecanizacaoConfig)}
                        </TabsContent>
                        <TabsContent value="EQUIPAMENTO_ENGENHARIA">
                          {renderClasseIIIList("EQUIPAMENTO_ENGENHARIA", equipamentosEngenhariaConfig, setEquipamentosEngenhariaConfig)}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>


              <div className="space-y-2 border-t pt-4 mt-6">
                <Label>Observações</Label>
                <Textarea
                  value={diretrizes.observacoes}
                  onChange={(e) => setDiretrizes({ ...diretrizes, observacoes: e.target.value })}
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <Button type="submit" className="w-full mt-6">Salvar Diretrizes</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiretrizesCusteioPage;