import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, XCircle, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
import { TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { TablesInsert } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Checkbox } from "@/components/ui/checkbox";

type CombustivelTipo = 'GASOLINA' | 'DIESEL';

interface ItemViatura {
  tipo_equipamento_especifico: string;
  quantidade: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  consumo_fixo: number;
  tipo_combustivel: CombustivelTipo;
}

interface FormDataViatura {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemViatura[];
}

interface ConsolidadoViatura {
  tipo_combustivel: CombustivelTipo;
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemViatura[];
  detalhamento: string;
}

interface ClasseIIIViaturaFormProps {
  ptrabId: string;
  refLPC: RefLPC;
  equipamentosDisponiveis: TipoEquipamentoDetalhado[];
  onSaveSuccess: () => void;
  editingRegistroId: string | null;
  setEditingRegistroId: (id: string | null) => void;
  initialData?: {
    form: FormDataViatura;
    rmFornecimento: string;
    codugRmFornecimento: string;
    fasesAtividade: string[];
    customFaseAtividade: string;
  };
}

const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

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

export const ClasseIIIViaturaForm = ({
  ptrabId,
  refLPC,
  equipamentosDisponiveis,
  onSaveSuccess,
  editingRegistroId,
  setEditingRegistroId,
  initialData,
}: ClasseIIIViaturaFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formViatura, setFormViatura] = useState<FormDataViatura>(initialData?.form || {
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  const [rmFornecimentoViatura, setRmFornecimentoViatura] = useState(initialData?.rmFornecimento || "");
  const [codugRmFornecimentoViatura, setCodugRmFornecimentoViatura] = useState(initialData?.codugRmFornecimento || "");

  const [itemViaturaTemp, setItemViaturaTemp] = useState<ItemViatura>({
    tipo_equipamento_especifico: "",
    quantidade: 0,
    distancia_percorrida: 0,
    quantidade_deslocamentos: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL",
  });
  const [editingViaturaItemIndex, setEditingViaturaItemIndex] = useState<number | null>(null);
  const [isPopoverOpenViatura, setIsPopoverOpenViatura] = useState(false);
  const [fasesAtividadeViatura, setFasesAtividadeViatura] = useState<string[]>(initialData?.fasesAtividade || ["Execução"]);
  const [customFaseAtividadeViatura, setCustomFaseAtividadeViatura] = useState<string>(initialData?.customFaseAtividade || "");

  const addViaturaRef = useRef<HTMLDivElement>(null);
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (initialData) {
        setFormViatura(initialData.form);
        setRmFornecimentoViatura(initialData.rmFornecimento);
        setCodugRmFornecimentoViatura(initialData.codugRmFornecimento);
        setFasesAtividadeViatura(initialData.fasesAtividade);
        setCustomFaseAtividadeViatura(initialData.customFaseAtividade);
    }
  }, [initialData]);

  const handleOMViaturaChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormViatura({ ...formViatura, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimentoViatura(omData.rm_vinculacao);
      setCodugRmFornecimentoViatura(omData.codug_rm_vinculacao);
    } else {
      setFormViatura({ ...formViatura, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimentoViatura("");
      setCodugRmFornecimentoViatura("");
    }
  };

  const handleRMFornecimentoViaturaChange = (rmName: string, rmCodug: string) => {
    setRmFornecimentoViatura(rmName);
    setCodugRmFornecimentoViatura(rmCodug);
  };

  const handleTipoViaturaChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemViaturaTemp({ 
        ...itemViaturaTemp, 
        tipo_equipamento_especifico: tipoNome, 
        tipo_combustivel: novoCombustivel as CombustivelTipo, 
        consumo_fixo: equipamento.consumo 
      });
    }
  };

  const adicionarOuAtualizarItemViatura = () => {
    if (!itemViaturaTemp.tipo_equipamento_especifico || itemViaturaTemp.quantidade <= 0 || itemViaturaTemp.distancia_percorrida <= 0 || itemViaturaTemp.quantidade_deslocamentos <= 0) {
      toast.error("Preencha todos os campos do item");
      return;
    }
    const novoItem: ItemViatura = { ...itemViaturaTemp };
    let novosItens = [...formViatura.itens];
    if (editingViaturaItemIndex !== null) {
      novosItens[editingViaturaItemIndex] = novoItem;
      toast.success("Item de viatura atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de viatura adicionado!");
    }
    setFormViatura({ ...formViatura, itens: novosItens });
    setItemViaturaTemp({ tipo_equipamento_especifico: "", quantidade: 0, distancia_percorrida: 0, quantidade_deslocamentos: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingViaturaItemIndex(null);
  };

  const handleEditViaturaItem = (item: ItemViatura, index: number) => {
    setItemViaturaTemp(item);
    setEditingViaturaItemIndex(index);
    if (addViaturaRef.current) { addViaturaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  const handleCancelEditViaturaItem = () => {
    setItemViaturaTemp({ tipo_equipamento_especifico: "", quantidade: 0, distancia_percorrida: 0, quantidade_deslocamentos: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingViaturaItemIndex(null);
  };

  const removerItemViatura = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formViatura.itens.filter((_, i) => i !== index);
    setFormViatura({ ...formViatura, itens: novosItens });
    if (editingViaturaItemIndex === index) { handleCancelEditViaturaItem(); }
    toast.success("Item de viatura removido!");
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeViatura(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividadeViatura(prev => prev.filter(f => f !== fase));
    }
  };

  const { consolidadosViatura } = useMemo(() => {
    const itens = formViatura.itens;
    if (!refLPC || itens.length === 0) { return { consolidadosViatura: [] }; }
    
    const grupos = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<CombustivelTipo, ItemViatura[]>);
    
    const consolidados: ConsolidadoViatura[] = [];
    
    Object.entries(grupos).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as CombustivelTipo;
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];
      
      itensGrupo.forEach(item => {
        const litrosItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos) / item.consumo_fixo;
        totalLitrosSemMargem += litrosItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- ${item.quantidade} ${item.tipo_equipamento_especifico}: (${formatNumber(item.distancia_percorrida)} km x ${item.quantidade} vtr x ${item.quantidade_deslocamentos} desloc) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L = ${formatNumber(litrosItem)} L ${unidade}.`);
      });
      
      const totalLitros = totalLitrosSemMargem * 1.3;
      const preco = tipoCombustivel === 'GASOLINA' ? (refLPC.preco_gasolina ?? 0) : (refLPC.preco_diesel ?? 0);
      const valorTotal = totalLitros * preco;
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel'; // DEFINIÇÃO AQUI
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC.ambito === 'Nacional' ? '' : refLPC.nome_local ? `(${refLPC.nome_local})` : '';
      const totalViaturas = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      
      let fasesFinaisCalc = [...fasesAtividadeViatura];
      if (customFaseAtividadeViatura.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeViatura.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      const detalhamento = `33.90.39 - Aquisição de Combustível (${combustivelLabel}) para ${totalViaturas} viaturas, durante ${formViatura.dias_operacao} dias de ${faseFormatada}, para ${formViatura.organizacao}.
Fornecido por: ${rmFornecimentoViatura} (CODUG: ${codugRmFornecimentoViatura})

Rendimento das viaturas:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} km/L.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Distância a percorrer × Nr Viaturas × Nr Deslocamentos) ÷ Rendimento (km/L).
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(preco)} = ${formatCurrency(valorTotal)}.`;
      
      consolidados.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
      });
    });
    
    return { consolidadosViatura: consolidados };
  }, [formViatura, refLPC, rmFornecimentoViatura, codugRmFornecimentoViatura, fasesAtividadeViatura, customFaseAtividadeViatura]);

  const salvarRegistrosConsolidadosViatura = async () => {
    if (!ptrabId || consolidadosViatura.length === 0) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); return; }
    if (!formViatura.organizacao || !formViatura.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimentoViatura || !codugRmFornecimentoViatura) { toast.error("Selecione a RM de Fornecimento de Combustível"); return; }
    if (formViatura.itens.length === 0) { toast.error("Adicione pelo menos uma viatura"); return; }
    
    let fasesFinais = [...fasesAtividadeViatura];
    if (customFaseAtividadeViatura.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeViatura.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    try {
      setLoading(true);
      
      // 1. Deletar registros existentes (Combustível) para esta OM/Tipo
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("tipo_equipamento", "MOTOMECANIZACAO")
        .eq("organizacao", formViatura.organizacao)
        .eq("ug", formViatura.ug);
      if (deleteError) { console.error("Erro ao deletar registros existentes de viatura para edição:", deleteError); throw deleteError; }
      
      // 2. Inserir novos registros
      for (const consolidado of consolidadosViatura) {
        const registro: TablesInsert<'classe_iii_registros'> = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'MOTOMECANIZACAO',
          tipo_equipamento_detalhe: null,
          organizacao: formViatura.organizacao,
          ug: formViatura.ug,
          quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
          potencia_hp: null,
          horas_dia: null,
          km_dia: null,
          consumo_hora: null,
          consumo_km_litro: null,
          dias_operacao: formViatura.dias_operacao,
          tipo_combustivel: consolidado.tipo_combustivel,
          preco_litro: consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC.preco_gasolina ?? 0) : (refLPC.preco_diesel ?? 0),
          total_litros: consolidado.total_litros,
          total_litros_sem_margem: consolidado.total_litros_sem_margem,
          valor_total: consolidado.valor_total,
          detalhamento: consolidado.detalhamento,
          itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
          fase_atividade: faseFinalString,
          consumo_lubrificante_litro: 0,
          preco_lubrificante: 0,
        };
        const { error } = await supabase.from("classe_iii_registros").insert([registro]);
        if (error) throw error;
      }
      
      toast.success(editingRegistroId ? "Registros de viaturas atualizados com sucesso!" : "Registros de viaturas salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      setEditingRegistroId(null);
      onSaveSuccess();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de viatura:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formViatura.organizacao && formViatura.ug && rmFornecimentoViatura && codugRmFornecimentoViatura && formViatura.dias_operacao > 0;
  const isItemValid = itemViaturaTemp.tipo_equipamento_especifico && itemViaturaTemp.quantidade > 0 && itemViaturaTemp.distancia_percorrida > 0 && itemViaturaTemp.quantidade_deslocamentos > 0;
  const fuelBadgeClass = itemViaturaTemp.tipo_combustivel === 'DIESEL' 
    ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
    : 'bg-amber-500 text-white hover:bg-amber-600';

  const displayFases = [...fasesAtividadeViatura, customFaseAtividadeViatura.trim()].filter(f => f).join(', ');

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosViatura(); }}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>OM Detentora do Equipamento *</Label>
            <OmSelector
              selectedOmId={formViatura.selectedOmId}
              onChange={handleOMViaturaChange}
              placeholder="Selecione a OM detentora..."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>UG Detentora</Label>
            <Input value={formViatura.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rmFornecimentoViatura">RM de Fornecimento de Combustível *</Label>
            <RmSelector
              value={rmFornecimentoViatura}
              onChange={handleRMFornecimentoViaturaChange}
              placeholder="Selecione a RM de fornecimento..."
              disabled={!formViatura.organizacao || loading}
            />
          </div>

          <div className="space-y-2">
            <Label>CODUG da RM de Fornecimento</Label>
            <Input value={codugRmFornecimentoViatura} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Dias de Atividade *</Label>
            <Input
              type="number"
              min="1"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
              value={formViatura.dias_operacao || ""}
              onChange={(e) => setFormViatura({ ...formViatura, dias_operacao: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Fase da Atividade *</Label>
            <Popover open={isPopoverOpenViatura} onOpenChange={setIsPopoverOpenViatura}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  type="button"
                  className="w-full justify-between"
                  disabled={loading}
                >
                  {displayFases || "Selecione as fases..."}
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
                        onSelect={() => handleFaseChange(fase, !fasesAtividadeViatura.includes(fase))}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span>{fase}</span>
                        <Checkbox
                          checked={fasesAtividadeViatura.includes(fase)}
                          onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <div className="p-2 border-t">
                    <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                    <Input
                      value={customFaseAtividadeViatura}
                      onChange={(e) => setCustomFaseAtividadeViatura(e.target.value)}
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
      <div className="mb-6" />

      {isFormValid && formViatura.dias_operacao > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6" ref={addViaturaRef}>
          <h3 className="text-lg font-semibold">2. Adicionar Viaturas</h3>
          
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Viatura *</Label>
                <Select 
                  value={itemViaturaTemp.tipo_equipamento_especifico}
                  onValueChange={handleTipoViaturaChange}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentosDisponiveis.map(eq => (
                      <SelectItem key={eq.nome} value={eq.nome}>
                        {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Distância a ser percorrida (km) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={itemViaturaTemp.distancia_percorrida === 0 ? "" : itemViaturaTemp.distancia_percorrida.toString()}
                  onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, distancia_percorrida: parseFloat(e.target.value) || 0 })}
                  placeholder="Ex: 150"
                  disabled={loading}
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <div className="space-y-2">
                <Label>Quantidade de Deslocamentos *</Label>
                <Input
                  type="number"
                  min="1"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={itemViaturaTemp.quantidade_deslocamentos === 0 ? "" : itemViaturaTemp.quantidade_deslocamentos.toString()}
                  onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, quantidade_deslocamentos: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 5"
                  disabled={loading}
                  onKeyDown={handleEnterToNextField}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade de Viaturas *</Label>
                <Input
                  type="number"
                  min="1"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={itemViaturaTemp.quantidade === 0 ? "" : itemViaturaTemp.quantidade.toString()}
                  onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, quantidade: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 3"
                  disabled={loading}
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button type="button" onClick={adicionarOuAtualizarItemViatura} className="w-full" disabled={loading || !isItemValid}>
                  {editingViaturaItemIndex !== null ? "Atualizar Viatura" : "Adicionar Viatura"}
                </Button>
              </div>
            </div>
          </div>

          {itemViaturaTemp.consumo_fixo > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="default" className={fuelBadgeClass}>
                Consumo: {formatNumber(itemViaturaTemp.consumo_fixo, 1)} km/L
              </Badge>
              <Badge variant="default" className={fuelBadgeClass}>
                Combustível: {itemViaturaTemp.tipo_combustivel}
              </Badge>
            </div>
          )}
          {editingViaturaItemIndex !== null && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEditViaturaItem}
              className="mt-2"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Edição do Item
            </Button>
          )}
        </div>
      )}

      {formViatura.itens.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">3. Viaturas Configuradas</h3>
          
          <div className="space-y-2">
            {formViatura.itens.map((item, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantidade} vtr • {formatNumber(item.distancia_percorrida)} km • {item.quantidade_deslocamentos} desloc • {formatNumber(item.consumo_fixo, 1)} km/L • {item.tipo_combustivel}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditViaturaItem(item, index)}
                      disabled={loading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItemViatura(index)}
                      disabled={loading}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {consolidadosViatura.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">4. Consolidação por Combustível</h3>
          
          {consolidadosViatura.map((consolidado, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-lg">
                    {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel'}
                  </h4>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total com 30%</p>
                    <p className="text-lg font-bold">{formatCurrency(consolidado.valor_total)}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Memória de Cálculo</Label>
                  <Textarea
                    value={consolidado.detalhamento}
                    readOnly
                    rows={6}
                    className="font-mono text-xs"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>
            </Card>
          ))}

          <div className="flex gap-3 pt-4 justify-end">
            {editingRegistroId && (
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingRegistroId(null)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Edição
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosViatura.length} {consolidadosViatura.length === 1 ? 'tipo' : 'tipos'} de combustível)
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};