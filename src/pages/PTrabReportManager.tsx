import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Utensils, FileSpreadsheet, Printer, Download, Package, Truck, Zap, Ship, Tractor, HardHat, HeartPulse, Activity, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sanitizeError } from "@/lib/errorUtils";
import { formatCurrency, formatNumber, formatDate, formatCodug } from "@/lib/formatUtils";
import { generateRacaoQuenteMemoriaCalculo, generateRacaoOperacionalMemoriaCalculo, calculateClasseICalculations } from "@/lib/classeIUtils";
import { generateCategoryMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "@/lib/classeVIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "@/lib/classeVIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "@/lib/classeVIIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseIXUtility, calculateItemTotalClasseIX } from "@/lib/classeIXUtils";
import { generateGranularMemoriaCalculo as generateClasseIIIMemoriaGranular } from "@/lib/classeIIIUtils";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import { Tables } from "@/integrations/supabase/types";
import { RefLPC } from "@/types/refLPC";

// =================================================================
// TIPOS DE DADOS (Exportados para uso nos relatórios)
// =================================================================

export type PTrabData = Tables<'p_trab'>;
export type ClasseIRegistro = Tables<'classe_i_registros'> & {
    memoriaQSCustomizada: string | null;
    memoriaQRCustomizada: string | null;
    memoria_calculo_op_customizada: string | null;
    categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
    quantidade_r2: number;
    quantidade_r3: number;
    complemento_qs: number;
    etapa_qs: number;
    complemento_qr: number;
    etapa_qr: number;
};
export type ClasseIIRegistro = Tables<'classe_ii_registros'> & {
    itens_equipamentos: any[];
    detalhamento_customizado: string | null;
    animal_tipo?: 'Equino' | 'Canino' | null; // Para Classe VIII
};
export type ClasseIIIRegistro = Tables<'classe_iii_registros'> & {
    itens_equipamentos: any[];
    detalhamento_customizado: string | null;
};
export type ClasseIXRegistro = Tables<'classe_ix_registros'> & {
    itens_motomecanizacao: any[];
    detalhamento_customizado: string | null;
};

export interface LinhaTabela {
    classe: 'I';
    tipo: 'QS' | 'QR';
    registro: ClasseIRegistro;
    valor_nd_30: number;
    valor_nd_39: number;
}

export interface LinhaClasseII {
    classe: 'II' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX';
    registro: ClasseIIRegistro | ClasseIXRegistro;
    valor_nd_30: number;
    valor_nd_39: number;
}

export interface LinhaClasseIII {
    classe: 'III';
    tipo_suprimento: 'COMBUSTIVEL_DIESEL' | 'COMBUSTIVEL_GASOLINA' | 'LUBRIFICANTE';
    categoria_equipamento: TipoEquipamento; // GERADOR, EMBARCACAO, etc.
    registro: ClasseIIIRegistro;
    total_litros_linha: number;
    preco_litro_linha: number;
    valor_total_linha: number;
    memoria_calculo: string;
}

export interface GrupoOM {
    linhasQS: LinhaTabela[];
    linhasQR: LinhaTabela[];
    linhasClasseII: LinhaClasseII[];
    linhasClasseV: LinhaClasseII[];
    linhasClasseVI: LinhaClasseII[];
    linhasClasseVII: LinhaClasseII[];
    linhasClasseVIII: LinhaClasseII[];
    linhasClasseIX: LinhaClasseII[];
    linhasClasseIII: LinhaClasseIII[];
}

// Constantes de Categorias (para tipagem e agrupamento)
export const CLASSE_V_CATEGORIES = ['Armt L', 'Armt P', 'IODCT', 'DQBRN'];
export const CLASSE_VI_CATEGORIES = ['Gerador', 'Embarcação', 'Equipamento de Engenharia'];
export const CLASSE_VII_CATEGORIES = ['Comunicações', 'Informática'];
export const CLASSE_VIII_CATEGORIES = ['Saúde', 'Remonta/Veterinária'];
export const CLASSE_IX_CATEGORIES = ['Vtr Administrativa', 'Vtr Operacional', 'Motocicleta', 'Vtr Blindada'];

// =================================================================
// FUNÇÕES AUXILIARES DE CÁLCULO E FORMATAÇÃO
// =================================================================

export const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Inclui o dia de início
};

