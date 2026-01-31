// ... (imports e interfaces mantidos)

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
// ... (props mantidas)
}) => {
// ... (funções auxiliares e lógica de exportação Excel mantidas)

  // ... (código anterior)

  return (
    <div className="space-y-4">
      {/* Botões de Exportação/Impressão padronizados */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        <Button onClick={exportExcel} variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
        <Button onClick={() => window.print()} variant="default">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Conteúdo do Relatório (para impressão) */}
      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="text-[11pt] font-bold uppercase">
            Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado}</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS LOGÍSTICAS REALIZADAS OU A REALIZAR:</p>
        </div>

        {omsOrdenadas.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-classe">CLASSE</th>
                  <th rowSpan={2} className="col-om-favorecida">OM FAVORECIDA<br/>(UG)</th>
                  <th rowSpan={2} className="col-om-detentora">OM DETENTORA DO RECURSO<br/>(UG)</th>
                  <th colSpan={5} className="col-nd-group">NATUREZA DE DESPESA</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO</th>
                </tr>
                <tr>
                    <th className="col-nd-small">33.90.30</th>
                    <th className="col-nd-small">33.90.39</th>
                    <th className="col-nd-small">33.90.00</th>
                    <th className="col-nd-small col-combustivel">COMBUSTÍVEL</th>
                    <th className="col-nd-small total-gnd3-cell">GND 3</th>
                </tr>
            </thead>
            <tbody>
              {omsOrdenadas.map(omName => {
                const grupo = gruposPorOM[omName];
                if (!grupo) return null;
                
                const totaisOM = calcularTotaisPorOM(grupo, omName);
                const article = getArticleForOM(omName);

                // Array para armazenar todas as linhas de dados desta OM
                const dataRows: JSX.Element[] = [];

                // --- 1. Classe I (QS/QR) ---
                const linhasClasseI = [...grupo.linhasQS, ...grupo.linhasQR];
                
                linhasClasseI.forEach((linha) => {
                    const registro = linha.registro;
                    const omDetentora = registro.omQS || registro.organizacao;
                    const ugDetentora = registro.ugQS || registro.ug;
                    
                    // Se for Ração Quente, o valor total é a soma de QS e QR
                    const valorTotal = (registro.totalQS || 0) + (registro.totalQR || 0);
                    
                    dataRows.push(
                        <tr key={`cl1-${linha.registro.id}-${linha.tipo}`} className="expense-row">
                            <td className="col-classe">
                                CLASSE I
                            </td>
                            <td className="col-om-favorecida">
                                <div>{registro.organizacao}</div>
                                <div>({formatCodug(registro.ug)})</div>
                            </td>
                            <td className="col-om-detentora">
                                <div>{omDetentora}</div>
                                <div>({formatCodug(ugDetentora)})</div>
                            </td>
                            <td className="col-nd-small">{formatCurrency(valorTotal)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel">{formatCurrency(0)}</td>
                            <td className="col-nd-small total-gnd3-cell">{formatCurrency(valorTotal)}</td>
                            <td className="col-detalhamento">
                                <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {generateClasseIMemoriaCalculo(registro, linha.tipo)}
                                </div>
                            </td>
                        </tr>
                    );
                });
                
                // --- 2. Classes II, V, VI, VII, VIII, IX ---
                const allClassesDiversas = [
                    ...grupo.linhasClasseII.map(l => ({ ...l, classe: 'II', isClasseII: true })),
                    ...grupo.linhasClasseV.map(l => ({ ...l, classe: 'V', isClasseII: false })),
                    ...grupo.linhasClasseVI.map(l => ({ ...l, classe: 'VI', isClasseII: false })),
                    ...grupo.linhasClasseVII.map(l => ({ ...l, classe: 'VII', isClasseII: false })),
                    ...grupo.linhasClasseVIII.map(l => ({ ...l, classe: 'VIII', isClasseII: false })),
                    ...grupo.linhasClasseIX.map(l => ({ ...l, classe: 'IX', isClasseII: false })),
                ];
                
                allClassesDiversas.forEach(linha => {
                    const registro = linha.registro;
                    const omDetentora = registro.om_detentora || registro.organizacao;
                    const ugDetentora = registro.ug_detentora || registro.ug;
                    
                    dataRows.push(
                        <tr key={`cl${linha.classe}-${registro.id}`} className="expense-row">
                            <td className="col-classe">
                                CLASSE {linha.classe}
                            </td>
                            <td className="col-om-favorecida">
                                <div>{registro.organizacao}</div>
                                <div>({formatCodug(registro.ug)})</div>
                            </td>
                            <td className="col-om-detentora">
                                <div>{omDetentora}</div>
                                <div>({formatCodug(ugDetentora)})</div>
                            </td>
                            <td className="col-nd-small">{formatCurrency(registro.valor_nd_30)}</td>
                            <td className="col-nd-small">{formatCurrency(registro.valor_nd_39)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel">{formatCurrency(0)}</td>
                            <td className="col-nd-small total-gnd3-cell">{formatCurrency(registro.valor_total)}</td>
                            <td className="col-detalhamento">
                                <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {generateClasseIIMemoriaCalculo(registro, linha.isClasseII)}
                                </div>
                            </td>
                        </tr>
                    );
                });
                
                // --- 3. Classe III (Combustível e Lubrificante) ---
                grupo.linhasClasseIII.forEach(linha => {
                    const registro = linha.registro;
                    const isLubrificante = linha.tipo_suprimento === 'LUBRIFICANTE';
                    const omDetentora = registro.om_detentora || registro.organizacao;
                    const ugDetentora = registro.ug_detentora || registro.ug;
                    
                    const valorND30 = isLubrificante ? linha.valor_total_linha : 0;
                    const valorCombustivel = isLubrificante ? 0 : linha.valor_total_linha;
                    const valorTotal = linha.valor_total_linha;
                    
                    dataRows.push(
                        <tr key={`cl3-${registro.id}-${linha.tipo_suprimento}-${linha.categoria_equipamento}`} className="expense-row">
                            <td className="col-classe">
                                CLASSE III
                            </td>
                            <td className="col-om-favorecida">
                                <div>{registro.organizacao}</div>
                                <div>({formatCodug(registro.ug)})</div>
                            </td>
                            <td className="col-om-detentora">
                                <div>{omDetentora}</div>
                                <div>({formatCodug(ugDetentora)})</div>
                            </td>
                            <td className="col-nd-small">{formatCurrency(valorND30)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel">{formatCurrency(valorCombustivel)}</td>
                            <td className="col-nd-small total-gnd3-cell">{formatCurrency(valorTotal)}</td>
                            <td className="col-detalhamento">
                                <div style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                                    {linha.memoria_calculo}
                                </div>
                            </td>
                        </tr>
                    );
                });

                // Retorna todas as linhas de dados + subtotais para esta OM
                return (
                    <React.Fragment key={omName}>
                        {dataRows}
                        
                        {/* Subtotal Row 1: SOMA POR ND E GP DE DESPESA */}
                        <tr className="subtotal-om-soma-row">
                            <td colSpan={3} className="text-right font-bold">
                                SOMA POR ND E GP DE DESPESA
                            </td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(totaisOM.total_33_90_30)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(totaisOM.total_33_90_39)}</td>
                            <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                            <td className="col-nd-small col-combustivel text-center font-bold">{formatCurrency(totaisOM.total_combustivel)}</td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisOM.total_gnd3)}</td>
                            <td></td>
                        </tr>
                        
                        {/* Subtotal Row 2: VALOR TOTAL DO(A) OM */}
                        <tr className="subtotal-om-final-row">
                            <td colSpan={7} className="text-right font-bold">
                                VALOR TOTAL {article} {omName}
                            </td>
                            <td className="col-nd-small text-center font-bold total-gnd3-cell">
                                {formatCurrency(totaisOM.total_gnd3)}
                            </td>
                            <td></td>
                        </tr>
                    </React.Fragment>
                );
              })}
              
              {/* Linha em branco para espaçamento */}
              <tr className="spacing-row">
                <td colSpan={9} style={{ height: '10px', border: 'none', backgroundColor: 'transparent', borderLeft: 'none', borderRight: 'none' }}></td>
              </tr>
              
              {/* Grand Total Row 1: SOMA POR ND E GP DE DESPESA */}
              <tr className="total-geral-soma-row">
                <td colSpan={3} className="text-right font-bold">
                    SOMA POR ND E GP DE DESPESA
                </td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.total_33_90_30)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(totaisGerais.total_33_90_39)}</td>
                <td className="col-nd-small text-center font-bold">{formatCurrency(0)}</td>
                <td className="col-nd-small col-combustivel text-center font-bold">{formatCurrency(totaisGerais.total_combustivel)}</td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">{formatCurrency(totaisGerais.total_gnd3)}</td>
                <td></td>
              </tr>
              
              {/* Grand Total Row 2: VALOR TOTAL */}
              <tr className="total-geral-final-row">
                <td colSpan={7} className="text-right font-bold">
                    VALOR TOTAL
                </td>
                <td className="col-nd-small text-center font-bold total-gnd3-cell">
                    {formatCurrency(totaisGerais.total_gnd3)}
                </td>
                <td></td>
              </tr>
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro logístico cadastrado.</p>
        )}

        <div className="ptrab-footer print-avoid-break">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="signature-block">
            <p className="text-[10pt] font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>

      {/* ... (styles mantidos) */}
    </div>
  );
};

export default PTrabLogisticoReport;