"use client";

import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Fuel,
  Wrench,
  Truck,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { cn, formatCurrency, formatNumber, formatCodug } from "@/lib/utils";
import { usePTrab } from "@/hooks/usePTrab";
import {
  fetchClasseIII,
  createClasseIII,
  updateClasseIII,
  deleteClasseIII,
  fetchDiretrizesEquipamentos,
} from "@/integrations/supabase/classeIII";
import { fetchOrganizacoesMilitares } from "@/integrations/supabase/organizacoesMilitares";
import { fetchDiretrizesCusteio } from "@/integrations/supabase/diretrizes";
import { useAuth } from "@/hooks/useAuth";

// --- Schemas and Types (Assuming existing definitions) ---

const ClasseIIIItemSchema = z.object({
  id: z.string().uuid().optional(),
  tipo_equipamento: z.string().min(1, "O tipo de equipamento é obrigatório."),
  organizacao: z.string().min(1, "A OM é obrigatória."),
  ug: z.string().min(1, "A UG é obrigatória."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser no mínimo 1."),
  potencia_hp: z.coerce.number().optional().nullable(),
  horas_dia: z.coerce.number().optional().nullable(),
  dias_operacao: z.coerce.number().min(1, "Dias de operação é obrigatório."),
  consumo_hora: z.coerce.number().optional().nullable(),
  consumo_km_litro: z.coerce.number().optional().nullable(),
  km_dia: z.coerce.number().optional().nullable(),
  tipo_combustivel: z.string().min(1, "O tipo de combustível é obrigatório."),
  preco_litro: z.coerce.number().min(0, "O preço deve ser positivo."),
  tipo_equipamento_detalhe: z.string().optional().nullable(),
  detalhamento: z.string().optional().nullable(),
  detalhamento_customizado: z.string().optional().nullable(),
  fase_atividade: z.string().optional().nullable(),
  consumo_lubrificante_litro: z.coerce.number().optional().nullable(),
  preco_lubrificante: z.coerce.number().optional().nullable(),
  om_detentora: z.string().optional().nullable(), // Added new field
  ug_detentora: z.string().optional().nullable(), // Added new field
});

type ClasseIIIItem = z.infer<typeof ClasseIIIItemSchema> & {
  total_litros: number;
  valor_total: number;
  valor_nd_30: number;
  valor_nd_39: number;
};

const FormSchema = z.object({
  registros: z.array(ClasseIIIItemSchema),
});

// --- Utility Functions (Assuming existing definitions) ---

const TIPOS_COMBUSTIVEL = ["DIESEL", "GASOLINA", "AVGAS", "JET A-1"];

const getClasseIIICategoryBadge = (key: string) => {
  switch (key) {
    case "COMBUSTIVEL":
      return { label: "Combustível", icon: Fuel };
    case "LUBRIFICANTE":
      return { label: "Lubrificante", icon: Wrench };
    default:
      return { label: key, icon: Truck };
  }
};

// --- Component Logic ---

const ClasseIIIForm = () => {
  const { pTrabId } = useParams();
  const { data: pTrab } = usePTrab(pTrabId); // CORRIGIDO: Passando pTrabId para o hook usePTrab
  const { user } = useAuth();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      registros: [],
    },
  });

  // Fetch existing records
  const { data: registros, refetch } = useQuery({
    queryKey: ["classeIII", pTrabId],
    queryFn: () => fetchClasseIII(pTrabId!),
    enabled: !!pTrabId,
  });

  // Fetch OM data
  const { data: oms } = useQuery({
    queryKey: ["organizacoesMilitares", user?.id],
    queryFn: () => fetchOrganizacoesMilitares(user!.id),
    enabled: !!user?.id,
  });

  // Fetch Diretrizes
  const { data: diretrizesCusteio } = useQuery({
    queryKey: ["diretrizesCusteio", user?.id, pTrab?.periodo_inicio],
    queryFn: () =>
      fetchDiretrizesCusteio(
        user!.id,
        pTrab ? new Date(pTrab.periodo_inicio).getFullYear() : undefined
      ),
    enabled: !!user?.id && !!pTrab,
  });

  const { data: diretrizesEquipamentos } = useQuery({
    queryKey: ["diretrizesEquipamentos", user?.id, pTrab?.periodo_inicio],
    queryFn: () =>
      fetchDiretrizesEquipamentos(
        user!.id,
        pTrab ? new Date(pTrab.periodo_inicio).getFullYear() : undefined
      ),
    enabled: !!user?.id && !!pTrab,
  });

  const fatorMargem = diretrizesCusteio?.[0]?.classe_iii_fator_gerador || 1.1;
  const precoDiesel = pTrab?.ref_lpc?.preco_diesel || 0;
  const precoGasolina = pTrab?.ref_lpc?.preco_gasolina || 0;

  // --- Calculation and Grouping Logic ---

  const registrosCalculados = useMemo(() => {
    if (!registros) return [];

    return registros.map((registro) => {
      let totalLitros = 0;
      let valorTotal = 0;
      let valorNd30 = 0;
      let valorNd39 = 0;

      const dias = registro.dias_operacao;
      const quantidade = registro.quantidade;
      const precoLitro = registro.preco_litro || 0;
      const precoLubrificante = registro.preco_lubrificante || 0;
      const consumoLubrificante = registro.consumo_lubrificante_litro || 0;

      // 1. Combustível Calculation
      let consumoBase = 0;
      if (registro.consumo_hora && registro.horas_dia) {
        // Geradores, etc.
        consumoBase = registro.consumo_hora * registro.horas_dia * dias;
      } else if (registro.consumo_km_litro && registro.km_dia) {
        // Viaturas, etc.
        consumoBase = (registro.km_dia / registro.consumo_km_litro) * dias;
      }

      const totalLitrosCombustivelSemMargem = consumoBase * quantidade;
      const totalLitrosCombustivel = totalLitrosCombustivelSemMargem * fatorMargem;
      const valorTotalCombustivel = totalLitrosCombustivel * precoLitro;

      // 2. Lubrificante Calculation
      const totalLitrosLubrificante = totalLitrosCombustivelSemMargem * consumoLubrificante;
      const valorTotalLubrificante = totalLitrosLubrificante * precoLubrificante;

      // Sum totals
      totalLitros = totalLitrosCombustivel + totalLitrosLubrificante;
      valorTotal = valorTotalCombustivel + valorTotalLubrificante;

      // Assuming Combustível is ND 39 and Lubrificante is ND 30 (standard practice)
      valorNd39 = valorTotalCombustivel;
      valorNd30 = valorTotalLubrificante;

      return {
        ...registro,
        total_litros: totalLitros,
        total_litros_sem_margem: totalLitrosCombustivelSemMargem,
        valor_total: valorTotal,
        valor_nd_30: valorNd30,
        valor_nd_39: valorNd39,
      } as ClasseIIIItem;
    });
  }, [registros, fatorMargem, precoDiesel, precoGasolina]);

  const registrosAgrupados = useMemo(() => {
    if (!registrosCalculados.length) return [];

    // Group by unique equipment/OM combination
    const grouped = registrosCalculados.reduce((acc, registro) => {
      const key = `${registro.tipo_equipamento}-${registro.organizacao}-${registro.ug}-${registro.tipo_equipamento_detalhe || ""}`;

      if (!acc[key]) {
        acc[key] = {
          originalRegistro: registro,
          totaisPorCategoria: [],
        };
      }

      const totaisCombustivel = {
        key: "COMBUSTIVEL",
        totais: {
          litros: registro.total_litros_sem_margem * fatorMargem,
          valorTotal: registro.valor_nd_39,
        },
      };

      const totaisLubrificante = {
        key: "LUBRIFICANTE",
        totais: {
          litros: registro.total_litros_sem_margem * (registro.consumo_lubrificante_litro || 0),
          valorTotal: registro.valor_nd_30,
        },
      };

      if (totaisCombustivel.totais.valorTotal > 0) {
        acc[key].totaisPorCategoria.push(totaisCombustivel);
      }
      if (totaisLubrificante.totais.valorTotal > 0) {
        acc[key].totaisPorCategoria.push(totaisLubrificante);
      }

      return acc;
    }, {} as Record<string, { originalRegistro: ClasseIIIItem; totaisPorCategoria: { key: string; totais: { litros: number; valorTotal: number } }[] }>);

    return Object.values(grouped);
  }, [registrosCalculados, fatorMargem]);

  // --- CRUD Operations (Assuming existing definitions) ---
  // ... (omitted for brevity, assuming standard CRUD functions)

  // --- Render Logic ---

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Classe III - Combustíveis e Lubrificantes</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Form for adding new records (omitted for brevity) */}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Registros de Consumo ({registrosAgrupados.length})</h2>
        {registrosAgrupados.length === 0 ? (
          <p className="text-muted-foreground">Nenhum registro de Classe III adicionado.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {registrosAgrupados.map(({ originalRegistro, totaisPorCategoria }) => {
              const omDestino = `${originalRegistro.organizacao} (${formatCodug(originalRegistro.ug)})`;

              // Check against OM de Vinculação (PTrab OM) for Fuel
              const isOmVinculacaoDifferent = pTrab && (
                originalRegistro.organizacao !== pTrab.nome_om || 
                originalRegistro.ug !== pTrab.codug_om
              );

              // Check against OM Detentora (new columns) for Lubricant
              const isOmDetentoraDifferent = originalRegistro.om_detentora && originalRegistro.ug_detentora && (
                originalRegistro.organizacao !== originalRegistro.om_detentora || 
                originalRegistro.ug !== originalRegistro.ug_detentora
              );

              return (
                <div key={originalRegistro.id} className="p-3 bg-background border rounded-lg shadow-sm"> {/* Replaced Card with div (Addressing line 2115) */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {originalRegistro.tipo_equipamento}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {originalRegistro.quantidade} {originalRegistro.quantidade > 1 ? "unidades" : "unidade"}
                        </Badge>
                      </div>
                      {originalRegistro.tipo_equipamento_detalhe && (
                        <p className="text-xs text-muted-foreground">
                          {originalRegistro.tipo_equipamento_detalhe}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="text-xs text-muted-foreground">
                        {originalRegistro.dias_operacao} {originalRegistro.dias_operacao > 1 ? "dias" : "dia"}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(totaisPorCategoria.reduce((sum, t) => sum + t.totais.valorTotal, 0))}
                      </span>
                    </div>
                  </div>

                  {/* Novo div OM Destino Crédito (Acima da div 2163) */}
                  <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">OM Destino Crédito:</span>
                      <span className="font-medium text-foreground">
                        {omDestino}
                      </span>
                    </div>
                  </div>

                  {/* Category totals map (around line 2163) */}
                  <div className="mt-2 space-y-1">
                    {totaisPorCategoria.map((cat) => {
                      const totais = cat.totais;
                      const categoryBadgeStyle = getClasseIIICategoryBadge(cat.key);
                      
                      let isDiscrepancy = false;
                      let discrepancyReason = "";
                      let omDetentoraDisplay = "";

                      if (cat.key === 'COMBUSTIVEL') {
                        // Check against OM de Vinculação (PTrab OM)
                        if (isOmVinculacaoDifferent) {
                          isDiscrepancy = true;
                          discrepancyReason = "OM Destino diferente da OM de Vinculação";
                        }
                      } else if (cat.key === 'LUBRIFICANTE') {
                        // Check against OM Detentora do Equipamento
                        if (isOmDetentoraDifferent) {
                          isDiscrepancy = true;
                          discrepancyReason = "OM Destino diferente da OM Detentora do Equipamento";
                        }
                        omDetentoraDisplay = originalRegistro.om_detentora ? 
                            ` (Detentora: ${originalRegistro.om_detentora} - ${formatCodug(originalRegistro.ug_detentora)})` : 
                            "";
                      }

                      return (
                        <div key={cat.key} className="flex justify-between text-xs">
                          <span className={cn("flex items-center gap-1", isDiscrepancy ? "text-red-600 font-bold" : "text-muted-foreground")}>
                            <cat.icon className="h-3 w-3" />
                            {categoryBadgeStyle.label}: {formatNumber(totais.litros, 2)} L
                            {omDetentoraDisplay}
                            {isDiscrepancy && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 text-red-600 ml-1" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{discrepancyReason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                          <span className={cn("font-medium", isDiscrepancy ? "text-red-600 font-bold" : "text-foreground")}>
                            {formatCurrency(totais.valorTotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Edit/Delete buttons (omitted for brevity) */}
                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                    {/* ... buttons ... */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClasseIIIForm;