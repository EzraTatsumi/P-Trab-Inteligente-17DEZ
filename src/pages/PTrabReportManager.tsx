import { useState, useEffect, useCallback, useRef, useMemo } from "react";
// ... (imports omitidos para brevidade)
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
// ... (imports omitidos para brevidade)

// ... (interfaces e tipos omitidos para brevidade)

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ptrabId = searchParams.get('ptrabId');
  
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null); // NOVO: Estado para RefLPC
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');

  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
  
  const currentReportOption = useMemo(() => REPORT_OPTIONS.find(r => r.value === selectedReport)!, [selectedReport]);

  const loadData = useCallback(async () => {
    // ... (loadData logic remains the same)
  }, [ptrabId, navigate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- LÓGICA DE AGRUPAMENTO E CÁLCULO (Mantida no Manager para ser passada aos relatórios) ---
  
  // NOVO: Definindo o nome canônico da RM de forma simples e consistente
  const nomeRM = useMemo(() => {
    return ptrabData?.rm_vinculacao || '';
  }, [ptrabData]);

  const gruposPorOM = useMemo(() => {
    const grupos: Record<string, GrupoOM> = {};
    const initializeGroup = (name: string) => {
        if (!grupos[name]) {
            grupos[name] = { 
                linhasQS: [], linhasQR: [], linhasClasseII: [], linhasClasseV: [],
                linhasClasseVI: [], linhasClasseVII: [], linhasClasseVIII: [], linhasClasseIX: [],
                linhasClasseIII: [] // Inicializa a nova lista
            };
        }
    };

    // 1. Processar Classe I (Apenas Ração Quente para a tabela principal)
    // ... (Classe I logic remains the same)
    registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
        initializeGroup(registro.om_qs || registro.organizacao); // Usa OM QS como chave de destino
        grupos[registro.om_qs || registro.organizacao].linhasQS.push({ 
            registro, 
            tipo: 'QS',
            valor_nd_30: registro.total_qs,
            valor_nd_39: 0,
        });
        
        initializeGroup(registro.organizacao); // Usa OM de destino (QR) como chave de destino
        grupos[registro.organizacao].linhasQR.push({ 
            registro, 
            tipo: 'QR',
            valor_nd_30: registro.total_qr,
            valor_nd_39: 0,
        });
    });
    
    // 2. Processar Classes II, V, VI, VII, VIII, IX
    // ... (Classe II-IX logic remains the same)
    registrosClasseII.forEach((registro) => {
        // A chave de agrupamento é a OM de DESTINO do recurso (campo 'organizacao' no DB)
        initializeGroup(registro.organizacao);
        const omGroup = grupos[registro.organizacao];
        
        const linha = { 
            registro,
            valor_nd_30: registro.valor_nd_30,
            valor_nd_39: registro.valor_nd_39,
        };
        
        if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseV.push(linha);
        } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVI.push(linha);
        } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVII.push(linha);
        } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseVIII.push(linha);
        } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
            omGroup.linhasClasseIX.push(linha);
        } else {
            omGroup.linhasClasseII.push(linha);
        }
    });

    // 3. Processar Classe III (Combustível e Lubrificante) - DESAGREGAÇÃO
    registrosClasseIII.forEach((registro) => {
        const isCombustivel = registro.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
        const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
        
        if (isCombustivel || isLubrificante) {
            
            // CORREÇÃO CRÍTICA APLICADA AQUI:
            // Para Combustível, forçamos o agrupamento na chave canônica da RM.
            // Para Lubrificante, usamos a OM Detentora do Recurso (om_detentora).
            const omDestinoRecurso = isCombustivel 
                ? nomeRM // Usa o nome canônico da RM (garantindo que a chave do grupo seja a mesma usada no cálculo)
                : (registro.om_detentora || registro.organizacao);
                
            if (!omDestinoRecurso) return; // Ignora se a RM não estiver definida
            
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
  }, [registrosClasseI, registrosClasseII, registrosClasseIII, refLPC, nomeRM]); // nomeRM adicionado como dependência
  
  // A lógica de ordenação das OMs e o cálculo dos totais permanecem corretos,
  // pois agora o grupo da RM está garantido de ter a chave correta.
  
  const omsOrdenadas = useMemo(() => {
    return Object.keys(gruposPorOM).sort((a, b) => {
        const aIsRM = a === nomeRM;
        const bIsRM = b === nomeRM;
        
        if (aIsRM && !bIsRM) return -1;
        if (!aIsRM && bIsRM) return 1;
        return a.localeCompare(b);
    });
  }, [gruposPorOM, nomeRM]);
  
  const calcularTotaisPorOM = useCallback((grupo: GrupoOM, nomeOM: string) => {
    // ... (cálculos de Classe I, II, V-IX e Lubrificante permanecem os mesmos)
    
    const totalQS = grupo.linhasQS.reduce((acc, linha) => acc + linha.registro.total_qs, 0);
    const totalQR = grupo.linhasQR.reduce((acc, linha) => acc + linha.registro.total_qr, 0);
    
    const totalClasseII_ND30 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseII_ND39 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseV_ND30 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseV_ND39 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVI_ND30 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVI_ND39 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVII_ND30 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVII_ND39 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVIII_ND30 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVIII_ND39 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseIX_ND30 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseIX_ND39 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    // NOVO: Total Lubrificante (agora vem das linhas desagregadas)
    const totalLubrificante = grupo.linhasClasseIII
        .filter(l => l.tipo_suprimento === 'LUBRIFICANTE')
        .reduce((acc, linha) => acc + linha.valor_total_linha, 0);
    
    const total_33_90_30 = totalQS + totalQR + 
                           totalClasseII_ND30 + totalClasseV_ND30 + totalClasseVI_ND30 + totalClasseVII_ND30 + totalClasseVIII_ND30 + totalClasseIX_ND30 +
                           totalLubrificante; 
    
    const total_33_90_39 = totalClasseII_ND39 + totalClasseV_ND39 + totalClasseVI_ND39 + totalClasseVII_ND39 + totalClasseVIII_ND39 + totalClasseIX_ND39;
    
    const total_parte_azul = total_33_90_30 + total_33_90_39;
    
    // Combustível (Apenas na RM)
    // Como garantimos que todas as linhas de combustível estão agrupadas sob a chave nomeRM,
    // esta verificação agora deve funcionar corretamente.
    const combustivelDestaRM = (nomeOM === nomeRM) 
      ? grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL' || l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      : [];
    
    const valorDiesel = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')
      .reduce((acc, l) => acc + l.valor_total_linha, 0);
    const valorGasolina = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      .reduce((acc, l) => acc + l.valor_total_linha, 0);
    
    const totalCombustivel = valorDiesel + valorGasolina;
    
    const total_gnd3 = total_parte_azul + totalCombustivel; 
    
    const totalDieselLitros = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL')
      .reduce((acc, l) => acc + l.total_litros_linha, 0);
    const totalGasolinaLitros = combustivelDestaRM
      .filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA')
      .reduce((acc, l) => acc + l.total_litros_linha, 0);

    return {
      total_33_90_30,
      total_33_90_39,
      total_parte_azul,
      total_combustivel: totalCombustivel,
      total_gnd3,
      totalDieselLitros,
      totalGasolinaLitros,
      valorDiesel,
      valorGasolina,
    };
  }, [nomeRM]); // Dependência ajustada para nomeRM
  // --- FIM LÓGICA DE AGRUPAMENTO E CÁLCULO ---

  const renderReport = () => {
    // ... (renderReport logic remains the same)
  };

  // ... (rest of the component remains the same)
};

export default PTrabReportManager;