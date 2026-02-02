import React from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { ConsolidatedConcessionariaRecord } from "@/lib/concessionariaUtils";
import { formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { ConcessionariaMemoriaItem } from "./ConcessionariaMemoriaItem"; // Importando o novo componente

interface ConsolidatedConcessionariaMemoriaProps {
    group: ConsolidatedConcessionariaRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    // O handler agora recebe o registro individual
    handleIniciarEdicaoMemoria: (registro: any, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConsolidatedConcessionariaMemoria: React.FC<ConsolidatedConcessionariaMemoriaProps> = ({
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
    
    // Verifica se a OM Detentora é diferente da OM Favorecida
    const isDifferentOmInMemoria = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-foreground">
                            {group.organizacao} (UG: {formatCodug(group.ug)})
                        </h4>
                    </div>
                    {isDifferentOmInMemoria && (
                        <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-600">
                                Destino Recurso: {group.om_detentora} ({formatCodug(group.ug_detentora)})
                            </span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Itera sobre os registros individuais */}
            <div className="space-y-3">
                {group.records.map(registro => (
                    <ConcessionariaMemoriaItem
                        key={registro.id}
                        registro={registro}
                        isPTrabEditable={isPTrabEditable}
                        isSaving={isSaving}
                        editingMemoriaId={editingMemoriaId}
                        memoriaEdit={memoriaEdit}
                        setMemoriaEdit={setMemoriaEdit}
                        handleIniciarEdicaoMemoria={handleIniciarEdicaoMemoria}
                        handleCancelarEdicaoMemoria={handleCancelarEdicaoMemoria}
                        handleSalvarMemoriaCustomizada={handleSalvarMemoriaCustomizada}
                        handleRestaurarMemoriaAutomatica={handleRestaurarMemoriaAutomatica}
                    />
                ))}
            </div>
        </div>
    );
};