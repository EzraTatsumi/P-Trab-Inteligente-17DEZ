import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Importar CardDescription
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Package, Briefcase, Fuel, Utensils, Loader2, ChevronDown, HardHat, Plane, TrendingUp } from "lucide-react"; // Importar HardHat e Plane
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button"; // Importar Button

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void; // Novo prop para abrir o diálogo
  creditGND3: number;
  creditGND4: number;
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
  
  // Novos totais (placeholders)
  const totalMaterialPermanente = 0;
  const totalAviacaoExercito = 0;
  
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
    totalMaterialPermanente,
    totalAviacaoExercito,
  };
};

export const PTrabCostSummary = ({ 
  ptrabId, 
  onOpenCreditDialog,
  creditGND3,
  creditGND4,
}: PTrabCostSummaryProps) => {
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
          <CardTitle className="text-2xl font-bold">Resumo de Custos</CardTitle>
          <CardDescription>
            Visão consolidada dos custos logísticos e operacionais.
          </CardDescription>
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
          <CardTitle className="text-2xl font-bold text-destructive">Erro no Cálculo</CardTitle>
          <CardDescription>
            Não foi possível carregar os totais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ocorreu um erro ao buscar os dados de custeio.</p>
        </CardContent>
      </Card>
    );
  }
  
  const totals = data!;
  
  // O total geral agora inclui os novos placeholders
  const totalGeralFinal = totals.totalLogisticoGeral + totals.totalOperacional + totals.totalMaterialPermanente + totals.totalAviacaoExercito;

  // Cálculo do Saldo
  const saldoGND3 = creditGND3 - (totals.totalLogisticoGeral + totals.totalOperacional + totals.totalAviacaoExercito);
  const saldoGND4 = creditGND4 - totals.totalMaterialPermanente;

  // Classe para garantir largura e alinhamento consistentes para os valores
  const valueClasses = "font-medium text-foreground text-right w-[6rem]"; 
  
  // Classes para a coluna de quantidade (ajustada para 1/3)
  const quantityClasses = "text-right font-medium w-1/3";
  // Classes para a coluna de descrição (ajustada para 1/3)
  const descriptionClasses = "w-1/3";

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-bold">Resumo de Custos</CardTitle>
        <CardDescription>
          Visão consolidada dos custos logísticos e operacionais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-6">
        
        <Accordion type="single" collapsible className="w-full px-6">
          <AccordionItem value="summary-details" className="border-b-0">
            <AccordionTrigger className="py-3 px-0 hover:no-underline flex flex-col items-start gap-2">
              
              {/* NOVO RESUMO QUANDO FECHADO */}
              <div className="w-full space-y-1 text-sm pt-1">
                <div className="flex justify-between text-orange-600">
                  <span className="font-semibold text-base">Aba Logística</span>
                  <span className="font-bold text-base">{formatCurrency(totals.totalLogisticoGeral)}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span className="font-semibold text-base">Aba Operacional</span>
                  <span className="font-bold text-base">{formatCurrency(totals.totalOperacional)}</span>
                </div>
                {/* Adicionando Material Permanente */}
                <div className="flex justify-between text-green-600">
                  <span className="font-semibold text-base">Aba Material Permanente</span>
                  <span className="font-bold text-base">{formatCurrency(totals.totalMaterialPermanente)}</span>
                </div>
                {/* Adicionando Aviação do Exército */}
                <div className="flex justify-between text-purple-600">
                  <span className="font-semibold text-base">Aba Aviação do Exército</span>
                  <span className="font-bold text-base">{formatCurrency(totals.totalAviacaoExercito)}</span>
                </div>
                <div className="flex justify-between text-foreground font-bold border-t border-border/50 pt-1">
                  <span className="text-lg">Total Geral</span>
                  <span className="text-xl">{formatCurrency(totalGeralFinal)}</span>
                </div>
              </div>
              {/* FIM NOVO RESUMO */}
              
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-0">
              <div className="space-y-4">
                
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
                    <span className="font-bold text-sm text-foreground">SUBTOTAL LOGÍSTICA</span>
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
                    <span>Itens Operacionais</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalOperacional)}
                    </span>
                  </div>
                  
                  {/* SUBTOTAL OPERACIONAL */}
                  <div className="flex justify-between items-center pt-3 border-t border-border/50">
                    <span className="font-bold text-sm text-foreground">SUBTOTAL OPERACIONAL</span>
                    <span className="font-bold text-lg text-blue-600">
                      {formatCurrency(totals.totalOperacional)}
                    </span>
                  </div>
                </div>
                
                {/* Aba Material Permanente (NOVO) */}
                <div className="space-y-3 border-l-4 border-green-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                    <HardHat className="h-4 w-4" />
                    Aba Material Permanente
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Itens de Material Permanente</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalMaterialPermanente)}
                    </span>
                  </div>
                  
                  {/* SUBTOTAL MATERIAL PERMANENTE */}
                  <div className="flex justify-between items-center pt-3 border-t border-border/50">
                    <span className="font-bold text-sm text-foreground">SUBTOTAL MATERIAL PERMANENTE</span>
                    <span className="font-bold text-lg text-green-600">
                      {formatCurrency(totals.totalMaterialPermanente)}
                    </span>
                  </div>
                </div>
                
                {/* Aba Aviação do Exército (NOVO) */}
                <div className="space-y-3 border-l-4 border-purple-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
                    <Plane className="h-4 w-4" />
                    Aba Aviação do Exército
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Itens de Aviação</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalAviacaoExercito)}
                    </span>
                  </div>
                  
                  {/* SUBTOTAL AVIAÇÃO DO EXÉRCITO */}
                  <div className="flex justify-between items-center pt-3 border-t border-border/50">
                    <span className="font-bold text-sm text-foreground">SUBTOTAL AVIAÇÃO DO EXÉRCITO</span>
                    <span className="font-bold text-lg text-purple-600">
                      {formatCurrency(totals.totalAviacaoExercito)}
                    </span>
                  </div>
                </div>
                
                {/* Total Geral (Movido para o final) */}
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-6">
                  <span className="font-bold text-base text-primary">TOTAL GERAL</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(totalGeralFinal)}
                  </span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {/* Seção de Crédito (abaixo do Accordion) */}
        <div className="px-6 pt-4 border-t border-border/50 space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-accent flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Saldo GND 3
                </h4>
                <span className={cn("font-bold text-lg", saldoGND3 >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(saldoGND3)}
                </span>
            </div>
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-accent flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Saldo GND 4
                </h4>
                <span className={cn("font-bold text-lg", saldoGND4 >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatCurrency(saldoGND4)}
                </span>
            </div>
            <Button 
                onClick={onOpenCreditDialog} 
                variant="outline" 
                className="w-full mt-3 border-accent text-accent hover:bg-accent/10"
            >
                Informar Crédito
            </Button>
        </div>
        
      </CardContent>
    </Card>
  );
};