// ... (imports and interfaces remain the same)

  const fetchRegistros = async (): Promise<{ saude: ClasseVIIIRegistro[], remonta: ClasseVIIIRegistro[] }> => {
    if (!ptrabId) return { saude: [], remonta: [] };
    
    const [
        { data: saudeData, error: saudeError },
        { data: remontaData, error: remontaError },
    ] = await Promise.all([
        supabase
            .from("classe_viii_saude_registros")
            .select("*, itens_saude, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId),
        supabase
            .from("classe_viii_remonta_registros")
            .select("*, itens_remonta, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId),
    ]);

    if (saudeError) { console.error("Erro ao carregar Saúde:", saudeError); toast.error("Erro ao carregar registros de Saúde"); }
    if (remontaError) { console.error("Erro ao carregar Remonta:", remontaError); toast.error("Erro ao carregar registros de Remonta"); }

    const newSaudeRecords = (saudeData || []) as ClasseVIIIRegistro[];
    
    // FIX: Mapear registros de Remonta para garantir que o campo 'categoria' esteja presente,
    // pois a tabela separada pode não incluir este campo explicitamente.
    const newRemontaRecords = (remontaData || []).map(r => ({
        ...r,
        categoria: 'Remonta/Veterinária',
    })) as ClasseVIIIRegistro[];

    setRegistrosSaude(newSaudeRecords);
    setRegistrosRemonta(newRemontaRecords);
    
    return { saude: newSaudeRecords, remonta: newRemontaRecords };
  };

// ... (rest of the component remains the same)