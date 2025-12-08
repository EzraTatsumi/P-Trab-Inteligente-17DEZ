import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronsUpDown, Sparkles, AlertCircle, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { defaultClasseVIIISaudeConfig, ItemSaude } from "@/data/classeVIIIData";

type Categoria = 'Saúde - KPSI/KPT';

const CATEGORIA_PADRAO: Categoria = 'Saúde - KPSI/KPT';

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemRegistroSaude extends ItemSaude {
  quantidade: number;
}

interface FormDataClasseVIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global
  itens: ItemRegistroSaude[]; // All items across all categories
  fase_atividade?: string; // Global
}

interface ClasseVIIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  dias_operacao: number;
  categoria: Categoria;
  itens_saude: ItemRegistroSaude[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

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

// NOVO: Gera a memória de cálculo detalhada para a Classe VIII Saúde
const generateSaudeMemoriaCalculo = (itens: ItemRegistroSaude[], diasOperacao: number, organizacao: string, ug: string, faseAtividade: string, valorTotal: number): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);

    let detalhamentoItens = "";
    let calculoDetalhado = "";
    
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_unitario;
        detalhamentoItens += `- ${item.item}: ${formatCurrency(item.valor_unitario)}\n`;
        calculoDetalhado += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(valorItem)}\n`;
    });

    return `33.90.30 - Aquisição de KPSI/KPSC e KPT para utilização por ${totalItens} itens do ${organizacao}, durante ${diasOperacao} dias de ${faseFormatada}.
OM de Destino: ${organizacao} (UG: ${ug})

Cálculo:
Fórmula Base: Nr KPSC/KPT x valor do item

Valores Unitários:
${detalhamentoItens.trim()}

Cálculo Detalhado:
${calculoDetalhado.trim()}

