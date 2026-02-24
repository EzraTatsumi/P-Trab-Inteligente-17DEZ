"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Package, Search, Loader2, Save, X } from "lucide-react";
import { MaterialConsumoGroup, MaterialConsumoItem } from "@/types/materialConsumo";

import { formatCurrency } from "@/lib/formatUtils";
import { isGhostMode } from "@/lib/ghostStore";
import { cn } from "@/lib/utils";

interface MaterialConsumoGroupFormProps {
  group?: MaterialConsumoGroup;
  onSave: (group: MaterialConsumoGroup) => void;
  onCancel: () => void;
  diretrizes: DiretrizMaterialConsumo[];
  loading?: boolean;
}

const MaterialConsumoGroupForm = ({ group, onSave, onCancel, diretrizes, loading }: MaterialConsumoGroupFormProps) => {
  const [nomeGrupo, setNomeGrupo] = useState(group?.nome_grupo || "");
  const [itens, setItens] = useState<MaterialConsumoItem[]>(group?.itens || []);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Expondo preenchimento para o Tour
  useEffect(() => {
    (window as any).prefillGroupName = () => {
      setNomeGrupo("Material de Construção");
    };
    return () => {
      delete (window as any).prefillGroupName;
    };
  }, []);

  const handleOpenSelector = () => {
    setIsSelectorOpen(true);
    if (isGhostMode()) {
      // Avança do passo 7 para o 8 ao clicar no botão
      window.dispatchEvent(new CustomEvent('tour:avancar'));
    }
  };

  const handleConfirmSelection = (selectedItens: MaterialConsumoItem[]) => {
    setItens(selectedItens);
    setIsSelectorOpen(false);
    if (isGhostMode()) {
      // Avança do passo 8 para o 9 após a seleção ser confirmada e o modal fechar
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }, 300);
    }
  };

  const handleUpdateQuantity = (index: number, quantity: string) => {
    const newItens = [...itens];
    const numQty = parseFloat(quantity) || 0;
    newItens[index] = {
      ...newItens[index],
      quantidade: numQty,
      valor_total: numQty * newItens[index].valor_unitario
    };
    setItens(newItens);
  };

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const totalGrupo = itens.reduce((acc, item) => acc + (item.valor_total || 0), 0);

  return (
    <Card className="shadow-md border-primary/20 tour-group-form-card">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {group ? "Editar Grupo de Aquisição" : "Novo Grupo de Aquisição"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome_grupo">Nome do Grupo / Finalidade *</Label>
            <Input
              id="nome_grupo"
              value={nomeGrupo}
              onChange={(e) => setNomeGrupo(e.target.value)}
              placeholder="Ex: Material para Manutenção do Pavilhão"
            />
          </div>
          <div className="flex items-end">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full btn-importar-itens-grupo"
              onClick={handleOpenSelector}
            >
              <Search className="mr-2 h-4 w-4" />
              Importar/Alterar Itens
            </Button>
          </div>
        </div>

        {itens.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[40%]">Descrição do Item</TableHead>
                  <TableHead className="text-center">Unidade</TableHead>
                  <TableHead className="text-right">Vlr. Unitário</TableHead>
                  <TableHead className="text-center w-[120px]">Qtd.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, index) => (
                  <TableRow key={`${item.codigo_catmat}-${index}`}>
                    <TableCell className="font-medium">
                      {item.descricao_item}
                      <div className="text-[10px] text-muted-foreground">
                        CATMAT: {item.codigo_catmat} | Subitem: {item.nr_subitem}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs">{item.unidade_medida}</TableCell>
                    <TableCell className="text-right text-xs">{formatCurrency(item.valor_unitario)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className={cn("h-8 text-center tour-item-quantity-input", index === 0 && "tour-target-qty")}
                        value={item.quantidade || ""}
                        onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold text-xs">
                      {formatCurrency(item.valor_total || 0)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20 font-bold">
                  <TableCell colSpan={4} className="text-right">Total do Grupo:</TableCell>
                  <TableCell className="text-right text-primary">{formatCurrency(totalGrupo)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed rounded-md text-muted-foreground">
            Nenhum item selecionado. Clique em "Importar/Alterar Itens" para começar.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            className="btn-salvar-grupo-tour"
            onClick={() => onSave({
              id: group?.id || crypto.randomUUID(),
              nome_grupo: nomeGrupo,
              itens: itens,
              valor_total: totalGrupo
            })}
            disabled={loading || !nomeGrupo || itens.length === 0}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Grupo
          </Button>
        </div>
      </CardContent>

      <MaterialConsumoItemSelectorDialog
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        diretrizes={diretrizes}
        initialSelection={itens}
        onConfirm={handleConfirmSelection}
      />
    </Card>
  );
};

export default MaterialConsumoGroupForm;