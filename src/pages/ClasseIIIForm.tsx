// ... (lines 2583 - 2585 unchanged)
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-foreground">
// ... (lines 2592 - 2656 unchanged)
                      
                      {/* ALERTA DE RECURSO DIFERENTE (AJUSTADO PARA O PADRÃO DA CLASSE II) */}
                      {isResourceDifferent && (
                          <div className="flex items-center gap-1 mb-0">
                              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                              <span className="text-sm font-medium text-red-600">
                                  {resourceDestinationText}
                              </span>
                          </div>
                      )}
                      
                      <Card className="p-4 bg-background rounded-lg border">
// ... (lines 2669 - 2678 unchanged)