import React, { useState, useRef } from 'react'; // Adicionado useState e useRef
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Importar CardDescription
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Package, Briefcase, Fuel, Utensils, Loader2, ChevronDown, HardHat, Plane, TrendingUp, Droplet, ClipboardList } from "lucide-react"; // Importar Droplet e ClipboardList
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button"; // Importar Button
// Removendo Tooltip components

interface PTrabCostSummaryProps {
  ptrabId: string;
  onOpenCreditDialog: () => void; // Novo prop para abrir o diálogo
  creditGND3: number;
  creditGND4: number;
}

// Define the structure of the item from ClasseIIForm for local use
interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
}

interface DetailedItemClasseII extends ItemClasseII {
  parent_dias_operacao: number;
  parent_organizacao: string;
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
  
  // 2. Fetch Classe II totals (33.90.30 e 33.90.39)
  const { data: classeIIData, error: classeIIError } = await supabase
    .from('classe_ii_registros')
    .select('valor_total, itens_equipamentos, dias_operacao, organizacao, valor_nd_30, valor_nd_39') // ADD valor_nd_30, valor_nd_39
    .eq('p_trab_id', ptrabId);

  if (classeIIError) throw classeIIError;
  
  let totalClasseII = 0;
  let totalClasseII_ND30 = 0;
  let totalClasseII_ND39 = 0;
  let totalItensClasseII = 0;
  let allClasseIIItems: DetailedItemClasseII[] = []; // Array to hold all individual items
  
  (classeIIData || []).forEach(record => {
    totalClasseII += record.valor_total;
    totalClasseII_ND30 += Number(record.valor_nd_30);
    totalClasseII_ND39 += Number(record.valor_nd_39);
    
    // Sum the quantity of items and flatten the list
    if (Array.isArray(record.itens_equipamentos)) {
      const items = record.itens_equipamentos as ItemClasseII[];
      totalItensClasseII += items.reduce((sum, item) => sum + (item.quantidade || 0), 0);
      
      const detailedItems: DetailedItemClasseII[] = items.map(item => ({
        ...item,
        parent_dias_operacao: record.dias_operacao,
        parent_organizacao: record.organizacao,
      }));
      allClasseIIItems = allClasseIIItems.concat(detailedItems); // Flatten the items
    }
  });


  // 3. Fetch Classe III totals (Combustível e Lubrificante)
  const { data: classeIIIData, error: classeIIIError } = await supabase
    .from('classe_iii_registros')
    .select('valor_total, tipo_combustivel, total_litros, tipo_equipamento')
    .eq('p_trab_id', ptrabId);

  if (classeIIIError) throw classeIIIError;

  // Combustível (ND 33.90.30)
  const combustivelRecords = (classeIIIData || []).filter(r => 
    r.tipo_equipamento !== 'LUBRIFICANTE_GERADOR' && r.tipo_equipamento !== 'LUBRIFICANTE_EMBARCACAO'
  );
  
  // Lubrificante (ND 33.90.30)
  const lubrificanteRecords = (classeIIIData || []).filter(r => 
    r.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || r.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO'
  );