export const getTipoCombustivelLabel = (tipo: LinhaClasseIII['tipo_suprimento']): string => {
    switch (tipo) {
        case 'COMBUSTIVEL_DIESEL': return 'DIESEL';
        case 'COMBUSTIVEL_GASOLINA': return 'GASOLINA';
        case 'LUBRIFICANTE': return 'LUBRIFICANTE';
        default: return 'COMBUSTÍVEL';
    }
};

/**
 * Função unificada para gerar a memória de cálculo da Classe I, priorizando o customizado.
 * Esta função é a única responsável por gerar a memória de cálculo de Classe I para relatórios.
 */
export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            // 1. Para Ração Operacional (OP), prioriza o customizado armazenado em memoria_calculo_op_customizada
            if (registro.memoria_calculo_op_customizada && registro.memoria_calculo_op_customizada.trim().length > 0) {
                return registro.memoria_calculo_op_customizada;
            }
            
            // 2. Se não houver customizado, gera o automático
            return generateRacaoOperacionalMemoriaCalculo({
                id: registro.id,
                organizacao: registro.organizacao,
                ug: registro.ug,
                diasOperacao: registro.dias_operacao,
                faseAtividade: registro.fase_atividade,
                efetivo: registro.efetivo,
                quantidadeR2: registro.quantidade_r2,
                quantidadeR3: registro.quantidade_r3,
                // Campos não utilizados na memória OP, mas necessários para a interface
                omQS: null, ugQS: null, nrRefInt: null, valorQS: null, valorQR: null,
                calculos: {
                    totalQS: 0, totalQR: 0, nrCiclos: 0, diasEtapaPaga: 0, diasEtapaSolicitada: 0, totalEtapas: 0,
                    complementoQS: 0, etapaQS: 0, complementoQR: 0, etapaQR: 0,
                },
                categoria: 'RACAO_OPERACIONAL',
            });
        }
        return "Memória não aplicável para Ração Operacional.";
    }

    // Lógica para Ração Quente (QS/QR)
    if (tipo === 'QS') {
        if (registro.memoriaQSCustomizada && registro.memoriaQSCustomizada.trim().length > 0) {
            return registro.memoriaQSCustomizada;
        }
        const { qs } = generateRacaoQuenteMemoriaCalculo({
            id: registro.id,
            organizacao: registro.organizacao,
            ug: registro.ug,
            diasOperacao: registro.dias_operacao,
            faseAtividade: registro.fase_atividade,
            omQS: registro.om_qs,
            ugQS: registro.ug_qs,
            efetivo: registro.efetivo,
            nrRefInt: registro.nr_ref_int,
            valorQS: registro.valor_qs,
            valorQR: registro.valor_qr,
            calculos: {
                totalQS: registro.total_qs,
                totalQR: registro.total_qr,
                complementoQS: registro.complemento_qs,
                etapaQS: registro.etapa_qs,
                complementoQR: registro.complemento_qr,
                etapaQR: registro.etapa_qr,
                // Recalcula campos derivados se necessário (para garantir consistência)
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).diasEtapaSolicitada,
                totalEtapas: 0,
            },
            quantidadeR2: 0,
            quantidadeR3: 0,
            categoria: 'RACAO_QUENTE',
        });
        return qs;
    }

    if (tipo === 'QR') {
        if (registro.memoriaQRCustomizada && registro.memoriaQRCustomizada.trim().length > 0) {
            return registro.memoriaQRCustomizada;
        }
        const { qr } = generateRacaoQuenteMemoriaCalculo({
            id: registro.id,
            organizacao: registro.organizacao,
            ug: registro.ug,
            diasOperacao: registro.dias_operacao,
            faseAtividade: registro.fase_atividade,
            omQS: registro.om_qs,
            ugQS: registro.ug_qs,
            efetivo: registro.efetivo,
            nrRefInt: registro.nr_ref_int,
            valorQS: registro.valor_qs,
            valorQR: registro.valor_qr,
            calculos: {
                totalQS: registro.total_qs,
                totalQR: registro.total_qr,
                complementoQS: registro.complemento_qs,
                etapaQS: registro.etapa_qs,
                complementoQR: registro.complemento_qr,
                etapaQR: registro.etapa_qr,
                // Recalcula campos derivados se necessário (para garantir consistência)
                nrCiclos: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).nrCiclos,
                diasEtapaPaga: 0,
                diasEtapaSolicitada: calculateClasseICalculations(registro.efetivo, registro.dias_operacao, registro.nr_ref_int || 0, registro.valor_qs || 0, registro.valor_qr || 0).diasEtapaSolicitada,
                totalEtapas: 0,
            },
            quantidadeR2: 0,
            quantidadeR3: 0,
            categoria: 'RACAO_QUENTE',
        });
        return qr;
    }
    
    return "Memória de cálculo não encontrada.";
};

