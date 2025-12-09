// ... (imports and types remain the same)

// ... (functions like calculateRemontaItemTotal, calculateSaudeItemTotal, etc. remain the same)

// ... (ClasseVIIIForm component definition)

  // ... (useEffect, loadDiretrizes, fetchRegistros, reconstructFormState, etc. remain the same)

  // ... (handleOMChange, handleOMDestinoChange, handleFaseChange, etc. remain the same)

  // ... (handleQuantityChange, handleQuantityBlur, handleDiasOperacaoChange, etc. remain the same)

  // ... (currentCategoryTotalValue, handleND39InputChange, handleND39InputBlur, etc. remain the same)

  // ... (handleUpdateCategoryItems, valorTotalSaude, valorTotalRemonta, etc. remain the same)

  // --- Save Records to Database ---
  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de Atividade (Global) deve ser maior que zero"); return; }
    if (form.itensSaude.length === 0 && form.itensRemonta.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    if (!isTotalAlocadoCorrect) {
        toast.error("O valor total dos itens não corresponde ao total alocado. Clique em 'Salvar Itens da Categoria' em todas as abas ativas.");
        return;
    }

    setLoading(true);
    
    try {
      const omToSave = form.organizacao;
      const ugToSave = form.ug;
      
      // 1. Deletar registros antigos APENAS para a OM/UG que está sendo salva
      await supabase.from("classe_viii_saude_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", omToSave) // <-- NOVO FILTRO
        .eq("ug", ugToSave); // <-- NOVO FILTRO
        
      await supabase.from("classe_viii_remonta_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", omToSave) // <-- NOVO FILTRO
        .eq("ug", ugToSave); // <-- NOVO FILTRO
      
      // 2. Inserir Saúde
      if (form.itensSaude.length > 0) {
        const allocation = categoryAllocations['Saúde'];
        const valorTotal = valorTotalSaude;
        
        const detalhamento = generateSaudeMemoriaCalculo(
            form.itensSaude, form.dias_operacao, form.organizacao, form.ug, faseFinalString,
            allocation.om_destino_recurso, allocation.ug_destino_recurso, allocation.nd_30_value, allocation.nd_39_value
        );
        
        const registroSaude: TablesInsert<'classe_viii_saude_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso,
            ug: allocation.ug_destino_recurso,
            dias_operacao: form.dias_operacao,
            categoria: 'Saúde - KPSI/KPT',
            itens_saude: form.itensSaude as any,
            valor_total: valorTotal,
            detalhamento: detalhamento,
            fase_atividade: faseFinalString,
            valor_nd_30: allocation.nd_30_value,
            valor_nd_39: allocation.nd_39_value,
        };
        await supabase.from("classe_viii_saude_registros").insert([registroSaude]);
      }
      
      // 3. Inserir Remonta/Veterinária
      if (form.itensRemonta.length > 0) {
        // ... (Restante da lógica de Remonta permanece a mesma)
        const allocation = categoryAllocations['Remonta/Veterinária'];
        const totalRemonta = valorTotalRemonta;
        
        // Agrupar itens por tipo de animal (Equino e Canino)
        const remontaItemsGrouped = form.itensRemonta.reduce((acc, item) => {
            const type = item.item.includes('Equino') ? 'Equino' : 'Canino';
            if (!acc[type]) acc[type] = [];
            acc[type].push(item);
            return acc;
        }, {} as Record<string, ItemRemonta[]>);
        
        const registrosParaInserir: TablesInsert<'classe_viii_remonta_registros'>[] = [];
        
        // Calcular totais individuais para Equino e Canino
        const valorEquino = (remontaItemsGrouped['Equino'] || []).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        const valorCanino = (remontaItemsGrouped['Canino'] || []).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        
        const totalGeralRemonta = valorEquino + valorCanino;
        
        // Calcular proporções para dividir ND 30/39
        const proporcaoEquino = totalGeralRemonta > 0 ? valorEquino / totalGeralRemonta : 0;
        const proporcaoCanino = totalGeralRemonta > 0 ? valorCanino / totalGeralRemonta : 0;
        
        const nd30Equino = allocation.nd_30_value * proporcaoEquino;
        const nd39Equino = allocation.nd_39_value * proporcaoEquino;
        
        const nd30Canino = allocation.nd_30_value * proporcaoCanino;
        const nd39Canino = allocation.nd_39_value * proporcaoCanino;
        
        // Processar Equino
        if (remontaItemsGrouped['Equino'] && remontaItemsGrouped['Equino'].length > 0) {
            const equinoItems = remontaItemsGrouped['Equino'];
            const nrAnimaisEquino = equinoItems[0].quantidade_animais;
            
            const detalhamentoEquino = generateRemontaMemoriaCalculo(
                'Equino', equinoItems, form.dias_operacao, form.organizacao, form.ug, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                nd30Equino, nd39Equino
            );
            
            registrosParaInserir.push({
                p_trab_id: ptrabId,
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                dias_operacao: form.dias_operacao,
                animal_tipo: 'Equino',
                quantidade_animais: nrAnimaisEquino,
                itens_remonta: equinoItems as any,
                valor_total: valorEquino,
                detalhamento: detalhamentoEquino,
                fase_atividade: faseFinalString,
                valor_nd_30: nd30Equino,
                valor_nd_39: nd39Equino,
            });
        }
        
        // Processar Canino
        if (remontaItemsGrouped['Canino'] && remontaItemsGrouped['Canino'].length > 0) {
            const caninoItems = remontaItemsGrouped['Canino'];
            const nrAnimaisCanino = caninoItems[0].quantidade_animais;
            
            const detalhamentoCanino = generateRemontaMemoriaCalculo(
                'Canino', caninoItems, form.dias_operacao, form.organizacao, form.ug, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                nd30Canino, nd39Canino
            );
            
            registrosParaInserir.push({
                p_trab_id: ptrabId,
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                dias_operacao: form.dias_operacao,
                animal_tipo: 'Canino',
                quantidade_animais: nrAnimaisCanino,
                itens_remonta: caninoItems as any,
                valor_total: valorCanino,
                detalhamento: detalhamentoCanino,
                fase_atividade: faseFinalString,
                valor_nd_30: nd30Canino,
                valor_nd_39: nd39Canino,
            });
        }
        
        // Ajuste final de arredondamento (garantir que a soma seja exata)
        if (registrosParaInserir.length === 2) {
            const totalND30 = allocation.nd_30_value;
            const totalND39 = allocation.nd_39_value;
            
            const somaND30 = registrosParaInserir[0].valor_nd_30 + registrosParaInserir[1].valor_nd_30;
            const somaND39 = registrosParaInserir[0].valor_nd_39 + registrosParaInserir[1].valor_nd_39;
            
            // Adiciona a diferença de arredondamento ao primeiro registro
            if (!areNumbersEqual(somaND30, totalND30)) {
                registrosParaInserir[0].valor_nd_30 += (totalND30 - somaND30);
            }
            if (!areNumbersEqual(somaND39, totalND39)) {
                registrosParaInserir[0].valor_nd_39 += (totalND39 - somaND39);
            }
        }
            
        if (registrosParaInserir.length > 0) {
            await supabase.from("classe_viii_remonta_registros").insert(registrosParaInserir);
        }
      }
      
      toast.success("Registros de Classe VIII salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields(); // Resetar o formulário para permitir novo registro
      fetchRegistros(); // Recarregar a lista de registros salvos
    } catch (error) {
      console.error("Erro ao salvar registros de Classe VIII:", error);
      toast.error("Erro ao salvar registros de Classe VIII");
    } finally {
      setLoading(false);
    }
  };

// ... (Rest of the component remains the same)