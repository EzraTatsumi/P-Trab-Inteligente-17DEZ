// ... (lines 2583 - 2585 unchanged)
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-3">
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
                            
                            {/* ALERTA DE RECURSO DIFERENTE (AGORA DENTRO DO FLEX-COL) */}
                            {isResourceDifferent && (
                                <div className="flex items-center gap-1 mt-1 mb-0">
                                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                                    <span className="text-sm font-medium text-red-600">
                                        {resourceDestinationText}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center justify-end gap-2 shrink-0">
// ... (lines 2617 - 2668 unchanged)
                      
                      {/* ALERTA DE RECURSO DIFERENTE (REMOVIDO DA POSIÇÃO ANTIGA) */}
                      {/* {isResourceDifferent && (
                          <div className="flex items-center gap-1 mb-0">
                              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                              <span className="text-sm font-medium text-red-600">
                                  {resourceDestinationText}
                              </span>
                          </div>
                      )} */}
                      
                      <Card className="p-4 bg-background rounded-lg border">
// ... (lines 2677 - 2686 unchanged)