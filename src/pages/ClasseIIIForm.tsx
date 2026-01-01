// ... (lines 2579 - 2582 unchanged)
                  
                  return (
                    <div key={`memoria-view-${item.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
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
                        </div>
                        
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          {!isEditing ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                // Pass the original consolidated ID for memory editing
                                onClick={() => handleIniciarEdicaoMemoria(item.original_registro)}
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
                        
                        {/* ALERTA DE RECURSO DIFERENTE (MOVIDO PARA DENTRO DO CONTAINER) */}
                        {isResourceDifferent && (
                            <div className="flex items-center gap-1 mt-2 w-full">
                                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                                <span className="text-sm font-medium text-red-600">
                                    {resourceDestinationText}
                                </span>
                            </div>
                        )}
                      </div>
                      
                      <Card className="p-4 bg-background rounded-lg border">
// ... (lines 2669 - 2678 unchanged)