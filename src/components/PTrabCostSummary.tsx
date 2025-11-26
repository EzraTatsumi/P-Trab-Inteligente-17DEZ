import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Package, Briefcase, Fuel, Utensils, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface PTrabCostSummaryProps {
  ptrabId: string;
}

// Helper function to calculate days of requested stage (diasEtapaSolicitada)
const calculateDiasEtapaSolicitada = (diasOperacao: number): number => {
  const diasRestantesNoCiclo = diasOperacao % 30;
  const ciclosCompletos = Math.floor(diasOperacao / 30);
  
  if (diasRestantesNoCiclo <= 22 && diasOperacao >= 30) {
    return ciclosCompletos * 8;
  } else if (diasRestantesNoCiclo > 22) {
    return (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
  } else {
    return 0;
  }
};

const fetchPTrabTotals = async (ptrabId: string) => {
  // 1. Fetch Classe I totals (33.90.30)
  const { data: classeIData, error: classeIError } = await supabase
    .from('classe_i_registros')
    .select('total_qs, total_qr, complemento_qs, etapa_qs, complemento_qr, etapa_qr, efetivo, dias_operacao, nr_ref_int')
    .eq('p_trab_id', ptrabId);

  if (classeIError) throw classeIError;

  let totalClasseI = 0;
  let totalComplemento = 0;
  let totalEtapaSolicitadaValor = 0;
  let totalDiasEtapaSolicitada = 0;
  let totalRefeicoesIntermediarias = 0;

  (classeIData || []).forEach(record => {
    totalClasseI += record.total_qs + record.total_qr;
    totalComplemento += record.complemento_qs + record.complemento_qr;
    totalEtapaSolicitadaValor += record.etapa_qs + record.etapa_qr;
    
    // Novos cálculos de quantidade
    const diasEtapaSolicitada = calculateDiasEtapaSolicitada(record.dias_operacao);
    totalDiasEtapaSolicitada += diasEtapaSolicitada;
    
    // Refeições Intermediárias (Complemento)
    // O complemento é calculado sobre todos os dias de operação, mas o valor é dividido por 3 (valor_etapa/3)
    // A quantidade total de refeições intermediárias é: Efetivo * Nr Ref Int * Dias Operação
    totalRefeicoesIntermediarias += record.efetivo * record.nr_ref_int * record.dias_operacao;
  });

  // 2. Fetch Classe III totals (33.90.39)
  const { data: classeIIIData, error: classeIIIError } = await supabase
    .from('classe_iii_registros')
    .select('valor_total, tipo_combustivel, total_litros')
    .eq('p_trab_id', ptrabId);

  if (classeIIIError) throw classeIIIError;

  const totalDieselValor = (classeIIIData || [])
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + record.valor_total, 0);
    
  const totalGasolinaValor = (classeIIIData || [])
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + record.valor_total, 0);
    
  const totalDieselLitros = (classeIIIData || [])
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + record.total_litros, 0);
    
  const totalGasolinaLitros = (classeIIIData || [])
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + record.total_litros, 0);

  const totalClasseIII = totalDieselValor + totalGasolinaValor;

  // O total logístico para o PTrab é a soma da Classe I (ND 30) + Classe III (ND 39) + Classe III (ND 30)
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
    totalComplemento,
    totalEtapaSolicitadaValor,
    totalDiasEtapaSolicitada,
    totalRefeicoesIntermediarias,
    totalDieselValor,
    totalGasolinaValor,
    totalDieselLitros,
    totalGasolinaLitros,
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

  // Classe para garantir largura e alinhamento consistentes para os valores
  const valueClasses = "font-medium text-foreground text-right w-[6rem]"; 
  
  // Classes para a coluna de quantidade (ajustada para 1/3)
  const quantityClasses = "text-right font-medium w-1/3";
  // Classes para a coluna de descrição (ajustada para 1/3)
  const descriptionClasses = "w-1/3";

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
          <Accordion type="single" collapsible className="w-full pt-0">
            <AccordionItem value="item-classe-i" className="border-b-0">
              <AccordionTrigger className="p-0 hover:no-underline">
                <div className="flex justify-between items-center w-full text-sm border-b pb-2 border-border/50">
                  <div className="flex items-center gap-2 text-foreground">
                    <Utensils className="h-4 w-4 text-orange-500" />
                    Classe I (Subsistência)
                  </div>
                  <span className={cn(valueClasses, "mr-6")}>
                    {formatCurrency(totals.totalClasseI)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <div className="space-y-1 pl-6 text-xs">
                  {/* Detalhe 1: Valor Complemento */}
                  <div className="flex justify-between text-muted-foreground">
                    <span className={descriptionClasses}>Valor Complemento (Ref. Intermediárias)</span>
                    <span className={quantityClasses}>
                      {formatNumber(totals.totalRefeicoesIntermediarias)}
                    </span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalComplemento)}
                    </span>
                  </div>
                  {/* Detalhe 2: Valor Etapa Solicitada */}
                  <div className="flex justify-between text-muted-foreground">
                    <span className={descriptionClasses}>Valor Etapa Solicitada</span>
                    <span className={quantityClasses}>
                      {formatNumber(totals.totalDiasEtapaSolicitada)} dias
                    </span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalEtapaSolicitadaValor)}
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Classe III - Combustíveis (Item principal) */}
          <Accordion type="single" collapsible className="w-full pt-2">
            <AccordionItem value="item-classe-iii" className="border-b-0">
              <AccordionTrigger className="p-0 hover:no-underline">
                <div className="flex justify-between items-center w-full text-sm border-b pb-2 border-border/50">
                  <div className="flex items-center gap-2 text-foreground">
                    <Fuel className="h-4 w-4 text-orange-500" />
                    Classe III (Combustíveis)
                  </div>
                  <span className={cn(valueClasses, "mr-6")}>
                    {formatCurrency(totals.totalLogisticoND39)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <div className="space-y-1 pl-6 text-xs">
                  {/* Linha Óleo Diesel */}
                  <div className="flex justify-between text-muted-foreground">
                    <span className={descriptionClasses}>Óleo Diesel</span>
                    <span className={quantityClasses}>
                      {formatNumber(totals.totalDieselLitros)} L
                    </span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalDieselValor)}
                    </span>
                  </div>
                  {/* Linha Gasolina */}
                  <div className="flex justify-between text-muted-foreground">
                    <span className={descriptionClasses}>Gasolina</span>
                    <span className={quantityClasses}>
                      {formatNumber(totals.totalGasolinaLitros)} L
                    </span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalGasolinaValor)}
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          {/* SUBTOTAL LOGÍSTICA */}
          <div className="flex justify-between items-center pt-3 border-t border-border/50">
            <span className="font-bold text-sm text-foreground">SUBTOTAL LOGÍSTICA (ND 30 + ND 39)</span>
            <span className="font-bold text-lg text-orange-600">
              {formatCurrency(totals.totalLogisticoGeral)}
            </span>
          </div>
        </div>

        {/* Aba Operacional */}
        <div className="space-y-3 border-l-4 border-blue-500 pl-3 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <Briefcase className="h-4 w-4" />
            Aba Operacional
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Itens Operacionais (ND 39)</span>
            <span className={cn(valueClasses, "mr-6")}>
              {formatCurrency(totals.totalOperacional)}
            </span>
          </div>
          
          {/* NOVO: SUBTOTAL OPERACIONAL */}
          <div className="flex justify-between items-center pt-3 border-t border-border/50">
            <span className="font-bold text-sm text-foreground">SUBTOTAL OPERACIONAL (ND 39)</span>
            <span className="font-bold text-lg text-blue-600">
              {formatCurrency(totals.totalOperacional)}
            </span>
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
};