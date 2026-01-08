@@ -1340,21 +1340,21 @@
                       {/* Condição de exibição para HTML/PDF */}
                       {(() => {
                           const hasFuelRecords = totaisOM.total_combustivel > 0;
                           return (
-                      <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
-                        {hasFuelRecords 
-                          ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
-                          : ''}
-                      </td>
-                      <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
-                        {hasFuelRecords 
-                          ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
-                          : ''}
-                      </td>
-                      <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
-                        {hasFuelRecords 
-                          ? formatCurrency(totaisOM.total_combustivel) 
-                          : ''}
-                      </td>
+                            <>
+                                <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
+                                    {hasFuelRecords 
+                                    ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
+                                    : ''}
+                                </td>
+                                <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
+                                    {hasFuelRecords 
+                                    ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
+                                    : ''}
+                                </td>
+                                <td className="text-center font-bold border border-black" style={{ backgroundColor: '#F8CBAD' }}>
+                                    {hasFuelRecords 
+                                    ? formatCurrency(totaisOM.total_combustivel) 
+                                    : ''}
+                                </td>
+                            </>
                           );
                       })()}
                       <td></td>