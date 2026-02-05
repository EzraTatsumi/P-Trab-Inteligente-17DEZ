// ... (imports)

// ... (rest of the file)

  // --- LÓGICA DE MATERIAL DE CONSUMO (NOVO) ---
  
// ... (handleSaveMaterialConsumo, handleStartEditMaterialConsumo, handleOpenNewMaterialConsumo, handleDeleteMaterialConsumo functions)

  
  const renderMaterialConsumoSection = () => {
      return (
          <div className="space-y-4">
              
              {/* Lista de Subitens Existentes (Card 846 equivalente) */}
              {diretrizesMaterialConsumo.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Subitens da ND Cadastrados</CardTitle>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Nr Subitem</TableHead>
                                  <TableHead className="w-[40%]">Nome do Subitem</TableHead>
                                  <TableHead className="w-[100px] text-center">Ações</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {diretrizesMaterialConsumo.map(d => (
                                  <MaterialConsumoDiretrizRow
                                      key={d.id}
                                      diretriz={d}
                                      onEdit={handleStartEditMaterialConsumo}
                                      onDelete={handleDeleteMaterialConsumo}
                                      loading={loading}
                                  />
                              ))}
                          </TableBody>
                      </Table>
                  </Card>
              ) : (
                  <Card className="p-4 text-center text-muted-foreground">
                      Nenhum subitem da ND cadastrado para o ano de referência.
                  </Card>
              )}
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewMaterialConsumo}
                      disabled={loading}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Subitem da ND
                  </Button>
              </div>
          </div>
      );
  };
  // END LÓGICA DE MATERIAL DE CONSUMO

  // Adicionando a verificação de carregamento
  if (loading || isLoadingDefaultYear) {
// ... (loading spinner)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
// ... (header and year selection)

              {/* SEÇÃO PRINCIPAL DE CUSTOS OPERACIONAIS (ITENS INDIVIDUAIS COLAPSÁVEIS) */}
              <div className="border-t pt-4 mt-6">
                <div className="space-y-4">
                  
                  {/* Pagamento de Diárias */}
// ... (Diárias section)
                  
                  {/* Diretrizes de Passagens (Contratos/Trechos) */}
// ... (Passagens section)
                  
                  {/* Diretrizes de Concessionária */}
// ... (Concessionária section)
                  
                  {/* Diretrizes de Material de Consumo (NOVO) */}
                  <Collapsible 
                    open={fieldCollapseState['material_consumo_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['material_consumo_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          Material de Consumo (33.90.30)
                        </h4>
                        {fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderMaterialConsumoSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* OUTROS CAMPOS OPERACIONAIS (Fatores e Valores Simples) */}
// ... (rest of the file)