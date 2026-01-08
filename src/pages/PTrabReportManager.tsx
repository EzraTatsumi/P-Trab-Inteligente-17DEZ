import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tables } from "@/integrations/supabase/types";
import { fetchPTrabData, fetchPTrabRecords, fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { calculateDays, formatDate, formatCodug, formatDateDDMMMAA } from "@/lib/formatUtils";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { generateRacaoQuenteMemoriaCalculo, generateRacaoOperacionalMemoriaCalculo, calculateDiasEtapaSolicitada } from "@/lib/classeIUtils";
import { generateDetalhamento as generateClasseIIDetailing, generateCategoryMemoriaCalculo as generateClasseIIMemoriaCalculoUtility } from "@/lib/classeIIUtils";
import { generateDetalhamento as generateClasseVDetailing, generateCategoryMemoriaCalculo as generateClasseVMemoriaCalculoUtility } from "@/lib/classeVUtils";
import { generateDetalhamento as generateClasseVIDetailing, generateCategoryMemoriaCalculo as generateClasseVIMemoriaCalculoUtility } from "@/lib/classeVIUtils";
import { generateDetalhamento as generateClasseVIIDetailing, generateCategoryMemoriaCalculo as generateClasseVIIMemoriaCalculoUtility } from "@/lib/classeVIIUtils";
import { generateDetalhamento as generateClasseVIIIDetailing, generateCategoryMemoriaCalculo as generateClasseVIIIMemoriaCalculoUtility } from "@/lib/classeVIIIUtils";
import { generateDetalhamento as generateClasseIXDetailing, generateCategoryMemoriaCalculo as generateClasseIXMemoriaCalculoUtility } from "@/lib/classeIXUtils";
import { calculateItemTotals, generateGranularMemoriaCalculo as generateClasseIIIGranularUtility } from "@/lib/classeIIIUtils";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import PTrabDiariaReport from "@/components/reports/PTrabDiariaReport";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefLPC } from "@/types/refLPC";
import { DiariaRegistro } from "./DiariaForm"; // Importar o tipo DiariaRegistro

// =================================================================
// TIPOS DE DADOS
// =================================================================

export type PTrabData = Tables<'p_trab'>;
export type ClasseIRegistro = Tables<'classe_i_registros'>;
export type ClasseIIRegistro = Tables<'classe_ii_registros'> & {
    categoria: string; // Sobrescreve para garantir que a categoria é string
    animal_tipo?: 'Equino' | 'Canino'; // Para Classe VIII Remonta
};
export type ClasseIIIRegistro = Tables<'classe_iii_registros'>;
export type ClasseIXRegistro = Tables<'classe_ix_registros'>;

// Tipo para os itens detalhados dentro do JSONB da Classe III
interface ItemClasseIII {
    item: string;
    categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
    consumo_fixo: number;
    tipo_combustivel_fixo: 'GASOLINA' | 'DIESEL';
    unidade_fixa: 'L/h' | 'km/L';
    quantidade: number;
    horas_dia: number;
    distancia_percorrida: number;
    quantidade_deslocamentos: number;
    dias_utilizados: number;
    consumo_lubrificante_litro: number;
    preco_lubrificante: number;
    memoria_customizada?: string | null;
}

// Tipo para a linha desagregada de Classe III (para a tabela)
export interface LinhaClasseIII {
    registro: ClasseIIIRegistro;
    categoria_equipamento: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
    tipo_suprimento: 'COMBUSTIVEL_DIESEL' | 'COMBUSTIVEL_GASOLINA' | 'LUBRIFICANTE';
    valor_total_linha: number;
    total_litros_linha: number;
    preco_litro_linha: number;
    memoria_calculo: string;
}

// Tipo para a linha desagregada de Classe I (para a tabela)
interface LinhaTabela {
    registro: ClasseIRegistro;
    tipo: 'QS' | 'QR';
}

// Tipo para a linha desagregada de Classes II, V, VI, VII, VIII, IX (para a tabela)
interface LinhaClasseII {
    registro: ClasseIIRegistro;
}

