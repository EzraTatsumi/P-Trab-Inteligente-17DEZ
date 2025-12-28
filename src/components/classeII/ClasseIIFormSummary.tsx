import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, XCircle } from "lucide-react";
import { formatCurrency, formatCodug, areNumbersEqual } from "@/lib/formatUtils";
import { getCategoryLabel } from "@/lib/badgeUtils";
import { cn } from "@/lib/utils";

type Categoria = "Equipamento Individual" | "Proteção Balística" | "Material de Estacionamento";

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
}

interface CategoryAllocation {
  total_valor: number;
  nd_30_value: number;
  nd_39_value: number;
  om_destino_recurso: string;
  ug_destino_recurso: string;
}

interface ClasseIIFormSummaryProps {
  loading: boolean;
  editingId: string | null;
  organizacaoDetentora: string;
  ugDetentora: string;
  diasOperacao: number;
  efetivo: number;
  formItems: ItemClasseII[];
  categoryAllocations: Record<Categoria, CategoryAllocation>;
  selectedTab: Categoria;
  
  onFinalSave: () => void;
  onResetForm: () => void;
  isCategoryAllocationDirty: (category: Categoria, currentTotal: number, allocation: CategoryAllocation, tempInputs: Record<Categoria, string>, tempDestinations: any) => boolean;
  tempND39Inputs: Record<Categoria, string>;
  tempDestinations: any;
  currentCategoryItems: ItemClasseII[];
  currentCategoryTotalValue: number;
}

export const ClasseIIFormSummary: React.FC<ClasseIIFormSummaryProps> = ({
  loading,
  editingId,
  organizacaoDetentora,
  ugDetentora,
  diasOperacao,
  efetivo,
  formItems,
  categoryAllocations,
  selectedTab,
  onFinalSave,
  onResetForm,
  isCategoryAllocationDirty,
  tempND39Inputs,
  tempDestinations,
  currentCategoryItems,
  currentCategoryTotalValue,
}) => {
  
  const itensAgrupadosPorCategoria = useMemo(() => {
    return formItems.reduce((acc, item) => {
      if (!acc[item.categoria]) {
        acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<Categoria, ItemClasseII[]>);
  }, [formItems]);

  const valorTotalForm = formItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
  const totalND30Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_30_value, 0);
  const totalND39Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_39_value, 0);
  const totalAlocado = totalND30Final + totalND39Final;
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalAlocado);
  
  // Verifica se alguma categoria salva está suja
  const isAnyCategoryDirty = useMemo(() => {
      return Object.entries(categoryAllocations).some(([cat, allocation]) => {
          const category = cat as Categoria;
          
          // 1. Determinar qual lista de itens usar para a verificação de sujeira:
          const itemsForCheck = category === selectedTab 
              ? currentCategoryItems.filter(i => i.quantidade > 0) 
              : itensAgrupadosPorCategoria[category] || [];
              
          // 2. Calcular o total a partir da lista de verificação
          const currentTotalForCheck = itemsForCheck.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
          
          // 3. Realizar a verificação de sujeira
          return isCategoryAllocationDirty(
              category, 
              currentTotalForCheck, 
              allocation, 
              tempND39Inputs, 
              tempDestinations
          );
      });
  }, [categoryAllocations, selectedTab, currentCategoryItems, diasOperacao, isCategoryAllocationDirty, itensAgrupadosPorCategoria, tempND39Inputs, tempDestinations]);


  return (
    <div className="space-y-4 border-b pb-4">
      <h3 className="text-lg font-semibold">3. Itens Adicionados ({formItems.length})</h3>
      
      {/* Alerta de Validação Final */}
      {(!isTotalAlocadoCorrect || isAnyCategoryDirty) && (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                  Atenção: O Custo Total dos Itens ({formatCurrency(valorTotalForm)}) não corresponde ao Total Alocado ({formatCurrency(totalAlocado)}). 
                  {isAnyCategoryDirty && " Algumas categorias foram alteradas e precisam ser salvas novamente."}
                  {!isAnyCategoryDirty && " Clique em 'Salvar Itens da Categoria' em todas as abas ativas."}
              </AlertDescription>
          </Alert>
      )}

      <div className="space-y-4">
        {Object.entries(itensAgrupadosPorCategoria).map(([categoria, itens]) => {
          const totalCategoriaSaved = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
          const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
          const allocation = categoryAllocations[categoria as Categoria];
          
          // Verifica se a OM Detentora é diferente da OM de Destino
          const isDifferentOm = organizacaoDetentora !== allocation.om_destino_recurso;
          
          // Verifica se a categoria está "suja" (usando a mesma lógica do isAnyCategoryDirty, mas focada na categoria atual)
          const itemsForCheck = categoria === selectedTab 
              ? currentCategoryItems.filter(i => i.quantidade > 0) 
              : itens;
          const currentTotalForCheck = itemsForCheck.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
          const isDirty = isCategoryAllocationDirty(
              categoria as Categoria, 
              currentTotalForCheck, 
              allocation, 
              tempND39Inputs, 
              tempDestinations
          );

          return (
            <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <h4 className="font-bold text-base text-primary">{getCategoryLabel(categoria)} ({totalQuantidade} itens)</h4>
                <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoriaSaved)}</span>
              </div>
              
              <div className="space-y-2">
                {itens.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                    <span className="font-medium">{item.item}</span>
                    <span className="text-right">
                      {item.quantidade} un. x {formatCurrency(item.valor_mnt_dia)}/dia x {diasOperacao} dias = {formatCurrency(item.quantidade * item.valor_mnt_dia * diasOperacao)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">OM Destino Recurso:</span>
                      <span className={cn("font-medium", isDifferentOm ? "text-red-600 font-bold" : "text-foreground")}>
                          {allocation.om_destino_recurso} ({formatCodug(allocation.ug_destino_recurso)})
                      </span>
                  </div>
                  <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                      <span className="font-medium text-green-600">{formatCurrency(allocation.nd_30_value)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                      <span className="font-medium text-blue-600">{formatCurrency(allocation.nd_39_value)}</span>
                  </div>
                  {isDirty && (
                      <Alert variant="destructive" className="mt-2 p-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle className="text-xs font-semibold">Valores Desatualizados</AlertTitle>
                          <AlertDescription className="text-xs">
                              A quantidade de itens, a alocação de ND ou a OM de destino foi alterada. Clique em "Salvar Itens da Categoria" na aba "{getCategoryLabel(categoria)}" para atualizar.
                          </AlertDescription>
                      </Alert>
                  )}
              </div>
            </Card>
          );
        })}
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
          onClick={onResetForm}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Limpar Formulário
        </Button>
        <Button 
          type="button" 
          onClick={onFinalSave} 
          disabled={loading || !organizacaoDetentora || ugDetentora === "" || formItems.length === 0 || !isTotalAlocadoCorrect || isAnyCategoryDirty}
        >
          {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
        </Button>
      </div>
    </div>
  );
};