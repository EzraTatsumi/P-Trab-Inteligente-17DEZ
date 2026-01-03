"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, DollarSign, RefreshCw, Checkbox as CheckboxIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useDiretrizesOperacionais } from "@/hooks/useDiretrizesOperacionais";
import { formatCurrency, formatCodug, numberToRawDigits, formatCurrencyInput, calculateDays, formatNumber } from "@/lib/formatUtils";
import { usePTrabData } from "@/hooks/usePTrabData";
import { useDiariaRegistros } from "@/hooks/useDiariaRegistros";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { OMData } from "@/lib/omUtils";
import { DiariaRegistro } from "@/types/diaria";
import { useSession } from "@/components/SessionContextProvider";
import { OmSelector } from "@/components/OmSelector";

// --- Constants ---

const POSTO_GRADUACAO_OPTIONS = [
    "Of Gen", "Of Sup", "Of Int/Sub/Asp Of/ST/Sgt", "Demais Praças"
] as const;

const DESTINO_OPTIONS = [
    "BSB/MAO/RJ/SP", "Demais Capitais", "Demais Dslc"
] as const;

const FASE_ATIVIDADE_OPTIONS = [
    "Mobilização", "Execução", "Desmobilização", "Reconhecimento"
] as const;

const RANK_CONFIG = [
    { key: 'of_gen', label: 'Of Gen' },
    { key: 'of_sup', label: 'Of Sup' },
    { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt' },
    { key: 'demais_pracas', label: 'Demais Praças' },
] as const;

// Default Diária values (fallback if no diretrizes are loaded)
const DEFAULT_DIARIA_VALUES = {
    diaria_referencia_legal: 'Decreto Nº 12.324 de 19DEZ24',
    taxa_embarque: 95.00,
    diaria_of_gen_bsb: 600.00,
    diaria_of_gen_capitais: 515.00,
    diaria_of_gen_demais: 455.00,
    diaria_of_sup_bsb: 510.00,
    diaria_of_sup_capitais: 450.00,
    diaria_of_sup_demais: 395.00,
    diaria_of_int_sgt_bsb: 425.00,
    diaria_of_int_sgt_capitais: 380.00,
    diaria_of_int_sgt_demais: 335.00,
    diaria_demais_pracas_bsb: 355.00,
    diaria_demais_pracas_capitais: 315.00,
    diaria_demais_pracas_demais: 280.00,
};

// --- Schemas ---

const QuantitySchema = z.object({
    posto_graduacao: z.enum(POSTO_GRADUACAO_OPTIONS),
    qtd: z.number().int().min(0),
});

const DiariaRequestSchema = z.object({
    // Global parameters for the trip
    nr_dias_viagem: z.number().int().min(1, "Dias de viagem é obrigatório."),
    local_pagamento: z.enum(DESTINO_OPTIONS, { required_error: "Local de pagamento é obrigatório." }),
    nr_viagens: z.number().int().min(1, "Número de viagens é obrigatório."),
    local_atividade: z.string().min(1, "Local da atividade é obrigatório."),
    
    // OM Detentora (Source)
    om_detentora: z.string().min(1, "OM Detentora é obrigatória."),
    ug_detentora: z.string().min(1, "UG Detentora é obrigatória."),
    
    // OM de Destino (Recurso) - Fixed by PTrab
    organizacao: z.string(),
    ug: z.string(),
    
    // Quantities per rank
    quantities: z.array(QuantitySchema).refine(arr => arr.some(q => q.qtd > 0), {
        message: "Pelo menos um militar deve ser incluído.",
        path: ['quantities'],
    }),
    
    fase_atividade: z.string().optional(),
    
    // Hidden fields for ND allocation (always 33.90.15 for Diárias)
    raw_valor_nd_15: z.string().optional(),
});

type DiariaRequestFormValues = z.infer<typeof DiariaRequestSchema>;

// --- Component ---

const DiariaForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const p_trab_id = searchParams.get('ptrabId');
    
    const { user, loading: isLoadingSession } = useSession();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [customMemoria, setCustomMemoria] = useState<string>("");
    const [isCustomMemoriaActive, setIsCustomMemoriaActive] = useState(false);
    
    const [selectedOmDetentoraId, setSelectedOmDetentoraId] = useState<string | undefined>(undefined);
    
    // Hooks de Dados
    const { data: pTrabData, isLoading: isLoadingPTrab } = usePTrabData(p_trab_id);
    const { data: omList } = useMilitaryOrganizations();
    const { data: diretrizesOp, isLoading: isLoadingDiretrizes } = useDiretrizesOperacionais(user?.id); 
    const { data: registros, isLoading: isLoadingRegistros, refetch: refetchRegistros } = useDiariaRegistros(p_trab_id);
    
    // Memo para a OM de Destino (OM do PTrab)
    const omDestinoPTrab = useMemo(() => {
        if (!pTrabData) return null;
        
        return {
            id: 'ptrab-om',
            nome_om: pTrabData.nome_om,
            codug_om: pTrabData.codug_om || '000000',
            rm_vinculacao: pTrabData.rm_vinculacao || '',
            codug_rm_vinculacao: pTrabData.codug_rm_vinculacao || '000000',
            cidade: pTrabData.local_om || '',
            ativo: true,
            user_id: user?.id || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as OMData;
    }, [pTrabData, user?.id]);
    
    // Memo para as diretrizes de diária
    const diariaDiretrizes = useMemo(() => {
        const source = diretrizesOp || DEFAULT_DIARIA_VALUES; 
        
        const map: Record<string, Record<string, number>> = {};
        
        const ranks = [
            { key: 'Of Gen', bsb: source.diaria_of_gen_bsb, capitais: source.diaria_of_gen_capitais, demais: source.diaria_of_gen_demais },
            { key: 'Of Sup', bsb: source.diaria_of_sup_bsb, capitais: source.diaria_of_sup_capitais, demais: source.diaria_of_sup_demais },
            { key: 'Of Int/Sub/Asp Of/ST/Sgt', bsb: source.diaria_of_int_sgt_bsb, capitais: source.diaria_of_int_sgt_capitais, demais: source.diaria_of_int_sgt_demais },
            { key: 'Demais Praças', bsb: source.diaria_demais_pracas_bsb, capitais: source.diaria_demais_pracas_capitais, demais: source.diaria_demais_pracas_demais },
        ];
        
        ranks.forEach(rank => {
            map[rank.key] = {
                'BSB/MAO/RJ/SP': Number(rank.bsb),
                'Demais Capitais': Number(rank.capitais),
                'Demais Dslc': Number(rank.demais),
            };
        });
        
        return {
            values: map,
            taxaEmbarque: Number(source.taxa_embarque || 0),
            referenciaLegal: source.diaria_referencia_legal || 'Não Informada',
        };
    }, [diretrizesOp]);

    // --- Data Aggregation and Initialization ---

    const aggregatedRequest = useMemo(() => {
        const defaultDias = pTrabData ? calculateDays(pTrabData.periodo_inicio, pTrabData.periodo_fim) : 1;
        
        if (!registros || registros.length === 0) {
            return {
                nr_dias_viagem: defaultDias,
                local_pagamento: DESTINO_OPTIONS[1], // Default to Demais Capitais
                nr_viagens: 1,
                local_atividade: pTrabData?.local_om || "",
                om_detentora: omDestinoPTrab?.nome_om || "",
                ug_detentora: omDestinoPTrab?.codug_om || "",
                fase_atividade: FASE_ATIVIDADE_OPTIONS[0],
                quantities: RANK_CONFIG.map(r => ({ posto_graduacao: r.label as DiariaRequestFormValues['quantities'][number]['posto_graduacao'], qtd: 0 })),
                valor_nd_15: 0,
            };
        }
        
        // Use the parameters from the most recent record (or the first one)
        const baseRecord = registros[0];
        
        // Aggregate quantities (use quantities_por_posto if available, otherwise aggregate individual rows)
        let quantities: DiariaRequestFormValues['quantities'];
        
        if (baseRecord.quantidades_por_posto && baseRecord.quantidades_por_posto.length > 0) {
            quantities = baseRecord.quantidades_por_posto.map(q => ({
                posto_graduacao: q.posto_graduacao as DiariaRequestFormValues['quantities'][number]['posto_graduacao'],
                qtd: q.qtd,
            }));
        } else {
            // Fallback: Aggregate quantities from individual rows
            const quantitiesMap = new Map<string, number>();
            registros.forEach(r => {
                const currentQtd = quantitiesMap.get(r.posto_graduacao) || 0;
                quantitiesMap.set(r.posto_graduacao, currentQtd + r.quantidade);
            });
            
            quantities = RANK_CONFIG.map(r => ({
                posto_graduacao: r.label as DiariaRequestFormValues['quantities'][number]['posto_graduacao'],
                qtd: quantitiesMap.get(r.label) || 0,
            }));
        }
        
        // Calculate total ND 15 (sum of all valor_total)
        const totalND15 = registros.reduce((sum, r) => sum + r.valor_total, 0);
        
        // Use custom memory if the base record has it
        if (baseRecord.detalhamento_customizado) {
            setCustomMemoria(baseRecord.detalhamento_customizado);
            setIsCustomMemoriaActive(true);
        } else {
            setCustomMemoria("");
            setIsCustomMemoriaActive(false);
        }

        return {
            nr_dias_viagem: baseRecord.dias_operacao,
            local_pagamento: baseRecord.destino as DiariaRequestFormValues['local_pagamento'],
            nr_viagens: baseRecord.nr_viagens || 1,
            local_atividade: baseRecord.local_atividade || pTrabData?.local_om || "",
            om_detentora: baseRecord.om_detentora || omDestinoPTrab?.nome_om || "",
            ug_detentora: baseRecord.ug_detentora || omDestinoPTrab?.codug_om || "",
            fase_atividade: baseRecord.fase_atividade || FASE_ATIVIDADE_OPTIONS[0],
            quantities,
            valor_nd_15: totalND15,
        };
    }, [registros, pTrabData, omDestinoPTrab]);

    // --- Form Setup ---
    const methods = useForm<DiariaRequestFormValues>({
        resolver: zodResolver(DiariaRequestSchema),
        defaultValues: {
            organizacao: omDestinoPTrab?.nome_om || "",
            ug: omDestinoPTrab?.codug_om || "",
            ...aggregatedRequest,
            raw_valor_nd_15: numberToRawDigits(aggregatedRequest.valor_nd_15),
        },
    });
    const { register, handleSubmit, watch, setValue, reset: resetForm, control, formState: { errors, isSubmitting } } = methods;
    const { fields: quantityFields, replace: replaceQuantities } = useFieldArray({
        control,
        name: "quantities",
    });

    // Initialize quantities if they haven't been loaded yet
    useEffect(() => {
        if (aggregatedRequest.quantities.length > 0 && quantityFields.length === 0) {
            replaceQuantities(aggregatedRequest.quantities);
        }
    }, [aggregatedRequest.quantities, quantityFields.length, replaceQuantities]);

    const watchedFields = watch();

    // --- Calculation Logic ---

    const calculateDiariaTotals = useMemo(() => {
        const nrDiasViagem = watchedFields.nr_dias_viagem || 0;
        const localPagamento = watchedFields.local_pagamento;
        const nrViagens = watchedFields.nr_viagens || 0;
        const quantities = watchedFields.quantities || [];
        const taxaEmbarque = diariaDiretrizes.taxaEmbarque;
        
        let totalDiaria = 0;
        let totalMilitares = 0;
        
        const rankCalculations: { rank: string, qtd: number, valorDia: number, total: number }[] = [];
        
        if (nrDiasViagem > 0 && nrViagens > 0 && localPagamento) {
            const diasPagos = Math.max(0, nrDiasViagem - 0.5); // (Nr dias de operação - 0.5 dia)
            
            quantities.forEach(q => {
                const rankLabel = q.posto_graduacao;
                const qtd = q.qtd;
                
                if (qtd > 0) {
                    totalMilitares += qtd;
                    
                    const valorDia = diariaDiretrizes.values[rankLabel]?.[localPagamento] || 0;
                    
                    // Fórmula: (Qtd x Custo/dia/localidade) x diasPagos x Nr Viagens
                    const subtotal = qtd * valorDia * diasPagos * nrViagens;
                    totalDiaria += subtotal;
                    
                    rankCalculations.push({
                        rank: rankLabel,
                        qtd: qtd,
                        valorDia: valorDia,
                        total: subtotal,
                    });
                }
            });
        }
        
        // Taxa Emb Total: Qtd total x Taxa Emb x Nr Viagens
        const totalTaxaEmbarque = totalMilitares * taxaEmbarque * nrViagens;
        
        const totalGeral = totalDiaria + totalTaxaEmbarque;
        
        // ND Allocation: Diárias are ND 33.90.15
        const nd15 = totalGeral;
        
        return {
            totalDiaria,
            totalTaxaEmbarque,
            totalGeral,
            nd15,
            totalMilitares,
            rankCalculations,
        };
    }, [watchedFields.nr_dias_viagem, watchedFields.local_pagamento, watchedFields.nr_viagens, watchedFields.quantities, diariaDiretrizes]);

    // Desestruturando os totais calculados
    const { totalDiaria, totalTaxaEmbarque, totalGeral, nd15, totalMilitares, rankCalculations } = calculateDiariaTotals;

    // --- Memória de Cálculo ---

    const generateMemoriaCalculo = (
        data: DiariaRequestFormValues, 
        totals: ReturnType<typeof calculateDiariaTotals>
    ): string => {
        const { nr_dias_viagem, local_pagamento, nr_viagens, local_atividade, om_detentora } = data;
        const { totalDiaria, totalTaxaEmbarque, totalGeral, rankCalculations, totalMilitares } = totals;
        
        const omArticle = om_detentora.includes('ª') ? 'da' : 'do';
        const militarPlural = totalMilitares === 1 ? 'militar' : 'militares';
        const diaPlural = nr_dias_viagem === 1 ? 'dia' : 'dias';
        const viagemPlural = nr_viagens === 1 ? 'viagem' : 'viagens';
        
        // 1. Cabeçalho
        const header = `33.90.15 - Custeio com Diárias de ${totalMilitares} ${militarPlural} ${omArticle} ${om_detentora}, para ${nr_viagens} ${viagemPlural} com duração de ${nr_dias_viagem} ${diaPlural} em ${local_atividade}.`;
        
        // 2. Detalhes da Referência
        const referenciaLegal = diariaDiretrizes.referenciaLegal || 'Não Informada';
        const taxaEmbarque = diariaDiretrizes.taxaEmbarque;
        
        let detalhesReferencia = `
Cálculo, segundo ${referenciaLegal}:
- Para ${local_pagamento} considera-se: 
   - Nr de Viagens planejadas: ${nr_viagens}.
   - Valor Tarifa de Embarque e Desembarque: ${formatCurrency(taxaEmbarque)}/pessoa.
`;
        
        // Adicionar valores diários por posto/graduação
        rankCalculations.forEach(calc => {
            detalhesReferencia += `   - ${calc.rank} ${formatCurrency(calc.valorDia)} / dia Op.\n`;
        });
        
        // 3. Fórmulas e Cálculos
        let calculoDiarias = `
Fórmula: (Nr militares x Custo/dia/localidade) x (Nr dias de operação - 0,5 dia) x Nr Viagens.
`;
        
        rankCalculations.forEach(calc => {
            const diasPagos = Math.max(0, nr_dias_viagem - 0.5);
            calculoDiarias += `- (${calc.qtd} ${calc.rank} x ${formatCurrency(calc.valorDia)}/dia) x ${formatNumber(diasPagos, 1)} dias x ${nr_viagens} ${viagemPlural} = ${formatCurrency(calc.total)}.\n`;
        });
        
        // 4. Totais
        const totalDiariaFormatado = formatCurrency(totalDiaria);
        const totalTaxaEmbFormatado = formatCurrency(totalTaxaEmbarque);
        const totalGeralFormatado = formatCurrency(totalGeral);
        
        const totalSection = `
Total Diária: ${totalDiariaFormatado}.
Total Taxa Emb: ${totalTaxaEmbFormatado}.

Total: ${totalDiariaFormatado} + ${totalTaxaEmbFormatado} = ${totalGeralFormatado}.
`;

        return `${header}\n\n${detalhesReferencia.trim()}\n\n${calculoDiarias.trim()}\n\n${totalSection.trim()}`;
    };

    // Memória de cálculo em tempo real
    const liveMemoria = useMemo(() => {
        if (isCustomMemoriaActive) return customMemoria;
        
        const currentData = {
            ...watchedFields,
            quantities: watchedFields.quantities || [],
        } as DiariaRequestFormValues;
        
        return generateMemoriaCalculo(currentData, calculateDiariaTotals);
    }, [watchedFields, calculateDiariaTotals, isCustomMemoriaActive, customMemoria, diariaDiretrizes]);

    // --- CRUD Operations ---

    const handleSaveRequest = async (data: DiariaRequestFormValues) => {
        if (!p_trab_id) return;
        
        if (totalGeral <= 0) {
            toast.error("O valor total da diária deve ser maior que zero.");
            return;
        }
        
        // 1. Preparar payload para o Supabase (múltiplas inserções)
        const recordsToInsert: TablesInsert<'diaria_registros'>[] = [];
        
        const memoriaFinal = isCustomMemoriaActive ? customMemoria : generateMemoriaCalculo(data, calculateDiariaTotals);
        const detalhamentoCustomizado = isCustomMemoriaActive ? customMemoria : null;
        
        rankCalculations.forEach(calc => {
            if (calc.qtd > 0) {
                const taxaEmbarqueUnitario = diariaDiretrizes.taxaEmbarque;
                const totalTaxaEmbarqueRank = calc.qtd * taxaEmbarqueUnitario * data.nr_viagens;
                const valorTotalRank = calc.total + totalTaxaEmbarqueRank;
                
                const payload: TablesInsert<'diaria_registros'> = {
                    p_trab_id: p_trab_id,
                    organizacao: data.organizacao,
                    ug: data.ug,
                    om_detentora: data.om_detentora,
                    ug_detentora: data.ug_detentora,
                    dias_operacao: data.nr_dias_viagem,
                    fase_atividade: data.fase_atividade,
                    posto_graduacao: calc.rank,
                    destino: data.local_pagamento,
                    quantidade: calc.qtd,
                    valor_diaria_unitario: calc.valorDia,
                    valor_taxa_embarque: taxaEmbarqueUnitario,
                    valor_total: valorTotalRank,
                    valor_nd_30: valorTotalRank, // ND 33.90.15 é GND 3, mas usaremos ND 30 para totalização no relatório logístico
                    valor_nd_39: 0,
                    nr_viagens: data.nr_viagens,
                    local_atividade: data.local_atividade,
                    quantidades_por_posto: data.quantities,
                    
                    detalhamento: memoriaFinal,
                    detalhamento_customizado: detalhamentoCustomizado,
                };
                recordsToInsert.push(payload);
            }
        });
        
        try {
            // 3. Deletar todos os registros existentes para este PTrab (Simplificação)
            const { error: deleteError } = await supabase
                .from('diaria_registros')
                .delete()
                .eq('p_trab_id', p_trab_id);
            
            if (deleteError) throw deleteError;
            
            // 4. Inserir os novos registros
            if (recordsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('diaria_registros')
                    .insert(recordsToInsert);
                if (insertError) throw insertError;
            }
            
            toast.success("Registros de Diária salvos com sucesso!");
            
            refetchRegistros();
            
        } catch (error: any) {
            toast.error(sanitizeError(error));
        }
    };

    const resetFormToAggregated = useCallback(() => {
        // Reset form to the aggregated state (which reflects the current DB state)
        resetForm({
            organizacao: omDestinoPTrab?.nome_om || "",
            ug: omDestinoPTrab?.codug_om || "",
            ...aggregatedRequest,
            raw_valor_nd_15: numberToRawDigits(aggregatedRequest.valor_nd_15),
        });
        
        // Update OmSelector state
        const omDetentora = omList?.find(om => om.nome_om === aggregatedRequest.om_detentora);
        setSelectedOmDetentoraId(omDetentora?.id || 'temp');
        
        // Reset custom memory state
        if (aggregatedRequest.valor_nd_15 === 0) {
            setCustomMemoria("");
            setIsCustomMemoriaActive(false);
        } else if (registros && registros[0]?.detalhamento_customizado) {
            setCustomMemoria(registros[0].detalhamento_customizado);
            setIsCustomMemoriaActive(true);
        } else {
            setCustomMemoria("");
            setIsCustomMemoriaActive(false);
        }
    }, [aggregatedRequest, omDestinoPTrab, omList, resetForm, registros]);

    // Effect to reset form when data loads initially
    useEffect(() => {
        if (!isLoadingRegistros && !isLoadingPTrab) {
            resetFormToAggregated();
        }
    }, [isLoadingRegistros, isLoadingPTrab, resetFormToAggregated]);


    if (isLoadingSession || isLoadingPTrab || isLoadingRegistros || isLoadingDiretrizes || !omDestinoPTrab || !diariaDiretrizes) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando dados do P Trab...</span>
            </div>
        );
    }

    return (
        <FormProvider {...methods}>
            <div className="min-h-screen bg-background p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${p_trab_id}`)} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para o P Trab
                    </Button>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="h-6 w-6 text-primary" />
                                Registro de Pagamento de Diárias (ND 33.90.15)
                            </CardTitle>
                            <CardDescription>
                                Configure a solicitação de diárias e taxas de embarque para o P Trab: <span className="font-medium">{pTrabData?.numero_ptrab} - {pTrabData?.nome_operacao}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            <form onSubmit={handleSubmit(handleSaveRequest)} className="space-y-6">
                                
                                {/* 1. Dados da Organização e Viagem */}
                                <Card className="bg-muted/50">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">1. Dados da Organização e Viagem</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        
                                        {/* OM Detentora (Source) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="om_detentora">OM Detentora (Source) *</Label>
                                            <OmSelector
                                                selectedOmId={selectedOmDetentoraId}
                                                initialOmName={watchedFields.om_detentora}
                                                onChange={handleOmDetentoraChange}
                                                placeholder="Selecione a OM Detentora..."
                                                disabled={isSubmitting}
                                            />
                                            {errors.om_detentora && <p className="text-xs text-destructive">{errors.om_detentora.message}</p>}
                                            <p className="text-xs text-muted-foreground">UG: {formatCodug(watchedFields.ug_detentora)}</p>
                                        </div>
                                        
                                        {/* Nr Dias da viagem */}
                                        <div className="space-y-2">
                                            <Label htmlFor="nr_dias_viagem">Nr Dias da Viagem *</Label>
                                            <Input
                                                id="nr_dias_viagem"
                                                type="number"
                                                {...register('nr_dias_viagem', { valueAsNumber: true })}
                                                min={1}
                                                placeholder="5"
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            {errors.nr_dias_viagem && <p className="text-xs text-destructive">{errors.nr_dias_viagem.message}</p>}
                                        </div>
                                        
                                        {/* Local para fins Pgto */}
                                        <div className="space-y-2">
                                            <Label htmlFor="local_pagamento">Local para fins Pgto *</Label>
                                            <Select
                                                value={watchedFields.local_pagamento}
                                                onValueChange={(value) => setValue('local_pagamento', value as DiariaRequestFormValues['local_pagamento'])}
                                            >
                                                <SelectTrigger id="local_pagamento">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DESTINO_OPTIONS.map(dest => (
                                                        <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.local_pagamento && <p className="text-xs text-destructive">{errors.local_pagamento.message}</p>}
                                        </div>
                                        
                                        {/* Nr Viagens */}
                                        <div className="space-y-2">
                                            <Label htmlFor="nr_viagens">Nr Viagens *</Label>
                                            <Input
                                                id="nr_viagens"
                                                type="number"
                                                {...register('nr_viagens', { valueAsNumber: true })}
                                                min={1}
                                                placeholder="1"
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            {errors.nr_viagens && <p className="text-xs text-destructive">{errors.nr_viagens.message}</p>}
                                        </div>
                                        
                                        {/* Local Operação */}
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="local_atividade">Local da Atividade *</Label>
                                            <Input
                                                id="local_atividade"
                                                {...register('local_atividade')}
                                                placeholder="Ex: Belém/PA"
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            {errors.local_atividade && <p className="text-xs text-destructive">{errors.local_atividade.message}</p>}
                                        </div>
                                        
                                        {/* Fase da Atividade */}
                                        <div className="space-y-2">
                                            <Label htmlFor="fase_atividade">Fase da Atividade</Label>
                                            <Select
                                                value={watchedFields.fase_atividade}
                                                onValueChange={(value) => setValue('fase_atividade', value)}
                                            >
                                                <SelectTrigger id="fase_atividade">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FASE_ATIVIDADE_OPTIONS.map(fase => (
                                                        <SelectItem key={fase} value={fase}>{fase}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {/* OM de Destino (Recurso) - Fixa */}
                                        <div className="space-y-2">
                                            <Label>OM de Destino (Recurso)</Label>
                                            <Input value={watchedFields.organizacao} disabled className="bg-white" />
                                            <p className="text-xs text-muted-foreground">UG: {formatCodug(watchedFields.ug)}</p>
                                        </div>
                                        
                                    </CardContent>
                                </Card>
                                
                                {/* 2. Configuração do Item (Tabela de Quantidades) */}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">2. Quantitativo de Militares por Posto/Graduação</CardTitle>
                                        <CardDescription>
                                            Valores unitários de diária baseados na diretriz de {diariaDiretrizes.referenciaLegal}. Taxa de Embarque: {formatCurrency(diariaDiretrizes.taxaEmbarque)}.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[30%]">Posto/Graduação</TableHead>
                                                        <TableHead className="w-[15%] text-center">Valor Diária ({watchedFields.local_pagamento})</TableHead>
                                                        <TableHead className="w-[15%] text-center">Qtd (Militares) *</TableHead>
                                                        <TableHead className="w-[20%] text-right">Custo Diária Op</TableHead>
                                                        <TableHead className="w-[20%] text-right">Custo Total (Diária + Tx Emb)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {quantityFields.map((field, index) => {
                                                        const rankLabel = field.posto_graduacao;
                                                        const valorDia = diariaDiretrizes.values[rankLabel]?.[watchedFields.local_pagamento] || 0;
                                                        
                                                        const calc = rankCalculations.find(r => r.rank === rankLabel);
                                                        const custoDiariaOp = calc?.total || 0;
                                                        
                                                        // Recalculate total cost for display purposes
                                                        const totalTaxaEmbarqueRank = (field.qtd || 0) * diariaDiretrizes.taxaEmbarque * (watchedFields.nr_viagens || 0);
                                                        const custoTotal = custoDiariaOp + totalTaxaEmbarqueRank;
                                                        
                                                        return (
                                                            <TableRow key={field.id}>
                                                                <TableCell className="font-medium">{rankLabel}</TableCell>
                                                                <TableCell className="text-center">{formatCurrency(valorDia)}</TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        {...register(`quantities.${index}.qtd`, { valueAsNumber: true })}
                                                                        min={0}
                                                                        className="text-center"
                                                                        onKeyDown={handleEnterToNextField}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right">{formatCurrency(custoDiariaOp)}</TableCell>
                                                                <TableCell className="text-right font-bold">{formatCurrency(custoTotal)}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    <TableRow className="bg-muted/50 font-bold">
                                                        <TableCell colSpan={3} className="text-right">Total Diária Operacional</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(totalDiaria)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(totalGeral)}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="bg-muted/50 font-bold">
                                                        <TableCell colSpan={3} className="text-right">Total Taxa Embarque ({totalMilitares} militares)</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(totalTaxaEmbarque)}</TableCell>
                                                        <TableCell className="text-right"></TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {errors.quantities && <p className="text-xs text-destructive mt-2">{errors.quantities.message}</p>}
                                    </CardContent>
                                    <CardFooter className="flex justify-end gap-2 pt-4 border-t">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={resetFormToAggregated}
                                            disabled={isSubmitting}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Resetar Formulário
                                        </Button>
                                        <Button type="submit" disabled={isSubmitting || totalGeral <= 0}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Salvar Solicitação de Diárias
                                        </Button>
                                    </CardFooter>
                                </Card>
                                
                                {/* 3. Memórias de Cálculo Detalhadas */}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            <span>3. Memória de Cálculo Detalhada (ND 33.90.15)</span>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="custom-memoria"
                                                    checked={isCustomMemoriaActive}
                                                    onCheckedChange={(checked) => setIsCustomMemoriaActive(!!checked)}
                                                />
                                                <Label htmlFor="custom-memoria" className="text-sm font-medium">
                                                    Memória Customizada
                                                </Label>
                                            </div>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Textarea
                                            value={isCustomMemoriaActive ? customMemoria : liveMemoria}
                                            onChange={(e) => setCustomMemoria(e.target.value)}
                                            rows={15}
                                            readOnly={!isCustomMemoriaActive}
                                            className={isCustomMemoriaActive ? "" : "bg-muted/50 text-muted-foreground"}
                                        />
                                        {!isCustomMemoriaActive && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                A memória de cálculo é gerada automaticamente. Marque "Memória Customizada" para editar o texto.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                                
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </FormProvider>
    );
};

export default DiariaForm;