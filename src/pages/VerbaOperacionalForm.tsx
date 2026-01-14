// ... (imports e tipos)

// ... (funções e estados)

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
            
            verbaOperacionalSchema.parse(dataToValidate);
            
            // 2. Preparar o objeto final (calculatedData)
            const totals = calculateVerbaOperacionalTotals({
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.om_favorecida,
            } as any);
            
            const memoria = generateVerbaOperacionalMemoriaCalculo({
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            } as any);
            
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
            };
            
            if (editingId) {
                // MODO EDIÇÃO: Estagia a atualização para revisão
                const originalRecord = registros?.find(r => r.id === editingId);
                calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                
                // IMPORTANTE: NÃO ZERAR O FORMULARIO NO MODO EDIÇÃO PARA MANTER O DIRTY CHECK FUNCIONANDO
                return;
            }
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            setPendingVerbas(prev => [...prev, calculatedData]);
            
            // 5. Resetar o formulário para o próximo item, MANTENDO os dados da Seção 1 e OM Detentora
            setFormData(prev => ({
                ...prev,
                // Resetar apenas os campos de cálculo
                dias_operacao: 0, 
                quantidade_equipes: 0, 
                valor_total_solicitado: 0,
                valor_nd_30: 0,
                valor_nd_39: 0,
            }));
            
            // Resetar inputs brutos
            setRawTotalInput(numberToRawDigits(0));
            setRawND30Input(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
            
            toast.info("Item de Verba Operacional adicionado à lista pendente.");
            
        } catch (err) {
            if (err instanceof z.ZodError) {
                toast.error(err.errors[0].message);
            } else {
                toast.error(sanitizeError(err));
            }
        }
    };
    
// ... (outros handlers)

    // =================================================================
    // RENDERIZAÇÃO
    // =================================================================

// ... (código de renderização)

                            {/* SEÇÃO 3: ITENS ADICIONADOS (PENDENTES / REVISÃO DE ATUALIZAÇÃO) */}
                            {(itemsToDisplay.length > 0 || pendingVerbas.length > 0) && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isVerbaDirty && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="font-medium">
                                                Atenção: Os dados do formulário (Seção 2) foram alterados e não correspondem ao registro em revisão. Clique em "Atualizar Cálculo" na Seção 2 para estagiar a atualização.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    <div className="space-y-4">
                                        {itemsToDisplay.map((item) => {
                                            const totalND30 = item.valor_nd_30;
                                            const totalND39 = item.valor_nd_39;
                                            
                                            // Verifica se a OM Detentora é diferente da OM Favorecida
                                            const isDifferentOmInView = item.om_detentora !== item.om_favorecida;
                                            
                                            // Lógica de concordância de número
                                            const diasText = item.dias_operacao === 1 ? "dia" : "dias";
                                            const equipesText = item.quantidade_equipes === 1 ? "equipe" : "equipes";
                                            
                                            // Determina se o item é pendente (não estagiado)
                                            const isPending = !isStagingUpdate && pendingVerbas.some(p => p.tempId === item.tempId);

                                            return (
                                                <Card 
                                                    key={item.tempId} 
                                                    className={cn(
                                                        "border-2 shadow-md",
                                                        isPending ? "border-yellow-500 bg-yellow-50/50" : "border-secondary bg-secondary/10"
                                                    )}
                                                >
                                                    <CardContent className="p-4">
                                                        
                                                        <div className={cn("flex justify-between items-center pb-2 mb-2", isPending ? "border-b border-yellow-500/30" : "border-b border-secondary/30")}>
                                                            <h4 className="font-bold text-base text-foreground">
                                                                Verba Operacional {isPending ? "(PENDENTE)" : ""} ({formatCurrency(item.valor_total_solicitado)})
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-extrabold text-lg text-foreground text-right">
                                                                    {formatCurrency(item.totalGeral)}
                                                                </p>
                                                                {isPending && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => handleRemovePending(item.tempId)}
                                                                        disabled={isSaving}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Detalhes da Solicitação */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">OM Favorecida:</p>
                                                                <p className="font-medium">OM Destino:</p>
                                                                <p className="font-medium">Período / Equipes:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isDifferentOmInView ? "text-red-600 font-bold" : "text-foreground")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} {diasText} / {item.quantidade_equipes} {equipesText}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className={cn("w-full h-[1px] my-3", isPending ? "bg-yellow-500/30" : "bg-secondary/30")} />

                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                            <div className="space-y-1">
                                                                <p className="font-medium">ND 33.90.30:</p>
                                                                <p className="font-medium">ND 33.90.39:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium text-green-600">{formatCurrency(totalND30)}</p>
                                                                <p className="font-medium text-blue-600">{formatCurrency(totalND39)}</p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                        
                                        {/* REMOVIDO: O loop redundante para pendingVerbas foi removido daqui. */}
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
// ... (restante da Seção 3)