Total: ${formatCurrency(valorTotal)}.`;
};


const ClasseVIIISaudeForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseVIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  // Estados para alocação manual de recursos
  const [alocacaoND30, setAlocacaoND30] = useState<number>(0);
  const [alocacaoND39, setAlocacaoND39] = useState<number>(0);
  
  const [form, setForm] = useState<FormDataClasseVIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // Itens de saúde disponíveis (diretrizes)
  const diretrizesSaude: ItemSaude[] = defaultClasseVIIISaudeConfig;
  
  // Estado para a lista de itens da categoria atual com quantidades editáveis
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemRegistroSaude[]>([]);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);
  
  // Efeito para gerenciar a lista de itens da categoria atual
  useEffect(() => {
    if (diretrizesSaude.length > 0) {
        const availableItems = diretrizesSaude.map(d => ({
            ...d,
            quantidade: 0, // Quantidade padrão
        }));

        // Mapear itens existentes no formulário principal
        const existingItemsMap = new Map<string, ItemRegistroSaude>();
        form.itens.forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        // Mesclar: usar o item existente (com quantidade) ou o item disponível (com quantidade 0)
        const mergedItems = availableItems.map(availableItem => {
            const existing = existingItemsMap.get(availableItem.item);
            return existing || availableItem;
        });

        setCurrentCategoryItems(mergedItems);
    } else {
        setCurrentCategoryItems([]);
    }
  }, [diretrizesSaude, form.itens]);

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    // Busca registros da tabela classe_viii_saude_registros
    const { data, error } = await supabase
      .from("classe_viii_saude_registros")
      .select("*, itens_saude, detalhamento_customizado, valor_nd_30, valor_nd_39")
      .eq("p_trab_id", ptrabId)
      .order("organizacao", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar registros de Saúde");
      console.error(error);
      return;
    }

    setRegistros((data || []).map(r => ({
        ...r,
        itens_saude: (r.itens_saude || []) as ItemRegistroSaude[],
        valor_nd_30: Number(r.valor_nd_30),
        valor_nd_39: Number(r.valor_nd_39),
    }) as ClasseVIIIRegistro[]));
  };

  const resetFormFields = () => {
    setEditingId(null);
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    
    setCurrentCategoryItems(diretrizesSaude.map(d => ({ ...d, quantidade: 0 })));
    
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
    
    setAlocacaoND30(0);
    setAlocacaoND39(0);
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ 
        ...form, 
        selectedOmId: omData.id, 
        organizacao: omData.nome_om, 
        ug: omData.codug_om,
      });
    } else {
      setForm({ 
        ...form, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      });
    }
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  // Handler: Atualiza a quantidade de um item na lista expandida
  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    newItems[itemIndex].quantidade = Math.max(0, quantity);
    setCurrentCategoryItems(newItems);
  };

  // NOVO HANDLER: Salva os itens da lista expandida para o form.itens principal
  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Operação antes de salvar itens.");
        return;
    }
    
    // Itens válidos da categoria atual (quantidade > 0)
    const itemsToKeep = currentCategoryItems.filter(item => item.quantidade > 0);

    // Como só temos uma categoria (Saúde), o form.itens é substituído
    setForm({ ...form, itens: itemsToKeep });
    
    // Recalcular o valor total e preencher a alocação ND 30/39
    const total = itemsToKeep.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
    setAlocacaoND30(total);
    setAlocacaoND39(0);
    
    toast.success(`Itens de Saúde atualizados!`);
  };
  
  // Lógica de cálculo de alocação (Global Totals)
  const valorTotalForm = form.itens.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
  
  const totalND30Final = alocacaoND30;
  const totalND39Final = alocacaoND39;
  
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalND30Final + totalND39Final);

  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (form.itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    if (!isTotalAlocadoCorrect) { toast.error("A soma da alocação ND 30 e ND 39 deve ser igual ao Valor Total."); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    setLoading(true);
    
    const itens = form.itens;
    
    const detalhamento = generateSaudeMemoriaCalculo(
        itens, 
        form.dias_operacao, 
        form.organizacao, 
        form.ug, 
        faseFinalString,
        valorTotalForm
    );
    
    const registro: TablesInsert<'classe_viii_saude_registros'> = {
        p_trab_id: ptrabId,
        organizacao: form.organizacao,
        ug: form.ug,
        dias_operacao: form.dias_operacao,
        categoria: CATEGORIA_PADRAO,
        itens_saude: itens as any,
        valor_total: valorTotalForm,
        detalhamento: detalhamento,
        fase_atividade: faseFinalString,
        detalhamento_customizado: null,
        valor_nd_30: totalND30Final,
        valor_nd_39: totalND39Final,
    };

    try {
      // Deletar registros existentes (apenas um registro por OM é esperado para esta classe)
      const { error: deleteError } = await supabase
        .from("classe_viii_saude_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.organizacao)
        .eq("ug", form.ug);
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      // Inserir o novo registro
      const { error: insertError } = await supabase.from("classe_viii_saude_registros").insert([registro]);
      if (insertError) throw insertError;
      
      toast.success(editingId ? "Registro de Saúde atualizado com sucesso!" : "Registro de Saúde salvo com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registros de Saúde:", error);
      toast.error("Erro ao salvar registros de Saúde");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    // 1. Preencher o formulário principal
    setEditingId(registro.id); 
    setForm({
      selectedOmId: undefined, // Será preenchido abaixo
      organizacao: registro.organizacao,
      ug: registro.ug,
      dias_operacao: registro.dias_operacao,
      itens: registro.itens_saude,
    });
    
    // 2. Preencher alocação ND
    setAlocacaoND30(registro.valor_nd_30);
    setAlocacaoND39(registro.valor_nd_39);
    
    // 3. Buscar ID da OM Detentora
    try {
        const { data: omData } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', registro.organizacao)
            .eq('codug_om', registro.ug)
            .maybeSingle();
        setForm(prev => ({ ...prev, selectedOmId: omData?.id }));
    } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    
    // 4. Preencher fases
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    // 5. Recarregar a lista de itens editáveis com as quantidades salvas
    const existingItemsMap = new Map<string, ItemRegistroSaude>();
    registro.itens_saude.forEach(item => {
        existingItemsMap.set(item.item, item);
    });
    
    const mergedItems = diretrizesSaude.map(availableItem => {
        const existing = existingItemsMap.get(availableItem.item);
        return existing || { ...availableItem, quantidade: 0 };
    });
    setCurrentCategoryItems(mergedItems);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        const key = `${registro.organizacao} (${registro.ug})`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseVIIIRegistro[]>);
  }, [registros]);

  const handleIniciarEdicaoMemoria = (registro: ClasseVIIIRegistro) => {
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
        .from("classe_viii_saude_registros")
        .update({
          detalhamento_customizado: memoriaEdit.trim() || null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error(sanitizeError(error));
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
        .from("classe_viii_saude_registros")
        .update({
          detalhamento_customizado: null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const displayFases = useMemo(() => {
    return [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');
  }, [fasesAtividade, customFaseAtividade]);


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
              {/* HeartPulse removido */}
              Classe VIII - Saúde (KPSI/KPT)
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para Kits de Primeiros Socorros (KPSI/KPT).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OM Detentora do Equipamento *</Label>
                  <OmSelector
                    selectedOmId={form.selectedOmId}
                    onChange={handleOMChange}
                    placeholder="Selecione a OM..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>UG Detentora</Label>
                  <Input value={form.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
                </div>
                
                <div className="space-y-2">
                  <Label>Dias de Atividade *</Label>
                  <Input
                    type="text" // Alterado para text para usar formatNumberForInput
                    className="max-w-xs"
                    value={formatNumberForInput(form.dias_operacao)}
                    onChange={(e) => setForm({ ...form, dias_operacao: parseInputToNumber(e.target.value) })}
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
                            placeholder="Ex: Concentração"
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* 2. Adicionar Itens de Saúde */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">2. Configurar Kits de Saúde</h3>
                
                <div className="max-h-[400px] overflow-y-auto rounded-md border">
                    <Table className="w-full">
                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                            <TableRow>
                                <TableHead className="w-[50%]">Item (MEM)</TableHead>
                                <TableHead className="w-[20%] text-right">Valor Unitário</TableHead>
                                <TableHead className="w-[15%] text-center">Quantidade</TableHead>
                                <TableHead className="w-[15%] text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentCategoryItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        Nenhum item de diretriz encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentCategoryItems.map((item, index) => {
                                    const itemTotal = item.quantidade * item.valor_unitario;
                                    
                                    return (
                                        <TableRow key={item.item} className="h-12">
                                            <TableCell className="font-medium text-sm py-1">
                                                {item.item}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                {formatCurrency(item.valor_unitario)}
                                            </TableCell>
                                            <TableCell className="py-1">
                                                <Input
                                                    type="text"
                                                    className="h-8 text-center"
                                                    value={formatNumberForInput(item.quantidade)}
                                                    onChange={(e) => handleQuantityChange(index, parseInputToNumber(e.target.value))}
                                                    placeholder="0"
                                                    onKeyDown={handleEnterToNextField}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-sm py-1">
                                                {formatCurrency(itemTotal)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                    <span className="font-bold text-sm">VALOR TOTAL DA CATEGORIA</span>
                    <span className="font-extrabold text-lg text-red-600">
                        {formatCurrency(valorTotalForm)}
                    </span>
                </div>
                
                <div className="flex justify-end">
                    <Button 
                        type="button" 
                        onClick={handleUpdateCategoryItems} 
                        className="w-full md:w-auto" 
                        disabled={!form.organizacao || form.dias_operacao <= 0}
                    >
                        Salvar Itens de Saúde
                    </Button>
                </div>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {form.itens.length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itens.length})</h3>
                
                <div className="space-y-4">
                  <Card className="p-4 bg-secondary/10 border-secondary">
                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                      <h4 className="font-bold text-base text-primary">Kits de Saúde ({form.itens.reduce((sum, i) => sum + i.quantidade, 0)} itens)</h4>
                      <span className="font-extrabold text-lg text-red-600">{formatCurrency(valorTotalForm)}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {form.itens.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                          <span className="font-medium">{item.item}</span>
                          <span className="text-right">
                            {item.quantidade} un. x {formatCurrency(item.valor_unitario)} = {formatCurrency(item.quantidade * item.valor_unitario)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
                
                {/* 3.1. Alocação de Recursos ND 30/39 */}
                <div className="space-y-4 pt-4">
                    <h4 className="text-base font-semibold">Alocação de Recursos (ND)</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nd30">ND 33.90.30 (Material)</Label>
                            <Input
                                id="nd30"
                                type="text"
                                value={formatInputWithThousands(alocacaoND30)}
                                onChange={(e) => setAlocacaoND30(parseInputToNumber(e.target.value))}
                                placeholder="0,00"
                                className={cn({
                                    "border-destructive": !isTotalAlocadoCorrect && alocacaoND30 > 0,
                                })}
                                onKeyDown={handleEnterToNextField}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nd39">ND 33.90.39 (Serviço)</Label>
                            <Input
                                id="nd39"
                                type="text"
                                value={formatInputWithThousands(alocacaoND39)}
                                onChange={(e) => setAlocacaoND39(parseInputToNumber(e.target.value))}
                                placeholder="0,00"
                                className={cn({
                                    "border-destructive": !isTotalAlocadoCorrect && alocacaoND39 > 0,
                                })}
                                onKeyDown={handleEnterToNextField}
                            />
                        </div>
                    </div>
                    
                    {!isTotalAlocadoCorrect && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                A soma da alocação (ND 30 + ND 39 = {formatCurrency(totalND30Final + totalND39Final)}) deve ser igual ao Valor Total ({formatCurrency(valorTotalForm)}). Diferença: {formatCurrency(valorTotalForm - (totalND30Final + totalND39Final))}.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <span className="font-bold text-base text-primary">VALOR TOTAL DA OM</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(valorTotalForm)}
                  </span>
                </div>
                
                <div className="flex gap-3 pt-4 justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={resetFormFields}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Formulário
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSalvarRegistros} 
                    disabled={loading || !form.organizacao || form.itens.length === 0 || !isTotalAlocadoCorrect}
                  >
                    {loading ? "Aguarde..." : (editingId ? "Atualizar Registro" : "Salvar Registro")}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  OMs Cadastradas
                </h2>
                
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                    const totalOM = omRegistros.reduce((sum, r) => sum + r.valor_total, 0);
                    const omName = omKey.split(' (')[0];
                    const ug = omKey.split(' (')[1].replace(')', '');
                    
                    return (
                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h3 className="font-bold text-lg text-primary">
                                    {omName} (UG: {ug})
                                </h3>
                                <span className="font-extrabold text-xl text-primary">
                                    {formatCurrency(totalOM)}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {omRegistros.map((registro) => {
                                    const totalCategoria = registro.valor_total;
                                    const fases = formatFasesParaTexto(registro.fase_atividade);
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {registro.categoria}
                                                        </h4>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Dias: {registro.dias_operacao} | Fases: {fases}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-lg text-red-600">
                                                        {formatCurrency(totalCategoria)}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleEditarRegistro(registro)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                if (confirm(`Deseja realmente deletar o registro de Saúde para ${omName}?`)) {
                                                                    supabase.from("classe_viii_saude_registros")
                                                                        .delete()
                                                                        .eq("id", registro.id)
                                                                        .then(() => {
                                                                            toast.success("Registro excluído!");
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
                                            </div>
                                            
                                            {/* Detalhes da Alocação */}
                                            <div className="pt-2 border-t mt-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                                    <span className="font-medium text-green-600">{formatCurrency(registro.valor_nd_30)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                                    <span className="font-medium text-blue-600">{formatCurrency(registro.valor_nd_39)}</span>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </Card>
                    );
                })}
              </div>
            )}

            {/* 5. Memórias de Cálculos Detalhadas */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                
                {registros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  
                  const memoriaAutomatica = generateSaudeMemoriaCalculo(
                      registro.itens_saude, 
                      registro.dias_operacao, 
                      registro.organizacao, 
                      registro.ug, 
                      registro.fase_atividade || '', 
                      registro.valor_total
                  );
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-foreground">
                                OM Destino: {om} ({ug}) - {registro.categoria}
                              </h4>
                          </div>
                          
                          <div className="flex items-center justify-end gap-2 shrink-0">
                              
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
                    </div>
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

export default ClasseVIIISaudeForm;