// =================================================================
// COMPONENTE PRINCIPAL (PTrabReportManager)
// =================================================================

const PTrabReportManager = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get("ptrabId");
    
    const [loading, setLoading] = useState(true);
    const [ptrabData, setPTrabData] = useState<PTrabData | null>(null);
    const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
    const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
    const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
    const [registrosClasseV, setRegistrosClasseV] = useState<ClasseIIRegistro[]>([]);
    const [registrosClasseVI, setRegistrosClasseVI] = useState<ClasseIIRegistro[]>([]);
    const [registrosClasseVII, setRegistrosClasseVII] = useState<ClasseIIRegistro[]>([]);
    const [registrosClasseVIII, setRegistrosClasseVIII] = useState<ClasseIIRegistro[]>([]);
    const [registrosClasseIX, setRegistrosClasseIX] = useState<ClasseIXRegistro[]>([]);
    const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
    
    const [selectedTab, setSelectedTab] = useState('logistico');
    
    const nomeRM = ptrabData?.rm_vinculacao || 'RM';

    const loadData = useCallback(async () => {
        if (!ptrabId) return;
        setLoading(true);
        
        try {
            // 1. PTrab Data
            const { data: ptrab, error: ptrabError } = await supabase
                .from('p_trab')
                .select('*')
                .eq('id', ptrabId)
                .maybeSingle();
            if (ptrabError) throw ptrabError;
            if (!ptrab) throw new Error("P Trab não encontrado.");
            setPTrabData(ptrab as PTrabData);
            
            // 2. Classe I
            const { data: classeIData } = await supabase
                .from('classe_i_registros')
                .select('*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, memoria_calculo_op_customizada, fase_atividade, categoria, quantidade_r2, quantidade_r3, complemento_qs, etapa_qs, complemento_qr, etapa_qr')
                .eq('p_trab_id', ptrabId);
            
            setRegistrosClasseI((classeIData || []).map(r => ({
                ...r,
                efetivo: Number(r.efetivo),
                nr_ref_int: Number(r.nr_ref_int),
                valor_qs: Number(r.valor_qs),
                valor_qr: Number(r.valor_qr),
                total_qs: Number(r.total_qs),
                total_qr: Number(r.total_qr),
                total_geral: Number(r.total_geral),
                complemento_qs: Number(r.complemento_qs),
                etapa_qs: Number(r.etapa_qs),
                complemento_qr: Number(r.complemento_qr),
                etapa_qr: Number(r.etapa_qr),
                memoriaQSCustomizada: r.memoria_calculo_qs_customizada || null,
                memoriaQRCustomizada: r.memoria_calculo_qr_customizada || null,
                memoria_calculo_op_customizada: r.memoria_calculo_op_customizada || null, // Garante que é string ou null
                categoria: (r.categoria || 'RACAO_QUENTE') as 'RACAO_QUENTE' | 'RACAO_OPERACIONAL',
                quantidade_r2: r.quantidade_r2 || 0,
                quantidade_r3: r.quantidade_r3 || 0,
            })) as ClasseIRegistro[]);

            // 3. Classe II (Intendência)
            const { data: classeIIData } = await supabase
                .from('classe_ii_registros')
                .select('*, itens_equipamentos, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
            setRegistrosClasseII((classeIIData || []).map(r => ({
                ...r,
                valor_nd_30: Number(r.valor_nd_30),
                valor_nd_39: Number(r.valor_nd_39),
            })) as ClasseIIRegistro[]);
            
            // 4. Classe III (Combustível)
            const { data: classeIIIData } = await supabase
                .from('classe_iii_registros')
                .select('*, itens_equipamentos, detalhamento_customizado, consumo_lubrificante_litro, preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora')
                .eq('p_trab_id', ptrabId);
            setRegistrosClasseIII((classeIIIData || []).map(r => ({
                ...r,
                valor_nd_30: Number(r.valor_nd_30),
                valor_nd_39: Number(r.valor_nd_39),
            })) as ClasseIIIRegistro[]);

            // 5. Classe V (Armamento)
            const { data: classeVData } = await supabase
                .from('classe_v_registros')
                .select('*, itens_equipamentos, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
            setRegistrosClasseV((classeVData || []).map(r => ({
                ...r,
                valor_nd_30: Number(r.valor_nd_30),
                valor_nd_39: Number(r.valor_nd_39),
            })) as ClasseIIRegistro[]);
            
            // 6. Classe VI (Engenharia)
            const { data: classeVIData } = await supabase
                .from('classe_vi_registros')
                .select('*, itens_equipamentos, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
            setRegistrosClasseVI((classeVIData || []).map(r => ({
                ...r,
                valor_nd_30: Number(r.valor_nd_30),
                valor_nd_39: Number(r.valor_nd_39),
            })) as ClasseIIRegistro[]);
            
            // 7. Classe VII (Com/Info)
            const { data: classeVIIData } = await supabase
                .from('classe_vii_registros')
                .select('*, itens_equipamentos, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
            setRegistrosClasseVII((classeVIIData || []).map(r => ({
                ...r,
                valor_nd_30: Number(r.valor_nd_30),
                valor_nd_39: Number(r.valor_nd_39),
            })) as ClasseIIRegistro[]);
            
            // 8. Classe VIII (Saúde/Remonta)
            const { data: classeVIIIData } = await supabase
                .from('classe_viii_saude_registros')
                .select('*, itens_saude, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
            
            const { data: classeVIIIRemontaData } = await supabase
                .from('classe_viii_remonta_registros')
                .select('*, itens_remonta, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
                
            const registrosClasseVIII = [
                ...(classeVIIIData || []).map(r => ({ 
                    ...r, 
                    itens_equipamentos: r.itens_saude, 
                    valor_nd_30: Number(r.valor_nd_30),
                    valor_nd_39: Number(r.valor_nd_39),
                })),
                ...(classeVIIIRemontaData || []).map(r => ({ 
                    ...r, 
                    itens_equipamentos: r.itens_remonta, 
                    valor_nd_30: Number(r.valor_nd_30),
                    valor_nd_39: Number(r.valor_nd_39),
                })),
            ] as ClasseIIRegistro[];
            setRegistrosClasseVIII(registrosClasseVIII);

            // 9. Classe IX (Motomecanização)
            const { data: classeIXData } = await supabase
                .from('classe_ix_registros')
                .select('*, itens_motomecanizacao, detalhamento_customizado')
                .eq('p_trab_id', ptrabId);
            setRegistrosClasseIX((classeIXData || []).map(r => ({
                ...r,
                valor_nd_30: Number(r.valor_nd_30),
                valor_nd_39: Number(r.valor_nd_39),
            })) as ClasseIXRegistro[]);
            
            // 10. Ref LPC
            const { data: refLPCData } = await supabase
                .from("p_trab_ref_lpc")
                .select("*")
                .eq("p_trab_id", ptrabId!)
                .maybeSingle();
            setRefLPC(refLPCData as RefLPC);

        } catch (error) {
            console.error("Erro ao carregar dados do P Trab:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    }, [ptrabId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // =================================================================
    // AGRUPAMENTO E CONSOLIDAÇÃO DE LINHAS
    // =================================================================

    const { gruposPorOM, omsOrdenadas } = useMemo(() => {
        if (!ptrabData) return { gruposPorOM: {}, omsOrdenadas: [] };

        const grupos: Record<string, GrupoOM> = {};
        const omPrincipal = ptrabData.nome_om;
        const rmPrincipal = ptrabData.rm_vinculacao;

        const initializeGroup = (omName: string): GrupoOM => {
            if (!grupos[omName]) {
                grupos[omName] = {
                    linhasQS: [],
                    linhasQR: [],
                    linhasClasseII: [],
                    linhasClasseV: [],
                    linhasClasseVI: [],
                    linhasClasseVII: [],
                    linhasClasseVIII: [],
                    linhasClasseIX: [],
                    linhasClasseIII: [],
                };
            }
            return grupos[omName];
        };
        
        // 1. Classe I (QS/QR)
        registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach(r => {
            const omQS = r.om_qs || omPrincipal;
            const omQR = r.organizacao || omPrincipal;
            
            // Linha QS (ND 30)
            if (r.total_qs > 0) {
                const grupoQS = initializeGroup(omQS);
                grupoQS.linhasQS.push({
                    classe: 'I',
                    tipo: 'QS',
                    registro: r,
                    valor_nd_30: r.total_qs,
                    valor_nd_39: 0,
                });
            }
            
            // Linha QR (ND 30)
            if (r.total_qr > 0) {
                const grupoQR = initializeGroup(omQR);
                grupoQR.linhasQR.push({
                    classe: 'I',
                    tipo: 'QR',
                    registro: r,
                    valor_nd_30: r.total_qr,
                    valor_nd_39: 0,
                });
            }
        });
        
        // 2. Classes II, V, VI, VII, VIII, IX (ND 30/39)
        const allClasseII_IX = [
            ...registrosClasseII.map(r => ({ ...r, classe: 'II' as const })),
            ...registrosClasseV.map(r => ({ ...r, classe: 'V' as const })),
            ...registrosClasseVI.map(r => ({ ...r, classe: 'VI' as const })),
            ...registrosClasseVII.map(r => ({ ...r, classe: 'VII' as const })),
            ...registrosClasseVIII.map(r => ({ ...r, classe: 'VIII' as const })),
            ...registrosClasseIX.map(r => ({ ...r, classe: 'IX' as const })),
        ];

        allClasseII_IX.forEach(r => {
            const omDestino = r.organizacao || omPrincipal;
            const grupo = initializeGroup(omDestino);
            
            const linha: LinhaClasseII = {
                classe: r.classe,
                registro: r,
                valor_nd_30: Number(r.valor_nd_30 || 0),
                valor_nd_39: Number(r.valor_nd_39 || 0),
            };
            
            if (r.classe === 'II') grupo.linhasClasseII.push(linha);
            else if (r.classe === 'V') grupo.linhasClasseV.push(linha);
            else if (r.classe === 'VI') grupo.linhasClasseVI.push(linha);
            else if (r.classe === 'VII') grupo.linhasClasseVII.push(linha);
            else if (r.classe === 'VIII') grupo.linhasClasseVIII.push(linha);
            else if (r.classe === 'IX') grupo.linhasClasseIX.push(linha);
        });
        
        // 3. Classe III (Combustível/Lubrificante)
        registrosClasseIII.forEach(r => {
            const isCombustivel = r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
            const isLubrificante = r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
            
            if (isCombustivel) {
                // Combustível é sempre alocado à RM de Fornecimento (om_detentora/ug_detentora)
                const omDestino = r.om_detentora || rmPrincipal;
                const grupo = initializeGroup(omDestino);
                
                const tipoSuprimento = r.tipo_combustivel === 'DIESEL' ? 'COMBUSTIVEL_DIESEL' : 'COMBUSTIVEL_GASOLINA';
                
                // Agrupamento por categoria de equipamento (para detalhamento)
                const itens = (r.itens_equipamentos as any[] || []).filter((i: any) => i.quantidade > 0);
                const categoriasAtivas = Array.from(new Set(itens.map((item: any) => item.categoria)));
                const categoriaEquipamento = categoriasAtivas.length === 1 ? categoriasAtivas[0] : 'MOTOMECANIZACAO'; // Fallback
                
                grupo.linhasClasseIII.push({
                    classe: 'III',
                    tipo_suprimento: tipoSuprimento,
                    categoria_equipamento: categoriaEquipamento as TipoEquipamento,
                    registro: r,
                    total_litros_linha: Number(r.total_litros),
                    preco_litro_linha: Number(r.preco_litro),
                    valor_total_linha: Number(r.valor_total),
                    memoria_calculo: r.detalhamento_customizado || r.detalhamento || '',
                });
            } else if (isLubrificante) {
                // Lubrificante é alocado à OM de Destino (om_detentora/ug_detentora)
                const omDestino = r.om_detentora || omPrincipal;
                const grupo = initializeGroup(omDestino);
                
                // Agrupamento por categoria de equipamento (para detalhamento)
                const itens = (r.itens_equipamentos as any[] || []).filter((i: any) => i.quantidade > 0);
                const categoriasAtivas = Array.from(new Set(itens.map((item: any) => item.categoria)));
                const categoriaEquipamento = categoriasAtivas.length === 1 ? categoriasAtivas[0] : 'GERADOR'; // Fallback
                
                grupo.linhasClasseIII.push({
                    classe: 'III',
                    tipo_suprimento: 'LUBRIFICANTE',
                    categoria_equipamento: categoriaEquipamento as TipoEquipamento,
                    registro: r,
                    total_litros_linha: Number(r.total_litros),
                    preco_litro_linha: 0, // Não aplicável para Lubrificante consolidado
                    valor_total_linha: Number(r.valor_total),
                    memoria_calculo: r.detalhamento_customizado || r.detalhamento || '',
                });
            }
        });

        // Ordenação das OMs: RM Principal primeiro, depois alfabética
        const omsComRegistros = Object.keys(grupos).filter(om => 
            grupos[om].linhasQS.length > 0 || 
            grupos[om].linhasQR.length > 0 || 
            grupos[om].linhasClasseII.length > 0 || 
            grupos[om].linhasClasseV.length > 0 || 
            grupos[om].linhasClasseVI.length > 0 || 
            grupos[om].linhasClasseVII.length > 0 || 
            grupos[om].linhasClasseVIII.length > 0 || 
            grupos[om].linhasClasseIX.length > 0 || 
            grupos[om].linhasClasseIII.length > 0
        );
        
        const omsOrdenadas = omsComRegistros.sort((a, b) => {
            if (a === rmPrincipal) return -1;
            if (b === rmPrincipal) return 1;
            return a.localeCompare(b);
        });

        return { gruposPorOM: grupos, omsOrdenadas };
    }, [ptrabData, registrosClasseI, registrosClasseII, registrosClasseIII, registrosClasseV, registrosClasseVI, registrosClasseVII, registrosClasseVIII, registrosClasseIX, rmPrincipal]);

    // =================================================================
    // CÁLCULO DE TOTAIS POR OM (para o relatório logístico)
    // =================================================================

    const calcularTotaisPorOM = useCallback((grupo: GrupoOM, nomeOM: string) => {
        let total_33_90_30 = 0;
        let total_33_90_39 = 0;
        let totalDieselLitros = 0;
        let totalGasolinaLitros = 0;
        let valorDiesel = 0;
        let valorGasolina = 0;
        
        // Classes I, II, V, VI, VII, VIII, IX (ND 30/39)
        const allNDLines = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI,
            ...grupo.linhasClasseVII,
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX,
            // Lubrificante (ND 30)
            ...grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'LUBRIFICANTE'),
        ];

        allNDLines.forEach(linha => {
            total_33_90_30 += linha.valor_nd_30;
            total_33_90_39 += linha.valor_nd_39;
        });
        
        // Classe III - Combustível (Apenas na RM Principal)
        if (nomeOM === nomeRM) {
            grupo.linhasClasseIII.filter(l => l.tipo_suprimento !== 'LUBRIFICANTE').forEach(linha => {
                if (linha.tipo_suprimento === 'COMBUSTIVEL_DIESEL') {
                    totalDieselLitros += linha.total_litros_linha;
                    valorDiesel += linha.valor_total_linha;
                } else if (linha.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') {
                    totalGasolinaLitros += linha.total_litros_linha;
                    valorGasolina += linha.valor_total_linha;
                }
            });
        }

        const total_parte_azul = total_33_90_30 + total_33_90_39;
        const total_combustivel = valorDiesel + valorGasolina;
        const total_gnd3 = total_parte_azul + total_combustivel;

        return {
            total_33_90_30,
            total_33_90_39,
            total_parte_azul,
            total_combustivel,
            total_gnd3,
            totalDieselLitros,
            totalGasolinaLitros,
            valorDiesel,
            valorGasolina,
        };
    }, [nomeRM]);

    // =================================================================
    // FUNÇÕES DE GERAÇÃO DE MEMÓRIA (Passadas para os relatórios)
    // =================================================================
    
    // Função para gerar memória da Classe II, V, VI, VII, VIII, IX
    const generateClasseIIMemoriaCalculo = useCallback((registro: ClasseIIRegistro | ClasseIXRegistro, isClasseII: boolean): string => {
        if (registro.detalhamento_customizado && registro.detalhamento_customizado.trim().length > 0) {
            return registro.detalhamento_customizado;
        }
        
        const categoria = registro.categoria;
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        const faseAtividade = registro.fase_atividade;
        const valorND30 = Number(registro.valor_nd_30 || 0);
        const valorND39 = Number(registro.valor_nd_39 || 0);
        
        if (CLASSE_IX_CATEGORIES.includes(categoria)) {
            return generateClasseIXUtility(registro as ClasseIXRegistro);
        }
        
        // Classes II, V, VI, VII, VIII (usam a mesma estrutura de itens_equipamentos/efetivo)
        const r = registro as ClasseIIRegistro;
        const itens = r.itens_equipamentos || [];
        const diasOperacao = r.dias_operacao;
        const efetivo = r.efetivo || 0;
        
        if (CLASSE_V_CATEGORIES.includes(categoria)) {
            return generateClasseVUtility(categoria, itens, diasOperacao, omDetentora, ugDetentora, faseAtividade, efetivo, valorND30, valorND39);
        }
        if (CLASSE_VI_CATEGORIES.includes(categoria)) {
            return generateClasseVIUtility(categoria, itens, diasOperacao, omDetentora, ugDetentora, faseAtividade, efetivo, valorND30, valorND39);
        }
        if (CLASSE_VII_CATEGORIES.includes(categoria)) {
            return generateClasseVIIUtility(categoria, itens, diasOperacao, omDetentora, ugDetentora, faseAtividade, efetivo, valorND30, valorND39);
        }
        if (CLASSE_VIII_CATEGORIES.includes(categoria)) {
            const itensClasseVIII = categoria === 'Saúde' ? r.itens_saude : r.itens_remonta;
            return generateClasseVIIIUtility(categoria as 'Saúde' | 'Remonta/Veterinária', itensClasseVIII, diasOperacao, omDetentora, ugDetentora, faseAtividade, efetivo, valorND30, valorND39, r.animal_tipo);
        }
        if (isClasseII) {
            return generateClasseIIUtility(categoria, itens, diasOperacao, omDetentora, ugDetentora, faseAtividade, efetivo, valorND30, valorND39);
        }
        
        return r.detalhamento || "Memória de cálculo não disponível.";
    }, []);
    
    // Função para gerar memória da Classe III (granular)
    const generateClasseIIIMemoriaCalculo = useCallback((registro: ClasseIIIRegistro): string => {
        // Para o relatório logístico, usamos o detalhamento consolidado (customizado ou automático)
        return registro.detalhamento_customizado || registro.detalhamento || "Memória de cálculo não disponível.";
    }, []);


    if (loading || !ptrabData) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Preparando relatórios...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o P Trab
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Relatórios Logísticos - {ptrabData.nome_om} - {ptrabData.nome_operacao}</CardTitle>
                        <CardDescription>
                            Visualize e exporte os relatórios de solicitação de recursos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                            <TabsList className="grid w-full grid-cols-2 md:w-auto">
                                <TabsTrigger value="logistico" className="flex items-center gap-2">
                                    <Package className="h-4 w-4" /> Logístico (GND 3)
                                </TabsTrigger>
                                <TabsTrigger value="racao-op" className="flex items-center gap-2">
                                    <Utensils className="h-4 w-4" /> Ração Operacional
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="logistico" className="mt-6">
                                <PTrabLogisticoReport
                                    ptrabData={ptrabData}
                                    registrosClasseI={registrosClasseI}
                                    registrosClasseII={registrosClasseII}
                                    registrosClasseIII={registrosClasseIII}
                                    nomeRM={nomeRM}
                                    omsOrdenadas={omsOrdenadas}
                                    gruposPorOM={gruposPorOM}
                                    calcularTotaisPorOM={calcularTotaisPorOM}
                                    fileSuffix="Logistico"
                                    generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada}
                                    generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo}
                                    generateClasseVMemoriaCalculo={generateClasseIIMemoriaCalculo}
                                    generateClasseVIMemoriaCalculo={generateClasseIIMemoriaCalculo}
                                    generateClasseVIIMemoriaCalculo={generateClasseIIMemoriaCalculo}
                                    generateClasseVIIIMemoriaCalculo={generateClasseIIMemoriaCalculo}
                                    generateClasseIIIMemoriaCalculo={generateClasseIIIMemoriaCalculo}
                                />
                            </TabsContent>

                            <TabsContent value="racao-op" className="mt-6">
                                <PTrabRacaoOperacionalReport
                                    ptrabData={ptrabData}
                                    registrosClasseI={registrosClasseI}
                                    fileSuffix="Racao-Op"
                                    generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada}
                                />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PTrabReportManager;