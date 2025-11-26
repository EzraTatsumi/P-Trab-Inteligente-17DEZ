import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatUtils";
import { Package, Briefcase, Fuel, Utensils, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"; // Importar Accordion
import { cn } from "@/lib/utils"; // Importar cn para estilização

interface PTrabCostSummaryProps {
  ptrabId: string;
}

const fetchPTrabTotals = async (ptrabId: string) => {
  // 1. Fetch Classe I totals (33.90.30)
  const { data: classeIData, error: classeIError } = await supabase
    .from('classe_i_registros')
    .select('total_qs, total_qr')
    .eq('p_trab_id', ptrabId);

  if (classeIError) throw classeIError;

  const totalClasseI = (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);

  // 2. Fetch Classe III totals (33.90.39)
  const { data: classeIIIData, error: classeIIIError } = await supabase
    .from('classe_iii_registros')
    .select('valor_total, tipo_combustivel')
    .eq('p_trab_id', ptrabId);

  if (classeIIIError) throw classeIIIError;

  const totalDiesel = (classeIIIData || [])
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + record.valor_total, 0);
    
  const totalGasolina = (classeIIIData || [])
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + record.valor_total, 0);

  const totalClasseIII = totalDiesel + totalGasolina;

  // O total logístico para o PTrab é a soma da Classe I (ND 30) + Classe III (ND 39) + Classe III (ND 30)
  // Para simplificar a exibição, vamos mostrar o total da ND 30 e ND 39 separadamente, e o total geral.
  const totalLogisticoND30 = totalClasseI;
  const totalLogisticoND39 = totalClasseIII;
  const totalLogisticoGeral = totalLogisticoND30 + totalLogisticoND39;
  
  // Total Operacional (Placeholder)
  const totalOperacional = 0;

  return {
    totalLogisticoGeral,
    totalLogisticoND30,
    totalLogisticoND39,
    totalOperacional,
    totalClasseI,
    totalDiesel,
    totalGasolina,
  };
};

export const PTrabCostSummary = ({ ptrabId }: PTrabCostSummaryProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ptrabTotals', ptrabId],
    queryFn: () => fetchPTrabTotals(ptrabId),
    enabled: !!ptrabId,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Custos</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Calculando...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg border-destructive">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Erro no Cálculo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Não foi possível carregar os totais.</p>
        </CardContent>
      </Card>
    );
  }
  
  const totals = data!;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Resumo de Custos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Total Geral */}
        <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
          <span className="font-bold text-base text-primary">TOTAL GERAL (GND 3)</span>
          <span className="font-extrabold text-xl text-primary">
            {formatCurrency(totals.totalLogisticoGeral + totals.totalOperacional)}
          </span>
        </div>

        {/* Aba Logística */}
        <div className="space-y-3 border-l-4 border-orange-500 pl-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-600 mb-3">
            <Package className="h-4 w-4" />
            Aba Logística
          </div>
          
          {/* Classe I - Subsistência */}
          {/* Aplicando a mesma estrutura flexível para alinhar o valor à direita */}
          <div className="flex justify-between text-sm border-b pb-2 border-border/50">
            <div className="flex items-center gap-2 text-foreground">
              <Utensils className="h-4 w-4 text-orange-500" />
              Classe I (Subsistência)
            </div>
            {/* Novo container para o valor, simulando o espaço ocupado pela seta */}
            <div className="flex items-center gap-1 pr-6"> 
              <span className="font-medium text-foreground">
                {formatCurrency(totals.totalClasseI)}
              </span>
            </div>
          </div>

          {/* Classe III - Combustíveis (Item principal) */}
          <Accordion type="single" collapsible className="w-full pt-2">
            <AccordionItem value="item-1" className="border-b-0">
              <AccordionTrigger className="p-0 hover:no-underline">
                <div className="flex justify-between items-center w-full text-sm border-b pb-2 border-border/50">
                  <div className="flex items-center gap-2 text-foreground">
                    <Fuel className="h-4 w-4 text-orange-500" />
                    Classe III (Combustíveis)
                  </div>
                  <div className="flex items-center gap-1 pr-6">
                    <span className="font-medium text-foreground">
                      {formatCurrency(totals.totalLogisticoND39)}
                    </span>
                    {/* A seta de expansão é adicionada automaticamente pelo AccordionTrigger */}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <div className="space-y-1 pl-6 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Óleo Diesel</span>
                    <span className="font-medium">{formatCurrency(totals.totalDiesel)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Gasolina</span>
                    <span className="font-medium">{formatCurrency(totals.totalGasolina)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Aba Operacional */}
        <div className="space-y-3 border-l-4 border-blue-500 pl-3 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <Briefcase className="h-4 w-4" />
            Aba Operacional
          </div>
          {/* Aplicando a mesma estrutura flexível para alinhar o valor à direita */}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Itens Operacionais (ND 39)</span>
            {/* Novo container para o valor, simulando o espaço ocupado pela seta */}
            <div className="flex items-center gap-1 pr-6">
              <span className="font-medium">{formatCurrency(totals.totalOperacional)}</span>
            </div>
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
};