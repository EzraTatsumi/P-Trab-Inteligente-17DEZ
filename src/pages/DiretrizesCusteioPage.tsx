// ... (inside DiretrizesCusteioPage component)

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      if (!diretrizes.ano_referencia) {
        toast.error("Informe o ano de referência");
        return;
      }
      if ((diretrizes.classe_i_valor_qs || 0) <= 0 || (diretrizes.classe_i_valor_qr || 0) <= 0) {
        toast.error("Valores de Classe I devem ser maiores que zero");
        return;
      }

      const diretrizData = {
        user_id: user.id,
        ano_referencia: diretrizes.ano_referencia,
        classe_i_valor_qs: diretrizes.classe_i_valor_qs,
        classe_i_valor_qr: diretrizes.classe_i_valor_qr,
        classe_iii_fator_gerador: diretrizes.classe_iii_fator_gerador,
        classe_iii_fator_embarcacao: diretrizes.classe_iii_fator_embarcacao,
        classe_iii_fator_equip_engenharia: diretrizes.classe_iii_fator_equip_engenharia,
        observacoes: diretrizes.observacoes,
      };

      // 1. Salvar Diretrizes de Custeio (Valores e Fatores)
      // ... (omitted for brevity)
      
      // 2. Salvar Configurações de Equipamentos (Classe III)
      // ... (omitted for brevity)
      
      // 3. Salvar Configurações de Classe II, V, VI, VII e VIII (usando a mesma tabela diretrizes_classe_ii)
      
      const allClasseItems = [
        ...classeIIConfig, 
        ...classeVConfig, 
        ...classeVIConfig, 
        ...classeVIIConfig,
        ...classeVIIISaudeConfig,
        ...classeVIIIRemontaConfig,
      ];
      
      // --- NOVO: VALIDATION: Check for duplicate items in Classe II/V/VI/VII/VIII ---
      const uniqueKeysC2 = new Set<string>();
      for (const item of allClasseItems) {
          if (item.item.trim().length > 0) {
              const key = `${item.categoria}|${item.item.trim()}`;
              if (uniqueKeysC2.has(key)) {
                  toast.error(`A lista de Classe II/V/VI/VII/VIII contém itens duplicados: ${item.categoria} - ${item.item}. Por favor, use nomes únicos.`);
                  return;
              }
              uniqueKeysC2.add(key);
          }
      }
      // --- FIM VALIDAÇÃO C2 ---
        
      // Deletar registros antigos de Classe II, V, VI, VII e VIII
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const classeItemsParaSalvar = allClasseItems
        .filter(item => item.item.trim().length > 0 && (item.valor_mnt_dia || 0) >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: diretrizes.ano_referencia,
          categoria: item.categoria,
          item: item.item,
          valor_mnt_dia: Number(item.valor_mnt_dia || 0).toFixed(2), // Garantir precisão
          ativo: item.ativo ?? true, // Salvar status ativo
        }));
        
      if (classeItemsParaSalvar.length > 0) {
        const { error: c2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(classeItemsParaSalvar);
        if (c2Error) throw c2Error;
      }
      
      // 4. Salvar Configurações de Classe IX (Motomecanização)
      
      // --- NOVO: VALIDATION: Check for duplicate items in Classe IX ---
      const itemNamesIX = classeIXConfig.map(item => item.item.trim()).filter(name => name.length > 0);
      const uniqueItemNamesIX = new Set(itemNamesIX);

      if (itemNamesIX.length !== uniqueItemNamesIX.size) {
          toast.error("A lista de Classe IX contém itens duplicados. Cada item (Vtr) deve ter um nome único.");
          return;
      }
      // --- FIM VALIDAÇÃO C9 ---
      
      // Deletar registros antigos de Classe IX
      await supabase
        .from("diretrizes_classe_ix")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const classeIXItemsParaSalvar = classeIXConfig
        .filter(item => item.item.trim().length > 0 && (item.valor_mnt_dia || 0) >= 0 && (item.valor_acionamento_mensal || 0) >= 0)
        .map(item => {
          const valorMntDia = Number(item.valor_mnt_dia || 0);
          const valorAcionamentoMensal = Number(item.valor_acionamento_mensal || 0);
          
          return {
            user_id: user.id,
            ano_referencia: diretrizes.ano_referencia,
            categoria: item.categoria,
            item: item.item,
            valor_mnt_dia: valorMntDia.toFixed(2), 
            valor_acionamento_mensal: valorAcionamentoMensal.toFixed(2),
            ativo: item.ativo ?? true, // Salvar status ativo
          };
        });
        
      // Inserção individual para maior robustez
      for (const item of classeIXItemsParaSalvar) {
          const { error: c9Error } = await supabase
            .from("diretrizes_classe_ix")
            .insert([item]);
          if (c9Error) throw c9Error;
      }


      await loadAvailableYears();
    } catch (error: any) {
      if (error.code === '23505') {
        // Este erro agora deve ser capturado pela validação client-side, mas mantemos o fallback
        toast.error("Já existe uma diretriz para este ano ou um item duplicado foi inserido.");
      } else {
        toast.error(sanitizeError(error));
      }
    }
  };
// ...