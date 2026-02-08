import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Save, RefreshCw, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConsolidatedMaterialConsumo } from "@/types/materialConsumo";
import { generateConsolidatedMaterialConsumoMemoriaCalculo } from "@/lib/materialConsumoUtils";
import { cn } from '@/lib/utils';

interface ConsolidatedMaterialConsumoMemoriaProps {
    group: ConsolidatedMaterialConsumo;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedMaterialConsumo, memoriaCompleta: string) => void;
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
    const [isOpen, setIsOpen] = useState(false);
    
    // O ID do registro que está sendo editado (o primeiro do grupo)
    const firstRecordId = group.records[0]?.id || '';
    const isEditing = editingMemoriaId === firstRecordId;
    
    // A memória automática é gerada a partir do grupo consolidado
    const memoriaAutomatica = useMemo(() => {
        return generateConsolidatedMaterialConsumoMemoriaCalculo(group);
    }, [group]);
    
    // Verifica se a memória atual é customizada
    const isCustomized = !!group.records[0]?.detalhamento_customizado;
    
    // O texto a ser exibido (customizado se existir, senão automático)
    const displayMemoria = isCustomized ? group.records[0].detalhamento_customizado : memoriaAutomatica;

    return (
        <Card className={cn("border", isCustomized && "border-green-500 shadow-md")}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-3 px-4">
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <span className="text-primary">{group.organizacao} (UG: {group.ug})</span>
                                {isCustomized && (
                                    <span className="text-xs text-green-600 font-medium flex items-center">
                                        <Pencil className="h-3 w-3 mr-1" /> Customizada
                                    </span>
                                )}
                            </CardTitle>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </CollapsibleTrigger>
                </CardHeader>
                
                <CollapsibleContent>
                    <CardContent className="pt-2 pb-4 px-4">
                        {isEditing ? (
                            // MODO EDIÇÃO
                            <div className="space-y-3">
                                <Textarea
                                    value={memoriaEdit}
                                    onChange={(e) => setMemoriaEdit(e.target.value)}
                                    rows={10}
                                    className="font-mono text-xs"
                                    disabled={isSaving}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={handleCancelarEdicaoMemoria}
                                        disabled={isSaving}
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancelar
                                    </Button>
                                    <Button 
                                        type="button" 
                                        onClick={() => handleSalvarMemoriaCustomizada(firstRecordId)}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Salvar Customizada
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            // MODO VISUALIZAÇÃO
                            <div className="space-y-3">
                                <pre className="bg-muted p-3 rounded-md text-xs font-mono whitespace-pre-wrap break-words">
                                    {displayMemoria}
                                </pre>
                                
                                {isPTrabEditable && (
                                    <div className="flex justify-end gap-2">
                                        {isCustomized && (
                                            <Button 
                                                type="button" 
                                                variant="destructive" 
                                                size="sm"
                                                onClick={() => handleRestaurarMemoriaAutomatica(firstRecordId)}
                                                disabled={isSaving}
                                            >
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                Restaurar Automática
                                            </Button>
                                        )}
                                        <Button 
                                            type="button" 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={() => handleIniciarEdicaoMemoria(group, displayMemoria)}
                                            disabled={isSaving}
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            {isCustomized ? "Editar Customizada" : "Customizar"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

export default ConsolidatedMaterialConsumoMemoria;