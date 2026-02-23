"use client";

// ... (manter imports e tipos inalterados)

const PTrabReportManager = () => {
  // ... (manter estados inalterados)

  const loadData = useCallback(async () => {
    // ... (lógica de verificação inicial inalterada)

    try {
      // ... (lógica de busca de dados base inalterada)

      if (ghost) {
          // Dados Mockados para o Tour
          if (selectedReport === 'logistico' || selectedReport === 'racao_operacional') {
              // ... (mock logístico inalterado)
          }
          
          if (selectedReport === 'operacional') {
              // Sincronizado com Missão 03 e 04
              // IMPORTANTE: Garantir que o group_name e detalhamento_customizado estejam presentes
              materialConsumoData = [{
                  id: 'ghost-mat', 
                  p_trab_id: 'ghost', 
                  organizacao: '1º BIS', 
                  ug: '160222', 
                  group_name: 'MATERIAL DE CONSTRUÇÃO', // Nome que aparecerá na linha da tabela
                  valor_total: 1250.50, 
                  valor_nd_30: 1250.50, 
                  valor_nd_39: 0, 
                  dias_operacao: 15, 
                  efetivo: 150, 
                  fase_atividade: 'Execução',
                  detalhamento_customizado: "Aquisição de Cimento Portland para manutenção de instalações durante a Operação SENTINELA, conforme detalhado na Missão 03. Valor total de R$ 1.250,50 baseado em cotações do PNCP."
              }];

              // Adicionando uma diária mockada para preencher o relatório
              diariaData = [{
                  id: 'ghost-diaria', p_trab_id: 'ghost', organizacao: '1º BIS', ug: '160222',
                  fase_atividade: 'Execução', valor_total: 4500.00, valor_nd_30: 4500.00,
                  destino: 'CAPITAL', quantidades_por_posto: {}, is_aereo: false
              }];
          }
          
          if (selectedReport === 'dor') {
              // ... (mock dor inalterado)
          }
      } else {
          // ... (lógica de busca via Supabase inalterada)
      }

      // ... (lógica de atualização de estados inalterada)

      if (materialConsumoData !== null) {
          setRegistrosMaterialConsumo((materialConsumoData || []).map((r: any) => ({
              ...r, 
              valor_total: Number(r.valor_total || 0), 
              valor_nd_30: Number(r.valor_nd_30 || 0),
              valor_nd_39: Number(r.valor_nd_39 || 0), 
              dias_operacao: r.dias_operacao || 0, 
              efetivo: r.efetivo || 0,
          })) as MaterialConsumoRegistro[]);
      }

      // ... (restante da função loadData inalterada)

    } catch (error) {
      // ...
    } finally {
      setLoading(false);
    }
  }, [ptrabId, selectedReport, fetchedReports, ptrabData, navigate, ghost]);

  // ... (restante do componente inalterado)
};

export default PTrabReportManager;