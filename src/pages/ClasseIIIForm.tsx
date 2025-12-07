<TableCell className="py-1 w-[15%]">
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
                                                    <TableCell className="py-1 w-[15%]">
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
                                                    <TableCell className="py-1 w-[15%]">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className="h-8 text-center"
                                                            value={isMotomecanizacao ? (item.distancia_percorrida === 0 ? "" : item.distancia_percorrida.toString()) : (item.horas_dia === 0 ? "" : item.horas_dia.toString())}
                                                            onChange={(e) => handleItemNumericChange(index, isMotomecanizacao ? 'distancia_percorrida' : 'horas_dia', e.target.value)}
                                                            placeholder="0"
                                                            disabled={item.quantidade === 0 || diasUtilizados === 0}
                                                            onKeyDown={handleEnterToNextField}
                                                        />
                                                    </TableCell>