import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, XCircle, Pencil, Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { cn } from "@/lib/utils";
import { OmSelector } from "./OmSelector"; // Importar OmSelector
import { OMData } from "@/lib/omUtils"; // Importar OMData

type CombustivelTipo = 'GASOLINA' | 'DIESEL';
type Categoria = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';

interface ItemClasseIII {
  id: string; // Usado para identificação temporária/edição
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  km_dia: number;
  consumo_fixo: number;
  tipo_combustivel: CombustivelTipo;
  consumo_lubrificante_litro: number;
  preco_lubrificante: number;
  categoria: Categoria;
}

interface LubrificanteAllocation {
    om: string;
    ug: string;
    selectedOmId?: string;
}

interface ClasseIIIItemConfiguratorProps {
  categoria: Categoria;
  equipamentosDisponiveis: TipoEquipamentoDetalhado[];
  onAddItem: (item: ItemClasseIII) => void;
  onUpdateItem: (item: ItemClasseIII) => void;
  editingItem: ItemClasseIII | null;
  onCancelEdit: () => void;
  loading: boolean;
  // NOVOS PROPS PARA ALOCAÇÃO DE LUBRIFICANTE
  lubrificanteAlloc: LubrificanteAllocation;
  onOMLubrificanteChange: (omData: OMData | undefined) => void;
}

const initialItemState = (categoria: Categoria): ItemClasseIII => ({
    id: crypto.randomUUID(),
    tipo_equipamento_especifico: "",
    quantidade: 0,
    horas_dia: 0,
    km_dia: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL",
    consumo_lubrificante_litro: 0,
    preco_lubrificante: 0,
    categoria: categoria,
});

export const ClasseIIIItemConfigurator: React.FC<ClasseIIIItemConfiguratorProps> = ({
  categoria,
  equipamentosDisponiveis,
  onAddItem,
  onUpdateItem,
  editingItem,
  onCancelEdit,
  loading,
  lubrificanteAlloc,
  onOMLubrificanteChange,
}) => {
  const [itemTemp, setItemTemp] = useState<ItemClasseIII>(initialItemState(categoria));
  const [inputConsumoLubrificante, setInputConsumoLubrificante] = useState<string>("");
  const [inputPrecoLubrificante, setInputPrecoLubrificante] = useState<string>("");
  const { handleEnterToNextField } = useFormNavigation();

  // Reset state when category changes or when starting a new item
  useEffect(() => {
    if (editingItem) {
        setItemTemp(editingItem);
        setInputConsumoLubrificante(formatNumberForInput(editingItem.consumo_lubrificante_litro, 2));
        setInputPrecoLubrificante(formatNumberForInput(editingItem.preco_lubrificante, 2));
    } else {
        setItemTemp(initialItemState(categoria));
        setInputConsumoLubrificante("");
        setInputPrecoLubrificante("");
    }
  }, [categoria, editingItem]);
  
  // Reset ID when category changes (to ensure a new item is created)
  useEffect(() => {
      setItemTemp(prev => ({ ...prev, id: crypto.randomUUID(), categoria: categoria }));
  }, [categoria]);

  // --- Input Handlers para Lubrificante e Preços ---
  const updateNumericItemTemp = (field: keyof ItemClasseIII, numericValue: number) => {
    setItemTemp(prev => ({ ...prev, [field]: numericValue }));
  };

  const handleInputPriceChange = (
      e: React.ChangeEvent<HTMLInputElement>, 
      setInput: React.Dispatch<React.SetStateAction<string>>, 
      field: keyof ItemClasseIII
  ) => {
      const rawValue = e.target.value;
      const formattedValue = formatInputWithThousands(rawValue);
      setInput(formattedValue);
      
      // Parse para número e atualiza o estado do item
      const numericValue = parseInputToNumber(formattedValue);
      updateNumericItemTemp(field, numericValue);
  };

  const handleInputPriceBlur = (
      input: string, 
      setInput: React.Dispatch<React.SetStateAction<string>>, 
      minDecimals: number,
      field: keyof ItemClasseIII
  ) => {
      const numericValue = parseInputToNumber(input);
      const formattedDisplay = formatNumberForInput(numericValue, minDecimals);
      setInput(formattedDisplay);
      updateNumericItemTemp(field, numericValue);
  };
  // Fim Input Handlers

  const handleTipoEquipamentoChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      
      // Resetar campos irrelevantes para a nova categoria
      let resetFields = { horas_dia: 0, km_dia: 0 };
      if (categoria === 'MOTOMECANIZACAO') {
          resetFields.horas_dia = 0;
      } else {
          resetFields.km_dia = 0;
      }
      
      setItemTemp(prev => ({ 
        ...prev, 
        ...resetFields,
        tipo_equipamento_especifico: tipoNome, 
        tipo_combustivel: novoCombustivel, 
        consumo_fixo: equipamento.consumo,
      }));
    }
  };

  const handleAddOrUpdate = () => {
    const { tipo_equipamento_especifico, quantidade, horas_dia, km_dia, consumo_lubrificante_litro, preco_lubrificante } = itemTemp;
    
    if (!tipo_equipamento_especifico || quantidade <= 0) {
      toast.error("Selecione o tipo e informe a quantidade.");
      return;
    }
    
    if (categoria === 'MOTOMECANIZACAO' && km_dia <= 0) {
        toast.error("Informe a distância percorrida (km/dia).");
        return;
    }
    
    if (categoria !== 'MOTOMECANIZACAO' && horas_dia <= 0) {
        toast.error("Informe as horas/dia.");
        return;
    }
    
    if (consumo_lubrificante_litro < 0 || preco_lubrificante < 0) {
      toast.error("Consumo e preço do lubrificante não podem ser negativos.");
      return;
    }
    
    // Validação de OM de Lubrificante
    if ((categoria === 'GERADOR' || categoria === 'EMBARCACAO') && (consumo_lubrificante_litro > 0 || preco_lubrificante > 0)) {
        if (!lubrificanteAlloc.om || !lubrificanteAlloc.ug) {
            toast.error("Se o lubrificante for preenchido, a OM de Destino do Recurso Lubrificante deve ser selecionada.");
            return;
        }
    }

    if (editingItem) {
      onUpdateItem(itemTemp);
    } else {
      onAddItem(itemTemp);
    }
    
    // Resetar para o estado inicial da categoria
    setItemTemp(initialItemState(categoria));
    setInputConsumoLubrificante("");
    setInputPrecoLubrificante("");
  };
  
  const isItemValid = itemTemp.tipo_equipamento_especifico && itemTemp.quantidade > 0 && 
                      (categoria === 'MOTOMECANIZACAO' ? itemTemp.km_dia > 0 : itemTemp.horas_dia > 0);
  
  const fuelBadgeClass = itemTemp.tipo_combustivel === 'DIESEL' 
    ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
    : 'bg-amber-500 text-white hover:bg-amber-600';

  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold">Adicionar/Editar Item</h4>
      
      {/* LINHA 1: DADOS BÁSICOS (Tipo, Qtd, Horas/Km) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-background rounded-lg border">
        <div className="space-y-2 md:col-span-2">
          <Label>Tipo de Equipamento *</Label>
          <Select 
            value={itemTemp.tipo_equipamento_especifico}
            onValueChange={handleTipoEquipamentoChange}
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
            value={itemTemp.quantidade === 0 ? "" : itemTemp.quantidade.toString()}
            onChange={(e) => setItemTemp({ ...itemTemp, quantidade: parseInt(e.target.value) || 0 })}
            placeholder="Ex: 2"
            disabled={loading}
            onKeyDown={handleEnterToNextField}
          />
        </div>

        <div className="space-y-2">
          <Label>{categoria === 'MOTOMECANIZACAO' ? 'Km/dia *' : 'Horas/dia *'}</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={categoria === 'MOTOMECANIZACAO' 
                ? (itemTemp.km_dia === 0 ? "" : itemTemp.km_dia.toString())
                : (itemTemp.horas_dia === 0 ? "" : itemTemp.horas_dia.toString())
            }
            onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                if (categoria === 'MOTOMECANIZACAO') {
                    setItemTemp({ ...itemTemp, km_dia: value });
                } else {
                    setItemTemp({ ...itemTemp, horas_dia: value });
                }
            }}
            placeholder={categoria === 'MOTOMECANIZACAO' ? "Ex: 150" : "Ex: 8"}
            disabled={loading}
            onKeyDown={handleEnterToNextField}
          />
        </div>
      </div>
      
      {/* NOVO BLOCO: OM Destino Lubrificante (Apenas para Gerador/Embarcação) */}
      {(categoria === 'GERADOR' || categoria === 'EMBARCACAO') && (
        <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <Label className="flex items-center gap-1">
                <Droplet className="h-4 w-4 text-purple-600" />
                OM Destino Recurso Lubrificante (ND 30) *
            </Label>
            <OmSelector
                selectedOmId={lubrificanteAlloc.selectedOmId}
                onChange={onOMLubrificanteChange}
                placeholder="Selecione a OM de destino..."
                disabled={loading}
            />
            {lubrificanteAlloc.om && (
                <p className="text-xs text-muted-foreground">
                    UG de Destino: {lubrificanteAlloc.ug}
                </p>
            )}
        </div>
      )}

      {/* LINHA 2: DADOS DO LUBRIFICANTE (Apenas para Gerador/Embarcação) */}
      {(categoria === 'GERADOR' || categoria === 'EMBARCACAO') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-background rounded-lg border">
          <div className="space-y-2">
            <Label>Consumo Lubrificante ({categoria === 'GERADOR' ? 'L/100h' : 'L/h'})</Label>
            <Input
              type="text"
              inputMode="decimal"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={inputConsumoLubrificante}
              onChange={(e) => handleInputPriceChange(e, setInputConsumoLubrificante, 'consumo_lubrificante_litro')}
              onBlur={(e) => handleInputPriceBlur(e.target.value, setInputConsumoLubrificante, 2, 'consumo_lubrificante_litro')}
              placeholder={categoria === 'GERADOR' ? "Ex: 0,50" : "Ex: 0,05"}
              disabled={loading}
              onKeyDown={handleEnterToNextField}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Preço Lubrificante (R$/L)</Label>
            <Input
              type="text"
              inputMode="decimal"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={inputPrecoLubrificante}
              onChange={(e) => handleInputPriceChange(e, setInputPrecoLubrificante, 'preco_lubrificante')}
              onBlur={(e) => handleInputPriceBlur(e.target.value, setInputPrecoLubrificante, 2, 'preco_lubrificante')}
              placeholder="Ex: 35,00"
              disabled={loading}
              onKeyDown={handleEnterToNextField}
            />
          </div>
          
          <div className="space-y-2 flex items-end">
            <Button 
              type="button" 
              onClick={handleAddOrUpdate} 
              className="w-full" 
              disabled={loading || !isItemValid}
            >
              {editingItem ? "Atualizar Item" : "Adicionar Item"}
            </Button>
          </div>
        </div>
      )}
      
      {/* LINHA 2: DADOS DO LUBRIFICANTE (Para Viatura/Engenharia - Apenas botão) */}
      {(categoria === 'MOTOMECANIZACAO' || categoria === 'EQUIPAMENTO_ENGENHARIA') && (
        <div className="flex justify-end">
            <Button 
              type="button" 
              onClick={handleAddOrUpdate} 
              className="w-full md:w-auto" 
              disabled={loading || !isItemValid}
            >
              {editingItem ? "Atualizar Item" : "Adicionar Item"}
            </Button>
        </div>
      )}

      {/* Detalhes do Item Temporário */}
      {itemTemp.tipo_equipamento_especifico && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
          <Badge variant="default" className={fuelBadgeClass}>
            Combustível: {itemTemp.tipo_combustivel} ({formatNumber(itemTemp.consumo_fixo, 1)} {itemTemp.categoria === 'MOTOMECANIZACAO' ? 'km/L' : 'L/h'})
          </Badge>
          {(categoria === 'GERADOR' || categoria === 'EMBARCACAO') && itemTemp.consumo_lubrificante_litro > 0 && (
            <Badge variant="default" className="bg-purple-600 text-white hover:bg-purple-700">
              Lubrificante: {formatNumber(itemTemp.consumo_lubrificante_litro, 2)} {categoria === 'GERADOR' ? 'L/100h' : 'L/h'} @ {formatCurrency(itemTemp.preco_lubrificante)}
            </Badge>
          )}
        </div>
      )}
      
      {editingItem && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancelEdit}
          className="mt-2"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Cancelar Edição
        </Button>
      )}
    </div>
  );
};