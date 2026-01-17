// ... (imports and types remain the same)

// ... (verbaOperacionalSchema definition remains the same)

// ... (initialFormState and helper functions remain the same)

const VerbaOperacionalForm = () => {
    // ... (state definitions remain the same)

    // Dados mestres
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    // CORREÇÃO: Removendo o filtro estrito de detalhamento da queryFn para garantir que registros antigos (com detalhamento nulo) sejam carregados.
    const { data: registros, isLoading: isLoadingRegistros } = useQuery<VerbaOperacionalRegistro[]>({
        queryKey: ['verbaOperacionalRegistros', ptrabId],
        // Removido o filtro { detalhamento: 'Verba Operacional' } da queryFn
        queryFn: () => fetchPTrabRecords('verba_operacional_registros', ptrabId!), 
        enabled: !!ptrabId,
        // Filtro client-side para garantir que apenas registros de Verba Operacional (ou nulos/antigos) sejam exibidos
        select: (data) => data
            .filter(r => r.detalhamento === 'Verba Operacional' || r.detalhamento === null)
            .sort((a, b) => a.organizacao.localeCompare(b.organizacao)),
    });
    
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // ... (useEffect and calculos useMemo remain the same)

    // ... (isVerbaDirty, totalPendingVerbas, registrosAgrupadosPorOM useMemos remain the same)

    // ... (handleCurrencyChange, saveMutation, updateMutation, handleDeleteMutation remain the same)

    // ... (resetForm, handleClearPending, handleEdit, handleConfirmDelete remain the same)

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Validação Zod
            const totalSolicitado = formData.valor_total_solicitado;
            const nd30Value = formData.valor_nd_30;
            const nd39Value = calculateND39(totalSolicitado, nd30Value);
            
            const dataToValidate = {
                ...formData,
                valor_nd_39: nd39Value,
            };
            
            // CORREÇÃO CRÍTICA: Usar o schema correto para Verba Operacional
            verbaOperacionalSchema.parse(dataToValidate);
            
            // 2. Preparar o objeto final (calculatedData)
            const calculatedDataForUtils = {
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            };

            const totals = calculateVerbaOperacionalTotals(calculatedDataForUtils as any);
            const memoria = generateVerbaOperacionalMemoriaCalculo(calculatedDataForUtils as any);
            
            const calculatedData: CalculatedVerbaOperacional = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, // Mapeamento para DB
                ug: formData.ug_favorecida, // Mapeamento para DB
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                quantidade_equipes: formData.quantidade_equipes,
                valor_total_solicitado: formData.valor_total_solicitado,
                
                // Campos calculados
                valor_nd_30: totals.totalND30,
                valor_nd_39: totals.totalND39,
                
                detalhamento: "Verba Operacional",
                detalhamento_customizado: null, 
                
                // Campos de display
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                
                // Campos de detalhamento (Verba Operacional não usa estes, mas o tipo da DB exige)
                objeto_aquisicao: null,
                objeto_contratacao: null,
                proposito: null,
                finalidade: null,
                local: null,
                tarefa: null,
            };
            
            if (editingId) {
                // MODO EDIÇÃO: Estagia a atualização para revisão
                const originalRecord = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                return;
            }
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            
            // Se o formulário está sujo (diferente do último estagiado) OU se a lista está vazia, adicionamos/substituímos.
            const shouldStageNewItem = pendingVerbas.length === 0 || isVerbaDirty;

            if (shouldStageNewItem) {
                setPendingVerbas(prev => {
                    if (prev.length > 0) {
                        // Se a lista não está vazia, substitui o último item (pois o formulário está dirty)
                        return [...prev.slice(0, -1), calculatedData];
                    }
                    // Se a lista está vazia, adiciona
                    return [...prev, calculatedData];
                });
                
                // Salva o estado atual do formulário como o último estagiado
                setLastStagedFormData(formData);
                
                toast.info("Item de Verba Operacional adicionado à lista pendente.");
            } else {
                toast.info("Nenhuma alteração detectada no item pendente.");
            }
            
            // CORREÇÃO: Manter campos de contexto e manter campos de valor
            setFormData(prev => ({
                ...prev,
                // Manter campos de contexto
                om_favorecida: prev.om_favorecida,
                ug_favorecida: prev.ug_favorecida,
                om_detentora: prev.om_detentora,
                ug_detentora: prev.ug_detentora,
                fase_atividade: prev.fase_atividade,
                
                // Resetar apenas os campos de valor e numéricos
                dias_operacao: 0,
                quantidade_equipes: 0,
                valor_total_solicitado: 0,
                valor_nd_30: 0,
                valor_nd_39: 0,
            }));
            
            setRawTotalInput(numberToRawDigits(0));
            setRawND30Input(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
    // ... (remaining handlers and render logic remain the same)
};

export default VerbaOperacionalForm;