import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Save, RefreshCw, XCircle } from "lucide-react";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { ConsolidatedHorasVooRecord, generateConsolidatedHorasVooMemoriaCalculo } from "@/lib/horasVooUtils";

interface ConsolidatedHorasVooMemoriaProps {
    group: ConsolidatedHorasVooRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedHorasVooRecord, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConsolidatedHorasVooMemoria = ({
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
}: ConsolidatedHorasVooMemoriaProps) => {
    
    // O ID do registro que está sendo editado (sempre o primeiro do grupo)
    const firstRecordId = group.records[0].id;
    const isEditing = editingMemoriaId === firstRecordId;
    
    // A memória automática é gerada a partir do grupo consolidado
    const memoriaAutomatica = generateConsolidatedHorasVooMemoriaCalculo(group);
    
    // A memória customizada é armazenada no primeiro registro do grupo
    const memoriaCustomizada = group.records[0].detalhamento_customizado;
    
    // A memória a ser exibida é a customizada, se existir, senão a automática
    const memoriaDisplay = memoriaCustomizada || memoriaAutomatica;
    
    // O texto que está no editor (se estiver editando) ou o texto de display
    const currentMemoriaText = isEditing ? memoriaEdit : memoriaDisplay;

    return (
        <Card className="shadow-lg bg-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">
                    {group.organizacao} (UG: {formatCodug(group.ug)})
                </CardTitle>
                <div className="flex items-center gap-2">
                    {memoriaCustomizada && !isEditing && (
                        <span className="text-xs text-primary font-medium">
                            (Memória Customizada)
                        </span>
                    )}
                    {isPTrabEditable && !isSaving && !isEditing && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleIniciarEdicaoMemoria(group, memoriaDisplay)}
                            disabled={isSaving}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar Memória
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <Textarea
                        value={currentMemoriaText}
                        onChange={(e) => setMemoriaEdit(e.target.value)}
                        rows={15}
                        readOnly={!isEditing}
                        className={cn(
                            "font-mono text-xs border-gray-300",
                            isEditing ? "bg-white border-primary/50" : "resize-none bg-gray-50"
                        )}
                    />
                    
                    {isEditing && (
                        <div className="flex justify-end gap-2 mt-2">
                            {memoriaCustomizada && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRestaurarMemoriaAutomatica(firstRecordId)}
                                    disabled={isSaving}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Restaurar Padrão
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSalvarMemoriaCustomizada(firstRecordId)}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar Customização
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};