// Tipo para o agrupamento por OM
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

// Tipo para o item granular usado na geração de memória da Classe III
interface GranularDisplayItem {
    id: string;
    om_destino: string;
    ug_destino: string;
    categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
    suprimento_tipo: 'COMBUSTIVEL_DIESEL' | 'COMBUSTIVEL_GASOLINA' | 'LUBRIFICANTE';
    valor_total: number;
    total_litros: number;
    preco_litro: number;
    dias_operacao: number;
    fase_atividade: string;
    valor_nd_30: number;
    valor_nd_39: number;
    original_registro: ClasseIIIRegistro;
    detailed_items: ItemClasseIII[];
}

// Constantes de Categorias (para validação)
export const CLASSE_V_CATEGORIES = ['Armt L', 'Armt P', 'IODCT', 'DQBRN'];
export const CLASSE_VI_CATEGORIES = ['Embarcação', 'Equipamento de Engenharia', 'Gerador'];
export const CLASSE_VII_CATEGORIES = ['Comunicações', 'Informática'];
export const CLASSE_VIII_CATEGORIES = ['Saúde', 'Remonta/Veterinária'];
export const CLASSE_IX_CATEGORIES = ['Vtr Administrativa', 'Vtr Operacional', 'Motocicleta', 'Vtr Blindada'];

// =================================================================
// FUNÇÕES AUXILIARES DE MEMÓRIA (Para passar aos relatórios)
// =================================================================

/**
 * Gera a memória de cálculo para Classe I (QS, QR ou OP).
 */
const generateClasseIMemoriaCalculo = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (tipo === 'OP') {
        return registro.memoria_calculo_op_customizada || generateRacaoOperacionalMemoriaCalculo(registro);
    }
    
    const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
    
    if (tipo === 'QS') {
        return registro.memoria_calculo_qs_customizada || qs;
    }
    
    return registro.memoria_calculo_qr_customizada || qr;
};

/**
 * Gera a memória de cálculo para Classes II, V, VI, VII, VIII, IX.
 */
const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro, isClasseII: boolean): string => {
    if (registro.detalhamento_customizado) {
        return registro.detalhamento_customizado;
    }
    
    const { categoria, itens_equipamentos, dias_operacao, om_detentora, ug_detentora, fase_atividade, efetivo, valor_nd_30, valor_nd_39 } = registro;
    
    if (CLASSE_V_CATEGORIES.includes(categoria)) {
        return generateClasseVMemoriaCalculoUtility(
            categoria as any, itens_equipamentos as any, dias_operacao, om_detentora || registro.organizacao, ug_detentora || registro.ug, fase_atividade, efetivo || 0, valor_nd_30, valor_nd_39
        );
    }
    if (CLASSE_VI_CATEGORIES.includes(categoria)) {
        return generateClasseVIMemoriaCalculoUtility(
            categoria as any, itens_equipamentos as any, dias_operacao, om_detentora || registro.organizacao, ug_detentora || registro.ug, fase_atividade, efetivo || 0, valor_nd_30, valor_nd_39
        );
    }
    if (CLASSE_VII_CATEGORIES.includes(categoria)) {
        return generateClasseVIIMemoriaCalculoUtility(
            categoria as any, itens_equipamentos as any, dias_operacao, om_detentora || registro.organizacao, ug_detentora || registro.ug, fase_atividade, efetivo || 0, valor_nd_30, valor_nd_39
        );
    }
    if (CLASSE_VIII_CATEGORIES.includes(categoria)) {
        const itens = categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
        return generateClasseVIIIMemoriaCalculoUtility(
            categoria as any, itens as any, dias_operacao, om_detentora || registro.organizacao, ug_detentora || registro.ug, fase_atividade, efetivo || 0, valor_nd_30, valor_nd_39, registro.animal_tipo
        );
    }
    if (CLASSE_IX_CATEGORIES.includes(categoria)) {
        return generateClasseIXMemoriaCalculoUtility(
            categoria as any, registro.itens_motomecanizacao as any, dias_operacao, om_detentora || registro.organizacao, ug_detentora || registro.ug, fase_atividade, efetivo || 0, valor_nd_30, valor_nd_39
        );
    }
    
    // Default para Classe II
    return generateClasseIIMemoriaCalculoUtility(
        categoria as any, itens_equipamentos as any, dias_operacao, om_detentora || registro.organizacao, ug_detentora || registro.ug, fase_atividade, efetivo || 0, valor_nd_30, valor_nd_39
    );
};

