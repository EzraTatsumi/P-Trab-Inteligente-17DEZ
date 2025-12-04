import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Package, Pencil, Trash2, XCircle, Check, ChevronDown, ChevronsUpDown, ClipboardList, Sparkles, DollarSign, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { DiretrizClasseII } from "@/types/diretrizesClasseII";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultClasseIIConfig } from "@/data/classeIIData";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Categoria = 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';

const CATEGORIAS: Categoria[] = [
  'Equipamento Individual',
  'Proteção Balística',
  'Material de Estacionamento',
];

// Tipagem simplificada para o registro
interface ClasseIIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: Categoria;
  itens_equipamentos: ItemClasseII[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
}

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: Categoria;
}

interface ItemForm {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: Categoria;
}

const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// Função para formatar fases
const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
    if (!faseCSV) return 'operação';
    const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
    if (fases.length === 0) return 'operação';
    if (fases.length === 1) return fases[0];
    if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
    const ultimaFase = fases[fases.length - 1];
    const demaisFases = fases.slice(0, -1).join(', ');
    return `${demaisFases} e ${ultimaFase}`;
};

// Função para gerar a memória de cálculo formatada
const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro): string => {
  const { organizacao, ug, dias_operacao, itens_equipamentos, valor_nd_30, valor_nd_39, fase_atividade } = registro;
  
  const faseFormatada = formatFasesParaTexto(fase_atividade);
  
  const totalItens = itens_equipamentos.reduce((sum, item) => sum + item.quantidade, 0);
  const totalValor = valor_nd_30 + valor_nd_39;
  
  const detalhamentoItens = itens_equipamentos.map(item => 
    `- ${item.quantidade} un. de ${item.item} x ${dias_operacao} dias x ${formatCurrency(item.valor_mnt_dia)}/dia = ${formatCurrency(item.quantidade * dias_operacao * item.valor_mnt_dia)}`
  ).join('\n');
  
  const memoria = `33.90.30/33.90.39 - Aquisição de Material de Intendência (Classe II) para ${organizacao} (UG: ${ug}), durante ${dias_operacao} dias de ${faseFormatada}.
Total de itens: ${totalItens} unidades.
Valor Total: ${formatCurrency(totalValor)}.

Detalhamento dos Itens:
${detalhamentoItens}

Total ND 30 (Material): ${formatCurrency(valor_nd_30)}.
Total ND 39 (Serviço): ${formatCurrency(valor_nd_39)}.`;

  return memoria;
};


