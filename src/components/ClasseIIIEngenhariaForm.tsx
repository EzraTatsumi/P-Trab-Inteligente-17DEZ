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

interface ItemEngenharia {
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  consumo_fixo: number;
  tipo_combustivel: CombustivelTipo;
}

interface FormDataEngenharia {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemEngenharia[];
}

interface ConsolidadoEngenharia {
  tipo_combustivel: CombustivelTipo;
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemEngenharia[];
  detalhamento: string;
}

interface ClasseIIIEngenhariaFormProps {
  ptrabId: string;
  refLPC: RefLPC;
  equipamentosDisponiveis: TipoEquipamentoDetalhado[];
  onSaveSuccess: () => void;
  editingRegistroId: string | null;
  setEditingRegistroId: (id: string | null) => void;
  initialData?: {
    form: FormDataEngenharia;
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

export const ClasseIIIEngenhariaForm = ({
  ptrabId,
  refLPC,
  equipamentosDisponiveis,
  onSaveSuccess,
  editingRegistroId,
  setEditingRegistroId,
  initialData,
}: ClasseIIIEngenhariaFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formEngenharia, setFormEngenharia] = useState<FormDataEngenharia>(initialData?.form || {
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  const [rmFornecimentoEngenharia, setRmFornecimentoEngenharia] = useState(initialData?.rmFornecimento || "");
  const [codugRmFornecimentoEngenharia, setCodugRmFornecimentoEngenharia] = useState(initialData?.codugRmFornecimento || "");

  const [itemEngenhariaTemp, setItemEngenhariaTemp] = useState<ItemEngenharia>({
    tipo_equipamento_especifico: "",
    quantidade: 0,
    horas_dia: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL",
  });
  const [editingEngenhariaItemIndex, setEditingEngenhariaItemIndex] = useState<number | null>(null);
  const [isPopoverOpenEngenharia, setIsPopoverOpenEngenharia] = useState(false);
  const [fasesAtividadeEngenharia, setFasesAtividadeEngenharia] = useState<string[]>(initialData?.fasesAtividade || ["Execução"]);
  const [customFaseAtividadeEngenharia, setCustomFaseAtividadeEngenharia] = useState<string>(initialData?.customFaseAtividade || "");

  const addEngenhariaRef = useRef<HTMLDivElement>(null);
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (initialData) {
        setFormEngenharia(initialData.form);
        setRmFornecimentoEngenharia(initialData.rmFornecimento);
        setCodugRmFornecimentoEngenharia(initialData.codugRmFornecimento);
        setFasesAtividadeEngenharia(initialData.fasesAtividade);
        setCustomFaseAtividadeEngenharia(initialData.customFaseAtividade);
    }
  }, [initialData]);

  const handleOMEngenhariaChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormEngenharia({ ...formEngenharia, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimentoEngenharia(omData.rm_vinculacao);
      setCodugRmFornecimentoEngenharia(omData.codug_rm_vinculacao);
    } else {
      setFormEngenharia({ ...formEngenharia, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimentoEngenharia("");
      setCodugRmFornecimentoEngenharia("");
    }
  };

  const handleRMFornecimentoEngenhariaChange = (rmName: string, rmCodug: string) => {
    setRmFornecimentoEngenharia(rmName);
    setCodugRmFornecimentoEngenharia(rmCodug);
  };

  const handleTipoEngenhariaChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemEngenhariaTemp({ 
        ...itemEngenhariaTemp, 
        tipo_equipamento_especifico: tipoNome, 
        tipo_combustivel: novoCombustivel as CombustivelTipo, 
        consumo_fixo: equipamento.consumo 
      });
    }
  };

  const adicionarOuAtualizarItemEngenharia = () => {
    if (!itemEngenhariaTemp.tipo_equipamento_especifico || itemEngenhariaTemp.quantidade <= 0 || itemEngenhariaTemp.horas_dia <= 0) {
      toast.error("Preencha todos os campos do item");
      return;
    }
    const novoItem: ItemEngenharia = { ...itemEngenhariaTemp };
    let novosItens = [...formEngenharia.itens];
    if (editingEngenhariaItemIndex !== null) {
      novosItens[editingEngenhariaItemIndex] = novoItem;
      toast.success("Item de engenharia atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de engenharia adicionado!");
    }
    setFormEngenharia({ ...formEngenharia, itens: novosItens });
    setItemEngenhariaTemp({ tipo_equipamento_especifico: "", quantidade: 0, horas_dia: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingEngenhariaItemIndex(null);
  };

  const handleEditEngenhariaItem = (item: ItemEngenharia, index: number) => {
    setItemEngenhariaTemp(item);
    setEditingEngenhariaItemIndex(index);
    if (addEngenhariaRef.current) { addEngenhariaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  const handleCancelEditEngenhariaItem = () => {
    setItemEngenhariaTemp({ tipo_equipamento_especifico: "", quantidade: 0, horas_dia: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingEngenhariaItemIndex(null);
  };

  const removerItemEngenharia = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formEngenharia.itens.filter((_, i) => i !== index);
    setFormEngenharia({ ...formEngenharia, itens: novosItens });
    if (editingEngenhariaItemIndex === index) { handleCancelEditEngenhariaItem(); }
    toast.success("Item de engenharia removido!");
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeEngenharia(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividadeEngenharia(prev => prev.filter(f => f !== fase));
    }
  };

  const { consolidadosEngenharia } = useMemo(() => {
    const itens = formEngenharia.itens;
    if (!refLPC || itens.length === 0) { return { consolidadosEngenharia: [] }; }
    
    const grupos = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<CombustivelTipo, ItemEngenharia[]>);
    
    const consolidados: ConsolidadoEngenharia[] = [];
    
    Object.entries(grupos).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as CombustivelTipo;
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];
      
      itensGrupo.forEach(item => {
        const litrosItem = item.quantidade * item.horas_dia * item.consumo_fixo * formEngenharia.dias_operacao;
        totalLitrosSemMargem += litrosItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- (${item.quantidade} ${item.tipo_equipamento_especifico} x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formEngenharia.dias_operacao} dias = ${formatNumber(litrosItem)} L ${unidade}.`);
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
      const totalEquipamentos = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      
      let fasesFinaisCalc = [...fasesAtividadeEngenharia];
      if (customFaseAtividadeEngenharia.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeEngenharia.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      const detalhamento = `33.90.39 - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} equipamentos de engenharia, durante ${formEngenharia.dias_operacao} dias de ${faseFormatada}, para ${formEngenharia.organizacao}.
Fornecido por: ${rmFornecimentoEngenharia} (CODUG: ${codugRmFornecimentoEngenharia})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Nr Equipamentos x Nr Horas utilizadas/dia x Consumo/hora) x Nr dias de operação.
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
    
    return { consolidadosEngenharia: consolidados };
  }, [formEngenharia, refLPC, rmFornecimentoEngenharia, codugRmFornecimentoEngenharia, fasesAtividadeEngenharia, customFaseAtividadeEngenharia]);

  const salvarRegistrosConsolidadosEngenharia = async () => {
    if (!ptrabId || consolidadosEngenharia.length === 0) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); return; }
    if (!formEngenharia.organizacao || !formEngenharia.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimentoEngenharia || !codugRmFornecimentoEngenharia) { toast.error("Selecione a RM de Fornecimento de Combustível"); return; }
    if (formEngenharia.itens.length === 0) { toast.error("Adicione pelo menos um equipamento"); return; }
    
    let fasesFinais = [...fasesAtividadeEngenharia];
    if (customFaseAtividadeEngenharia.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeEngenharia.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    try {
      setLoading(true);
      
      // 1. Deletar registros existentes (Combustível) para esta OM/Tipo
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("tipo_equipamento", "EQUIPAMENTO_ENGENHARIA")
        .eq("organizacao", formEngenharia.organizacao)
        .eq("ug", formEngenharia.ug);
      if (deleteError) { console.error("Erro ao deletar registros existentes de engenharia para edição:", deleteError); throw deleteError; }
      
      // 2. Inserir novos registros
      for (const consolidado of consolidadosEngenharia) {
        const registro: TablesInsert<'classe_iii_registros'> = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'EQUIPAMENTO_ENGENHARIA',
          tipo_equipamento_detalhe: null,
          organizacao: formEngenharia.organizacao,
          ug: formEngenharia.ug,
          quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
          potencia_hp: null,
          horas_dia: null,
          km_dia: null,
          consumo_hora: null,
          consumo_km_litro: null,
          dias_operacao: formEngenharia.dias_operacao,
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
      
      toast.success(editingRegistroId ? "Registros de engenharia atualizados com sucesso!" : "Registros de engenharia salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      setEditingRegistroId(null);
      onSaveSuccess();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de engenharia:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formEngenharia.organizacao && formEngenharia.ug && rmFornecimentoEngenharia && codugRmFornecimentoEngenharia && formEngenharia.dias_operacao > 0;
  const isItemValid = itemEngenhariaTemp.tipo_equipamento_especifico && itemEngenhariaTemp.quantidade > 0 && itemEngenhariaTemp.horas_dia > 0;
  const fuelBadgeClass = itemEngenhariaTemp.tipo_combustivel === 'DIESEL' 
    ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
    : 'bg-amber-500 text-white hover:bg-amber-600';

  const displayFases = [...fasesAtividadeEngenharia, customFaseAtividadeEngenharia.trim()].filter(f => f).join(', ');

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosEngenharia(); }}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>OM Detentora do Equipamento *</Label>
            <OmSelector
              selectedOmId={formEngenharia.selectedOmId}
              onChange={handleOMEngenhariaChange}
              placeholder="Selecione a OM detentora..."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>UG Detentora</Label>
            <Input value={formEngenharia.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rmFornecimentoEngenharia">RM de Fornecimento de Combustível *</Label>
            <RmSelector
              value={rmFornecimentoEngenharia}
              onChange={handleRMFornecimentoEngenhariaChange}
              placeholder="Selecione a RM de fornecimento..."
              disabled={!formEngenharia.organizacao || loading}
            />
          </div>

          <div className="space-y-2">
            <Label>CODUG da RM de Fornecimento</Label>
            <Input value={codugRmFornecimentoEngenharia} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Dias de Atividade *</Label>
            <Input
              type="number"
              min="1"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
              value={formEngenharia.dias_operacao || ""}
              onChange={(e) => setFormEngenharia({ ...formEngenharia, dias_operacao: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Fase da Atividade *</Label>
            <Popover open={isPopoverOpenEngenharia} onOpenChange={setIsPopoverOpenEngenharia}>
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
                        onSelect={() => handleFaseChange(fase, !fasesAtividadeEngenharia.includes(fase))}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span>{fase}</span>
                        <Checkbox
                          checked={fasesAtividadeEngenharia.includes(fase)}
                          onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <div className="p-2 border-t">
                    <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                    <Input
                      value={customFaseAtividadeEngenharia}
                      onChange={(e) => setCustomFaseAtividadeEngenharia(e.target.value)}
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

      {isFormValid && formEngenharia.dias_operacao > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6" ref={addEngenhariaRef}>
          <h3 className="text-lg font-semibold">2. Adicionar Equipamento de Engenharia</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>Tipo de Equipamento *</Label>
              <Select 
                value={itemEngenhariaTemp.tipo_equipamento_especifico}
                onValueChange={handleTipoEngenhariaChange}
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

            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={itemEngenhariaTemp.quantidade === 0 ? "" : itemEngenhariaTemp.quantidade.toString()}
                onChange={(e) => setItemEngenhariaTemp({ ...itemEngenhariaTemp, quantidade: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 1"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>

            <div className="space-y-2">
              <Label>Horas/dia *</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={itemEngenhariaTemp.horas_dia === 0 ? "" : itemEngenhariaTemp.horas_dia.toString()}
                onChange={(e) => setItemEngenhariaTemp({ ...itemEngenhariaTemp, horas_dia: parseFloat(e.target.value) || 0 })}
                placeholder="Ex: 8"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button type="button" onClick={adicionarOuAtualizarItemEngenharia} className="w-full" disabled={loading || !isItemValid}>
                {editingEngenhariaItemIndex !== null ? "Atualizar Item" : "Adicionar"}
              </Button>
            </div>
          </div>

          {itemEngenhariaTemp.consumo_fixo > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="default" className={fuelBadgeClass}>
                Consumo: {formatNumber(itemEngenhariaTemp.consumo_fixo, 1)} L/h
              </Badge>
              <Badge variant="default" className={fuelBadgeClass}>
                Combustível: {itemEngenhariaTemp.tipo_combustivel}
              </Badge>
            </div>
          )}
          {editingEngenhariaItemIndex !== null && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEditEngenhariaItem}
              className="mt-2"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Edição do Item
            </Button>
          )}
        </div>
      )}

      {formEngenharia.itens.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">3. Equipamentos Configurados</h3>
          
          <div className="space-y-2">
            {formEngenharia.itens.map((item, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantidade} unidade(s) • {formatNumber(item.horas_dia, 1)}h/dia • {formatNumber(item.consumo_fixo, 1)} L/h • {item.tipo_combustivel}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditEngenhariaItem(item, index)}
                      disabled={loading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItemEngenharia(index)}
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

      {consolidadosEngenharia.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">4. Consolidação por Combustível</h3>
          
          {consolidadosEngenharia.map((consolidado, index) => (
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
            <Button type="submit" disabled={loading || !isFormValid || formEngenharia.itens.length === 0}>
              {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosEngenharia.length} {consolidadosEngenharia.length === 1 ? 'tipo' : 'tipos'} de combustível)
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};