  // Totais de Combustível (ND 33.90.30)
  const totalDieselValor = combustivelRecords
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + record.valor_total, 0);
    
  const totalGasolinaValor = combustivelRecords
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + record.valor_total, 0);
    
  const totalDieselLitros = combustivelRecords
    .filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD')
    .reduce((sum, record) => sum + record.total_litros, 0);
    
  const totalGasolinaLitros = combustivelRecords
    .filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS')
    .reduce((sum, record) => sum + record.total_litros, 0);

  const totalCombustivel = totalDieselValor + totalGasolinaValor;
  
  // Totais de Lubrificante (ND 33.90.30)
  const totalLubrificanteValor = lubrificanteRecords
    .reduce((sum, record) => sum + record.valor_total, 0);
    
  const totalLubrificanteLitros = lubrificanteRecords
    .reduce((sum, record) => sum + record.total_litros, 0);

  // O total logístico para o PTrab é a soma da Classe I (ND 30) + Classe II (ND 30 + ND 39) + Classe III (Combustível + Lubrificante)
  // Todos os itens de Classe I, Classe II (Material e Serviço) e Classe III (Combustível e Lubrificante) são GND 3.
  const totalLogisticoGeral = totalClasseI + totalClasseII + totalCombustivel + totalLubrificanteValor;
  
  // Novos totais (placeholders)
  const totalMaterialPermanente = 0;
  const totalAviacaoExercito = 0;
  
  // Total Operacional (Placeholder)
  const totalOperacional = 0;

  return {
    totalLogisticoGeral,
    totalOperacional,
    totalClasseI,
    totalClasseII,
    totalClasseII_ND30, // NEW
    totalClasseII_ND39, // NEW
    totalItensClasseII,
    allClasseIIItems, // NEW: Return the list of individual items
    totalComplemento,
    totalEtapaSolicitadaValor,
    totalDiasEtapaSolicitada,
    totalRefeicoesIntermediarias,
    totalDieselValor,
    totalGasolinaValor,
    totalDieselLitros,
    totalGasolinaLitros,
    totalLubrificanteValor,
    totalLubrificanteLitros,
    totalCombustivel,
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
    initialData: {
      totalLogisticoGeral: 0,
      totalOperacional: 0,
      totalClasseI: 0,
      totalClasseII: 0,
      totalClasseII_ND30: 0, // Initialize new field
      totalClasseII_ND39: 0, // Initialize new field
      totalItensClasseII: 0,
      allClasseIIItems: [], // Initialize new field
      totalComplemento: 0,
      totalEtapaSolicitadaValor: 0,
      totalDiasEtapaSolicitada: 0,
      totalRefeicoesIntermediarias: 0,
      totalDieselValor: 0,
      totalGasolinaValor: 0,
      totalDieselLitros: 0,
      totalGasolinaLitros: 0,
      totalLubrificanteValor: 0,
      totalLubrificanteLitros: 0,
      totalCombustivel: 0,
      totalMaterialPermanente: 0,
      totalAviacaoExercito: 0,
    },
  });
  
  // Estado e Ref para controlar o acordeão e a rolagem
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const handleSummaryClick = () => {
    // Alterna o estado de abertura
    const newState = !isDetailsOpen;
    setIsDetailsOpen(newState);
    
    // Se estiver abrindo, rola para o início dos detalhes
    if (newState) {
      setTimeout(() => {
          detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); 
    }
  };


  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="py-3">
          <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Calculando...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg border-destructive">
        <CardHeader className="py-3">
          <CardTitle className="text-xl font-bold text-destructive">Erro no Cálculo</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
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
  
  // --- NOVA LÓGICA DE AGRUPAMENTO CLASSE II ---
  const groupedClasseIIItems = totals.allClasseIIItems.reduce((acc, item) => {
    const key = item.item;
    const itemTotal = item.quantidade * item.valor_mnt_dia * item.parent_dias_operacao;
    
    if (!acc[key]) {
      acc[key] = {
        item: item.item,
        totalQuantidade: 0,
        totalValor: 0,
      };
    }
    
    acc[key].totalQuantidade += item.quantidade;
    acc[key].totalValor += itemTotal;
    
    return acc;
  }, {} as Record<string, { item: string, totalQuantidade: number, totalValor: number }>);
  
  const sortedGroupedClasseIIItems = Object.values(groupedClasseIIItems).sort((a, b) => a.item.localeCompare(b.item));
  // --- FIM NOVA LÓGICA DE AGRUPAMENTO CLASSE II ---

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2 pt-3"> {/* Reduzido padding vertical */}
        <CardTitle className="text-xl font-bold">Resumo de Custos</CardTitle>
        <CardDescription className="text-xs">
          Visão consolidada dos custos logísticos e orçamentários.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-3"> {/* Reduzido padding vertical */}
        
        {/* Resumo de Custos (sempre visível) */}
        <div className="w-full space-y-1 text-sm px-6 pt-1">
            <div className="flex justify-between text-orange-600 cursor-pointer" onClick={handleSummaryClick}>
              <span className="font-semibold text-sm">Aba Logística</span>
              <span className="font-bold text-sm">{formatCurrency(totals.totalLogisticoGeral)}</span>
            </div>
            <div className="flex justify-between text-blue-600 cursor-pointer" onClick={handleSummaryClick}>
              <span className="font-semibold text-sm">Aba Operacional</span>
              <span className="font-bold text-sm">{formatCurrency(totals.totalOperacional)}</span>
            </div>
            <div className="flex justify-between text-green-600 cursor-pointer" onClick={handleSummaryClick}>
              <span className="font-semibold text-sm">Aba Material Permanente</span>
              <span className="font-bold text-sm">{formatCurrency(totals.totalMaterialPermanente)}</span>
            </div>
            <div className="flex justify-between text-purple-600 cursor-pointer" onClick={handleSummaryClick}>
              <span className="font-semibold text-sm">Aba Aviação do Exército</span>
              <span className="font-bold text-sm">{formatCurrency(totals.totalAviacaoExercito)}</span>
            </div>
            <div className="flex justify-between text-foreground font-bold border-t border-border/50 pt-1">
              <span className="text-base">Total Geral</span>
              <span className="text-lg">{formatCurrency(totalGeralFinal)}</span>
            </div>
        </div>
        
        <Accordion 
          type="single" 
          collapsible 
          className="w-full px-6 pt-0" // Ajustado pt-0 para diminuir a distância
          value={isDetailsOpen ? "summary-details" : undefined}
          onValueChange={(value) => setIsDetailsOpen(value === "summary-details")}
        >
          <AccordionItem value="summary-details" className="border-b-0">
            
            {/* Accordion Trigger Principal: Contém o indicador de detalhes */}
            <AccordionTrigger 
              className="py-1 px-0 hover:no-underline flex items-center justify-center w-full text-xs text-muted-foreground" // REMOVIDO border-t e mt-1
              onClick={(e) => {
                // Previne que o clique no trigger duplique a ação do handleSummaryClick
                e.preventDefault(); 
                handleSummaryClick();
              }}
            >
              <span className="font-semibold text-primary">
                {isDetailsOpen ? "MENOS DETALHES" : "MAIS DETALHES"}
              </span>
            </AccordionTrigger>
            
            <AccordionContent className="pt-2 pb-0"> {/* Ajustado pt-2 para dar um pequeno espaço */}
              <div className="space-y-4" ref={detailsRef}>
                
                {/* Aba Logística */}
                <div className="space-y-3 border-l-4 border-orange-500 pl-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 mb-2">
                    <Package className="h-3 w-3" />
                    Logística ({formatCurrency(totals.totalLogisticoGeral)})
                  </div>
                  
                  {/* Classe I - Subsistência */}
                  <Accordion type="single" collapsible className="w-full pt-0">
                    <AccordionItem value="item-classe-i" className="border-b-0">
                      <AccordionTrigger simple className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Utensils className="h-3 w-3 text-orange-500" />
                            Classe I
                          </div>
                          <span className={cn(valueClasses, "mr-6 text-xs")}>
                            {formatCurrency(totals.totalClasseI)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhe 1: Valor Complemento */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className={descriptionClasses}>Complemento (Ref. Int.)</span>
                            <span className={quantityClasses}>
                              {formatNumber(totals.totalRefeicoesIntermediarias)}
                            </span>
                            <span className={cn(valueClasses, "mr-6")}>
                              {formatCurrency(totals.totalComplemento)}
                            </span>
                          </div>
                          {/* Detalhe 2: Valor Etapa Solicitada */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className={descriptionClasses}>Etapa Solicitada</span>
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
                  
                  {/* Classe II - Material de Intendência */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-ii" className="border-b-0">
                      <AccordionTrigger simple className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <ClipboardList className="h-3 w-3 text-orange-500" />
                            Classe II
                          </div>
                          <span className={cn(valueClasses, "mr-6 text-xs")}>
                            {formatCurrency(totals.totalClasseII)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
                          {/* Detalhe ND 30 */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className={descriptionClasses}>ND 33.90.30 (Material)</span>
                            <span className={quantityClasses}>
                              {/* Vazio */}
                            </span>
                            <span className={cn(valueClasses, "mr-6 text-green-600")}>
                              {formatCurrency(totals.totalClasseII_ND30)}
                            </span>
                          </div>
                          {/* Detalhe ND 39 */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className={descriptionClasses}>ND 33.90.39 (Serviço)</span>
                            <span className={quantityClasses}>
                              {/* Vazio */}
                            </span>
                            <span className={cn(valueClasses, "mr-6 text-blue-600")}>
                              {formatCurrency(totals.totalClasseII_ND39)}
                            </span>
                          </div>
                          {/* Detalhe Total Itens */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className={descriptionClasses}>Total Itens</span>
                            <span className={quantityClasses}>
                              {formatNumber(totals.totalItensClasseII)} un.
                            </span>
                            <span className={cn(valueClasses, "mr-6")}>
                              {/* Vazio */}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Classe III - Combustíveis e Lubrificantes */}
                  <Accordion type="single" collapsible className="w-full pt-1">
                    <AccordionItem value="item-classe-iii" className="border-b-0">
                      <AccordionTrigger simple className="p-0 hover:no-underline">
                        <div className="flex justify-between items-center w-full text-xs border-b pb-1 border-border/50">
                          <div className="flex items-center gap-1 text-foreground">
                            <Fuel className="h-3 w-3 text-orange-500" />
                            Classe III
                          </div>
                          <span className={cn(valueClasses, "mr-6 text-xs")}>
                            {formatCurrency(totals.totalCombustivel + totals.totalLubrificanteValor)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-0">
                        <div className="space-y-1 pl-4 text-[10px]">
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
                          {/* Linha Lubrificante */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className={descriptionClasses}>Lubrificante</span>
                            <span className={quantityClasses}>
                              {formatNumber(totals.totalLubrificanteLitros, 2)} L
                            </span>
                            <span className={cn(valueClasses, "mr-6")}>
                              {formatCurrency(totals.totalLubrificanteValor)}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Outras Abas Logísticas (Placeholder) */}
                  <div className="flex justify-between text-xs text-muted-foreground pt-2">
                    <span>Outras Classes (IV a X)</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(0)}
                    </span>
                  </div>
                </div>

                {/* Aba Operacional (Placeholder) */}
                <div className="space-y-3 border-l-4 border-blue-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                    <Briefcase className="h-3 w-3" />
                    Operacional ({formatCurrency(totals.totalOperacional)})
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Itens Operacionais</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalOperacional)}
                    </span>
                  </div>
                </div>
                
                {/* Aba Material Permanente (Placeholder) */}
                <div className="space-y-3 border-l-4 border-green-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                    <HardHat className="h-3 w-3" />
                    Material Permanente ({formatCurrency(totals.totalMaterialPermanente)})
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Itens de Material Permanente</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalMaterialPermanente)}
                    </span>
                  </div>
                </div>
                
                {/* Aba Aviação do Exército (Placeholder) */}
                <div className="space-y-3 border-l-4 border-purple-500 pl-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-600">
                    <Plane className="h-3 w-3" />
                    Aviação do Exército ({formatCurrency(totals.totalAviacaoExercito)})
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Itens de Aviação</span>
                    <span className={cn(valueClasses, "mr-6")}>
                      {formatCurrency(totals.totalAviacaoExercito)}
                    </span>
                  </div>
                </div>
                
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {/* Seção de Crédito (abaixo do Accordion) */}
        <div className="px-6 pt-3 border-t border-border/50 space-y-2"> {/* Reduzido padding vertical */}
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
                className="w-full mt-2 border-accent text-accent hover:bg-accent/10 h-8 text-sm" // Reduzido altura do botão
            >
                Informar Crédito
            </Button>
        </div>
        
      </CardContent>
    </Card>
  );
};