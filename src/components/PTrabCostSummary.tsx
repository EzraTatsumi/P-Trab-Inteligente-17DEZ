// ... (código anterior omitido por brevidade)
                          {/* Linha Lubrificante */}
                          <div className="flex justify-between text-muted-foreground">
                            <span className="w-1/2 text-left">
                                Lubrificante
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {/* Corrigido: totalLubrificanteLitros agora é garantido como número */}
                              {formatNumber(Number(totals.totalLubrificanteLitros) || 0, 2)} L
                            </span>
                            <span className="w-1/4 text-right font-medium">
                              {formatCurrency(totals.totalLubrificanteValor)}
                            </span>
                          </div>
                        </div>
// ... (restante do arquivo)