/**
 * Gera a memória de cálculo para Classe III (Combustível/Lubrificante) - Consolidada.
 */
const generateClasseIIIMemoriaCalculo = (registro: ClasseIIIRegistro): string => {
    return registro.detalhamento_customizado || registro.detalhamento || "Memória de cálculo não disponível.";
};

/**
 * Retorna o rótulo do tipo de combustível para a tabela.
 */
export const getTipoCombustivelLabel = (tipo: LinhaClasseIII['tipo_suprimento']): string => {
    switch (tipo) {
        case 'COMBUSTIVEL_DIESEL': return 'DIESEL';
        case 'COMBUSTIVEL_GASOLINA': return 'GASOLINA';
        case 'LUBRIFICANTE': return 'LUBRIFICANTE';
        default: return 'CLASSE III';
    }
};

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabReportManager = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const [selectedTab, setSelectedTab] = useState("logistico");
    
    // Estados de dados
    const [ptrabData, setPTrabData] = useState<PTrabData | null>(null);
    const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
    const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
    const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
    const [registrosDiaria, setRegistrosDiaria] = useState<DiariaRegistro[]>([]);
    const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const { data: diretrizYearData } = useDefaultDiretrizYear();
    const anoReferencia = diretrizYearData?.year;

    const loadData = useCallback(async () => {
        if (!ptrabId) {
            setError("ID do P Trab não fornecido.");
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            setError(null);
            
            const [
                ptrab, 
                classeI, 
                classeII, 
                classeIII, 
                classeV, 
                classeVI, 
                classeVII, 
                classeVIIISaude, 
                classeVIIIRemonta, 
                classeIX,
                diaria,
                refLPCData
            ] = await Promise.all([
                fetchPTrabData(ptrabId),
                fetchPTrabRecords('classe_i_registros', ptrabId),
                fetchPTrabRecords('classe_ii_registros', ptrabId),
                fetchPTrabRecords('classe_iii_registros', ptrabId),
                fetchPTrabRecords('classe_v_registros', ptrabId),
                fetchPTrabRecords('classe_vi_registros', ptrabId),
                fetchPTrabRecords('classe_vii_registros', ptrabId),
                fetchPTrabRecords('classe_viii_saude_registros', ptrabId),
                fetchPTrabRecords('classe_viii_remonta_registros', ptrabId),
                fetchPTrabRecords('classe_ix_registros', ptrabId),
                fetchPTrabRecords('diaria_registros', ptrabId),
                supabase.from('p_trab_ref_lpc').select('*').eq('p_trab_id', ptrabId).maybeSingle().then(res => res.data as RefLPC | null),
            ]);
            
            setPTrabData(ptrab);
            setRegistrosClasseI(classeI as ClasseIRegistro[]);
            setRegistrosClasseIII(classeIII as ClasseIIIRegistro[]);
            setRegistrosDiaria(diaria as DiariaRegistro[]);
            setRefLPC(refLPCData);
            
            // Consolidar todas as classes de manutenção (II, V, VI, VII, VIII, IX)
            const allMaintenanceRecords: ClasseIIRegistro[] = [
                ...(classeII as ClasseIIRegistro[]),
                ...(classeV as ClasseIIRegistro[]),
                ...(classeVI as ClasseIIRegistro[]),
                ...(classeVII as ClasseIIRegistro[]),
                // Mapeamento Classe VIII Saúde
                ...(classeVIIISaude as Tables<'classe_viii_saude_registros'>[]).map(r => ({
                    ...r,
                    categoria: 'Saúde',
                    itens_equipamentos: r.itens_saude,
                })),
                // Mapeamento Classe VIII Remonta
                ...(classeVIIIRemonta as Tables<'classe_viii_remonta_registros'>[]).map(r => ({
                    ...r,
                    categoria: 'Remonta/Veterinária',
                    itens_equipamentos: r.itens_remonta,
                    animal_tipo: r.animal_tipo,
                })),
                // Mapeamento Classe IX
                ...(classeIX as Tables<'classe_ix_registros'>[]).map(r => ({
                    ...r,
                    categoria: r.categoria,
                    itens_equipamentos: r.itens_motomecanizacao,
                })),
            ];
            
            setRegistrosClasseII(allMaintenanceRecords);
            
        } catch (err: any) {
            console.error("Erro ao carregar dados do P Trab para relatório:", err);
            setError(err.message || "Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [ptrabId]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    // --- LÓGICA DE AGRUPAMENTO E CÁLCULO (Mantida no Manager para ser passada aos relatórios) ---
    
    const nomeRM = ptrabData?.rm_vinculacao || 'RM Desconhecida';

    const gruposPorOM = useMemo(() => {
        const grupos: Record<string, GrupoOM> = {};
        const initializeGroup = (name: string) => {
            if (!grupos[name]) {
                grupos[name] = { 
                    linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [],
                    linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [],
                    linhasClasseIII: []
                };
            }
        };

        // 1. Processar Classe I (Apenas Ração Quente para a tabela principal)
        registrosClasseI.forEach((registro) => {
            if (registro.categoria === 'RACAO_QUENTE') {
                const omDestino = registro.organizacao;
                const omQS = registro.om_qs || omDestino;
                const omQR = registro.organizacao;
                
                // Linha QS
                initializeGroup(omQS);
                grupos[omQS].linhasQS.push({ registro, tipo: 'QS' });
                
                // Linha QR
                initializeGroup(omQR);
                grupos[omQR].linhasQR.push({ registro, tipo: 'QR' });
            }
        });
        
        // 2. Processar Classes II, V, VI, VII, VIII, IX
        registrosClasseII.forEach((registro) => {
            const omDestino = registro.organizacao;
            initializeGroup(omDestino);
            
            const linha: LinhaClasseII = { registro };
            
            if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
                grupos[omDestino].linhasClasseV.push(linha);
            } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
                grupos[omDestino].linhasClasseVI.push(linha);
            } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
                grupos[omDestino].linhasClasseVII.push(linha);
            } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
                grupos[omDestino].linhasClasseVIII.push(linha);
            } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                grupos[omDestino].linhasClasseIX.push(linha);
            } else {
                grupos[omDestino].linhasClasseII.push(linha);
            }
        });

        // 3. Processar Classe III (Combustível e Lubrificante) - DESAGREGAÇÃO
        registrosClasseIII.forEach((registro) => {
            const isCombustivel = registro.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
            const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
            
            if (isCombustivel || isLubrificante) {
                
                let omDestinoRecurso: string;
                
                if (isCombustivel) {
                    // CORREÇÃO CRÍTICA: Para Combustível, o destino do recurso é SEMPRE a RM (nomeRM), 
                    // pois é a RM que fornece e onde o total deve ser exibido no subtotal.
                    omDestinoRecurso = nomeRM; 
                } else {
                    // Para Lubrificante, o destino do recurso é a OM Detentora (om_detentora) ou a OM que usa (organizacao).
                    omDestinoRecurso = registro.om_detentora || registro.organizacao;
                }
                
                if (!omDestinoRecurso) return; // Safety check
                
                initializeGroup(omDestinoRecurso);
                
                const itens = registro.itens_equipamentos || [];
                
                // Agrupamento por Categoria de Equipamento (para Lubrificante) ou Tipo de Combustível (para Combustível)
                const gruposGranulares: Record<string, ItemClasseIII[]> = {};
                
                // Agrupa por Categoria de Equipamento (Gerador, Embarcação, etc.)
                itens.forEach(item => {
                    const key = item.categoria;
                    if (!gruposGranulares[key]) gruposGranulares[key] = [];
                    gruposGranulares[key].push(item);
                });
                
                // Cria uma LinhaClasseIII para cada grupo granular
                Object.entries(gruposGranulares).forEach(([categoriaKey, itensGrupo]) => {
                    if (itensGrupo.length === 0) return;
                    
                    const primeiroItem = itensGrupo[0];
                    
                    // Recalcular totais para esta linha granular
                    let totalLitrosLinha = 0;
                    let valorTotalLinha = 0;
                    let precoLitroLinha = 0;
                    
                    itensGrupo.forEach(item => {
                        const totals = calculateItemTotals(item, refLPC, registro.dias_operacao);
                        if (isCombustivel) {
                            // Combustível: Agrupa por tipo de combustível (Diesel/Gasolina)
                            if (item.tipo_combustivel_fixo === registro.tipo_combustivel) {
                                totalLitrosLinha += totals.totalLitros;
                                valorTotalLinha += totals.valorCombustivel;
                                precoLitroLinha = totals.precoLitro; // Preço é o mesmo para o tipo de combustível
                            }
                        } else if (isLubrificante) {
                            // Lubrificante: Agrupa por categoria (Gerador/Embarcação)
                            totalLitrosLinha += totals.litrosLubrificante;
                            valorTotalLinha += totals.valorLubrificante;
                            // Para Lubrificante, o preço unitário é o preço médio (valor total / litros)
                            precoLitroLinha = totalLitrosLinha > 0 ? valorTotalLinha / totalLitrosLinha : 0;
                        }
                    });
                    
                    // Se o valor total for zero, ignora a linha (pode acontecer se o item for de outro tipo de combustível no registro consolidado)
                    if (valorTotalLinha === 0) return;

                    const tipoSuprimento: LinhaClasseIII['tipo_suprimento'] = isCombustivel 
                        ? (primeiroItem.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL')
                        : 'LUBRIFICANTE';
                    
                    // Gerar a memória de cálculo para esta linha granular
                    let memoriaCalculo = "";
                    
                    // Para Combustível, a OM Destino Recurso é a RM de Fornecimento (om_detentora/ug_detentora)
                    const omDestinoCombustivel = registro.om_detentora || '';
                    const ugDestinoCombustivel = registro.ug_detentora || '';
                    
                    // Para Lubrificante, a OM Destino Recurso é a om_detentora/ug_detentora
                    const omDestinoLubrificante = registro.om_detentora || '';
                    const ugDestinoLubrificante = registro.ug_detentora || '';
                    
                    // Criar o item granular para a função de memória
                    const granularItem: GranularDisplayItem = {
                        id: `${registro.id}-${categoriaKey}-${tipoSuprimento}`,
                        om_destino: registro.organizacao, // OM Detentora do Equipamento
                        ug_destino: registro.ug, // UG Detentora do Equipamento
                        categoria: categoriaKey as any,
                        suprimento_tipo: tipoSuprimento,
                        valor_total: valorTotalLinha,
                        total_litros: totalLitrosLinha,
                        preco_litro: precoLitroLinha,
                        dias_operacao: registro.dias_operacao,
                        fase_atividade: registro.fase_atividade || '',
                        valor_nd_30: isCombustivel ? valorTotalLinha : (isLubrificante ? valorTotalLinha : 0),
                        valor_nd_39: 0,
                        original_registro: registro,
                        detailed_items: itensGrupo,
                    };
                    
                    // Tenta usar a memória customizada do primeiro item do grupo (se houver)
                    const itemComMemoria = itensGrupo.find(i => !!i.memoria_customizada) || itensGrupo[0];
                    if (itemComMemoria && itemComMemoria.memoria_customizada && itemComMemoria.memoria_customizada.trim().length > 0) {
                        memoriaCalculo = itemComMemoria.memoria_customizada;
                    } else {
                        // Gera a memória automática granular
                        memoriaCalculo = generateClasseIIIGranularUtility(
                            granularItem, 
                            refLPC, 
                            isCombustivel ? omDestinoCombustivel : omDestinoLubrificante, 
                            isCombustivel ? ugDestinoCombustivel : ugDestinoLubrificante
                        );
                    }
                    
                    // Adiciona a linha desagregada ao grupo da OM de destino do recurso
                    grupos[omDestinoRecurso].linhasClasseIII.push({
                        registro,
                        categoria_equipamento: categoriaKey as any,
                        tipo_suprimento: tipoSuprimento,
                        valor_total_linha: valorTotalLinha,
                        total_litros_linha: totalLitrosLinha,
                        preco_litro_linha: precoLitroLinha,
                        memoria_calculo: memoriaCalculo,
                    });
                });
            }
        });
        
        return grupos;
    }, [registrosClasseI, registrosClasseII, registrosClasseIII, refLPC, nomeRM]);

    // 4. Calcular Totais por OM (Função passada para o relatório)
    const calcularTotaisPorOM = useCallback((grupo: GrupoOM, nomeOM: string) => {
        let total_33_90_30 = 0;
        let total_33_90_39 = 0;
        let total_combustivel = 0;
        let totalDieselLitros = 0;
        let totalGasolinaLitros = 0;
        let valorDiesel = 0;
        let valorGasolina = 0;

        // Classe I (QS/QR) - ND 33.90.30
        total_33_90_30 += grupo.linhasQS.reduce((sum, l) => sum + (l.registro.total_qs || 0), 0);
        total_33_90_30 += grupo.linhasQR.reduce((sum, l) => sum + (l.registro.total_qr || 0), 0);

        // Classes II, V, VI, VII, VIII, IX
        const allMaintenanceLines = [
            ...grupo.linhasClasseII, 
            ...grupo.linhasClasseV, 
            ...grupo.linhasClasseVI, 
            ...grupo.linhasClasseVII, 
            ...grupo.linhasClasseVIII, 
            ...grupo.linhasClasseIX
        ];
        
        allMaintenanceLines.forEach(linha => {
            total_33_90_30 += (linha.registro.valor_nd_30 || 0);
            total_33_90_39 += (linha.registro.valor_nd_39 || 0);
        });
        
        // Classe III (Lubrificante) - ND 33.90.30
        grupo.linhasClasseIII.forEach(linha => {
            if (linha.tipo_suprimento === 'LUBRIFICANTE') {
                total_33_90_30 += linha.valor_total_linha;
            }
        });

        // Classe III (Combustível) - Agregado apenas na RM (nomeRM)
        if (nomeOM === nomeRM) {
            grupo.linhasClasseIII.forEach(linha => {
                if (linha.tipo_suprimento === 'COMBUSTIVEL_DIESEL') {
                    total_combustivel += linha.valor_total_linha;
                    totalDieselLitros += linha.total_litros_linha;
                    valorDiesel += linha.valor_total_linha;
                } else if (linha.tipo_suprimento === 'COMBUSTIVEL_GASOLINA') {
                    total_combustivel += linha.valor_total_linha;
                    totalGasolinaLitros += linha.total_litros_linha;
                    valorGasolina += linha.valor_total_linha;
                }
            });
        }

        const total_parte_azul = total_33_90_30 + total_33_90_39;
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

    // 5. Ordenar OMs para o relatório
    const omsOrdenadas = useMemo(() => {
        if (!ptrabData) return [];
        
        const omKeys = Object.keys(gruposPorOM);
        
        // 1. Coloca a RM de vinculação no topo
        const rmIndex = omKeys.indexOf(nomeRM);
        if (rmIndex > -1) {
            omKeys.splice(rmIndex, 1);
            omKeys.unshift(nomeRM);
        }
        
        // 2. Ordena as demais OMs alfabeticamente
        const demaisOms = omKeys.slice(1).sort((a, b) => a.localeCompare(b));
        
        return [nomeRM, ...demaisOms].filter(Boolean);
    }, [gruposPorOM, ptrabData, nomeRM]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Preparando relatórios...</span>
            </div>
        );
    }

    if (error || !ptrabData) {
        return (
            <div className="min-h-screen bg-background p-8">
                <Button variant="ghost" onClick={() => navigate('/ptrab')} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro ao carregar P Trab</AlertTitle>
                    <AlertDescription>{error || "Dados do P Trab não encontrados."}</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // Filtra registros de Ração Operacional
    const registrosRacaoOp = registrosClasseI.filter(r => r.categoria === 'RACAO_OPERACIONAL');

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 print:p-0">
            <div className="max-w-7xl mx-auto space-y-6 print:max-w-full">
                <div className="flex items-center justify-between print:hidden">
                    <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-2">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Edição
                    </Button>
                    <Button variant="outline" onClick={loadData} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recarregar Dados
                    </Button>
                </div>

                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="print:hidden">
                        <CardTitle>Relatórios do P Trab: {ptrabData.numero_ptrab}</CardTitle>
                        <CardDescription>
                            {ptrabData.nome_operacao} | Período: {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 print:p-0">
                        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full print:hidden">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="logistico">Logístico (GND 3)</TabsTrigger>
                                <TabsTrigger value="racao-op">Ração Operacional</TabsTrigger>
                                <TabsTrigger value="diaria">Diárias (ND 15)</TabsTrigger>
                            </TabsList>
                            
                            {/* ABA LOGÍSTICA */}
                            <TabsContent value="logistico" className="pt-4">
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
                                    generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo}
                                    generateClasseIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, true)}
                                    generateClasseVMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                    generateClasseVIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                    generateClasseVIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                    generateClasseVIIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                    generateClasseIIIMemoriaCalculo={generateClasseIIIMemoriaCalculo}
                                />
                            </TabsContent>
                            
                            {/* ABA RAÇÃO OPERACIONAL */}
                            <TabsContent value="racao-op" className="pt-4">
                                <PTrabRacaoOperacionalReport
                                    ptrabData={ptrabData}
                                    registrosClasseI={registrosRacaoOp}
                                    fileSuffix="RacaoOp"
                                    generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo}
                                />
                            </TabsContent>
                            
                            {/* ABA DIÁRIAS */}
                            <TabsContent value="diaria" className="pt-4">
                                <PTrabDiariaReport
                                    ptrabData={ptrabData}
                                    registrosDiaria={registrosDiaria}
                                    fileSuffix="Diaria"
                                />
                            </TabsContent>
                        </Tabs>
                        
                        {/* Conteúdo de Impressão (Visível apenas no print) */}
                        <div className="hidden print:block">
                            {/* Logístico */}
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
                                generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo}
                                generateClasseIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, true)}
                                generateClasseVMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                generateClasseVIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                generateClasseVIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                generateClasseVIIIMemoriaCalculo={(registro) => generateClasseIIMemoriaCalculo(registro, false)}
                                generateClasseIIIMemoriaCalculo={generateClasseIIIMemoriaCalculo}
                            />
                            
                            {/* Ração Operacional */}
                            {registrosRacaoOp.length > 0 && (
                                <div className="page-break-before">
                                    <PTrabRacaoOperacionalReport
                                        ptrabData={ptrabData}
                                        registrosClasseI={registrosRacaoOp}
                                        fileSuffix="RacaoOp"
                                        generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo}
                                    />
                                </div>
                            )}
                            
                            {/* Diárias */}
                            {registrosDiaria.length > 0 && (
                                <div className="page-break-before">
                                    <PTrabDiariaReport
                                        ptrabData={ptrabData}
                                        registrosDiaria={registrosDiaria}
                                        fileSuffix="Diaria"
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <style>{`
                @media print {
                    .page-break-before {
                        page-break-before: always;
                    }
                }
            `}</style>
        </div>
    );
};

export default PTrabReportManager;