export default function ClasseIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  
  const [loading, setLoading] = useState(true);
  const [ptrabNome, setPtrabNome] = useState<string>("");
  const [diretrizAno, setDiretrizAno] = useState<number | null>(null);
  const [diretrizesDisponiveis, setDiretrizesDisponiveis] = useState<DiretrizClasseII[]>([]);
  const [registros, setRegistros] = useState<ClasseIIRegistro[]>([]);
  
  // Form States
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [organizacao, setOrganizacao] = useState<string>("");
  const [ug, setUg] = useState<string>("");
  const [diasOperacao, setDiasOperacao] = useState<number>(0);
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria>(CATEGORIAS[0]);
  const [itensSelecionados, setItensSelecionados] = useState<ItemForm[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  
  // Edição
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const { handleEnterToNextField } = useFormNavigation();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuthAndLoadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }

    if (!ptrabId) {
      toast.error("Nenhum P Trab selecionado");
      navigate("/ptrab");
      return;
    }

    await loadPTrab(ptrabId);
    await loadDiretrizes();
    await loadRegistros(ptrabId);
    setLoading(false);
  };

  const loadPTrab = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("numero_ptrab, nome_operacao")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPtrabNome(`${data.numero_ptrab} - ${data.nome_operacao}`);
    } catch (error: any) {
      toast.error("Erro ao carregar P Trab");
      navigate("/ptrab");
    }
  };

  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let anoReferencia: number | null = null;

      // 1. Tentar buscar o ano padrão do perfil do usuário
      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_diretriz_year")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profileData?.default_diretriz_year) {
          anoReferencia = profileData.default_diretriz_year;
      }

      // 2. Se não houver ano padrão, buscar o ano mais recente na tabela de diretrizes
      if (!anoReferencia) {
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
      }
      
      if (!anoReferencia) {
        setDiretrizAno(null);
        setDiretrizesDisponiveis(defaultClasseIIConfig as DiretrizClasseII[]);
        return;
      }
      
      setDiretrizAno(anoReferencia);

      // 3. Buscar diretrizes de Classe II
      const { data, error } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .in("categoria", CATEGORIAS)
        .eq("ativo", true);

      if (error) throw error;

      if (data && data.length > 0) {
        setDiretrizesDisponiveis(data as DiretrizClasseII[]);
      } else {
        setDiretrizesDisponiveis(defaultClasseIIConfig as DiretrizClasseII[]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizesDisponiveis(defaultClasseIIConfig as DiretrizClasseII[]);
    }
  };

  const loadRegistros = async (ptrabId: string) => {
    try {
      const { data, error } = await supabase
        .from("classe_ii_registros")
        .select("*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39")
        .eq("p_trab_id", ptrabId)
        .in("categoria", CATEGORIAS)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setRegistros((data || []) as ClasseIIRegistro[]);
    } catch (error: any) {
      toast.error("Erro ao carregar registros");
    }
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmId(omData.id);
      setOrganizacao(omData.nome_om);
      setUg(omData.codug_om);
    } else {
      setSelectedOmId(undefined);
      setOrganizacao("");
      setUg("");
    }
  };

  const handleItemToggle = (item: DiretrizClasseII, isChecked: boolean) => {
    const itemForm: ItemForm = {
      item: item.item,
      quantidade: 1, // Padrão 1
      valor_mnt_dia: Number(item.valor_mnt_dia),
      categoria: item.categoria as Categoria,
    };

    if (isChecked) {
      // Adiciona o item se não estiver presente
      if (!itensSelecionados.some(i => i.item === item.item && i.categoria === item.categoria)) {
        setItensSelecionados(prev => [...prev, itemForm]);
      }
    } else {
      // Remove o item
      setItensSelecionados(prev => prev.filter(i => i.item !== item.item || i.categoria !== item.categoria));
    }
  };

  const handleQuantidadeChange = (itemNome: string, categoria: Categoria, quantidade: number) => {
    setItensSelecionados(prev => 
      prev.map(item => 
        item.item === itemNome && item.categoria === categoria
          ? { ...item, quantidade: quantidade > 0 ? quantidade : 1 }
          : item
      )
    );
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  const handleCadastrar = async () => {
    if (!ptrabId) return;
    if (!organizacao || !ug) { toast.error("Selecione a OM de destino"); return; }
    if (diasOperacao <= 0) { toast.error("Informe os dias de operação"); return; }
    if (itensSelecionados.length === 0) { toast.error("Selecione pelo menos um item"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }

    // Agrupar itens por categoria para salvar um registro por categoria
    const registrosPorCategoria: Record<Categoria, ItemForm[]> = itensSelecionados.reduce((acc, item) => {
      if (!acc[item.categoria]) { acc[item.categoria] = []; }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<Categoria, ItemForm[]>);
    
    setLoading(true);
    
    try {
      // 1. Deletar registros existentes para esta OM (se estiver editando)
      if (editingRegistroId) {
        const { error: deleteError } = await supabase
          .from("classe_ii_registros")
          .delete()
          .eq("p_trab_id", ptrabId)
          .eq("organizacao", organizacao)
          .eq("ug", ug)
          .in("categoria", CATEGORIAS);
        if (deleteError) throw deleteError;
      }
      
      // 2. Inserir novos registros (um por categoria)
      for (const categoria of Object.keys(registrosPorCategoria) as Categoria[]) {
        const itens = registrosPorCategoria[categoria];
        
        // Cálculo: ND 30 (Material) e ND 39 (Serviço)
        // Regra: ND 30 = 70% do valor total, ND 39 = 30% do valor total
        const valorTotal = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
        const valorND30 = valorTotal * 0.7;
        const valorND39 = valorTotal * 0.3;
        
        const registroData: TablesInsert<'classe_ii_registros'> = {
          p_trab_id: ptrabId,
          organizacao: organizacao,
          ug: ug,
          dias_operacao: diasOperacao,
          categoria: categoria,
          itens_equipamentos: itens as any, // Salva a lista de itens
          valor_total: valorTotal,
          detalhamento: "", // Será preenchido automaticamente no DB ou no front
          fase_atividade: faseFinalString,
          valor_nd_30: valorND30,
          valor_nd_39: valorND39,
        };
        
        // Gera a memória de cálculo automática para salvar no campo 'detalhamento'
        const tempRegistro = { ...registroData, itens_equipamentos: itens } as unknown as ClasseIIRegistro;
        registroData.detalhamento = generateClasseIIMemoriaCalculo(tempRegistro);

        const { error: insertError } = await supabase
          .from("classe_ii_registros")
          .insert([registroData]);
        if (insertError) throw insertError;
      }

      toast.success(editingRegistroId ? "Registros atualizados com sucesso!" : "Registros cadastrados com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      loadRegistros(ptrabId);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_ii_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Registro removido com sucesso!");
      loadRegistros(ptrabId!);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseIIRegistro) => {
    setEditingRegistroId(registro.id);
    setOrganizacao(registro.organizacao);
    setUg(registro.ug);
    setDiasOperacao(registro.dias_operacao);
    setSelectedCategoria(registro.categoria);
    setItensSelecionados(registro.itens_equipamentos as ItemForm[]);
    
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    const fasesAtividade = fasesSalvas.filter(f => fasesPadrao.includes(f));
    const customFaseAtividade = fasesSalvas.find(f => !fasesPadrao.includes(f)) || "";
    
    setFasesAtividade(fasesAtividade);
    setCustomFaseAtividade(customFaseAtividade);

    // Buscar o ID da OM para preencher o OmSelector
    try {
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', registro.organizacao)
        .eq('codug_om', registro.ug)
        .single();
      if (omData && !omError) {
        setSelectedOmId(omData.id);
      }
    } catch (error) {
      console.error("Erro ao buscar ID da OM para edição:", error);
      setSelectedOmId(undefined);
    }

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const resetFormFields = () => {
    setEditingRegistroId(null);
    setSelectedOmId(undefined);
    setOrganizacao("");
    setUg("");
    setDiasOperacao(0);
    setSelectedCategoria(CATEGORIAS[0]);
    setItensSelecionados([]);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleIniciarEdicaoMemoria = (registro: ClasseIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || generateClasseIIMemoriaCalculo(registro));
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_ii_registros")
        .update({
          detalhamento_customizado: memoriaEdit.trim() || null,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_ii_registros'>)
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      loadRegistros(ptrabId!);
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error("Erro ao salvar memória de cálculo");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_ii_registros")
        .update({
          detalhamento_customizado: null,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_ii_registros'>)
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      loadRegistros(ptrabId!);
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

  const itensFiltrados = useMemo(() => {
    return diretrizesDisponiveis.filter(d => d.categoria === selectedCategoria);
  }, [diretrizesDisponiveis, selectedCategoria]);

  const totalGeralND30 = registros.reduce((sum, r) => sum + r.valor_nd_30, 0);
  const totalGeralND39 = registros.reduce((sum, r) => sum + r.valor_nd_39, 0);
  const totalGeral = totalGeralND30 + totalGeralND39;
  
  const displayFases = [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');

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

        <Card ref={formRef}>
          <CardHeader>
            <CardTitle>Classe II - Material de Intendência</CardTitle>
            <CardDescription>
              Configure a necessidade de material de Intendência por OM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {diretrizAno === null && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma diretriz de custeio encontrada. Os valores padrão estão sendo utilizados.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleCadastrar(); }} className="space-y-4">
              {/* Dados Básicos */}
              <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="om">OM de Destino do Recurso *</Label>
                  <OmSelector
                    selectedOmId={selectedOmId}
                    onChange={handleOMChange}
                    placeholder="Selecione uma OM de Destino..."
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ug">UG de Destino</Label>
                  <Input
                    id="ug"
                    value={ug}
                    readOnly
                    disabled={true}
                    className="disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diasOperacao">Dias de Atividade *</Label>
                  <Input
                    id="diasOperacao"
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
                    value={diasOperacao === 0 ? "" : diasOperacao.toString()}
                    onChange={(e) => setDiasOperacao(Number(e.target.value))}
                    placeholder="Ex: 30"
                    onKeyDown={handleEnterToNextField}
                    min="1"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="faseAtividade">Fase da Atividade *</Label>
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        type="button"
                        className="w-full justify-between"
                        disabled={loading}
                      >
                        <span className="truncate">
                          {displayFases || "Selecione a(s) fase(s)..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandGroup>
                          {FASES_PADRAO.map((fase) => (
                            <CommandItem
                              key={fase}
                              value={fase}
                              onSelect={() => handleFaseChange(fase, !fasesAtividade.includes(fase))}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={fasesAtividade.includes(fase)}
                                  onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                                />
                                <Label>{fase}</Label>
                              </div>
                              {fasesAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <div className="p-2 border-t">
                          <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                          <Input
                            value={customFaseAtividade}
                            onChange={(e) => setCustomFaseAtividade(e.target.value)}
                            placeholder="Ex: Patrulhamento"
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Seleção de Itens */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <h3 className="text-lg font-semibold">Itens de Custeio (Diretriz {diretrizAno || 'Padrão'})</h3>
                
                <Tabs value={selectedCategoria} onValueChange={(value) => setSelectedCategoria(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-3">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <div className="space-y-3">
                        {itensFiltrados.filter(item => item.categoria === cat).map((item) => {
                          const isSelected = itensSelecionados.some(i => i.item === item.item && i.categoria === item.categoria);
                          const selectedItem = itensSelecionados.find(i => i.item === item.item && i.categoria === item.categoria);
                          
                          return (
                            <Card 
                              key={item.item} 
                              className={cn(
                                "p-3 cursor-pointer transition-all",
                                isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "hover:bg-muted/50"
                              )}
                              onClick={() => handleItemToggle(item, !isSelected)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleItemToggle(item, !!checked)}
                                    id={`item-${item.item}`}
                                  />
                                  <Label htmlFor={`item-${item.item}`} className="flex flex-col cursor-pointer">
                                    <span className="font-medium">{item.item}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatCurrency(Number(item.valor_mnt_dia))} / dia
                                    </span>
                                  </Label>
                                </div>
                                
                                {isSelected && (
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm">Qtd:</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      className="w-20 h-8 text-center"
                                      value={selectedItem?.quantidade || 1}
                                      onChange={(e) => handleQuantidadeChange(item.item, item.categoria as Categoria, parseInt(e.target.value) || 1)}
                                      onClick={(e) => e.stopPropagation()} // Previne o toggle ao clicar no input
                                      onKeyDown={handleEnterToNextField}
                                    />
                                  </div>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Botão Cadastrar/Atualizar e Cancelar */}
              <div className="flex justify-end gap-2 pt-4">
                {editingRegistroId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFormFields}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar Edição
                  </Button>
                )}
                <Button
                  type="submit"
                  className="gap-2"
                  disabled={loading || !organizacao || diasOperacao <= 0 || itensSelecionados.length === 0 || !displayFases}
                >
                  <Plus className="h-4 w-4" />
                  {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registros" : "Cadastrar Registros")}
                </Button>
              </div>
            </form>

            {/* Tabela de Registros */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Registros Cadastrados
                  </h2>
                  <Badge variant="secondary" className="text-sm">
                    {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table className="w-full table-fixed">
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="w-[15%]">OM</TableHead>
                          <TableHead className="w-[10%]">UG</TableHead>
                          <TableHead className="w-[15%]">Categoria</TableHead>
                          <TableHead className="w-[10%] text-center">Dias</TableHead>
                          <TableHead className="w-[15%] text-right">ND 30 (70%)</TableHead>
                          <TableHead className="w-[15%] text-right">ND 39 (30%)</TableHead>
                          <TableHead className="w-[15%] text-right">Total</TableHead>
                          <TableHead className="w-[5%] text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registros.map((registro) => (
                          <TableRow key={registro.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{registro.organizacao}</TableCell>
                            <TableCell>{registro.ug}</TableCell>
                            <TableCell>{registro.categoria}</TableCell>
                            <TableCell className="text-center">{registro.dias_operacao}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(registro.valor_nd_30)}
                            </TableCell>
                            <TableCell className="text-right text-blue-600 font-medium">
                              {formatCurrency(registro.valor_nd_39)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(registro.valor_total)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditarRegistro(registro)}
                                  disabled={loading}
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemover(registro.id)}
                                  disabled={loading}
                                  className="h-8 w-8 text-destructive hover:text-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter className="bg-muted/50 border-t-2">
                        <TableRow>
                          <TableCell colSpan={4} className="text-right font-bold">TOTAL GERAL:</TableCell>
                          <TableCell className="text-right font-extrabold text-green-600 text-base">
                            {formatCurrency(totalGeralND30)}
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-blue-600 text-base">
                            {formatCurrency(totalGeralND39)}
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-primary text-base">
                            {formatCurrency(totalGeral)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </div>

                {/* Detalhamento das Memórias de Cálculo */}
                <div className="space-y-4 mt-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    📋 Memórias de Cálculo Detalhadas
                  </h3>
                  
                  {registros.map((registro) => {
                    const isEditing = editingMemoriaId === registro.id;
                    const hasCustomMemoria = !!registro.detalhamento_customizado;
                    const memoriaAutomatica = generateClasseIIMemoriaCalculo(registro);
                    const memoriaExibida = registro.detalhamento_customizado || memoriaAutomatica;
                    
                    return (
                      <Card key={`memoria-${registro.id}`} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                              {registro.organizacao} (UG: {registro.ug})
                            </h4>
                            <span className="text-lg font-semibold text-muted-foreground/80">
                              | {registro.categoria}
                            </span>
                            {hasCustomMemoria && !isEditing && (
                              <Badge variant="outline" className="text-xs">
                                Editada manualmente
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant="default" 
                            className="bg-primary text-primary-foreground"
                          >
                            Classe II
                          </Badge>
                        </div>
                        
                        <div className="h-px bg-border my-4" />
                        
                        <div className="flex items-center justify-end gap-2 mb-4">
                          {!isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleIniciarEdicaoMemoria(registro)}
                                disabled={loading}
                                className="gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Editar Memória
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
                                  Restaurar Automática
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                        
                        <Card className="p-4 bg-background rounded-lg border">
                          {isEditing ? (
                            <Textarea
                              value={memoriaEdit}
                              onChange={(e) => setMemoriaEdit(e.target.value)}
                              className="min-h-[300px] font-mono text-sm"
                              placeholder="Digite a memória de cálculo..."
                            />
                          ) : (
                            <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                              {memoriaExibida}
                            </pre>
                          )}
                        </Card>
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