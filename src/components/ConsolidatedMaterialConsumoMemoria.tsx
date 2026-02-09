import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Save, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { ConsolidatedMaterialConsumoRecord, generateConsolidatedMaterialConsumoMemoriaCalculo } from "@/lib/materialConsumoUtils";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ConsolidatedMaterialConsumoMemoriaProps {
    group: ConsolidatedMaterialConsumoRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedMaterialConsumoRecord, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

const ConsolidatedMaterialConsumoMemoria: React.FC<ConsolidatedMaterialConsumoMemoriaProps> = ({
    group,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    handleIniciarEdicaoMemoria,
    handleCancelarEdicaoMemoria,
    handleSalvarMemoriaCustomizada,
    handleRestaurarMemoriaAutomatica,
}) => {
    // O primeiro registro do grupo é usado para armazenar a memória customizada
    const firstRecord = group.records[0];
    const isEditing = editingMemoriaId === firstRecord.id;
    
    // 1. Memória Automática (sempre gerada)
    const memoriaAutomatica = generateConsolidatedMaterialConsumoMemoriaCalculo(group);
    
    // 2. Memória Customizada (se existir no DB)
    const memoriaCustomizadaDB = firstRecord.detalhamento_customizado;
    
    // 3. Memória a ser exibida (Customizada > Automática)
    const memoriaDisplay = memoriaCustomizadaDB || memoriaAutomatica;
    
    // 4. Verifica se a memória está customizada
    const isCustomized = !!memoriaCustomizadaDB;

    return (
        <Card className={cn("border", isCustomized && !isEditing && "border-green-500 shadow-md")}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex justify-between items-center">
                    Memória de Cálculo: {group.organizacao} (UG: {formatCodug(group.ug)})
                    <div className="flex items-center gap-2">
                        {isCustomized && !isEditing && (
                            <Badge variant="success" className="text-xs">Customizada</Badge>
                        )}
                        <span className="font-extrabold text-lg text-foreground">
                            {formatCurrency(group.totalGeral)}
                        </span>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="space-y-3">
                        <Textarea
                            value={memoriaEdit}
                            onChange={(e) => setMemoriaEdit(e.target.value)}
                            rows={15}
                            className="font-mono text-xs"
                            disabled={isSaving}
                        />
                        <div className="flex justify-end gap-2">
                            {isCustomized && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => handleRestaurarMemoriaAutomatica(firstRecord.id)}
                                    disabled={isSaving}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Restaurar Automática
                                </Button>
                            )}
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button 
                                type="button" 
                                onClick={() => handleSalvarMemoriaCustomizada(firstRecord.id)}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar Customizada
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                            {memoriaDisplay}
                        </pre>
                        {isPTrabEditable && (
                            <div className="flex justify-end">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleIniciarEdicaoMemoria(group, memoriaDisplay)}
                                    disabled={isSaving}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {isCustomized ? "Editar Customizada" : "Customizar Memória"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ConsolidatedMaterialConsumoMemoria;