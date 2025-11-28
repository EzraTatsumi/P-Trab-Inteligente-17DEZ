import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Package, Pencil, Trash2, XCircle, Check, ChevronDown, ClipboardList, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { DiretrizClasseII } from "@/types/diretrizesClasseII";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";

type Categoria = 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';

const CATEGORIAS: Categoria[] = [
  "Equipamento Individual",
  "Proteção Balística",
  "Material de Estacionamento",
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
}

interface FormDataClasseII {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemClasseII[];
  fase_atividade?: string;
}

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
  fase_atividade?: string;
}

export default function ClasseIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseII[]>([]);
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  
  // Formulário principal (compartilhado)
  const [form, setForm] = useState<FormDataClasseII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  
  // Item temporário para adição/edição
  const [itemTemp, setItemTemp] = useState<ItemClasseII>({
    item: "",
    quantidade: 0,
    valor_mnt_dia: 0,
  });
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  
  // Estados para Fase da Atividade
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");

  const { handleEnterToNextField } = useFormNavigation();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadDiretrizes();
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);

  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Buscar o ano de referência mais recente
      const { data: diretrizCusteio } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!diretrizCusteio) {
        toast.warning("Diretriz de Custeio não encontrada. Usando valores padrão.");
        return;
      }

      // 2. Buscar itens de Classe II para o ano
      const { data: classeIIData, error } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizCusteio.ano_referencia)
        .eq("ativo", true);

      if (error) throw error;

      setDiretrizes((classeIIData || []) as DiretrizClasseII[]);
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_ii_registros")
      .select("*, itens_equipamentos, detalhamento_customizado")
      .eq("p_trab_id", ptrabId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    setRegistros((data || []) as ClasseIIRegistro[]);
  };

  // Função para formatar as fases de forma natural no texto
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

  const generateDetalhamento = (itens: ItemClasseII[], diasOperacao: number, organizacao: string, categoria: Categoria, faseAtividade: string): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);

    const detalhamentoItens = itens.map(item => {
      const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
      return `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.`;
    }).join('\n');

    return `33.90.30 - Aquisição de Material de Intendência (${categoria}) para ${totalItens} itens, durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.

Cálculo:
Fórmula: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;
  };

  const resetFormFields = () => {
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    setItemTemp({
      item: "",
      quantidade: 0,
      valor_mnt_dia: 0,
    });
    setEditingItemIndex(null);
    setEditingMemoriaId(null);
    setMemoriaEdit("");
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ ...form, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
    } else {
      setForm({ ...form, selectedOmId: undefined, organizacao: "", ug: "" });
    }
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade([...fasesAtividade, fase]);
    } else {
      setFasesAtividade(fasesAtividade.filter(f => f !== fase));
    }
  };

  const handleItemSelect = (itemName: string) => {
    const diretriz = diretrizes.find(d => d.item === itemName && d.categoria === selectedTab);
    if (diretriz) {
      setItemTemp(prev => ({
        ...prev,
        item: itemName,
        valor_mnt_dia: Number(diretriz.valor_mnt_dia),
      }));
    }
  };

  const adicionarOuAtualizarItem = () => {
    if (!itemTemp.item || itemTemp.quantidade <= 0 || itemTemp.valor_mnt_dia <= 0) {
      toast.error("Preencha todos os campos do item (Item, Quantidade, Valor)");
      return;
    }

    const novoItem: ItemClasseII = { ...itemTemp };
    let novosItens = [...form.itens];
    
    // Verifica se o item já existe no formulário (exceto se estiver editando)
    const existingIndex = novosItens.findIndex(i => i.item === novoItem.item);
    
    if (editingItemIndex !== null) {
      novosItens[editingItemIndex] = novoItem;
      toast.success("Item atualizado!");
    } else if (existingIndex !== -1) {
      toast.error("Este item já foi adicionado. Edite o item existente ou remova-o primeiro.");
      return;
    } else {
      novosItens.push(novoItem);
      toast.success("Item adicionado!");
    }
    
    setForm({ ...form, itens: novosItens });
    setItemTemp({ item: "", quantidade: 0, valor_mnt_dia: 0 });
    setEditingItemIndex(null);
  };

  const handleEditItem = (item: ItemClasseII, index: number) => {
    setItemTemp(item);
    setEditingItemIndex(index);
    if (formRef.current) { formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  const handleCancelEditItem = () => {
    setItemTemp({ item: "", quantidade: 0, valor_mnt_dia: 0 });
    setEditingItemIndex(null);
  };

  const removerItem = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = form.itens.filter((_, i) => i !== index);
    setForm({ ...form, itens: novosItens });
    if (editingItemIndex === index) { handleCancelEditItem(); }
    toast.success("Item removido!");
  };

  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (form.itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }

    setLoading(true);
    
    // Agrupar itens por categoria (aba)
    const itensPorCategoria = form.itens.reduce((acc, item) => {
      const categoria = diretrizes.find(d => d.item === item.item)?.categoria || selectedTab;
      if (!acc[categoria]) { acc[categoria] = []; }
      acc[categoria].push(item);
      return acc;
    }, {} as Record<Categoria, ItemClasseII[]>);

    const registrosParaSalvar: TablesInsert<'classe_ii_registros'>[] = [];
    
    for (const categoria in itensPorCategoria) {
      const itens = itensPorCategoria[categoria as Categoria];
      if (itens.length > 0) {
        const valorTotal = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
        const detalhamento = generateDetalhamento(itens, form.dias_operacao, form.organizacao, categoria as Categoria, faseFinalString);
        
        const registro: TablesInsert<'classe_ii_registros'> = {
          p_trab_id: ptrabId,
          organizacao: form.organizacao,
          ug: form.ug,
          dias_operacao: form.dias_operacao,
          categoria: categoria,
          itens_equipamentos: JSON.parse(JSON.stringify(itens)),
          valor_total: valorTotal,
          detalhamento: detalhamento,
          fase_atividade: faseFinalString,
        };
        registrosParaSalvar.push(registro);
      }
    }
    
    try {
      // 1. Deletar registros existentes para esta OM/UG
      const { error: deleteError } = await supabase
        .from("classe_ii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.organizacao)
        .eq("ug", form.ug);
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      // 2. Inserir novos registros
      const { error: insertError } = await supabase.from("classe_ii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registros de Classe II salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registros de Classe II:", error);
      toast.error("Erro ao salvar registros de Classe II");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseIIRegistro) => {
    resetFormFields();
    setEditingId(registro.id);
    
    // 1. Preencher dados da OM
    let selectedOmIdForEdit: string | undefined = undefined;
    try {
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', registro.organizacao)
        .eq('codug_om', registro.ug)
        .single();
      if (omData && !omError) {
        selectedOmIdForEdit = omData.id;
      }
    } catch (error) {
      console.error("Erro ao buscar OM para edição:", error);
    }
    
    // 2. Preencher o formulário principal
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: registro.organizacao,
      ug: registro.ug,
      dias_operacao: registro.dias_operacao,
      itens: registro.itens_equipamentos,
    });
    
    // 3. Preencher as fases
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    // 4. Rolar para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Funções de gerenciamento de memória customizada
  const handleIniciarEdicaoMemoria = (registro: ClasseIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || registro.detalhamento || "");
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
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      setEditingMemoriaId(null);
      setMemoriaEdit("");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error("Erro ao salvar memória de cálculo");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_ii_registros")
        .update({
          detalhamento_customizado: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

  // Filtra as diretrizes disponíveis para a aba selecionada
  const itensDisponiveis = useMemo(() => {
    return diretrizes.filter(d => d.categoria === selectedTab);
  }, [diretrizes, selectedTab]);
  
  // Calcula o valor total do item temporário
  const valorItemTemp = itemTemp.quantidade * itemTemp.valor_mnt_dia * form.dias_operacao;
  
  // Calcula o valor total do formulário
  const valorTotalForm = form.itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
  
  // Agrupa os registros salvos por OM/UG para exibição na tabela
  const registrosAgrupados = useMemo(() => {
    const map = new Map<string, ClasseIIRegistro[]>();
    registros.forEach(r => {
      const key = `${r.organizacao}-${r.ug}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(r);
    });
    return Array.from(map.values());
  }, [registros]);

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
              <Package className="h-6 w-6 text-primary" />
              Classe II - Material de Intendência
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para manutenção de material de intendência.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Organização Militar (OM) *</Label>
                  <OmSelector
                    selectedOmId={form.selectedOmId}
                    onChange={handleOMChange}
                    placeholder="Selecione a OM..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>UG</Label>
                  <Input value={form.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
                </div>
                
                <div className="space-y-2">
                  <Label>Dias de Atividade *</Label>
                  <Input
                    type="number"
                    min="1"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={form.dias_operacao || ""}
                    onChange={(e) => setForm({ ...form, dias_operacao: parseInt(e.target.value) || 0 })}
                    placeholder="Ex: 7"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fase da Atividade *</Label>
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        type="button"
                        className="w-full justify-between"
                      >
                        {fasesAtividade.length === 0 && !customFaseAtividade.trim()
                          ? "Selecione as fases..."
                          : [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ')}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                              <span>{fase}</span>
                              <Checkbox
                                checked={fasesAtividade.includes(fase)}
                                onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                              />
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
            </div>

            {/* 2. Adicionar Itens por Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4" ref={formRef}>
                <h3 className="text-lg font-semibold">2. Adicionar Itens</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-3">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div className="space-y-2 col-span-2">
                            <Label>Item *</Label>
                            <Select 
                              value={itemTemp.item}
                              onValueChange={handleItemSelect}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o item..." />
                              </SelectTrigger>
                              <SelectContent>
                                {itensDisponiveis.map(d => (
                                  <SelectItem key={d.item} value={d.item}>
                                    {d.item} ({formatCurrency(Number(d.valor_mnt_dia))}/dia)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Quantidade *</Label>
                            <Input
                              type="number"
                              min="1"
                              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={itemTemp.quantidade === 0 ? "" : itemTemp.quantidade.toString()}
                              onChange={(e) => setItemTemp({ ...itemTemp, quantidade: parseInt(e.target.value) || 0 })}
                              placeholder="Ex: 10"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              onClick={adicionarOuAtualizarItem} 
                              className="w-full" 
                              disabled={!itemTemp.item || itemTemp.quantidade <= 0}
                            >
                              {editingItemIndex !== null ? "Atualizar Item" : "Adicionar Item"}
                            </Button>
                          </div>
                        </div>
                        
                        {itemTemp.item && (
                          <div className="flex justify-between items-center text-sm p-2 bg-background rounded-md border">
                            <span className="text-muted-foreground">Valor Mnt/Dia: {formatCurrency(itemTemp.valor_mnt_dia)}</span>
                            <span className="font-bold">Valor Calculado: {formatCurrency(valorItemTemp)}</span>
                          </div>
                        )}
                        
                        {editingItemIndex !== null && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelEditItem}
                            className="mt-2"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar Edição do Item
                          </Button>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {form.itens.length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itens.length})</h3>
                
                <div className="space-y-2">
                  {form.itens.map((item, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.item}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantidade} unidade(s) • {formatCurrency(item.valor_mnt_dia)}/dia • Total: {formatCurrency(item.quantidade * item.valor_mnt_dia * form.dias_operacao)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditItem(item, index)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerItem(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="font-bold text-base text-primary">VALOR TOTAL DA OM</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(valorTotalForm)}
                  </span>
                </div>
                
                <div className="flex gap-3 pt-4 justify-end">
                  {editingId && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={resetFormFields}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar Edição
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    onClick={handleSalvarRegistros} 
                    disabled={loading || !form.organizacao || form.itens.length === 0}
                  >
                    {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos */}
            {registrosAgrupados.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Registros Salvos por OM
                </h2>
                
                {registrosAgrupados.map((registrosOM, index) => {
                  const om = registrosOM[0].organizacao;
                  const ug = registrosOM[0].ug;
                  const totalOM = registrosOM.reduce((sum, r) => sum + r.valor_total, 0);
                  const fases = formatFasesParaTexto(registrosOM[0].fase_atividade);
                  
                  return (
                    <Card key={index} className="p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-foreground">{om} (UG: {ug})</h4>
                          <Badge variant="secondary" className="text-xs">{registrosOM.length} categorias</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditarRegistro(registrosOM[0])}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Deseja realmente deletar todos os registros de Classe II para ${om}?`)) {
                                // Deletar todos os registros desta OM/UG
                                supabase.from("classe_ii_registros")
                                  .delete()
                                  .eq("p_trab_id", ptrabId!)
                                  .eq("organizacao", om)
                                  .eq("ug", ug)
                                  .then(() => {
                                    toast.success("Registros excluídos!");
                                    fetchRegistros();
                                  })
                                  .catch(err => {
                                    toast.error(sanitizeError(err));
                                  });
                              }
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Dias: {registrosOM[0].dias_operacao} | Fases: {fases}</p>
                        
                        {/* Detalhes por Categoria */}
                        <div className="space-y-1 pt-2">
                          {registrosOM.map(r => (
                            <div key={r.id} className="flex justify-between text-sm border-b border-dashed pb-1">
                              <span className="font-medium text-primary">{r.categoria}</span>
                              <span className="font-semibold">{formatCurrency(r.valor_total)}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex justify-between items-center pt-2">
                          <span className="font-bold text-base">TOTAL OM</span>
                          <span className="font-extrabold text-xl text-primary">{formatCurrency(totalOM)}</span>
                        </div>
                        
                        {/* Memórias de Cálculo */}
                        <div className="space-y-4 pt-4">
                          <h5 className="font-semibold text-sm">Memórias de Cálculo por Categoria:</h5>
                          {registrosOM.map(registro => {
                            const isEditing = editingMemoriaId === registro.id;
                            const hasCustomMemoria = !!registro.detalhamento_customizado;
                            const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || registro.detalhamento || "");
                            
                            return (
                              <Card key={`memoria-${registro.id}`} className="p-4 bg-background">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-bold text-sm text-primary">{registro.categoria}</h6>
                                  <div className="flex items-center gap-2">
                                    {!isEditing ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleIniciarEdicaoMemoria(registro)}
                                          disabled={loading}
                                          className="gap-2 h-8"
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
                                            className="gap-2 text-muted-foreground h-8"
                                          >
                                            <XCircle className="h-4 w-4" />
                                            Restaurar
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
                                          className="gap-2 h-8"
                                        >
                                          <Check className="h-4 w-4" />
                                          Salvar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={handleCancelarEdicaoMemoria}
                                          disabled={loading}
                                          className="gap-2 h-8"
                                        >
                                          <XCircle className="h-4 w-4" />
                                          Cancelar
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Textarea
                                  value={memoriaExibida}
                                  onChange={(e) => isEditing && setMemoriaEdit(e.target.value)}
                                  readOnly={!isEditing}
                                  rows={8}
                                  className="font-mono text-xs whitespace-pre-wrap text-foreground"
                                />
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}