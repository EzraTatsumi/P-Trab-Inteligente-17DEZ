// ... (imports e tipos)

// ... (funções e estados)

    // Adiciona o item calculado à lista pendente OU prepara a atualização (staging)
    const handleStageCalculation = (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // 1. Recalcular ND 30 (dependente)
            const totalSolicitado = formData.valor_total_solicitado;
            const nd39Value = formData.valor_nd_39;
            const nd30Value = calculateND30(totalSolicitado, nd39Value);
            
            const dataToValidate = {
                ...formData,
                valor_nd_30: nd30Value, // Usar o valor calculado para validação
            };
            
            // 2. Validação Zod
            suprimentoFundosSchema.parse(dataToValidate);
            
            // 3. Preparar o objeto final (calculatedData)
            const calculatedDataForUtils = {
                ...dataToValidate,
                organizacao: dataToValidate.om_favorecida,
                ug: dataToValidate.ug_favorecida,
            };

            const totals = calculateSuprimentoFundosTotals(calculatedDataForUtils as any);
            const memoria = generateSuprimentoFundosMemoriaCalculo(calculatedDataForUtils as any);
            
            const calculatedData: CalculatedSuprimentoFundos = {
                tempId: editingId || Math.random().toString(36).substring(2, 9), 
                p_trab_id: ptrabId!,
                organizacao: formData.om_favorecida, 
                ug: formData.ug_favorecida, 
                om_detentora: formData.om_detentora,
                ug_detentora: formData.ug_detentora,
                dias_operacao: formData.dias_operacao,
                fase_atividade: formData.fase_atividade,
                quantidade_equipes: formData.quantidade_equipes, // CORRIGIDO
                valor_total_solicitado: formData.valor_total_solicitado,
                
                valor_nd_30: totals.totalND30,
                valor_nd_39: totals.totalND39,
                
                detalhamento: "Suprimento de Fundos",
                detalhamento_customizado: null, 
                
                totalGeral: totals.totalGeral,
                memoria_calculo_display: memoria, 
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                
                // Incluir campos de detalhamento no objeto a ser salvo/estagiado
                objeto_aquisicao: formData.objeto_aquisicao,
                objeto_contratacao: formData.objeto_contratacao,
                proposito: formData.proposito,
                finalidade: formData.finalidade,
                local: formData.local,
                tarefa: formData.tarefa,
            } as CalculatedSuprimentoFundos;
            
            if (editingId) {
                const originalRecord = registros?.find(r => r.id === editingId);
                
                // Se o detalhamento_customizado for um texto (memória customizada), preservamos.
                try {
                    JSON.parse(originalRecord?.detalhamento_customizado || "");
                    // Se o parse for bem-sucedido, o detalhamento_customizado é o JSON de detalhes, então a memória inicial é a automática
                } catch (e) {
                    // Se falhar, é um texto customizado (memória), preservamos
                    calculatedData.detalhamento_customizado = originalRecord?.detalhamento_customizado || null;
                }
                
                setStagedUpdate(calculatedData);
                toast.info("Cálculo atualizado. Revise e confirme a atualização na Seção 3.");
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); 
                
                // IMPORTANTE: NÃO ZERAR O FORMULARIO NO MODO EDIÇÃO PARA MANTER O DIRTY CHECK FUNCIONANDO
                return;
            }
            
            // MODO ADIÇÃO: Adicionar à lista pendente
            setPendingSuprimentos(prev => [...prev, calculatedData]);
            
            // 5. Resetar o formulário para o próximo item, MANTENDO os dados da Seção 1 e OM Detentora
            setFormData(prev => ({
                ...prev,
                // Resetar apenas os campos de cálculo e detalhamento
                dias_operacao: 0, 
                quantidade_equipes: 0, 
                valor_total_solicitado: 0,
                valor_nd_30: 0,
                valor_nd_39: 0,
                objeto_aquisicao: "",
                objeto_contratacao: "",
                proposito: "",
                finalidade: "",
                local: "",
                tarefa: "",
            }));
            
            setRawTotalInput(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
            
            toast.info("Item de Suprimento de Fundos adicionado à lista pendente.");
            
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
                            {(itemsToDisplay.length > 0 || pendingSuprimentos.length > 0) && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        3. Itens Adicionados ({itemsToDisplay.length})
                                    </h3>
                                    
                                    {/* Alerta de Validação Final (Apenas em modo de edição) */}
                                    {editingId && isSuprimentoDirty && (
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
                                            const efetivoText = item.quantidade_equipes === 1 ? "militar" : "militares"; // ALTERADO
                                            
                                            // Determina se o item é pendente (não estagiado)
                                            const isPending = !isStagingUpdate && pendingSuprimentos.some(p => p.tempId === item.tempId);

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
                                                                Suprimento de Fundos {isPending ? "(PENDENTE)" : ""} ({formatCurrency(item.valor_total_solicitado)})
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
                                                                <p className="font-medium">Período / Efetivo:</p>
                                                            </div>
                                                            <div className="text-right space-y-1">
                                                                <p className="font-medium">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                                <p className={cn("font-medium", isDifferentOmInView ? "text-red-600 font-bold" : "text-foreground")}>
                                                                    {item.om_detentora} ({formatCodug(item.ug_detentora)})
                                                                </p>
                                                                <p className="font-medium">{item.dias_operacao} dias / {item.quantidade_equipes} militares</p>
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
                                        
                                    </div>
                                    
                                    {/* VALOR TOTAL DA OM (PENDENTE / STAGING) */}
                                    {/* ... (restante da Seção 3) */}
                                    
                                    {/* Lógica de Totais e Botões de Ação (Mantida) */}
                                    <div className="mt-6 p-4 border rounded-lg bg-card shadow-inner">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-lg font-bold">Total a Salvar</h4>
                                            <p className="text-2xl font-extrabold text-primary">
                                                {formatCurrency(totalPendingGeral)}
                                            </p>
                                        </div>
                                        
                                        <div className="flex justify-end space-x-2">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                onClick={handleCancelEdit}
                                                disabled={isSaving || !editingId}
                                            >
                                                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Edição
                                            </Button>
                                            <Button 
                                                onClick={handleSaveAll} 
                                                disabled={isSaving || itemsToDisplay.length === 0}
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="mr-2 h-4 w-4" />
                                                )}
                                                {editingId ? "Confirmar Atualização" : `Salvar ${itemsToDisplay.length} Registros`}
                                            </Button>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SuprimentoFundosForm;