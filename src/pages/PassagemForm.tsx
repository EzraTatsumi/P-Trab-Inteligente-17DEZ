// ... (código anterior)
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0} 
                                                                                        placeholder="Ex: 3"
                                                                                        value={trecho.quantidade_passagens === 0 ? "" : trecho.quantidade_passagens}
                                                                                        onChange={(e) => handleTrechoQuantityChange(trecho.id, parseInt(e.target.value) || 0)}
                                                                                        onWheel={(e) => e.currentTarget.blur()} // Desabilita roda do mouse
                                                                                        onKeyDown={(e) => { // Desabilita setas do teclado
                                                                                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                                                                                e.preventDefault();
                                                                                            }
                                                                                        }}
                                                                                        className="w-20 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                        disabled={!isPTrabEditable || isSaving}
                                                                                    />
                                                                                </div>
// ... (código posterior)