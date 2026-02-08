import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Save, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { ConsolidatedMaterialConsumoRecord } from "@/lib/materialConsumoUtils";
import { generateConsolidatedMaterialConsumoMemoriaCalculo } from "@/lib/materialConsumoUtils";
import { cn } from "@/lib/utils";

interface ConsolidatedMaterialConsumoMemoriaProps {
    group: ConsolidatedMaterialConsumoRecord & { groupKey: string };
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedMaterialConsumoRecord & { groupKey: string }, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConsolidatedMaterialConsumoMemoria: React.FC<ConsolidatedMaterialConsumoMemoriaProps> = ({
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
    // O ID do registro para edição é o ID do primeiro registro do grupo
    const registroId = group.records[0]?.id;
    const isEditing = editingMemoriaId === registroId;
    
    // A memória completa é gerada a partir do primeiro registro (que contém o customizado, se houver)
    const memoriaCompleta = generateConsolidatedMaterialConsumoMemoriaCalculo(group);
    
    // Verifica se a memória atual é customizada (comparando com a automática)
    const memoriaAutomatica = generateMaterialConsumoMemoriaCalculo(group.records[0]);
    const isCustomized = group.records[0]?.detalhamento_customizado !== null;

    return (
        <Card className="shadow-md">
            <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-bold text-base">
                        {group.nr_subitem} - {group.nome_subitem}
                    </h4>
                    {isPTrabEditable && !isSaving && (
                        <div className="flex gap-2">
                            {isEditing ? (
                                <>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleCancelarEdicaoMemoria}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Cancelar
                                    </Button>
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        onClick={() => handleSalvarMemoriaCustomizada(registroId)}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Salvar
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {isCustomized && (
                                        <Button 
                                            type="button" 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={() => handleRestaurarMemoriaAutomatica(registroId)}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Restaurar Padrão
                                        </Button>
                                    )}
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleIniciarEdicaoMemoria(group, memoriaCompleta)}
                                    >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Editar
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                
                {isEditing ? (
                    <Textarea
                        value={memoriaEdit}
                        onChange={(e) => setMemoriaEdit(e.target.value)}
                        rows={15}
                        className="font-mono text-xs"
                        placeholder="Edite a memória de cálculo aqui..."
                        disabled={isSaving}
                    />
                ) : (
                    <pre className={cn(
                        "whitespace-pre-wrap break-words p-3 rounded-md bg-gray-50 border text-xs font-mono",
                        isCustomized ? "border-green-500 bg-green-50/50" : "border-gray-200"
                    )}>
                        {memoriaCompleta}
                    </pre>
                )}
                
                {isCustomized && !isEditing && (
                    <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Esta memória de cálculo foi customizada.
                    </p>
                )}
            </CardContent>
        </Card>
    );
};