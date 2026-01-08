// ... (imports e tipos)

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const PTrabReportManager = () => {
// ... (estados e hooks)

  // --- LÓGICA DE AGRUPAMENTO E CÁLCULO (Mantida no Manager para ser passada aos relatórios) ---
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
    // ... (lógica Classe I) ...
    
    // 2. Processar Classes II, V, VI, VII, VIII, IX
    // ... (lógica Classes II, V-IX) ...

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
  }, [registrosClasseI, registrosClasseII, registrosClasseIII, refLPC, nomeRM]); // nomeRM adicionado como dependência
  
// ... (restante do componente)