// ... (imports e tipos)

const ClasseIIIForm = () => {
// ... (estados e hooks)

// ... (loadInitialData, loadAllDiretrizItems, loadRefLPC, handleRefLPCUpdate, fetchRegistros, reconstructFormState, resetFormFields, handleOMChange, handleOMLubrificanteChange, handleRMFornecimentoChange, handleFaseChange, handleFormNumericChange, handleItemFieldChange, handleItemNumericChange, handleOpenLubricantPopover, handleConfirmLubricant, handleCancelLubricant, handleUpdateCategoryItems, useMemo calculations, handleSalvarRegistros, handleDeletarConsolidado, handleEditarConsolidado, handleIniciarEdicaoMemoria, handleCancelarEdicaoMemoria, handleSalvarMemoriaCustomizada, handleRestaurarMemoriaAutomatica, isFormValid, displayFases, getTipoLabel, getSuprimentoLabel, getSuprimentoBadgeClass, getCombustivelBadgeClass, calculatedLubricantTotal, omDetentoraKey, omDetentoraDetails, omDetentoraRmVinculacao, isCombustivelDifferentOm, combustivelDestinoTextClass, isLubrificanteDifferentOm, lubrificanteDestinoTextClass, categoryLabelMap)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* ... (Seção 1, 2, 3) */}
            
            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION (NOVO LAYOUT) */}
            {Object.keys(registrosAgrupadosPorSuprimento).length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  OMs Cadastradas
                </h2>
                
                {Object.entries(registrosAgrupadosPorSuprimento).map(([omKey, group]) => {
                  const omName = group.om;
                  const ug = group.ug;
                  
                  return (
                    <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-center justify-between mb-3 border-b pb-2">
                        <h3 className="font-bold text-lg text-primary">
                          OM Detentora: {omName} (UG: {formatCodug(ug)})
                        </h3>
                        <span className="font-extrabold text-xl text-primary">
                          {formatCurrency(group.total)}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {group.suprimentos.map((suprimentoGroup) => {
                          const isCombustivel = suprimentoGroup.suprimento_tipo === 'COMBUSTIVEL';
                          
                          // Determine badge class and text based on consolidated type
                          let badgeText = '';
                          let badgeClass = '';
                          
                          if (isCombustivel) {
                            badgeText = capitalizeFirstLetter(suprimentoGroup.original_registro.tipo_combustivel);
                            badgeClass = getCombustivelBadgeClass(suprimentoGroup.original_registro.tipo_combustivel as CombustivelTipo);
                          } else {
                            badgeText = 'Lubrificante';
                            badgeClass = 'bg-purple-600 text-white hover:bg-purple-700';
                          }
                          
                          const originalRegistro = suprimentoGroup.original_registro;
                          
                          // Lógica para determinar a OM Destino Recurso e a cor
                          let destinoOmNome: string;
                          let destinoOmUg: string;
                          let isDifferentOm: boolean;

                          if (isCombustivel) {
                            destinoOmNome = originalRegistro.om_detentora || ''; // RM Fornecimento
                            destinoOmUg = originalRegistro.ug_detentora || '';
                            
                            const omDetentoraKey = `${group.om}-${group.ug}`;
                            const omDetentoraDetails = omDetailsMap[omDetentoraKey];
                            const omDetentoraRmVinculacao = omDetentoraDetails?.rm_vinculacao;
                            
                            if (omDetentoraRmVinculacao && destinoOmNome) {
                                isDifferentOm = omDetentoraRmVinculacao.toUpperCase() !== destinoOmNome.toUpperCase();
                            } else {
                                isDifferentOm = false; 
                            }
                            
                          } else {
                            destinoOmNome = originalRegistro.om_detentora || originalRegistro.organizacao;
                            destinoOmUg = originalRegistro.ug_detentora || originalRegistro.ug;
                            isDifferentOm = group.om !== destinoOmNome;
                          }
                          const omDestinoTextClass = isDifferentOm ? 'text-red-600 font-bold' : 'text-foreground';

                          return (
                            <Card key={originalRegistro.id} className="p-3 bg-background border">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-base text-foreground">
                                      {isCombustivel ? 'Combustível' : 'Lubrificante'}
                                    </h4>
                                    <Badge variant="default" className={cn("w-fit", badgeClass)}>
                                      {badgeText}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Total Litros: {formatNumber(suprimentoGroup.total_litros, 2)} L | Dias: {originalRegistro.dias_operacao}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg text-primary/80">
                                    {formatCurrency(suprimentoGroup.total_valor)}
                                  </span>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => handleEditarConsolidado(originalRegistro)}
                                      disabled={loading}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeletarConsolidado(originalRegistro.id)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      disabled={loading}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* NOVO DIV: OM Destino Recurso (Ajustado para text-xs) */}
                              <div className="flex justify-between text-xs mt-2 pt-2 border-t">
                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                <span className={cn("font-medium", omDestinoTextClass)}>
                                  {destinoOmNome} ({formatCodug(destinoOmUg)})
                                </span>
                              </div>
                              
                              {/* Detalhes por Categoria (Gerador, Embarcação, etc.) */}
                              <div className="mt-1 space-y-1">
                                {CATEGORIAS.map(cat => {
                                  const totais = suprimentoGroup.categoria_totais[cat.key];
                                  if (totais.valor > 0) {
                                    const displayLabel = categoryLabelMap[cat.key] || getClasseIIICategoryLabel(cat.key);
                                    
                                    // Para Lubrificante, só queremos Gerador e Embarcação
                                    if (suprimentoGroup.suprimento_tipo === 'LUBRIFICANTE' && cat.key !== 'GERADOR' && cat.key !== 'EMBARCACAO') {
                                        return null;
                                    }
                                    
                                    // Para Combustível, queremos todas as categorias
                                    
                                    // A unidade é sempre L para exibição consolidada aqui
                                    const unit = 'L'; 
                                    
                                    return (
                                      <div key={cat.key} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          {displayLabel}: {formatNumber(totais.litros, 2)} {unit}
                                        </span>
                                        <span className="font-medium text-foreground text-right">
                                          {formatCurrency(totais.valor)}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            
            {/* 5. Memórias de Cálculos Detalhadas */}
            {getMemoriaRecords.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                {getMemoriaRecords.map(item => {
                  const om = item.om_destino;
                  const ug = item.ug_destino;
                  
                  // Use the original consolidated record ID for memory editing
                  const originalId = item.original_registro.id;
                  const isEditing = editingMemoriaId === originalId;
                  
                  // Check if the original consolidated record has custom memory
                  const hasCustomMemoria = !!item.original_registro.detalhamento_customizado;
                  
                  // Generate automatic memory based on granular item data
                  const memoriaAutomatica = generateGranularMemoriaCalculo(
                      item, 
                      refLPC, 
                      item.original_registro.om_detentora || '', // RM Fornecimento
                      item.original_registro.ug_detentora || '' // CODUG RM Fornecimento
                  );
                  
                  // Determine which memory to display/edit
                  const memoriaExibida = isEditing 
                    ? memoriaEdit 
                    : (item.original_registro.detalhamento_customizado || memoriaAutomatica);
                  
                  const suprimento = getSuprimentoLabel({ original_registro: item.original_registro, suprimento_tipo: item.suprimento_tipo === 'LUBRIFICANTE' ? 'LUBRIFICANTE' : 'COMBUSTIVEL' } as ConsolidatedSuprimentoGroup);
                  const badgeClass = getSuprimentoBadgeClass({ original_registro: item.original_registro, suprimento_tipo: item.suprimento_tipo === 'LUBRIFICANTE' ? 'LUBRIFICANTE' : 'COMBUSTIVEL' } as ConsolidatedSuprimentoGroup);
                  
                  // Encontrar o label e estilo da categoria do material usando o novo utilitário
                  const categoryBadgeStyle = getClasseIIICategoryBadgeStyle(item.categoria);
                  // CORREÇÃO APLICADA AQUI: Usar categoryLabelMap como fallback robusto
                  const displayCategoryLabel = categoryLabelMap[item.categoria] || getClasseIIICategoryLabel(item.categoria);
                  
                  // --- LÓGICA DE ALERTA PARA MEMÓRIA DETALHADA ---
                  let isResourceDifferent = false;
                  let omDestinoRecurso = '';
                  let ugDestinoRecurso = '';
                  
                  // 1. Obter detalhes da OM Detentora do Equipamento (OM que está sendo detalhada)
                  const omDetentoraKey = `${om}-${ug}`;
                  const omDetentoraDetails = omDetailsMap[omDetentoraKey];
                  const omDetentoraRmVinculacao = omDetentoraDetails?.rm_vinculacao;
                  
                  if (item.suprimento_tipo === 'LUBRIFICANTE') {
                      // Lubrificante: OM Detentora do Equipamento (om) vs OM Destino Recurso (om_detentora)
                      omDestinoRecurso = item.original_registro.om_detentora || om;
                      ugDestinoRecurso = item.original_registro.ug_detentora || ug;
                      isResourceDifferent = om !== omDestinoRecurso;
                  } else {
                      // Combustível: RM Vinculação da OM Detentora vs RM de Fornecimento (om_detentora)
                      const rmFornecimento = item.original_registro.om_detentora || '';
                      const codugRmFornecimento = item.original_registro.ug_detentora || '';
                      
                      omDestinoRecurso = rmFornecimento;
                      ugDestinoRecurso = codugRmFornecimento;
                      
                      if (omDetentoraRmVinculacao && rmFornecimento) {
                          isResourceDifferent = omDetentoraRmVinculacao.toUpperCase() !== rmFornecimento.toUpperCase();
                      }
                  }
                  
                  // NOVO TEXTO SIMPLIFICADO
                  const resourceDestinationText = `Recurso destinado à OM: ${omDestinoRecurso} (${formatCodug(ugDestinoRecurso)})`;
                  // ------------------------------------------------
                  
                  return (
                    <div key={`memoria-view-${item.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-semibold text-foreground">
                              OM Detentora: {om} ({formatCodug(ug)})
                            </h4>
                            {/* NOVO BADGE: Categoria do Material (com cor específica) */}
                            <Badge variant="default" className={cn("w-fit shrink-0", categoryBadgeStyle.className)}>
                              {displayCategoryLabel}
                            </Badge>
                            {/* BADGE EXISTENTE: Tipo de Suprimento */}
                            <Badge variant="default" className={cn("w-fit shrink-0", badgeClass)}>
                              {suprimento}
                            </Badge>
                            {/* NOVO BADGE DE MEMÓRIA CUSTOMIZADA */}
                            {hasCustomMemoria && !isEditing && (
                                <Badge variant="outline" className="text-xs">
                                    Editada manualmente
                                </Badge>
                            )}
                          </div>
                          
                          {/* ALERTA DE RECURSO DIFERENTE (AJUSTADO PARA O PADRÃO DA CLASSE VII) */}
                          {isResourceDifferent && (
                              <div className="flex items-center gap-1 mt-1">
                                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                                  <span className="text-sm font-medium text-red-600">
                                      {resourceDestinationText}
                                  </span>
                              </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          {!isEditing ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                // Pass the original consolidated ID for memory editing
                                onClick={() => handleIniciarEdicaoMemoria(item)} // CORRIGIDO: Passa o item granular
                                disabled={loading}
                                className="gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Editar Memória
                              </Button>
                              {hasCustomMemoria && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => handleRestaurarMemoriaAutomatica(item.original_registro.id)}
                                  disabled={loading}
                                  className="gap-2 text-muted-foreground"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Restaurar Automática
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button 
                                size="sm" 
                                variant="default" 
                                onClick={() => handleSalvarMemoriaCustomizada(originalId)}
                                disabled={loading}
                                className="gap-2"
                              >
                                <Check className="h-4 w-4" />
                                Salvar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={loading}
                                className="gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <Card className="p-4 bg-background rounded-lg border">
                        {isEditing ? (
                          <Textarea 
                            value={memoriaEdit} 
                            onChange={(e) => setMemoriaEdit(e.target.value)}
                            className="min-h-[300px] font-mono text-sm"
                            placeholder="Digite a memória de cálculo..."
                          />
                        ) : (
                          <pre className="text-sm font-mono whitespace-pre-wrap text-foreground" style={{ whiteSpace: 'pre-wrap' }}>
                            {memoriaExibida}
                          </pre>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClasseIIIForm;