import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DiretrizEquipamentoForm } from "@/types/diretrizesEquipamentos";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseIII {
  id?: string; // ID temporário para itens novos
  item: string;
  categoria: string;
  consumo_fixo: number;
  tipo_combustivel_fixo: 'GAS' | 'OD';
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia?: number;
  dias_utilizados: number;
  distancia_percorrida?: number;
  quantidade_deslocamentos?: number;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
  preco_lubrificante_input?: string;
  consumo_lubrificante_input?: string;
}

interface CategoryAllocation {
  total_valor: number;
  nd_39_input: string;
  nd_30_value: number;
  nd_39_value: number;
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

interface CategoryFormSectionProps {
  categoria: string;
  categoriaLabel: string;
  icon: React.FC<any>;
  items: ItemClasseIII[];
  diasOperacao: number;
  onUpdateItems: (updatedItems: ItemClasseIII[]) => void;
  onUpdateAllocation: (allocation: CategoryAllocation) => void;
  diretrizes: DiretrizEquipamentoForm[];
  isMotomecanizacao: boolean;
  fasesAtividade: string[];
  customFaseAtividade: string;
  onFaseChange: (fase: string, checked: boolean) => void;
  onOpenFasePopover: () => void;
  loading: boolean;
}

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

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

// Função para gerar o detalhamento da categoria
const generateCategoryDetalhamento = (
  categoria: string,
  itens: ItemClasseIII[],
  diasOperacao: number,
  organizacao: string,
  ug: string,
  faseAtividade: string,
  omDestino: string,
  ugDestino: string,
  valorND30: number,
  valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;

    const gruposPorItem = itens.reduce((acc, item) => {
        const valorItem = item.quantidade * item.consumo_fixo * diasOperacao;
        
        acc.push({
            ...item,
            valorItem,
            detalhe: `- ${item.quantidade} ${item.item} x ${formatNumber(item.consumo_fixo, 1)} ${item.unidade_fixa} x ${diasOperacao} dias = ${formatCurrency(valorItem)}.`
        });
        
        return acc;
    }, [] as (ItemClasseIII & { valorItem: number; detalhe: string })[]);

    let detalhamentoItens = "";
    gruposPorItem.forEach(item => {
        detalhamentoItens += item.detalhe + '\n';
    });

    return `33.90.30 / 33.90.39 - Aquisição de Combustível (${categoria}) para ${totalItens} itens, durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo:
Fórmula Base: Nr Itens x Consumo x Nr Dias de Operação.

${detalhamentoItens.trim()}

Valor Total: ${formatCurrency(valorTotal)}.`;
};

export const CategoryFormSection: React.FC<CategoryFormSectionProps> = ({
  categoria,
  categoriaLabel,
  icon: Icon,
  items,
  diasOperacao,
  onUpdateItems,
  onUpdateAllocation,
  diretrizes,
  isMotomecanizacao,
  fasesAtividade,
  customFaseAtividade,
  onFaseChange,
  onOpenFasePopover,
  loading,
}) => {
  const [currentND39Input, setCurrentND39Input] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Memo para calcular o valor total da categoria
  const currentCategoryTotalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantidade * item.consumo_fixo * diasOperacao), 0);
  }, [items, diasOperacao]);

  // Memo para calcular os valores de ND 30 e ND 39
  const { nd30ValueTemp, nd39ValueTemp } = useMemo(() => {
    const nd39Value = Math.min(currentCategoryTotalValue, Math.max(0, parseInputToNumber(currentND39Input)));
    const nd30Value = currentCategoryTotalValue - nd39Value;
    return { nd30ValueTemp, nd39ValueTemp };
  }, [currentCategoryTotalValue, currentND39Input]);

  // Memo para verificar se o total alocado está correto
  const isTotalAlocadoCorrect = useMemo(() => {
    return areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp));
  }, [currentCategoryTotalValue, nd30ValueTemp, nd39ValueTemp]);

  // Handler para mudar a quantidade de um item
  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...items];
    // Garante que a quantidade não seja negativa
    newItems[itemIndex].quantidade = Math.max(0, quantity);
    onUpdateItems(newItems);
  };

  // Handlers para o input de ND 39
  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setCurrentND39Input(formatInputWithThousands(rawValue));
  };

  const handleND39InputBlur = () => {
    const numericValue = parseInputToNumber(currentND39Input);
    const finalND39Value = Math.min(currentCategoryTotalValue, Math.max(0, numericValue));
    setCurrentND39Input(formatNumberForInput(finalND39Value, 2));
  };

  // Handler para atualizar os itens e a alocação da categoria
  const handleUpdateCategoryItems = (omDestino: OMData | undefined) => {
    if (diasOperacao <= 0) {
      // toast.error("Preencha os Dias de Operação antes de salvar itens.");
      return;
    }
    
    // 1. Calcular o valor total para os itens da categoria atual
    const categoryTotalValue = currentCategoryTotalValue;

    // 2. Calcular o valor final de ND 39 com base no input
    const numericInput = parseInputToNumber(currentND39Input);
    const finalND39Value = Math.min(categoryTotalValue, Math.max(0, numericInput));
    const finalND30Value = categoryTotalValue - finalND39Value;
    
    // 3. Validar se a soma de ND 30 e ND 39 corresponde ao total da categoria
    if (categoryTotalValue > 0 && !isTotalAlocadoCorrect) {
      // toast.error("Erro de cálculo: A soma de ND 30 e ND 39 deve ser igual ao Total da Categoria.");
      return;
    }
    
    // 4. Validar se a OM de destino foi selecionada
    if (categoryTotalValue > 0 && (!omDestino || !omDestino.nome_om)) {
      // toast.error("Selecione a OM de destino do recurso antes de salvar a alocação.");
      return;
    }

    // 5. Filtrar itens válidos (quantidade > 0)
    const itemsToKeep = items.filter(item => item.quantidade > 0);

    // 6. Atualizar a alocação da categoria
    const newAllocation: CategoryAllocation = {
      total_valor: categoryTotalValue,
      nd_39_input: formatNumberForInput(finalND39Value, 2),
      nd_30_value: finalND30Value,
      nd_39_value: finalND39Value,
      om_destino_recurso: omDestino?.nome_om || "",
      ug_destino_recurso: omDestino?.codug_om || "",
      selectedOmDestinoId: omDestino?.id,
    };
    onUpdateAllocation(newAllocation);

    // 7. Atualizar os itens no formulário principal (será feito pelo componente pai)
    onUpdateItems(itemsToKeep);
    
    // toast.success(`Itens e alocação de ND para ${categoriaLabel} atualizados!`);
  };

  // Handler para mudar a fase de atividade
  const handleFaseChange = (fase: string, checked: boolean) => {
    onFaseChange(fase, checked);
  };

  const Icon = icon;

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {categoriaLabel}
      </h3>
      
      <div className="max-h-[400px] overflow-y-auto rounded-md border">
        <Table className="w-full">
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <TableRow>
              <TableHead className="w-[40%]">Item</TableHead>
              <TableHead className="w-[15%] text-right">Consumo</TableHead>
              <TableHead className="w-[15%] text-center">Qtd</TableHead>
              <TableHead className="w-[15%] text-center">Qtd Dias</TableHead>
              <TableHead className="w-[15%] text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum item de diretriz encontrado para esta categoria.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const itemTotal = item.quantidade * item.consumo_fixo * diasOperacao;
                
                return (
                  <TableRow key={item.id || index} className="h-12">
                    <TableCell className="font-medium text-sm py-1">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{item.item}</span>
                        <Badge variant="default" className="w-fit text-xs font-normal">
                          {item.tipo_combustivel_fixo} ({formatNumber(item.consumo_fixo, 1)} {item.unidade_fixa})
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground py-1">
                      {formatNumber(item.consumo_fixo, 1)}
                    </TableCell>
                    <TableCell className="py-1">
                      <Input
                        type="number"
                        min="0"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                        value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        disabled={loading}
                      />
                    </TableCell>
                    <TableCell className="py-1">
                      <Input
                        type="number"
                        min="0"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                        value={item.dias_utilizados === 0 ? "" : item.dias_utilizados.toString()}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].dias_utilizados = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                          onUpdateItems(newItems);
                        }}
                        placeholder="0"
                        disabled={loading}
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
        <span className="font-bold text-sm">TOTAL DA CATEGORIA</span>
        <span className="font-extrabold text-lg text-primary">
          {formatCurrency(currentCategoryTotalValue)}
        </span>
      </div>
      
      {/* BLOCO DE ALOCAÇÃO ND 30/39 */}
      {currentCategoryTotalValue > 0 && (
        <div className="space-y-4 p-4 border rounded-lg bg-background">
          <h4 className="font-semibold text-sm">Alocação de Recursos para {categoriaLabel}</h4>
          
          {/* CAMPO: OM de Destino do Recurso */}
          <div className="space-y-2">
            <Label>OM de Destino do Recurso *</Label>
            <OmSelector
              value={items.find(item => item.quantidade > 0)?.selectedOmDestinoId}
              onChange={(omData) => {
                // Atualiza o selectedOmDestinoId no item principal (se houver)
                const newItems = items.map(item => 
                  item.quantidade > 0 ? { ...item, selectedOmDestinoId: omData?.id } : item
                );
                onUpdateItems(newItems);
              }}
              placeholder="Selecione a OM que receberá o recurso..."
              disabled={loading}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* ND 30 (Material) - ESQUERDA */}
            <div className="space-y-2">
              <Label>ND 33.90.30 (Material)</Label>
              <div className="relative">
                <Input
                  value={formatNumberForInput(nd30ValueTemp, 2)}
                  readOnly
                  disabled
                  className="pl-12 text-lg font-bold bg-green-500/10 text-green-600 disabled:opacity-100"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calculado por diferença (Total - ND 39).
              </p>
            </div>
            {/* ND 39 (Serviço) - DIREITA */}
            <div className="space-y-2">
              <Label htmlFor="nd39-input">ND 33.90.39 (Serviço)</Label>
              <div className="relative">
                <Input
                  id="nd39-input"
                  type="text"
                  inputMode="decimal"
                  value={currentND39Input}
                  onChange={handleND39InputChange}
                  onBlur={handleND39InputBlur}
                  placeholder="0,00"
                  className="pl-12 text-lg"
                  disabled={currentCategoryTotalValue === 0}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Valor alocado para contratação de serviço.
              </p>
            </div>
          </div>
          <div className="flex justify-between text-sm font-bold border-t pt-2">
            <span>TOTAL ALOCADO:</span>
            <span className={cn(isTotalAlocadoCorrect ? "text-primary" : "text-destructive")}>
              {formatCurrency(nd30ValueTemp + nd39ValueTemp)}
            </span>
          </div>
        </div>
      )}
      
      <div className="flex justify-end">
        <Button 
          type="button" 
          onClick={() => handleUpdateCategoryItems(items.find(item => item.quantidade > 0)?.selectedOmDestinoId)} 
          className="w-full md:w-auto" 
          disabled={loading || diasOperacao <= 0 || !isTotalAlocadoCorrect || (currentCategoryTotalValue > 0 && !items.find(item => item.quantidade > 0)?.selectedOmDestinoId)}
        >
          {loading ? "Aguarde..." : "Salvar Itens da Categoria"}
        </Button>
      </div>
    </div>
  );
};