import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatNumberForInput, formatCodug, areNumbersEqual } from "@/lib/formatUtils";
import { getCategoryLabel } from "@/lib/badgeUtils";
import { cn } from "@/lib/utils";

type Categoria = "Equipamento Individual" | "Proteção Balística" | "Material de Estacionamento";

const CATEGORIAS: Categoria[] = [
  "Equipamento Individual",
  "Proteção Balística",
  "Material de Estacionamento",
];

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
}

interface TempDestination {
    om: string;
    ug: string;
    id?: string;
}

interface ClasseIICategoryItemsProps {
  diasOperacao: number;
  selectedTab: Categoria;
  currentCategoryItems: ItemClasseII[];
  currentCategoryTotalValue: number;
  nd30ValueTemp: number;
  nd39ValueTemp: number;
  formattedND39Value: string;
  tempDestinations: Record<Categoria, TempDestination>;
  organizacaoDetentora: string;
  
  onTabChange: (value: Categoria) => void;
  onQuantityChange: (itemIndex: number, quantity: number) => void;
  onND39InputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onND39InputBlur: () => void;
  onOMDestinoChange: (omData: OMData | undefined) => void;
  onUpdateCategoryItems: () => void;
}

export const ClasseIICategoryItems: React.FC<ClasseIICategoryItemsProps> = ({
  diasOperacao,
  selectedTab,
  currentCategoryItems,
  currentCategoryTotalValue,
  nd30ValueTemp,
  nd39ValueTemp,
  formattedND39Value,
  tempDestinations,
  organizacaoDetentora,
  onTabChange,
  onQuantityChange,
  onND39InputChange,
  onND39InputBlur,
  onOMDestinoChange,
  onUpdateCategoryItems,
}) => {
  const { handleEnterToNextField } = useFormNavigation();
  
  // Função para desativar setas e manter navegação por Enter
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    handleEnterToNextField(e);
  };
  
  const isTotalAlocadoCorrectTemp = useMemo(() => {
      return areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp));
  }, [currentCategoryTotalValue, nd30ValueTemp, nd39ValueTemp]);
  
  const currentTempDest = tempDestinations[selectedTab];

  return (
    <div className="space-y-4 border-b pb-4">
      <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
      
      <Tabs value={selectedTab} onValueChange={(value) => onTabChange(value as Categoria)}>
        <TabsList className="grid w-full grid-cols-3">
          {CATEGORIAS.map(cat => (
            <TabsTrigger key={cat} value={cat}>{getCategoryLabel(cat)}</TabsTrigger>
          ))}
        </TabsList>
        
        {CATEGORIAS.map(cat => (
          <TabsContent key={cat} value={cat} className="mt-4">
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              
              <div className="max-h-[400px] overflow-y-auto rounded-md border">
                  <Table className="w-full">
                      <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                          <TableRow>
                              <TableHead className="w-[50%]">Item</TableHead>
                              <TableHead className="w-[20%] text-right">Valor/Dia</TableHead>
                              <TableHead className="w-[15%] text-center">Quantidade</TableHead>
                              <TableHead className="w-[15%] text-right">Total</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {currentCategoryItems.length === 0 ? (
                              <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                      Nenhum item de diretriz encontrado para esta categoria.
                                  </TableCell>
                              </TableRow>
                          ) : (
                              currentCategoryItems.map((item, index) => {
                                  const itemTotal = item.quantidade * item.valor_mnt_dia * diasOperacao;
                                  
                                  return (
                                      <TableRow key={item.item} className="h-12">
                                          <TableCell className="font-medium text-sm py-1">
                                              {item.item}
                                          </TableCell>
                                          <TableCell className="text-right text-xs text-muted-foreground py-1">
                                              {formatCurrency(item.valor_mnt_dia)}
                                          </TableCell>
                                          <TableCell className="py-1">
                                              <Input
                                                  type="number"
                                                  min="0"
                                                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                  value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                                  onChange={(e) => onQuantityChange(index, parseInt(e.target.value) || 0)}
                                                  placeholder="0"
                                                  onKeyDown={handleNumberInputKeyDown}
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
                      <h4 className="font-semibold text-sm">Alocação de Recursos para {getCategoryLabel(cat)}</h4>
                      
                      {/* CAMPO: OM de Destino do Recurso */}
                      <div className="space-y-2">
                          <Label>OM de Destino do Recurso *</Label>
                          <OmSelector
                              selectedOmId={currentTempDest.id}
                              onChange={onOMDestinoChange}
                              placeholder="Selecione a OM que receberá o recurso..."
                              disabled={!organizacaoDetentora} 
                              initialOmName={currentTempDest.om} 
                              initialOmUg={currentTempDest.ug} 
                          />
                          {currentTempDest.ug && (
                              <p className="text-xs text-muted-foreground">
                                  UG de Destino: {formatCodug(currentTempDest.ug)}
                              </p>
                          )}
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
                                      value={formattedND39Value}
                                      onChange={onND39InputChange}
                                      onBlur={onND39InputBlur}
                                      placeholder="0,00"
                                      className="pl-12 text-lg"
                                      disabled={currentCategoryTotalValue === 0}
                                      onKeyDown={handleEnterToNextField}
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
                          <span className={cn(isTotalAlocadoCorrectTemp ? "text-primary" : "text-destructive")}>
                              {formatCurrency(nd30ValueTemp + nd39ValueTemp)}
                          </span>
                      </div>
                  </div>
              )}
              {/* FIM BLOCO DE ALOCAÇÃO */}

              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={onUpdateCategoryItems} 
                      className="w-full md:w-auto" 
                      disabled={!organizacaoDetentora || diasOperacao <= 0 || !isTotalAlocadoCorrectTemp || (currentCategoryTotalValue > 0 && (!currentTempDest.om || currentTempDest.ug === ""))}
                  >
                      Salvar Itens da Categoria
                  </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};