"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Edit, Calendar, Users, MapPin, DollarSign, FileText, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useDiretrizesOperacionais } from "@/hooks/useDiretrizesOperacionais"; // Novo hook para diretrizes operacionais
import { formatCurrency, formatCodug, formatNumberForInput, parseInputToNumber, numberToRawDigits, formatCurrencyInput, calculateDays } from "@/lib/formatUtils";
import { usePTrabData } from "@/hooks/usePTrabData";
import { useDiariaRegistros } from "@/hooks/useDiariaRegistros"; // Novo hook para registros de diária
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { OMData } from "@/lib/omUtils";
import { DiariaRegistro, DiariaItem } from "@/types/diaria"; // Novo tipo para Diária
import { useSession } from "@/components/SessionContextProvider"; // Importar useSession

// --- Schemas ---

// Define a estrutura de um item de diária para o formulário
const DiariaItemSchema = z.object({
    posto_graduacao: z.string().min(1, "Posto/Graduação é obrigatório."),
    destino: z.string().min(1, "Destino é obrigatório."),
    quantidade: z.number().int().min(1, "Quantidade deve ser >= 1."),
    dias_operacao: z.number().int().min(1, "Dias de Operação deve ser >= 1."),
    valor_diaria_unitario: z.number().min(0, "Valor unitário deve ser positivo."),
    valor_taxa_embarque: z.number().min(0, "Valor da taxa deve ser positivo."),
    valor_total: z.number().min(0, "Valor total deve ser positivo."),
    valor_nd_30: z.number().min(0, "ND 30 deve ser positivo."),
    valor_nd_39: z.number().min(0, "ND 39 deve ser positivo."),
    detalhamento: z.string().optional(),
    detalhamento_customizado: z.string().optional(),
    fase_atividade: z.string().optional(),
    om_detentora: z.string().optional(),
    ug_detentora: z.string().optional(),
});

// Define a estrutura do formulário principal (para edição de um registro)
const DiariaRegistroSchema = z.object({
    id: z.string().optional(),
    organizacao: z.string().min(1, "OM de Destino é obrigatória."),
    ug: z.string().min(1, "UG de Destino é obrigatória."),
    dias_operacao: z.number().int().min(1, "Dias de Operação é obrigatório."),
    fase_atividade: z.string().optional(),
    
    // Campos do item (para o formulário de adição/edição)
    posto_graduacao: z.string().min(1, "Posto/Graduação é obrigatório."),
    destino: z.string().min(1, "Destino é obrigatório."),
    quantidade: z.number().int().min(1, "Quantidade é obrigatória."),
    
    // Campos de controle de input (raw digits)
    raw_valor_diaria_unitario: z.string().optional(),
    raw_valor_taxa_embarque: z.string().optional(),
    
    // Campos de alocação ND (raw digits)
    raw_valor_nd_30: z.string().optional(),
    raw_valor_nd_39: z.string().optional(),
    
    // Campos de OM Detentora (Source)
    om_detentora: z.string().optional(),
    ug_detentora: z.string().optional(),
});

type DiariaRegistroFormValues = z.infer<typeof DiariaRegistroSchema>;

// --- Constants ---

const POSTO_GRADUACAO_OPTIONS = [
    "Of Gen", "Of Sup", "Of Int/Sub/Asp Of/ST/Sgt", "Demais Praças"
];

const DESTINO_OPTIONS = [
    "BSB/MAO/RJ/SP", "Demais Capitais", "Demais Dslc"
];

const FASE_ATIVIDADE_OPTIONS = [
    "Mobilização", "Execução", "Desmobilização", "Reconhecimento"
];

// Default Diária values (replicated from CustosOperacionaisPage.tsx for robustness)
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

// --- Component ---

const DiariaForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const p_trab_id = searchParams.get('ptrabId');
    
    const { user, loading: isLoadingSession } = useSession(); // Usar useSession
    
    const { handleEnterToNextField } = useFormNavigation();
    
    const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [registroToDelete, setRegistroToDelete] = useState<DiariaRegistro | null>(null);
    
    // Estado para a memória de cálculo customizada
    const [customMemoria, setCustomMemoria] = useState<string>("");
    const [isCustomMemoriaActive, setIsCustomMemoriaActive] = useState(false);
    
    // Hooks de Dados
    const { data: pTrabData, isLoading: isLoadingPTrab } = usePTrabData(p_trab_id);
    const { data: omList } = useMilitaryOrganizations();
    // Passar o userId para o hook de diretrizes
    const { data: diretrizesOp, isLoading: isLoadingDiretrizes } = useDiretrizesOperacionais(user?.id); 
    const { data: registros, isLoading: isLoadingRegistros, refetch: refetchRegistros } = useDiariaRegistros(p_trab_id);
    
    // Memo para a OM de Destino (OM do PTrab) - CORRIGIDO: Garante um fallback se a OM não estiver na lista
    const omDestino = useMemo(() => {
        if (!pTrabData) return null;
        
        // Tenta encontrar a OM na lista
        const foundOm = omList?.find(om => om.nome_om === pTrabData.nome_om);
        
        if (foundOm) return foundOm;
        
        // Fallback: Usa os dados do PTrab se a OM não for encontrada na lista do usuário
        return {
            id: 'fallback',
            nome_om: pTrabData.nome_om,
            codug_om: pTrabData.codug_om || '000000',
            rm_vinculacao: pTrabData.rm_vinculacao || '',
            codug_rm_vinculacao: pTrabData.codug_rm_vinculacao || '000000',
            cidade: pTrabData.local_om || '',
            ativo: true,
            user_id: user?.id || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as OMData; // Cast to OMData structure
    }, [pTrabData, omList, user?.id]);
    
    // Memo para as diretrizes de diária - CORRIGIDO: Usa DEFAULT_DIARIA_VALUES se diretrizesOp for null
    const diariaDiretrizes = useMemo(() => {
        // Use diretrizesOp se estiver disponível, senão use os valores padrão
        const source = diretrizesOp || DEFAULT_DIARIA_VALUES; 
        
        // Mapeamento simplificado para facilitar a busca
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

    // --- Form Setup ---
    const methods = useForm<DiariaRegistroFormValues>({
        resolver: zodResolver(DiariaRegistroSchema),
        defaultValues: {
            organizacao: omDestino?.nome_om || "",
            ug: omDestino?.codug_om || "",
            dias_operacao: pTrabData ? calculateDays(pTrabData.periodo_inicio, pTrabData.periodo_fim) : 1,
            fase_atividade: FASE_ATIVIDADE_OPTIONS[0],
            posto_graduacao: POSTO_GRADUACAO_OPTIONS[0],
            destino: DESTINO_OPTIONS[0],
            quantidade: 1,
            raw_valor_diaria_unitario: numberToRawDigits(0),
            raw_valor_taxa_embarque: numberToRawDigits(0),
            raw_valor_nd_30: numberToRawDigits(0),
            raw_valor_nd_39: numberToRawDigits(0),
            om_detentora: omDestino?.nome_om || "",
            ug_detentora: omDestino?.codug_om || "",
        },
    });
    const { register, handleSubmit, watch, setValue, reset: resetForm, formState: { errors, isSubmitting } } = methods;
    
    const watchedFields = watch();
    
    // --- Auto-Update Effects ---
    
    // 1. Atualizar OM de Destino e Dias de Operação
    useEffect(() => {
        if (omDestino) {
            setValue('organizacao', omDestino.nome_om);
            setValue('ug', omDestino.codug_om);
            setValue('om_detentora', omDestino.nome_om);
            setValue('ug_detentora', omDestino.codug_om);
        }
        if (pTrabData) {
            setValue('dias_operacao', calculateDays(pTrabData.periodo_inicio, pTrabData.periodo_fim));
        }
    }, [omDestino, pTrabData, setValue]);
    
    // 2. Auto-calcular Valor Unitário da Diária e Taxa de Embarque
    useEffect(() => {
        if (diariaDiretrizes && watchedFields.posto_graduacao && watchedFields.destino) {
            const posto = watchedFields.posto_graduacao;
            const destino = watchedFields.destino;
            
            const valorUnitario = diariaDiretrizes.values[posto]?.[destino] || 0;
            const taxaEmbarque = diariaDiretrizes.taxaEmbarque || 0;
            
            // Atualiza o valor unitário (numérico e raw input)
            setValue('raw_valor_diaria_unitario', numberToRawDigits(valorUnitario));
            
            // Atualiza a taxa de embarque (numérico e raw input)
            setValue('raw_valor_taxa_embarque', numberToRawDigits(taxaEmbarque));
        }
    }, [watchedFields.posto_graduacao, watchedFields.destino, diariaDiretrizes, setValue]);
    
    // 3. Cálculo de Totais (Diária Unitária e Taxa de Embarque)
    const { valorDiariaUnitario, valorTaxaEmbarque, valorTotal, valorND30, valorND39 } = useMemo(() => {
        const qtd = watchedFields.quantidade || 0;
        const dias = watchedFields.dias_operacao || 0;
        
        // Valores unitários (lidos dos raw inputs)
        const valorUnitario = parseInputToNumber(formatCurrencyInput(watchedFields.raw_valor_diaria_unitario || '0').formatted);
        const taxaEmbarque = parseInputToNumber(formatCurrencyInput(watchedFields.raw_valor_taxa_embarque || '0').formatted);
        
        // Cálculo
        const totalDiaria = qtd * dias * valorUnitario;
        const totalTaxaEmbarque = qtd * valorTaxaEmbarque;
        const totalGeral = totalDiaria + totalTaxaEmbarque;
        
        // Alocação ND (Diárias são sempre ND 39)
        const nd39 = totalGeral;
        const nd30 = 0;
        
        // Atualiza os raw inputs de ND para refletir o cálculo
        setValue('raw_valor_nd_30', numberToRawDigits(nd30));
        setValue('raw_valor_nd_39', numberToRawDigits(nd39));
        
        return {
            valorDiariaUnitario: valorUnitario,
            valorTaxaEmbarque: taxaEmbarque,
            valorTotal: totalGeral,
            valorND30: nd30,
            valorND39: nd39,
        };
    }, [watchedFields.quantidade, watchedFields.dias_operacao, watchedFields.raw_valor_diaria_unitario, watchedFields.raw_valor_taxa_embarque, setValue]);
    
    // --- Handlers de Input ---
    
    const handleCurrencyChange = (field: 'raw_valor_diaria_unitario' | 'raw_valor_taxa_embarque' | 'raw_valor_nd_30' | 'raw_valor_nd_39', rawValue: string) => {
        const { digits } = formatCurrencyInput(rawValue);
        setValue(field, digits, { shouldValidate: false });
    };
    
    // --- CRUD Operations ---
    
    const handleSaveRegistro = async (data: DiariaRegistroFormValues) => {
        if (!p_trab_id) return;
        
        // 1. Validação final dos campos numéricos
        const finalData = {
            ...data,
            valor_diaria_unitario: valorDiariaUnitario,
            valor_taxa_embarque: valorTaxaEmbarque,
            valor_total: valorTotal,
            valor_nd_30: valorND30,
            valor_nd_39: valorND39,
            detalhamento: isCustomMemoriaActive ? customMemoria : generateMemoriaCalculo(data, valorTotal, valorDiariaUnitario, valorTaxaEmbarque),
            detalhamento_customizado: isCustomMemoriaActive ? customMemoria : null,
        };
        
        // 2. Preparar payload para o Supabase
        const payload: TablesInsert<'diaria_registros'> = {
            p_trab_id: p_trab_id,
            organizacao: finalData.organizacao,
            ug: finalData.ug,
            om_detentora: finalData.om_detentora,
            ug_detentora: finalData.ug_detentora,
            dias_operacao: finalData.dias_operacao,
            fase_atividade: finalData.fase_atividade,
            posto_graduacao: finalData.posto_graduacao,
            destino: finalData.destino,
            quantidade: finalData.quantidade,
            valor_diaria_unitario: finalData.valor_diaria_unitario,
            valor_taxa_embarque: finalData.valor_taxa_embarque,
            valor_total: finalData.valor_total,
            valor_nd_30: finalData.valor_nd_30,
            valor_nd_39: finalData.valor_nd_39,
            detalhamento: finalData.detalhamento,
            detalhamento_customizado: finalData.detalhamento_customizado,
        };
        
        try {
            if (editingRegistroId) {
                // Update
                const { error } = await supabase
                    .from('diaria_registros')
                    .update(payload as TablesUpdate<'diaria_registros'>)
                    .eq('id', editingRegistroId);
                if (error) throw error;
                toast.success("Registro de Diária atualizado!");
            } else {
                // Insert
                const { error } = await supabase
                    .from('diaria_registros')
                    .insert([payload]);
                if (error) throw error;
                toast.success("Registro de Diária adicionado!");
            }
            
            resetFormForNewItem();
            refetchRegistros();
            
        } catch (error: any) {
            toast.error(sanitizeError(error));
        }
    };
    
    const handleEdit = (registro: DiariaRegistro) => {
        setEditingRegistroId(registro.id);
        
        // Preencher o formulário com os dados do registro
        resetForm({
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.dias_operacao,
            fase_atividade: registro.fase_atividade || FASE_ATIVIDADE_OPTIONS[0],
            posto_graduacao: registro.posto_graduacao,
            destino: registro.destino,
            quantidade: registro.quantidade,
            
            // Raw inputs
            raw_valor_diaria_unitario: numberToRawDigits(registro.valor_diaria_unitario),
            raw_valor_taxa_embarque: numberToRawDigits(registro.valor_taxa_embarque || 0),
            raw_valor_nd_30: numberToRawDigits(registro.valor_nd_30),
            raw_valor_nd_39: numberToRawDigits(registro.valor_nd_39),
            
            om_detentora: registro.om_detentora || omDestino?.nome_om || "",
            ug_detentora: registro.ug_detentora || omDestino?.codug_om || "",
        });
        
        // Configurar memória customizada
        if (registro.detalhamento_customizado) {
            setCustomMemoria(registro.detalhamento_customizado);
            setIsCustomMemoriaActive(true);
        } else {
            setCustomMemoria(generateMemoriaCalculo(registro, registro.valor_total, registro.valor_diaria_unitario, registro.valor_taxa_embarque || 0));
            setIsCustomMemoriaActive(false);
        }
    };
    
    const handleConfirmDelete = (registro: DiariaRegistro) => {
        setRegistroToDelete(registro);
        setShowDeleteDialog(true);
    };
    
    const handleDelete = async () => {
        if (!registroToDelete) return;
        
        try {
            const { error } = await supabase
                .from('diaria_registros')
                .delete()
                .eq('id', registroToDelete.id);
            
            if (error) throw error;
            
            toast.success("Registro excluído com sucesso!");
            refetchRegistros();
            setShowDeleteDialog(false);
            setRegistroToDelete(null);
            
        } catch (error: any) {
            toast.error(sanitizeError(error));
        }
    };
    
    const resetFormForNewItem = () => {
        setEditingRegistroId(null);
        setCustomMemoria("");
        setIsCustomMemoriaActive(false);
        
        // Resetar apenas os campos de item, mantendo OM e Dias
        resetForm({
            organizacao: watchedFields.organizacao,
            ug: watchedFields.ug,
            dias_operacao: watchedFields.dias_operacao,
            fase_atividade: FASE_ATIVIDADE_OPTIONS[0],
            posto_graduacao: POSTO_GRADUACAO_OPTIONS[0],
            destino: DESTINO_OPTIONS[0],
            quantidade: 1,
            raw_valor_diaria_unitario: numberToRawDigits(0),
            raw_valor_taxa_embarque: numberToRawDigits(0),
            raw_valor_nd_30: numberToRawDigits(0),
            raw_valor_nd_39: numberToRawDigits(0),
            om_detentora: watchedFields.om_detentora,
            ug_detentora: watchedFields.ug_detentora,
        });
    };
    
    // --- Memória de Cálculo ---
    
    const generateMemoriaCalculo = (
        data: DiariaRegistroFormValues | DiariaRegistro, 
        valorTotal: number, 
        valorUnitario: number, 
        valorTaxaEmbarque: number
    ): string => {
        const dias = data.dias_operacao || 0;
        const qtd = data.quantidade || 0;
        const faseFormatada = data.fase_atividade || 'operação';
        const omDestinoNome = data.organizacao;
        const omDestinoUg = data.ug;
        const omDetentoraNome = data.om_detentora || omDestinoNome;
        const omDetentoraUg = data.ug_detentora || omDestinoUg;
        
        const totalDiaria = qtd * dias * valorUnitario;
        const totalTaxaEmbarque = qtd * valorTaxaEmbarque;
        
        const omArticle = omDestinoNome.includes('ª') ? 'da' : 'do';
        const militarPlural = qtd === 1 ? 'militar' : 'militares';
        const diaPlural = dias === 1 ? 'dia' : 'dias';
        
        // Cabeçalho
        const header = `33.90.39 - Pagamento de Diárias e Taxas de Embarque para ${qtd} ${militarPlural} ${omArticle} ${omDestinoNome}, durante ${dias} ${diaPlural} de ${faseFormatada}.`;
        
        let detalhamento = `
OM Detentora: ${omDetentoraNome} (UG: ${formatCodug(omDetentoraUg)})
OM Destino Recurso: ${omDestinoNome} (UG: ${formatCodug(omDestinoUg)})

Referência Legal: ${diariaDiretrizes.referenciaLegal || 'Não Informada'}

Cálculo Detalhado:
- Posto/Graduação: ${data.posto_graduacao}
- Destino: ${data.destino}
- Valor Diária Unitário: ${formatCurrency(valorUnitario)}
- Valor Taxa de Embarque: ${formatCurrency(valorTaxaEmbarque)}

1. Diárias:
Fórmula: Quantidade x Dias x Valor Unitário
${qtd} un. x ${dias} ${diaPlural} x ${formatCurrency(valorUnitario)} = ${formatCurrency(totalDiaria)}

2. Taxas de Embarque:
Fórmula: Quantidade x Valor Taxa
${qtd} un. x ${formatCurrency(valorTaxaEmbarque)} = ${formatCurrency(totalTaxaEmbarque)}

Valor Total (ND 33.90.39): ${formatCurrency(valorTotal)}.
        `.trim();
        
        return header + "\n\n" + detalhamento;
    };
    
    // Memória de cálculo em tempo real
    const liveMemoria = useMemo(() => {
        if (isCustomMemoriaActive) return customMemoria;
        
        return generateMemoriaCalculo(watchedFields, valorTotal, valorDiariaUnitario, valorTaxaEmbarque);
    }, [watchedFields, valorTotal, valorDiariaUnitario, valorTaxaEmbarque, isCustomMemoriaActive, customMemoria, diariaDiretrizes]);
    
    // --- Renderização ---
    
    if (isLoadingSession || isLoadingPTrab || isLoadingRegistros || isLoadingDiretrizes || !omDestino || !diariaDiretrizes) {
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
                                Registro de Pagamento de Diárias
                            </CardTitle>
                            <CardDescription>
                                Adicione ou edite os registros de diárias e taxas de embarque para o P Trab: <span className="font-medium">{pTrabData?.numero_ptrab} - {pTrabData?.nome_operacao}</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(handleSaveRegistro)} className="space-y-6">
                                
                                {/* 1. Dados da Organização */}
                                <Card className="bg-muted/50">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">1. Dados da Organização</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>OM de Destino (Recurso)</Label>
                                            <Input value={watchedFields.organizacao} disabled className="bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>UG de Destino</Label>
                                            <Input value={formatCodug(watchedFields.ug)} disabled className="bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Dias de Operação (Total)</Label>
                                            <Input 
                                                type="number"
                                                value={watchedFields.dias_operacao}
                                                disabled
                                                className="bg-white"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                {/* 2. Configuração do Item */}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">2. Configuração do Item</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="posto_graduacao">Posto/Graduação *</Label>
                                            <Select
                                                value={watchedFields.posto_graduacao}
                                                onValueChange={(value) => setValue('posto_graduacao', value)}
                                            >
                                                <SelectTrigger id="posto_graduacao">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {POSTO_GRADUACAO_OPTIONS.map(pg => (
                                                        <SelectItem key={pg} value={pg}>{pg}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="destino">Destino *</Label>
                                            <Select
                                                value={watchedFields.destino}
                                                onValueChange={(value) => setValue('destino', value)}
                                            >
                                                <SelectTrigger id="destino">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DESTINO_OPTIONS.map(dest => (
                                                        <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="quantidade">Quantidade (Militares) *</Label>
                                            <Input
                                                id="quantidade"
                                                type="number"
                                                {...register('quantidade', { valueAsNumber: true })}
                                                min={1}
                                                placeholder="1"
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            {errors.quantidade && <p className="text-xs text-destructive">{errors.quantidade.message}</p>}
                                        </div>
                                        
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
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_diaria_unitario">Valor Diária Unitário (R$)</Label>
                                            <Input
                                                id="valor_diaria_unitario"
                                                type="text"
                                                inputMode="numeric"
                                                value={formatCurrencyInput(watchedFields.raw_valor_diaria_unitario || '0').formatted}
                                                onChange={(e) => handleCurrencyChange('raw_valor_diaria_unitario', e.target.value)}
                                                disabled
                                                className="bg-white"
                                            />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_taxa_embarque">Valor Taxa Embarque (R$)</Label>
                                            <Input
                                                id="valor_taxa_embarque"
                                                type="text"
                                                inputMode="numeric"
                                                value={formatCurrencyInput(watchedFields.raw_valor_taxa_embarque || '0').formatted}
                                                onChange={(e) => handleCurrencyChange('raw_valor_taxa_embarque', e.target.value)}
                                                disabled
                                                className="bg-white"
                                            />
                                        </div>
                                        
                                        <div className="space-y-2 col-span-2">
                                            <Label>Valor Total Calculado (ND 33.90.39)</Label>
                                            <Input 
                                                value={formatCurrency(valorTotal)} 
                                                disabled 
                                                className="bg-primary/10 font-bold text-primary"
                                            />
                                        </div>
                                        
                                    </CardContent>
                                    <CardFooter className="flex justify-end gap-2 pt-4">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={resetFormForNewItem}
                                            disabled={isSubmitting}
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Cancelar
                                        </Button>
                                        <Button type="submit" disabled={isSubmitting || valorTotal <= 0}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            {editingRegistroId ? "Atualizar Registro" : "Adicionar Registro"}
                                        </Button>
                                    </CardFooter>
                                </Card>
                                
                                {/* 3. Itens Adicionados */}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">3. Registros de Diária Adicionados ({registros?.length || 0})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[15%]">Posto/Grad</TableHead>
                                                        <TableHead className="w-[15%]">Destino</TableHead>
                                                        <TableHead className="w-[10%] text-center">Qtd</TableHead>
                                                        <TableHead className="w-[10%] text-center">Dias</TableHead>
                                                        <TableHead className="w-[15%] text-right">Valor Diária</TableHead>
                                                        <TableHead className="w-[15%] text-right">Valor Total</TableHead>
                                                        <TableHead className="w-[10%] text-center">Fase</TableHead>
                                                        <TableHead className="w-[10%] text-right">Ações</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {registros && registros.length > 0 ? (
                                                        registros.map((registro) => (
                                                            <TableRow key={registro.id}>
                                                                <TableCell className="font-medium">{registro.posto_graduacao}</TableCell>
                                                                <TableCell>{registro.destino}</TableCell>
                                                                <TableCell className="text-center">{registro.quantidade}</TableCell>
                                                                <TableCell className="text-center">{registro.dias_operacao}</TableCell>
                                                                <TableCell className="text-right">{formatCurrency(registro.valor_diaria_unitario)}</TableCell>
                                                                <TableCell className="text-right font-bold">{formatCurrency(registro.valor_total)}</TableCell>
                                                                <TableCell className="text-center">{registro.fase_atividade}</TableCell>
                                                                <TableCell className="text-right space-x-2">
                                                                    <Button variant="outline" size="icon" onClick={() => handleEdit(registro)}>
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="destructive" size="icon" onClick={() => handleConfirmDelete(registro)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                                                Nenhum registro de diária adicionado.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                {/* 4. OMs Cadastradas (Mantido para consistência visual, mas sem funcionalidade direta aqui) */}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base">4. OMs Cadastradas (Referência)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Esta seção lista as Organizações Militares cadastradas para referência.
                                        </p>
                                        <Button variant="link" className="p-0 mt-2" onClick={() => navigate('/config/om')}>
                                            Gerenciar OMs
                                        </Button>
                                    </CardContent>
                                </Card>
                                
                                {/* 5. Memórias de Cálculo Detalhadas */}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            <span>5. Memória de Cálculo Detalhada (ND 33.90.39)</span>
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
            
            {/* Diálogo de Confirmação de Exclusão */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Confirmar Exclusão
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este registro de diária? Esta ação é irreversível.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Excluir"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </FormProvider>
    );
};

export default DiariaForm;