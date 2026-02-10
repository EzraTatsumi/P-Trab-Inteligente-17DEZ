{/* ... restante do arquivo ... */}

{/* Linha 1013 aprox. */}
<CurrencyInput
  id="valor_total_solicitado"
  rawDigits={rawTotalInput}
  onChange={(_, digits) => handleCurrencyChange('valor_total_solicitado', digits)}
  placeholder="Ex: 1.500,00"
  disabled={!isPTrabEditable || isSaving}
  required
/>

{/* ... */}

{/* Linha 1055 aprox. */}
<CurrencyInput
  id="valor_nd_30"
  rawDigits={rawND30Input}
  onChange={(_, digits) => handleCurrencyChange('valor_nd_30', digits)}
  placeholder="0,00"
  disabled={!isPTrabEditable || isSaving}
  className="text-lg h-12" 
/>

{/* ... restante do arquivo ... */}