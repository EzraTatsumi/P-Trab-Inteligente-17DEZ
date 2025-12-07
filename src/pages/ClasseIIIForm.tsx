<div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-semibold text-foreground">
                            OM Destino: {om} ({ug})
                          </h4>
                          <Badge variant="default" className={cn("w-fit", badgeClass)}>
                            {suprimento}
                          </Badge>
                        </div>
                        {!isEditing ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleIniciarEdicaoMemoria(registro)}
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
                                onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
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
                              onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
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