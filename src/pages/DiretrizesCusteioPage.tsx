import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { DiretrizCusteio } from "@/types/diretrizes";
import { DiretrizClasseIX, DiretrizClasseIXForm } from "@/types/diretrizesClasseIX";
import { DiretrizClasseII, DiretrizClasseIIForm } from "@/types/diretrizesClasseII";
import { formatNumberForInput, parseInputToNumber, formatInputWithThousands } from "@/lib/formatUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultClasseIXConfig } from "@/data/classeIXData";

// Assumindo que as configurações padrão para outras classes existem
const defaultClasseIIConfig: DiretrizClasseIIForm[] = []; 

type CategoriaClasseIX = 'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada';
type CategoriaClasseII = 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';

const CATEGORIAS_CLASSE_IX: CategoriaClasseIX[] = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];
const CATEGORIAS_CLASSE_II: CategoriaClasseII[] = ["Equipamento Individual", "Proteção Balística", "Material de Estacionamento"];

interface DiretrizesFormState {
  ano_referencia: number | null;
  classe_i_valor_qs: string;
  classe_i_valor_qr: string;
  classe_iii_fator_gerador: number;
  classe_iii_fator_embarcacao: number;
  classe_iii_fator_equip_engenharia: number;
}

const initialDiretrizesState: DiretrizesFormState = {
  ano_referencia: new Date().getFullYear(),
  classe_i_valor_qs: formatNumberForInput(9.00, 2),
  classe_i_valor_qr: formatNumberForInput(6.00, 2),
  classe_iii_fator_gerador: 0,
  classe_iii_fator_embarcacao: 0,
  classe_iii_fator_equip_engenharia: 0,
};

const DiretrizesCusteioPage = () => {
  const navigate = useNavigate();
  const { user, loading: loadingSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [diretrizes, setDiretrizes] = useState<DiretrizesFormState>(initialDiretrizesState);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedTab, setSelectedTab] = useState('classe-i');
  
  // State for Classe IX
  const [classeIXConfig, setClasseIXConfig] = useState<DiretrizClasseIXForm[]>([]);
  const [newClasseIXItem, setNewClasseIXItem] = useState<DiretrizClasseIXForm>({
    categoria: CATEGORIAS_CLASSE_IX[0],
    item: '',
    valor_mnt_dia: 0,
    valor_acionamento_mensal: 0,
  });
  
  // State for Classe II (simplified)
  const [classeIIConfig, setClasseIIConfig] = useState<DiretrizClasseIIForm[]>([]);
  
  useEffect(() => {
    if (!loadingSession && user) {
      loadAvailableYears();
    }
  }, [loadingSession, user]);

  useEffect(() => {
    if (diretrizes.ano_referencia) {
      loadDiretrizesForYear(diretrizes.ano_referencia);
    }
  }, [diretrizes.ano_referencia, loadingSession, user]);

  const loadAvailableYears = async () => {
    if (!user) return;
    try {
      const { data: yearsData, error } = await supabase
        .from('diretrizes_custeio')
        .select('ano_referencia')
        .eq('user_id', user.id)
        .order('ano_referencia', { ascending: false });

      if (error) throw error;

      const years = Array.from(new Set((yearsData || []).map(d => d.ano_referencia))).sort((a, b) => b - a);
      setAvailableYears(years);
      
      if (years.length > 0 && !diretrizes.ano_referencia) {
        setDiretrizes(prev => ({ ...prev, ano_referencia: years[0] }));
      } else if (years.length === 0) {
        // Set current year if no data exists
        setDiretrizes(prev => ({ ...prev, ano_referencia: new Date().getFullYear() }));
      }
    } catch (error) {
      console.error("Erro ao carregar anos disponíveis:", error);
    }
  };

  const loadDiretrizesForYear = async (year: number) => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Carregar Diretriz Custeio (Classe I e Fatores Classe III)
      const { data: custeioData, error: custeioError } = await supabase
        .from('diretrizes_custeio')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .maybeSingle();

      if (custeioError) throw custeioError;

      if (custeioData) {
        setDiretrizes({
          ano_referencia: year,
          classe_i_valor_qs: formatNumberForInput(Number(custeioData.classe_i_valor_qs), 2),
          classe_i_valor_qr: formatNumberForInput(Number(custeioData.classe_i_valor_qr), 2),
          classe_iii_fator_gerador: Number(custeioData.classe_iii_fator_gerador),
          classe_iii_fator_embarcacao: Number(custeioData.classe_iii_fator_embarcacao),
          classe_iii_fator_equip_engenharia: Number(custeioData.classe_iii_fator_equip_engenharia),
        });
      } else {
        // Reset to initial state for the new year
        setDiretrizes({ ...initialDiretrizesState, ano_referencia: year });
      }
      
      // 2. Carregar Diretrizes Classe IX
      const { data: classeIXData, error: classeIXError } = await supabase
        .from('diretrizes_classe_ix')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year);

      if (classeIXError) throw classeIXError;
      
      if (classeIXData && classeIXData.length > 0) {
        setClasseIXConfig(classeIXData.map(d => ({
          categoria: d.categoria as CategoriaClasseIX,
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
          valor_acionamento_mensal: Number(d.valor_acionamento_mensal),
        })));
      } else {
        setClasseIXConfig(defaultClasseIXConfig);
      }
      
      // 3. Carregar Diretrizes Classe II (e outras classes que usam a mesma tabela)
      const { data: classeIIData, error: classeIIError } = await supabase
        .from('diretrizes_classe_ii')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year);
        
      if (classeIIError) throw classeIIError;
      
      if (classeIIData && classeIIData.length > 0) {
        setClasseIIConfig(classeIIData.map(d => ({
          categoria: d.categoria as CategoriaClasseII,
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseIIConfig(defaultClasseIIConfig);
      }

    } catch (error: any) {
      toast.error(`Erro ao carregar diretrizes: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiretrizes = async () => {
    if (!user || !diretrizes.ano_referencia) return;
    setLoading(true);

    const anoReferencia = diretrizes.ano_referencia;
    
    // 1. Preparar dados de Custeio (Classe I e Fatores Classe III)
    const custeioData = {
      user_id: user.id,
      ano_referencia: anoReferencia,
      classe_i_valor_qs: parseInputToNumber(diretrizes.classe_i_valor_qs),
      classe_i_valor_qr: parseInputToNumber(diretrizes.classe_i_valor_qr),
      classe_iii_fator_gerador: diretrizes.classe_iii_fator_gerador,
      classe_iii_fator_embarcacao: diretrizes.classe_iii_fator_embarcacao,
      classe_iii_fator_equip_engenharia: diretrizes.classe_iii_fator_equip_engenharia,
    };

    try {
      // Salvar/Atualizar Diretriz Custeio
      const { error: custeioError } = await supabase
        .from("diretrizes_custeio")
        .upsert([custeioData], { onConflict: 'user_id, ano_referencia' });
      if (custeioError) throw custeioError;
      
      // 2. Salvar Configurações de Classe IX (Motomecanização)
      
      // Deletar registros antigos de Classe IX
      await supabase
        .from("diretrizes_classe_ix")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia);
        
      const classeIXItemsParaSalvar = classeIXConfig
        .filter(item => item.item && item.valor_mnt_dia >= 0 && item.valor_acionamento_mensal >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: anoReferencia,
          categoria: item.categoria,
          item: item.item,
          valor_mnt_dia: Number(item.valor_mnt_dia), 
          valor_acionamento_mensal: Number(item.valor_acionamento_mensal), 
        }));
        
      if (classeIXItemsParaSalvar.length > 0) {
        const { error: c9Error } = await supabase
          .from("diretrizes_classe_ix")
          .insert(classeIXItemsParaSalvar);
        if (c9Error) throw c9Error;
      }
      
      // 3. Salvar Configurações de Classe II (e outras classes que usam a mesma tabela)
      // Deletar registros antigos de Classe II
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia);
        
      const classeIIItemsParaSalvar = classeIIConfig
        .filter(item => item.item && item.valor_mnt_dia >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: anoReferencia,
          categoria: item.categoria,
          item: item.item,
          valor_mnt_dia: Number(item.valor_mnt_dia),
          ativo: true, 
        }));
        
      if (classeIIItemsParaSalvar.length > 0) {
        const { error: c2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(classeIIItemsParaSalvar);
        if (c2Error) throw c2Error;
      }

      toast.success(`Diretrizes para o ano ${anoReferencia} salvas com sucesso!`);
      loadAvailableYears(); // Reload years in case a new one was created
    } catch (error: any) {
      toast.error(`Falha ao salvar diretrizes: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // --- Handlers para Classe IX ---
  const handleClasseIXChange = (index: number, field: keyof DiretrizClasseIXForm, value: any) => {
    const newConfig = [...classeIXConfig];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setClasseIXConfig(newConfig);
  };

  const handleAddClasseIXItem = () => {
    if (!newClasseIXItem.item || newClasseIXItem.valor_mnt_dia < 0 || newClasseIXItem.valor_acionamento_mensal < 0) {
      toast.error("Preencha todos os campos obrigatórios e garanta que os valores sejam positivos.");
      return;
    }
    setClasseIXConfig(prev => [...prev, newClasseIXItem]);
    setNewClasseIXItem({
      categoria: CATEGORIAS_CLASSE_IX[0],
      item: '',
      valor_mnt_dia: 0,
      valor_acionamento_mensal: 0,
    });
  };

  const handleRemoveClasseIXItem = (index: number) => {
    setClasseIXConfig(prev => prev.filter((_, i) => i !== index));
  };
  
  // --- Handlers para Classe II (Simplificado) ---
  const handleClasseIIChange = (index: number, field: keyof DiretrizClasseIIForm, value: any) => {
    const newConfig = [...classeIIConfig];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setClasseIIConfig(newConfig);
  };
  
  const handleRemoveClasseIIItem = (index: number) => {
    setClasseIIConfig(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleAddClasseIIItem = () => {
    // Simplified logic for adding a new item
    setClasseIIConfig(prev => [...prev, {
        categoria: CATEGORIAS_CLASSE_II[0],
        item: '',
        valor_mnt_dia: 0,
    }]);
  };

  const filteredClasseIXConfig = useMemo(() => {
    return classeIXConfig.filter(item => item.categoria === selectedTab);
  }, [classeIXConfig, selectedTab]);
  
  const filteredClasseIIConfig = useMemo(() => {
    return classeIIConfig.filter(item => item.categoria === selectedTab);
  }, [classeIIConfig, selectedTab]);
  
  const totalClasseIX = classeIXConfig.length;
  const totalClasseII = classeIIConfig.length;

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/ptrab')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para P Trab
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Configuração de Diretrizes de Custeio</CardTitle>
            <CardDescription>
              Defina os valores de referência e fatores de cálculo para o ano selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Seleção de Ano */}
            <div className="flex items-center gap-4 border-b pb-4">
              <Label htmlFor="ano-referencia" className="shrink-0">Ano de Referência:</Label>
              <Select
                value={diretrizes.ano_referencia?.toString() || new Date().getFullYear().toString()}
                onValueChange={(value) => setDiretrizes(prev => ({ ...prev, ano_referencia: parseInt(value) }))}
                disabled={loading}
              >
                <SelectTrigger id="ano-referencia" className="w-[180px]">
                  <SelectValue placeholder="Selecione o Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                  {/* Opção para o ano atual se não estiver na lista */}
                  {!availableYears.includes(new Date().getFullYear()) && (
                    <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()} (Novo)</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const currentYear = new Date().getFullYear();
                  if (!availableYears.includes(currentYear)) {
                    setDiretrizes(prev => ({ ...prev, ano_referencia: currentYear }));
                  }
                }}
                disabled={loading || availableYears.includes(new Date().getFullYear())}
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Ano
              </Button>
            </div>

            {/* Tabs de Configuração */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="classe-i">Classe I</TabsTrigger>
                <TabsTrigger value="classe-ii">Classe II/V/VI/VII/VIII</TabsTrigger>
                <TabsTrigger value="classe-ix">Classe IX</TabsTrigger>
                <TabsTrigger value="classe-iii">Classe III</TabsTrigger>
              </TabsList>

              {/* Tab 1: Classe I (Custeio Geral) */}
              <TabsContent value="classe-i" className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg">Valores de Etapa (Classe I)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor="valor-qs">Valor da Etapa QS (Quantitativo de Subsistência)</Label>
                    <Input
                      id="valor-qs"
                      type="text"
                      inputMode="decimal"
                      value={diretrizes.classe_i_valor_qs}
                      onChange={(e) => setDiretrizes({ ...diretrizes, classe_i_valor_qs: formatInputWithThousands(e.target.value) })}
                      onBlur={() => setDiretrizes(prev => ({ ...prev, classe_i_valor_qs: formatNumberForInput(parseInputToNumber(prev.classe_i_valor_qs), 2) }))}
                      placeholder="0,00"
                      className="pl-8"
                    />
                    <span className="absolute left-2 top-[29px] text-lg text-foreground">R$</span>
                  </div>
                  <div className="space-y-2 relative">
                    <Label htmlFor="valor-qr">Valor da Etapa QR (Quantitativo de Rancho)</Label>
                    <Input
                      id="valor-qr"
                      type="text"
                      inputMode="decimal"
                      value={diretrizes.classe_i_valor_qr}
                      onChange={(e) => setDiretrizes({ ...diretrizes, classe_i_valor_qr: formatInputWithThousands(e.target.value) })}
                      onBlur={() => setDiretrizes(prev => ({ ...prev, classe_i_valor_qr: formatNumberForInput(parseInputToNumber(prev.classe_i_valor_qr), 2) }))}
                      placeholder="0,00"
                      className="pl-8"
                    />
                    <span className="absolute left-2 top-[29px] text-lg text-foreground">R$</span>
                  </div>
                </div>
              </TabsContent>
              
              {/* Tab 2: Classe II/V/VI/VII/VIII (Itens de Manutenção) */}
              <TabsContent value="classe-ii" className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg">Itens de Manutenção (Valor Mnt/Dia)</h3>
                <p className="text-sm text-muted-foreground">
                    Configure os valores diários de manutenção para as categorias de Classe II, V, VI, VII e VIII.
                </p>
                
                {/* Simplificado: Apenas mostra a lista de itens carregados */}
                <div className="max-h-[400px] overflow-y-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30%]">Categoria</TableHead>
                                <TableHead className="w-[40%]">Item</TableHead>
                                <TableHead className="w-[20%] text-right">Valor Mnt/Dia (R$)</TableHead>
                                <TableHead className="w-[10%] text-center">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classeIIConfig.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        Nenhum item configurado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                classeIIConfig.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="text-xs">{item.categoria}</TableCell>
                                        <TableCell className="font-medium">{item.item}</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-8 text-right"
                                                value={formatNumberForInput(item.valor_mnt_dia, 2)}
                                                onChange={(e) => handleClasseIIChange(index, 'valor_mnt_dia', parseInputToNumber(e.target.value))}
                                                onBlur={(e) => handleClasseIIChange(index, 'valor_mnt_dia', parseInputToNumber(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveClasseIIItem(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <Button onClick={handleAddClasseIIItem} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Novo Item
                </Button>
              </TabsContent>

              {/* Tab 3: Classe IX (Motomecanização) */}
              <TabsContent value="classe-ix" className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg">Itens de Motomecanização (Classe IX)</h3>
                <p className="text-sm text-muted-foreground">
                    Configure os valores diários de manutenção e acionamento mensal para viaturas. Total de itens: {totalClasseIX}
                </p>
                
                {/* Formulário de Adição */}
                <Card className="p-4 bg-background">
                    <h4 className="font-semibold mb-3">Adicionar Novo Item</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select
                                value={newClasseIXItem.categoria}
                                onValueChange={(value) => setNewClasseIXItem(prev => ({ ...prev, categoria: value as CategoriaClasseIX }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS_CLASSE_IX.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-1">
                            <Label>Item (Descrição)</Label>
                            <Input
                                value={newClasseIXItem.item}
                                onChange={(e) => setNewClasseIXItem(prev => ({ ...prev, item: e.target.value }))}
                                placeholder="Ex: VTP Sedan Médio"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor Mnt/Dia (R$)</Label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberForInput(newClasseIXItem.valor_mnt_dia, 2)}
                                onChange={(e) => setNewClasseIXItem(prev => ({ ...prev, valor_mnt_dia: parseInputToNumber(e.target.value) }))}
                                onBlur={(e) => setNewClasseIXItem(prev => ({ ...prev, valor_mnt_dia: parseInputToNumber(e.target.value) }))}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Acionamento/Mês (R$)</Label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberForInput(newClasseIXItem.valor_acionamento_mensal, 2)}
                                onChange={(e) => setNewClasseIXItem(prev => ({ ...prev, valor_acionamento_mensal: parseInputToNumber(e.target.value) }))}
                                onBlur={(e) => setNewClasseIXItem(prev => ({ ...prev, valor_acionamento_mensal: parseInputToNumber(e.target.value) }))}
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                    <Button onClick={handleAddClasseIXItem} className="mt-4 w-full md:w-auto">
                        <Plus className="h-4 w-4 mr-2" /> Adicionar
                    </Button>
                </Card>
                
                {/* Tabela de Itens Configurados */}
                <div className="max-h-[400px] overflow-y-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30%]">Categoria</TableHead>
                                <TableHead className="w-[35%]">Item</TableHead>
                                <TableHead className="w-[15%] text-right">Mnt/Dia (R$)</TableHead>
                                <TableHead className="w-[15%] text-right">Acionamento/Mês (R$)</TableHead>
                                <TableHead className="w-[5%] text-center">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classeIXConfig.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        Nenhum item configurado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                classeIXConfig.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="text-xs">{item.categoria}</TableCell>
                                        <TableCell className="font-medium">{item.item}</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-8 text-right"
                                                value={formatNumberForInput(item.valor_mnt_dia, 2)}
                                                onChange={(e) => handleClasseIXChange(index, 'valor_mnt_dia', parseInputToNumber(e.target.value))}
                                                onBlur={(e) => handleClasseIXChange(index, 'valor_mnt_dia', parseInputToNumber(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-8 text-right"
                                                value={formatNumberForInput(item.valor_acionamento_mensal, 2)}
                                                onChange={(e) => handleClasseIXChange(index, 'valor_acionamento_mensal', parseInputToNumber(e.target.value))}
                                                onBlur={(e) => handleClasseIXChange(index, 'valor_acionamento_mensal', parseInputToNumber(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveClasseIXItem(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
              </TabsContent>

              {/* Tab 4: Classe III (Fatores) - Simplified */}
              <TabsContent value="classe-iii" className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg">Fatores de Consumo (Classe III)</h3>
                <p className="text-sm text-muted-foreground">
                    Configuração de fatores de consumo para equipamentos (Embarcação, Gerador, Engenharia).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fator-gerador">Fator Gerador (L/h)</Label>
                        <Input
                            id="fator-gerador"
                            type="number"
                            step="0.01"
                            value={diretrizes.classe_iii_fator_gerador}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_iii_fator_gerador: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fator-embarcacao">Fator Embarcação (L/h)</Label>
                        <Input
                            id="fator-embarcacao"
                            type="number"
                            step="0.01"
                            value={diretrizes.classe_iii_fator_embarcacao}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_iii_fator_embarcacao: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fator-engenharia">Fator Eqp Engenharia (L/h)</Label>
                        <Input
                            id="fator-engenharia"
                            type="number"
                            step="0.01"
                            value={diretrizes.classe_iii_fator_equip_engenharia}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_iii_fator_equip_engenharia: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <AlertCircle className="h-4 w-4 inline mr-2 text-yellow-600" />
                <span className="text-sm text-yellow-600">
                    A configuração detalhada de Classe III (consumo por equipamento) é feita na página de Diretrizes de Equipamentos.
                </span>
              </TabsContent>
            </Tabs>

            {/* Botão Salvar */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveDiretrizes} disabled={loading || !diretrizes.ano_referencia} className="gap-2">
                <Save className="h-4 w-4" />
                {loading ? "Salvando..." : `Salvar Diretrizes (${diretrizes.ano_referencia})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiretrizesCusteioPage;