<TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                              <TableRow>
                                <TableHead className="w-[40%]">Equipamento</TableHead>
                                <TableHead className="w-[10%] text-center">Qtd</TableHead>
                                <TableHead className="w-[10%] text-center">Qtd Dias</TableHead>
                                <TableHead className="w-[10%] text-center">{cat.key === 'MOTOMECANIZACAO' ? 'KM/Desloc' : 'Horas/Dia'}</TableHead>
                                {cat.key === 'MOTOMECANIZACAO' && (
                                  <TableHead className="w-[10%] text-center">Desloc/Dia</TableHead>
                                )}
                                <TableHead className="w-[10%] text-center">Lub/Comb</TableHead>
                                <TableHead className="w-[5%] text-right">Custo Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentCategoryItems.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={cat.key === 'MOTOMECANIZACAO' ? 7 : 6} className="text-center text-muted-foreground">
                                    Nenhum item de diretriz encontrado para esta categoria.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                currentCategoryItems.map((item, index) => {
                                  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
                                  const isLubricantType = item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO';
                                  
                                  // --- Calculation Logic (Must be kept in sync with useMemo) ---
                                  const diasUtilizados = item.dias_utilizados || 0;
                                  let litrosSemMargemItem = 0;
                                  
                                  if (diasUtilizados > 0) {
                                    if (isMotomecanizacao) {
                                      if (item.consumo_fixo > 0) {
                                        litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
                                      }
                                    } else {
                                      litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
                                    }
                                  }
                                  
                                  const totalLitros = litrosSemMargemItem * 1.3;
                                  const precoLitro = item.tipo_combustivel_fixo === 'GASOLINA' 
                                    ? (refLPC?.preco_gasolina ?? 0) 
                                    : (refLPC?.preco_diesel ?? 0);
                                  const valorCombustivel = totalLitros * precoLitro;
                                  
                                  let valorLubrificante = 0;
                                  if (isLubricantType && item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0 && diasUtilizados > 0) {
                                    const totalHoras = item.quantidade * item.horas_dia * diasUtilizados;
                                    let litrosItem = 0;
                                    
                                    if (item.categoria === 'GERADOR') {
                                      litrosItem = (totalHoras / 100) * item.consumo_lubrificante_litro;
                                    } else if (item.categoria === 'EMBARCACAO') {
                                      litrosItem = totalHoras * item.consumo_lubrificante_litro;
                                    }
                                    
                                    valorLubrificante = litrosItem * item.preco_lubrificante;
                                  }
                                  
                                  const itemTotal = valorCombustivel + valorLubrificante;
                                  // --- End Calculation Logic ---
                                  
                                  const formattedPriceInput = formatCurrencyInput(item.preco_lubrificante_input).formatted;
                                  
                                  return (
                                    <TableRow key={item.item} className="h-12">
                                      <TableCell className="font-medium text-sm py-1 w-[40%]">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-medium text-sm">{item.item}</span>
                                          <Badge 
                                            variant="default" 
                                            className={cn("w-fit text-xs font-normal", getCombustivelBadgeClass(item.tipo_combustivel_fixo))}
                                          >
                                            {item.tipo_combustivel_fixo} ({formatNumber(item.consumo_fixo, 1)} {item.unidade_fixa})
                                          </Badge>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-1 w-[10%]">
                                        <Input 
                                          type="text"
                                          inputMode="numeric"
                                          className="h-8 text-center"
                                          value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                          onChange={(e) => handleItemNumericChange(index, 'quantidade', e.target.value)}
                                          placeholder="0"
                                          onKeyDown={handleEnterToNextField}
                                        />
                                      </TableCell>
                                      {/* NEW COLUMN: Qtd Dias */}
                                      <TableCell className="py-1 w-[10%]">
                                        <Input 
                                          type="text"
                                          inputMode="numeric"
                                          className="h-8 text-center"
                                          value={item.dias_utilizados === 0 ? "" : item.dias_utilizados.toString()}
                                          onChange={(e) => handleItemNumericChange(index, 'dias_utilizados', e.target.value)}
                                          placeholder="0"
                                          disabled={item.quantidade === 0}
                                          onKeyDown={handleEnterToNextField}
                                        />
                                      </TableCell>
                                      {/* COLUMN 4: Horas/Dia or KM/Desloc */}
                                      <TableCell className="py-1 w-[10%]">
                                        <Input 
                                          type="text"
                                          inputMode="decimal"
                                          className="h-8 text-center"
                                          value={isMotomecanizacao 
                                            ? (item.distancia_percorrida === 0 ? "" : item.distancia_percorrida.toString())
                                            : (item.horas_dia === 0 ? "" : item.horas_dia.toString())
                                          }
                                          onChange={(e) => handleItemNumericChange(index, isMotomecanizacao ? 'distancia_percorrida' : 'horas_dia', e.target.value)}
                                          placeholder="0"
                                          disabled={item.quantidade === 0 || diasUtilizados === 0}
                                          onKeyDown={handleEnterToNextField}
                                        />
                                      </TableCell>
                                      {/* COLUMN 5: Desloc/Dia (Only for Motomecanizacao) */}
                                      {isMotomecanizacao && (
                                        <TableCell className="py-1 w-[10%]">
                                          <Input 
                                            type="text"
                                            inputMode="numeric"
                                            className="h-8 text-center"
                                            value={item.quantidade_deslocamentos === 0 ? "" : item.quantidade_deslocamentos.toString()}
                                            onChange={(e) => handleItemNumericChange(index, 'quantidade_deslocamentos', e.target.value)}
                                            placeholder="0"
                                            disabled={item.quantidade === 0 || diasUtilizados === 0}
                                            onKeyDown={handleEnterToNextField}
                                          />
                                        </TableCell>
                                      )}
                                      {/* COLUMN 6: Lub/Comb */}
                                      <TableCell className="py-1 w-[10%]">
                                        {isLubricantType ? (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className={cn("h-8 w-full text-xs", item.consumo_lubrificante_litro > 0 && "border-purple-500 text-purple-600")}
                                                disabled={item.quantidade === 0 || diasUtilizados === 0}
                                              >
                                                <Droplet className="h-3 w-3 mr-1" />
                                                {item.consumo_lubrificante_litro > 0 ? 'Configurado' : 'Lubrificante'}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-4 space-y-3">
                                              <h4 className="font-semibold text-sm">Configurar Lubrificante</h4>
                                              <div className="space-y-2">
                                                <Label>Consumo ({item.categoria === 'GERADOR' ? 'L/100h' : 'L/h'})</Label>
                                                <Input 
                                                  type="text"
                                                  inputMode="decimal"
                                                  value={item.consumo_lubrificante_input}
                                                  onChange={(e) => handleItemNumericChange(index, 'consumo_lubrificante_input', e.target.value)}
                                                  onBlur={(e) => handleItemNumericBlur(index, 'consumo_lubrificante_input', e.target.value)}
                                                  placeholder="0,00"
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <Label>Preço (R$/L)</Label>
                                                <Input 
                                                  type="text"
                                                  inputMode="numeric"
                                                  value={formattedPriceInput}
                                                  onChange={(e) => handleItemNumericChange(index, 'preco_lubrificante_input', e.target.value)}
                                                  placeholder="0,00"
                                                  onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                                                />
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs w-full justify-center">
                                            {item.tipo_combustivel_fixo}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      {/* COLUMN 7: Custo Total */}
                                      <TableCell className="text-right font-semibold text-sm py-1 w-[5%]">
                                        {formatCurrency(itemTotal)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>