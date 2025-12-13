// ... (código anterior)

      // 4. Salvar Configurações de Classe IX (Motomecanização)
      
      // Deletar registros antigos de Classe IX
      await supabase
        .from("diretrizes_classe_ix")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const classeIXItemsParaSalvar = classeIXConfig
        .filter(item => item.item && (item.valor_mnt_dia || 0) >= 0 && (item.valor_acionamento_mensal || 0) >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: diretrizes.ano_referencia,
          categoria: item.categoria,
          item: item.item,
          // CORREÇÃO FINAL: Coerção robusta para 0 antes de Number()
          valor_mnt_dia: Number(item.valor_mnt_dia || 0),
          valor_acionamento_mensal: Number(item.valor_acionamento_mensal || 0),
          ativo: true,
        }));
        
      if (classeIXItemsParaSalvar.length > 0) {
        const { error: c9Error } = await supabase
          .from("diretrizes_classe_ix")
          .insert(classeIXItemsParaSalvar);
        if (c9Error) throw c9Error;
      }

// ... (código restante)